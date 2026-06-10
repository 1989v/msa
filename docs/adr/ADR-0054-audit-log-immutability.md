# ADR-0054 audit_log 불변성 + ClickHouse RBAC 분리

## Status
Proposed

> 루트 `docs/adr/`에 두는 이유: Quant Phase 2 감사 로그 정책이지만 향후 모든 금융/민감 도메인에서 재사용될 불변 감사 로그 패턴.

## Context

Quant Phase 2 부터는 페이퍼 트레이딩이라도 **사용자 의사결정/시스템 액션/크레덴셜 접근**이 발생한다. Phase 3 실매매에 대비해 **위변조 불가능한(tamper-evident) 감사 로그**가 필요하다.

- 단순 application log는 운영자가 파일 시스템에서 임의 수정 가능
- 동일 RDBMS의 일반 테이블은 서비스 계정 권한으로 UPDATE/DELETE 가능 → tamper 가능
- Phase 1에서 ClickHouse 인프라가 이미 구축됨 (analytics 공유 노드, `quant` DB) — 추가 인프라 없이 감사 스토리지로 활용 가능
- 입력 스펙: `docs/specs/2026-04-24-quant-crypto-trading/planning/phase-2/spec.md` §10 (audit_log 정책)
- 기반 ADR: ADR-0024 §12 (ClickHouse `quant` DB 신설)

## Decision

### 1. 별도 ClickHouse DB 신설
- `quant_audit` DB를 신규 생성 (Phase 1 `quant` DB와 완전 격리)
- 동일 ClickHouse 클러스터 인프라 재사용, **데이터베이스/권한 경계로만 분리**
- 초기 테이블: `quant_audit.audit_log`, `quant_audit.credential_access_log`

### 2. ClickHouse RBAC 분리
| User | 대상 | 권한 |
|---|---|---|
| `quant` (서비스 계정) | `quant_audit.*` | **INSERT ONLY** (UPDATE/DELETE 거부) |
| `quant_audit_reader` (감사 조회용) | `quant_audit.*` | **SELECT ONLY** |
| `quant_audit_admin` (운영자 직접 보유) | `quant_audit.*` | ALL (긴급 변경 시만 수동 사용) |

- 서비스 계정이 도용되어도 과거 audit 레코드 위변조 불가 (구조적 차단)
- admin user 사용은 별도 운영 SOP로 통제 + 자체 audit (KMS access log 활용)

### 3. prev_hash 체인
- 각 audit_log 레코드에 `prev_hash CHAR(64)` 컬럼 (직전 레코드의 SHA-256)
- 해시 입력: `(id, timestamp, actor, action, payload_json, prev_hash_of_previous_row)`
- 검증 SQL 스크립트(`scripts/quant/verify-audit-chain.sql`)로 임의 시점 무결성 확인
- 누군가 단일 레코드를 수정하면 chain break 즉시 감지

### 4. Kafka mirror topic (재해 복구용)
- 토픽: `quant.audit.v1` (compacted=false, retention=90일)
- ClickHouse INSERT 가 primary write, Kafka mirror 는 best-effort (실패 허용). Phase 3+ 에서 ETL 일관성 강화 시 Kafka primary + ClickHouse 다운스트림으로 역전 가능.

### 5. 스키마 (개략)
- `id UInt64` (auto-increment 또는 snowflake), `timestamp DateTime64(3)`, `actor_user_id String`, `actor_role String`, `action String` (enum-like), `resource_type String`, `resource_id String`, `payload JSON String`, `prev_hash FixedString(64)`, `hash FixedString(64)`
- ENGINE: `MergeTree` ORDER BY `(timestamp, id)` — append-only 적합

### 6. 동시성 처리
- prev_hash 계산 = INSERT 시 직전 레코드 SELECT 필요 → race condition 가능
- 해결: **단일 publisher 패턴** — `AuditLogWriter` Spring bean이 in-process queue로 직렬화 (Phase 2 = replicas=1 환경 전제, ADR-0025와 동일 가정)
- Phase 3+ 다중 인스턴스 환경에서는 sequence 서비스 또는 leader election 후속 ADR

## Alternatives Considered

- **단일 DB 권한만 분리(prev_hash 없음)**: 운영자(admin)가 INSERT/UPDATE 권한으로 과거 레코드 위변조 시 탐지 수단 없음
- **prev_hash 없이 timestamp 정렬만**: 직전 레코드 위변조 후 hash 재계산 가능 (체인이 없으면 끊을 일도 없음)
- **S3 Object Lock (WORM)**: 인프라 추가 + 비용, 1인 운용 단계에서 과함. Phase 4+ 영구 아카이빙 시 재검토
- **별도 RDBMS replica + read-only**: 인프라 추가, ClickHouse 인프라 재사용 못함, 시계열 분석 부적합
- **PostgreSQL row-level security만**: 동일 DBMS 안에서 권한 우회 위협 존재, 격리도 약함

## Consequences

**긍정적:**
- tamper 탐지(hash chain) + tamper 방지(RBAC) 이중 방어
- 신규 인프라 0 — Phase 1 ClickHouse 클러스터 재사용
- Kafka mirror로 재해 복구 옵션 확보

**부정적/주의:**
- prev_hash 계산 시 직전 레코드 SELECT 필요 → 단일 writer 직렬화 비용 (Phase 2 replicas=1 전제로 수용)
- Kafka mirror 발행 실패 시 갭 발생 가능 — Phase 2 는 best-effort 정책 (실패 허용) 으로 수용. Phase 3+ ETL 단일화 시점에 Kafka primary 로 역전하여 일관성 강화
- ClickHouse `MergeTree`는 엄밀히 말해 mutation API로 삭제 가능 — RBAC로만 차단되므로 admin 계정 보호가 핵심
- 회계/규제 대응 시 ClickHouse 단독으로는 불충분할 수 있음 (Phase 4+ S3 WORM 검토)

**후속 ADR 후보:**
- ClickHouse → S3 Object Lock (WORM) 영구 아카이빙 (Phase 4+ 또는 외부 SaaS 오픈 시)
- 다중 인스턴스 환경에서의 audit writer 직렬화 (sequence 서비스 / leader election)
- 감사 로그 검색/조회 UI (admin 백오피스) 표준
