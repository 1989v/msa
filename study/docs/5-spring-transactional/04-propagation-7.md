---
parent: 5-spring-transactional
seq: 04
title: 7가지 전파 속성 전수 (REQUIRED / REQUIRES_NEW / NESTED 등)
type: deep
created: 2026-05-01
---

# 04. 7가지 전파 속성 전수

> **이 파일의 한 줄 요약** — `Propagation` 은 "**호출 시점에 기존 트랜잭션이 있을 때/없을 때 어떻게 할 것인가**" 의 7가지 정책. 실무는 REQUIRED(99%) + REQUIRES_NEW(특수) 두 개로 거의 다 끝난다.

---

## 1. 전파 속성이란 무엇인가

`@Transactional(propagation = Propagation.XXX)` — 메서드가 호출될 때 **기존 트랜잭션이 있는지 / 없는지** 에 따라 어떤 행동을 할지를 결정.

```
호출자 (ServiceA.outer @Transactional)
   │
   │  ServiceB.inner() 호출       ← 이 시점에 기존 TX 가 active
   ▼
ServiceB.inner @Transactional(propagation = ?)
   ├─ REQUIRED      → 기존 TX 참여 (한 트랜잭션으로 묶임)
   ├─ REQUIRES_NEW  → 기존 TX suspend, 새 TX 시작
   ├─ SUPPORTS      → 기존 있으면 참여, 없으면 비트랜잭션
   ├─ NOT_SUPPORTED → 기존 suspend, 비트랜잭션 실행
   ├─ MANDATORY     → 기존 없으면 예외
   ├─ NEVER         → 기존 있으면 예외
   └─ NESTED        → 기존 안에 Savepoint 생성
```

---

## 2. 7가지 전파 속성

### REQUIRED (default)

```kotlin
@Transactional  // = Propagation.REQUIRED
fun inner() { ... }
```

| 기존 TX 있을 때 | 기존 TX 없을 때 |
|---|---|
| 기존에 **참여** (한 트랜잭션) | **새 TX 시작** |

- 실무 99% 의 default
- 한 트랜잭션 안에서 일부가 실패하면 전체 롤백
- 내부에서 RT 발생 → 전체 트랜잭션 rollback-only 마킹

### REQUIRES_NEW

```kotlin
@Transactional(propagation = Propagation.REQUIRES_NEW)
fun inner() { ... }
```

| 기존 TX 있을 때 | 기존 TX 없을 때 |
|---|---|
| 기존을 **suspend**, 새 TX 시작 | 새 TX 시작 |

- **항상 새 트랜잭션** — 기존 TX 의 성공/실패와 무관하게 독립적으로 commit/rollback
- 사용 예: **감사 로그**, **전송 실패 기록** — 비즈니스 트랜잭션이 롤백되어도 로그는 남겨야 할 때
- 주의: 기존 TX 가 **커넥션을 잡고 있는 동안 새 TX 가 또 다른 커넥션을 잡음** → 풀 사이즈 부족 위험. 한 요청에서 REQUIRES_NEW 를 남발하면 데드락 가능.

```kotlin
// 실패 로그를 무조건 남기는 패턴
@Service
class OrderAuditService(...) {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun recordFailure(orderId: Long, reason: String) {
        auditRepository.save(AuditLog(orderId, reason))
    }
}

@Service
class OrderService(
    private val auditService: OrderAuditService,  // 다른 빈 → 프록시 경유
) {
    @Transactional
    fun place(cmd: Command) {
        try {
            ...
        } catch (e: Exception) {
            auditService.recordFailure(orderId, e.message)  // ✅ TX2 (REQUIRES_NEW)
            throw e  // TX1 은 롤백, audit 은 commit
        }
    }
}
```

### SUPPORTS

```kotlin
@Transactional(propagation = Propagation.SUPPORTS)
fun query() { ... }
```

| 기존 TX 있을 때 | 기존 TX 없을 때 |
|---|---|
| 기존에 참여 | 비트랜잭션 실행 |

- 기존 TX 가 있으면 따라가고, 없으면 그냥 실행
- 실무에서 거의 안 씀 — 의도가 모호해짐

### NOT_SUPPORTED

```kotlin
@Transactional(propagation = Propagation.NOT_SUPPORTED)
fun expensiveQuery() { ... }
```

| 기존 TX 있을 때 | 기존 TX 없을 때 |
|---|---|
| 기존을 **suspend**, 비트랜잭션 실행 | 비트랜잭션 실행 |

- 무거운 조회를 트랜잭션 밖에서 실행해 **lock/snapshot 비용 회피**
- 사용 예: 통계 집계 쿼리, 대용량 리포트
- 주의: 트랜잭션 안에서 호출되면 기존 TX 를 suspend 하므로 추가 커넥션이 필요할 수 있음

### MANDATORY

```kotlin
@Transactional(propagation = Propagation.MANDATORY)
fun internalOnly() { ... }
```

| 기존 TX 있을 때 | 기존 TX 없을 때 |
|---|---|
| 참여 | **`IllegalTransactionStateException`** |

- "이 메서드는 반드시 트랜잭션 안에서만 호출해야 한다" 는 강제
- 사용 예: private 도메인 메서드를 외부 호출 못 하게 막을 때 (방어적 프로그래밍)

### NEVER

```kotlin
@Transactional(propagation = Propagation.NEVER)
fun statelessOp() { ... }
```

| 기존 TX 있을 때 | 기존 TX 없을 때 |
|---|---|
| **예외** | 비트랜잭션 실행 |

- "이 메서드는 절대 트랜잭션 안에서 호출되면 안 된다" 는 강제
- 거의 안 씀

### NESTED

```kotlin
@Transactional(propagation = Propagation.NESTED)
fun innerNested() { ... }
```

| 기존 TX 있을 때 | 기존 TX 없을 때 |
|---|---|
| 기존 TX 안에 **Savepoint** 생성 | 새 TX 시작 (REQUIRED 와 동일) |

- 기존 트랜잭션의 일부분으로 동작하지만, **부분 롤백 가능** — Savepoint 까지만 롤백
- JDBC `Connection.setSavepoint()` 위에 구현
- **JPA/Hibernate 는 NESTED 미지원** — `JpaTransactionManager` 가 NestedTransactionNotSupportedException 던짐
- DataSourceTransactionManager (순수 JDBC) 에서만 동작
- 실무에서 거의 안 씀 (JPA 환경이 대다수)

```kotlin
// NESTED 가 동작하는 예 (순수 JDBC)
@Transactional
fun outer() {
    repository.save(a)
    try {
        innerService.tryRisky()  // NESTED → Savepoint
    } catch (e: BusinessException) {
        // tryRisky 만 롤백, a 는 살아있음
    }
    repository.save(b)
}
```

JPA 환경에서 비슷한 효과를 원하면 **REQUIRES_NEW + 다른 빈** 으로 우회.

---

## 3. 비교표 (한눈에)

| Propagation | 기존 TX 있을 때 | 기존 TX 없을 때 | 실무 빈도 |
|---|---|---|---|
| **REQUIRED** | 참여 | 새 TX | ★★★ (default) |
| **REQUIRES_NEW** | suspend + 새 TX | 새 TX | ★★ (감사/특수) |
| SUPPORTS | 참여 | 비TX | ☆ |
| NOT_SUPPORTED | suspend + 비TX | 비TX | ☆ |
| MANDATORY | 참여 | 예외 | ☆ |
| NEVER | 예외 | 비TX | ☆ |
| NESTED | Savepoint | 새 TX | ☆ (JPA 미지원) |

---

## 4. REQUIRES_NEW vs NESTED — 면접 단골 비교

| 항목 | REQUIRES_NEW | NESTED |
|---|---|---|
| 실제 트랜잭션 개수 | **2개** (커넥션 2개) | **1개** (Savepoint) |
| 외부 TX 와 격리 | **완전 독립** — outer 결과 무관 | outer 가 롤백되면 inner 도 롤백 (Savepoint 무효) |
| 부분 commit | inner 만 단독 commit 가능 | inner 단독 commit 불가, outer 가 commit 해야 |
| JPA 지원 | ✅ | ❌ (Hibernate 미지원) |
| 사용 예 | 감사 로그, 외부 호출 결과 기록 | 부분 롤백 (실무 드묾) |

```
[REQUIRES_NEW]
TX1 begin ─────────────────┐
   inner() 호출             │
   TX1 suspend              │
   TX2 begin                │
     inner 작업              │
   TX2 commit               │
   TX1 resume               │
TX1 commit/rollback ────────┘

[NESTED]
TX1 begin ───────────────────────┐
   inner() 호출                   │
   savepoint(SP1)                 │
     inner 작업                    │
   commit savepoint or rollback   │
TX1 commit/rollback ──────────────┘
```

---

## 5. 실전 시나리오: 여러 전파의 조합

### 시나리오: 주문 처리 + 재고 차감 + 감사 로그

```kotlin
@Service
class OrderProcessingService(
    private val orderTxService: OrderTransactionalService,
    private val inventoryClient: InventoryClient,
    private val auditService: OrderAuditService,
) {
    // 외부 호출 분리 — TX 없음
    fun place(cmd: Command): Order {
        val pending = orderTxService.savePending(cmd)              // TX1 (REQUIRED)
        try {
            inventoryClient.reserve(pending.id, cmd.items)        // 외부 HTTP
            return orderTxService.complete(pending.id)            // TX2 (REQUIRED)
        } catch (e: Exception) {
            auditService.recordFailure(pending.id, e.message)     // TX3 (REQUIRES_NEW)
            orderTxService.cancel(pending.id)                     // TX4 (REQUIRED)
            throw e
        }
    }
}
```

- TX1, TX2, TX4 = REQUIRED (각 호출이 독립 트랜잭션, 외부 HTTP 가 트랜잭션 밖)
- TX3 = REQUIRES_NEW (실패 기록은 무조건 commit, 다른 트랜잭션 결과 무관)
- 외부 HTTP 는 어떤 트랜잭션도 잡고 있지 않음 → 커넥션 점유 안 됨

### 시나리오: 외부 호출 무거운 통계 조회

```kotlin
@Service
class ReportService(
    private val statsRepo: StatsRepository,
) {
    @Transactional(readOnly = true)
    fun lightQuery(): Summary { ... }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    fun heavyAggregate(): HeavyReport {
        // 트랜잭션 밖에서 실행 — lock 점유 없이 대량 조회
        return statsRepo.aggregate()
    }
}
```

---

## 6. 함정 모음

### 함정 1: REQUIRES_NEW 와 self-invocation

```kotlin
@Service
class OrderService(...) {
    @Transactional
    fun outer() {
        recordAudit()  // ⚠ self-invocation
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun recordAudit() { ... }
}
```

같은 클래스 호출이라 프록시 미경유 → `REQUIRES_NEW` 무시 → outer 와 같은 TX 로 동작. 03 파일의 self-invocation 함정과 동일. **다른 빈으로 분리 필수**.

### 함정 2: REQUIRES_NEW 와 커넥션 풀 데드락

```kotlin
@Transactional
fun outer() {
    for (i in 1..100) {
        innerService.audit(i)  // REQUIRES_NEW × 100
    }
}
```

매 호출마다 새 커넥션이 필요 → 풀 size 가 작으면 데드락 (outer 가 자기 커넥션을 들고 있고, inner 가 새 커넥션을 기다리고, 풀이 소진).

해결:
- REQUIRES_NEW 호출 빈도 줄이기
- 풀 사이즈 늘리기 (단순 답이지만 비용)
- 트랜잭션 분리 (outer 의 트랜잭션을 잘게 쪼개서 끝내기)

### 함정 3: NESTED + JPA

```kotlin
@Transactional
fun outer() {
    inner.save()  // NESTED
}

@Transactional(propagation = Propagation.NESTED)
fun save() { ... }  // JPA 환경 → NestedTransactionNotSupportedException
```

JPA 환경에서 NESTED 를 쓰지 마라. 정적 분석으로 잡히지 않는 함정.

---

## 7. msa 코드 연결

msa 는 **거의 모든 트랜잭션이 REQUIRED (default)** 이다. `grep -rn "REQUIRES_NEW\|NESTED" /Users/gideok-kwon/IdeaProjects/msa --include="*.kt"` 결과가 거의 비어있는 게 그 증거.

이는 msa 가 의도적으로 **외부 IO (Input/Output, 입출력) 를 트랜잭션 밖으로 분리** 하는 패턴 (Outbox, TransactionalService 분리) 으로 풀고 있기 때문 — REQUIRES_NEW 같은 복잡한 도구가 필요 없게 설계된 것이 정답.

면접 답변 패턴:
> "실무에서 REQUIRES_NEW 는 감사 로그처럼 메인 트랜잭션 결과와 독립적으로 기록해야 할 때만 씁니다. 우리 msa 에서는 그런 케이스도 보통 Outbox + Kafka 로 분리하기 때문에 REQUIRES_NEW 자체를 거의 안 씁니다. NESTED 는 JPA 환경이라 미지원이라서 후보에서 빠집니다."

---

## 8. 요약 카드

- 7개 중 실무는 **REQUIRED (default) + REQUIRES_NEW** 두 개로 거의 끝
- REQUIRES_NEW = 별개의 트랜잭션 + 별개의 커넥션 + 독립 commit/rollback
- NESTED = Savepoint 기반 (JPA 미지원)
- self-invocation 환경에서는 propagation 속성 무시 → 다른 빈으로 분리 필수
- REQUIRES_NEW 남발 시 커넥션 풀 데드락 위험
- msa 는 거의 REQUIRED — 외부 IO 분리로 복잡한 propagation 필요성 자체를 회피

---

## 다음 학습

- [05-isolation-levels.md](05-isolation-levels.md) — 격리 수준
- [06-readonly-vs-writable.md](06-readonly-vs-writable.md) — readOnly 의 진짜 효과
