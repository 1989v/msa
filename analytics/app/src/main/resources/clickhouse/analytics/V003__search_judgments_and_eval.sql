-- ADR-0050 Phase 4 core — 검색 평가 인프라.

-- judgment set: (query, productId, relevance 0..3, source)
--   source 'weak' : 로그 기반 약지도 (reservation/click 등 → relevance 매핑)
--   source 'manual' : 수동 라벨
--   source 'hybrid' : 약지도 부트스트랩 후 수동 보정
CREATE TABLE IF NOT EXISTS analytics.search_judgments
(
    query        String,
    product_id   String,
    relevance    UInt8,
    source       LowCardinality(String),
    weight       Float32 DEFAULT 1.0,
    created_at   DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(created_at)
ORDER BY (query, product_id, source);

-- 평가 결과 적재: 같은 query/variant 가 여러 번 평가됨
CREATE TABLE IF NOT EXISTS analytics.search_eval_results
(
    eval_id        String,
    ts             DateTime DEFAULT now(),
    variant        LowCardinality(String),
    query          String,
    ndcg10         Float64,
    mrr            Float64,
    map10          Float64,
    precision_at_5 Float64,
    precision_at_10 Float64,
    result_size    UInt32
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(ts)
ORDER BY (variant, query, ts);
