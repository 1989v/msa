-- ADR-0029 PR-10 (Phase 4): inventory `processed_event` v0 / backup 테이블 정리.
--
-- PR-4 (V2__processed_event_composite_key.sql) 에서 5-step swap 으로 신표준 스키마 (BINARY(16) UUID +
-- (event_id, consumer_group) 복합 PK) 로 전환하면서 rollback 안전망으로 다음 두 테이블을 보존했다:
--   - processed_event_v0          : RENAME 직전의 원본 스키마 (VARCHAR(36) PK + topic)
--   - processed_event_backup_v0   : V2 의 1) backup step 으로 떠 둔 SELECT * 사본
--
-- PR-5/6/7/8/8a 호출부 helper 이관 + 운영 1주 관찰 (graceful degrade missingId 메트릭 0) 후 본 PR 에서
-- 두 테이블을 영구 DROP 한다. 운영 DB 에 잔존하지 않는 환경 (PR-4 시점 이전에 합류한 cluster, 또는 dry-run
-- 환경) 에서도 스크립트가 안전하게 통과하도록 IF EXISTS 가드를 사용한다.
--
-- ## Rollback
-- DROP 후에는 `processed_event_v0` 데이터로의 즉시 복구는 불가하다. PITR (XtraBackup + binlog) 로만 복구
-- 가능하므로, 본 스크립트 적용 전 PITR 백업이 정상 동작 중인지 확인했다 (`k8s/infra/prod/backup/`).

DROP TABLE IF EXISTS processed_event_v0;
DROP TABLE IF EXISTS processed_event_backup_v0;
