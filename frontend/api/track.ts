// POST /api/track — fire-and-forget analytics from the browser (fetch keepalive or sendBeacon).
//   { type: "pageview", path }
//   { type: "engagement", path, seconds }   active seconds since the last heartbeat (1–120)
// Always answers quickly; a backend outage only means the event is dropped.
import { callBackend, json, readJsonBody, visitor } from './_lib/backend';

const PATH = /^\/[a-z0-9/_.-]{0,199}$/i;

export async function POST(request: Request): Promise<Response> {
  // Respect Do Not Track / Global Privacy Control even if a client ignores them.
  if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return new Response(null, { status: 204 });

  const { body, error } = await readJsonBody(request);
  if (error) return error;
  const { type, path, seconds } = body as { type?: unknown; path?: unknown; seconds?: unknown };
  if (typeof path !== 'string' || !PATH.test(path)) return json({ error: 'invalid path' }, 400);

  const who = visitor(request);
  let result;
  if (type === 'pageview') {
    result = await callBackend('POST', '/api/v1/site/pageviews', { visitorId: who.id, path });
  } else if (type === 'engagement') {
    if (!Number.isInteger(seconds) || (seconds as number) < 1 || (seconds as number) > 120) return json({ error: 'invalid seconds' }, 400);
    result = await callBackend('POST', '/api/v1/site/engagement', { visitorId: who.id, path, seconds });
  } else {
    return json({ error: 'expected type "pageview" or "engagement"' }, 400);
  }
  return json({ accepted: result.ok }, result.ok ? 202 : 503, { 'set-cookie': who.cookie });
}
