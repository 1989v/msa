---
parent: 8-system-design
seq: 16
title: 결제 멱등성 시스템 (Order + Payment + 재시도) — System Design Card
type: scenario-card
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
catalog-row: "§3 시나리오 카드"
---

# 16. 결제 멱등성 시스템 — Order + Payment + 재시도 안전성

> Tier 1 시스템. 05-payment-system.md 가 결제 시스템 전반을 다뤘다면, 본 카드는 **멱등성 한 축에 집중** — Idempotency-Key, Outbox, Saga, PG 응답 분기, 한국 PG 사 차이까지.
> 0% double-charge 가 SLA (Service Level Agreement, 서비스 수준 협약). 이중 결제 1건 발생 시 사고로 분류된다.

---

## 1. Functional Requirements

1. **Idempotency-Key 처리** — 동일 키 100회 요청 = 1회 처리, 같은 응답 반환
2. **Order ↔ Payment 분산 트랜잭션** — Saga (choreography or orchestration)
3. **PG (Payment Gateway, 결제 게이트웨이) 응답 처리** — Success / Fail / **Timeout** 3-way 분기
4. **Outbox pattern** — DB 트랜잭션과 Kafka 발행 atomic 보장
5. **Retry policy** — exp backoff + jitter, key 수명 동안 안전
6. **State machine 강제** — PENDING → APPROVED 외 transition 차단
7. **부분취소 / 환불** — 멱등 (같은 refund_id 두 번 = 1회)
8. **장기 미정산 (PENDING > N분) 자동 reconciliation** — PG 조회로 강제 확정

### Out of scope

- PG 자체 구현 (외부 위임)
- 카드사 직연동 (VAN / 카드 직승인)
- KYC / AML

---

## 2. NFR (Non-Functional Requirements)

| 항목 | 목표 | 비고 |
|---|---|---|
| Write QPS (Queries Per Second, 초당 쿼리 수) | 평균 60 / 피크 300 | DAU 1천만 × 평균 0.5 결제 |
| **결제 P99 latency** | **< 500ms** (PG 호출 포함 시 < 3s) | Tier 1 SLA |
| 조회 P99 | < 100ms | 결제 후 사용자 확인 |
| **Double-charge rate** | **0%** | 산업 절대 SLA |
| Availability | 99.99% | 매출 직결 |
| Durability | 영구 (10년+) | 법적 의무 (한국 전자상거래법) |
| Idempotency-Key 수명 | 24h | 재시도 충분 윈도우 |
| Reconciliation lag | < 24h | D+1 정산 표준 |
| Auditability | 모든 거래 immutable | 회계 / 분쟁 |

### Capacity / Sizing

```
DAU 1천만 × 0.5 결제 = 5M 결제/day
QPS 평균 = 5M / 86400 ≈ 58, 피크 ×5 = 290

idempotency-key 보존 (Redis):
  24h × 5M / day = 5M key
  key size = 64 byte (UUID) + 결과 캐시 1KB = 5GB

Outbox table 보존:
  발행 후 7일 (재발행 윈도우) → 5M × 7 × 1KB = 35GB
  archive 후 영구 (S3 cold)
```

---

## 3. High-Level Architecture

```
┌────────┐  Idempotency-Key: uuid     ┌──────────────┐
│ Client │───────────────────────────►│  Order API   │
└────────┘  POST /orders               └──────┬───────┘
                                              │ (1) Order tx (status=CREATED)
                                              │     + Outbox row (event=order.created)
                                              ▼
                                       ┌─────────────┐
                                       │  Order DB   │
                                       └──────┬──────┘
                                              │ Outbox poller (CDC / polling)
                                              ▼
                                       ┌─────────────┐
                                       │   Kafka     │
                                       │ order.events│
                                       └──────┬──────┘
                                              │
                                       ┌──────▼──────────┐
                                       │ Payment Service │
                                       └────────┬────────┘
                                                │
              ┌─────────────────────────────────┼─────────────────┐
              │ (2) Idempotency check           │                 │
              ▼                                 ▼                 ▼
      ┌─────────────┐                  ┌───────────────┐  ┌───────────────┐
      │  Redis      │                  │  Payment DB   │  │   PG Adapter  │
      │ idempo:{k}  │                  │ payments      │  │ Toss/KCP/Stripe│
      │  SETNX 24h  │                  │  (UNIQUE k)   │  │  Idempotency-K│
      └─────────────┘                  └───────┬───────┘  └───────────────┘
                                               │ Outbox
                                               ▼
                                        Kafka payment.events
                                               │
                              ┌────────────────┴───────────────┐
                              ▼                                ▼
                       Order Service                    Notification / Audit
                       (CONFIRM 상태 전이)
```

3 layer idempotency:
1. **Redis SETNX** (fast reject)
2. **DB UNIQUE constraint** (durable defense)
3. **PG 자체 idempotency_key** (외부 보호막)

---

## 4. Core Components

| 컴포넌트 | 역할 | 기술 선택 | 비고 |
|---|---|---|---|
| API GW | Idempotency-Key header 검증 + rate limit | Spring Cloud Gateway | header 강제 |
| Order Service | 주문 상태 머신 + Outbox | Spring Boot + JPA | tx 안에 Outbox row 동시 insert |
| Payment Service | 멱등 결제 처리 + Saga 참여 | Spring Boot | Idempotency 3중 |
| Outbox Poller | DB → Kafka 발행 | Debezium CDC (Change Data Capture) or polling | exactly-once 보장 |
| Redis | idempotency 캐시 + 결과 store | Redis 7 (cluster 권장) | TTL 24h |
| Payment DB | payments + idempotency_key UNIQUE | MySQL 8 + InnoDB | strict consistency |
| Ledger | 복식부기 append-only | 별도 DB / 같은 cluster 다른 schema | 감사 |
| PG Adapter | 멀티 PG 추상화 | Strategy pattern + CircuitBreaker | Toss / KCP / Stripe / NICE |
| Reconciliation Job | D+1 PG 대사 + 미정산 강제 확정 | Spring @Scheduled | 새벽 3시 |
| Saga Orchestrator (선택) | 복잡 결제 (할부 / 다결제) | Camunda / 자체 | choreography 와 trade-off |

---

## 5. Data Model

### 5-1. Idempotency layer

```sql
CREATE TABLE idempotency_records (
    idempotency_key  VARCHAR(64)  PRIMARY KEY,        -- client UUID
    request_hash     CHAR(64)     NOT NULL,            -- SHA-256(body) — 같은 키 다른 body 거부
    status           VARCHAR(16)  NOT NULL,            -- PROCESSING / COMPLETED / FAILED
    response_body    TEXT,                              -- 완료된 응답 그대로
    payment_id       VARCHAR(36),
    created_at       DATETIME(3)  NOT NULL,
    completed_at     DATETIME(3),
    INDEX idx_created (created_at)                       -- 24h cleanup
);
```

규칙:
- 같은 key + 다른 request_hash → **422 Unprocessable** (재사용 시도)
- 같은 key + 같은 request_hash → **stored response 반환** (멱등)
- status=PROCESSING 인 경우 → **409 Conflict 또는 polling 안내**

### 5-2. Payment 상태 머신

```
                        ┌────────────────┐
                        │    INITIATED   │  (Idempotency 통과 직후)
                        └───────┬────────┘
                                │
                                ▼
                        ┌────────────────┐
                        │     PENDING    │  (PG 호출 중)
                        └─┬──────┬───┬───┘
                          │      │   │
              ┌───────────┘      │   └─────────────┐
              ▼                  ▼                 ▼
       ┌──────────┐       ┌──────────┐       ┌──────────────┐
       │ APPROVED │       │  FAILED  │       │   TIMEOUT    │ ★ 재확인 필요
       └────┬─────┘       └──────────┘       └──────┬───────┘
            │                                       │
            ▼                                       │ reconcile job
     ┌────────────┐                                 ▼
     │ CANCELLED  │ ─── refund ──►   REFUNDED   APPROVED or FAILED
     └────────────┘                              (확정)
```

`TIMEOUT` 은 절대 자동 FAILED 처리 X — 5분 후 PG 조회로 확정 (05-payment-system §7 동일 원칙).

### 5-3. Outbox 패턴

```sql
CREATE TABLE outbox_events (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    aggregate_type  VARCHAR(64),       -- 'Order' / 'Payment'
    aggregate_id    VARCHAR(36),
    event_type      VARCHAR(64),       -- 'order.created'
    payload         JSON NOT NULL,
    headers         JSON,              -- traceId, idempotencyKey
    created_at      DATETIME(3),
    published_at    DATETIME(3),       -- NULL = 미발행
    INDEX idx_unpublished (published_at, id)
);
```

Order 트랜잭션 내에서:
```sql
BEGIN;
  INSERT INTO orders (...) VALUES (...);
  INSERT INTO outbox_events (...) VALUES (...);
COMMIT;
```

Outbox poller 가 `published_at IS NULL` 폴링 (또는 Debezium CDC) → Kafka 발행 → `published_at` 업데이트.

**왜 dual-write 안 함?**: DB commit 직후 Kafka send 실패 시 → 이벤트 손실. Outbox 는 같은 트랜잭션이라 atomic.

### 5-4. payments 테이블

```sql
CREATE TABLE payments (
    id                BIGINT PRIMARY KEY AUTO_INCREMENT,
    payment_id        VARCHAR(36)  NOT NULL UNIQUE,
    idempotency_key   VARCHAR(64)  NOT NULL UNIQUE,    -- ★ 핵심 방어
    order_id          VARCHAR(36)  NOT NULL,
    user_id           VARCHAR(36)  NOT NULL,
    amount            DECIMAL(20,4) NOT NULL,
    currency          CHAR(3)      NOT NULL,
    status            VARCHAR(16)  NOT NULL,
    pg_provider       VARCHAR(32),
    pg_transaction_id VARCHAR(64),
    pg_idempotency_key VARCHAR(64),   -- PG 사 별도 키
    request_hash      CHAR(64)     NOT NULL,
    created_at        DATETIME(3),
    updated_at        DATETIME(3)
);
```

---

## 6. Critical Decisions

### 6-1. **State Machine: 어디서 강제하나?**

| 옵션 | 설명 | 트레이드오프 |
|---|---|---|
| Application 레벨 (if/else) | 코드에서 if 검증 | 누락 위험, race condition |
| Domain 객체 메서드 | `payment.approve()` 가 INVALID 시 throw | 단일 인스턴스 OK, 분산 race 미해결 |
| **DB 레벨 (CAS update) ★** | `UPDATE ... WHERE status='PENDING'` | rows affected 0 = race detect |
| Event sourcing | event log 만 append | 복잡도 ↑ |

**선택**: **Domain 메서드 + DB CAS** 2중.
- Kotlin domain class 가 transition 검증 (msa 의 `Order.cancel()` 패턴)
- repository 가 `UPDATE WHERE status = ?expected` → 0 rows = `ConcurrentModificationException` throw
- Optimistic locking (version 컬럼) 도 가능하지만 status 자체로 충분

### 6-2. **Retry window: Idempotency-Key 수명**

| 옵션 | 동작 | 위험 |
|---|---|---|
| 5분 | 짧은 retry only | 사용자가 폰 잠그고 1시간 후 재시도 → 중복 결제 |
| **24h ★** | 일반 표준 | Redis 메모리 +20%, OK |
| 7일 | 장기간 retry | 비즈니스적으로 의미 없음 (사용자가 7일 후 같은 의도 X) |
| 영구 | append-only | 메모리/스토리지 폭발 |

**선택**: **24h** + 만료 후 새 키 사용.
- 클라이언트가 24h 후 같은 key 로 시도 → 새 결제로 처리 (서버 입장에서 새 의도로 간주)
- Stripe / Toss 도 24h 표준

### 6-3. **Choreography vs Orchestration (Saga)**

| 옵션 | 장점 | 단점 |
|---|---|---|
| **Choreography ★** (이벤트 chain) | 결합도 ↓, 단순 | 가시성 ↓, 디버깅 어려움 |
| Orchestration (중앙 코디네이터) | 가시성 ↑, 흐름 명확 | SPOF, 결합도 ↑ |

**선택**: **Choreography 기본** + 복잡 케이스 (할부 / 다결제 / 부분 환불 chain) 만 Camunda BPMN.
- Order → Payment → Inventory → Shipping 4-step 은 choreography
- 환불 chain (Refund → Ledger reverse → Notification → Audit) 은 5-step 이상이라 orchestration 고려
- 본 msa 는 currently choreography 만 사용

### 6-4. **PG Timeout 처리 — 가장 위험한 분기**

```kotlin
val pgResponse: PgResponse = try {
    circuitBreaker.executeSupplier { pgClient.charge(req) }
} catch (e: CallNotPermittedException) {
    // CB OPEN — 다른 PG 라우팅 또는 PENDING 적재
    return Pending("CB_OPEN", scheduleRetry = true)
} catch (e: TimeoutException) {
    // ★ 가장 위험 — PG 에 실제 통과했을 수 있음
    return Pending("TIMEOUT", scheduleRetry = false, requireReconcile = true)
} catch (e: HttpServerErrorException) {
    return Pending("PG_5XX", scheduleRetry = true)
} catch (e: Exception) {
    // 기타 — bug 일 가능성 → DLQ + alert
    log.error(e) { "Unexpected PG exception" }
    return Pending("UNKNOWN", scheduleRetry = false)
}

return when (pgResponse.code) {
    "00" -> Approved(pgResponse.txId)
    in failureCodes -> Failed(pgResponse.code)
    else -> Pending("UNKNOWN_CODE_${pgResponse.code}", requireReconcile = true)
}
```

**원칙**: 모르는 응답은 **무조건 PENDING** + reconcile. 자동 FAILED 절대 X.

### 6-5. **Outbox 발행 방식: Polling vs CDC (Change Data Capture)**

| 옵션 | latency | 운영 복잡도 |
|---|---|---|
| **Polling (1s) ★** | 1-2s | 낮음 |
| Debezium CDC | < 100ms | 높음 (Connect cluster) |
| Logical replication 직접 | 가장 빠름 | 가장 복잡 |

**선택**: **Polling 1초** 기본 + 트래픽 증가 시 Debezium 으로 전환.
- 1초 lag 는 결제 UX 에 거의 영향 없음 (사용자 redirect 화면에 stale)
- Debezium 은 별도 운영 부담 + Connect cluster 필요

### 6-6. **Multi-PG 라우팅 전략**

| 전략 | 동작 | 사용처 |
|---|---|---|
| **Active-active load balance** | 트래픽 분산 | PG 사별 수수료 차이 / capacity 분산 |
| **Active-passive failover** | 1 PG fail → 다른 PG | 신뢰성 우선 |
| User segment 기반 | 카드사별 우대 PG | 한국 — 카드사 별 승인율 차이 |
| Amount 기반 | 소액 ↔ 대액 PG | 수수료 최적화 |

**선택**: **Hybrid** — 카드사 segment + amount + active-passive failover.
- 1차 시도 실패 시 다른 PG 자동 retry (idempotency-key 다름!) → 2차 PG 결제 성공 시 1차 reconcile 필요

---

## 7. Failure Modes

| 장애 | 영향 | 대응 |
|---|---|---|
| **PG timeout** | 이중결제 위험 | PENDING + 5분 후 reconcile, 절대 자동 FAILED 안함 |
| **Network partition** (client ↔ server) | 클라가 응답 못 받음 → 재시도 | Idempotency-Key 로 1회 처리, 같은 응답 반환 |
| **DB commit 후 Kafka 발행 실패** | 이벤트 손실 → Order 상태 안 바뀜 | Outbox pattern 으로 atomic |
| **Redis 다운** | idempotency 1차 방어 무력 | DB UNIQUE 로 fallback |
| **DB 다운** | 결제 불가 | read-only mode + retry queue + alert |
| **PG 단일 장애** | 결제 전체 마비 | CircuitBreaker + 다른 PG 라우팅 |
| **이중 PG 호출** (1차 timeout, 2차 시도) | 진짜 이중결제 | reconcile 시 발견 → 자동 환불 + 사용자 사과 |
| **Saga 보상 실패** | 일관성 깨짐 | DLQ + 운영자 alert + 보상도 idempotent |
| **Clock skew** | 만료 / 타임아웃 잘못 판단 | NTP 강제 + server time 만 사용 |
| **Long PENDING** (> 30분) | 사용자 혼란 | 자동 reconcile job + 사용자 알림 |
| **request_hash mismatch** | 같은 키 다른 body | 422 거부 + 클라 버그 alert |
| **Replay attack** (key 탈취) | 부정 결제 | request 서명 (HMAC) + key TTL 24h |

---

## 8. Scaling Path

### Phase 1 — 단일 PG, 단일 DB (DAU < 10만)

```
[Client] → [Order/Payment monolith] → [MySQL] → [Single PG]
```
- Idempotency 는 DB UNIQUE 만
- Outbox polling 5초
- 단일 region

### Phase 2 — Order/Payment 분리 + Redis (DAU 100만)

```
[Order Service] ──Kafka──► [Payment Service] ──► [PG Adapter]
       │                          │
       └──► [Outbox]               └──► [Redis idempo]
```
- Choreography Saga 도입
- 멀티 PG 시작 (2-3 PG)
- Reconciliation 일별

### Phase 3 — 다중 region + Multi-PG (DAU 1천만)

```
[Region KR] [Region JP]
   │           │
   └─ payment ─┤
       │       │
   Multi-PG (Toss, KCP, NICE, Stripe global)
       │
   Global ledger (single source)
```
- region active-active (사용자 가까운 region 결제)
- ledger 는 single source (정산 일원화)
- failover < 30s

### Phase 4 — Saga Orchestrator + Event Sourcing

- 복잡 결제 (할부, 정기결제, 부분 환불 chain) → Camunda
- 일부 도메인 event sourcing (audit 강화)
- Spanner-like 분산 SQL (TiDB / CockroachDB) 검토

---

## 9. Observability

### 핵심 metric

| metric | 임계값 | 알람 |
|---|---|---|
| `payment.p99.latency.ms` | > 500 (excl. PG) | warning |
| `payment.success.rate` | < 99% | critical |
| `payment.timeout.count` | spike > 2σ | warning |
| `payment.duplicate.detected` | > 0 | **critical** (이중결제 의심) |
| `outbox.unpublished.count` | > 1000 | warning |
| `outbox.publish.lag.seconds` | > 10 | warning |
| `idempotency.hash.mismatch` | > 0 | warning (클라 버그) |
| `saga.compensation.failure` | > 0 | critical |
| `pg.circuit.breaker.state` | OPEN | warning |
| `reconciliation.discrepancy` | > 0 | critical |
| `pending.over.30min.count` | > 10 | warning |

### 분산 트레이싱

- traceId 가 client → API → Kafka → Payment → PG 전 구간 propagate
- OTel (OpenTelemetry, 오픈 텔레메트리) baggage: `idempotency_key`, `order_id`, `payment_id`
- PG 호출 span 은 별도 (외부 시간 분리)

### 감사 로그

- 모든 status transition 은 immutable log (별도 audit DB / S3 WORM)
- 7년 보존 (한국 전자상거래법)
- 운영자 dashboard 에서 payment_id 별 timeline 조회

---

## 10. 면접 트랩

### Trap 1 — "Idempotency-Key 만 있으면 충분하지 않나요?"

**Reality**:
- Redis 다운 시 무력 → DB UNIQUE 필수
- DB 다운 시 PG 자체 키로 보호
- **3중 방어 (Redis + DB + PG)** 가 산업 표준

### Trap 2 — "Outbox 안 쓰고 그냥 Kafka send 하면?"

**Reality**:
- DB commit 성공 + Kafka send 실패 → Order 만 생기고 Payment 트리거 안 됨
- 사용자에게 결제 화면 떴는데 결제 시도 안 됨 → 분실
- Outbox 는 같은 tx 내 row insert → atomic guarantee

### Trap 3 — "TIMEOUT 을 FAILED 로 처리하면 안 되나요?"

**Reality**: **절대 X.** 가장 흔한 사고.
- PG 가 실제 승인했을 수 있음 → 클라 retry → 이중결제
- 반드시 PENDING + reconcile

### Trap 4 — "Saga 보상이 실패하면?"

**Reality**:
- 보상도 idempotent (재시도 안전)
- N회 재시도 후 DLQ → 운영자 수동 처리
- "보상의 보상" 은 일반적으로 만들지 않음 (eventually 운영자)

### Trap 5 — "한국 PG 사 (KCP / Toss / NICE / Inicis) 차이?"

**Reality**:

| PG | 특징 | Idempotency 정책 |
|---|---|---|
| **Toss Payments** | 신생 + 개발자 친화 | `Idempotency-Key` header 표준, 24h |
| **KCP** | 전통 PG, 카드 다양 | `ordrIdxx` (가맹점 주문번호) 기반 unique, 명시적 idempotency 약함 — 자체 관리 필수 |
| **NICE Pay** | 카드사 호환성 강 | 가맹점 거래번호 unique 만, retry 시 자체 검증 |
| **Inicis** | 쇼핑몰 PG 1세대 | 거래번호 unique, idempotency key 별도 X |
| **Stripe (해외)** | 글로벌 표준 | `Idempotency-Key` header 24h, 가장 깔끔 |

**핵심**: 한국 PG 는 idempotency-key 표준 약함 → **가맹점 주문번호 (orderId / merchantTradeId) 가 사실상 idempotency key** → 우리가 unique 강제해야 함.

### Trap 6 — "분산 트랜잭션은 그냥 2PC 쓰면?"

**Reality**:
- 2PC (Two-Phase Commit, 2단계 커밋) 는 PG 사가 지원 안 함 (외부 system)
- 가용성 폭락 (모든 참여자 lock)
- Saga 가 사실상 유일한 선택지

### Trap 7 — "request_hash 왜 필요?"

**Reality**:
- 같은 key + 다른 amount/orderId → 클라 버그 또는 공격
- "재시도" 로 위장한 새 요청 거부 → 422 Unprocessable
- 보안 + 데이터 정합성 동시 보호

### Trap 8 — "PENDING 무한 적체"

**Reality**:
- PG 가 응답 안 주면 PENDING 영구 → 사용자 혼란 + 자금 묶임
- 30분 cron + reconcile + 자동 확정 (PG 조회 결과 기반)
- 사용자에게 "처리 중" → "확정" / "환불" 명확히 알림

### Trap 9 — "이중결제 1건 발생했는데 어쩌죠?"

**Reality**:
- 즉시 자동 환불 (1건은 보존, 1건은 cancel)
- 사용자에게 사과 푸시 + 보상 (쿠폰)
- 사후 RCA (Root Cause Analysis) → 어디서 idempotency 깨졌는지
- 보통 클라 SDK 가 key 재생성한 케이스 또는 multi-PG 라우팅 race

### Trap 10 — "Outbox 레코드가 무한 쌓이면?"

**Reality**:
- 발행 후 7일 보존 → archive (S3 cold) → delete
- 별도 cleanup job
- 발행 실패 row 는 alert + 운영자 수동 재발행

### Trap 11 — "분산 lock 으로 idempotency 풀면?"

**Reality**:
- Redis distributed lock 은 critical section 에 사용 가능하지만 idempotency 와는 다름
- lock 해제 후 다시 들어오면 다시 처리됨 → 멱등 보장 X
- Lock 은 "동시 실행 방지", Idempotency 는 "결과 일관성" → 별개
- 결제는 후자가 필수

---

## 11. msa 코드 grounding

본 msa 의 **order + payment** 가 정확히 이 패턴:

- `order/domain` — `Order` aggregate, status transition 강제 (`Order.cancel()` 만 PENDING 가능)
- `order/app` — Outbox 패턴 (ADR (Architecture Decision Record, 아키텍처 결정 기록) 기반)
- `payment` (가설 / TODO) — Idempotency 3중 + Saga 참여
- ADR-0012 (멱등성) — Kafka consumer 중복 처리 방어
- ADR-0015 (resilience) — CircuitBreaker, DLQ, Rate Limiting, CQRS
- ADR-0029 (idempotent consumer) — `event_id` dedupe in consumer
- `docs/conventions/idempotent-consumer.md` — 실천 가이드
- `docs/conventions/transactional-usage.md` — 외부 IO 분리 (PG 호출은 tx 밖)
- `docs/conventions/entity-mutation.md` — 부분 update 캡슐화 (status transition)

---

## 12. 30초 면접 요약

> "결제 멱등성은 0% double-charge 가 절대 SLA. 핵심은 (1) 3중 idempotency — Redis SETNX (fast reject) + DB UNIQUE (durable) + PG 자체 key (외부 보호), (2) Outbox pattern 으로 DB tx 와 Kafka 발행 atomic, (3) Choreography Saga + 모든 단계 idempotent — 보상 호출도 안전하게 재실행, (4) PG TIMEOUT 은 절대 자동 FAILED 처리 X — PENDING + 5분 후 reconcile, (5) 상태 머신은 Domain 메서드 + DB CAS 2중 강제, (6) Idempotency-Key 는 24h TTL + request_hash 검증으로 같은 키 다른 body 거부, (7) 한국 PG (KCP/NICE/Inicis) 는 idempotency-key 표준 약함 — 가맹점 주문번호로 자체 강제 필요. msa 의 order/payment 가 이 패턴 그대로."

---

## 부록 A. 흔한 함정

1. **TIMEOUT 자동 FAILED** — 가장 큰 사고, 이중결제 직결
2. **Idempotency-Key 안 쓰고 retry** — 네트워크 에러 시 중복결제
3. **dual-write (DB + Kafka)** — 한쪽 실패 시 inconsistency → Outbox 필수
4. **request_hash 무시** — 같은 key 다른 body 통과 → 보안 + 정합성 깨짐
5. **PG 단일** — 장애 시 전체 마비, multi-PG + CB 필요
6. **2PC 시도** — 가용성 폭락, Saga 가 정답
7. **Saga 보상 non-idempotent** — 재시도 시 over-compensation
8. **state machine application 만** — race condition → DB CAS 필수
9. **PENDING 무한 적체** — 자동 reconcile job 없으면 자금 묶임
10. **분산 lock = idempotency** 오해 — 별개, idempotency 는 결과 일관성
11. **Outbox cleanup 미운영** — 무한 적체, 운영 부담
12. **ledger 없이 잔액 컬럼 직접 update** — race + audit 불가
