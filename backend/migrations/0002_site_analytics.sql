-- Site-wide page views: one row per (path, visitor, UTC day), so refreshes don't inflate counts.
CREATE TABLE site_page_views (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    path         VARCHAR(200) CHARACTER SET ascii NOT NULL,
    visitor_hash CHAR(64) CHARACTER SET ascii NOT NULL,
    bucket       CHAR(10) CHARACTER SET ascii NOT NULL,
    created_at   DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_page_view (path, visitor_hash, bucket),
    KEY idx_bucket (bucket)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Active time: seconds a visitor spent on a path on a UTC day, counted only while the tab was
-- visible and the reader active. Heartbeats add to the row; a per-row cap stops runaway values.
-- slug is set for blog posts (/blog/{slug}) so reading time can be ranked per post.
CREATE TABLE site_engagement (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    path         VARCHAR(200) CHARACTER SET ascii NOT NULL,
    slug         VARCHAR(100) CHARACTER SET ascii NOT NULL DEFAULT '',
    visitor_hash CHAR(64) CHARACTER SET ascii NOT NULL,
    bucket       CHAR(10) CHARACTER SET ascii NOT NULL,
    seconds      INT UNSIGNED NOT NULL DEFAULT 0,
    created_at   DATETIME(3) NOT NULL,
    updated_at   DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_engagement (path, visitor_hash, bucket),
    KEY idx_slug (slug)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
