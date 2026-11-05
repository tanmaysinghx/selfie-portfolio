// Vercel builds this repo from the root unless the project's Root Directory is set to
// "frontend". These re-exports keep /api/* working in both setups.
export { GET, POST } from '../frontend/api/stats';
