# KEK Rotation SOP

> **TG-P2-04.6** — Phase 2 envelope encryption (KEK wrap DEK) 회전 운영 절차.
>
> 본 문서는 LocalFile (개발/단일 호스트) 와 OCI Vault (운영) 두 환경의 회전 절차, 진행률 모니터링,
> Phase 1 → Phase 2 마샬 정책을 다룬다.

---

## 1. 배경

- Phase 2 부터 `exchange_credential` / `notification_target` 의 비밀 컬럼은 envelope encryption 으로 저장된다.
  - `*_cipher` 컬럼: AES-GCM(plaintext, DEK) — 매 row 마다 새 DEK 생성.
  - `dek_wrapped` 컬럼: KEK.wrap(DEK) — KMS 가 wrap 함.
  - `kek_version` 컬럼 (INT NOT NULL): 사용된 KEK 의 INT 매핑.
- 회전 시 KEK 만 교체하면 되며, 모든 row 의 DEK 자체를 매번 다시 발급할 필요는 없다.
- `LazyReencryptionJob` 가 1분 간격으로 stale row 100건씩 재암호화한다 (downtime 0).

---

## 2. LocalFile (개발 / 단일 호스트)

### 2.1 신규 KEK 생성

```bash
openssl rand -hex 32   # 64-char hex (AES-256, 32 bytes)
```

### 2.2 설정 추가

`application-local.yml` (또는 환경변수):

```yaml
quant:
  security:
    kms:
      provider: local
      local:
        current-version: v2          # ← 새 버전으로 변경
        kek-versions:
          v1: 0000000000000000000000000000000000000000000000000000000000000001  # 회전 전 (유지!)
          v2: <openssl 출력 hex>                                                  # 신규
```

> **중요**: `v1` 도 잠시 유지해야 한다. `LazyReencryptionJob` 가 `v1` 으로 wrap 된 DEK 를 unwrap 하려면 v1 KEK 가 메모리에 있어야 한다.

### 2.3 애플리케이션 재시작

```bash
./gradlew :quant:app:bootRun --args='--spring.profiles.active=local'
```

기동 후 `quant_kek_cache_misses_total` 가 정상 증가하면 KEK 로드 정상.

### 2.4 회전 진행 (자동)

- `LazyReencryptionJob` 가 1분 간격으로 polling.
- `WHERE kek_version < 2 LIMIT 100` 으로 backlog scan → re-encrypt → optimistic lock UPDATE.
- 메트릭 `quant_kek_rotation_lazy_reencrypt_total{from_version=1,to_version=2,table=...}` 가 누적된다.

### 2.5 진행률 모니터링

```sql
SELECT 'exchange_credential' AS tbl, kek_version, COUNT(*) AS rows
FROM exchange_credential
GROUP BY kek_version
UNION ALL
SELECT 'notification_target', kek_version, COUNT(*)
FROM notification_target
GROUP BY kek_version
ORDER BY tbl, kek_version;
```

### 2.6 회전 완료 후 v1 회수

`v1` row 가 0 으로 도달하면:

```yaml
quant:
  security:
    kms:
      local:
        current-version: v2
        kek-versions:
          v2: <hex>            # v1 항목 제거
```

재시작 후 `v1` KEK 자체가 메모리에서 제거된다.

---

## 3. OCI Vault (운영)

### 3.1 자동 회전

OCI Console 또는 CLI 로 master encryption key 의 `Rotate` 트리거.

```bash
oci kms management key rotate --key-id <ocid1.key.oc1...>
```

OCI Vault 가 새 key version OCID 를 자동 발급한다. **기존 ciphertext 도 unwrap 가능** (OCI 가 모든 과거 버전을 자동 보관).

### 3.2 애플리케이션 영향

- `KeyManagementService.currentKekVersion()` 이 새 OCID 를 반환한다.
- 신규 wrap 호출은 자동으로 새 버전을 사용한다.
- `LazyReencryptionJob` 가 `kek_version <` 비교로 stale row 를 재암호화한다.

### 3.3 모니터링

- 메트릭: `quant_kek_rotation_lazy_reencrypt_total{from_version,to_version,table}`
- DB 쿼리: §2.5 동일.
- OCI Console 의 KMS 사용량 그래프 (wrap/unwrap 호출 수) 와 함께 확인.

### 3.4 OCI 환경의 `kek_version INT` 제약 (단순화 한계)

- `KekVersionLabel.toInt(label)` 는 OCID 같은 임의 문자열을 `Math.abs(hashCode())` 로 매핑한다.
- **단조 증가가 보장되지 않으므로** "stale 판정" (`WHERE kek_version < current`) 이 부정확할 수 있다.
- Phase 3 에서 OCID → Int 매핑 테이블 신설 ADR 후속 처리 예정.
- 운영 임시 대응: 회전 후 24시간 내 모든 row 가 새 INT 값으로 자연 갱신되는지 메트릭으로 확인.

---

## 4. Phase 1 → Phase 2 마샬 정책

Phase 1 V001 schema 에서 `exchange_credential.api_key_cipher` 등은 단순 AES-GCM 암호문이었다 (실 사용 row 0건, phase1-readiness.md §데이터 참조).

Phase 2 V002 마이그레이션은 다음 컬럼을 추가한다:
- `kek_version INT NOT NULL DEFAULT 1`
- `dek_wrapped VARBINARY(1024) NULL`

### 4.1 본 TG (TG-P2-04) 의 단순화 정책

- **신규 row**: 무조건 envelope 형식 (`dek_wrapped IS NOT NULL`).
- **기존 row** (Phase 1 잔존, `dek_wrapped IS NULL`):
  - Adapter read 경로에서 `dek_wrapped` 가 NULL 이면 단순 AES-GCM 복호 fallback (deprecated 주석).
  - `LazyReencryptionJob` 는 NULL row 를 **skip** 한다 (별도 일회성 마이그레이션 스크립트 필요).
- **운영 결정**: Phase 1 본인 1인 운용 단계에서 실 데이터가 없거나 적으므로, 필요 시 운영자가 수동으로 재등록한다.

### 4.2 추후 일회성 마이그레이션 스크립트 (Phase 3 검토)

```kotlin
// Pseudo: Phase 1 row 를 Phase 2 envelope 으로 일괄 변환
for (row in jpa.findAllByDekWrappedIsNull()) {
    val plain = legacyAesGcmDecrypt(row.apiKeyCipher)
    val envelope = codec.encrypt(plain)
    jpa.updateEnvelope(row.id, envelope.ciphertext, envelope.wrappedDek.ciphertext, currentVersion)
}
```

---

## 5. 검증 체크리스트

- [ ] 회전 직후 `quant_kek_cache_misses_total` 가 일시 급증하는지 (캐시 invalidation 이 정상)
- [ ] 1시간 내 `quant_kek_rotation_lazy_reencrypt_total` 가 모든 row 수만큼 누적
- [ ] `SELECT COUNT(*) FROM exchange_credential WHERE kek_version < (current_version)` 가 0 도달
- [ ] 회전 중 read 경로 SLO (NFR-P2-PERF-02 p95 ≤ 500ms) 유지
- [ ] 회전 중 KMS 장애 가상 시뮬 → `quant_kek_cache_stale_total` 증가로 degrade-with-warning 확인 (TG-P2-03.6)

---

## 6. Rollback

- 회전이 잘못된 KEK 로 진행된 경우 (예: KEK 유출):
  1. `current-version` 을 직전 안전 버전으로 즉시 변경.
  2. `LazyReencryptionJob` disable (`quant.security.lazy-reencryption.enabled=false`).
  3. 신규 row 만 안전 버전으로 wrap 됨, 기존 stale row 는 그대로.
  4. 새 안전 KEK 발급 후 §2.1 부터 재진행.

---

## 7. 보안 주의사항

- 평문 KEK / DEK 는 **로그/메트릭/예외 메시지 어디에도 노출하지 않는다** (ADR-0021 §보안, INV-P2-12).
- KEK hex 값은 환경변수 / Secret Store 로만 주입한다 (`application-local.yml` 직접 commit 금지 — `.gitignore` 등재).
- KEK 회전 이력은 별도 audit_log (TG-P2-05) 에 prev_hash 체인으로 기록할 것.
