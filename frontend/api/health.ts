// GET /api/health — what this gateway can see of the Rust backend. Safe to expose: it reports
// states, never URLs or keys.
//   backend: "ok" | "not_configured" | "invalid_url" | "unreachable" | "not_ready" | "unauthorized"
import { backendConfigured, callBackend, json } from './_lib/backend';

export async function GET(): Promise<Response> {
  const hasUrl = Boolean(process.env.BACKEND_URL);
  const hasKey = Boolean(process.env.BACKEND_API_KEY);
  const report = (backend: string, status = 200) =>
    json({ gateway: 'ok', backend, env: { BACKEND_URL: hasUrl, BACKEND_API_KEY: hasKey } }, status);

  if (!hasUrl || !hasKey) return report('not_configured', 503);
  if (!backendConfigured()) return report('invalid_url', 503); // must be https:// (http only for localhost)

  const ready = await callBackend<unknown>('GET', '/health/ready');
  if (!ready.ok) return report(ready.status === 503 && ready.error ? 'not_ready' : 'unreachable', 503);

  // A keyed call proves BACKEND_API_KEY matches the backend's SERVICE_API_KEY.
  const keyed = await callBackend<unknown>('GET', '/api/v1/posts/health-check/stats');
  if (keyed.status === 401) return report('unauthorized', 503);
  return report(keyed.ok ? 'ok' : 'unreachable', keyed.ok ? 200 : 503);
}
