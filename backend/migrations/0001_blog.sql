-- Reactions: one row per (post, visitor, kind, channel, bucket). The unique key makes
-- retries and double-clicks idempotent: a duplicate INSERT IGNORE simply does nothing.
--   view  -> bucket = UTC day ("2026-11-05"), so a visitor counts once per post per day
--   like  -> bucket = "forever", so a visitor can like a post once
--   share -> bucket = UTC day, per channel
CREATE TABLE blog_post_events (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug         VARCHAR(100) CHARACTER SET ascii NOT NULL,
    kind         ENUM('view', 'like', 'share') NOT NULL,
    channel      VARCHAR(16) CHARACTER SET ascii NOT NULL DEFAULT '',
    visitor_hash CHAR(64) CHARACTER SET ascii NOT NULL,
    bucket       VARCHAR(16) CHARACTER SET ascii NOT NULL,
    created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_event (slug, kind, channel, visitor_hash, bucket),
    KEY idx_slug_kind (slug, kind)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Comments. ids are UUIDv7, so ordering by id is ordering by creation time,
-- which gives cheap, stable cursor pagination.
CREATE TABLE blog_comments (
    id           CHAR(36) CHARACTER SET ascii NOT NULL,
    slug         VARCHAR(100) CHARACTER SET ascii NOT NULL,
    author_name  VARCHAR(60) NOT NULL,
    body         VARCHAR(1000) NOT NULL,
    status       ENUM('pending', 'published', 'rejected') NOT NULL,
    visitor_hash CHAR(64) CHARACTER SET ascii NOT NULL,
    created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_slug_status_id (slug, status, id),
    KEY idx_status_id (status, id),
    KEY idx_visitor_created (visitor_hash, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
