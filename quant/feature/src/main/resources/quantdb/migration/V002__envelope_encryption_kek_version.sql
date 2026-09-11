-- TG-P2-04: ExchangeCredential / NotificationTarget envelope encryption (KEK wrap DEK)
--
-- Phase 1 V001 에서 마련된 `*_cipher` VARBINARY 컬럼은 단순 AES-GCM 암호문이었다 (실 사용 X).
-- Phase 2 부터는 envelope encryption 으로 전환:
--   plaintext → AES-GCM(plaintext, DEK) = ciphertext (기존 *_cipher 컬럼 재사용)
--                + KEK.wrap(DEK) = dek_wrapped (신규 컬럼)
--                + KEK 버전 = kek_version (신규 컬럼, INV-P2-11 NOT NULL)
--
-- 회전 추적: kek_version 컬럼 + idx_*_kek_version 인덱스 → LazyReencryptionJob 가
-- `WHERE kek_version < (current)` 로 stale row 를 100건씩 polling 한다.
--
-- Phase 1 데이터 호환:
--   - V001 schema 는 사전 마련만 됐을 뿐 실 사용 row 는 0 이다 (phase1-readiness.md §데이터).
--   - 그러나 안전을 위해 dek_wrapped 는 NULL 허용 → adapter 가 NULL 이면 Phase 1 단순 AES-GCM
--     fallback 경로로 분기 (deprecated 주석 표시, SOP 문서에 회수 정책 명시).

ALTER TABLE exchange_credential
    ADD COLUMN kek_version INT NOT NULL DEFAULT 1,
    ADD COLUMN dek_wrapped VARBINARY(1024) NULL,
    ADD INDEX idx_exchange_credential_kek_version (kek_version);

ALTER TABLE notification_target
    ADD COLUMN kek_version INT NOT NULL DEFAULT 1,
    ADD COLUMN dek_wrapped VARBINARY(1024) NULL,
    ADD INDEX idx_notification_target_kek_version (kek_version);
