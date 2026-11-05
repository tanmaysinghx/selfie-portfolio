// GET  /api/stats?slug=…                      -> { views, likes, shares, comments, configured: true }
// POST /api/stats { slug, action, channel? }   action: view | like | share
// Any backend problem answers 503 { configured: false }, which the page shows as "—".
import { SLUG, callBackend, isCount, json, readJsonBody, visitor } from './_lib/backend';

const CHANNELS = new Set(['copy', 'linkedin', 'x', 'native']);

interface PostStats { views: number; likes: number; shares: number; comments: number }

function unavailable(cookie?: string): Response {
  return json({ views: 0, likes: 0, configured: false, message: 'Reactions are temporarily unavailable. Please try again shortly.' }, 503, { 'set-cookie': cookie });
}

function respond(result: { ok: boolean; data?: PostStats }, cookie?: string): Response {
  const s = result.data;
  if (!result.ok || !s || !isCount(s.views) || !isCount(s.likes) || !isCount(s.shares) || !isCount(s.comments)) return unavailable(cookie);
  return json({ views: s.views, likes: s.likes, shares: s.shares, comments: s.comments, configured: true }, 200, { 'set-cookie': cookie });
}

export async function GET(request: Request): Promise<Response> {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  if (!SLUG.test(slug)) return json({ error: 'invalid slug' }, 400);
  return respond(await callBackend<PostStats>('GET', `/api/v1/posts/${slug}/stats`));
}

export async function POST(request: Request): Promise<Response> {
  const { body, error } = await readJsonBody(request);
  if (error) return error;
  const { slug, action, channel } = body as { slug?: unknown; action?: unknown; channel?: unknown };
  if (typeof slug !== 'string' || !SLUG.test(slug)) return json({ error: 'invalid slug' }, 400);
  if (action !== 'view' && action !== 'like' && action !== 'share') return json({ error: 'expected { slug, action: "view" | "like" | "share" }' }, 400);
  if (action === 'share' && (typeof channel !== 'string' || !CHANNELS.has(channel))) return json({ error: 'invalid share channel' }, 400);

  const who = visitor(request);
  const path = `/api/v1/posts/${slug}/${action}s`;
  const payload = action === 'share' ? { visitorId: who.id, channel } : { visitorId: who.id };
  return respond(await callBackend<PostStats>('POST', path, payload), who.cookie);
}
