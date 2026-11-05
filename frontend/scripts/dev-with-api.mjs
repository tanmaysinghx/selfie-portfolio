// Local stand-in for Vercel's /api functions: serves them on an available loopback port and starts
// `ng serve` with a proxy to it. Backend settings come from .env.local (BACKEND_URL, BACKEND_API_KEY).
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { loadApi } from './load-api.mjs';

const root = new URL('../', import.meta.url);
const routes = await loadApi('api-dev');
const MAX = 4096;

const server = createServer(async (req, res) => {
  try {
    const name = req.url?.match(/^\/api\/(stats|comments|health|track|insights)(?:\?|$)/)?.[1];
    const handler = name && routes[name][req.method];
    if (!handler) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"not found"}'); return; }
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > MAX) { res.writeHead(413); res.end(); return; }
    }
    // The Angular proxy keeps the browser's Origin, so validate against the dev server's origin.
    const request = new Request(`http://${req.headers.host ?? 'localhost:4200'}${req.url}`, {
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

let child;
server.on('error', error => {
  console.error(`Local API gateway failed: ${error.message}`);
  child?.kill();
  process.exitCode = 1;
});
server.listen(0, '127.0.0.1', () => {
  const gatewayUrl = `http://127.0.0.1:${server.address().port}`;
  const target = `→ ${routes.backend.backendUrl()}`;
  console.log(`Local API gateway on ${gatewayUrl} ${target}`);
  child = spawn(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'serve', '--proxy-config', 'proxy.api.cjs', ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, SELFIE_DEV_GATEWAY_URL: gatewayUrl }
  });
  child.on('error', error => {
    console.error(`Angular dev server failed: ${error.message}`);
    server.close();
    process.exitCode = 1;
  });
  child.on('exit', code => { server.close(); process.exitCode = code ?? 0; });
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child?.kill(); server.close(); });
