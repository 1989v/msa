-- ADR-0045 Phase 1 — Recommendation data pipeline schema
-- 적용 대상: analytics ClickHouse DB
-- 적용 방법: DBA 가 수동으로 또는 별도 ClickHouse migration tool 로 실행
-- (Flyway 는 MySQL 전용 — ClickHouse 는 별도 마이그레이션 절차)

-- 1. 사용자 행동 이벤트 raw 테이블
CREATE TABLE IF NOT EXISTS analytics.recommendation_events (
    user_id UInt64,
    item_id UInt64,
    action_type Enum8('pageview'=1, 'click'=2, 'addwish'=3, 'reservation'=4),
    city_id UInt32,
    category_id UInt32,
    timestamp DateTime64(3)
) ENGINE = MergeTree()
ORDER BY (city_id, category_id, timestamp)
PARTITION BY toYYYYMM(timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY;

-- 2. 일별 도시×카테고리×아이템 행동 카운트 (Materialized View)
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.recommendation_score_daily
ENGINE = SummingMergeTree()
ORDER BY (city_id, category_id, item_id, event_date)
AS SELECT
    city_id,
    category_id,
    item_id,
    toDate(timestamp) AS event_date,
    sumIf(1, action_type = 'reservation') AS reservation_count,
    sumIf(1, action_type = 'click') AS click_count,
    sumIf(1, action_type = 'addwish') AS addwish_count,
    sumIf(1, action_type = 'pageview') AS pageview_count
FROM analytics.recommendation_events
GROUP BY city_id, category_id, item_id, event_date;
