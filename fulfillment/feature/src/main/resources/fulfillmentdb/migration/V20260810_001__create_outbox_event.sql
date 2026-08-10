-- fulfillment 의 outbox_event 는 마이그레이션 정의가 없었다 — 운영에는 Hibernate 가 만들어
-- 존재하지만, Flyway 를 켜는 지금 정의를 맞춰두지 않으면 새 환경에서만 이 테이블이 빠진다.
-- order 의 동일 테이블 정의를 그대로 쓴다(공통 Outbox 표준, ADR-0032).
-- 기존 환경에서는 IF NOT EXISTS 로 무해하게 통과한다.

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
