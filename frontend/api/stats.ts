// Same-origin gateway. Keystone credentials never reach the browser.
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
const VISITOR = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COOKIE = 'keystone_visitor';
function json(body: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  if (cookie) headers.set('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}
function unavailable(cookie?: string): Response {
  return json({ views: 0, likes: 0, configured: false, message: 'Reactions are temporarily unavailable. Please try again shortly.' }, 503, cookie);
}
function visitor(request: Request): { id: string; cookie?: string } {
  const value = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (value && VISITOR.test(value)) return { id: value };
  const id = crypto.randomUUID();
  return { id, cookie: `${COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` };
}
async function forward(slug: string, action?: 'view' | 'like', identity?: { id: string; cookie?: string }): Promise<Response> {
  const base = process.env.KEYSTONE_URL;
  const key = process.env.KEYSTONE_SERVICE_KEY;
  if (!base || !key) return unavailable(identity?.cookie);
  try {
    const target = new URL('/api/v1/blog/stats', base);
    if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))) return unavailable(identity?.cookie);
    if (target.username || target.password) return unavailable(identity?.cookie);
    if (!action) target.searchParams.set('slug', slug);
    const response = await fetch(target, {
      method: action ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-keystone-key': key },
      body: action ? JSON.stringify({ slug, action, visitor: identity!.id }) : undefined,
      signal: AbortSignal.timeout(2500), redirect: 'error'
    });
    if (!response.ok) return unavailable(identity?.cookie);
    const data = await response.json() as { views?: unknown; likes?: unknown; configured?: unknown };
    if (data.configured !== true || !Number.isSafeInteger(data.views) || !Number.isSafeInteger(data.likes) || Number(data.views) < 0 || Number(data.likes) < 0) return unavailable(identity?.cookie);
    return json({ views: data.views, likes: data.likes, configured: true }, 200, identity?.cookie);
  } catch { return unavailable(identity?.cookie); }
}
export async function GET(request: Request): Promise<Response> {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  if (!SLUG.test(slug)) return json({ error: 'invalid slug' }, 400);
  return forward(slug);
}
export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'origin not allowed' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'JSON required' }, 415);
  if (Number(request.headers.get('content-length')) > 2048) return json({ error: 'request too large' }, 413);
  const raw = await request.text();
  if (raw.length > 2048) return json({ error: 'request too large' }, 413);
  let body: { slug?: unknown; action?: unknown };
  try { body = JSON.parse(raw); } catch { return json({ error: 'invalid JSON' }, 400); }
  if (!body || typeof body.slug !== 'string' || !SLUG.test(body.slug) || (body.action !== 'view' && body.action !== 'like')) return json({ error: 'expected { slug, action: "view" | "like" }' }, 400);
  return forward(body.slug, body.action, visitor(request));
}
