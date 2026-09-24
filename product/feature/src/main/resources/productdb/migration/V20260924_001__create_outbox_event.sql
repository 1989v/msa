-- product 이벤트를 아웃박스로 옮기기 위한 테이블. 지금은 테이블만 — 쓰는 코드는 다음 단계에서 붙는다.
-- 컬럼은 common OutboxEntity 와 1:1 (order · inventory · fulfillment 와 같은 정의, 릴레이 보강 컬럼 포함).
CREATE TABLE IF NOT EXISTS outbox_event (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    event_id        VARCHAR(36)  NOT NULL,
    aggregate_type  VARCHAR(50)  NOT NULL,
    aggregate_id    BIGINT       NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    payload         JSON         NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at      DATETIME(6)  NOT NULL,
    published_at    DATETIME(6)  NULL,
    partition_key   VARCHAR(100) NULL,
    headers         JSON         NULL,
    attempts        INT          NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(6)  NULL,
    lease_until     DATETIME(6)  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_outbox_event_id (event_id),
    KEY idx_outbox_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
