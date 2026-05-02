-- ADR-0029 PR-7 — product `processed_event` 테이블을 §6 표준 스키마(복합 PK + BINARY(16))로 도입한다.
--
-- 컨텍스트:
--   - 기존 product DB 에는 `processed_event` 테이블이 없었다 (Verification Follow-up §2 — 멱등 체크 zero).
--   - ADR-0029 §2 / §6 신표준은 (event_id BINARY(16), consumer_group VARCHAR(64)) 복합 PK 이며
--     quant 의 V001__init.sql `processed_event` / order 의 V20260502_002 / inventory PR-4 swap 결과와
--     일치한다.
--   - product 는 production processed_event 데이터가 없으므로 곧장 신표준으로 진입한다.
--
-- 멱등 INSERT 동작:
--   - PRIMARY KEY (event_id, consumer_group) 충돌 시 DataIntegrityViolationException 발생.
--   - common `IdempotentEventHandler` 가 이를 흡수해 중복 처리를 silent skip 한다 (ADR-0029 §3 Policy A).
--
-- retention:
--   - 7일 cleanup 은 `kgd.common.messaging.idempotent.cleanup.enabled=true` 활성 시
--     `IdempotentEventCleanupScheduler` 가 `deleteOlderThan` 으로 수행한다.
--   - `processed_at` 컬럼에 보조 인덱스를 두어 cleanup DELETE 의 풀스캔을 방지한다.
--
-- 비고:
--   - 본 스크립트는 신규 테이블 생성. 기존 v0 호환 처리 불필요 (현 운영 데이터 없음).
--   - Hibernate ddl-auto=validate 가 신규 Entity (BINARY(16) UUID + IdClass) 와 본 DDL 을 검증한다.
CREATE TABLE IF NOT EXISTS processed_event (
    event_id        BINARY(16)   NOT NULL,
    consumer_group  VARCHAR(64)  NOT NULL,
    processed_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (event_id, consumer_group),
    KEY idx_processed_event_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
