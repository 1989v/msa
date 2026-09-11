-- TG-P2-05 / ADR-0026: audit_log 불변성 + RBAC 분리
-- DB quant_audit 는 quant (Phase 1) 와 별도 신설.
-- writer user 는 INSERT ONLY, reader user 는 SELECT ONLY 권한 분리 (RBAC SOP 별도 문서).
-- ReplacingMergeTree / CollapsingMergeTree / SummingMergeTree 등 변경(merge) 가능 엔진 사용 금지.
-- INV-P2-10: prev_hash / current_hash 컬럼은 NULL 거부 (FixedString 은 default empty 가 아닌 application 레벨 거부).

CREATE DATABASE IF NOT EXISTS quant_audit;

CREATE TABLE IF NOT EXISTS quant_audit.audit_log (
    audit_id        UUID,
    tenant_id       String,
    actor           String,                       -- user-id or 'system'
    action          LowCardinality(String),       -- e.g., 'STRATEGY_ACTIVATED', 'CREDENTIAL_CREATED'
    target          String,                       -- target entity id
    payload_json    String,
    occurred_at     DateTime64(3, 'UTC'),
    prev_hash       FixedString(64),              -- SHA-256 hex of previous row's current_hash (genesis = 64 x '0')
    current_hash    FixedString(64),              -- SHA-256 hex(prev_hash || payload_json || occurred_at || actor)
    ingested_at     DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (tenant_id, occurred_at, audit_id);
