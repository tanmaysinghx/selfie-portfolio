// Transpiles the Vercel functions in /api to ESM so local scripts and tests can import them
// the way Vercel runs them. Returns { stats, comments } modules.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';

const root = new URL('../', import.meta.url);

export async function loadApi(cacheName) {
  const out = new URL(`node_modules/.cache/${cacheName}/`, root);
  await mkdir(new URL('_lib/', out), { recursive: true });
  for (const file of ['_lib/backend', 'stats', 'comments', 'health']) {
    const source = await readFile(new URL(`api/${file}.ts`, root), 'utf8');
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
    }).outputText.replace(/from '\.\/_lib\/backend'/g, "from './_lib/backend.mjs'");
    await writeFile(new URL(`${file}.mjs`, out), js);
  }
  const bust = `?t=${Date.now()}`;
  return {
    stats: await import(new URL('stats.mjs', out).href + bust),
    comments: await import(new URL('comments.mjs', out).href + bust),
    health: await import(new URL('health.mjs', out).href + bust)
  };
}
