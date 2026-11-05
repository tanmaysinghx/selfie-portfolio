use anyhow::{Context, bail};
use std::{net::SocketAddr, time::Duration};

/// When a new comment is held for review instead of being shown immediately.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Moderation {
    /// Publish everything immediately.
    Off,
    /// Hold comments that contain links (the most common spam signal).
    Links,
    /// Hold every comment until an admin approves it.
    All,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub bind: SocketAddr,
    pub database_url: String,
    pub db_max_connections: u32,
    pub db_acquire_timeout: Duration,
    /// Shared secret the portfolio's server-side gateway sends as `x-api-key`.
    pub service_api_key: String,
    /// Bearer token for `/api/v1/admin/*`. Admin routes are disabled when unset.
    pub admin_token: Option<String>,
    /// Pepper mixed into visitor ids before hashing, so stored hashes can't be reversed
    /// by anyone who only has the database.
    pub visitor_hash_salt: String,
    pub moderation: Moderation,
    pub cors_allowed_origins: Vec<String>,
    pub request_timeout: Duration,
    pub log_json: bool,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let port: u16 = env_or("PORT", "8080").parse().context("PORT must be a number")?;
        let host = env_or("HOST", "0.0.0.0");
        let bind = format!("{host}:{port}").parse().context("HOST/PORT do not form a valid address")?;

        let database_url = required("DATABASE_URL")?;
        let database_url = normalize_database_url(&database_url)?;

        let service_api_key = required("SERVICE_API_KEY")?;
        if service_api_key.len() < 32 {
            bail!("SERVICE_API_KEY must be at least 32 characters");
        }
        let visitor_hash_salt = required("VISITOR_HASH_SALT")?;
        if visitor_hash_salt.len() < 16 {
            bail!("VISITOR_HASH_SALT must be at least 16 characters");
        }
        let admin_token = std::env::var("ADMIN_TOKEN").ok().filter(|t| !t.is_empty());
        if admin_token.as_ref().is_some_and(|t| t.len() < 32) {
            bail!("ADMIN_TOKEN must be at least 32 characters when set");
        }

        let moderation = match env_or("COMMENT_MODERATION", "links").to_ascii_lowercase().as_str() {
            "off" => Moderation::Off,
            "links" => Moderation::Links,
            "all" => Moderation::All,
            other => bail!("COMMENT_MODERATION must be off, links or all (got {other:?})"),
        };

        Ok(Self {
            bind,
            database_url,
            db_max_connections: env_or("DB_MAX_CONNECTIONS", "5").parse().context("DB_MAX_CONNECTIONS")?,
            db_acquire_timeout: Duration::from_secs(5),
            service_api_key,
            admin_token,
            visitor_hash_salt,
            moderation,
            cors_allowed_origins: env_or("CORS_ALLOWED_ORIGINS", "")
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect(),
            request_timeout: Duration::from_secs(10),
            log_json: env_or("LOG_FORMAT", "pretty").eq_ignore_ascii_case("json"),
        })
    }
}

fn env_or(name: &str, default: &str) -> String {
    std::env::var(name).ok().filter(|v| !v.is_empty()).unwrap_or_else(|| default.to_string())
}

fn required(name: &str) -> anyhow::Result<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty()).with_context(|| format!("{name} is required"))
}

/// Accepts `mysql://…` or a JDBC-style `jdbc:mysql://…` URL, and maps the JDBC/Aiven
/// spelling `ssl-mode=REQUIRED` to what sqlx expects.
pub fn normalize_database_url(raw: &str) -> anyhow::Result<String> {
    let url = raw.trim().strip_prefix("jdbc:").unwrap_or(raw.trim());
    if !url.starts_with("mysql://") {
        bail!("DATABASE_URL must start with mysql:// (or jdbc:mysql://)");
    }
    Ok(url
        .replace("ssl-mode=REQUIRED", "ssl-mode=required")
        .replace("sslMode=REQUIRED", "ssl-mode=required")
        .replace("ssl-mode=VERIFY_CA", "ssl-mode=verify_ca")
        .replace("ssl-mode=VERIFY_IDENTITY", "ssl-mode=verify_identity"))
}

#[cfg(test)]
mod tests {
    use super::normalize_database_url;

    #[test]
    fn jdbc_urls_are_accepted() {
        assert_eq!(
            normalize_database_url("jdbc:mysql://u:p@h:1/db?ssl-mode=REQUIRED").unwrap(),
            "mysql://u:p@h:1/db?ssl-mode=required"
        );
        assert!(normalize_database_url("postgres://x").is_err());
    }
}
