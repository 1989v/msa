---
parent: 4-db-index-transaction
seq: 16
title: TX × 격리 × RoutingDataSource 의 결합
type: deep
created: 2026-05-01
---

# 16. TX × 격리 × RoutingDataSource 의 결합

## 핵심 정의

#5 Spring Transactional 에서 다룬 내용 (`@Transactional`, readOnly, RoutingDataSource) 과 본 학습의 격리/lock 이 **어떻게 만나는가** 를 정리한다. 면접 답변에서 `@Transactional` 한 줄이 지나가면 이 문서의 그림이 머리에 떠야 한다.

## 큰 그림

```
@Transactional(readOnly=?)
        │
        ▼
PlatformTransactionManager
        │  setReadOnly(?)  → MySQL connection 의 START TRANSACTION READ ONLY/READ WRITE
        │  setIsolationLevel(?)  → SET SESSION TRANSACTION ISOLATION LEVEL ...
        ▼
LazyConnectionDataSourceProxy
        │  실제 connection 획득은 첫 SQL 실행 시점까지 미룸
        ▼
AbstractRoutingDataSource (msa 의 RoutingDataSource)
        │  TransactionSynchronizationManager.isCurrentTransactionReadOnly()
        │  → MASTER vs REPLICA 결정
        ▼
HikariCP master / HikariCP replica
        │
        ▼
MySQL master / MySQL replica
        │  └─→ MVCC + Lock + 격리 (본 학습)
```

## msa 의 RoutingDataSource 코드 (재확인)

```kotlin
class RoutingDataSource : AbstractRoutingDataSource() {
    override fun determineCurrentLookupKey(): DataSourceType =
        if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
}

@Bean
fun dataSource(routingDataSource: DataSource): DataSource =
    LazyConnectionDataSourceProxy(routingDataSource)
```

→ 11개 서비스 모두 같은 패턴. ADR-0020 의 핵심 패턴.

## 결합 포인트 1 — `readOnly` 의 두 가지 효과

`@Transactional(readOnly = true)`:

1. Hibernate **FlushMode = MANUAL** → dirty check skip → 메모리/CPU 절약.
2. **routing key = REPLICA** → master 부하 분산.
3. MySQL 측 `START TRANSACTION READ ONLY` 의 미세 최적화 — InnoDB 가 row 의 ROW_TRX_ID 안 박음 → 약간의 IO 절약.

본 학습 관점:
- replica 의 격리 수준은 **정확히 master 와 같지 않을 수 있음** — replication 지연.
- replica 는 master 의 commit 된 트랜잭션을 따라잡는 중이므로, replica 의 "가장 최근 commit" 이 master 보다 ms~s 단위 뒤처질 수 있음.
- → "방금 쓴 데이터를 바로 읽어야 하는" read-after-write 상황에서 replica 라우팅하면 못 읽음.

## 결합 포인트 2 — Read After Write 함정

```kotlin
// ❌ 잘못된 패턴
@Transactional
fun createWishlist(memberId: Long, productId: Long): Long {
    val item = WishlistItem(...)
    return repo.save(item).id     // master 에 INSERT
}

@Transactional(readOnly = true)
fun getMyWishlist(memberId: Long): List<WishlistItem> {
    return repo.findByMemberId(memberId)   // replica 라우팅 → 방금 INSERT 한 게 안 보일 수 있음
}
```

- ms 단위 replication lag 동안 replica 에 데이터 없음 → 사용자 "내가 막 추가했는데?".

해결 패턴:

| 패턴 | 동작 |
|---|---|
| **stickiness** | 같은 사용자의 write 후 N 초 동안은 master 라우팅 (cookie/session) |
| **wait-for-replica** | write 직후 replica 가 따라잡을 때까지 short wait |
| **skip replica for critical reads** | 결제/주문 같은 critical read 는 readOnly 빼고 master 강제 |
| **Outbox + 비동기 view** | write → outbox → 비동기 view 갱신 (eventual consistency) |

→ msa 는 명시 정책 미정 (ADR 후보, 17 에서).

## 결합 포인트 3 — 격리 수준 vs 라우팅

**MySQL replica 의 격리 수준은 별도 설정**:
- master: REPEATABLE READ
- replica: READ COMMITTED 로 운영하는 곳도 있음 (`transaction_isolation` 다르게).

→ msa 에선 둘 다 InnoDB 기본 RR. 단, 운영 시 양쪽 일치 확인 필수.

read-only TX 가 replica 에서 RR 이라도, replication 지연 자체가 master 의 commit 시점 차이라 외부 관찰자 입장에선 latency lag 만 있을 뿐 격리는 동일.

## 결합 포인트 4 — Lock 보유 시간 = 외부 IO 시간

ADR-0020 의 본질을 lock 관점에서 다시:

```kotlin
@Transactional
fun processOrder(order: Order) {
    val saved = orderRepo.save(order)
    // ↑ INSERT 시 X-lock + AUTO-INC mutex
    paymentClient.charge(saved)   // 5초 HTTP
    // ↑ 그 동안 X-lock 보유 → 다른 TX 의 INSERT 일부 block (gap lock 충돌 시)
    saved.markPaid()
}
```

영향:
1. **lock_wait_timeout** (기본 50s) 까지 다른 TX block.
2. 동시 트래픽 폭주 시 **deadlock** 확률 ↑.
3. **MDL EXCLUSIVE** 의 시나리오 — 누군가 ALTER 시도하면 대기열 형성.
4. **undo log 적체** — long TX 가 살아 있으면 다른 TX 의 update 의 undo 가 purge 안 됨 → history list 폭증 (06 참조).

해결 (ADR-0020):
```kotlin
fun processOrder(order: Order) {
    val saved = orderTransactionalService.save(order)  // 짧은 TX, lock 보유 ms
    val charge = paymentClient.charge(saved)            // TX 밖, lock 없음
    orderTransactionalService.markPaid(saved.id, charge.id)  // 또 짧은 TX
}
```

→ lock 보유 시간 ms 단위 → deadlock / lock wait / MDL 사슬 확률 모두 ↓.

## 결합 포인트 5 — 낙관락 (`@Version`) 과 lock 충돌 회피

`inventory.InventoryJpaEntity`:
```kotlin
@Version
@Column(nullable = false)
var version: Long = 0
```

동작:
```sql
UPDATE inventory SET available_qty = ?, version = version + 1
WHERE id = ? AND version = ?
```

- row 에 X-lock 잡지 않음 (실제로는 UPDATE 시 잠시 잡지만, **read 단계에서 lock 안 잡음**).
- 충돌 시: affected rows = 0 → `OptimisticLockingFailureException` → application retry.

장점:
- 비관락 (`SELECT FOR UPDATE`) 보다 lock 보유 시간 0.
- 동시 update 빈도 낮을 때 throughput ↑.

단점:
- 충돌 빈도 높으면 retry 폭주.
- read-modify-write 의 read 가 stale 가능성 → application 로직에서 invariant 검증 필요.

→ inventory 의 재고 차감 같은 동시성 높은 케이스에 적용. 정답.

## 결합 포인트 6 — Outbox 의 SKIP LOCKED

```sql
SELECT * FROM outbox WHERE published_at IS NULL
ORDER BY occurred_at LIMIT 100
FOR UPDATE SKIP LOCKED;  -- (현 msa 미사용)
```

- worker N 개일 때 같은 row 안 잡게.
- 현 OutboxRelay 는 단일 worker 가정 — 향후 multi worker 시 SKIP LOCKED 필수 (17).

## 결합 포인트 7 — ADR-0012 멱등성 + `processed_event`

```kotlin
@Transactional
fun consume(event: DomainEvent) {
    if (processedEventRepo.exists(event.id, consumerGroup)) return  // dedupe
    processBusinessLogic(event)
    processedEventRepo.save(event.id, consumerGroup)
    // ↑ INSERT (event_id, consumer_group) PK 충돌 시 → 동시 두 worker 가 같은 이벤트 처리 시도였음.
}
```

- `processed_event.PRIMARY KEY (event_id, consumer_group)` 가 멱등성의 마지막 방어선.
- DB 의 UNIQUE 제약 → application 의 race condition 방어.
- INSERT 실패 시 `DuplicateKeyException` → 무시 (이미 누가 처리했음).

## 권장 패턴 표 (msa 운영)

| 시나리오 | TX 정책 | 격리 | DataSource |
|---|---|---|---|
| 일반 CRUD | `@Transactional` | RR (기본) | MASTER |
| 단순 조회 | `@Transactional(readOnly=true)` | RR | REPLICA |
| 외부 API 포함 | TX 분리 + 외부 IO 트랜잭션 밖 | RR | MASTER (write) / REPLICA (read) |
| 멱등 consumer | `@Transactional` + processed_event INSERT | RR | MASTER |
| Outbox relay | TX 두 단계 (read + markPublished) | RR | MASTER (둘 다) |
| 동시성 높은 update | `@Version` 낙관락 + retry | RR | MASTER |
| 자금 이체 (가상) | `@Lock(PESSIMISTIC_WRITE)` + retry | RR | MASTER |
| 보고서 (시간 무관) | `@Transactional(readOnly=true)` | RC (`isolation = READ_COMMITTED`) | REPLICA |
| 회원 탈퇴 cascade DELETE | 청크 (LIMIT N) 반복 + 각각 짧은 TX | RR | MASTER |

## 결합 포인트 8 — Hibernate 1차 캐시와 MVCC

JPA 의 1차 캐시 (PersistenceContext) 는 TX 안에서:
- `find(id)` 두 번 호출 → 두 번째는 메모리에서 (DB 안 감).
- **DB 의 MVCC snapshot 과 JPA 캐시는 별개** — 같은 TX 안에선 결과적으로 일관 (둘 다 변하지 않음).

함정:
- 같은 TX 안에서 `findById` (consistent read) 와 `findByIdForUpdate` (locking read) 호출 시 서로 다른 결과 가능.
  - find: snapshot 데이터.
  - findForUpdate: 현재 commit 된 데이터.
- 면접 답변: "JPA 1차 캐시 + MVCC + locking read 는 서로 다른 layer 라 같은 TX 안에서도 헷갈릴 수 있습니다. 가능하면 한 TX 안에선 한 모드만 (전부 consistent 또는 전부 locking) 일관되게 씁니다."

## 결합 포인트 9 — Connection 획득 타이밍 (LazyConnectionDataSourceProxy)

```
@Transactional 진입
  ↓
TransactionInterceptor.invoke
  ↓
DataSourceUtils.getConnection() — 그러나 LazyConnectionDataSourceProxy 가 가짜 connection 반환
  ↓
첫 SQL 실행 시점에 진짜 connection 획득
  ↓
이때 RoutingDataSource.determineCurrentLookupKey() 호출 → MASTER/REPLICA 결정
```

효과:
- TX 시작했는데 실제 SQL 한 번도 안 던지면 connection 안 잡음 → pool 효율 ↑.
- routing key 결정이 첫 SQL 시점이라 중간에 readOnly 변경 안 됨 (이미 결정).

## 멘탈 모델

> `@Transactional` 한 줄은 **5개 layer 의 합성**:
> 1. AOP proxy (#5)
> 2. TransactionInterceptor → MVCC + Lock (본 학습)
> 3. PlatformTransactionManager (격리/readOnly 설정)
> 4. LazyConnectionDataSourceProxy (connection 지연)
> 5. RoutingDataSource (master/replica 분기)
>
> 한 layer 만 알면 답할 수 없는 질문이 늘 나온다. lock 보유 시간 단축은 곧 격리 충돌 감소이고, 이는 곧 throughput.

## 핵심 포인트

- **readOnly = true** 의 효과는 (1) Hibernate FlushMode (2) routing key (3) MySQL TX READ ONLY 셋.
- **Replication lag** 가 read-after-write 깨뜨릴 수 있음 — stickiness / wait / Outbox 패턴 검토.
- **Lock 보유 시간 = 외부 IO 시간** — ADR-0020 의 외부 IO 분리는 lock/MDL/undo 셋 다 보호.
- **낙관락 (`@Version`)** 은 lock 자체 회피 + retry 패턴.
- **SKIP LOCKED** 는 multi-worker outbox 의 표준.
- **ADR-0012 의 processed_event** PK = 멱등성의 DB 마지막 방어선.
- **JPA 1차 캐시 / MVCC / locking read** 는 서로 다른 layer — 한 TX 안에 섞지 말 것.
- **LazyConnectionDataSourceProxy** 가 connection 획득을 첫 SQL 시점까지 늦춤 → pool 효율 ↑.

## 다음 학습
- [17-improvements.md](17-improvements.md) — read-after-write stickiness ADR, multi-worker outbox 등
- [18-interview-qa.md](18-interview-qa.md) — 본 학습 면접 카드
