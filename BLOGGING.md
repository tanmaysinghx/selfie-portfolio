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

## Views and likes (one-time Vercel setup)

`api/stats.ts` is a Vercel Function that counts views and likes in Redis.
Until Redis is connected the counters stay hidden and everything else works.

1. Vercel dashboard → your project → **Storage** → **Create Database** → **Upstash for Redis** (free tier).
2. Connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars.
3. Redeploy.

To try the API locally, run `npx vercel dev` instead of `npm start`. It serves the Angular
app and `/api` together; `npx vercel env pull .env.local` fetches the Redis keys.
