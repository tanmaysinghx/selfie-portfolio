use crate::{
    AppState,
    config::Moderation,
    extract::{ApiJson, ApiPath, ApiQuery},
    now_utc,
    response::{ApiError, ApiResponse, ApiResult},
    validate,
};
use chrono::{DateTime, NaiveDateTime, SecondsFormat, TimeDelta, Utc};
use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;

// ---------- Stats ----------

#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct PostStats {
    pub views: i64,
    pub likes: i64,
    pub shares: i64,
    pub comments: i64,
}

pub async fn stats_for(db: &MySqlPool, slug: &str) -> Result<PostStats, ApiError> {
    let (views, likes, shares): (i64, i64, i64) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(kind = 'view'), 0) AS SIGNED),
                CAST(COALESCE(SUM(kind = 'like'), 0) AS SIGNED),
                CAST(COALESCE(SUM(kind = 'share'), 0) AS SIGNED)
         FROM blog_post_events WHERE slug = ?",
    )
    .bind(slug)
    .fetch_one(db)
    .await?;
    let comments: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM blog_comments WHERE slug = ? AND status = 'published'")
            .bind(slug)
            .fetch_one(db)
            .await?;
    Ok(PostStats { views, likes, shares, comments })
}

/// `GET /api/v1/posts/{slug}/stats`
pub async fn get_stats(state: axum::extract::State<AppState>, ApiPath(slug): ApiPath<String>) -> ApiResult<PostStats> {
    let slug = validate::slug(&slug)?;
    Ok(ApiResponse::ok(stats_for(&state.db, slug).await?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VisitorBody {
    pub visitor_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShareBody {
    pub visitor_id: String,
    pub channel: String,
}

/// Records an event once per (post, visitor, kind, channel, bucket). Retries are harmless.
async fn record_event(
    state: &AppState,
    slug: &str,
    kind: &str,
    channel: &str,
    visitor_id: &str,
    bucket: &str,
) -> Result<PostStats, ApiError> {
    validate::visitor(visitor_id)?;
    let visitor = validate::visitor_hash(&state.config.visitor_hash_salt, visitor_id);
    sqlx::query(
        "INSERT INTO blog_post_events (slug, kind, channel, visitor_hash, bucket, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = id",
    )
    .bind(slug)
    .bind(kind)
    .bind(channel)
    .bind(visitor)
    .bind(bucket)
    .bind(now_utc().naive_utc())
    .execute(&state.db)
    .await?;
    stats_for(&state.db, slug).await
}

fn today() -> String {
    now_utc().format("%Y-%m-%d").to_string()
}

/// `POST /api/v1/posts/{slug}/views` — counted once per visitor per UTC day.
pub async fn record_view(
    state: axum::extract::State<AppState>,
    ApiPath(slug): ApiPath<String>,
    ApiJson(body): ApiJson<VisitorBody>,
) -> ApiResult<PostStats> {
    let slug = validate::slug(&slug)?;
    Ok(ApiResponse::ok(record_event(&state, slug, "view", "", &body.visitor_id, &today()).await?))
}

/// `POST /api/v1/posts/{slug}/likes` — one like per visitor, ever.
pub async fn record_like(
    state: axum::extract::State<AppState>,
    ApiPath(slug): ApiPath<String>,
    ApiJson(body): ApiJson<VisitorBody>,
) -> ApiResult<PostStats> {
    let slug = validate::slug(&slug)?;
    Ok(ApiResponse::ok(record_event(&state, slug, "like", "", &body.visitor_id, "forever").await?))
}

/// `POST /api/v1/posts/{slug}/shares` — once per visitor per channel per UTC day.
pub async fn record_share(
    state: axum::extract::State<AppState>,
    ApiPath(slug): ApiPath<String>,
    ApiJson(body): ApiJson<ShareBody>,
) -> ApiResult<PostStats> {
    let slug = validate::slug(&slug)?;
    let channel = validate::share_channel(&body.channel)?;
    Ok(ApiResponse::ok(record_event(&state, slug, "share", channel, &body.visitor_id, &today()).await?))
}

// ---------- Comments ----------

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: String,
    pub name: String,
    pub body: String,
    pub created_at: String,
}

#[derive(sqlx::FromRow)]
pub struct CommentRow {
    pub id: String,
    pub slug: String,
    pub author_name: String,
    pub body: String,
    pub status: String,
    pub created_at: NaiveDateTime,
}

pub fn iso(ts: NaiveDateTime) -> String {
    DateTime::<Utc>::from_naive_utc_and_offset(ts, Utc).to_rfc3339_opts(SecondsFormat::Millis, true)
}

impl From<&CommentRow> for Comment {
    fn from(row: &CommentRow) -> Self {
        Self { id: row.id.clone(), name: row.author_name.clone(), body: row.body.clone(), created_at: iso(row.created_at) }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub limit: Option<u32>,
    /// Cursor: the `id` of the last comment on the previous page.
    pub after: Option<String>,
}

impl Page {
    pub fn limit(&self) -> Result<u32, ApiError> {
        match self.limit.unwrap_or(50) {
            n @ 1..=100 => Ok(n),
            _ => Err(ApiError::bad_request("invalid_query", "limit must be between 1 and 100")),
        }
    }
    pub fn after(&self) -> Result<String, ApiError> {
        match self.after.as_deref() {
            None | Some("") => Ok(String::new()),
            Some(id) if uuid::Uuid::parse_str(id).is_ok() => Ok(id.to_ascii_lowercase()),
            Some(_) => Err(ApiError::bad_request("invalid_query", "after must be a comment id")),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentPage {
    pub comments: Vec<Comment>,
    pub next_cursor: Option<String>,
}

/// `GET /api/v1/posts/{slug}/comments?limit=50&after=<id>` — published comments, oldest first.
pub async fn list_comments(
    state: axum::extract::State<AppState>,
    ApiPath(slug): ApiPath<String>,
    ApiQuery(page): ApiQuery<Page>,
) -> ApiResult<CommentPage> {
    let slug = validate::slug(&slug)?;
    let limit = page.limit()?;
    let rows: Vec<CommentRow> = sqlx::query_as(
        "SELECT id, slug, author_name, body, CAST(status AS CHAR) AS status, created_at
         FROM blog_comments
         WHERE slug = ? AND status = 'published' AND id > ?
         ORDER BY id ASC
         LIMIT ?",
    )
    .bind(slug)
    .bind(page.after()?)
    .bind(limit + 1)
    .fetch_all(&state.db)
    .await?;
    Ok(ApiResponse::ok(paginate(rows, limit)))
}

pub fn paginate(mut rows: Vec<CommentRow>, limit: u32) -> CommentPage {
    let has_more = rows.len() > limit as usize;
    rows.truncate(limit as usize);
    CommentPage {
        next_cursor: if has_more { rows.last().map(|r| r.id.clone()) } else { None },
        comments: rows.iter().map(Comment::from).collect(),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NewComment {
    pub name: String,
    pub body: String,
    pub visitor_id: String,
}

#[derive(Serialize)]
pub struct PostedComment {
    pub comment: Comment,
    /// `published` (visible to everyone) or `pending` (held for moderation).
    pub status: String,
}

const BURST_WINDOW_MINUTES: i64 = 10;
const BURST_LIMIT: i64 = 3;
const DAILY_LIMIT: i64 = 20;

/// `POST /api/v1/posts/{slug}/comments`
pub async fn create_comment(
    state: axum::extract::State<AppState>,
    ApiPath(slug): ApiPath<String>,
    ApiJson(input): ApiJson<NewComment>,
) -> Result<ApiResponse<PostedComment>, ApiError> {
    let slug = validate::slug(&slug)?;
    validate::visitor(&input.visitor_id)?;
    let name = validate::comment_name(&input.name)?;
    let body = validate::comment_body(&input.body)?;
    let visitor = validate::visitor_hash(&state.config.visitor_hash_salt, &input.visitor_id);
    let now = now_utc().naive_utc();

    // A retried submit (double click, flaky network) returns the original comment.
    let duplicate: Option<CommentRow> = sqlx::query_as(
        "SELECT id, slug, author_name, body, CAST(status AS CHAR) AS status, created_at
         FROM blog_comments
         WHERE visitor_hash = ? AND slug = ? AND body = ? AND created_at > ?
         LIMIT 1",
    )
    .bind(&visitor)
    .bind(slug)
    .bind(&body)
    .bind(now - TimeDelta::minutes(BURST_WINDOW_MINUTES))
    .fetch_optional(&state.db)
    .await?;
    if let Some(row) = duplicate {
        return Ok(ApiResponse::ok(PostedComment { comment: Comment::from(&row), status: public_status(&row.status) }));
    }

    let (burst, daily): (i64, i64) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(created_at > ?), 0) AS SIGNED), COUNT(*)
         FROM blog_comments WHERE visitor_hash = ? AND created_at > ?",
    )
    .bind(now - TimeDelta::minutes(BURST_WINDOW_MINUTES))
    .bind(&visitor)
    .bind(now - TimeDelta::days(1))
    .fetch_one(&state.db)
    .await?;
    if burst >= BURST_LIMIT {
        return Err(ApiError::rate_limited((BURST_WINDOW_MINUTES * 60) as u64));
    }
    if daily >= DAILY_LIMIT {
        return Err(ApiError::rate_limited(3600));
    }

    let held = match state.config.moderation {
        Moderation::Off => false,
        Moderation::Links => validate::contains_link(&body) || validate::contains_link(&name),
        Moderation::All => true,
    };
    let status = if held { "pending" } else { "published" };
    let id = uuid::Uuid::now_v7().to_string();
    sqlx::query(
        "INSERT INTO blog_comments (id, slug, author_name, body, status, visitor_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(slug)
    .bind(&name)
    .bind(&body)
    .bind(status)
    .bind(&visitor)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await?;
    tracing::info!(slug, comment_id = %id, status, "comment created");

    Ok(ApiResponse::created(PostedComment {
        comment: Comment { id, name, body, created_at: iso(now) },
        status: status.to_string(),
    }))
}

/// Rejected comments look "pending" to their author, so spammers learn nothing.
fn public_status(status: &str) -> String {
    if status == "published" { "published".into() } else { "pending".into() }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(id: &str) -> CommentRow {
        CommentRow {
            id: id.into(),
            slug: "s".into(),
            author_name: "A".into(),
            body: "hello".into(),
            status: "published".into(),
            created_at: chrono::DateTime::from_timestamp(1_700_000_000, 0).unwrap().naive_utc(),
        }
    }

    #[test]
    fn pagination_sets_cursor_only_when_more_exist() {
        let page = paginate(vec![row("a"), row("b"), row("c")], 2);
        assert_eq!(page.comments.len(), 2);
        assert_eq!(page.next_cursor.as_deref(), Some("b"));
        let page = paginate(vec![row("a")], 2);
        assert_eq!(page.next_cursor, None);
    }

    #[test]
    fn timestamps_are_utc_iso() {
        assert_eq!(iso(row("a").created_at), "2023-11-14T22:13:20.000Z");
    }

    #[test]
    fn rejected_looks_pending() {
        assert_eq!(public_status("rejected"), "pending");
        assert_eq!(public_status("published"), "published");
    }
}
