-- V011: quant.fundamentals — yfinance Ticker.info daily ingest 결과 저장.
--
-- Yahoo v10 quoteSummary 가 crumb 인증을 요구해 quant 서비스에서 직접 호출 불가.
-- yfinance Python lib 은 자체적으로 cookie/crumb 처리 → ingest sidecar 가 매일
-- 한 번 fetch 해 본 테이블에 적재 → quant 서비스는 read-only.
--
-- ReplacingMergeTree(ingested_at) 으로 같은 (asset, market, as_of) 의 최신 row 만 유지.

CREATE TABLE IF NOT EXISTS quant.fundamentals (
    asset_code        LowCardinality(String),
    asset_class       LowCardinality(String),
    market_code       LowCardinality(String),
    as_of             Date,
    market_cap        Nullable(Float64),
    pe_ratio          Nullable(Float64),
    eps               Nullable(Float64),
    dividend_yield    Nullable(Float64),
    beta              Nullable(Float64),
    weeks52_high      Nullable(Float64),
    weeks52_low       Nullable(Float64),
    avg_daily_volume  Nullable(Float64),
    ingested_at       DateTime64(3, 'UTC') DEFAULT now64()
)
ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY (asset_class, asset_code, market_code, as_of);
