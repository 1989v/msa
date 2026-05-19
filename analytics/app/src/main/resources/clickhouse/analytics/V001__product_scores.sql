-- ADR-0017 Analytics & Scoring System 의 기존 product_scores 테이블 (재현).
-- 이 파일은 ADR-0050 Phase 2 의 컬럼 추가 마이그레이션 전 baseline.
-- 운영 환경에는 이미 적용돼 있을 수 있음 — 모두 IF NOT EXISTS 로 idempotent.

CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.product_scores
(
    product_id        UInt64,
    impressions       UInt64,
    clicks            UInt64,
    orders            UInt64,
    ctr               Float64,
    cvr               Float64,
    popularity_score  Float64,
    window_start      DateTime,
    updated_at        DateTime
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (product_id, window_start);
