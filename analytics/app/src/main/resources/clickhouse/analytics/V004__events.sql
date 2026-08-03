-- 이벤트 원장 — EventRepositoryAdapter.saveEvents 가 적재하는 기본 테이블.
-- (V001~V003 과 동일하게 수동 적용: clickhouse-client < V004__events.sql)
CREATE TABLE IF NOT EXISTS analytics.events
(
    event_id            String,
    event_type          LowCardinality(String),
    user_id             Nullable(Int64),
    visitor_id          String,
    session_id          String,
    timestamp           DateTime64(3),
    payload             String,
    product_id          Nullable(Int64),
    keyword             Nullable(String),
    source              Nullable(String),
    position            Nullable(Int32),
    experiment_ids      Array(Int64),
    experiment_variants Array(String)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (event_type, timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY;
