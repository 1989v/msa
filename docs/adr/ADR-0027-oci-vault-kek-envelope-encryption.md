# ADR-0027 OCI Vault KEK envelope encryption + Port 추상화

## Status
Proposed

> 루트 `docs/adr/`에 두는 이유: Quant Phase 2 크레덴셜 보호 결정이지만 향후 모든 서비스(member/auth/gifticon 등)의 비밀 저장 표준이 될 envelope encryption + KMS Port 패턴.

## Context

ADR-0024 §8에서 거래소 API Key/텔레그램 Bot Token을 **AES-GCM 봉투 암호화**로 저장하기로 결정했지만, **운영 KEK(Key Encryption Key) 보관 위치와 회전 정책**은 후속 ADR로 미뤄졌다. Phase 2 페이퍼 트레이딩 시점에서 거래소 read-only API Key가 실제 저장되기 시작하므로 본 ADR에서 결정한다.

- 단독 운영 환경(OCI Always Free Tier 위주, k3s-lite + 24GB ARM VM)
- 자체 호스팅(HashiCorp Vault 등)은 메모리/운영 부담
- 미래 멀티 클라우드/타 KMS 마이그레이션 가능성
- 입력 스펙: `docs/specs/2026-04-24-quant-crypto-trading/planning/phase-2/spec.md` §9 (KMS 설계)
- 기반 ADR: ADR-0024 §8 (envelope encryption 도입 결정)

## Decision

### 1. 운영 KEK 보관: OCI Vault Service
- **OCI Vault** Always Free Tier 사용 (HSM 백엔드, encrypt/decrypt API 제공)
- 자동 회전: 1년 주기, lazy re-encryption (OCI 기본 정책)
- 감사 로그: OCI Audit 자동 수집
- 클러스터 리소스 부담 0 (관리형)

### 2. 로컬 dev KEK: LocalFileKmsAdapter
- 로컬 개발 환경은 OCI 호출하지 않음 — 개발자별 독립 KEK
- KEK 로드 우선순위: `SEVEN_SPLIT_LOCAL_KEK` 환경변수 → `application-local.yml` (gitignore 처리)
- 32-byte hex 인코딩, 개발자 본인만 보유 (공유 금지)
- 프로덕션 KEK와 분리되어 개발 데이터로 운영 데이터를 복호 불가

### 3. Port 추상화: `KeyManagementService`
```
domain/port:  KeyManagementService { encryptDek(plain): bytes; decryptDek(cipher): bytes }
infra/oci:    OciVaultKmsAdapter   (profile=oci/prod)
infra/local:  LocalFileKmsAdapter  (profile=local)
infra/test:   FakeKmsAdapter       (테스트용 in-memory)
```
- 미래 GCP KMS / AWS KMS / HashiCorp Vault 마이그레이션 = 어댑터 추가만으로 가능
- domain 레이어는 OCI SDK 의존성 0 (Clean Architecture, ADR-0024 §2)

### 4. Envelope encryption 흐름
- **저장**:
  1. 신규 DEK(Data Encryption Key, 32-byte) 생성
  2. 평문(API Key 등)을 DEK + AES-256-GCM으로 암호화
  3. DEK를 KMS(`encryptDek`)로 봉투 암호화
  4. DB 저장: `(ciphertext, encrypted_dek, iv, tag, dek_version)`
- **조회**:
  1. DB에서 `(ciphertext, encrypted_dek, ...)` SELECT
  2. `encrypted_dek` → KMS(`decryptDek`) → DEK 평문 (메모리)
  3. DEK + AES-256-GCM으로 ciphertext 복호 → 평문

### 5. DEK 메모리 캐시
- 동일 DEK를 짧은 시간 내 다회 사용하는 경우(예: WS 재연결) KMS 호출 폭증 방지
- TTL 30분, 캐시 키 = `dek_id` (`Caffeine` cache)
- 메모리 dump 위험 vs KMS 호출 비용 trade-off — 30분은 표준 KMS 가이드 수준

### 6. 회전 정책
| 키 | 주기 | 방식 |
|---|---|---|
| KEK (OCI Vault) | 1년 | OCI 자동 + 사고 시 즉시 수동 |
| DEK | 90일 또는 신규 데이터 저장 시 | 신규 DEK 발급, 기존 데이터는 lazy re-encryption 백그라운드 잡 |

- KEK 회전 시 기존 `encrypted_dek`는 OCI Vault가 multi-version 관리 → 자동 호환
- DEK 회전 백그라운드 잡은 운영 영향 최소화를 위해 batch + rate limit

## Alternatives Considered

- **HashiCorp Vault self-host (k3s pod)**: 24GB ARM VM에 +512MB~1GB 부담, unseal/백업/HA 운영 부담, 1인 운용 비현실적
- **K8s Sealed Secrets**: KEK가 application 메모리에 평문 상주, envelope encryption 정석이 아니며 회전/감사 빈약
- **마스터 패스워드 부팅 시 입력**: 자동 복구 불가, pod crash 시 수동 개입 필수, 무인 운영 불가능
- **AWS KMS / GCP KMS**: 비용 발생 + 별도 클라우드 계정 필요. OCI 호스팅 정책과 단일 클라우드 단순화 우선
- **DB 컬럼 단순 AES (KMS 없음)**: KEK가 application config에 상주 → 사실상 평문, 회전·감사 부재

## Consequences

**긍정적:**
- 클러스터 리소스 부담 0 (관리형 KMS)
- 자동 회전 + 자동 감사 로그 (OCI Vault 표준 기능)
- Port 추상화로 클라우드 종속 위험 완화 (어댑터 교체로 마이그레이션)
- Always Free Tier로 비용 0

**부정적/주의:**
- OCI Vault 종속 — Port 추상화로 완화하나 운영 SOP는 OCI 특화
- KMS 호출 latency 존재 — DEK 메모리 캐시(TTL 30분)로 거래 hot path 영향 무시 가능 (시간당 수 회 KEK decrypt)
- OCI Vault 장애 시 신규 DEK 생성/캐시 미스 시점에 영향 → 재시도 + CircuitBreaker (ADR-0015 패턴 준용)
- 로컬 dev KEK가 `application-local.yml`에 노출되면 git 유출 위험 → `.gitignore` 강제 + pre-commit 스캔 필수
- 메모리 캐시된 DEK는 heap dump 노출 가능 → core dump 비활성, JVM flag 검토
- **OCI Vault 장애 graceful degradation 정책**:
  - DEK 캐시 TTL 30분 유지 + **stale-on-error 허용** — OCI Vault 호출 실패 시 만료된 DEK도 임시 사용 (응답 없음보다 낫음)
  - 동시에 CRITICAL 알림 (Telegram) 발송: "OCI Vault unavailable, running with stale DEK"
  - 30분 추가 grace period 후에도 복구 안 되면 → PAPER 거래 자동 일시정지 (Phase 3 실매매는 즉시 정지 정책으로 강화 예정)
  - 복구 감지 시 자동 재개 + INFO 알림

**후속 ADR 후보:**
- KEK 회전 자동화 SOP (OCI Audit 알람 + DEK lazy re-encrypt 잡 운영)
- DEK rotation 백그라운드 잡 표준 (rate limit, batch 크기, 진행 상황 모니터링)
- 멀티 클라우드 마이그레이션 시 KMS Port 어댑터 추가 가이드
