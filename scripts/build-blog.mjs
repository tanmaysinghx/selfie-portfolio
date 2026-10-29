// Scans public/posts/<slug>/index.md and writes public/posts/index.json,
// the manifest the blog list, search and post pages read at runtime.
// Runs automatically before `npm start` (with --drafts) and `npm run build` (so on every Vercel deploy).
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const BLOG_DIR = join(import.meta.dirname, '..', 'public', 'posts');
const WORDS_PER_MINUTE = 220;
const includeDrafts = process.argv.includes('--drafts');

/** Parses the small YAML subset used in post frontmatter: `key: value` and `key: [a, b]`. */
function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: source };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    data[key] = parseValue(raw.trim());
  }
  return { data, body: source.slice(match[0].length) };
}

function parseValue(raw) {
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw
      .slice(1, -1)
      .split(',')
      .map(v => unquote(v.trim()))
      .filter(Boolean);
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return unquote(raw);
}

function unquote(v) {
  return /^(['"]).*\1$/.test(v) ? v.slice(1, -1) : v;
}

function readingMinutes(body) {
  const prose = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

async function main() {
  const entries = await readdir(BLOG_DIR, { withFileTypes: true }).catch(() => []);
  const posts = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const file = join(BLOG_DIR, entry.name, 'index.md');
    if (!(await stat(file).catch(() => null))) continue;

    const { data, body } = parseFrontmatter(await readFile(file, 'utf8'));
    if (data.draft && !includeDrafts) continue;
    if (!data.title || !data.date) {
      console.warn(`[blog] skipping ${entry.name}: frontmatter needs "title" and "date"`);
      continue;
    }

    const asset = p => (p && !/^(https?:)?\//.test(p) ? `/posts/${entry.name}/${p}` : p);
    posts.push({
      slug: entry.name,
      title: data.title,
      description: data.description ?? '',
      date: data.date,
      updated: data.updated,
      tags: data.tags ?? [],
      cover: asset(data.cover),
      coverAlt: data.coverAlt ?? data.title,
      featured: data.featured === true,
      draft: data.draft === true,
      readingMinutes: readingMinutes(body)
    });
  }

  posts.sort((a, b) => b.date.localeCompare(a.date));
  await writeFile(join(BLOG_DIR, 'index.json'), JSON.stringify(posts, null, 2) + '\n');
  console.log(`[blog] indexed ${posts.length} post(s)`);
}

main();
