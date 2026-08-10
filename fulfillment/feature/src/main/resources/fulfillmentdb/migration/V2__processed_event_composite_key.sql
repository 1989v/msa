-- ADR-0029 PR-4 (Phase 2b): fulfillment `processed_event` 스키마 swap.
--
-- v0 (`event_id VARCHAR(36) PK + topic`) → 신표준 (`(event_id BINARY(16), consumer_group VARCHAR(64)) PK`).
-- 5-step swap 패턴 (ADR-0029 §Rollout Phase 2):
--   1) backup — rollback 안전망
--   2) 신규 테이블 생성
--   3) 데이터 backfill (UUID VARCHAR → BINARY(16), topic 컬럼 제거, consumer_group default 부여)
--   4) RENAME (원자적 swap, InnoDB metadata lock 만)
--   5) 후속 PR-10 에서 v0 / backup 테이블 DROP — 본 PR 에서는 보존
--
-- 기존 row 의 consumer_group 값:
--   현재 [FulfillmentEventConsumer] 의 @KafkaListener 에는 groupId 명시가 누락되어 있어
--   기본 group (Spring 자동 생성) 이 사용된다. 하지만 베이스라인 backfill 은 향후 PR-5 에서 일괄
--   `fulfillment-service` groupId 로 통일될 표준 값을 사용한다 (ADR-0029 §6.2.3).
--
-- VARCHAR(36) UUID 가 hyphen 포함 36자 형식임을 가정한다 (Java UUID.toString() 표준).

-- 1) backup
CREATE TABLE IF NOT EXISTS processed_event_backup_v0 AS SELECT * FROM processed_event;

-- 2) 신규 테이블 — ADR-0029 §2 신표준
CREATE TABLE IF NOT EXISTS processed_event_v1 (
    event_id        BINARY(16)  NOT NULL,
    consumer_group  VARCHAR(64) NOT NULL,
    processed_at    DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id, consumer_group),
    KEY idx_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) 데이터 backfill — VARCHAR(36) UUID → BINARY(16) 변환
INSERT IGNORE INTO processed_event_v1 (event_id, consumer_group, processed_at)
SELECT
    UNHEX(REPLACE(event_id, '-', '')),
    'fulfillment-service',
    processed_at
FROM processed_event
WHERE CHAR_LENGTH(event_id) = 36;

-- 4) 원자적 swap — 기존 v0 테이블은 processed_event_v0 으로 보존
RENAME TABLE processed_event   TO processed_event_v0,
             processed_event_v1 TO processed_event;
