-- ADR-0036 P2-T08 — 김치프리미엄 시계열 테이블.
CREATE TABLE IF NOT EXISTS quant.kimchi_premium_tick (
    asset_code         LowCardinality(String),
    kr_market          LowCardinality(String),
    foreign_market     LowCardinality(String),
    ts                 DateTime64(3, 'UTC'),
    krw_price          Decimal(38, 8),
    foreign_usd_price  Decimal(38, 8),
    krw_per_usd        Decimal(38, 8),
    premium_percent    Decimal(10, 4)
)
ENGINE = ReplacingMergeTree(ts)
PARTITION BY toYYYYMM(ts)
ORDER BY (asset_code, kr_market, foreign_market, ts);
