# Writing a blog post

Posts are Markdown files in git. Push to `main` and Vercel rebuilds the site.

```
public/posts/
  my-new-post/          ← folder name = URL: /blog/my-new-post
    index.md
    cover.webp          ← images live next to the post
    architecture.png
```

## 1. Frontmatter

```markdown
---
title: Moving AIG's quote flow off JSF
description: One or two sentences for the blog list, search and link previews.
date: 2026-11-02
updated: 2026-11-10        # optional
tags: [angular, migration]
cover: cover.webp          # optional; relative to the post folder or an absolute /path
ogImage: cover.png         # optional; link-preview image (PNG/JPG; SVG covers fall back to a same-named .png)
coverAlt: Old JSF screen next to the new Angular one
featured: true             # optional; pins the post to the top of /blog
draft: true                # optional; visible in `npm start`, never deployed
---
```

## 2. What you can put in the body

| You write | You get |
| --- | --- |
| `![Alt](diagram.png "Caption")` | Figure with caption, click to zoom |
| ` ```mermaid ` block | Flowchart / sequence / ER / state diagram ([syntax](https://mermaid.js.org/intro/)) |
| ` ```chart ` block with Chart.js JSON | Interactive chart in the site palette, plus a "View data" table |
| ` ```youtube ` block: URL, then optional caption line | Click-to-play video (privacy-enhanced embed) |
| `> [!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]` | Coloured callout box |
| ` ```java ` (any language) | Highlighted code with a Copy button |
| `## Heading` / `### Heading` | Entry in the "On this page" sidebar |

`public/posts/hello-blog/index.md` (a draft) shows every block in use. Copy from it.

## 3. Preview and publish

```bash
npm start                      # http://localhost:4200/blog, drafts included
git add public/posts/my-new-post
git commit -m "post: my new post"
git push                       # Vercel builds and publishes
```

## Views and likes (Keystone)

Blog reactions now use the sibling **Keystone** Rust service. The browser still calls
`/api/stats`; that server-only gateway forwards to Keystone with a short timeout.

1. Start Keystone from `../keystone` with `cargo run -p keystone`.
2. Set `KEYSTONE_URL` and `KEYSTONE_SERVICE_KEY` in the portfolio server environment
   (Vercel settings for deployment, `.env.local` for local development). The key must match
   Keystone. Never put it in Angular configuration.
3. For local integration, run `npm run blog` then `npm run start:keystone`.
   Plain `npm start` does not run the gateway.

`node ../keystone/scripts/configure-local.mjs` can configure the local shared key without
printing it. Production needs a deployed HTTPS Keystone URL reachable from Vercel.

If Keystone is down, the article stays readable and a small retry message appears. A like
is remembered only after confirmation. Keystone deduplicates repeated likes and daily views
using a persistent SQLite unique key and an opaque visitor cookie. Old Upstash counters are
not automatically migrated or deleted. See `../keystone/README.md` for setup and limitations.

## Google and link previews

`npm run build` (and so every Vercel deploy) runs `scripts/prerender-blog.mjs`, which writes static HTML
for `/blog` and each post with its title, description, canonical URL, Open Graph/Twitter tags and
JSON-LD, plus `sitemap.xml`, `robots.txt` and `rss.xml`. Nothing to do per post, but:

- **Write a good `description`.** It's the grey text under your link in Google (aim for 120–160 characters).
- **SVG cover?** Add a `cover.png` next to it (1200×630). LinkedIn, X and WhatsApp can't show SVG.
- **Different domain?** Set `SITE_URL` in Vercel's environment variables (defaults to `https://www.tanmaysinghx.com`).

One-time setup so Google finds the site sooner:

1. Open [Google Search Console](https://search.google.com/search-console) → **Add property** → **Domain** → `tanmaysinghx.com`.
2. Add the TXT record it gives you at your DNS provider (or Vercel → Domains if Vercel manages DNS).
3. **Sitemaps** → submit `sitemap.xml`.
4. For a new post, paste its URL into **URL inspection** → **Request indexing** to skip the wait.
