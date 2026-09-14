-- ADR-0095 — 관광지 인기 집계. place-ingest 의 `links` 잡이 **이 표만** 읽는다.
--
-- 공용 원장(`events`)에 직접 붙이지 않는 이유: 원장 스키마가 바뀌면 소비자가 조용히 깨진다.
-- `recommendation` 이 `analytics` DB 안의 `recommendation_*` 전용 표를 읽는 것과 같은 형태다.
--
-- 왜 필요한가: YouTube search.list 는 하루 100건(10,000 units ÷ 건당 100)이라 관광지
-- 59,735곳 전량에 약 1.6년이 걸린다. 그 100건을 어디에 쓸지가 `links` 잡의 핵심 결정이고,
-- 그 근거가 이 집계다.
CREATE TABLE IF NOT EXISTS analytics.attraction_popularity_daily
(
    day          Date,
    attraction_id String,
    impressions  UInt32,
    clicks       UInt32
)
ENGINE = SummingMergeTree((impressions, clicks))
ORDER BY (day, attraction_id)
TTL day + INTERVAL 90 DAY;
