use selfie_backend::{AppState, config::Config, lazy_pool, router, spawn_migrations};
use std::sync::{Arc, atomic::AtomicBool};
use tracing_subscriber::{EnvFilter, fmt};

fn main() -> anyhow::Result<()> {
    // `selfie-backend healthcheck` is the container HEALTHCHECK: the distroless image has no curl.
    if std::env::args().nth(1).as_deref() == Some("healthcheck") {
        std::process::exit(if healthcheck() { 0 } else { 1 });
    }
    tokio::runtime::Builder::new_multi_thread().enable_all().build()?.block_on(serve())
}

/// Exits 0 when `GET /health/live` on the local port answers 200 within 2 seconds.
fn healthcheck() -> bool {
    use std::{io::{Read, Write}, net::TcpStream, time::Duration};
    let port = std::env::var("PORT").ok().filter(|p| !p.is_empty()).unwrap_or_else(|| "8080".into());
    let Ok(addr) = format!("127.0.0.1:{port}").parse() else { return false };
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_secs(2)) else { return false };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    if stream.write_all(b"GET /health/live HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n").is_err() {
        return false;
    }
    let mut head = [0u8; 12];
    stream.read_exact(&mut head).is_ok() && head.starts_with(b"HTTP/1.1 200")
}

async fn serve() -> anyhow::Result<()> {
    // Local development reads backend/.env; in production the platform injects variables.
    let _ = dotenvy::dotenv();
    let config = Config::from_env()?;

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("selfie_backend=info,tower_http=info,sqlx=warn"));
    if config.log_json {
        fmt().json().with_env_filter(filter).with_current_span(true).init();
    } else {
        fmt().with_env_filter(filter).init();
    }

    let state = AppState { db: lazy_pool(&config)?, config: Arc::new(config), ready: Arc::new(AtomicBool::new(false)) };
    spawn_migrations(state.clone());

    let listener = tokio::net::TcpListener::bind(state.config.bind).await?;
    tracing::info!(addr = %state.config.bind, moderation = ?state.config.moderation, admin = state.config.admin_token.is_some(), "listening");

    let db = state.db.clone();
    axum::serve(listener, router(state)).with_graceful_shutdown(shutdown_signal()).await?;
    db.close().await;
    tracing::info!("shut down cleanly");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut s) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            s.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
    tracing::info!("shutdown signal received; draining connections");
}
