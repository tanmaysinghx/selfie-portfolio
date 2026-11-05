//! Site analytics: page views, active reading time, and the aggregated "insights" that power
//! the site-wide stats and the "Most read" ranking.

use crate::{
    AppState,
    extract::ApiJson,
    now_utc,
    response::{ApiError, ApiResponse, ApiResult},
    validate,
};
use axum::extract::State;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

/// A visitor counts as a "reader" of a post after this much active time on it.
pub const READER_THRESHOLD_SECS: i64 = 30;
/// One heartbeat can't claim more than this (clients flush every ~30 s).
pub const MAX_HEARTBEAT_SECS: u32 = 120;
/// One (path, visitor, day) row can't exceed this.
pub const MAX_DAILY_SECS_PER_PATH: u32 = 4 * 3600;
/// Insights are recomputed at most this often; concurrent requests share one computation.
pub const INSIGHTS_TTL: Duration = Duration::from_secs(30);

// ---------- Tracking ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PageView {
    pub visitor_id: String,
    pub path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Heartbeat {
    pub visitor_id: String,
    pub path: String,
    pub seconds: u32,
}

#[derive(Serialize)]
pub struct Accepted {
    pub accepted: bool,
}

fn today() -> String {
    now_utc().format("%Y-%m-%d").to_string()
}

/// `POST /api/v1/site/pageviews` — counted once per visitor, per path, per UTC day.
pub async fn record_page_view(State(state): State<AppState>, ApiJson(body): ApiJson<PageView>) -> ApiResult<Accepted> {
    validate::visitor(&body.visitor_id)?;
    let path = validate::site_path(&body.path)?;
    let visitor = validate::visitor_hash(&state.config.visitor_hash_salt, &body.visitor_id);
    sqlx::query(
        "INSERT INTO site_page_views (path, visitor_hash, bucket, created_at) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = id",
    )
    .bind(&path)
    .bind(visitor)
    .bind(today())
    .bind(now_utc().naive_utc())
    .execute(&state.db)
    .await?;
    Ok(ApiResponse::ok(Accepted { accepted: true }))
}

/// `POST /api/v1/site/engagement` — adds active seconds for (path, visitor, day), capped.
pub async fn record_engagement(State(state): State<AppState>, ApiJson(body): ApiJson<Heartbeat>) -> ApiResult<Accepted> {
    validate::visitor(&body.visitor_id)?;
    let path = validate::site_path(&body.path)?;
    if body.seconds == 0 || body.seconds > MAX_HEARTBEAT_SECS {
        return Err(ApiError::validation("seconds", format!("must be 1 to {MAX_HEARTBEAT_SECS}")));
    }
    let slug = blog_slug(&path).unwrap_or_default();
    let visitor = validate::visitor_hash(&state.config.visitor_hash_salt, &body.visitor_id);
    let now = now_utc().naive_utc();
    sqlx::query(
        "INSERT INTO site_engagement (path, slug, visitor_hash, bucket, seconds, created_at, updated_at)
         VALUES (?, ?, ?, ?, LEAST(?, ?), ?, ?)
         ON DUPLICATE KEY UPDATE seconds = LEAST(seconds + VALUES(seconds), ?), updated_at = VALUES(updated_at)",
    )
    .bind(&path)
    .bind(slug)
    .bind(visitor)
    .bind(today())
    .bind(body.seconds)
    .bind(MAX_DAILY_SECS_PER_PATH)
    .bind(now)
    .bind(now)
    .bind(MAX_DAILY_SECS_PER_PATH)
    .execute(&state.db)
    .await?;
    Ok(ApiResponse::ok(Accepted { accepted: true }))
}

/// `/blog/{slug}` -> `slug`
pub fn blog_slug(path: &str) -> Option<String> {
    let rest = path.strip_prefix("/blog/")?;
    validate::slug(rest).ok().map(String::from)
}

// ---------- Insights ----------

#[derive(Serialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SiteTotals {
    /// Page views across the whole site (unique per visitor, path and day).
    pub page_views: i64,
    /// Distinct visitors ever seen.
    pub visitors: i64,
    /// Post views, likes, shares and published comments across all posts.
    pub post_views: i64,
    pub likes: i64,
    pub shares: i64,
    pub comments: i64,
    /// Active seconds on the whole site, and on blog posts only.
    pub time_on_site_seconds: i64,
    pub reading_seconds: i64,
    /// Average active seconds per visit (a visitor on a given day).
    pub avg_visit_seconds: i64,
}

#[derive(Serialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PostInsight {
    pub slug: String,
    pub views: i64,
    pub likes: i64,
    pub shares: i64,
    pub comments: i64,
    /// Visitors who spent at least `READER_THRESHOLD_SECS` actively reading.
    pub readers: i64,
    pub reading_seconds: i64,
    /// `reading_seconds / readers`, or 0.
    pub avg_read_seconds: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Insights {
    pub site: SiteTotals,
    /// Every post with any activity, most read first (readers, then reading time, then views).
    pub posts: Vec<PostInsight>,
    pub reader_threshold_seconds: i64,
    pub generated_at: String,
}

/// Single-flight cache: the lock is held while recomputing, so a burst of requests after
/// expiry runs the queries once (see "One cache miss, a million queries" on the blog).
#[derive(Default)]
pub struct InsightsCache(Mutex<Option<(Instant, Arc<Insights>)>>);

impl InsightsCache {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }
}

/// `GET /api/v1/insights`
pub async fn get_insights(State(state): State<AppState>) -> ApiResult<Arc<Insights>> {
    let mut slot = state.insights.0.lock().await;
    if let Some((at, cached)) = slot.as_ref() {
        if at.elapsed() < INSIGHTS_TTL {
            return Ok(ApiResponse::ok(cached.clone()));
        }
    }
    match compute(&state.db).await {
        Ok(fresh) => {
            let fresh = Arc::new(fresh);
            *slot = Some((Instant::now(), fresh.clone()));
            Ok(ApiResponse::ok(fresh))
        }
        // Serve the last good copy if the database hiccups.
        Err(e) => match slot.as_ref() {
            Some((_, stale)) => {
                tracing::warn!("serving stale insights after a database error");
                Ok(ApiResponse::ok(stale.clone()))
            }
            None => Err(e),
        },
    }
}

async fn compute(db: &sqlx::MySqlPool) -> Result<Insights, ApiError> {
    let (page_views, visitors): (i64, i64) =
        sqlx::query_as("SELECT COUNT(*), COUNT(DISTINCT visitor_hash) FROM site_page_views").fetch_one(db).await?;
    let (time_on_site, reading, visits): (i64, i64, i64) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(seconds), 0) AS SIGNED),
                CAST(COALESCE(SUM(CASE WHEN slug <> '' THEN seconds ELSE 0 END), 0) AS SIGNED),
                COUNT(DISTINCT visitor_hash, bucket)
         FROM site_engagement",
    )
    .fetch_one(db)
    .await?;

    let events: Vec<(String, i64, i64, i64)> = sqlx::query_as(
        "SELECT slug,
                CAST(SUM(kind = 'view') AS SIGNED), CAST(SUM(kind = 'like') AS SIGNED), CAST(SUM(kind = 'share') AS SIGNED)
         FROM blog_post_events GROUP BY slug",
    )
    .fetch_all(db)
    .await?;
    let comments: Vec<(String, i64)> =
        sqlx::query_as("SELECT slug, COUNT(*) FROM blog_comments WHERE status = 'published' GROUP BY slug")
            .fetch_all(db)
            .await?;
    // Per post: total seconds and readers (visitors whose total time on the post passes the threshold).
    let reading_rows: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT slug, CAST(SUM(total) AS SIGNED), CAST(SUM(total >= ?) AS SIGNED)
         FROM (SELECT slug, visitor_hash, SUM(seconds) AS total
               FROM site_engagement WHERE slug <> '' GROUP BY slug, visitor_hash) per_visitor
         GROUP BY slug",
    )
    .bind(READER_THRESHOLD_SECS)
    .fetch_all(db)
    .await?;

    let mut posts: HashMap<String, PostInsight> = HashMap::new();
    for (slug, views, likes, shares) in events {
        let p = posts.entry(slug.clone()).or_insert_with(|| PostInsight { slug, ..Default::default() });
        p.views = views;
        p.likes = likes;
        p.shares = shares;
    }
    for (slug, count) in comments {
        posts.entry(slug.clone()).or_insert_with(|| PostInsight { slug, ..Default::default() }).comments = count;
    }
    for (slug, seconds, readers) in reading_rows {
        let p = posts.entry(slug.clone()).or_insert_with(|| PostInsight { slug, ..Default::default() });
        p.reading_seconds = seconds;
        p.readers = readers;
        p.avg_read_seconds = if readers > 0 { seconds / readers } else { 0 };
    }

    let mut posts: Vec<PostInsight> = posts.into_values().collect();
    rank(&mut posts);

    let site = SiteTotals {
        page_views,
        visitors,
        post_views: posts.iter().map(|p| p.views).sum(),
        likes: posts.iter().map(|p| p.likes).sum(),
        shares: posts.iter().map(|p| p.shares).sum(),
        comments: posts.iter().map(|p| p.comments).sum(),
        time_on_site_seconds: time_on_site,
        reading_seconds: reading,
        avg_visit_seconds: if visits > 0 { time_on_site / visits } else { 0 },
    };
    Ok(Insights {
        site,
        posts,
        reader_threshold_seconds: READER_THRESHOLD_SECS,
        generated_at: crate::blog::iso(now_utc().naive_utc()),
    })
}

/// Most read first: readers, then total reading time, then views, then slug for stability.
pub fn rank(posts: &mut [PostInsight]) {
    posts.sort_by(|a, b| {
        b.readers
            .cmp(&a.readers)
            .then(b.reading_seconds.cmp(&a.reading_seconds))
            .then(b.views.cmp(&a.views))
            .then(a.slug.cmp(&b.slug))
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blog_paths_map_to_slugs() {
        assert_eq!(blog_slug("/blog/one-line-broke-the-internet").as_deref(), Some("one-line-broke-the-internet"));
        assert_eq!(blog_slug("/blog"), None);
        assert_eq!(blog_slug("/blog/a/b"), None);
        assert_eq!(blog_slug("/"), None);
    }

    #[test]
    fn ranking_prefers_readers_then_time_then_views() {
        let p = |slug: &str, readers, secs, views| PostInsight {
            slug: slug.into(),
            readers,
            reading_seconds: secs,
            views,
            ..Default::default()
        };
        let mut posts = vec![p("a", 1, 900, 50), p("b", 3, 100, 1), p("c", 1, 900, 80), p("d", 0, 0, 500)];
        rank(&mut posts);
        let order: Vec<_> = posts.iter().map(|p| p.slug.as_str()).collect();
        assert_eq!(order, ["b", "c", "a", "d"]);
    }
}
