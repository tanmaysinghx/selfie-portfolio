// Vercel Function: view and like counters for blog posts, stored in Upstash Redis.
//
//   GET  /api/stats?slug=my-post            -> { views, likes, configured }
//   POST /api/stats  { slug, action: 'view' | 'like' }
//
// Each visitor (hashed IP) counts once per post per day for views and once ever for likes.
// Without Redis env vars the endpoint still answers, with zeros, so local dev keeps working.

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
const DAY = 60 * 60 * 24;

type Command = (string | number)[];

async function redis(commands: Command[]): Promise<unknown[]> {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(commands)
  });
  if (!res.ok) throw new Error(`Redis responded ${res.status}`);
  const results = (await res.json()) as { result?: unknown; error?: string }[];
  return results.map(r => r.result);
}

async function visitorId(request: Request): Promise<string> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${ua}`));
  return Array.from(new Uint8Array(digest).slice(0, 12), b => b.toString(16).padStart(2, '0')).join('');
}

async function readCounts(slug: string) {
  const [views, likes] = await redis([
    ['GET', `blog:${slug}:views`],
    ['GET', `blog:${slug}:likes`]
  ]);
  return { views: Number(views ?? 0), likes: Number(likes ?? 0), configured: true };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

export async function GET(request: Request): Promise<Response> {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  if (!SLUG.test(slug)) return json({ error: 'invalid slug' }, 400);
  if (!REDIS_URL || !REDIS_TOKEN) return json({ views: 0, likes: 0, configured: false });

  try {
    return json(await readCounts(slug));
  } catch {
    return json({ error: 'stats unavailable' }, 502);
  }
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { slug?: string; action?: string };
  const slug = body.slug ?? '';
  const action = body.action;
  if (!SLUG.test(slug) || (action !== 'view' && action !== 'like')) {
    return json({ error: 'expected { slug, action: "view" | "like" }' }, 400);
  }
  if (!REDIS_URL || !REDIS_TOKEN) return json({ views: 0, likes: 0, configured: false });

  try {
    const visitor = await visitorId(request);
    const counter = action === 'view' ? 'views' : 'likes';
    const guard: Command =
      action === 'view'
        ? ['SET', `blog:${slug}:seen:${visitor}`, 1, 'NX', 'EX', DAY]
        : ['SET', `blog:${slug}:liked:${visitor}`, 1, 'NX'];

    const [firstTime] = await redis([guard]);
    if (firstTime === 'OK') {
      await redis([['INCR', `blog:${slug}:${counter}`]]);
    }
    return json(await readCounts(slug));
  } catch {
    return json({ error: 'stats unavailable' }, 502);
  }
}
