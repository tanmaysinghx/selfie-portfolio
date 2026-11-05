use crate::{AppState, response::ApiError};
use axum::{
    extract::{Request, State},
    http::{StatusCode, header},
    middleware::Next,
    response::Response,
};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

/// Compares secrets in constant time. Hashing first makes the comparison length-independent.
fn secret_matches(expected: &str, actual: &str) -> bool {
    let expected = Sha256::digest(expected.as_bytes());
    let actual = Sha256::digest(actual.as_bytes());
    expected.ct_eq(&actual).into()
}

/// Guards the blog routes: only the portfolio's server-side gateway knows this key.
pub async fn require_service_key(State(state): State<AppState>, request: Request, next: Next) -> Result<Response, ApiError> {
    let key = request.headers().get("x-api-key").and_then(|v| v.to_str().ok()).unwrap_or("");
    if !secret_matches(&state.config.service_api_key, key) {
        return Err(ApiError::unauthorized());
    }
    Ok(next.run(request).await)
}

/// Guards `/api/v1/admin/*` with `Authorization: Bearer <ADMIN_TOKEN>`.
pub async fn require_admin(State(state): State<AppState>, request: Request, next: Next) -> Result<Response, ApiError> {
    let Some(expected) = state.config.admin_token.as_deref() else {
        return Err(ApiError::new(StatusCode::NOT_FOUND, "not_found", "No route matches this path"));
    };
    let token = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("");
    if !secret_matches(expected, token) {
        return Err(ApiError::unauthorized());
    }
    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    #[test]
    fn secrets_compare_exactly() {
        assert!(super::secret_matches("abc", "abc"));
        assert!(!super::secret_matches("abc", "abcd"));
        assert!(!super::secret_matches("abc", ""));
    }
}
