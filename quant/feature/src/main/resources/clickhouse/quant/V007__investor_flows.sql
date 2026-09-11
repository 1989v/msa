-- ADR-0040 — 매매주체 동향 (외국인/기관/개인) 일별 통계.
-- KR 주식 전용 — pykrx 가 KRX 매매주체 데이터 ingest.
-- 메인 서비스 read-only, ingest sidecar (Python) 가 단방향 INSERT.

CREATE TABLE IF NOT EXISTS quant.investor_flows (
    asset_code        LowCardinality(String),
    market_code       LowCardinality(String),  -- 항상 FDR_KR (KR 주식)
    trade_date        Date,
    individual_net    Int64,                   -- 개인 순매수 (주, +/-)
    foreign_net       Int64,                   -- 외국인 순매수
    institution_net   Int64,                   -- 기관 순매수
    ingested_at       DateTime64(3, 'UTC') DEFAULT now64()
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(trade_date)
ORDER BY (asset_code, market_code, trade_date);
