use crate::response::ApiError;
use sha2::{Digest, Sha256};

pub const NAME_MAX: usize = 60;
pub const BODY_MIN: usize = 2;
pub const BODY_MAX: usize = 1000;

/// Post slugs are folder names under `public/posts`: lowercase letters, digits and dashes.
pub fn slug(slug: &str) -> Result<&str, ApiError> {
    let ok = !slug.is_empty()
        && slug.len() <= 100
        && slug.as_bytes()[0].is_ascii_alphanumeric()
        && slug.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    if ok { Ok(slug) } else { Err(ApiError::bad_request("invalid_slug", "Invalid post slug")) }
}

/// The gateway's opaque visitor cookie: a v4 UUID.
pub fn visitor(id: &str) -> Result<(), ApiError> {
    match uuid::Uuid::parse_str(id) {
        Ok(u) if u.get_version_num() == 4 => Ok(()),
        _ => Err(ApiError::validation("visitorId", "must be a v4 UUID")),
    }
}

/// Stored instead of the raw visitor id. The salt is server-only, so the database alone
/// can't be used to link hashes back to cookies.
pub fn visitor_hash(salt: &str, visitor: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(b":");
    hasher.update(visitor.to_ascii_lowercase().as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn share_channel(channel: &str) -> Result<&str, ApiError> {
    match channel {
        "copy" | "linkedin" | "x" | "native" => Ok(channel),
        _ => Err(ApiError::validation("channel", "must be one of copy, linkedin, x, native")),
    }
}

/// Trims, normalizes line endings and removes control characters (keeping newlines in bodies).
pub fn clean_text(input: &str, keep_newlines: bool) -> String {
    let normalized = input.replace("\r\n", "\n").replace('\r', "\n");
    let cleaned: String = normalized
        .chars()
        .filter(|c| !c.is_control() || (keep_newlines && *c == '\n'))
        .collect();
    // Collapse runs of 3+ blank lines so a comment can't be a wall of whitespace.
    let mut out = String::with_capacity(cleaned.len());
    let mut newlines = 0;
    for c in cleaned.trim().chars() {
        if c == '\n' {
            newlines += 1;
            if newlines > 2 {
                continue;
            }
        } else {
            newlines = 0;
        }
        out.push(c);
    }
    out
}

pub fn comment_name(raw: &str) -> Result<String, ApiError> {
    let name = clean_text(raw, false);
    let len = name.chars().count();
    if len == 0 {
        return Err(ApiError::validation("name", "is required"));
    }
    if len > NAME_MAX {
        return Err(ApiError::validation("name", format!("must be at most {NAME_MAX} characters")));
    }
    Ok(name)
}

pub fn comment_body(raw: &str) -> Result<String, ApiError> {
    let body = clean_text(raw, true);
    let len = body.chars().count();
    if !(BODY_MIN..=BODY_MAX).contains(&len) {
        return Err(ApiError::validation("body", format!("must be {BODY_MIN} to {BODY_MAX} characters")));
    }
    Ok(body)
}

pub fn contains_link(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    ["http://", "https://", "www.", "href=", "[url"].iter().any(|p| lower.contains(p))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs() {
        assert!(slug("one-line-broke-the-internet").is_ok());
        for bad in ["", "-x", "Upper", "a/b", "a b", &"a".repeat(101)] {
            assert!(slug(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn visitors_must_be_v4() {
        assert!(visitor("3f1c8a3e-7b2d-4c1e-9a5f-1d2e3f4a5b6c").is_ok());
        assert!(visitor("not-a-uuid").is_err());
        assert!(visitor("0192f3a0-7b2d-7c1e-9a5f-1d2e3f4a5b6c").is_err()); // v7
    }

    #[test]
    fn visitor_hash_is_salted_and_case_insensitive() {
        let a = visitor_hash("salt-one", "3F1C8A3E-7B2D-4C1E-9A5F-1D2E3F4A5B6C");
        assert_eq!(a, visitor_hash("salt-one", "3f1c8a3e-7b2d-4c1e-9a5f-1d2e3f4a5b6c"));
        assert_ne!(a, visitor_hash("salt-two", "3f1c8a3e-7b2d-4c1e-9a5f-1d2e3f4a5b6c"));
        assert_eq!(a.len(), 64);
    }

    #[test]
    fn comment_text_is_cleaned() {
        assert_eq!(comment_name("  Asha\u{0007} ").unwrap(), "Asha");
        assert_eq!(comment_body("hi\r\n\r\n\r\n\r\nthere").unwrap(), "hi\n\nthere");
        assert!(comment_body(" a ").is_err());
        assert!(comment_body(&"x".repeat(1001)).is_err());
        assert!(comment_name(&"n".repeat(61)).is_err());
        assert!(comment_name("   ").is_err());
    }

    #[test]
    fn links_are_detected() {
        assert!(contains_link("visit HTTPS://spam.example"));
        assert!(contains_link("www.example.com"));
        assert!(!contains_link("Great post on caching!"));
    }
}
