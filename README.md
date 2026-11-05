# selfie-portfolio

Source for [tanmaysinghx.com](https://www.tanmaysinghx.com): a portfolio and blog.

```text
frontend/   Angular 21 site + Vercel functions (api/) — deployed on Vercel
backend/    Rust (Axum + SQLx) API for views, likes, shares and comments — MySQL, deployed as a container
api/        Re-exports of frontend/api for Vercel builds from the repo root
```

```mermaid
flowchart LR
  B[Browser] -->|same origin /api/stats, /api/comments| V[Vercel functions<br/>frontend/api]
  B -->|static pages, posts| S[Vercel static hosting]
  V -->|x-api-key, 2.5 s timeout| R[Rust API<br/>backend]
  R --> M[(MySQL)]
```

The site works without the backend. Posts, pages and search are static. If the API is slow or down, reactions show "—" with a Retry link and comments show a retry state. The page then stops calling the API for 30 seconds so readers don't wait on timeouts.

## Develop

```sh
# API (needs backend/.env, see backend/.env.example)
cd backend && cargo run

# Site (from another terminal)
cd frontend && npm ci && npm run start:api   # or `npm start` without the API gateway
```

Writing posts: [frontend/BLOGGING.md](frontend/BLOGGING.md). API reference: [backend/README.md](backend/README.md).

## Deploy

**Frontend (Vercel).** Every push to `main` deploys. The root `vercel.json` builds `frontend/`, and root `api/*.ts` re-export `frontend/api/*`. Alternatively, set the project's Root Directory to `frontend`, and Vercel uses `frontend/vercel.json` instead. Environment variables:

| Name | Value |
| --- | --- |
| `BACKEND_URL` | HTTPS URL of the deployed backend, e.g. `https://selfie.tanmaysinghx.com` |
| `BACKEND_API_KEY` | Same value as the backend's `SERVICE_API_KEY` |

**Backend** runs at **https://selfie.tanmaysinghx.com**. It's deployed by the Jenkins job `applications/dev/selfie-backend`, whose pipeline lives in [ts-infra-devops-5005](https://github.com/tanmaysinghx/ts-infra-devops-5005/blob/main/application-pipelines/dev-builds/selfie-backend.groovy). See [backend/README.md → Deploy](backend/README.md#deploy).

## Test

```sh
cd backend  && cargo test           # add TEST_DATABASE_URL=… for end-to-end MySQL tests
cd frontend && npm test && npm run test:api
```
