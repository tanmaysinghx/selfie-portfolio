# selfie-backend

Rust API for [tanmaysinghx.com](https://www.tanmaysinghx.com): blog views, likes, shares and comments, stored in MySQL.

- **Stack:** Axum 0.8, SQLx 0.8 (MySQL, rustls), Tokio, `tracing`.
- **Callers:** only the frontend's Vercel functions (`frontend/api/*`) call the blog routes, using a shared API key. Browsers never call this service directly.
- **Built to fail gently:** the server starts even if MySQL is unreachable. It reports itself not-ready and retries migrations in the background. Data routes answer `503` with `Retry-After` until the database is back, and the site shows its offline state in the meantime.

## Run locally

```sh
cp .env.example .env        # fill in DATABASE_URL and generate the secrets
cargo run                   # http://127.0.0.1:8787 (PORT in .env)
curl localhost:8787/health/ready
```

Migrations in `migrations/` are embedded in the binary and applied at startup.

```sh
cargo test                                          # unit + HTTP tests, no database needed
TEST_DATABASE_URL="mysql://…" cargo test            # also runs end-to-end tests against MySQL
```

The end-to-end tests write rows under `zz-test-*` slugs and delete them afterwards.

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | yes | `mysql://user:pass@host:port/db?ssl-mode=required`. `jdbc:mysql://…` is accepted too. |
| `SERVICE_API_KEY` | yes | ≥ 32 chars. The frontend sends it as `x-api-key`. Must equal `BACKEND_API_KEY` in Vercel. |
| `VISITOR_HASH_SALT` | yes | ≥ 16 chars. Visitor ids are stored as `sha256(salt:id)`. Changing it resets like/view de-duplication. |
| `ADMIN_TOKEN` | no | ≥ 32 chars. Enables `/api/v1/admin/*`. If it's unset, those routes return 404. |
| `COMMENT_MODERATION` | no | `links` (default: hold comments containing links), `all`, or `off`. |
| `DB_MAX_CONNECTIONS` | no | Pool size, default `5`. Keep it small on free MySQL tiers. |
| `CORS_ALLOWED_ORIGINS` | no | Comma-separated. Only needed if a browser calls the API directly. |
| `HOST` / `PORT` | no | Default `0.0.0.0:8080`. Most hosts inject `PORT`. |
| `LOG_FORMAT` | no | `pretty` (default) or `json`. |
| `RUST_LOG` | no | e.g. `selfie_backend=debug,tower_http=info`. |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

## API

Every response is JSON and carries an `x-request-id` header (an incoming one is propagated). That id also appears in the logs.

```jsonc
// 2xx
{ "data": { … }, "meta": { "requestId": "…" } }

// 4xx / 5xx
{ "error": { "code": "validation_failed", "message": "…", "requestId": "…", "details": [{ "field": "body", "message": "…" }] } }
```

`code` is stable and safe to branch on. `message` is meant for people. A `429` or `503` response also sends a `Retry-After` header.

| Code | Status | When |
| --- | --- | --- |
| `invalid_slug`, `invalid_query`, `invalid_path`, `invalid_json` | 400 | Malformed input |
| `unauthorized` | 401 | Missing or wrong `x-api-key` / bearer token |
| `not_found`, `method_not_allowed` | 404, 405 | Unknown route |
| `payload_too_large`, `unsupported_media_type` | 413, 415 | Body > 16 KB, or not JSON |
| `validation_failed` | 422 | Field rules failed; see `details` |
| `rate_limited` | 429 | More than 3 comments in 10 minutes, or 20 in a day, per visitor |
| `storage_unavailable`, `not_ready` | 503 | MySQL unreachable, or migrations not yet applied |

### Health (no auth)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health/live` | The process is up. Never touches the DB, so use it for the platform health check. |
| GET | `/health/ready` | The DB answers and migrations have run. |

### Blog (header `x-api-key: <SERVICE_API_KEY>`)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/v1/posts/{slug}/stats` | – | `{ views, likes, shares, comments }` |
| POST | `/api/v1/posts/{slug}/views` | `{ visitorId }` | stats. Counts once per visitor per UTC day. |
| POST | `/api/v1/posts/{slug}/likes` | `{ visitorId }` | stats. Counts once per visitor. |
| POST | `/api/v1/posts/{slug}/shares` | `{ visitorId, channel: copy\|linkedin\|x\|native }` | stats. Counts once per visitor, per channel, per day. |
| GET | `/api/v1/posts/{slug}/comments?limit=50&after=<id>` | – | `{ comments: [{ id, name, body, createdAt }], nextCursor }`. Published comments only, oldest first. |
| POST | `/api/v1/posts/{slug}/comments` | `{ name, body, visitorId }` | `201 { comment, status: published\|pending }` |

`visitorId` is the v4 UUID from the gateway's `visitor_id` cookie. Reactions are idempotent: a retry or a double-click never counts twice. Re-submitting the same comment within 10 minutes returns the original comment.

### Admin (header `Authorization: Bearer <ADMIN_TOKEN>`)

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/overview` | – | Totals per post, and comment counts by status |
| GET | `/api/v1/admin/comments?status=pending&slug=&limit=&after=` | – | Moderation queue |
| PATCH | `/api/v1/admin/comments/{id}` | `{ "status": "published" \| "rejected" \| "pending" }` | Approve or reject a comment |
| DELETE | `/api/v1/admin/comments/{id}` | – | Delete a comment permanently |

```sh
API=https://selfie-backend.onrender.com
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$API/api/v1/admin/comments?status=pending"
curl -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
     -d '{"status":"published"}' "$API/api/v1/admin/comments/<id>"
```

A rejected comment still looks "pending" to its author, so spammers can't tell they were rejected.

## Data model

- `blog_post_events`: one row per (slug, kind, channel, visitor hash, bucket), enforced by a unique key. Views are bucketed by UTC day and likes are stored with the bucket `forever`.
- `blog_comments`: ids are UUIDv7, so sorting by id also sorts by time and makes cursor paging cheap. Comments are plain text (≤ 60-char name, 2–1000-char body), with control characters stripped.

No IP addresses or raw cookies are stored.

## Deploy

The service is a single static binary in a distroless, non-root container (`Dockerfile`).

**Render** (blueprint in `/render.yaml`): New → Blueprint → select the repo. Fill in `DATABASE_URL`, `SERVICE_API_KEY`, `ADMIN_TOKEN` and `VISITOR_HASH_SALT`. The health check is `/health/live`, and only changes under `backend/` trigger a deploy.

Any other container host (Fly.io, Railway, Cloud Run, a VPS) works the same way:

```sh
docker build -t selfie-backend backend
docker run --env-file backend/.env -e HOST=0.0.0.0 -p 8080:8080 selfie-backend
```

Then set `BACKEND_URL` (the HTTPS URL of this service) and `BACKEND_API_KEY` in the Vercel project.

> [!NOTE]
> Free hosts often sleep after inactivity, and the first request can take 30 s or more to wake the service. The frontend gives up after 2.5 s and shows its offline state, so readers are never blocked. If you want the counts to show on every visit, use an always-on plan or ping `/health/live` on a schedule.
