// GET /api/insights — site totals and per-post rankings for the blog page.
// Cached at Vercel's edge for a minute (and served stale for up to a day while refreshing),
// so the backend sees about one request a minute however busy the site is.
import { callBackend, isCount, json } from './_lib/backend';

interface SiteTotals {
  pageViews: number; visitors: number; postViews: number; likes: number; shares: number; comments: number;
  timeOnSiteSeconds: number; readingSeconds: number; avgVisitSeconds: number;
}
interface PostInsight {
  slug: string; views: number; likes: number; shares: number; comments: number;
  readers: number; readingSeconds: number; avgReadSeconds: number;
}
interface Insights { site: SiteTotals; posts: PostInsight[]; readerThresholdSeconds: number; generatedAt: string }

const SITE_KEYS = ['pageViews', 'visitors', 'postViews', 'likes', 'shares', 'comments', 'timeOnSiteSeconds', 'readingSeconds', 'avgVisitSeconds'] as const;
const POST_KEYS = ['views', 'likes', 'shares', 'comments', 'readers', 'readingSeconds', 'avgReadSeconds'] as const;
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

function valid(d: Insights | undefined): d is Insights {
  return !!d && !!d.site && SITE_KEYS.every(k => isCount(d.site[k])) && Array.isArray(d.posts) &&
    d.posts.every(p => p && typeof p.slug === 'string' && SLUG.test(p.slug) && POST_KEYS.every(k => isCount(p[k])));
}

export async function GET(): Promise<Response> {
  const result = await callBackend<Insights>('GET', '/api/v1/insights');
  if (!result.ok || !valid(result.data)) {
    return json({ configured: false, message: 'Stats are temporarily unavailable.' }, 503, { 'retry-after': '30' });
  }
  const { site, posts, readerThresholdSeconds, generatedAt } = result.data;
  const body = {
    configured: true,
    site: Object.fromEntries(SITE_KEYS.map(k => [k, site[k]])),
    posts: posts.map(p => ({ slug: p.slug, ...Object.fromEntries(POST_KEYS.map(k => [k, p[k]])) })),
    readerThresholdSeconds,
    generatedAt
  };
  const response = json(body, 200);
  response.headers.set('cache-control', 'public, max-age=0, must-revalidate');
  response.headers.set('cdn-cache-control', 'public, s-maxage=60, stale-while-revalidate=86400');
  return response;
}
