-- ADR-0044 Phase 2 — Item-Item CF (PPMI) 결과 저장 테이블.
-- 적용 대상: analytics ClickHouse DB.
-- Phase 1 와 같은 방식으로 DBA / 운영자 수동 적용.

CREATE TABLE IF NOT EXISTS analytics.item_similarity (
    item_a UInt64,
    item_b UInt64,
    similarity Float32,
    co_count UInt32,
    metric Enum8('ppmi'=1, 'jaccard'=2, 'cosine'=3),
    computed_at DateTime
) ENGINE = ReplacingMergeTree(computed_at)
ORDER BY (item_a, item_b);
-- 주의: ClickHouse 의 ORDER BY 절은 sorting key 정의 — DESC 미지원.
-- similarity DESC 정렬은 쿼리에서 `ORDER BY similarity DESC` 로 처리.

-- TTL 은 컬럼 변경 없이 추후 ALTER 로 추가 가능. 처음에는 자유롭게 누적.
