# audit_log RBAC SOP

ADR-0026 — `quant_audit` ClickHouse DB 의 RBAC 분리 운영 절차.

> 본 문서는 SOP 만 정의한다. 실제 K8s overlay 의 Secret/ConfigMap 변경은 TG-P2-15 에서 수행한다.

## 배경

- `quant_audit` 는 Phase 2 신규 audit 로그 전용 DB. Phase 1 `quant` (운영 도메인) 과 완전 격리.
- 서비스 계정이 도용되어도 과거 audit 레코드 위변조가 불가하도록 **권한 경계** + **prev_hash chain** 이중 방어.

## User 정의

| User | 용도 | 권한 |
|---|---|---|
| `quant_audit_writer` | quant 서비스 (`ClickHouseAuditLogPublisher`) | `INSERT ON quant_audit.*` 만 |
| `quant_audit_reader` | `AuditChainVerifier`, 운영자 조회 | `SELECT ON quant_audit.*` 만 |
| `quant_audit_admin` | DBA (긴급 복구 시 한정) | `ALL` (평소 lock) |

## 생성 SQL

```sql
-- writer (서비스 계정)
CREATE USER IF NOT EXISTS quant_audit_writer IDENTIFIED WITH plaintext_password BY '<rotate>';
REVOKE ALL ON quant_audit.* FROM quant_audit_writer;
GRANT INSERT ON quant_audit.* TO quant_audit_writer;

-- reader (검증 잡)
CREATE USER IF NOT EXISTS quant_audit_reader IDENTIFIED WITH plaintext_password BY '<rotate>';
REVOKE ALL ON quant_audit.* FROM quant_audit_reader;
GRANT SELECT ON quant_audit.* TO quant_audit_reader;

-- admin (lock by default)
CREATE USER IF NOT EXISTS quant_audit_admin IDENTIFIED WITH plaintext_password BY '<rotate>';
GRANT ALL ON quant_audit.* TO quant_audit_admin;
ALTER USER quant_audit_admin SETTINGS lock = 1;  -- 변조 탐지 후 unlock 만 사용
```

## 검증 SQL

```sql
-- writer 가 UPDATE/DELETE 시 ACCESS_DENIED 가 나야 정상.
ALTER TABLE quant_audit.audit_log UPDATE actor = 'attacker' WHERE 1;
DELETE FROM quant_audit.audit_log WHERE 1;

-- reader 가 INSERT 시 ACCESS_DENIED 가 나야 정상.
INSERT INTO quant_audit.audit_log (audit_id, tenant_id, ...) VALUES (...);
```

## 변조 탐지 후 escalation 절차

1. `AuditChainVerifier` 가 invalid row 검출 → CRITICAL Telegram 알림 발송 (`quant_audit_hash_chain_invalid_total > 0`)
2. 운영자가 인시던트 채널에 보고 + SOP 트리거
3. DBA 가 `quant_audit_admin` 계정 unlock:
   ```sql
   ALTER USER quant_audit_admin SETTINGS lock = 0;
   ```
4. 원인 조사 + 필요 시 row 복원
5. 복구 완료 후 admin 계정 즉시 lock:
   ```sql
   ALTER USER quant_audit_admin SETTINGS lock = 1;
   ```
6. 마지막으로 변조 사실 자체를 audit row 로 append (action='AUDIT_TAMPER_DETECTED', payload 에 사건 요약)

## Password rotation

- 분기 1회 + 위반 의심 시 즉시
- writer/reader 는 K8s Secret 으로 주입 (TG-P2-15 에서 정의)
- admin 은 운영자 1Password / OCI Vault 별도 보관
