// Local stand-in for Vercel's /api functions: serves them on 127.0.0.1:4301 and starts
// `ng serve` with a proxy to it. Backend settings come from .env.local (BACKEND_URL, BACKEND_API_KEY).
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { loadApi } from './load-api.mjs';

const root = new URL('../', import.meta.url);
const routes = await loadApi('api-dev');
const MAX = 4096;

const server = createServer(async (req, res) => {
  try {
    const name = req.url?.match(/^\/api\/(stats|comments|health)(?:\?|$)/)?.[1];
    const handler = name && routes[name][req.method];
    if (!handler) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"not found"}'); return; }
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > MAX) { res.writeHead(413); res.end(); return; }
    }
    // The Angular proxy keeps the browser's Origin, so validate against the dev server's origin.
    const request = new Request(`http://localhost:4200${req.url}`, {
      method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ configured: false }));
  }
});

server.listen(4301, '127.0.0.1', () => {
  const target = process.env.BACKEND_URL ? `→ ${process.env.BACKEND_URL}` : '(BACKEND_URL not set: the UI will show its offline states)';
  console.log(`Local API gateway on 127.0.0.1:4301 ${target}`);
});
const child = spawn(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'serve', '--proxy-config', 'proxy.api.json'], { cwd: root, stdio: 'inherit' });
child.on('exit', code => { server.close(); process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(); server.close(); });
