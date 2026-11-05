use crate::{
    AppState,
    response::{ApiError, ApiResponse, ApiResult},
};
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use serde_json::{Value, json};
use std::time::Duration;

/// `GET /` — tiny service descriptor.
pub async fn index() -> ApiResult<Value> {
    Ok(ApiResponse::ok(json!({
        "service": env!("CARGO_PKG_NAME"),
        "version": env!("CARGO_PKG_VERSION"),
        "docs": "https://github.com/tanmaysinghx/selfie-portfolio/tree/main/backend#api",
    })))
}

/// `GET /health/live` — the process is up. Never touches the database.
pub async fn live() -> ApiResult<Value> {
    Ok(ApiResponse::ok(json!({ "status": "ok" })))
}

/// `GET /health/ready` — the database answers and migrations have run.
pub async fn ready(State(state): State<AppState>) -> ApiResult<Value> {
    if !state.is_ready() {
        return Err(ApiError::new(
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            "not_ready",
            "Waiting for the database",
        ));
    }
    let ping = tokio::time::timeout(Duration::from_secs(2), sqlx::query("SELECT 1").execute(&state.db)).await;
    match ping {
        Ok(Ok(_)) => Ok(ApiResponse::ok(json!({ "status": "ok", "database": "ok" }))),
        Ok(Err(e)) => Err(e.into()),
        Err(_) => Err(ApiError::storage_unavailable()),
    }
}

/// Data routes answer 503 (with Retry-After) until migrations have run.
pub async fn require_ready(State(state): State<AppState>, request: Request, next: Next) -> Result<Response, ApiError> {
    if !state.is_ready() {
        return Err(ApiError::storage_unavailable());
    }
    Ok(next.run(request).await)
}
