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
featured: true             # optional; pins the post to the top of /blog (newest featured post leads)
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

## Views, likes, shares and comments

All four are served by the Rust API in [`../backend`](../backend/README.md) (MySQL). The browser
never talks to it directly: it calls the same-origin Vercel functions in `api/`, which add the
server-only API key, a visitor cookie and a 2.5-second timeout.

| Browser calls | Vercel function | Rust API |
| --- | --- | --- |
| `GET /api/stats?slug=` | `api/stats.ts` | `GET /api/v1/posts/{slug}/stats` |
| `POST /api/stats { slug, action, channel? }` (view, like, share) | `api/stats.ts` | `POST /api/v1/posts/{slug}/views`, `/likes`, `/shares` |
| `GET /api/comments?slug=` | `api/comments.ts` | `GET /api/v1/posts/{slug}/comments` (cursor-paged) |
| `POST /api/comments { slug, name, body, website }` | `api/comments.ts` | `POST /api/v1/posts/{slug}/comments` |

**Local development** (from `frontend/`):

1. Start the API: `cd ../backend && cargo run` (reads `backend/.env`).
2. Put `BACKEND_URL=http://127.0.0.1:8787` and `BACKEND_API_KEY=<SERVICE_API_KEY from backend/.env>` in `.env.local`.
3. `npm run start:api` serves the Vercel functions on :4301 and proxies `/api` from `ng serve`.
   Plain `npm start` works too; reactions then show their offline state.
4. `npm run test:api` tests the Vercel functions with the backend mocked.

**When the API is down** the article is unaffected. Counts show "—" (never a fake 0), a small
Retry link appears, comments show a retry state, the reader's comment draft stays on their device,
and share buttons still work. After one failed call the page stops calling the API for 30 seconds
(Retry overrides this), so readers never wait on repeated timeouts. Every response is validated,
so a 404, a 503, a timeout or an HTML page all count as "unavailable".

**Comments** are plain text. Name ≤ 60 characters, comment 2–1000. `website` is a honeypot: if a
bot fills it, the function pretends to accept the comment and drops it. By default comments
containing links are held as `pending` (see `COMMENT_MODERATION` in the backend); approve them
with the admin API described in the backend README.

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
