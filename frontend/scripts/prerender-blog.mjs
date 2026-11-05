// Runs after `ng build`. The site renders in the browser, so on its own every URL serves the same
// empty index.html. This writes static HTML for /blog and each post (real <title>, description,
// canonical, Open Graph, JSON-LD and the full article text) plus sitemap.xml, robots.txt and rss.xml,
// so search engines and link previews see the content without running JavaScript.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist', 'selfie-portfolio', 'browser');
const SITE = (process.env.SITE_URL ?? 'https://www.tanmaysinghx.com').replace(/\/$/, '');
const AUTHOR = 'Tanmay Singh';
const DEFAULT_IMAGE = '/images/tanmay/portrait-scarf.webp';

const escapeHtml = s =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const exists = p => access(p).then(() => true, () => false);

/** Compiles the app's markdown.ts to plain JS so the build renders posts exactly like the browser does. */
async function loadRenderer() {
  const source = await readFile(join(ROOT, 'src/app/features/blog/markdown.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  });
  // Inside node_modules so the compiled file can resolve its own `marked` import.
  const out = join(ROOT, 'node_modules', '.cache', 'blog-prerender', 'markdown.mjs');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, outputText);
  return (await import(`${pathToFileURL(out).href}?t=${Date.now()}`)).renderMarkdown;
}

/** Social networks can't show SVG, so an SVG cover uses a same-named .png next to it when there is one. */
async function socialImage(post) {
  const image = post.ogImage ?? post.cover;
  if (!image) return SITE + DEFAULT_IMAGE;
  if (image.endsWith('.svg')) {
    const png = image.replace(/\.svg$/, '.png');
    return (await exists(join(DIST, png))) ? SITE + png : SITE + DEFAULT_IMAGE;
  }
  return /^https?:/.test(image) ? image : SITE + image;
}

function withHead(template, { title, description, url, image, type, extra = '' }) {
  const tags = `
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="${AUTHOR}">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">${extra}
`;
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}">`)
    // The page-specific tags below replace the site-wide Open Graph defaults.
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace('</head>', `${tags}</head>`);
}

/** Content inside <app-root> is what crawlers read; Angular replaces it as soon as the app boots. */
function withBody(template, html) {
  return template.replace(/<app-root>[\s\S]*?<\/app-root>/, `<app-root>${html}</app-root>`);
}

function jsonLd(data) {
  return `\n  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

async function main() {
  const template = await readFile(join(DIST, 'index.html'), 'utf8');
  const posts = JSON.parse(await readFile(join(DIST, 'posts', 'index.json'), 'utf8'));
  const renderMarkdown = await loadRenderer();
  await mkdir(join(DIST, 'blog'), { recursive: true });

  for (const post of posts) {
    const url = `${SITE}/blog/${post.slug}`;
    const markdown = (await readFile(join(DIST, 'posts', post.slug, 'index.md'), 'utf8'))
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    const { html } = renderMarkdown(markdown, post.slug);
    const image = await socialImage(post);

    const head = withHead(template, {
      title: `${post.title} · ${AUTHOR}`,
      description: post.description,
      url,
      image,
      type: 'article',
      extra:
        `\n  <meta property="article:published_time" content="${post.date}">` +
        (post.updated ? `\n  <meta property="article:modified_time" content="${post.updated}">` : '') +
        post.tags.map(t => `\n  <meta property="article:tag" content="${escapeHtml(t)}">`).join('') +
        jsonLd({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.updated ?? post.date,
          image: [image],
          keywords: post.tags.join(', '),
          mainEntityOfPage: url,
          url,
          author: { '@type': 'Person', name: AUTHOR, url: SITE }
        })
    });

    const article = `
<main class="container">
  <article>
    <p><a href="/blog">All posts</a></p>
    <h1>${escapeHtml(post.title)}</h1>
    <p>${escapeHtml(post.description)}</p>
    <p><time datetime="${post.date}">${post.date}</time> · ${post.readingMinutes} min read · ${escapeHtml(AUTHOR)}</p>
    <div class="blog-prose">${html.replace(/<div class="blog-loading">[^<]*<\/div>/g, '')}</div>
  </article>
</main>`;

    await writeFile(join(DIST, 'blog', `${post.slug}.html`), withBody(head, article));
  }

  // /blog listing: links to every post so crawlers can discover them.
  const listHead = withHead(template, {
    title: AUTHOR,
    description: `Writing by ${AUTHOR} on Java, Spring, Angular, system design and self-hosting.`,
    url: `${SITE}/blog`,
    image: SITE + DEFAULT_IMAGE,
    type: 'website',
    extra: jsonLd({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${AUTHOR}'s blog`,
      url: `${SITE}/blog`,
      author: { '@type': 'Person', name: AUTHOR, url: SITE },
      blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.date }))
    })
  });
  const list = `
<main class="container">
  <h1>Blog</h1>
  <ul>${posts
    .map(p => `\n    <li><a href="/blog/${p.slug}">${escapeHtml(p.title)}</a>: ${escapeHtml(p.description)} <time datetime="${p.date}">${p.date}</time></li>`)
    .join('')}
  </ul>
</main>`;
  await writeFile(join(DIST, 'blog.html'), withBody(listHead, list));

  // Home page: same title as before, plus a canonical URL and absolute share image.
  await writeFile(
    join(DIST, 'index.html'),
    template
      .replace('<meta property="og:image" content="/', `<meta property="og:image" content="${SITE}/`)
      .replace('</head>', `  <link rel="canonical" href="${SITE}/">\n  <meta property="og:url" content="${SITE}/">\n  <meta name="twitter:card" content="summary_large_image">\n</head>`)
  );

  const latest = posts.reduce((max, p) => ((p.updated ?? p.date) > max ? p.updated ?? p.date : max), '');
  const urls = [
    { loc: `${SITE}/`, lastmod: latest },
    { loc: `${SITE}/blog`, lastmod: latest },
    ...posts.map(p => ({ loc: `${SITE}/blog/${p.slug}`, lastmod: p.updated ?? p.date }))
  ];
  await writeFile(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
  );

  await writeFile(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);

  await writeFile(
    join(DIST, 'rss.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${AUTHOR}</title>
    <link>${SITE}/blog</link>
    <description>Writing by ${AUTHOR} on Java, Spring, Angular, system design and self-hosting.</description>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
${posts
  .map(
    p => `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid>${SITE}/blog/${p.slug}</guid>
      <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeHtml(p.description)}</description>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>
`
  );

  console.log(`[seo] prerendered ${posts.length} post(s), /blog, sitemap.xml, robots.txt, rss.xml for ${SITE}`);
}

main().catch(err => {
  console.error('[seo] prerender failed:', err);
  process.exit(1);
});
