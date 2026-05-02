---
parent: 5-spring-transactional
seq: 13
title: msa 개선 제안 종합
type: deep
created: 2026-05-01
---

# 13. msa 개선 제안 종합

> 본 학습을 통해 발견한 msa 의 트랜잭션 / Outbox / replica routing 영역 개선 후보 10가지. 우선순위 + ADR 필요 여부.

---

## 코드 리팩터링 / 신규 도입 제안 종합

| # | 제안 | 대상 | 영향도 | 우선순위 | ADR 필요 |
|---|---|---|---|---|---|
| 1 | order 서비스에 Outbox 패턴 적용 | order | 중간 | **높음** | Y (마이너) |
| 2 | Outbox 보관/삭제 정책 + 스케줄러 도입 | inventory/fulfillment/quant | 낮음 | **높음** | Y |
| 3 | **Read-After-Write Stickiness ADR** | gateway/공통 | 중간 | **높음** | **Y (신규)** |
| 4 | `@TransactionalEventListener` 도입 (캐시 무효화) | product/inventory | 낮음 | 중간 | N |
| 5 | OutboxPollingPublisher multi-replica 안전화 (SchedulerLock) | inventory/fulfillment/quant | 중간 | 중간 | Y |
| 6 | Inventory 동시성 — `@Version` 또는 SELECT FOR UPDATE | inventory | 중간 | **높음** | Y |
| 7 | processed_event 보관 스케줄러 (ADR-0012 의 7일) | inventory/fulfillment/order consumer | 낮음 | 중간 | N |
| 8 | OutboxAdapter 의 명시적 `@Transactional(REQUIRED)` | 모든 outbox 적용 서비스 | 낮음 | 낮음 | N |
| 9 | OutboxPollingPublisher 콜백의 트랜잭션 보강 | 모든 outbox 적용 서비스 | 낮음 | 중간 | N |
| 10 | Saga 보상 chain 완성 (재고 부족 → order cancel) | inventory + order | 높음 | 중간 | Y |

---

## 우선순위 TOP 3 (즉시 추진 가치)

### 1. order 서비스 Outbox 패턴 적용

**현재 상태** — `OrderService.execute()` 의 마지막 단계에서 `eventPort.publishOrderCompleted/Cancelled` 를 직접 호출. ADR-0012 의 적용 범위에는 order = ✓ 로 적혀 있으나 실제 발행 메커니즘은 Outbox 가 아닌 직접 발행.

**문제**:
- `paymentPort.requestPayment()` 와 `orderTransactionalService.completeOrder()` 사이에 timing 이슈 — completeOrder TX 가 commit 되기 전에 publishOrderCompleted 가 호출되면 phantom 이벤트 발생 가능
- 직접 발행 시 broker 가 일시적 unavailable 이면 이벤트 손실

```kotlin
// 현재
val completed = orderTransactionalService.completeOrder(orderId)  // TX2
eventPort.publishOrderCompleted(completed)  // 트랜잭션 밖, 직접 발행

// 개선
val completed = orderTransactionalService.completeOrderWithOutbox(orderId)
// completeOrder 안에서 outbox INSERT 까지 atomic
// OutboxPollingPublisher 가 별도 발행
```

**왜 1순위**:
- inventory/fulfillment 와 일관성 확보
- ADR-0012 의 시맨틱이 모든 producer 에 일관 적용
- 비교적 작은 변경 (OrderTransactionalService 수정 + OutboxPort 추가)

**ADR**: 마이너 (ADR-0012 갱신 또는 별 문서)

---

### 2. Read-After-Write Stickiness ADR (신규)

**현재 상태** — `RoutingDataSource` 가 `readOnly` 만 보고 master/replica 를 분기. **replica lag** 으로 인한 read-after-write 비일관성 미해결.

**시나리오**:
```
T1: POST /products  →  master commit
T2: replica 가 binlog 받기 전 (수십 ms ~ 수 초)
T3: GET /products/{id}  →  replica 조회 → 404
```

**개선 옵션**:

#### 옵션 A: Session Stickiness (Redis 마커)
```kotlin
class StickyRoutingDataSource : AbstractRoutingDataSource() {
    @Autowired private lateinit var redisTemplate: StringRedisTemplate

    override fun determineCurrentLookupKey(): DataSourceType {
        val userId = currentUserContext()
        // 최근 N 초 내 master 쓰기 한 사용자는 master 로
        if (userId != null && redisTemplate.hasKey("recent-write:$userId")) {
            return DataSourceType.MASTER
        }
        return if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
    }
}

// 쓰기 후 마커 등록
@AfterCommit  // TransactionalEventListener AFTER_COMMIT
fun markRecentWrite(userId: Long) {
    redisTemplate.opsForValue().set("recent-write:$userId", "1", Duration.ofSeconds(5))
}
```

#### 옵션 B: Hint annotation
```kotlin
@WithMaster  // 커스텀 annotation
fun getRecentlyCreated(id: Long) = repository.findById(id)
```
- AOP advice 로 ThreadLocal 에 force-master 플래그 → RoutingDataSource 가 우선 참조

#### 옵션 C: 명시적 master 호출
```kotlin
// service 가 직접 routing 결정에 관여
fun getRecentlyCreated(id: Long): Product = masterRepository.findById(id)
```

**왜 1순위**:
- #15 connection pool 학습에서도 동일 문제 식별됨 (cross-reference)
- 사용자 경험에 직접 영향 (just-created item 이 안 보임)
- ADR 로 정책 통일하면 모든 서비스에 균일 적용 가능

**ADR**: **신규 ADR 필요** — 옵션 A/B/C 비교 + 선택 + 적용 범위

---

### 3. Inventory 동시성 — `@Version` 또는 SELECT FOR UPDATE

**현재 상태** — `InventoryService.execute(ReserveStockUseCase.Command)` 가 일반 SELECT + 도메인 검증 + UPDATE. **두 요청이 동시에 같은 productId/warehouseId 에 reserve 시 lost update 가능**.

```kotlin
// 현재
val inventory = inventoryRepository.findByProductIdAndWarehouseId(...)  // 일반 SELECT
inventory.reserve(command.qty)  // in-memory 검증
val savedInventory = inventoryRepository.save(inventory)  // UPDATE
```

**개선 옵션**:

#### 옵션 A: Optimistic Lock (`@Version`)
```kotlin
@Entity
class InventoryJpaEntity(
    @Id val id: Long,
    var availableQty: Int,
    var reservedQty: Int,
    @Version var version: Long = 0,  // ← 추가
)
```
- UPDATE 시 자동 `WHERE id=? AND version=?`
- 충돌 시 `OptimisticLockException` → 클라이언트 재시도 또는 retry advice
- 비용 적음 (lock 없음)
- 충돌 빈도가 높으면 retry 비용이 큼

#### 옵션 B: Pessimistic Lock (SELECT FOR UPDATE)
```kotlin
interface InventoryJpaRepository : JpaRepository<InventoryJpaEntity, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM InventoryJpaEntity i WHERE i.productId=:p AND i.warehouseId=:w")
    fun findByProductIdAndWarehouseIdForUpdate(p: Long, w: Long): InventoryJpaEntity?
}
```
- DB row lock — 동시 reserve 가 직렬화
- 정확하지만 throughput 낮아질 수 있음
- 짧은 TX 안에서 lock 풀림 보장 필요

#### 옵션 C: Redis 분산 락
```kotlin
val lock = redissonClient.getLock("inventory:$productId:$warehouseId")
lock.lock(5, TimeUnit.SECONDS)
try {
    // 비즈니스 로직
} finally {
    lock.unlock()
}
```
- DB 락 부하 회피
- Redis SPOF 위험
- 트랜잭션 외부 락이라 일관성 보강 어려움

**권장**: A (Optimistic) + 선택적 B (high-conflict 재고). msa 에 가장 자연스럽게 적용 가능.

**왜 1순위**:
- 재고 lost update 는 **금전적 손실 직결** (oversold)
- 현재 fast-path Redis 캐시도 동시성 보장이 아님 (msa 코드의 cachePort 는 단순 fast-path)
- 운영 트래픽 증가 시 즉시 문제 발생

**ADR**: A vs B 비교 + 선택 + retry 정책

---

## 중기 (ADR 필요)

### 4. Outbox 보관/삭제 정책 + 스케줄러

**현재** — `outbox_event` 테이블이 PUBLISHED 상태 row 도 무한 보관.

**개선**:
```kotlin
@Component
class OutboxRetentionScheduler(
    private val outboxRepository: OutboxJpaRepository,
) {
    @Scheduled(cron = "0 0 3 * * *")  // 매일 03:00
    fun deleteOldEvents() {
        val cutoff = LocalDateTime.now().minusDays(7)
        outboxRepository.deleteByStatusAndPublishedAtBefore("PUBLISHED", cutoff)
    }
}
```

- 7일 retention (Kafka retention + consumer lag 여유 고려)
- DELETE batch 단위 권장 (10k row 씩)

**ADR 필요**: retention 기간 결정 (7일/14일/30일 — 운영 사고 시 재발행 가능 기간)

---

### 5. OutboxPollingPublisher multi-replica 안전화

**현재** — `@Scheduled` 가 모든 replica 인스턴스에서 동시에 돌아 **중복 발행** 가능.

**개선**:
```kotlin
@Scheduled(...)
@SchedulerLock(name = "outbox-polling-fulfillment", lockAtMostFor = "30s")
fun publishPendingEvents() { ... }
```

- ShedLock 라이브러리 사용 (Redis/JDBC backend)
- leader 만 폴링 → 중복 발행 차단

**ADR 필요**: SchedulerLock backend 선택 (Redis vs JDBC), TTL/refresh 정책

---

### 10. Saga 보상 chain 완성

**현재** — inventory 의 reserve 실패 시 order 까지 cancel 시키는 흐름이 완전한지 코드만으로 단언 어려움.

**개선**:
```
[재고 부족 케이스]
1. order.order.completed 발행
2. inventory consumer 가 reserve 시도 → 재고 부족 → BusinessException
3. inventory 가 fulfillment.cancellation.required 같은 보상 이벤트 발행
4. order consumer 가 그걸 받아 order.cancel + 환불 트리거
5. Payment 환불 또는 manual intervention 결정
```

- 보상 이벤트 명세 명확화
- 환불 흐름 ADR 필요 (Payment 환불 자동화 vs manual)

**ADR 필요**: 보상 흐름 + 환불 정책 정의

---

## 단기 (ADR 불필요)

### 4. @TransactionalEventListener 도입 (캐시 무효화)

**현재** — Inventory 의 `syncCache` 가 트랜잭션 안에서 Redis 호출. ADR-0020 의 "외부 IO 트랜잭션 밖" 권고와 약한 충돌.

**개선**:
```kotlin
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
fun onInventoryChanged(event: InventoryChangedEvent) {
    cachePort.setStock(event.productId, event.warehouseId, event.available, event.reserved)
}
```

- 도메인 이벤트 → 캐시 동기화 분리
- DB commit 후 보장된 시점에 캐시 갱신
- JVM crash 시 손실 가능 — 운영적으로 받아들일지는 별도 결정

**ADR 불필요** — 마이너 개선

---

### 7. processed_event 보관 스케줄러

**현재** — ADR-0012 에 7일 보관 + 스케줄러 명시되어 있으나 실제 스케줄러 코드는 검토 필요.

**개선** — 4번 (Outbox retention) 과 동일 패턴.

---

### 8. OutboxAdapter 의 명시적 @Transactional(REQUIRED)

**현재** — `OutboxAdapter.save()` 는 별도 `@Transactional` 없이 호출자의 트랜잭션에 참여. 정상 동작이지만 의도 명시 가치.

**개선**:
```kotlin
@Component
class OutboxAdapter(...) : OutboxPort {
    @Transactional(propagation = Propagation.MANDATORY)  // 호출자 TX 강제
    override fun save(...) { ... }
}
```

- `MANDATORY` 로 호출자가 트랜잭션 안에서만 호출하도록 강제 → 트랜잭션 밖 호출 시 즉시 실패 → 의도치 않은 phantom 이벤트 차단

**ADR 불필요**

---

### 9. OutboxPollingPublisher 콜백의 트랜잭션 보강

**현재** — `whenComplete { ... event.status = "PUBLISHED"; outboxRepository.save(event) }` 가 콜백 안에서 dirty save. 트랜잭션 보장 모호.

**개선**:
```kotlin
private val updateTx = TransactionTemplate(txManager).apply {
    propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
}

kafkaTemplate.send(...).whenComplete { _, ex ->
    if (ex == null) {
        updateTx.execute {
            event.status = "PUBLISHED"
            event.publishedAt = LocalDateTime.now()
            outboxRepository.save(event)
        }
    }
}
```

- `TransactionTemplate` 으로 콜백 안에서 명시적 트랜잭션 경계
- 또는 별 빈으로 분리해 `@Transactional` 적용

---

## 관련 다음 학습 제안

| # 학습 | 본 주제와 연결 |
|---|---|
| **#15 Connection Pool** (이미 완료) | replica routing + LazyConnectionDataSourceProxy 효과 측정 |
| **#4 DB Index/Transaction** | 격리 + lock 의 InnoDB 구현 깊이 |
| **#7 Distributed Systems** | Saga / Outbox 의 분산 일관성 모델 |
| **#6 Kafka Internals** | partition key, idempotent producer/consumer 메커니즘 |

---

## 학습 종합 체크리스트

학습 후 즉시 가능한 것:
- [ ] ADR 신규 작성 — Read-After-Write Stickiness (3번)
- [ ] ADR 신규 작성 — Inventory 동시성 (`@Version` vs `FOR UPDATE`) (6번)
- [ ] ADR 신규 작성 — Outbox 보관 정책 (4번)
- [ ] ADR 마이너 갱신 — order 서비스 Outbox 화 (1번)
- [ ] OrderService Outbox 화 PR
- [ ] Inventory `@Version` 추가 PR + retry advice
- [ ] OutboxRetentionScheduler 구현
- [ ] OutboxPollingPublisher SchedulerLock 적용

---

## 우선순위 매트릭스

```
높음 ┃                      [3 stickiness ADR]
       ┃                     [6 inventory @Version]
영향  ┃               [10 saga 보상]
       ┃          [1 order Outbox]
       ┃    [5 SchedulerLock]
       ┃ [4 retention] [9 callback tx]
       ┃ [7 processed_event] [8 MANDATORY]
       ┃                      [4 @TransactionalEventListener]
낮음 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   낮음                                  높음
                  긴급도
```

---

## 다음

- [14-interview-qa.md](14-interview-qa.md) — 면접 Q&A 카드
