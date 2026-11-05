import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const source = await readFile(new URL('../api/stats.ts', import.meta.url), 'utf8');
const dir = new URL('../node_modules/.cache/stats-test/', import.meta.url);
await mkdir(dir, { recursive: true });
const target = new URL('stats.mjs', dir);
await writeFile(target, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
const { GET, POST } = await import(target.href);
const originalFetch = globalThis.fetch;
const originalUrl = process.env.KEYSTONE_URL;
const originalKey = process.env.KEYSTONE_SERVICE_KEY;
after(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.KEYSTONE_URL; else process.env.KEYSTONE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.KEYSTONE_SERVICE_KEY; else process.env.KEYSTONE_SERVICE_KEY = originalKey;
});
function setup() { process.env.KEYSTONE_URL = 'http://127.0.0.1:8090'; process.env.KEYSTONE_SERVICE_KEY = 'test-key'; }
function post(body, headers = {}) { return new Request('https://portfolio.test/api/stats', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }); }
test('unconfigured and unreachable services return a safe unavailable response', async () => {
  delete process.env.KEYSTONE_URL;
  let response = await GET(new Request('https://portfolio.test/api/stats?slug=post'));
  assert.equal(response.status, 503); assert.equal((await response.json()).configured, false);
  setup(); globalThis.fetch = async () => { throw new Error('private upstream error'); };
  response = await POST(post({ slug: 'post', action: 'like' }));
  assert.equal(response.status, 503); assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  assert.doesNotMatch(await response.text(), /private upstream/);
});
test('a stable visitor is forwarded, credentials stay server-side, and valid counts pass through', async () => {
  setup(); const id = crypto.randomUUID();
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, '/api/v1/blog/stats');
    assert.equal(options.headers['x-keystone-key'], 'test-key');
    assert.equal(JSON.parse(options.body).visitor, id);
    assert.ok(options.signal); assert.equal(options.redirect, 'error');
    return Response.json({ views: 4, likes: 2, configured: true });
  };
  const response = await POST(post({ slug: 'post', action: 'like' }, { cookie: `keystone_visitor=${id}` }));
  assert.equal(response.status, 200); assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(await response.json(), { views: 4, likes: 2, configured: true });
});
test('rejects cross-origin writes, malformed input and bad upstream payloads', async () => {
  setup(); globalThis.fetch = async () => { throw new Error('must not call'); };
  assert.equal((await POST(post({ slug: 'post', action: 'like' }, { origin: 'https://evil.test' }))).status, 403);
  assert.equal((await POST(post(null))).status, 400);
  assert.equal((await GET(new Request('https://portfolio.test/api/stats?slug=bad_slug'))).status, 400);
  globalThis.fetch = async () => Response.json({ views: 0, likes: -1, configured: true });
  assert.equal((await GET(new Request('https://portfolio.test/api/stats?slug=post'))).status, 503);
});
