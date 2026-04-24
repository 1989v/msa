-- TG-06.3: 백테스트 실행 메타 + 결과 요약.
-- ORDER BY (tenantId, strategyId, startedAt): 테넌트/전략별 최근 실행 lookup 최적화.
CREATE TABLE IF NOT EXISTS seven_split.backtest_run (
    runId        UUID,
    tenantId     String,
    strategyId   UUID,
    symbol       String,
    configJson   String,
    seed         Int64,
    fromTs       DateTime64(3, 'UTC'),
    toTs         DateTime64(3, 'UTC'),
    realizedPnl  Decimal(38, 8),
    mdd          Decimal(10, 6),
    sharpe       Decimal(10, 6),
    fillCount    UInt64,
    startedAt    DateTime64(3, 'UTC'),
    endedAt      DateTime64(3, 'UTC')
)
ENGINE = MergeTree
ORDER BY (tenantId, strategyId, startedAt);
