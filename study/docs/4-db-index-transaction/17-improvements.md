---
parent: 4-db-index-transaction
seq: 17
title: msa 개선 제안 종합 — 인덱스 / 격리 / Sharding ADR 후보
type: deep
created: 2026-05-01
---

# 17. msa 개선 제안 종합 — 인덱스 / 격리 / Sharding ADR 후보

## 핵심 정의

14-16 의 분석을 바탕으로 **즉시 실행 가능한 개선** 과 **ADR (Architecture Decision Record, 아키텍처 결정 기록) 검토 후보** 를 정리한다. 우선순위 + 영향 + 비용 표로.

각 항목은:
- **Why** — 현재 문제 또는 미래 위험
- **What** — 구체 액션
- **How** — DDL / 코드 / ADR
- **Risk** — 부작용
- **Priority** — High / Medium / Low

## 우선순위 표

| # | 제안 | 영역 | Priority |
|---|---|---|---|
| 1 | inventory.outbox_event 에 (status, created_at) 인덱스 추가 | 인덱스 | High |
| 2 | product/order 의 status 단독 인덱스 제거 또는 복합화 | 인덱스 | Medium |
| 3 | Wishlist 페이징 정렬 — keyset OR 인덱스 추가 | 쿼리/인덱스 | Medium |
| 4 | reservation.expired_at 인덱스 + SKIP LOCKED 도입 | 인덱스/Lock | Medium |
| 5 | OutboxRelay multi-worker + SKIP LOCKED ADR | Lock | Medium |
| 6 | Read-after-write stickiness ADR | Routing | Medium |
| 7 | audit_log partition (시간 기반) ADR | Sharding | Low (미래) |
| 8 | quant tenant 별 sharding 검토 ADR | Sharding | Low (미래) |
| 9 | DDL 정책 ADR — INSTANT/INPLACE 명시 + Flyway 분리 | Online DDL | Medium |
| 10 | Slow Query Log + Micrometer Hibernate stats 표준화 | Observability | High |
| 11 | EXPLAIN PR 첨부 컨벤션 | Process | High |

---

## 1. inventory.outbox_event 인덱스 추가 (High)

### Why

```kotlin
// inventory/OutboxJpaRepository
fun findAllByStatusOrderByCreatedAtAsc(status: String): List<OutboxJpaEntity>
```

- 현재 outbox_event 테이블에 인덱스 없음 → relay 쿼리가 ALL.
- outbox 가 누적되면 (특히 장애 시) 점점 느려짐.

### What

```sql
ALTER TABLE outbox_event
  ADD INDEX idx_outbox_status_created (status, created_at),
  ALGORITHM=INPLACE, LOCK=NONE;
```

### How

- Flyway V_n__add_outbox_event_index.sql.
- quant 의 `idx_outbox_unpublished` 와 동일 사상.
- 향후 `published_at IS NULL` 모델로 마이그레이션 검토 (status 컬럼 제거).

### Risk

- 매우 낮음. 인덱스 추가만, 쓰기 부하 약간 증가.

---

## 2. product/order status 단독 인덱스 제거 또는 복합화 (Medium)

### Why

```sql
-- product
INDEX idx_products_status (status)
-- order
INDEX idx_orders_status (status)
```

- selectivity 낮음 (3-4 distinct).
- 옵티마이저가 거의 외면 → 디스크/write 비용만.

### What

옵션 A — 제거:
```sql
ALTER TABLE products DROP INDEX idx_products_status, ALGORITHM=INPLACE;
ALTER TABLE orders DROP INDEX idx_orders_status, ALGORITHM=INPLACE;
```

옵션 B — 복합으로 진화:
```sql
ALTER TABLE orders DROP INDEX idx_orders_status, ALGORITHM=INPLACE;
ALTER TABLE orders DROP INDEX idx_orders_user_id, ALGORITHM=INPLACE;
ALTER TABLE orders ADD INDEX idx_user_status_created (user_id, status, created_at), ALGORITHM=INPLACE;
```

### How

- 운영 트래픽에서 EXPLAIN ANALYZE 로 활용 빈도 측정 후 결정.
- pt-query-digest 의 인덱스 사용 통계 (`Rows_examined / Key_used`) 확인.

### Risk

- 제거 후 특정 쿼리에서 type=ALL 회귀 가능 — 사전 EXPLAIN 점검 필수.

---

## 3. Wishlist 페이징 (Medium)

### Why

```sql
SELECT * FROM wishlist_items WHERE member_id=? ORDER BY created_at DESC LIMIT 20;
```

- 현 인덱스 (member_id, product_id) → filesort 발생.

### What

옵션 A — 인덱스 추가:
```sql
ALTER TABLE wishlist_items
  ADD INDEX idx_member_created (member_id, created_at DESC),
  ALGORITHM=INPLACE, LOCK=NONE;
```

옵션 B — Keyset pagination:
```kotlin
fun findByMemberIdAfterCursor(memberId: Long, cursor: LocalDateTime, size: Int): List<...>
// SQL: WHERE member_id=? AND created_at < :cursor ORDER BY created_at DESC LIMIT :size
```

### How

- API 가 cursor 지원하면 옵션 B 가 우월 (인덱스 추가 없어도 효율적).
- 기존 offset 페이징 유지하면 옵션 A.

### Risk

- 인덱스 추가의 경우 write 비용 +5% 정도. 작음.

---

## 4. reservation 만료 처리 (Medium)

### Why

가설 — 만료된 예약 정리 배치:
```sql
SELECT * FROM reservation WHERE status='PENDING' AND expired_at < NOW() FOR UPDATE;
```

- 현재 인덱스 없음 → ALL.
- 멀티 worker 안전성 X.

### What

```sql
ALTER TABLE reservation
  ADD INDEX idx_reservation_status_expired (status, expired_at),
  ALGORITHM=INPLACE, LOCK=NONE;
```

```kotlin
@Query("""
    SELECT r FROM ReservationJpaEntity r
    WHERE r.status = 'PENDING' AND r.expiredAt < :now
""")
@QueryHints(
    QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"),
)
@Lock(LockModeType.PESSIMISTIC_WRITE)
fun findExpiredForUpdate(now: LocalDateTime, pageable: Pageable): List<ReservationJpaEntity>
```

native query 로 SKIP LOCKED:
```sql
SELECT * FROM reservation
WHERE status='PENDING' AND expired_at < :now
LIMIT 100 FOR UPDATE SKIP LOCKED;
```

### Risk

- SKIP LOCKED 는 MySQL 8.0+. 이미 msa 가 사용 중이라 OK.

---

## 5. OutboxRelay multi-worker ADR 후보 (Medium)

### Why

현 OutboxRelay 는 단일 worker 가정. Phase 3 / 트래픽 증가 시 worker 늘릴 때 충돌 위험.

### What — ADR 초안

> **Title**: ADR-0028: Outbox Relay multi-worker with SKIP LOCKED
>
> **Decision**: outbox 폴링 시 `FOR UPDATE SKIP LOCKED` 사용 + worker N=2~4 까지 horizontal scale.
>
> **Trade-off**:
> - + throughput 향상
> - + worker 장애 isolation
> - − native query 사용 (JPA derived 쿼리 표현 불가)
> - − InnoDB 8.0+ 의존 (이미 OK)

### How

```kotlin
@Repository
class OutboxNativeQueryRepository(private val em: EntityManager) {
    fun findAndLockBatch(size: Int): List<OutboxEntity> {
        val sql = """
            SELECT * FROM outbox
            WHERE published_at IS NULL
            ORDER BY occurred_at ASC
            LIMIT :size
            FOR UPDATE SKIP LOCKED
        """.trimIndent()
        return em.createNativeQuery(sql, OutboxEntity::class.java)
            .setParameter("size", size)
            .resultList as List<OutboxEntity>
    }
}
```

### Risk

- TX 내에서 lock 잡고 publish 하는 패턴은 외부 IO 와 lock 시간 충돌 → ADR-0020 위반.
- 해결: 두 단계 (read+lock → publish 후 update). publish 는 TX 밖.

---

## 6. Read-after-write stickiness ADR (Medium)

### Why

```kotlin
// wishlist 추가 직후 즉시 조회 → replica 라우팅 → 못 찾을 수 있음
```

### What — ADR 초안

> **Title**: ADR-0029: Read-after-Write 라우팅 정책
>
> **Decision**: 사용자 단위 cookie/header 로 N=2초 stickiness, 그 시간 내 모든 read 는 master 강제.
>
> **Implementation**: HandlerInterceptor 에서 cookie 검출 → ThreadLocal 에 forceMaster=true → RoutingDataSource 가 readOnly TX 라도 MASTER 선택.

### How

```kotlin
// RoutingDataSource 수정
override fun determineCurrentLookupKey(): DataSourceType {
    if (RoutingContext.isForceMaster()) return DataSourceType.MASTER
    return if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
        DataSourceType.REPLICA else DataSourceType.MASTER
}

// Interceptor
class StickinessInterceptor : HandlerInterceptor {
    override fun preHandle(req: HttpServletRequest, ...): Boolean {
        val cookie = req.cookies?.find { it.name == "rw_sticky" }
        if (cookie != null) RoutingContext.setForceMaster(true)
        return true
    }
}

// Write API 가 응답 시 cookie 발급 (Set-Cookie: rw_sticky=1; Max-Age=2)
```

### Risk

- master 부하 일시적 ↑.
- cookie 없는 client 는 보호 안 됨 — 클라이언트 협력 필요.

---

## 7. audit_log partition (Low — 미래)

### Why

`quant.audit_log` 는 append-only. 시간이 지나면 row 폭증.

### What — ADR 초안

> **Title**: ADR-0030: 시간 기반 audit_log partition
>
> **Decision**: MySQL `PARTITION BY RANGE (TO_DAYS(at))` 월 단위. 6개월 이상 partition 은 cold storage 로.

### How

```sql
ALTER TABLE audit_log
PARTITION BY RANGE (TO_DAYS(at)) (
    PARTITION p202604 VALUES LESS THAN (TO_DAYS('2026-05-01')),
    PARTITION p202605 VALUES LESS THAN (TO_DAYS('2026-06-01')),
    ...
    PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

### Risk

- partition pruning 동작 확인 (`EXPLAIN PARTITIONS`).
- 인덱스가 모든 partition 에 복제 → 디스크 영향.
- partition 추가는 운영 작업 (자동화 cron 필요).

---

## 8. quant tenant sharding (Low — 미래)

### Why

INV-05 모든 쿼리가 tenant 기반 → tenant 별 shard 가 자연스러운 진화.

### What — ADR 초안

> **Title**: ADR-0031: Quant tenant sharding 전략
>
> **Decision**: tenant_id hash 기반 shard 4개. application 레벨 routing (Vitess 또는 ShardingSphere 검토).

### Risk

- 분산 트랜잭션 불가 → 도메인 invariant 가 single-tenant 안에 갇혀야 함 (이미 OK).
- 운영 복잡도 ↑↑.

---

## 9. DDL 정책 ADR (Medium)

### What

> **Title**: ADR-0032: 운영 DDL 정책
>
> **Decision**:
> 1. 모든 ALTER 는 ALGORITHM, LOCK 명시.
> 2. 1M row 이상 테이블은 Flyway 자동 실행 X — 운영 작업으로 분리.
> 3. INSTANT 가능한 변경만 Flyway 허용.
> 4. INPLACE/COPY 는 운영자가 pt-osc / gh-ost 로 수행.

### Why

08 의 MDL 사슬 시나리오 — Flyway startup 의 DDL 한 줄이 서비스 전체 정지를 만들 수 있음.

---

## 10. Slow Query Log + Hibernate Stats (High)

### What

application.yml:
```yaml
spring:
  jpa:
    properties:
      hibernate:
        generate_statistics: true
        session.events.log.LOG_QUERIES_SLOWER_THAN_MS: 500

management:
  metrics:
    enable:
      hibernate: true
```

운영 my.cnf:
```
slow_query_log = 1
long_query_time = 0.5
log_queries_not_using_indexes = 1
```

### How

- Micrometer 로 Hibernate 통계 → Prometheus 스크랩 → Grafana 대시보드.
- pt-query-digest 정기 실행 (cron) → 결과 Slack alarm.

### Risk

- log_queries_not_using_indexes 가 너무 시끄러우면 노이즈. 적절한 long_query_time 조합.

---

## 11. EXPLAIN PR 첨부 컨벤션 (High)

### What

> **Convention**: 새 쿼리 / 인덱스 추가 PR 에 EXPLAIN ANALYZE 결과 첨부 의무.

### Template

```markdown
## EXPLAIN

### 쿼리 1: 사용자 주문 조회
\`\`\`sql
SELECT ... FROM orders WHERE user_id=? AND status=?;
\`\`\`

\`\`\`
type: ref   key: idx_user_status_created   rows: 100   Extra: Using index condition
\`\`\`

✅ type=ref, Extra=Using index condition.
```

### How

- PR template 에 추가 (msa 의 .github/pull_request_template.md).
- 리뷰어가 EXPLAIN 미첨부 시 차단.

---

## 우선순위별 로드맵

### Quick Win (1-2 sprint)

- [10] Slow Query Log + Hibernate Stats
- [11] EXPLAIN PR 첨부
- [1] inventory outbox 인덱스
- [3] Wishlist 페이징 (keyset)

### Mid-term (1-2 분기)

- [2] status 단독 인덱스 정리
- [4] reservation 만료 처리 + SKIP LOCKED
- [5] OutboxRelay multi-worker ADR
- [6] Read-after-write stickiness ADR
- [9] DDL 정책 ADR

### Long-term (1-2 년)

- [7] audit_log partition
- [8] quant sharding

## 멘탈 모델

> 개선은 **3 가지 축**으로 분류:
> 1. **Quick Win** — 위험 적고 즉시 효과 (Slow log, EXPLAIN 컨벤션).
> 2. **인덱스 정리** — selectivity / 활용 빈도 검증 후 추가/제거.
> 3. **ADR 후보** — 정책 변경이라 신중. stickiness, sharding, DDL 정책.

## 핵심 포인트

- 즉시: Slow log + EXPLAIN PR 컨벤션 + inventory outbox 인덱스.
- 중기: status 단독 인덱스 정리, SKIP LOCKED 도입, stickiness, DDL 정책 ADR.
- 장기: partition / sharding (트래픽 임계값 도달 시).
- 각 변경 전후 EXPLAIN ANALYZE + p99 latency 측정 필수 (ADR-0025 latency budget 와 결합).

## 다음 학습
- [18-interview-qa.md](18-interview-qa.md) — 본 학습 면접 카드
- 외부 학습: ADR-0028~0032 초안 검토.
