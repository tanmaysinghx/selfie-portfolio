//! One response shape for the whole API.
//!
//! Success: `{ "data": …, "meta": { "requestId": "…" } }`
//! Failure: `{ "error": { "code": "snake_case", "message": "Human readable", "requestId": "…", "details"?: … } }`
//!
//! `code` is stable and meant for programs; `message` is for people and may change.
//! The same request id is returned in the `x-request-id` header and written to the logs.

use axum::{
    Json,
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Serialize;
use serde_json::{Value, json};

tokio::task_local! {
    /// Set by the request-id middleware for the duration of each request.
    pub static REQUEST_ID: String;
}

pub fn request_id() -> String {
    REQUEST_ID.try_with(Clone::clone).unwrap_or_default()
}

pub struct ApiResponse<T> {
    status: StatusCode,
    data: T,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { status: StatusCode::OK, data }
    }
    pub fn created(data: T) -> Self {
        Self { status: StatusCode::CREATED, data }
    }
}

impl<T: Serialize> IntoResponse for ApiResponse<T> {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "data": self.data, "meta": { "requestId": request_id() } }))).into_response()
    }
}

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
    pub details: Option<Value>,
    pub retry_after_secs: Option<u64>,
}

impl ApiError {
    pub fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self { status, code, message: message.into(), details: None, retry_after_secs: None }
    }
    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }
    pub fn bad_request(code: &'static str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, code, message)
    }
    pub fn validation(field: &'static str, message: impl Into<String>) -> Self {
        let message = message.into();
        Self::new(StatusCode::UNPROCESSABLE_ENTITY, "validation_failed", "The request has invalid fields")
            .with_details(json!([{ "field": field, "message": message }]))
    }
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", message)
    }
    pub fn unauthorized() -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "unauthorized", "Valid credentials are required")
    }
    pub fn rate_limited(retry_after_secs: u64) -> Self {
        Self {
            retry_after_secs: Some(retry_after_secs),
            ..Self::new(StatusCode::TOO_MANY_REQUESTS, "rate_limited", "Too many requests. Please slow down.")
        }
    }
    pub fn storage_unavailable() -> Self {
        Self::new(StatusCode::SERVICE_UNAVAILABLE, "storage_unavailable", "Storage is temporarily unavailable")
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut error = json!({ "code": self.code, "message": self.message, "requestId": request_id() });
        if let Some(details) = self.details {
            error["details"] = details;
        }
        let mut response = (self.status, Json(json!({ "error": error }))).into_response();
        if let Some(secs) = self.retry_after_secs {
            response.headers_mut().insert(header::RETRY_AFTER, HeaderValue::from(secs));
        }
        if self.status == StatusCode::SERVICE_UNAVAILABLE {
            response.headers_mut().insert(header::RETRY_AFTER, HeaderValue::from_static("5"));
        }
        response
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        // Never leak driver messages (they can contain hostnames or SQL) to clients.
        tracing::error!(error = %error, "database operation failed");
        Self::storage_unavailable()
    }
}

pub type ApiResult<T> = Result<ApiResponse<T>, ApiError>;
