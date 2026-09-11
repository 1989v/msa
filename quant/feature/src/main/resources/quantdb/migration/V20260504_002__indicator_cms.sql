-- ADR-0033 Phase 1 — 입문자 지표 학습 CMS (Q7 = db-cms).
-- ROLE_ADMIN 만 write, public read. publishedAt NULL 이면 draft.

CREATE TABLE indicator_content (
    content_id BINARY(16) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(32) NOT NULL,                -- TREND/MOMENTUM/VOLATILITY/VOLUME/MARKET_STRUCTURE
    summary VARCHAR(500) NOT NULL,
    body_md MEDIUMTEXT NOT NULL,
    formula_tex TEXT NULL,
    examples_json JSON NOT NULL,                  -- IndicatorExample[]
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    published_at DATETIME(6) NULL,
    PRIMARY KEY (content_id),
    UNIQUE KEY uniq_indicator_slug (slug),
    KEY idx_indicator_published (published_at, category),
    KEY idx_indicator_category (category, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE indicator_revision (
    revision_id BINARY(16) NOT NULL,
    content_id BINARY(16) NOT NULL,
    body_md MEDIUMTEXT NOT NULL,
    editor_id VARCHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (revision_id),
    KEY idx_revision_content (content_id, created_at),
    CONSTRAINT fk_revision_content
        FOREIGN KEY (content_id) REFERENCES indicator_content(content_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
