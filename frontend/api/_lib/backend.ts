// Shared helpers for the Vercel functions in /api. Files under an underscore folder are not
// deployed as routes. The browser only ever talks to these same-origin functions; the Rust
// backend's URL and API key stay server-side.

export const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
const VISITOR = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COOKIE = 'visitor_id';
/** Read for continuity with the previous Keystone gateway, never written. */
const LEGACY_COOKIE = 'keystone_visitor';
const TIMEOUT_MS = 2500;
export const MAX_BODY_BYTES = 4096;

export interface Visitor { id: string; cookie?: string }

export interface BackendResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown };
  retryAfter?: string | null;
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string | undefined> = {}): Response {
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  for (const [k, v] of Object.entries(extraHeaders)) if (v) headers.set(k, v);
  return new Response(JSON.stringify(body), { status, headers });
}

export function visitor(request: Request): Visitor {
  const cookies = request.headers.get('cookie')?.split(';').map(v => v.trim()) ?? [];
  for (const name of [COOKIE, LEGACY_COOKIE]) {
    const value = cookies.find(v => v.startsWith(`${name}=`))?.slice(name.length + 1);
    if (value && VISITOR.test(value)) {
      return name === COOKIE ? { id: value.toLowerCase() } : { id: value.toLowerCase(), cookie: makeCookie(request, value.toLowerCase()) };
    }
  }
  const id = crypto.randomUUID();
  return { id, cookie: makeCookie(request, id) };
}

function makeCookie(request: Request, id: string): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=31536000${secure}`;
}

/** Rejects cross-site and malformed POSTs before anything is forwarded. */
export async function readJsonBody(request: Request): Promise<{ body?: Record<string, unknown>; error?: Response }> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return { error: json({ error: 'origin not allowed' }, 403) };
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return { error: json({ error: 'JSON required' }, 415) };
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return { error: json({ error: 'request too large' }, 413) };
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { error: json({ error: 'request too large' }, 413) };
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: json({ error: 'invalid JSON' }, 400) };
    return { body };
  } catch {
    return { error: json({ error: 'invalid JSON' }, 400) };
  }
}

/** Backend base URL, or null when unset or unsafe (non-HTTPS outside localhost, embedded credentials). */
function baseUrl(): URL | null {
  const raw = process.env.BACKEND_URL;
  if (!raw || !process.env.BACKEND_API_KEY) return null;
  try {
    const url = new URL(raw);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function backendConfigured(): boolean {
  return baseUrl() !== null;
}

/**
 * Calls the Rust API with a short timeout. Never throws: network errors, timeouts,
 * non-JSON bodies and unexpected shapes all come back as `{ ok: false, status: 503 }`.
 */
export async function callBackend<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<BackendResult<T>> {
  const base = baseUrl();
  if (!base) return { ok: false, status: 503 };
  try {
    const target = new URL(path, base);
    const response = await fetch(target, {
      method,
      headers: { accept: 'application/json', 'content-type': 'application/json', 'x-api-key': process.env.BACKEND_API_KEY! },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error'
    });
    const payload = await response.json().catch(() => null) as { data?: T; error?: BackendResult<T>['error'] } | null;
    if (!payload || typeof payload !== 'object') return { ok: false, status: 503 };
    if (response.ok && payload.data !== undefined) return { ok: true, status: response.status, data: payload.data };
    return { ok: false, status: response.status, error: payload.error, retryAfter: response.headers.get('retry-after') };
  } catch {
    return { ok: false, status: 503 };
  }
}

export function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
