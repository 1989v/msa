-- ADR-0032 PR-2 — Order Outbox 도입.
-- com.kgd.common.messaging.outbox.OutboxEntity (JPA) 와 schema 가 1:1 일치해야 한다 (ddl-auto=validate).
-- inventory / fulfillment / quant 의 outbox_event 테이블과 동일한 컬럼/인덱스 구성.
CREATE TABLE IF NOT EXISTS outbox_event (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    event_id       VARCHAR(36)  NOT NULL,
    aggregate_type VARCHAR(50)  NOT NULL,
    aggregate_id   BIGINT       NOT NULL,
    event_type     VARCHAR(100) NOT NULL,
    payload        JSON         NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at     DATETIME(6)  NOT NULL,
    published_at   DATETIME(6)  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_outbox_event_id (event_id),
    KEY idx_outbox_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
