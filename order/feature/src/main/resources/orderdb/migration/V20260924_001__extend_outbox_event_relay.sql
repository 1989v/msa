-- 아웃박스 릴레이 보강 — 다중 인스턴스 잠금(SKIP LOCKED + 리스), 재시도 백오프, 레코드 키·헤더.
-- 확장만 한다: 새 컬럼은 전부 NULL 허용이거나 기본값이 있어 옛 릴레이 코드와 공존한다.
-- status 는 VARCHAR 라 새 값(SENDING · FAILED)에 DDL 이 필요 없다.
-- 롤백 시 옛 릴레이는 SENDING 을 모르므로 먼저 UPDATE outbox_event SET status='PENDING' WHERE status='SENDING'.

ALTER TABLE outbox_event
    ADD COLUMN partition_key   VARCHAR(100) NULL,
    ADD COLUMN headers         JSON         NULL,
    ADD COLUMN attempts        INT          NOT NULL DEFAULT 0,
    ADD COLUMN next_attempt_at DATETIME(6)  NULL,
    ADD COLUMN lease_until     DATETIME(6)  NULL;
