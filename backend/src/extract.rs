//! Drop-in replacements for axum's `Json`, `Query` and `Path` extractors whose rejections
//! use the API's error envelope instead of plain-text bodies.

use crate::response::ApiError;
use axum::{
    extract::{FromRequest, FromRequestParts, Request, rejection::JsonRejection},
    http::{StatusCode, request::Parts},
};
use serde::de::DeserializeOwned;

pub struct ApiJson<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequest<S> for ApiJson<T> {
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        match axum::Json::<T>::from_request(req, state).await {
            Ok(axum::Json(value)) => Ok(Self(value)),
            Err(JsonRejection::MissingJsonContentType(_)) => Err(ApiError::new(
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                "unsupported_media_type",
                "Expected Content-Type: application/json",
            )),
            Err(JsonRejection::BytesRejection(_)) => Err(ApiError::new(
                StatusCode::PAYLOAD_TOO_LARGE,
                "payload_too_large",
                "The request body is too large",
            )),
            Err(JsonRejection::JsonDataError(e)) => Err(ApiError::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "validation_failed",
                e.body_text(),
            )),
            Err(_) => Err(ApiError::bad_request("invalid_json", "The request body is not valid JSON")),
        }
    }
}

pub struct ApiQuery<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequestParts<S> for ApiQuery<T> {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        axum::extract::Query::<T>::from_request_parts(parts, state)
            .await
            .map(|q| Self(q.0))
            .map_err(|e| ApiError::bad_request("invalid_query", e.body_text()))
    }
}

pub struct ApiPath<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned + Send> FromRequestParts<S> for ApiPath<T> {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        axum::extract::Path::<T>::from_request_parts(parts, state)
            .await
            .map(|p| Self(p.0))
            .map_err(|e| ApiError::bad_request("invalid_path", e.body_text()))
    }
}
