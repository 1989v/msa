---
spec: quant-phase2-paper-trading
phase: 2 (paper-trading)
date: 2026-04-26
status: tasks-draft
depends-on:
  - planning/spec.md
  - planning/requirements.md
  - planning/test-quality.md
  - context/open-questions.yml
phase1-references:
  - docs/specs/2026-04-24-quant-crypto-trading/planning/tasks.md
  - docs/specs/2026-04-24-quant-crypto-trading/planning/spec.md
  - quant/docs/phase1-readiness.md
adr-references:
  - docs/adr/ADR-0024-quant-service.md
  - docs/adr/ADR-0025-quant-market-data-hub.md
  - docs/adr/ADR-0026-quant-audit-immutability.md
  - docs/adr/ADR-0027-quant-kek-management.md
standards:
  - docs/standards/test-rules.md
  - docs/architecture/00.clean-architecture.md
  - docs/architecture/module-structure.md
  - docs/architecture/kafka-convention.md
  - docs/architecture/api-response.md
  - docs/adr/ADR-0012-idempotent-consumer.md
  - docs/adr/ADR-0014-code-convention.md
  - docs/adr/ADR-0015-resilience-strategy.md
  - docs/adr/ADR-0019-k8s-migration.md
  - docs/adr/ADR-0020-transactional-usage.md
  - docs/adr/ADR-0021-logging-conventions.md
  - docs/adr/ADR-0022-entity-mutation-conventions.md
---

# Task Breakdown — quant Phase 2 (Paper Trading)

## Overview

본 문서는 `quant` 서비스의 **Phase 2 (페이퍼 트레이딩) MVP** 구현 태스크 리스트이다. Phase 1 (백테스트) 산출물은 **변경 없이 재사용**되며, 본 문서는 Phase 2 추가 범위(시세 수신 + 가상 체결 + Telegram + 보안 강화 + Outbox 활성)만 다룬다. Phase 3 (실매매)는 범위 밖이다 (말미 "Out of scope for Phase 2" 참조).

- **Total Task Groups**: 16 (+ Preflight 2: P2.0, P2.1)
- **Execution Order**: Preflight → TG-P2-01 → (TG-P2-02 / TG-P2-03 / TG-P2-04 / TG-P2-05) → (TG-P2-06 / TG-P2-07 / TG-P2-08) → (TG-P2-09 / TG-P2-10 / TG-P2-11 / TG-P2-12) → (TG-P2-13 / TG-P2-14) → TG-P2-15 → TG-P2-16
- **Complexity labels**: S (≤ half day) / M (~1 day) / L (~2–3 days) / XL (1 week+)
- **Phase**: `2-paper` (모든 태스크)
- **Required Skills**: Kotlin Coroutines, Spring Boot, JPA, Kotest, reactor-netty WebSocketClient, Resilience4j, Redis Lua, OCI SDK, ClickHouse, Kafka, React/Vite, K8s(kustomize)

각 태스크는 "완료 = 한 PR" 기준으로 분해되며, 구현 + 테스트 + DoD 체크리스트를 포함한다. 의존성/병렬 가이드는 본 문서 말미 Execution Order 섹션 참조.

---

## Preflight — Phase 2 착수 전 blockers

> Phase 2 코드 진입은 P2.1만 closed면 가능. P2.0은 Phase 3 진입 전까지 closed 필수.

### P2.0 OQ-011 거래소 약관 검토 (사용자 수동)
- **Complexity**: S
- **산출물**: `docs/specs/2026-04-26-quant-phase2-paper-trading/context/exchange-terms.md` (빗썸/업비트 약관 발췌 + 자동매매 허용 조항 캡처)
- **의존**: 없음 (Phase 1 Preflight P.0 참조)
- **Status**: Phase 2 코드 진입은 가능 (가상 체결만), Phase 3 실매매 진입 전 closed 필수
- **DoD**:
  - [ ] 빗썸 OpenAPI 약관 자동매매 조항 발췌
  - [ ] 업비트 OpenAPI 약관 자동매매 조항 발췌
  - [ ] 법무 검토 (실 매매 진입 시 재수행)
  - [ ] `context/open-questions.yml` OQ-011 `status: closed` 갱신 (Phase 3 진입 전)
- **Verification**: `grep -n "OQ-011" docs/specs/2026-04-26-quant-phase2-paper-trading/context/open-questions.yml` → status closed 확인

### P2.1 OCI Vault 계정 + Master Encryption Key 발급
- **Complexity**: S
- **산출물**: OCI Vault 콘솔에 master KEK 1개 생성, OCID + IAM 사용자 자격증명 (private key, fingerprint) 발급
- **의존**: 없음
- **Status**: TG-P2-03 OciVaultKmsAdapter 구현 시작 전 closed 필수 (LocalFileKmsAdapter만 사용해 dev 진행 시 P2.1 생략 가능, 단 운영 진입 전 필수)
- **DoD**:
  - [ ] OCI 테넌시/사용자/Vault Compartment 확인
  - [ ] master encryption key 1개 생성 (AES-256, key shape SOFTWARE)
  - [ ] OCID, region, fingerprint, private key path 정리 (운영 K8s Secret으로 주입)
  - [ ] `quant/docs/oci-vault-setup.md` SOP 문서 작성 (TG-P2-03에서 본 문서 참조)
- **Verification**: OCI CLI로 `oci kms management vault get --vault-id <OCID>` 응답 200

---

## Task Groups

### Task Group TG-P2-01: Library 카탈로그 추가 + Phase 1 리터럴 승격

**Dependencies**: Preflight P2.0 진행 가능 (closed 불필요), P2.1 무관
**Phase**: 2-paper
**Complexity**: S
**Required Skills**: Gradle Kotlin DSL, Version Catalog

Phase 2 신규 라이브러리를 `gradle/libs.versions.toml`에 등재하고, Phase 1 spec §16에서 미해결로 명시된 "order/app 리터럴 → 카탈로그 승격"도 함께 처리한다.

- [x] TG-P2-01.0 **Complete**: `./gradlew :quant:app:dependencies --configuration runtimeClasspath` 결과에 신규 라이브러리 4종이 catalog 키로 해소된다.
  - [x] TG-P2-01.1 `gradle/libs.versions.toml` 신규 카탈로그 추가:
    - `oci-java-sdk-keymanagement` (KEK 발급 — 최신 안정 버전)
    - `nimbus-jose-jwt` (JWT HS256 서명, Phase 3 실 매매 베이스 클래스용)
    - `resilience4j-circuitbreaker` (CB)
    - `resilience4j-kotlin` (Coroutine 통합)
    - `bucket4j-redis` (Phase 3 검토용 placeholder, Phase 2는 Lua script 직접 사용 → 의존성만 등재 후 미사용 OK)
  - [x] TG-P2-01.2 Phase 1 spec §16 미해결: `order/app/build.gradle.kts` 의 resilience4j 리터럴 의존을 `libs.resilience4j.circuitbreaker` / `libs.resilience4j.kotlin` 카탈로그로 전환
  - [x] TG-P2-01.3 `quant/app/build.gradle.kts` 에 신규 카탈로그 키 추가 (`libs.oci.kms`, `libs.nimbus.jose`, `libs.resilience4j.circuitbreaker`, `libs.resilience4j.kotlin`)
  - [x] TG-P2-01.4 OCI SDK transitive 충돌 검사: `./gradlew :quant:app:dependencyInsight --dependency oci-java-sdk-common` → 단일 버전 유지
  - [x] TG-P2-01.5 빌드 영향 회귀 검증: 전체 `./gradlew build` 성공 (Phase 1 테스트 영향 0)
  - [x] TG-P2-01.6 **Verify**: `./gradlew :quant:app:build :order:app:build` 성공 + `git grep -n 'io.github.resilience4j' order/app/build.gradle.kts` → 카탈로그 참조만 남음

**Acceptance Criteria**:
- 신규 카탈로그 5개 키 모두 `libs.versions.toml`에 등재
- order/app 리터럴 의존성 0건 (grep)
- Phase 1 테스트 회귀 0 (`./gradlew :quant:domain:test :quant:app:test` green)

---

### Task Group TG-P2-02: ADR-0024 Errata — 빗썸 JWT 인증 코드 정정

**Dependencies**: TG-P2-01
**Phase**: 2-paper
**Complexity**: S
**Required Skills**: 코드 grep, ADR 작성, Kotlin

Phase 1 ADR-0024 §3·§9.1, spec.md §9.1, Phase 1 코드 일부에 표기된 "빗썸 HMAC-SHA512" 인증 표기를 **JWT(HS256)** 으로 정정한다. 본 TG는 문서/주석/잔존 코드 정합성 확보가 목적이며 실제 JWT 서명 구현은 TG-P2-03 (KMS) 이후 Phase 3 진입 시 `AbstractJwtBasedExchangeAdapter`로 일괄 구현한다.

- [x] TG-P2-02.0 **Complete**: 코드/주석/문서에 "HMAC-SHA512" 잔존 0건 (단, ADR-0024 본문 Errata 섹션의 정정 기록은 보존).
  - [x] TG-P2-02.1 grep 일괄 스캔: `git grep -n -E 'HMAC[-_]?SHA512|hmacSha512' quant/ docs/`
  - [x] TG-P2-02.2 Phase 1 `quant/app/infrastructure/bithumb/` REST 클라이언트 주석/Kdoc 정정 (코드는 public endpoint라 인증 미사용 → 주석만 영향)
  - [x] TG-P2-02.3 ADR-0024 본문 하단에 `## Errata (2026-04-26)` 섹션 추가:
    - 정정 내용: 빗썸 인증 = JWT(HS256) (업비트 동일 패턴)
    - 잔존 코드 위치, 정정 PR 번호 (본 TG)
    - `AbstractJwtBasedExchangeAdapter` 패턴 도입 예고 (Phase 3)
  - [x] TG-P2-02.4 새 ADR 발행: `docs/adr/ADR-0024-errata-bithumb-jwt.md` (Errata 섹션 분리 발행 옵션 — Plan 단계 결정에 따라 본문 append vs 분리 발행 중 1)
  - [x] TG-P2-02.5 `quant/CLAUDE.md` Phase 로드맵 섹션에 "Phase 2 Errata 적용" 1줄 추가
  - [x] TG-P2-02.6 **Verify**: `git grep -n -E 'HMAC[-_]?SHA512' quant/ -- ':!docs/adr/ADR-0024*'` 결과 0건

**Acceptance Criteria**:
- 코드/주석에 HMAC-SHA512 표기 0건
- ADR-0024 또는 분리 ADR에 Errata 명시
- `quant/CLAUDE.md` 로드맵 갱신

---

### Task Group TG-P2-03: KeyManagementService Port + Adapter 3종 (OCI Vault / LocalFile / Fake)

**Dependencies**: TG-P2-01, Preflight P2.1 (OciVaultKmsAdapter 운영 검증 시점)
**Phase**: 2-paper
**Complexity**: L
**Required Skills**: Kotlin Coroutines, OCI SDK, AES-GCM, Cryptography

ADR-0027 결정 — KEK 보관 추상화. Port → Adapter 3종 (운영 OCI / 로컬 dev LocalFile / 테스트 Fake). DEK 캐시 (TTL 30분, stale-on-error).

- [x] TG-P2-03.0 **Complete**: 단위 테스트로 wrap/unwrap round-trip 검증 + Adapter 3종이 동일 Port 시그니처로 교환 가능.
  - [x] TG-P2-03.1 `quant/app/src/main/kotlin/com/kgd/quant/application/port/security/KeyManagementService.kt` Port 선언:
    ```kotlin
    interface KeyManagementService {
        suspend fun wrap(plaintextDek: ByteArray): WrappedDek
        suspend fun unwrap(wrappedDek: ByteArray): ByteArray
        suspend fun currentKekVersion(): String
    }
    data class WrappedDek(val ciphertext: ByteArray, val kekVersion: String)
    ```
    Kdoc: 계약/예외/version prefix 규칙 명시
  - [x] TG-P2-03.2 `infrastructure/security/kms/OciVaultKmsAdapter.kt` (운영, `@Profile("oci") @ConditionalOnProperty`):
    - OCI SDK `oci-java-sdk-keymanagement` 의 `KmsCryptoClient.encrypt/decrypt` 호출
    - 자격증명: `OCI_TENANCY`, `OCI_USER`, `OCI_FINGERPRINT`, `OCI_PRIVATE_KEY_PATH`, `OCI_REGION`, `OCI_VAULT_KEY_OCID` (K8s Secret)
    - 호출은 `Dispatchers.IO` 위에서 `withContext`
  - [x] TG-P2-03.3 `infrastructure/security/kms/LocalFileKmsAdapter.kt` (로컬 dev, `@Profile("local") @ConditionalOnProperty`):
    - `QUANT_LOCAL_KEK` 환경변수 (hex 64 chars = 256 bits) 또는 `application-local.yml` 로드
    - AES-GCM-256 직접 wrap/unwrap (no external call)
    - 회전: `kek-v1` → `kek-v2` 환경변수 swap (TG-P2-04 lazy re-encryption hook이 자동 처리)
  - [x] TG-P2-03.4 `infrastructure/security/kms/FakeKmsAdapter.kt` (테스트 전용 — `:quant:app/src/test/kotlin/...`):
    - 메모리 in-process AES-GCM
    - 테스트 시드 주입 가능 (deterministic)
  - [x] TG-P2-03.5 DEK 캐시 (`Caffeine`) — TTL 30분, stale-on-error 정책 (KMS 일시 장애 시 만료 직전 entry로 degrade)
    - `KmsDekCache` 컴포넌트, hit/miss/stale 메트릭 (`quant.kek.cache.{hits,misses,stale}_total`)
  - [x] TG-P2-03.6 단위 테스트 (Kotest BehaviorSpec):
    - `KeyManagementServiceContractSpec` — Adapter 3종 모두 동일 시나리오로 round-trip (wrap → unwrap → 동등성)
    - `LocalFileKmsAdapterRotationSpec` — kek-v1 wrap → kek-v2 환경변수 swap → unwrap 시 자동 fallback
    - `OciVaultKmsAdapterIntegrationSpec` (`@Tag("oci-integration")`) — Testcontainers 또는 LocalStack 부재 시 실 OCI에 대한 nightly 한정 (CI normal에서 skip)
    - `KmsDekCacheStaleOnErrorSpec` — KMS 호출 mock fail → cache stale entry 반환
  - [x] TG-P2-03.7 application.yml 프로파일 분기 — `quant.security.kms.provider=oci|local|fake`
  - [x] TG-P2-03.8 **Verify**: `./gradlew :quant:app:test --tests '*Kms*'` 성공, `OciVaultKmsAdapterIntegrationSpec`은 `-Pinclude-oci-integration=true` 일 때만 실행

**Acceptance Criteria**:
- Adapter 3종이 동일 Port 시그니처를 만족하고 DI 분기로 교환 가능
- DEK 캐시 stale-on-error 정책 검증 테스트 1개 이상
- `application-local.yml`은 `.gitignore` 처리 (TG-P2-15에서 K8s overlay와 함께 재확인)
- 평문 DEK 로그 노출 0건 (`SensitiveDataMaskingSpec` 패턴 재사용)

---

### Task Group TG-P2-04: Envelope Encryption 적용 + V002 마이그레이션 (kek_version 컬럼 + lazy re-encryption)

**Dependencies**: TG-P2-03
**Phase**: 2-paper
**Complexity**: L
**Required Skills**: JPA, Flyway, AES-GCM, Optimistic Locking, 백그라운드 잡

Phase 1 `ExchangeCredential` / `NotificationTarget` 의 `byte` 필드(이미 AES-GCM 암호화)를 KMS Port를 통한 envelope encryption (KEK wrap DEK) 패턴으로 전환. `kek_version INT` 컬럼 추가 + lazy re-encryption 백그라운드 잡 + optimistic lock.

- [x] TG-P2-04.0 **Complete**: kek-v1 → kek-v2 회전 시뮬 후 백그라운드 잡이 모든 row를 신규 KEK로 재암호화하고 `kek_version` 컬럼이 갱신됨 (downtime 0).
  - [x] TG-P2-04.1 Flyway `quant/app/src/main/resources/db/migration/V002__envelope_encryption_kek_version.sql`:
    - `ALTER TABLE exchange_credential ADD COLUMN kek_version INT NOT NULL DEFAULT 1`
    - `ALTER TABLE notification_target ADD COLUMN kek_version INT NOT NULL DEFAULT 1`
    - 인덱스 `idx_exchange_credential_kek_version (kek_version)` (백그라운드 잡 스캔용)
  - [x] TG-P2-04.2 `infrastructure/security/EnvelopeCryptoCodec.kt` — KMS Port + AES-GCM DEK 결합. `encrypt(plaintext): Pair<ciphertext, kekVersion>`, `decrypt(ciphertext, kekVersion): plaintext`
  - [x] TG-P2-04.3 Phase 1 `ExchangeCredential` Aggregate / `NotificationTarget` VO 의 byte 필드 read 경로에 `EnvelopeCryptoCodec.decrypt()` hook 추가 (도메인 모델 변경 최소화 — Adapter 계층에서 변환)
  - [x] TG-P2-04.4 `LazyReencryptionJob` (Spring `@Scheduled` 또는 별도 `ApplicationRunner`):
    - 1분 간격 polling: `SELECT id FROM exchange_credential WHERE kek_version < (current) LIMIT 100`
    - 각 row: `unwrap(old) → wrap(new) → UPDATE ... WHERE id=? AND kek_version=N` (optimistic lock)
    - row count = 0 → silent skip (다음 read 시 자연 재처리)
    - 메트릭 `quant.kek.rotation.lazy_reencrypt_total{from_version,to_version}` 증가
  - [x] TG-P2-04.5 통합 테스트 (Testcontainers MySQL + FakeKmsAdapter):
    - `EnvelopeEncryptionRoundTripSpec` — encrypt → DB 저장 → DB 조회 → decrypt 동등성
    - `LazyReencryptionJobSpec` — kek-v1 row 100건 적재 → KEK 회전 → 잡 1회 실행 → 모든 row가 kek-v2로 갱신
    - `OptimisticLockConcurrencySpec` — 동일 row를 2개 thread가 동시 lazy re-encrypt 시 1건만 성공, 다른 1건 silent skip
    - `MissingKekVersionRejectionSpec` (INV-P2-11) — `kek_version` NULL인 데이터 read 시 예외
  - [x] TG-P2-04.6 SOP 문서 `quant/docs/key-rotation-sop.md` — LocalFile 환경 수동 회전 절차 + OCI Vault 자동 회전 확인 절차 + lazy re-encryption 진행률 모니터링 쿼리
  - [x] TG-P2-04.7 **Verify**: `./gradlew :quant:app:test --tests '*EnvelopeEncryption*' --tests '*LazyReencryption*'` 성공 (Testcontainers 활성)

**Acceptance Criteria**:
- 모든 암호문은 `kek_version` 컬럼 NOT NULL (INV-P2-11)
- lazy re-encryption 잡이 idempotent (재실행 시 추가 변경 0)
- optimistic lock 충돌 시 silent skip + 자연 재시도
- KMS 장애 시에도 cache stale-on-error로 read 가능 (TG-P2-03 검증 재사용)

---

### Task Group TG-P2-05: audit_log 별도 ClickHouse DB 분리 + prev_hash 체인 + Kafka mirror

**Dependencies**: TG-P2-01 (Phase 2 카탈로그)
**Phase**: 2-paper
**Complexity**: L
**Required Skills**: ClickHouse, RBAC, SHA-256 chain, Kafka, 백그라운드 잡

ADR-0026 결정 — `quant_audit` ClickHouse DB 신설 + RBAC 분리 + prev_hash 체인 + Kafka mirror. Phase 1 `audit_log` (MySQL) 는 운영 로그 용도로 유지하되, Phase 2 신규 audit는 ClickHouse `quant_audit.audit_log`로 이관.

- [x] TG-P2-05.0 **Complete**: 신규 audit row insert 시 prev_hash 체인이 정확히 계산되며 nightly 검증 잡이 임의 변조를 검출한다.
  - [x] TG-P2-05.1 ClickHouse DDL `quant/app/src/main/resources/clickhouse/quant_audit/V001__create_database_and_audit_log.sql`:
    - `CREATE DATABASE IF NOT EXISTS quant_audit`
    - `CREATE TABLE quant_audit.audit_log (...)` (spec.md §10.2 스키마, MergeTree, ORDER BY (tenant_id, occurred_at, audit_id))
    - ReplacingMergeTree 등 변경 가능 엔진 사용 금지 — DDL 코멘트로 명시
  - [x] TG-P2-05.2 RBAC 분리 SOP 문서 `quant/docs/audit-rbac-sop.md`:
    - `quant_audit_writer` user — INSERT ONLY (quant 서비스가 사용)
    - `quant_audit_reader` user — SELECT ONLY (검증 잡, 운영자)
    - DBA 권한 escalation 절차 (변조 탐지 후 복구 시 한정)
    - `CREATE USER ... GRANT INSERT ON quant_audit.audit_log` 예시 SQL
  - [x] TG-P2-05.3 `infrastructure/security/audit/AuditLogPublisher.kt`:
    - `suspend fun publish(event: AuditEvent)`
    - 처리: (1) 직전 row hash 조회 (`SELECT current_hash FROM ... ORDER BY occurred_at DESC LIMIT 1`) (2) `current_hash = SHA256(prev_hash || payload_json || occurred_at || actor)` 계산 (3) ClickHouse INSERT (writer user) (4) Outbox에 Kafka mirror 이벤트 append
    - prev_hash 조회는 단일 instance 내 캐시 (Phase 2 single replica 가정 — Phase 3 multi-replica 시 leader pod 전환)
  - [x] TG-P2-05.4 `AuditChainVerifier` (시간당 1회 cron):
    - 직전 1시간 분량 row 순차 replay
    - 각 row의 `current_hash`가 `SHA256(prev_hash || payload_json || ...)` 와 일치 검증
    - invalid 검출 시 `quant.audit.hash_chain.invalid_total` 메트릭 증가 + CRITICAL Telegram 알림 (TG-P2-10 발송)
  - [x] TG-P2-05.5 Kafka mirror 토픽 `quant.audit.v1` — Outbox relay (TG-P2-12) 통해 발행. consumer 격리 저장소 적재는 Phase 3 외부 오픈 시점
  - [x] TG-P2-05.6 통합 테스트 (Testcontainers ClickHouse + Kafka):
    - `AuditLogHashChainAppendSpec` — 연속 5건 insert 시 prev_hash 체인 정확성
    - `AuditLogHashChainTamperDetectionSpec` — 임의 row UPDATE (DBA 권한 시뮬) 시 검증 잡이 invalid 검출
    - `AuditLogDbPermissionSpec` — writer user로 UPDATE 시도 시 권한 거부 (RBAC 검증)
    - `AuditLogKafkaMirrorSpec` — row insert 후 `quant.audit.v1` 토픽에 동일 payload 발행 검증
    - `AuditChainReplayJobSpec` — nightly 잡 1회 실행 시 정상 chain → metric 0
  - [x] TG-P2-05.7 INV-P2-10 강제: prev_hash 컬럼 NULL 거부 — DDL `NOT NULL` + application-level validation
  - [x] TG-P2-05.8 **Verify**: `./gradlew :quant:app:test --tests '*AuditLog*' --tests '*AuditChain*'` 성공 (Testcontainers 활성)

**Acceptance Criteria**:
- ClickHouse DB 명이 `quant_audit` (Phase 1 `quant` 와 분리)
- RBAC 분리 SOP 문서 존재 + 예시 SQL 검증
- prev_hash 체인 무결성 테스트 + 변조 검출 negative path 모두 green
- Kafka mirror 토픽 발행 (Outbox 경유) 검증

---

### Task Group TG-P2-06: 빗썸 WebSocket Public 시세 클라이언트

**Dependencies**: TG-P2-01
**Phase**: 2-paper
**Complexity**: L
**Required Skills**: reactor-netty WebSocketClient, Coroutine Flow, 재연결 백오프

FR-P2-WS — 빗썸 Public WebSocket 구독 + REST 폴백 + 자동 재연결. Phase 1 `MarketDataSubscriber` Port 구현체.

- [x] TG-P2-06.0 **Complete**: Fake WebSocket server 기반 통합 테스트로 정상 수신/끊김 5s 재연결/10s REST 폴백/복구 시 원복 시나리오 모두 green.
  - [x] TG-P2-06.1 `infrastructure/stream/BithumbWebSocketSubscriber.kt`:
    - `MarketDataSubscriber` 구현
    - `reactor-netty` `WebSocketClient` + `awaitX` Coroutine 브릿지
    - `wss://` 연결 + `ticker`/`orderbook`/`transaction` 채널 구독
    - 수신 페이로드 → `Tick(symbol, price, qty, timestamp, source=WS)` 정규화 (INV-P2-08 source 필드 강제)
    - gzip 압축 처리 (빗썸 WS 사양)
    - heartbeat / ping-pong 처리 (idle timeout 시 즉시 재연결)
  - [x] TG-P2-06.2 재연결 정책:
    - 끊김 감지 → 5초 이내 재연결 (지수 백오프 1s → 2s → 5s 상한)
    - 메트릭: `quant.ws.reconnect.attempts_total{exchange,outcome=success|fail}`
  - [x] TG-P2-06.3 `infrastructure/stream/BithumbRestFallbackPoller.kt`:
    - WS 연속 10초 단절 시 자동 활성 (REST 매초 폴링)
    - WS 복구 시 자동 중지
    - 전환/원복 시 `ExchangeConnectionDegraded` / `ExchangeConnectionRestored` 도메인 이벤트 EventPublisher로 발행
  - [x] TG-P2-06.4 메트릭:
    - `quant.ws.connection.state{exchange}` (gauge 0/1/2 = disconnected/fallback/connected)
    - `quant.market.tick.received_total{exchange,symbol,source}` (source ∈ {WS, REST})
    - `quant.market.tick.latency_seconds{exchange,symbol}` (수신 → Hub emit)
  - [x] TG-P2-06.5 lifecycle: `@Component` `@PostConstruct` 시작, `@PreDestroy` graceful close (WS unsubscribe + 연결 종료)
  - [x] TG-P2-06.6 트랜잭션 외부 (ADR-0020): WS 콜백/Hub emit 코드 경로에 `@Transactional` 금지 — 코드 리뷰 체크리스트
  - [x] TG-P2-06.7 통합 테스트 — Fake Bithumb WebSocket Server (Ktor 또는 Java WebSocket Server 기반, TQ-P2-OQ-01 결정에 따라 선택):
    - `BithumbWebSocketSubscriberSpec` — 정상 메시지 수신 → `Tick` 정규화
    - `BithumbWebSocketReconnectSpec` — 5s 이내 재연결 (지수 백오프, virtual time)
    - `BithumbWebSocketFallbackSpec` — 10s 연속 끊김 → REST 폴링 자동 전환, 복구 시 자동 원복, 도메인 이벤트 발행 검증
    - `BithumbWebSocketHeartbeatSpec` — ping-pong / idle timeout
  - [x] TG-P2-06.8 **Verify**: `./gradlew :quant:app:test --tests '*BithumbWebSocket*'` 성공 (실 빗썸 endpoint 호출 0건 — Fake server target)

**Acceptance Criteria**:
- 모든 `Tick` 인스턴스에 `source ∈ {WS, REST}` 필드 존재 (INV-P2-08)
- 5s 재연결 / 10s REST 폴백 / 복구 원복 timing 정확성 virtual time 검증
- 도메인 이벤트 발행 누락 0% (NFR-P2-REL-02)
- WS 콜백 경로에 `@Transactional` 0건 (grep)

---

### Task Group TG-P2-07: MarketDataHub (SharedFlow primary + Kafka fan-out collector)

**Dependencies**: TG-P2-06
**Phase**: 2-paper
**Complexity**: M
**Required Skills**: Kotlin Coroutines, SharedFlow, Turbine

ADR-0025 결정 — `MarketDataHub` SharedFlow primary + 옵셔널 Kafka fan-out collector.

- [x] TG-P2-07.0 **Complete**: 다중 소비자가 동일 tick을 동시 수신 + DROP_OLDEST 정책 검증 + Kafka collector enabled/disabled 분기 검증 모두 green.
  - [x] TG-P2-07.1 `application/market/MarketDataHub.kt`:
    ```kotlin
    @Component
    class MarketDataHub {
        private val flow = MutableSharedFlow<Tick>(
            replay = 0,
            extraBufferCapacity = 256,
            onBufferOverflow = BufferOverflow.DROP_OLDEST,
        )
        fun asFlow(): SharedFlow<Tick> = flow.asSharedFlow()
        fun emit(tick: Tick) { /* tryEmit + drop metric */ }
    }
    ```
  - [x] TG-P2-07.2 `infrastructure/stream/MarketTickKafkaCollector.kt`:
    - `MarketDataHub.asFlow()` 별도 coroutine job collect → `quant.market.tick.bithumb.v1` Kafka 발행
    - `@ConditionalOnProperty(name = "quant.market.kafka-fanout.enabled", havingValue = "true")` (Phase 2 default false)
    - 발행 실패는 hot path에 영향 0% — 별도 coroutine context, 실패 시 메트릭만 증가
  - [x] TG-P2-07.3 메트릭:
    - `quant.market.hub.dropped_total{reason=buffer_overflow}` (counter)
    - `quant.market.hub.subscribers{type}` (gauge — 활성 소비자 수)
    - `quant.market.hub.kafka_publish_failure_total` (collector 활성 시)
  - [x] TG-P2-07.4 단위 테스트 (Turbine + Kotest):
    - `MarketDataHubFanoutSpec` — 다중 구독자 동시 수신 (in-process)
    - `MarketDataHubBufferOverflowSpec` — 느린 소비자 + DROP_OLDEST 시 새 tick 우선, drop 카운터 증가
    - `MarketDataHubKafkaCollectorEnabledSpec` — `kafka-fanout.enabled=true` 시 publish 호출 검증 (MockK Kafka publisher)
    - `MarketDataHubKafkaCollectorDisabledSpec` — default false 시 collector bean 미생성 (no-op)
    - `MarketDataHubBackpressureSpec` — producer 비차단 (`tryEmit` returns true/false)
  - [x] TG-P2-07.5 lifecycle: collector job은 `MarketDataHub` 와 동일 lifecycle (`@PostConstruct` 시작, `@PreDestroy` cancel)
  - [x] TG-P2-07.6 **Verify**: `./gradlew :quant:app:test --tests '*MarketDataHub*'` 성공

**Acceptance Criteria**:
- SharedFlow 설정: `replay=0`, `extraBufferCapacity=256`, `DROP_OLDEST` (OQ-P2-005)
- Kafka collector default disabled (Phase 2)
- 5종 테스트 spec 모두 green

---

### Task Group TG-P2-08: SimulatedExchangeAdapter (페이퍼 모드 가상 체결)

**Dependencies**: TG-P2-04 (V002 마이그레이션 baseline), TG-P2-07
**Phase**: 2-paper
**Complexity**: L
**Required Skills**: Kotlin, ExchangeAdapter Port, JPA, kotest-property

FR-P2-SIM — `PaperExchangeAdapter` + `SlippageModel` Port + `PaperAccount` 가상 잔고. Phase 1 `ExchangeAdapter` Port 구현체.

- [x] TG-P2-08.0 **Complete**: 시장가 매수/매도가 latest tick × (1 ± 0.0005) 가격으로 체결되며 PaperAccount 잔고 격리 검증 green.
  - [x] TG-P2-08.1 `application/port/exchange/SlippageModel.kt` Port:
    ```kotlin
    interface SlippageModel {
        fun apply(tick: Price, side: OrderSide): Price
    }
    ```
  - [x] TG-P2-08.2 `infrastructure/exchange/FixedSlippageModel.kt`:
    - rate = 0.0005 (0.05%, BTC/ETH 메이저 default)
    - 매수: `executedPrice = tick × (1 + 0.0005)`, 매도: `executedPrice = tick × (1 - 0.0005)`
    - configurable: `quant.paper.slippage.rate` 프로퍼티
  - [x] TG-P2-08.3 Flyway `V003__paper_account.sql`:
    - `CREATE TABLE paper_account (paper_account_id BIGINT PK AUTO_INCREMENT, tenant_id VARCHAR(64) NOT NULL, strategy_id BIGINT NOT NULL, base_asset VARCHAR(16) NOT NULL DEFAULT 'KRW', balance DECIMAL(28,8) NOT NULL, created_at DATETIME(6), updated_at DATETIME(6), INDEX idx_paper_account_tenant (tenant_id, strategy_id))`
    - FK strategy_id → split_strategy(id) (논리 FK, 강제 X — 서비스 간 분리 원칙 보존)
  - [x] TG-P2-08.4 `application/paper/port/PaperAccountRepositoryPort.kt` + JPA Adapter (TG-08 Phase 1 패턴 재사용)
  - [x] TG-P2-08.5 `infrastructure/exchange/PaperExchangeAdapter.kt`:
    - `ExchangeAdapter` 구현 (PAPER 모드 전용)
    - `placeOrder(cmd)`:
      1. `MarketDataHub.asFlow()`의 latest tick 조회 (`flow.replayCache` 또는 별도 latest cache)
      2. `SlippageModel.apply(tick, side)` 적용
      3. UUID v7 orderId 생성 (Phase 1 동일)
      4. `exchangeOrderId = "paper-${uuid}"` prefix
      5. PaperAccount 잔고 차감/증가
      6. `OrderFilled` 도메인 이벤트 발행 (Phase 1 EventPublisher)
    - `cancelOrder`, `fetchBalance`, `fetchExecution` 모두 PaperAccount 기반
  - [x] TG-P2-08.6 부분체결 시뮬 인터페이스:
    - `paper.partial-fill.probability` (default 0.0 — Phase 2 비활성)
    - `partial-fill.ratio-min/max` 파라미터 보유
    - 활성화 시 `OrderPartiallyFilled` 이벤트 발행 인터페이스 검증
  - [x] TG-P2-08.7 체결 latency 모델:
    - `paper.execution-latency.ms.default = 50` + jitter ±20ms (NFR-P2-PERF-02 검증용)
    - `delay()` Coroutine으로 시뮬
  - [x] TG-P2-08.8 단위 테스트 (Kotest BehaviorSpec + kotest-property):
    - `PaperExchangeAdapterMarketBuySpec` — 시장가 매수: tick × 1.0005 정확성
    - `PaperExchangeAdapterMarketSellSpec` — 시장가 매도: tick × 0.9995 정확성
    - `SlippageModelPropertySpec` — property: 매수가 ≥ tick, 매도가 ≤ tick (모든 입력)
    - `PaperExchangeAdapterPartialFillSpec` — probability=1.0 강제 시 `OrderPartiallyFilled` 이벤트 발행
    - `PaperAccountIsolationSpec` (INV-P2-09) — PaperAccount 잔고 변경이 ExchangeCredential 잔고와 분리 (Repository 레이어 검증)
    - `OrderIdIdempotencySpec` (Phase 1 INV-06 유지) — 동일 OrderId 2회 호출 시 동일 가상 체결 결과
  - [x] TG-P2-08.9 **Verify**: `./gradlew :quant:app:test --tests '*PaperExchange*' --tests '*SlippageModel*' --tests '*PaperAccount*'` 성공

**Acceptance Criteria**:
- `exchangeOrderId`에 `paper-` prefix 강제 (FR-P2-SIM-05)
- PaperAccount 잔고와 ExchangeCredential 잔고가 동일 row 미참조 (INV-P2-09)
- SlippageModel property 테스트 1000+ 시드 모두 green
- 부분체결 인터페이스/이벤트 경로 검증 (default 비활성, 활성화 시 동작)

---

### Task Group TG-P2-09: ExecutionMode=PAPER UseCase 경로

**Dependencies**: TG-P2-08
**Phase**: 2-paper
**Complexity**: M
**Required Skills**: Spring, UseCase, MockK

FR-P2-USE — Phase 1 `ActivateStrategyUseCase` 분기 + 신규 `StartPaperTradingUseCase` / `StopPaperTradingUseCase` / `GetPaperStatusQuery`.

- [x] TG-P2-09.0 **Complete**: PAPER 모드 활성화 시 `PaperExchangeAdapter` + `MarketDataHub.subscribe(symbol)` 주입 + `StrategyExecutor` 코드 변경 0 검증.
  - [x] TG-P2-09.1 `application/paper/usecase/StartPaperTradingUseCase.kt`:
    - input: `tenantId`, `strategyId`
    - 실행: `ActivateStrategyUseCase` 호출 시 `ExecutionMode = PAPER` 분기 → `PaperExchangeAdapter` 주입 → `MarketDataHub.subscribe(symbol)` 시작 → `StrategyExecutor.run()` 시작 (Coroutine job)
    - PaperAccount 초기 잔고 = 사용자 입력 (default 1000만 KRW)
    - 응답: `runId`
  - [x] TG-P2-09.2 `application/paper/usecase/StopPaperTradingUseCase.kt`:
    - input: `tenantId`, `runId`
    - 실행: `StrategyRun.end(EndReason.Archived)` → MarketDataHub 구독 해제 → Coroutine job cancel
  - [x] TG-P2-09.3 `application/paper/usecase/PausePaperTradingUseCase.kt` / `ResumePaperTradingUseCase.kt`:
    - 일시정지: 시세 구독은 유지, 트리거 평가만 중단 (`StrategyRun.enterAwaitingExhausted()` 재사용 또는 별도 flag)
    - 재개: 즉시 트리거 평가 재개
  - [x] TG-P2-09.4 `application/paper/query/GetPaperStatusQuery.kt`:
    - input: `tenantId`, `runId`
    - 출력: 활성 PAPER 실행 현황 (slot 상태, 누적 PnL, 시작 시각, 현재 잔고)
  - [x] TG-P2-09.5 `StrategyExecutor` / `StrategyEngineLoop` 코드 변경 0 검증 — diff 확인
  - [x] TG-P2-09.6 EndReason 검증: PAPER 모드는 `EndReason ∈ {Liquidated, Paused, Archived}` 만 허용 (Completed 차단)
  - [x] TG-P2-09.7 PAPER 결과는 Phase 1 `BacktestResult` 스키마 재사용 + `executionMode='PAPER'` 필드로 구분 (FR-P2-USE-04)
  - [x] TG-P2-09.8 단위 테스트:
    - `ActivateStrategyPaperModeSpec` — PAPER 모드 활성화 시 PaperExchangeAdapter + MarketDataHub.subscribe 주입 검증
    - `PaperModeEngineReuseSpec` — StrategyExecutor 코드가 BACKTEST/PAPER 양쪽에서 동일 동작
    - `PaperModeEndReasonSpec` — Completed 차단
    - `PaperResultSchemaCompatSpec` — leaderboard 비교 UI 데이터 호환
    - `StartStopPaperTradingHappyPathSpec` — start → status → stop 플로우 1종
    - `PauseResumeIntegrationSpec` — pause 중 시세 구독 유지, resume 시 즉시 트리거 평가 재개
  - [x] TG-P2-09.9 **Verify**: `./gradlew :quant:app:test --tests '*PaperTrading*' --tests '*PaperMode*'` 성공

**Acceptance Criteria**:
- StrategyExecutor / StrategyEngineLoop 코드 diff 0 (Phase 1 그대로)
- PAPER 모드 EndReason 제약 강제 (테스트로 보호)
- BacktestResult 스키마 재사용으로 leaderboard 비교 UI 동일 동작

---

### Task Group TG-P2-10: TelegramBotNotificationSender (우선순위 큐 + per-chat rate limit)

**Dependencies**: TG-P2-04 (KMS unwrap), TG-P2-11 (Redis token bucket — 조건부 의존)
**Phase**: 2-paper
**Complexity**: M
**Required Skills**: Spring WebClient, Coroutine, MockWebServer

FR-P2-NOTIF — Phase 1 stub 대체. Telegram Bot REST API 실 발송 + 우선순위 큐 + per-chat 1 msg/s rate limit.

- [x] TG-P2-10.0 **Complete**: MockWebServer 기반 우선순위 정렬 + per-chat rate limit + 5xx 재시도 backoff + token masking 모두 green.
  - [x] TG-P2-10.1 `application/notification/port/NotificationPriorityQueue.kt`:
    ```kotlin
    enum class NotificationPriority { CRITICAL, RISK, INFO }
    interface NotificationPriorityQueue {
        fun enqueue(event: NotificationEvent, priority: NotificationPriority)
        suspend fun dequeue(): NotificationEvent
    }
    ```
  - [x] TG-P2-10.2 `infrastructure/notification/InMemoryPriorityQueue.kt`:
    - `PriorityBlockingQueue` 또는 `Channel` 기반
    - CRITICAL > RISK > INFO 순 dequeue
    - Phase 2 single replica 가정 — Phase 3 multi-replica 전환 시 Redis 기반 분산 큐 검토
  - [x] TG-P2-10.3 `infrastructure/notification/TelegramBotNotificationSender.kt`:
    - `NotificationSender` 구현 (Phase 1 stub 대체)
    - `WebClient + Coroutine` (suspend)
    - Bot Token: `NotificationTarget.botTokenCipher` → `EnvelopeCryptoCodec.decrypt()` (TG-P2-04) → 사용 후 즉시 폐기 (변수 scope 최소화)
    - 발송 경로: `NotificationEvent → 우선순위 큐 → per-chat 토큰 버킷 (TG-P2-11) → Telegram Bot API HTTP POST`
  - [x] TG-P2-10.4 우선순위 매핑:
    - **CRITICAL**: 긴급 청산 실행, 거래소 인증 실패, 5xx 연속(CB OPEN), audit chain invalid
    - **RISK**: 회차 전 소진(`AWAITING_EXHAUSTED`), Rate Limit 80% 도달, WS 폴백 전환
    - **INFO**: 체결 성공, 슬롯 EMPTY 복귀
  - [x] TG-P2-10.5 재시도/멱등성:
    - 5xx/timeout: exponential backoff 3회 (1s/2s/4s)
    - 최종 실패 시 `audit_log` 기록 (TG-P2-05 publisher 사용) + 메트릭 카운터
    - 멱등키: `notification_event_id` 기반 (ADR-0012 `processed_event` 패턴)
  - [x] TG-P2-10.6 메트릭:
    - `quant.notification.send.latency_seconds{channel=telegram, priority}` (p50/p95)
    - `quant.notification.send.failure_total{channel, reason}`
    - `quant.notification.queue.depth{priority}` (gauge)
  - [x] TG-P2-10.7 단위 테스트 (MockWebServer):
    - `TelegramBotSenderHappyPathSpec` — 정상 메시지 포맷 (parse_mode), HTTP 200 처리
    - `TelegramBotSenderRateLimitSpec` — per-chat 1 msg/s (1초 내 2건 시 두 번째 지연)
    - `TelegramBotSenderPrioritySpec` — CRITICAL > RISK > INFO 순 dequeue 검증
    - `TelegramBotSenderRetryBackoffSpec` — 5xx 3회 재시도 (1s/2s/4s) 후 실패 audit 기록
    - `TelegramBotSenderTokenMaskingSpec` (INV-P2-12) — bot token 평문이 어떤 log/metric/exception에도 노출 0건
    - `TelegramBotSenderIdempotencySpec` (ADR-0012) — notification_event_id 기반 중복 방어
  - [x] TG-P2-10.8 **Verify**: `./gradlew :quant:app:test --tests '*TelegramBot*' --tests '*NotificationPriorityQueue*'` 성공

**Acceptance Criteria**:
- per-chat 1 msg/s 토큰 버킷 (Telegram API 공식 한도 준수)
- 우선순위 정렬 검증 테스트 1+ 시나리오
- bot token masking 검증 (INV-P2-12)
- 멱등키 기반 중복 방어 (ADR-0012)

---

### Task Group TG-P2-11: Resilience (CircuitBreaker / Redis Token Bucket / Kafka DLQ)

**Dependencies**: TG-P2-01, TG-P2-06 (CB 적용 대상), TG-P2-10 (CB telegram-bot)
**Phase**: 2-paper
**Complexity**: M
**Required Skills**: Resilience4j Kotlin, Redis Lua script, Spring Kafka

FR-P2-RES — CircuitBreaker (Bithumb REST/WS/Telegram), Redis token bucket Rate Limiter, Kafka DLQ 활성화.

- [x] TG-P2-11.0 **Complete**: CB OPEN/half-open/CLOSED 전이 + 분산 토큰 버킷 multi-instance 검증 + DLQ 3회 재시도 후 격리 모두 green.
  - [x] TG-P2-11.1 `infrastructure/resilience/CircuitBreakerConfiguration.kt`:
    - Resilience4j `CircuitBreaker` 3종 등록:
      - `bithumb-rest` (REST 폴링/주문조회): 실패율 50% / window=20 / wait=30s
      - `bithumb-ws-reconnect` (WS 재연결): 동일 임계
      - `telegram-bot` (Telegram Bot API): 동일 임계
    - half-open 5회 성공 시 CLOSED 복귀
    - ADR-0015 §1 표준 설정 재사용
  - [x] TG-P2-11.2 적용:
    - TG-P2-06 BithumbRestFallbackPoller / BithumbWebSocketSubscriber 호출에 `bithumb-rest` / `bithumb-ws-reconnect` CB wrap
    - TG-P2-10 TelegramBotNotificationSender 호출에 `telegram-bot` CB wrap
  - [x] TG-P2-11.3 `infrastructure/resilience/RedisTokenBucketRateLimiter.kt`:
    - Redis Lua script로 atomic 토큰 소비/refill
    - 키: `ratelimit:{exchange}:{tenantId}:{apiKeyHash}`
    - 버킷 사이즈/refill rate: 빗썸 공식 한도의 60% (보수적 default — Phase 3에서 OQ-004 확정 후 상향)
  - [x] TG-P2-11.4 Lua script 파일 `quant/app/src/main/resources/lua/token_bucket.lua`:
    - 입력: `KEYS[1]=bucket_key, ARGV[1]=now_ms, ARGV[2]=bucket_size, ARGV[3]=refill_rate, ARGV[4]=tokens_to_consume`
    - 출력: `1=success, 0=throttled` + `remaining_tokens`
  - [x] TG-P2-11.5 80% 도달 시 RISK 알림 enqueue (TG-P2-10), 95% 도달 시 자가 백오프
    - 메트릭 `quant.exchange.ratelimit.usage_ratio{exchange,tenant}` (Phase 1 정의 → 실 측정 활성화)
  - [x] TG-P2-11.6 Kafka DLQ 설정:
    - Spring Kafka `DefaultErrorHandler` + `DeadLetterPublishingRecoverer`
    - 3회 재시도 (1s `FixedBackOff`) → `{원본토픽}.DLT` 전송
    - consumer group: `quant-{purpose}` (예: `quant-notification`, `quant-audit-mirror`)
  - [x] TG-P2-11.7 통합 테스트:
    - `BithumbRestCircuitBreakerSpec` (Resilience4j Kotlin + virtual time) — 50% 실패율 도달 시 OPEN, 30s 후 half-open, 5회 성공 시 CLOSED
    - `TelegramCircuitBreakerSpec` — 동일 임계, half-open 실패 시 재 OPEN
    - `RedisTokenBucketSpec` (Testcontainers Redis) — Lua script 토큰 소비/refill 정확성
    - `RedisTokenBucketDistributedSpec` — 2개 인스턴스 동시 호출 시 합산 한도 준수
    - `KafkaConsumerDlqSpec` (Testcontainers Kafka) — 3회 재시도 후 `.DLT` 격리, retry 횟수 메트릭
  - [x] TG-P2-11.8 **Verify**: `./gradlew :quant:app:test --tests '*CircuitBreaker*' --tests '*TokenBucket*' --tests '*KafkaConsumerDlq*'` 성공 (Testcontainers 활성)

**Acceptance Criteria**:
- CB 3종 모두 ADR-0015 §1 표준 설정 적용
- Redis token bucket 분산 multi-instance 합산 한도 검증 (테스트 1+ 시나리오)
- DLQ 잔량 0% 메트릭 노출 (NFR-P2-REL-04)

---

### Task Group TG-P2-12: Outbox → Kafka relay 활성화 (Phase 1 placeholder 제거)

**Dependencies**: TG-P2-11 (DLQ)
**Phase**: 2-paper
**Complexity**: M
**Required Skills**: Spring Kafka, Outbox pattern, ADR-0012

Phase 1 알려진 제약 #3 해소 — `OutboxRelay` payload deserialization 구현 + 실 Kafka publish + idempotent consumer.

- [x] TG-P2-12.0 **Complete**: 미발행 row polling → 실 Kafka publish → published_at 마킹 + 멱등 consumer 중복 방어 검증 green.
  - [x] TG-P2-12.1 `infrastructure/outbox/EventPayloadCodec.kt` — 이벤트 type별 JSON serialize/deserialize registry:
    - `StrategyActivated`, `StrategyLiquidated`, `OrderFilled`, `OrderPartiallyFilled`, `TrancheSlotOpened`, `TrancheSlotClosed`, `ExchangeConnectionDegraded`, `ExchangeConnectionRestored`, `RiskLimitBreached`, `EmergencyLiquidationTriggered`, `AuditEvent` 등
    - Phase 1 Outbox는 log-only였으므로 신규 구현
  - [x] TG-P2-12.2 Phase 1 `OutboxRelay.kt` 리팩토링:
    - placeholder 제거 (log-only → 실 publish)
    - 처리 흐름:
      1. `published_at IS NULL` row polling (1s 간격, ADR-0015 §5)
      2. `EventPayloadCodec` registry에서 event type lookup → JSON deserialize → Kafka publish
      3. publish ack 수신 시 `UPDATE outbox SET published_at = NOW() WHERE id = ?`
      4. publish 실패 시 `published_at` 미세팅 → 다음 polling 재시도
      5. 3회 실패 누적 row는 `failure_count` 컬럼 증가, 임계 초과 시 운영 알림
  - [x] TG-P2-12.3 Flyway `V004__outbox_failure_count.sql`:
    - `ALTER TABLE outbox ADD COLUMN failure_count INT NOT NULL DEFAULT 0`
    - 인덱스 `idx_outbox_pending_failure (published_at, failure_count)` (polling 최적화)
  - [x] TG-P2-12.4 컨슈머 측 멱등성 (ADR-0012):
    - Phase 1 `processed_event(event_id PK, processed_at)` 테이블 활용
    - 적용 컨슈머: Telegram worker (TG-P2-10), audit mirror consumer (TG-P2-05), 향후 FE SSE collector
    - `IdempotentEventConsumer` 헬퍼 클래스 — 처리 전 `processed_event` lookup, 신규만 처리
  - [x] TG-P2-12.5 메트릭:
    - `quant.outbox.publish.latency_seconds{event_type}` (timer)
    - `quant.outbox.publish.failure_total{event_type, reason}` (counter)
    - `quant.outbox.pending_rows` (gauge — Phase 1 정의 유지)
  - [x] TG-P2-12.6 통합 테스트 (Testcontainers MySQL + Kafka):
    - `OutboxKafkaRelaySpec` — 미발행 row polling → publish → published_at 마킹 + payload deserialization 정확성
    - `OutboxRelayFailureRecoverySpec` — publish 실패 시 published_at 미세팅, 다음 polling 재시도, failure_count 증가
    - `IdempotentConsumerSpec` — 동일 event_id 2회 consume 시 1회만 처리
  - [x] TG-P2-12.7 **Verify**: `./gradlew :quant:app:test --tests '*Outbox*' --tests '*IdempotentConsumer*'` 성공 (Testcontainers 활성)

**Acceptance Criteria**:
- Phase 1 알려진 제약 #3 해소 (payload deserialization 구현)
- 멱등 consumer 적용 컨슈머 3종 이상
- failure_count 임계 초과 시 운영 알림 경로 (TG-P2-10 RISK)
- DLQ 통합 (TG-P2-11) — 3회 실패 후 격리

---

### Task Group TG-P2-13: SSE API + Gateway 모듈 변경 (long-lived routing)

**Dependencies**: TG-P2-09, TG-P2-07
**Phase**: 2-paper
**Complexity**: L
**Required Skills**: Spring MVC SseEmitter, Spring Cloud Gateway, JWT, reactor-netty

FR-P2-FE — SSE 컨트롤러 + Gateway long-lived 라우팅 활성화 + first-message JWT 인증.

- [x] TG-P2-13.0 **Complete**: SSE 연결 → first-message JWT → tick/slot/order 이벤트 수신 + Gateway 경유 라우팅 검증 green.
  - [x] TG-P2-13.1 `presentation/paper/PaperStreamSseController.kt`:
    - `GET /api/v1/strategies/{id}/paper/sse`
    - `SseEmitter` 또는 Coroutine `Flow<ServerSentEvent<*>>` (Spring MVC suspend 컨트롤러 호환)
    - 가상 스레드 위에서 long-lived 연결 유지
    - 이벤트 type: `tick`, `slot`, `order` (spec.md §12.2)
    - 데이터 source: `MarketDataHub.asFlow()` filter by symbol + 도메인 이벤트 EventBus subscribe
  - [x] TG-P2-13.2 first-message JWT 인증 (spec.md §12.2 확정):
    - 클라이언트가 SSE 연결 후 첫 message로 `{"type":"auth","token":"<jwt>"}` 전송
    - 서버가 JWT 검증 후 `auth-ok` 또는 `auth-fail` 응답
    - 실패 시 즉시 연결 종료
    - 30초 내 인증 미완료 시 자동 종료
  - [x] TG-P2-13.3 `presentation/paper/PaperTradingController.kt`:
    - `POST /api/v1/strategies/{id}/start-paper` (FR-P2-USE-01)
    - `GET /api/v1/strategies/{id}/paper/status`
    - `POST /api/v1/strategies/{id}/paper/pause` / `/resume`
    - `GET /api/v1/paper/snapshot/{strategyId}` (FE 초기 hydrate, slot + 최근 체결 50건)
    - 모두 `ApiResponse<T>` 래퍼 (Phase 1 컨벤션) — SSE 컨트롤러 제외
  - [x] TG-P2-13.4 Gateway 변경:
    - `gateway/src/main/resources/application.yml` 라우트 정의: SSE 경로 `/api/v1/strategies/*/paper/sse` `httpClient.responseTimeout` 비활성 (또는 1h 이상 override)
    - `gateway/src/main/kotlin/com/kgd/gateway/config/SseRouteConfig.kt` (필요 시) — Reactor Netty `keepAlive` enable, `Cache-Control: no-cache` / `X-Accel-Buffering: no` 응답 헤더 통과 검증
    - HTTP/1.1 chunked 응답 buffering 차단 검증
  - [x] TG-P2-13.5 회귀 테스트:
    - `SsePaperStreamControllerSpec` (Spring MockMvc 또는 WebTestClient) — SSE 연결 + first-message JWT + 이벤트 수신
    - `SseFirstMessageAuthSpec` — JWT 미전송 30초 후 자동 종료
    - `SseFirstMessageAuthFailSpec` — invalid JWT 시 즉시 종료
    - `PaperTradingControllerSpec` — start/status/pause/resume happy path + 403(다른 tenant) + 400(invalid)
    - `GatewaySseRoutingSpec` (gateway 모듈 테스트) — 기존 short-lived REST 라우팅 영향 0
  - [x] TG-P2-13.6 폴백: 클라이언트 SSE 끊김/미지원 시 `polling 2s` (`/api/v1/strategies/{id}/paper/status` 재호출) — FE에서 처리, 백엔드 변경 무
  - [x] TG-P2-13.7 **Verify**: `./gradlew :quant:app:test --tests '*PaperStream*' --tests '*PaperTradingController*' :gateway:test --tests '*SseRouting*'` 성공

**Acceptance Criteria**:
- SSE 컨트롤러가 first-message JWT 인증 강제 (30s timeout)
- Gateway SSE 라우트가 long-lived 연결 안정 라우팅 (httpClient.responseTimeout disable)
- 기존 REST 라우팅 회귀 0 (gateway 테스트로 보호)
- 모든 비-SSE 응답이 `ApiResponse<T>` 래퍼

---

### Task Group TG-P2-14: FE 페이퍼 트레이딩 모니터링 페이지

**Dependencies**: TG-P2-13
**Phase**: 2-paper
**Complexity**: M
**Required Skills**: React, TypeScript, EventSource, lightweight-charts, Vitest

FR-P2-FE — `quant/frontend/src/pages/PaperTradingMonitorPage.tsx` 신규 페이지 + EventSource 클라이언트 + 실시간 가격/체결/PnL 표시.

- [x] TG-P2-14.0 **Complete**: `cd quant/frontend && npm run build && npm run test` 성공 + 로컬 dev 서버에서 SSE 실시간 갱신 확인.
  - [x] TG-P2-14.1 `quant/frontend/src/pages/PaperTradingMonitorPage.tsx`:
    - 진입 경로: 전략 상세 페이지 → "PAPER 모니터링" 버튼
    - 거래쌍별 패널: 현재가 (큰 폰트, 변동 highlight), 최근 체결 N건 타임라인, 호가 흐름 (best bid/ask), 활성 회차 슬롯 상태 (EMPTY/PENDING_BUY/FILLED 색상)
    - 가상 체결 타임라인 (회차별 색상 분기)
    - 활성 전략 카드 (누적 PnL, 회차 회전률)
  - [x] TG-P2-14.2 `quant/frontend/src/api/sse/paperStream.ts`:
    - EventSource 클라이언트 + first-message JWT 인증 (spec.md §12.2)
    - 재연결: 5s exponential backoff
    - 폴백: SSE 끊김/미지원 시 2s polling (`/api/v1/strategies/{id}/paper/status`)
    - 이벤트 핸들러: `tick`, `slot`, `order`
  - [x] TG-P2-14.3 `quant/frontend/src/hooks/usePaperStream.ts`:
    - 초기 hydrate: REST `GET /api/v1/paper/snapshot/{strategyId}`
    - 이후 SSE delta로 갱신
    - 다중 거래쌍 분기 (탭 전환 시 SSE 구독 격리)
  - [x] TG-P2-14.4 `quant/frontend/src/components/paper/`:
    - `RealtimePricePanel.tsx` — 현재가 + 변동 highlight
    - `OrderBookFlow.tsx` — best bid/ask
    - `PaperExecutionTimeline.tsx` — 가상 체결 타임라인 (회차별 색상)
    - `TrancheSlotGrid.tsx` — 활성 회차 슬롯 상태 표시
  - [x] TG-P2-14.5 lightweight-charts 실시간 갱신 — Phase 1 차트 컴포넌트 재사용 + tick 이벤트로 series.update() 호출
  - [x] TG-P2-14.6 디자인 가드 (재사용): Phase 1 PWA 셸 / Tailwind / Pretendard / lightweight-charts. 모바일 우선, 세로 레이아웃. `docs/conventions/frontend-design.md` 준수
  - [x] TG-P2-14.7 라우트 등록 — `/strategies/:id/paper/monitor` 추가
  - [x] TG-P2-14.8 Vitest + React Testing Library + EventSource mock 테스트:
    - `PaperTradingMonitorPageSpec` — 초기 hydrate (REST snapshot) → SSE delta 갱신 합산
    - `PaperStreamHookSpec` — EventSource 재연결 5s exponential backoff, error 핸들링
    - `RealtimePricePanelSpec` — 가격 변동 highlight, 모바일 레이아웃
    - `PaperExecutionTimelineSpec` — 회차별 색상 분기
    - `MultiSymbolTabsSpec` — 탭 전환 시 SSE 구독 격리 (정상 unsubscribe)
  - [x] TG-P2-14.9 **Verify**: `cd quant/frontend && npm run build && npm run test` 성공

**Acceptance Criteria**:
- 모바일 우선 (Phase 1 §12 PWA 유지) — 터치 친화 인터랙션
- EventSource polyfill (jsdom 기본 미지원) — `event-source-polyfill` 또는 동등
- Vitest 커버리지 ≥ 70% (test-quality.md §5)
- SSE 끊김 시 2s polling 폴백 동작

---

### Task Group TG-P2-15: K8s overlay 변경 (k3s-lite + prod-k8s)

**Dependencies**: TG-P2-03 (KMS 환경변수), TG-P2-12 (Outbox enable), TG-P2-13 (gateway)
**Phase**: 2-paper
**Complexity**: M
**Required Skills**: Kubernetes, kustomize, Jib

ADR-0019 + spec.md §15 — k3s-lite/prod-k8s overlay 변경. `strategy.type=Recreate` 강제 (replicas=1), KMS 환경변수, Redis 활성화 확인, Kafka 토픽 자동 생성 정책.

- [x] TG-P2-15.0 **Complete**: `kubectl apply -k k8s/overlays/k3s-lite` + quant Pod Ready + `/actuator/health` UP + SSE 라우팅 확인.
  - [x] TG-P2-15.1 k3s-lite overlay (`k8s/overlays/k3s-lite/quant/`):
    - `deployment.yaml`: `strategy.type=Recreate` 명시 (replicas=1 강제, rolling update 시 일시적 replicas=2 차단)
    - ConfigMap: `quant.outbox.kafka-relay.enabled=true`, `quant.market.kafka-fanout.enabled=false`, `quant.security.kms.provider=local`
    - Secret: `QUANT_LOCAL_KEK` (hex 64 chars, dev시 `.env` 기반 — `application-local.yml`은 `.gitignore`)
    - Redis 활성 확인 (Phase 1 standalone 재사용, Rate Limiter 키 추가만)
    - Kafka 토픽 자동 생성 정책 — `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true` (k3s-lite single broker)
    - Telegram 자격: `NotificationTarget` DB 등록 (런타임 입력) — Secret 직접 주입 X
  - [x] TG-P2-15.2 prod-k8s overlay (`k8s/overlays/prod-k8s/quant/`):
    - `deployment.yaml`: `strategy.type=Recreate` (Phase 2 single replica 가정 보호)
    - Secret: OCI Vault 자격증명 — `OCI_TENANCY`, `OCI_USER`, `OCI_FINGERPRINT`, `OCI_PRIVATE_KEY` (Secret), `OCI_REGION`, `OCI_VAULT_KEY_OCID` (ConfigMap)
    - ClickHouse `quant_audit` DB writer/reader user Secret 분리 (TG-P2-05 RBAC SOP 준수)
    - HPA 유지 (Phase 1 동일 CPU 70%) — Phase 2는 staging/dev 한정 운영 권장 (NFR-P2-DEP-01)
    - Ingress (gateway 경유) — SSE 라우트 활성화 (gateway 변경 PR 의존 — TG-P2-13)
  - [x] TG-P2-15.3 Jib 이미지 빌드 — `./gradlew :quant:app:jibBuildTar` → tar 산출 → `scripts/image-import.sh --all` 에 포함
  - [x] TG-P2-15.4 Kafka 토픽 사전 생성 (k3s-lite/prod-k8s 공통):
    - `quant.market.tick.bithumb.v1` (옵셔널, fanout enable 시)
    - `quant.audit.v1`
    - `quant.outbox.events.v1` (또는 이벤트 type별 토픽)
    - DLQ 토픽 자동 생성: `*.DLT` suffix
  - [x] TG-P2-15.5 회귀 검증:
    - 기존 short-lived REST 라우팅 영향 0 (TG-P2-13 gateway 테스트 재실행)
    - `kubectl rollout status deployment/quant-app -n quant` 성공
    - `/actuator/prometheus` 에서 Phase 2 신규 메트릭 노출 확인
  - [x] TG-P2-15.6 SOP 문서 업데이트:
    - `quant/docs/k8s-deployment.md` — k3s-lite/prod-k8s overlay 변경점 + Recreate 전환 이유 (Phase 2 single replica)
    - `quant/docs/oci-vault-setup.md` (TG-P2-03 P2.1) 와 cross-reference
  - [x] TG-P2-15.7 **Verify**:
    - `kubectl apply -k k8s/overlays/k3s-lite` + `kubectl rollout status deployment/quant-app -n quant` 성공
    - `kubectl logs deployment/quant-app -n quant | grep "Outbox.*kafka-relay.*enabled"` 확인
    - `curl http://gateway:8080/api/v1/strategies/1/paper/sse` (테스트 JWT) → SSE 연결 확립

**Acceptance Criteria**:
- k3s-lite/prod-k8s 모두 `strategy.type=Recreate` 명시
- KMS provider 분기 동작 (k3s-lite=local, prod-k8s=oci)
- Outbox Kafka relay enabled (Phase 1 disabled 상태 → 활성)
- Phase 3 multi-replica 전환 시 ADR-0025 §Consequences leader pod 선출 패턴 도입 예고 (문서 코멘트)

---

### Task Group TG-P2-16: Phase 2 통합 E2E + Readiness Checklist

**Dependencies**: TG-P2-05, TG-P2-09, TG-P2-10, TG-P2-12, TG-P2-13, TG-P2-14, TG-P2-15
**Phase**: 2-paper
**Complexity**: L
**Required Skills**: Testcontainers, E2E, 통합 검증, k6/Gatling (SLO)

Phase 2 종단 시나리오 — 실 시세 수신 (Fake WS) → 페이퍼 체결 → Telegram → audit chain 검증 → FE SSE → 메트릭 노출 + Phase 2 readiness checklist + 릴리즈 노트.

- [x] TG-P2-16.0 **Complete**: E2E 통합 테스트 green + Readiness Checklist 모두 통과 + 릴리즈 노트 발행.
  - [x] TG-P2-16.1 `QuantPhase2E2ESpec` (Testcontainers MySQL + ClickHouse + Redis + Kafka + Fake Bithumb WS server):
    1. `TestDataSeeder` — Phase 1 BACKTEST 결과 baseline 1건 적재
    2. `POST /api/v1/strategies/{id}/start-paper` 로 PAPER 모드 활성화
    3. Fake WS 서버에서 시나리오 시세 (정상 → 끊김 10s → 복구) 송신
    4. 검증:
       - 회차별 가상 체결 발생 + PaperAccount 잔고 변경
       - `ExchangeConnectionDegraded` / `Restored` 이벤트 발행
       - Outbox → Kafka 발행 (`OrderFilled` 등)
       - audit_log row 생성 + prev_hash 체인 정확성 + Kafka mirror 발행
       - Telegram 알림 (mock receiver) — 우선순위 정렬 검증
       - FE SSE 실시간 갱신 (WebTestClient 또는 SseEmitter mock)
    5. 종료: `/actuator/prometheus` 에서 §6.9 Phase 2 메트릭 모두 노출 확인
  - [x] TG-P2-16.2 결정론 baseline 비교 — Phase 1 BACKTEST 결과 vs Phase 2 PAPER 결과 격차 측정 (slippage 0.05% 적용된 PnL diff 정량화)
  - [x] TG-P2-16.3 SLO 회귀 (nightly 태그):
    - **틱 → 평가 → 가상 체결 SLO** (NFR-P2-PERF-02): k6 또는 Gatling으로 100 TPS tick 주입, p95 ≤ 500ms 회귀 보호
    - **Telegram 발송 SLO** (NFR-P2-PERF-04): mock receiver 부하, p95 ≤ 2s
    - **WebSocket 복구** (NFR-P2-REL-01/02): 끊김 주입 후 5s/10s timing 측정
  - [x] TG-P2-16.4 보안 negative path (nightly 태그):
    - audit chain tamper detection (TG-P2-05 검증 잡 1회 실행)
    - KEK fallback (KMS 장애 시 cache stale-on-error 동작)
    - bot token masking 회귀 (Phase 1 `SensitiveDataMaskingSpec` 확장)
  - [x] TG-P2-16.5 Readiness Checklist 문서 `quant/docs/phase2-readiness.md`:
    - [ ] 모든 Phase 2 TG 완료
    - [ ] `./gradlew :quant:domain:test :quant:app:test` 성공
    - [ ] `./gradlew :quant:app:test --tests '*Phase2E2ESpec*'` 성공
    - [ ] `kubectl apply -k k8s/overlays/k3s-lite` quant Ready
    - [ ] SSE 연결 안정 (Gateway 라우팅 검증)
    - [ ] Telegram 실 발송 1회 수동 확인 (BotFather 등록된 chat 대상)
    - [ ] OCI Vault 운영 환경 구축 완료 (또는 LocalFile→KMS 마이그레이션 SOP 통과)
    - [ ] audit chain 검증 잡 nightly 운영 1주 무사고
    - [ ] DLQ 잔량 0% 유지 메트릭 확보
    - [ ] Phase 2 신규 메트릭 (`§6.9` 10종) 모두 Grafana 대시보드 노출
    - [ ] Phase 1 회귀 0 (Phase 1 골든셋 3종 green 유지)
    - [ ] Preflight P2.0 OQ-011 closed (Phase 3 진입 전 필수)
  - [x] TG-P2-16.6 릴리즈 노트 `docs/specs/2026-04-26-quant-phase2-paper-trading/phase2-release-notes.md`:
    - 구현된 FR/NFR 목록 (FR-P2-WS / HUB / SIM / USE / NOTIF / RES / SEC / FE / OBS)
    - 알려진 제약 (Phase 3 이관 항목)
    - Phase 3 Preflight 후보 (OQ-011 closed, OQ-012 손실 한도, OQ-013 kill-switch, OQ-019 정량 게이트)
    - ADR-0025/0026/0027 발행 PR 링크
  - [x] TG-P2-16.7 ADR 발행 검증:
    - ADR-0024 Errata (TG-P2-02) 적용 확인
    - ADR-0025 (MarketDataHub) Status Proposed → Accepted 전환 검토
    - ADR-0026 (Audit Immutability) 동일
    - ADR-0027 (KEK Management) 동일
  - [x] TG-P2-16.8 **Verify**:
    - `./gradlew :quant:app:test --tests '*Phase2E2ESpec*'` 성공
    - Readiness Checklist 전 항목 수동 체크
    - 릴리즈 노트 PR 머지

**Acceptance Criteria**:
- E2E 시나리오가 통합 테스트 1본으로 재현 가능
- Phase 1 BACKTEST 결과 vs Phase 2 PAPER 결과 격차 정량화 (slippage 영향)
- Readiness Checklist 모든 항목이 objective하게 측정 가능
- Phase 3 진입을 위한 Preflight 목록 명시

---

## Execution Order

Preflight (P2.1만 closed 필수, P2.0은 Phase 3 진입 전) 후 TG 의존성:

```
Preflight P2.1 (OCI Vault), P2.0 (OQ-011 — Phase 3 진입 전)
        │
        ▼
      TG-P2-01 (Library 카탈로그)
        │
        ├─► TG-P2-02 (ADR-0024 Errata)            [docs/주석 정정]
        │
        ├─► TG-P2-03 (KMS Port + Adapter 3종)     [Preflight P2.1 의존]
        │     │
        │     └─► TG-P2-04 (Envelope Encryption + V002)
        │             │
        │             └─► TG-P2-10 (Telegram Sender — KMS unwrap 의존)
        │
        ├─► TG-P2-05 (audit_log ClickHouse 분리 + chain + Kafka mirror)
        │     │
        │     └─► TG-P2-12 (Outbox Kafka relay — audit Kafka mirror 의존)
        │
        ├─► TG-P2-06 (Bithumb WebSocket Subscriber)
        │     │
        │     ├─► TG-P2-07 (MarketDataHub)
        │     │     │
        │     │     └─► TG-P2-08 (PaperExchangeAdapter — Hub latest tick 의존)
        │     │             │
        │     │             └─► TG-P2-09 (PAPER UseCase 경로)
        │     │                     │
        │     │                     └─► TG-P2-13 (SSE API + Gateway)
        │     │                             │
        │     │                             └─► TG-P2-14 (FE 모니터링 페이지)
        │     │
        │     └─► TG-P2-11 (Resilience — CB/RL/DLQ — Bithumb WS/REST 의존)
        │             │
        │             └─► TG-P2-12 (Outbox — DLQ 의존)
        │
        └─► TG-P2-15 (K8s overlay — TG-P2-03/12/13 의존)
                │
                └─► TG-P2-16 (Phase 2 E2E + Readiness — 모든 TG 의존)
```

병렬화 가이드:
- **Wave 1** (TG-P2-01 후): TG-P2-02 (Errata), TG-P2-03 (KMS), TG-P2-05 (audit), TG-P2-06 (WebSocket) 동시 진행 가능
- **Wave 2** (Wave 1 후): TG-P2-04 (V002 마이그레이션), TG-P2-07 (Hub), TG-P2-11 (Resilience) 동시
- **Wave 3** (Wave 2 후): TG-P2-08 (PaperExchange), TG-P2-10 (Telegram), TG-P2-12 (Outbox) 동시
- **Wave 4** (Wave 3 후): TG-P2-09 (PAPER UseCase), TG-P2-13 (SSE+Gateway) 동시
- **Wave 5** (Wave 4 후): TG-P2-14 (FE), TG-P2-15 (K8s overlay) 동시
- **Wave 6** (모든 TG 후): TG-P2-16 (E2E + Readiness)

**Critical path**: P2.1 → TG-P2-01 → TG-P2-03 → TG-P2-04 → TG-P2-10 → TG-P2-13 → TG-P2-15 → TG-P2-16 (≈ 5–6주, 엔지니어 1명 기준)

---

## Out of Scope for Phase 2 (Phase 3 이관 대상)

본 tasks.md는 Phase 2 (페이퍼 트레이딩) 구현만 포괄한다. 다음 항목은 본 문서에서 명시적으로 제외하며, Phase 3 spec 사이클에서 별도 TG로 재구성한다.

### Phase 3 — 실매매 착수 시 TG 재구성 대상

**거래소 어댑터 (실 매매)**:
- `BithumbExchangeAdapter` 실주문/취소/조회 실 구현 (`AbstractJwtBasedExchangeAdapter` 베이스 상속, ADR-0024 Errata 패턴 적용)
- `UpbitExchangeAdapter` 신규 (동일 베이스 클래스 재사용)
- 실매매 멱등키 보강 (Phase 2 `paper-` prefix → 실 거래소 orderId 매핑)
- 주문 reconcile 절차 (OQ-014)
- 빗썸/업비트 공식 Rate Limit 상수 확정 (OQ-004)

**리스크 관리**:
- 글로벌 kill-switch (전 테넌트 일괄 중지) (OQ-013)
- 유저별 손실 한도 정의 + 강제 (OQ-012)
- 페이퍼 → 실매매 정량 승격 게이트 (OQ-019)
- 긴급 청산 실 실행 (Phase 1 `ExecuteLiquidationUseCase` no-op stub → 실 구현)

**보안 강화**:
- 실매매 2FA Role + step-up auth (OQ-016)
- NetworkPolicy / mTLS (서비스 간) (OQ-015)
- WORM 스토리지 (S3 Object Lock) — Phase 3+ 외부 오픈 시점
- KEK 회전 주기 단축 (1년 → 90일 검토, OQ-P2-001 default)

**관측성/배포**:
- prod-k8s overlay 정식화 (Phase 2는 staging/dev 한정 — NFR-P2-DEP-01)
- Multi-replica 전환 + leader pod 선출 패턴 (ADR-0025 §Consequences)
- HPA p95 latency 기반 (Prometheus Adapter 도입 후)

**기능 확장**:
- 분할 원칙 1·3·4 포트폴리오 차원 (Phase 1 §15.1 유지)
- 공개 리더보드 (외부 SaaS 상용화)
- WebSocket 양방향 FE 연결 (Phase 2는 SSE 단방향)
- volume-weighted / 정규분포 slippage 모델 (Phase 3 실 체결 데이터 calibration 후)
- ATR 동적 간격 %, 고점 대비 -x% 대기 최초 진입 옵션
- 이메일 알림, 웹/모바일 푸시 (Phase 4+)

---

## Summary

- **Total Task Groups**: 16 (+ Preflight 2: P2.0, P2.1)
- **Total Checkbox sub-tasks**: 약 175개 (각 TG.N Verify 포함)
- **Phase 2 예상 기간**: 5–6주 (엔지니어 1명 기준, P2.1 closed 가정)
- **Critical path**: P2.1 → TG-P2-01 → TG-P2-03 → TG-P2-04 → TG-P2-10 → TG-P2-13 → TG-P2-15 → TG-P2-16
- **Parallelizable**: Wave 1~5 각각 2~4개 TG 동시 진행 가능 (Execution Order 참조)
- **신규 ADR**: ADR-0024 Errata, ADR-0025 (MarketDataHub), ADR-0026 (Audit Immutability), ADR-0027 (KEK Management) — Plan 단계 발행
- **Out-of-scope 합의**: Phase 3 항목은 별도 spec 사이클로 관리 (kill-switch, 손실 한도, 2FA, NetworkPolicy, 업비트 어댑터 등)

Phase 2 완료 = TG-P2-16 Readiness Checklist 전 항목 green + ADR-0025/0026/0027 Status `Proposed → Accepted` 전환 PR 머지 + Phase 1 회귀 0 유지.
