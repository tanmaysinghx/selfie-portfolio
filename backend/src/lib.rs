pub mod admin;
pub mod auth;
pub mod blog;
pub mod config;
pub mod extract;
pub mod health;
pub mod response;
pub mod validate;

use axum::{
    Router,
    extract::{DefaultBodyLimit, Request},
    http::{HeaderName, HeaderValue, Method, header},
    middleware::{self, Next},
    response::Response,
    routing::{get, patch, post},
};
use config::Config;
use response::{ApiError, REQUEST_ID};
use sqlx::{
    MySqlPool,
    mysql::{MySqlConnectOptions, MySqlPoolOptions},
};
use std::{
    str::FromStr,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, RequestId, SetRequestIdLayer},
    set_header::SetResponseHeaderLayer,
    timeout::TimeoutLayer,
    trace::TraceLayer,
};

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

#[derive(Clone)]
pub struct AppState {
    pub db: MySqlPool,
    pub config: Arc<Config>,
    /// Flipped to true once migrations have run. Until then data routes answer 503.
    pub ready: Arc<AtomicBool>,
}

impl AppState {
    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::Acquire)
    }
}

/// Builds a pool that connects lazily, so the API starts (and reports itself unhealthy)
/// even when the database is unreachable, instead of crash-looping.
pub fn lazy_pool(config: &Config) -> anyhow::Result<MySqlPool> {
    let options = MySqlConnectOptions::from_str(&config.database_url)?;
    Ok(MySqlPoolOptions::new()
        .max_connections(config.db_max_connections)
        .min_connections(0)
        .acquire_timeout(config.db_acquire_timeout)
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(1800))
        .test_before_acquire(true)
        .connect_lazy_with(options))
}

/// Runs migrations in the background, retrying with backoff until the database answers.
pub fn spawn_migrations(state: AppState) {
    tokio::spawn(async move {
        let mut delay = Duration::from_secs(1);
        loop {
            match MIGRATOR.run(&state.db).await {
                Ok(()) => {
                    state.ready.store(true, Ordering::Release);
                    tracing::info!("database migrations applied; API is ready");
                    return;
                }
                Err(error) => {
                    tracing::warn!(error = %error, retry_in_secs = delay.as_secs(), "database not ready; retrying");
                    tokio::time::sleep(delay).await;
                    delay = (delay * 2).min(Duration::from_secs(30));
                }
            }
        }
    });
}

pub fn router(state: AppState) -> Router {
    let x_request_id = HeaderName::from_static("x-request-id");

    // Called only by the portfolio's server-side gateway (Vercel functions).
    let blog = Router::new()
        .route("/posts/{slug}/stats", get(blog::get_stats))
        .route("/posts/{slug}/views", post(blog::record_view))
        .route("/posts/{slug}/likes", post(blog::record_like))
        .route("/posts/{slug}/shares", post(blog::record_share))
        .route("/posts/{slug}/comments", get(blog::list_comments).post(blog::create_comment))
        .route_layer(middleware::from_fn_with_state(state.clone(), health::require_ready))
        .route_layer(middleware::from_fn_with_state(state.clone(), auth::require_service_key));

    // Called by the site owner (curl, scripts, a future dashboard).
    let admin = Router::new()
        .route("/overview", get(admin::overview))
        .route("/comments", get(admin::list_comments))
        .route("/comments/{id}", patch(admin::update_comment).delete(admin::delete_comment))
        .route_layer(middleware::from_fn_with_state(state.clone(), health::require_ready))
        .route_layer(middleware::from_fn_with_state(state.clone(), auth::require_admin));

    let mut app = Router::new()
        .route("/", get(health::index))
        .route("/health/live", get(health::live))
        .route("/health/ready", get(health::ready))
        .nest("/api/v1", blog.nest("/admin", admin))
        .fallback(fallback)
        .method_not_allowed_fallback(method_not_allowed)
        .with_state(state.clone())
        .layer(middleware::from_fn(request_id_scope))
        .layer(TimeoutLayer::with_status_code(axum::http::StatusCode::GATEWAY_TIMEOUT, state.config.request_timeout))
        .layer(DefaultBodyLimit::max(16 * 1024))
        .layer(SetResponseHeaderLayer::overriding(header::CACHE_CONTROL, HeaderValue::from_static("no-store")))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::REFERRER_POLICY,
            HeaderValue::from_static("no-referrer"),
        ))
        .layer(TraceLayer::new_for_http().make_span_with(|req: &Request| {
            let id = req.headers().get("x-request-id").and_then(|v| v.to_str().ok()).unwrap_or("");
            tracing::info_span!("http", method = %req.method(), path = %req.uri().path(), request_id = %id)
        }))
        .layer(PropagateRequestIdLayer::new(x_request_id.clone()))
        .layer(SetRequestIdLayer::new(x_request_id, MakeRequestUuid));

    if !state.config.cors_allowed_origins.is_empty() {
        let origins: Vec<HeaderValue> =
            state.config.cors_allowed_origins.iter().filter_map(|o| HeaderValue::from_str(o).ok()).collect();
        app = app.layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(origins))
                .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
                .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, HeaderName::from_static("x-api-key")])
                .max_age(Duration::from_secs(600)),
        );
    }
    app
}

/// Makes the request id available to response builders (see `response::request_id`).
async fn request_id_scope(request: Request, next: Next) -> Response {
    let id = request
        .extensions()
        .get::<RequestId>()
        .and_then(|id| id.header_value().to_str().ok())
        .unwrap_or_default()
        .to_string();
    REQUEST_ID.scope(id, next.run(request)).await
}

async fn fallback() -> ApiError {
    ApiError::not_found("No route matches this path")
}

async fn method_not_allowed() -> ApiError {
    ApiError::new(axum::http::StatusCode::METHOD_NOT_ALLOWED, "method_not_allowed", "Method not allowed on this path")
}

pub fn now_utc() -> chrono::DateTime<chrono::Utc> {
    chrono::Utc::now()
}
