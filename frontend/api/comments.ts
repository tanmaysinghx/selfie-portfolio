// GET  /api/comments?slug=…                     -> { comments: [{ id, name, body, createdAt }] } (oldest first)
// POST /api/comments { slug, name, body, website } -> { comment, status: "published" | "pending" }
import { SLUG, callBackend, json, readJsonBody, visitor } from './_lib/backend';

interface Comment { id: string; name: string; body: string; createdAt: string }
interface CommentPage { comments: Comment[]; nextCursor: string | null }
interface Posted { comment: Comment; status: 'published' | 'pending' }

const MAX_PAGES = 5; // up to 500 comments per post
const NAME_MAX = 60;
const BODY_MIN = 2;
const BODY_MAX = 1000;

function unavailable(cookie?: string): Response {
  return json({ error: 'Comments are temporarily unavailable. Please try again shortly.' }, 503, { 'set-cookie': cookie, 'retry-after': '5' });
}

function isComment(c: unknown): c is Comment {
  const v = c as Comment;
  return !!v && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.body === 'string' &&
    typeof v.createdAt === 'string' && !Number.isNaN(Date.parse(v.createdAt));
}

export async function GET(request: Request): Promise<Response> {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  if (!SLUG.test(slug)) return json({ error: 'invalid slug' }, 400);

  const comments: Comment[] = [];
  let after = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ limit: '100', ...(after ? { after } : {}) });
    const result = await callBackend<CommentPage>('GET', `/api/v1/posts/${slug}/comments?${query}`);
    if (!result.ok || !result.data || !Array.isArray(result.data.comments) || !result.data.comments.every(isComment)) {
      // Better to show nothing than half a thread.
      return unavailable();
    }
    comments.push(...result.data.comments.map(({ id, name, body, createdAt }) => ({ id, name, body, createdAt })));
    if (!result.data.nextCursor) break;
    after = result.data.nextCursor;
  }
  return json({ comments });
}

export async function POST(request: Request): Promise<Response> {
  const { body, error } = await readJsonBody(request);
  if (error) return error;
  const { slug, name, body: text, website } = body as Record<string, unknown>;
  if (typeof slug !== 'string' || !SLUG.test(slug)) return json({ error: 'invalid slug' }, 400);
  if (typeof name !== 'string' || typeof text !== 'string') return json({ error: 'expected { slug, name, body }' }, 400);

  const cleanName = name.trim();
  const cleanBody = text.trim();
  if (!cleanName || cleanName.length > NAME_MAX) return json({ error: `Name must be 1–${NAME_MAX} characters.` }, 400);
  if (cleanBody.length < BODY_MIN || cleanBody.length > BODY_MAX) return json({ error: `Comment must be ${BODY_MIN}–${BODY_MAX} characters.` }, 400);

  // Honeypot: people never see this field. Pretend it worked so bots learn nothing.
  if (typeof website === 'string' && website.trim() !== '') {
    return json({ comment: { id: crypto.randomUUID(), name: cleanName, body: cleanBody, createdAt: new Date().toISOString() }, status: 'pending' }, 201);
  }

  const who = visitor(request);
  const result = await callBackend<Posted>('POST', `/api/v1/posts/${slug}/comments`, { name: cleanName, body: cleanBody, visitorId: who.id });
  if (result.ok && result.data && isComment(result.data.comment) && (result.data.status === 'published' || result.data.status === 'pending')) {
    const { comment, status } = result.data;
    return json({ comment: { id: comment.id, name: comment.name, body: comment.body, createdAt: comment.createdAt }, status }, 201, { 'set-cookie': who.cookie });
  }
  if (result.status === 429) {
    return json({ error: 'You’ve posted a few comments in a row. Please wait a few minutes.' }, 429, { 'set-cookie': who.cookie, 'retry-after': result.retryAfter ?? '600' });
  }
  if (result.status === 422 || result.status === 400) {
    return json({ error: 'Please check your name and comment and try again.' }, 400, { 'set-cookie': who.cookie });
  }
  return unavailable(who.cookie);
}
