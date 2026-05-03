-- ADR-0033 Phase 1 — 자산 무관 OHLCV 단일 테이블.
-- 빗썸 candle (V002 market_tick_bithumb) 외에 yfinance/FDR 데이터를 동일 스키마로 흡수.
-- ingest sidecar (Python) 가 INSERT, 메인 서비스는 read only.

CREATE TABLE IF NOT EXISTS quant.ohlcv (
    asset_code   LowCardinality(String),
    asset_class  LowCardinality(String),  -- CRYPTO / STOCK_KR / STOCK_US
    market_code  LowCardinality(String),  -- BITHUMB / YAHOO / FDR_KR / ...
    interval     LowCardinality(String),  -- 1m / 5m / 1h / 1d
    ts           DateTime64(3, 'UTC'),
    open         Decimal(38, 8),
    high         Decimal(38, 8),
    low          Decimal(38, 8),
    close        Decimal(38, 8),
    volume       Decimal(38, 8),
    ingested_at  DateTime64(3, 'UTC') DEFAULT now64()
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(ts)
ORDER BY (asset_class, asset_code, market_code, interval, ts);

-- 환율 proxy 시세 (USDT/KRW 등) — Phase 1
CREATE TABLE IF NOT EXISTS quant.fx_proxy_tick (
    base   LowCardinality(String),    -- "USDT"
    quote  LowCardinality(String),    -- "KRW"
    market LowCardinality(String),    -- "BITHUMB"
    ts     DateTime64(3, 'UTC'),
    price  Decimal(38, 8)
)
ENGINE = ReplacingMergeTree(ts)
PARTITION BY toYYYYMM(ts)
ORDER BY (base, quote, market, ts);

-- 시그널 평가 이력 (백테스트 / paper)
CREATE TABLE IF NOT EXISTS quant.signal_eval (
    run_id       UUID,
    strategy_id  UUID,
    tenant_id    LowCardinality(String),
    asset_code   LowCardinality(String),
    market_code  LowCardinality(String),
    ts           DateTime64(3, 'UTC'),
    signal_type  LowCardinality(String),  -- VOLUME_SPIKE / RSI_BREAKOUT / MA_CROSS / BB_SQUEEZE
    value        Decimal(38, 8),
    triggered    UInt8                    -- 0/1
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (tenant_id, run_id, ts);
