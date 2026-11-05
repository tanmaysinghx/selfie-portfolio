//! HTTP-level tests. The first group needs no database. The second group runs only when
//! `TEST_DATABASE_URL` points at a disposable MySQL database (it creates and deletes rows).

use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt;
use selfie_backend::{
    AppState, MIGRATOR,
    config::{Config, Moderation},
    lazy_pool, router,
};
use serde_json::{Value, json};
use std::{

    time::Duration,
};
use tower::ServiceExt;

const KEY: &str = "test-service-key-0123456789abcdef0123";
const ADMIN: &str = "test-admin-token-0123456789abcdef0123";

fn config(database_url: &str, moderation: Moderation) -> Config {
    Config {
        bind: "127.0.0.1:0".parse().unwrap(),
        database_url: database_url.into(),
        db_max_connections: 2,
        db_acquire_timeout: Duration::from_secs(10),
        service_api_key: KEY.into(),
        admin_token: Some(ADMIN.into()),
        visitor_hash_salt: "test-salt-0123456789".into(),
        moderation,
        cors_allowed_origins: vec![],
        request_timeout: Duration::from_secs(10),
        log_json: false,
    }
}

fn offline_app() -> Router {
    // Port 1 on localhost refuses connections immediately: the API must still answer.
    let config = config("mysql://u:p@127.0.0.1:1/none", Moderation::Links);
    let state = AppState::new(lazy_pool(&config).unwrap(), config, false);
    router(state)
}

async fn call(app: &Router, req: Request<Body>) -> (StatusCode, axum::http::HeaderMap, Value) {
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let headers = res.headers().clone();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body = if bytes.is_empty() { Value::Null } else { serde_json::from_slice(&bytes).unwrap() };
    (status, headers, body)
}

fn get(path: &str) -> Request<Body> {
    Request::get(path).header("x-api-key", KEY).body(Body::empty()).unwrap()
}

fn post(path: &str, body: Value) -> Request<Body> {
    Request::post(path)
        .header("x-api-key", KEY)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

#[tokio::test]
async fn liveness_never_needs_the_database() {
    let (status, headers, body) = call(&offline_app(), Request::get("/health/live").body(Body::empty()).unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["status"], "ok");
    assert!(headers.get("x-request-id").is_some());
    assert_eq!(body["meta"]["requestId"], headers["x-request-id"].to_str().unwrap());
}

#[tokio::test]
async fn readiness_and_data_routes_report_503_while_database_is_down() {
    let app = offline_app();
    let (status, headers, body) = call(&app, Request::get("/health/ready").body(Body::empty()).unwrap()).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["error"]["code"], "not_ready");
    assert!(headers.get(header::RETRY_AFTER).is_some());

    let (status, _, body) = call(&app, get("/api/v1/posts/hello/stats")).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["error"]["code"], "storage_unavailable");
}

#[tokio::test]
async fn blog_routes_require_the_service_key() {
    let app = offline_app();
    let req = Request::get("/api/v1/posts/hello/stats").body(Body::empty()).unwrap();
    let (status, _, body) = call(&app, req).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["code"], "unauthorized");
    assert!(body["error"]["requestId"].as_str().is_some_and(|s| !s.is_empty()));

    let req = Request::get("/api/v1/posts/hello/stats").header("x-api-key", "wrong").body(Body::empty()).unwrap();
    assert_eq!(call(&app, req).await.0, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn admin_routes_require_a_bearer_token() {
    let app = offline_app();
    let req = Request::get("/api/v1/admin/overview").body(Body::empty()).unwrap();
    assert_eq!(call(&app, req).await.0, StatusCode::UNAUTHORIZED);
    // The service key is not an admin credential.
    let (status, _, _) = call(&app, get("/api/v1/admin/overview")).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn unknown_routes_and_methods_use_the_error_envelope() {
    let app = offline_app();
    let (status, _, body) = call(&app, Request::get("/nope").body(Body::empty()).unwrap()).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_found");

    let req = Request::delete("/health/live").body(Body::empty()).unwrap();
    let (status, _, body) = call(&app, req).await;
    assert_eq!(status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(body["error"]["code"], "method_not_allowed");
}

#[tokio::test]
async fn oversized_bodies_are_rejected() {
    // Marked ready so the request reaches the JSON extractor (which never touches the DB).
    let config = config("mysql://u:p@127.0.0.1:1/none", Moderation::Links);
    let state = AppState::new(lazy_pool(&config).unwrap(), config, true);
    let app = router(state);
    let big = "x".repeat(20 * 1024);
    let req = Request::post("/api/v1/posts/hello/comments")
        .header("x-api-key", KEY)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CONTENT_LENGTH, big.len())
        .body(Body::from(big))
        .unwrap();
    let (status, _, body) = call(&app, req).await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body["error"]["code"], "payload_too_large");
}

// ---------- Against a real database ----------

async fn live_app(moderation: Moderation) -> Option<(Router, sqlx::MySqlPool)> {
    let url = std::env::var("TEST_DATABASE_URL").ok()?;
    let config = config(&selfie_backend::config::normalize_database_url(&url).unwrap(), moderation);
    let pool = lazy_pool(&config).unwrap();
    MIGRATOR.run(&pool).await.expect("migrations");
    let state = AppState::new(pool.clone(), config, true);
    Some((router(state), pool))
}

fn test_slug(name: &str) -> String {
    format!("zz-test-{name}-{}", &uuid::Uuid::new_v4().simple().to_string()[..8])
}

async fn cleanup(pool: &sqlx::MySqlPool, slug: &str) {
    sqlx::query("DELETE FROM blog_post_events WHERE slug = ?").bind(slug).execute(pool).await.unwrap();
    sqlx::query("DELETE FROM blog_comments WHERE slug = ?").bind(slug).execute(pool).await.unwrap();
}

#[tokio::test]
async fn reactions_are_idempotent_per_visitor() {
    let Some((app, pool)) = live_app(Moderation::Links).await else { return };
    let slug = test_slug("reactions");
    let (a, b) = (uuid::Uuid::new_v4().to_string(), uuid::Uuid::new_v4().to_string());

    for _ in 0..3 {
        let (status, _, body) = call(&app, post(&format!("/api/v1/posts/{slug}/views"), json!({ "visitorId": a }))).await;
        assert_eq!(status, StatusCode::OK, "{body}");
    }
    call(&app, post(&format!("/api/v1/posts/{slug}/views"), json!({ "visitorId": b }))).await;
    call(&app, post(&format!("/api/v1/posts/{slug}/likes"), json!({ "visitorId": a }))).await;
    call(&app, post(&format!("/api/v1/posts/{slug}/likes"), json!({ "visitorId": a }))).await;
    call(&app, post(&format!("/api/v1/posts/{slug}/shares"), json!({ "visitorId": a, "channel": "x" }))).await;
    let (_, _, body) =
        call(&app, post(&format!("/api/v1/posts/{slug}/shares"), json!({ "visitorId": a, "channel": "copy" }))).await;
    assert_eq!(body["data"], json!({ "views": 2, "likes": 1, "shares": 2, "comments": 0 }));

    let (status, _, body) =
        call(&app, post(&format!("/api/v1/posts/{slug}/shares"), json!({ "visitorId": a, "channel": "fax" }))).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["error"]["details"][0]["field"], "channel");
    cleanup(&pool, &slug).await;
}

#[tokio::test]
async fn comments_publish_moderate_paginate_and_rate_limit() {
    let Some((app, pool)) = live_app(Moderation::Links).await else { return };
    let slug = test_slug("comments");
    let visitor = uuid::Uuid::new_v4().to_string();
    let path = format!("/api/v1/posts/{slug}/comments");

    let (status, _, body) =
        call(&app, post(&path, json!({ "name": " Asha ", "body": "Great post!", "visitorId": visitor }))).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["data"]["status"], "published");
    assert_eq!(body["data"]["comment"]["name"], "Asha");
    let first_id = body["data"]["comment"]["id"].as_str().unwrap().to_string();

    // Retrying the same submit returns the same comment.
    let (status, _, body) =
        call(&app, post(&path, json!({ "name": "Asha", "body": "Great post!", "visitorId": visitor }))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["comment"]["id"], first_id);

    // Links are held for review.
    let (_, _, body) =
        call(&app, post(&path, json!({ "name": "Bot", "body": "cheap https://spam.example", "visitorId": visitor }))).await;
    assert_eq!(body["data"]["status"], "pending");
    let pending_id = body["data"]["comment"]["id"].as_str().unwrap().to_string();

    call(&app, post(&path, json!({ "name": "Asha", "body": "One more thought", "visitorId": visitor }))).await;
    let (status, headers, body) =
        call(&app, post(&path, json!({ "name": "Asha", "body": "And another", "visitorId": visitor }))).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS, "{body}");
    assert_eq!(headers[header::RETRY_AFTER], "600");

    let (_, _, body) = call(&app, get(&format!("{path}?limit=1"))).await;
    assert_eq!(body["data"]["comments"].as_array().unwrap().len(), 1);
    let cursor = body["data"]["nextCursor"].as_str().unwrap().to_string();
    let (_, _, body) = call(&app, get(&format!("{path}?limit=10&after={cursor}"))).await;
    assert_eq!(body["data"]["comments"].as_array().unwrap().len(), 1);
    assert!(body["data"]["nextCursor"].is_null());

    // Admin approves the held comment, and it becomes visible and counted.
    let req = Request::patch(format!("/api/v1/admin/comments/{pending_id}"))
        .header(header::AUTHORIZATION, format!("Bearer {ADMIN}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "status": "published" }).to_string()))
        .unwrap();
    assert_eq!(call(&app, req).await.0, StatusCode::OK);
    let (_, _, body) = call(&app, get(&format!("/api/v1/posts/{slug}/stats"))).await;
    assert_eq!(body["data"]["comments"], 3);

    let (status, _, body) = call(&app, post(&path, json!({ "name": "", "body": "x", "visitorId": visitor }))).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["error"]["code"], "validation_failed");
    cleanup(&pool, &slug).await;
}

#[tokio::test]
async fn page_views_engagement_and_insights() {
    let Some((app, pool)) = live_app(Moderation::Links).await else { return };
    let slug = test_slug("insights");
    let path = format!("/blog/{slug}");
    let (a, b) = (uuid::Uuid::new_v4().to_string(), uuid::Uuid::new_v4().to_string());

    // Page views dedupe per visitor/path/day; query strings are ignored.
    for p in [path.clone(), format!("{path}?utm=x"), path.to_uppercase()] {
        let (status, _, body) = call(&app, post("/api/v1/site/pageviews", json!({ "visitorId": a, "path": p }))).await;
        assert_eq!(status, StatusCode::OK, "{body}");
    }
    // a reads 40 s (a reader), b reads 10 s (not yet a reader).
    for s in [25, 15] {
        call(&app, post("/api/v1/site/engagement", json!({ "visitorId": a, "path": path, "seconds": s }))).await;
    }
    call(&app, post("/api/v1/site/engagement", json!({ "visitorId": b, "path": path, "seconds": 10 }))).await;
    call(&app, post(&format!("/api/v1/posts/{slug}/likes"), json!({ "visitorId": a }))).await;

    let (status, _, body) =
        call(&app, post("/api/v1/site/engagement", json!({ "visitorId": a, "path": path, "seconds": 500 }))).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["error"]["details"][0]["field"], "seconds");
    let (status, _, _) = call(&app, post("/api/v1/site/pageviews", json!({ "visitorId": a, "path": "/../etc" }))).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);

    let (status, _, body) = call(&app, get("/api/v1/insights")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let site = &body["data"]["site"];
    assert!(site["pageViews"].as_i64().unwrap() >= 1);
    assert!(site["readingSeconds"].as_i64().unwrap() >= 50);
    let post = body["data"]["posts"].as_array().unwrap().iter().find(|p| p["slug"] == slug.as_str()).unwrap().clone();
    assert_eq!(post["readers"], 1);
    assert_eq!(post["readingSeconds"], 50);
    assert_eq!(post["avgReadSeconds"], 50);
    assert_eq!(post["likes"], 1);

    let views: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM site_page_views WHERE path = ?")
        .bind(&path).fetch_one(&pool).await.unwrap();
    assert_eq!(views, 1);
    sqlx::query("DELETE FROM site_page_views WHERE path = ?").bind(&path).execute(&pool).await.unwrap();
    sqlx::query("DELETE FROM site_engagement WHERE path = ?").bind(&path).execute(&pool).await.unwrap();
    cleanup(&pool, &slug).await;
}
