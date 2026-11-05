// Tests for the Vercel gateway functions in /api, with the Rust backend mocked via fetch.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadApi } from './load-api.mjs';

const { stats, comments, track, insights, health } = await loadApi('api-test');
const originalFetch = globalThis.fetch;
const saved = { url: process.env.BACKEND_URL, key: process.env.BACKEND_API_KEY };
after(() => {
  globalThis.fetch = originalFetch;
  for (const [k, v] of [['BACKEND_URL', saved.url], ['BACKEND_API_KEY', saved.key]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});
beforeEach(() => {
  process.env.BACKEND_URL = 'http://127.0.0.1:8080';
  process.env.BACKEND_API_KEY = 'test-key';
  globalThis.fetch = async () => { throw new Error('unexpected fetch'); };
});

const SITE = 'https://portfolio.test';
const counts = { views: 4, likes: 2, shares: 1, comments: 3 };
const envelope = (data, status = 200) => Response.json({ data, meta: { requestId: 'r' } }, { status });
const failure = (status, code, headers = {}) => Response.json({ error: { code, message: 'x', requestId: 'r' } }, { status, headers });
function post(path, body, headers = {}) {
  return new Request(`${SITE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

test('stats: missing config or an unreachable backend degrade to 503 without leaking details', async () => {
  delete process.env.BACKEND_API_KEY;
  let res = await stats.GET(new Request(`${SITE}/api/stats?slug=post`));
  assert.equal(res.status, 503); assert.equal((await res.json()).configured, false);

  process.env.BACKEND_URL = 'http://127.0.0.1:8080';
  process.env.BACKEND_API_KEY = 'test-key';
  globalThis.fetch = async () => { throw new Error('private upstream error'); };
  res = await stats.POST(post('/api/stats', { slug: 'post', action: 'like' }));
  assert.equal(res.status, 503);
  assert.match(res.headers.get('set-cookie'), /visitor_id=.*HttpOnly; SameSite=Lax; Path=\/api/);
  assert.doesNotMatch(await res.text(), /private upstream/);
});

test('stats and health use the production backend when no URL override is set', async () => {
  delete process.env.BACKEND_URL;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(new URL(url));
    assert.equal(new URL(url).origin, 'https://selfie.tanmaysinghx.com');
    assert.equal(options.headers['x-api-key'], 'test-key');
    return envelope(counts);
  };
  assert.equal((await stats.GET(new Request(`${SITE}/api/stats?slug=post`))).status, 200);
  const response = await health.GET();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).backend, 'ok');
  assert.equal(calls.length, 3);
});

test('stats: refuses non-HTTPS remote backends and URLs with credentials', async () => {
  globalThis.fetch = async () => envelope(counts);
  for (const url of ['http://api.example.com', 'https://user:pw@api.example.com']) {
    process.env.BACKEND_URL = url;
    assert.equal((await stats.GET(new Request(`${SITE}/api/stats?slug=post`))).status, 503, url);
  }
});

test('stats: forwards visitor + key server-side and unwraps the envelope', async () => {
  const id = crypto.randomUUID();
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, '/api/v1/posts/post/likes');
    assert.equal(options.headers['x-api-key'], 'test-key');
    assert.deepEqual(JSON.parse(options.body), { visitorId: id });
    assert.ok(options.signal); assert.equal(options.redirect, 'error');
    return envelope(counts);
  };
  const res = await stats.POST(post('/api/stats', { slug: 'post', action: 'like' }, { cookie: `visitor_id=${id}` }));
  assert.equal(res.status, 200); assert.equal(res.headers.get('set-cookie'), null);
  assert.deepEqual(await res.json(), { ...counts, configured: true });
});

test('stats: legacy keystone cookie is reused and migrated', async () => {
  const id = crypto.randomUUID();
  globalThis.fetch = async (_url, options) => { assert.equal(JSON.parse(options.body).visitorId, id); return envelope(counts); };
  const res = await stats.POST(post('/api/stats', { slug: 'post', action: 'view' }, { cookie: `keystone_visitor=${id}` }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('set-cookie'), new RegExp(`visitor_id=${id}`));
});

test('stats: shares need a known channel', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, '/api/v1/posts/post/shares');
    assert.equal(JSON.parse(options.body).channel, 'linkedin');
    return envelope(counts);
  };
  assert.equal((await stats.POST(post('/api/stats', { slug: 'post', action: 'share', channel: 'linkedin' }))).status, 200);
  assert.equal((await stats.POST(post('/api/stats', { slug: 'post', action: 'share', channel: 'fax' }))).status, 400);
});

test('stats: rejects cross-origin writes, bad input and bad upstream payloads', async () => {
  assert.equal((await stats.POST(post('/api/stats', { slug: 'post', action: 'like' }, { origin: 'https://evil.test' }))).status, 403);
  assert.equal((await stats.POST(post('/api/stats', null))).status, 400);
  assert.equal((await stats.GET(new Request(`${SITE}/api/stats?slug=bad_slug`))).status, 400);
  globalThis.fetch = async () => envelope({ ...counts, likes: -1 });
  assert.equal((await stats.GET(new Request(`${SITE}/api/stats?slug=post`))).status, 503);
  globalThis.fetch = async () => new Response('<html>502</html>', { status: 502 });
  assert.equal((await stats.GET(new Request(`${SITE}/api/stats?slug=post`))).status, 503);
});

const c1 = { id: '0192f3a0-0000-7000-8000-000000000001', name: 'Asha', body: 'Nice', createdAt: '2026-11-05T10:00:00.000Z' };
const c2 = { ...c1, id: '0192f3a0-0000-7000-8000-000000000002' };

test('comments: follows cursors and returns the frontend shape', async () => {
  let calls = 0;
  globalThis.fetch = async (url) => {
    const after = new URL(url).searchParams.get('after');
    calls++;
    return after ? envelope({ comments: [c2], nextCursor: null }) : envelope({ comments: [c1], nextCursor: c1.id });
  };
  const res = await comments.GET(new Request(`${SITE}/api/comments?slug=post`));
  assert.equal(res.status, 200); assert.equal(calls, 2);
  assert.deepEqual(await res.json(), { comments: [c1, c2] });
});

test('comments: backend down means 503, never a partial thread', async () => {
  let calls = 0;
  globalThis.fetch = async () => (++calls === 1 ? envelope({ comments: [c1], nextCursor: c1.id }) : failure(503, 'storage_unavailable'));
  assert.equal((await comments.GET(new Request(`${SITE}/api/comments?slug=post`))).status, 503);
});

test('comments: posting validates, trims and forwards with the visitor', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, '/api/v1/posts/post/comments');
    const body = JSON.parse(options.body);
    assert.equal(body.name, 'Asha'); assert.equal(body.body, 'Great read'); assert.ok(body.visitorId);
    return envelope({ comment: c1, status: 'published' }, 201);
  };
  const res = await comments.POST(post('/api/comments', { slug: 'post', name: ' Asha ', body: ' Great read ', website: '' }));
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { comment: c1, status: 'published' });

  assert.equal((await comments.POST(post('/api/comments', { slug: 'post', name: '', body: 'hi there', website: '' }))).status, 400);
  assert.equal((await comments.POST(post('/api/comments', { slug: 'post', name: 'A', body: 'x'.repeat(1001), website: '' }))).status, 400);
});

test('comments: honeypot submissions look accepted but never reach the backend', async () => {
  const res = await comments.POST(post('/api/comments', { slug: 'post', name: 'Bot', body: 'buy now', website: 'http://spam' }));
  assert.equal(res.status, 201); assert.equal((await res.json()).status, 'pending');
});

test('comments: rate limits and outages map to friendly errors', async () => {
  globalThis.fetch = async () => failure(429, 'rate_limited', { 'retry-after': '600' });
  let res = await comments.POST(post('/api/comments', { slug: 'post', name: 'A', body: 'hello', website: '' }));
  assert.equal(res.status, 429); assert.equal(res.headers.get('retry-after'), '600');
  globalThis.fetch = async () => { throw new Error('down'); };
  res = await comments.POST(post('/api/comments', { slug: 'post', name: 'A', body: 'hello', website: '' }));
  assert.equal(res.status, 503);
});

test('track: forwards page views and heartbeats with the visitor, validates input', async () => {
  const seen = [];
  globalThis.fetch = async (url, options) => { seen.push([new URL(url).pathname, JSON.parse(options.body)]); return envelope({ accepted: true }); };
  assert.equal((await track.POST(post('/api/track', { type: 'pageview', path: '/blog/post' }))).status, 202);
  assert.equal((await track.POST(post('/api/track', { type: 'engagement', path: '/blog/post', seconds: 30 }))).status, 202);
  assert.deepEqual(seen.map(s => s[0]), ['/api/v1/site/pageviews', '/api/v1/site/engagement']);
  assert.equal(seen[1][1].seconds, 30); assert.ok(seen[1][1].visitorId);
  for (const bad of [{ type: 'pageview', path: 'nope' }, { type: 'engagement', path: '/', seconds: 999 }, { type: 'click', path: '/' }]) {
    assert.equal((await track.POST(post('/api/track', bad))).status, 400, JSON.stringify(bad));
  }
});

test('track: honours Do Not Track and degrades to 503 when the backend is down', async () => {
  assert.equal((await track.POST(post('/api/track', { type: 'pageview', path: '/' }, { dnt: '1' }))).status, 204);
  globalThis.fetch = async () => { throw new Error('down'); };
  assert.equal((await track.POST(post('/api/track', { type: 'pageview', path: '/' }))).status, 503);
});

const insightsData = {
  site: { pageViews: 10, visitors: 4, postViews: 6, likes: 2, shares: 1, comments: 1, timeOnSiteSeconds: 900, readingSeconds: 600, avgVisitSeconds: 120 },
  posts: [{ slug: 'post', views: 6, likes: 2, shares: 1, comments: 1, readers: 3, readingSeconds: 600, avgReadSeconds: 200, extra: 'dropped' }],
  readerThresholdSeconds: 30, generatedAt: '2026-11-05T10:00:00.000Z'
};

test('insights: validated, trimmed and edge-cached', async () => {
  globalThis.fetch = async () => envelope(insightsData);
  const res = await insights.GET();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cdn-cache-control'), /s-maxage=60/);
  const body = await res.json();
  assert.equal(body.configured, true); assert.equal(body.site.pageViews, 10);
  assert.equal(body.posts[0].readers, 3); assert.equal(body.posts[0].extra, undefined);
});

test('insights: bad payloads and outages are 503 and never cached', async () => {
  globalThis.fetch = async () => envelope({ ...insightsData, site: { ...insightsData.site, likes: -1 } });
  let res = await insights.GET();
  assert.equal(res.status, 503); assert.equal(res.headers.get('cache-control'), 'no-store');
  globalThis.fetch = async () => { throw new Error('down'); };
  res = await insights.GET();
  assert.equal(res.status, 503); assert.equal((await res.json()).configured, false);
});
