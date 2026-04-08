CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.events (
    event_id       String,
    event_type     LowCardinality(String),
    user_id        Nullable(Int64),
    visitor_id     String,
    session_id     String,
    timestamp      DateTime64(3),
    payload        String,

    -- Extracted fields for frequent queries
    product_id     Nullable(Int64),
    keyword        Nullable(String),
    source         Nullable(String),
    position       Nullable(Int32),

    -- A/B experiment context
    experiment_ids     Array(Int64),
    experiment_variants Array(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (event_type, timestamp, visitor_id)
TTL timestamp + INTERVAL 90 DAY;

-- Aggregated scores table for persistence
CREATE TABLE IF NOT EXISTS analytics.product_scores (
    product_id     Int64,
    impressions    Int64,
    clicks         Int64,
    orders         Int64,
    ctr            Float64,
    cvr            Float64,
    popularity_score Float64,
    window_start   DateTime64(3),
    updated_at     DateTime64(3)
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(window_start)
ORDER BY (product_id, window_start);

CREATE TABLE IF NOT EXISTS analytics.keyword_scores (
    keyword        String,
    search_count   Int64,
    total_clicks   Int64,
    total_orders   Int64,
    ctr            Float64,
    cvr            Float64,
    score          Float64,
    window_start   DateTime64(3),
    updated_at     DateTime64(3)
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(window_start)
ORDER BY (keyword, window_start);

-- Experiment metrics view (experiment service queries analytics API which uses this)
CREATE TABLE IF NOT EXISTS analytics.experiment_metrics (
    experiment_id  Int64,
    variant_name   String,
    event_type     LowCardinality(String),
    event_count    Int64,
    window_start   DateTime64(3),
    updated_at     DateTime64(3)
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(window_start)
ORDER BY (experiment_id, variant_name, event_type, window_start);
