-- TG-06.4: 체결 시계열 Phase 1 placeholder.
-- Phase 2/3 에서 실거래 체결 이벤트를 확장하여 저장. 현재는 create 만 확보.
CREATE TABLE IF NOT EXISTS seven_split.execution_result (
    runId         UUID,
    tenantId      String,
    orderId       UUID,
    slotId        UUID,
    side          LowCardinality(String),
    executedPrice Decimal(38, 8),
    executedQty   Decimal(38, 8),
    executedAt    DateTime64(3, 'UTC'),
    ingestedAt    DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
ORDER BY (tenantId, runId, executedAt);
