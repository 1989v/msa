-- TG-06.2: 빗썸 분봉 원본 저장 테이블.
-- ORDER BY (symbol, interval, ts): 심볼/인터벌별 시계열 조회 최적화 + PK 중복 방지.
-- ReplacingMergeTree(ingestedAt): 재수집(backfill) 시 동일 키 최신 ingestedAt 로 덮어쓰기.
-- TTL: Phase 1 에서는 정책 미적용 (OQ-008 해소 후 5년 TTL 적용 예정)
-- TTL ts + INTERVAL 5 YEAR DELETE;
CREATE TABLE IF NOT EXISTS seven_split.market_tick_bithumb (
    symbol       String,
    `interval`   LowCardinality(String),
    ts           DateTime64(3, 'UTC'),
    open         Decimal(38, 8),
    high         Decimal(38, 8),
    low          Decimal(38, 8),
    close        Decimal(38, 8),
    volume       Decimal(38, 8),
    ingestedAt   DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingestedAt)
PARTITION BY toYYYYMM(ts)
ORDER BY (symbol, `interval`, ts);
