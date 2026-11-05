use selfie_backend::{AppState, config::Config, lazy_pool, router, spawn_migrations};
use std::sync::{Arc, atomic::AtomicBool};
use tracing_subscriber::{EnvFilter, fmt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
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
