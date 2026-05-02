---
parent: 4-db-index-transaction
seq: 15
title: msa 쿼리 패턴 + slow 후보 식별
type: deep
created: 2026-05-01
---

# 15. msa 쿼리 패턴 + slow 후보 식별

## 핵심 정의

14 에서 인덱스 정의를 봤다면, 여기선 **실제 쿼리 패턴** 과 그에 맞는 인덱스 활용 / 잠재 slow 후보를 식별한다. PR 리뷰에 바로 적용 가능한 점검 표.

## 쿼리 패턴 분류 (msa 11 서비스 통계)

### Pattern 1: PK Lookup (eq_const)

```kotlin
// product/order/member/wishlist 등 다수
fun findById(id: Long): Optional<Entity>
```

- type=const, key=PRIMARY, rows=1.
- 모든 서비스에서 가장 빈번. ✅ 안전.

### Pattern 2: Secondary Index Equality

```kotlin
// wishlist
fun existsByMemberIdAndProductId(memberId: Long, productId: Long): Boolean
fun countByMemberId(memberId: Long): Long

// auth
fun findAllByMemberId(memberId: Long): List<MemberRoleJpaEntity>
```

- `uk_member_product` 또는 `uk_member_role` 의 leftmost 활용. type=ref. ✅

### Pattern 3: Secondary + Pageable

```kotlin
// wishlist
fun findByMemberId(memberId: Long, pageable: Pageable): List<WishlistItemJpaEntity>
```

- Pageable 의 정렬 컬럼이 인덱스에 없으면 filesort.
- 운영 시 정렬 기본값 확인 — 보통 `created_at DESC`.
- 현 인덱스 (member_id, product_id) 로는 created_at 정렬 시 filesort.
- → `(member_id, created_at)` 추가 후보 (17 에서).

### Pattern 4: Outbox Relay

```kotlin
// quant (모범)
fun findTop100ByPublishedAtIsNullOrderByOccurredAtAsc(): List<OutboxEntity>

// inventory (개선 필요)
fun findAllByStatusOrderByCreatedAtAsc(status: String): List<OutboxJpaEntity>
```

- quant: idx_outbox_unpublished (published_at, occurred_at) 으로 type=range, Extra=Using index condition. ✅
- inventory: 인덱스 없음. type=ALL 가능. → `idx_outbox_status_created (status, created_at)` 추가 후보.

### Pattern 5: JOIN FETCH (N+1 회피)

```kotlin
// order
@Query("SELECT o FROM OrderJpaEntity o JOIN FETCH o.items WHERE o.id = :id")
fun findByIdWithItems(id: Long): OrderJpaEntity?
```

- order PK lookup + order_items FK index lookup. type=const + ref. ✅

### Pattern 6: Bulk DELETE

```kotlin
// wishlist
@Modifying
@Query("DELETE FROM WishlistItemJpaEntity w WHERE w.memberId = :memberId")
fun deleteAllByMemberId(memberId: Long)
```

- member.withdrawn 이벤트 처리 시 호출.
- WHERE member_id 인덱스 (uk_member_product 의 leftmost) 활용 → 정확한 lock 범위.
- 그러나 회원의 wishlist 가 수만 row 면 X-lock 다수 + replication lag 가능.
- → 청크 단위 (LIMIT 1000) 반복 권장.

### Pattern 7: QueryDSL 동적 쿼리

```kotlin
// product/ProductQueryRepository
fun findAllByStatus(status: ProductStatus, pageable: Pageable): Page<ProductJpaEntity> {
    val content = queryFactory
        .selectFrom(product)
        .where(product.status.eq(status))
        ...
}
```

- idx_products_status (status) 활용 — 그러나 status selectivity 낮으면 옵티마이저가 ALL 선택 가능.
- 페이징: count + offset → 큰 offset 시 비효율.

### Pattern 8: Multi-Tenant 패턴 (quant)

```kotlin
// 모든 quant repository 가 tenantId 필수 시그니처
fun findByTenantIdAndStrategyId(tenantId: String, strategyId: UUID): TrancheStrategyEntity?
fun findByTenantIdAndPublishedAtIsNullOrderByOccurredAtAsc(tenantId: String): List<...>
```

- INV-05 (도메인 invariant) — tenant_id 누락된 query 자체 금지.
- 모든 인덱스가 (tenant_id, ...) 시작 → 일관 활용.

## Slow 후보 (운영 적용 시 점검)

### 후보 1: Wishlist 의 페이징 정렬

```sql
SELECT * FROM wishlist_items WHERE member_id = ? ORDER BY created_at DESC LIMIT 20;
```

EXPLAIN (예상):
```
type: ref      key: uk_member_product
rows: 100      Extra: Using where; Using filesort  ⚠️
```

- created_at 인덱스 없음 → filesort.
- 한 회원의 wishlist 가 보통 수십~수백 → filesort 비용 작음. 그러나 수만 회원 동시 조회 시 누적.

해법:
- `(member_id, created_at)` 추가 (covering 도 가능) — 단 write 비용 검토.
- 또는 keyset pagination 으로 `WHERE member_id=? AND created_at < :last_seen ORDER BY created_at DESC LIMIT 20`.

### 후보 2: Inventory Outbox 의 ALL

```sql
SELECT * FROM outbox_event WHERE status = 'PENDING' ORDER BY created_at ASC;
```

- 인덱스 없음 → ALL.
- outbox_event 가 작으면 (수천) 무시할 수 있지만 누적 시 위험.

해법:
- `idx_outbox_event_status_created (status, created_at)` 추가.
- quant 처럼 `published_at IS NULL` 모델로 전환 검토.

### 후보 3: Product / Order 의 status 단독 조회

```sql
SELECT * FROM products WHERE status = 'ON_SALE';  -- 90% of rows
SELECT * FROM orders WHERE status = 'PENDING';
```

- selectivity 낮음 → 옵티마이저가 ALL 선택할 가능성.
- idx_products_status 가 사실상 무용 — 디스크/write 비용만.

해법:
- 인덱스 제거 (17 에서).
- 또는 (status, created_at) 으로 진화시켜 정렬까지 흡수.

### 후보 4: Order 의 user_id + status 결합

```sql
SELECT * FROM orders WHERE user_id = ? AND status = ?;
```

- `idx_orders_user_id` 사용 → user_id 좁힌 후 status 는 후필터.
- 한 user 의 주문 수가 많고 status PENDING 만 보고 싶을 때 비효율.

해법:
- 복합 인덱스 `(user_id, status, created_at)` — 이게 가장 일반적.
- 기존 단독 인덱스 (idx_orders_status) 는 제거.

### 후보 5: Reservation 의 만료 처리

```sql
-- (가설) 만료 정리 배치
SELECT * FROM reservation WHERE status = 'PENDING' AND expired_at < NOW() FOR UPDATE SKIP LOCKED;
```

- inventory.reservation 에 `(status, expired_at)` 인덱스 없음.
- 배치 호출 빈도가 낮으면 영향 작음. 대량 데이터 시 ALL.

해법:
- `idx_reservation_status_expired (status, expired_at)` 추가.
- SKIP LOCKED 적용 (다중 worker 안전).

### 후보 6: Member 의 email 검색

```kotlin
fun findByEmail(email: String): MemberJpaEntity?  // (가설)
```

- email 인덱스 없음. 직접 검색이 필요하면 ALL.
- 현재 SSO 위주라 직접 email 검색이 거의 없음 — 추가 필요성 낮음.
- 추후 admin 검색 기능에서 필요해지면 추가.

### 후보 7: Audit Log Append-Only

```sql
INSERT INTO audit_log (...) VALUES (...);  -- 항상
SELECT * FROM audit_log WHERE tenant_id = ? AND at BETWEEN ? AND ?;  -- 조회
```

- `idx_audit_tenant_time (tenant_id, at)` 잘 설계됨. ✅
- 그러나 audit_log 는 시간 지나면 폭증 → partition 후보 (17 의 ADR 후보).

## EXPLAIN 점검 권장 쿼리 리스트

각 서비스에서 PR 리뷰 시 EXPLAIN 첨부 권장 쿼리:

| 서비스 | 쿼리 | 점검 포인트 |
|---|---|---|
| order | `findByIdWithItems(id)` | type=const + ref, JOIN 효율 |
| order | (가설) `findByUserIdAndStatus(...)` | 복합 인덱스 추가 후 EXPLAIN |
| product | `findAllByStatus(...)` | type=ref vs ALL 분기점 (selectivity) |
| wishlist | `findByMemberId(memberId, page)` | filesort 여부 |
| quant | OutboxJpaRepository.findTop100... | Using index condition 확인 |
| quant | `TrancheSlotJpaRepository.findByRunIdOrderByRoundIndex` | (run_id, round_index) 인덱스 활용 |
| code-dictionary | `findByConceptIdContaining` | LIKE 패턴 점검 |
| inventory | `findAllByStatusOrderByCreatedAtAsc` | ALL 인지 확인 |

## Slow Query Log 활성화 (msa 운영 권장)

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.5;
SET GLOBAL log_queries_not_using_indexes = 'ON';
```

application.yml 권장:
```yaml
spring:
  jpa:
    properties:
      hibernate:
        generate_statistics: true   # 메트릭 노출
```

→ Micrometer 로 Hibernate 통계 노출 + Prometheus alarm.

## ADR-0020 와 결합 — TX 안의 lock 보유 시간

```kotlin
// ADR-0020 violation example (가상)
@Transactional
fun processOrder(order: Order) {
    val saved = orderRepo.save(order)         // X-lock 시작
    paymentClient.charge(saved)               // 외부 IO! 수초 가능
    saved.markPaid()
    // X-lock 보유 시간 = save + HTTP 시간 → deadlock 위험
}
```

해결 (ADR-0020):
```kotlin
@Transactional
fun saveOrder(order: Order): Order = orderRepo.save(order)

// 외부 IO 는 트랜잭션 밖
suspend fun processOrder(order: Order) {
    val saved = orderTransactionalService.saveOrder(order)  // TX 끝남
    paymentClient.charge(saved)                              // lock 없음
    orderTransactionalService.markPaid(saved.id)            // 새 짧은 TX
}
```

→ lock 보유 시간 ms 단위로 단축. 16 에서 자세히.

## msa 쿼리 안티패턴 점검 — 발견 사항

### LIKE 미사용 (✅)

코드베이스 grep 결과 `LIKE '%...'` 패턴 없음. 검색은 모두 ES/OpenSearch.

### 함수 적용 (✅)

`DATE(created_at)` 같은 함수 적용 WHERE 안티패턴 발견 안 됨. JPA derived query 가 컬럼 직접 비교라서 자연스럽게 회피.

### NOT IN / `<>` (점검 필요)

QueryDSL 의 `ne`, `notIn` 사용 여부 — grep 으로 추가 확인 필요. 발견 시 케이스별 점검.

## 멘탈 모델

> 쿼리 패턴은 인덱스의 **사용 사례**. 인덱스 정의는 정적 그림, 쿼리는 동적 동작. 둘이 맞아야 빠르다. PR 리뷰는 "이 쿼리에 이 인덱스가 정말 활용되나?" 를 EXPLAIN 으로 검증.

## 핵심 포인트

- **PK Lookup, UNIQUE leftmost, FETCH JOIN** 은 잘 동작 — 거의 모든 서비스가 안전.
- **Wishlist 페이징 정렬** 은 filesort 후보 — (member_id, created_at) 추가 검토.
- **Inventory outbox** 인덱스 부재 — quant 패턴으로 통일.
- **Product/Order status 단독 인덱스** — selectivity 낮아 옵티마이저 외면, 제거 검토.
- **Reservation 만료 정리** 인덱스 부재 — (status, expired_at) + SKIP LOCKED.
- **ADR-0020 의 외부 IO 분리** 가 lock 보유 시간 단축의 본질 — 16 에서 자세히.

## 다음 학습
- [16-msa-tx-routing.md](16-msa-tx-routing.md) — TX / 격리 / RoutingDataSource 결합
- [17-improvements.md](17-improvements.md) — 인덱스 추가/제거/sharding ADR 후보
