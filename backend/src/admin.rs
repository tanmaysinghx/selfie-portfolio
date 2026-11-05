use crate::{
    AppState,
    blog::{CommentRow, Page, iso},
    extract::{ApiJson, ApiPath, ApiQuery},
    response::{ApiError, ApiResponse, ApiResult},
};
use axum::extract::State;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PostTotals {
    pub slug: String,
    pub views: i64,
    pub likes: i64,
    pub shares: i64,
}

/// `GET /api/v1/admin/overview` — totals per post and comments waiting for review.
pub async fn overview(State(state): State<AppState>) -> ApiResult<Value> {
    let posts: Vec<PostTotals> = sqlx::query_as(
        "SELECT slug,
                CAST(SUM(kind = 'view') AS SIGNED)  AS views,
                CAST(SUM(kind = 'like') AS SIGNED)  AS likes,
                CAST(SUM(kind = 'share') AS SIGNED) AS shares
         FROM blog_post_events GROUP BY slug ORDER BY views DESC LIMIT 500",
    )
    .fetch_all(&state.db)
    .await?;
    let comments: Vec<(String, i64)> =
        sqlx::query_as("SELECT CAST(status AS CHAR), COUNT(*) FROM blog_comments GROUP BY status")
            .fetch_all(&state.db)
            .await?;
    let comments: serde_json::Map<String, Value> = comments.into_iter().map(|(s, n)| (s, json!(n))).collect();
    Ok(ApiResponse::ok(json!({ "posts": posts, "comments": comments })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminCommentQuery {
    pub status: Option<String>,
    pub slug: Option<String>,
    pub limit: Option<u32>,
    pub after: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminComment {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub body: String,
    pub status: String,
    pub created_at: String,
}

fn status_param(s: &str) -> Result<&str, ApiError> {
    match s {
        "pending" | "published" | "rejected" => Ok(s),
        _ => Err(ApiError::validation("status", "must be pending, published or rejected")),
    }
}

/// `GET /api/v1/admin/comments?status=pending&slug=&limit=&after=`
pub async fn list_comments(State(state): State<AppState>, ApiQuery(q): ApiQuery<AdminCommentQuery>) -> ApiResult<Value> {
    let status = status_param(q.status.as_deref().unwrap_or("pending"))?;
    let page = Page { limit: q.limit, after: q.after };
    let limit = page.limit()?;
    let slug = match q.slug.as_deref() {
        Some(s) if !s.is_empty() => crate::validate::slug(s)?.to_string(),
        _ => String::new(),
    };
    let rows: Vec<CommentRow> = sqlx::query_as(
        "SELECT id, slug, author_name, body, CAST(status AS CHAR) AS status, created_at
         FROM blog_comments
         WHERE status = ? AND (? = '' OR slug = ?) AND id > ?
         ORDER BY id ASC LIMIT ?",
    )
    .bind(status)
    .bind(&slug)
    .bind(&slug)
    .bind(page.after()?)
    .bind(limit + 1)
    .fetch_all(&state.db)
    .await?;
    let has_more = rows.len() > limit as usize;
    let rows = &rows[..rows.len().min(limit as usize)];
    let items: Vec<AdminComment> = rows
        .iter()
        .map(|r| AdminComment {
            id: r.id.clone(),
            slug: r.slug.clone(),
            name: r.author_name.clone(),
            body: r.body.clone(),
            status: r.status.clone(),
            created_at: iso(r.created_at),
        })
        .collect();
    let next = if has_more { rows.last().map(|r| r.id.clone()) } else { None };
    Ok(ApiResponse::ok(json!({ "comments": items, "nextCursor": next })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StatusChange {
    pub status: String,
}

fn comment_id(id: &str) -> Result<String, ApiError> {
    uuid::Uuid::parse_str(id)
        .map(|u| u.hyphenated().to_string())
        .map_err(|_| ApiError::bad_request("invalid_path", "Invalid comment id"))
}

/// `PATCH /api/v1/admin/comments/{id}` with `{ "status": "published" | "rejected" | "pending" }`
pub async fn update_comment(
    State(state): State<AppState>,
    ApiPath(id): ApiPath<String>,
    ApiJson(change): ApiJson<StatusChange>,
) -> ApiResult<Value> {
    let id = comment_id(&id)?;
    let status = status_param(&change.status)?;
    let exists: Option<String> = sqlx::query_scalar("SELECT id FROM blog_comments WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_none() {
        return Err(ApiError::not_found("Comment not found"));
    }
    sqlx::query("UPDATE blog_comments SET status = ? WHERE id = ?").bind(status).bind(&id).execute(&state.db).await?;
    tracing::info!(comment_id = %id, status, "comment moderated");
    Ok(ApiResponse::ok(json!({ "id": id, "status": status })))
}

/// `DELETE /api/v1/admin/comments/{id}`
pub async fn delete_comment(State(state): State<AppState>, ApiPath(id): ApiPath<String>) -> ApiResult<Value> {
    let id = comment_id(&id)?;
    let result = sqlx::query("DELETE FROM blog_comments WHERE id = ?").bind(&id).execute(&state.db).await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Comment not found"));
    }
    tracing::info!(comment_id = %id, "comment deleted");
    Ok(ApiResponse::ok(json!({ "id": id, "deleted": true })))
}
