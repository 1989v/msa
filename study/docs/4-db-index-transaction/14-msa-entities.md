---
parent: 4-db-index-transaction
seq: 14
title: msa 엔티티 인덱스 전수 매핑
type: deep
created: 2026-05-01
---

# 14. msa 엔티티 인덱스 전수 매핑

## 핵심 정의

msa 11개 JVM 서비스의 **JPA `@Entity`** 와 **Flyway DDL** 에 정의된 인덱스/유니크 제약을 한 표로 정리한다. 면접에서 "회사 사례" 로 답할 때 이 표를 머리에 박아둔다.

이번 학습 시점 (2026-05-01) 의 스냅샷이며, 일부 서비스는 Hibernate DDL (Data Definition Language) auto-create 로 운영하고 있어 SQL 직접 정의가 없을 수 있음을 명시한다.

## 전수 표

| 서비스 | 테이블 | PK | UNIQUE | 일반 인덱스 | 비고 |
|---|---|---|---|---|---|
| **product** | products | `id BIGINT AI` | — | `idx_products_status (status)` | status selectivity 낮음 — 17 에서 제거 후보 |
| **order** | orders | `id BIGINT AI` | — | `idx_orders_user_id (user_id)`, `idx_orders_status (status)` | status 단독 인덱스 효과 의문 |
| **order** | order_items | `id BIGINT AI` | — | `idx_order_items_order_id (order_id)` (FK) | 표준 |
| **member** | members | `id BIGINT AI` | `uk_sso (sso_provider, sso_provider_id)` | — | email 인덱스 미정의 |
| **wishlist** | wishlist_items | `id BIGINT AI` | `uk_member_product (member_id, product_id)` | (UNIQUE 가 leftmost member_id 인덱스 역할) | created_at 정렬 시 filesort 가능 |
| **auth** | member_roles | `id BIGINT AI` | `uk_member_role (member_id, role)` | — | 표준 RBAC 패턴 |
| **inventory** | inventory | `id BIGINT AI` | — (productId+warehouseId UNIQUE 권장) | — | `@Version` 낙관락 사용 |
| **inventory** | reservation | `id BIGINT AI` | — | (order_id, expired_at 후보) | 만료 처리 배치에서 expired_at 자주 조회 |
| **inventory** | outbox_event | `id BIGINT AI` | — | (status, created_at 후보) | quant 의 outbox 와 비교 |
| **fulfillment** | fulfillment_orders | `id BIGINT AI` | — | (order_id 후보) | 외부 주문과 매핑 |
| **fulfillment** | outbox | `id BIGINT AI` | — | 동일 outbox 패턴 | 통합 후보 |
| **quant** | split_strategy | `BINARY(16)` (UUID) | — | `idx_strategy_tenant (tenant_id, created_at)` | multi-tenant |
| **quant** | strategy_run | `BINARY(16)` | — | `idx_run_tenant (tenant_id, started_at)`, `idx_run_strategy (strategy_id)` | |
| **quant** | round_slot | `BINARY(16)` | — | `idx_slot_run (run_id, round_index)`, `idx_slot_tenant (tenant_id)` | |
| **quant** | order | `BINARY(16)` | — | `idx_order_tenant (tenant_id, created_at)`, `idx_order_slot (slot_id)` | |
| **quant** | exchange_credential | `BINARY(16)` | `uq_cred_tenant_exchange (tenant_id, exchange)` | — | |
| **quant** | notification_target | `BINARY(16)` | — | `idx_notif_tenant (tenant_id)` | |
| **quant** | outbox | `BIGINT AI` | `uq_outbox_event (event_id)` | `idx_outbox_unpublished (published_at, occurred_at)`, `idx_outbox_tenant (tenant_id, occurred_at)` | **모범 사례** ✅ |
| **quant** | processed_event | `(event_id, consumer_group)` | (PK 가 UNIQUE) | — | dedupe 패턴 (ADR-0012) |
| **quant** | audit_log | `BIGINT AI` | — | `idx_audit_tenant_time (tenant_id, at)` | append-only |
| **quant** | paper_account | `BIGINT AI` | `uk_paper_account_strategy (tenant_id, strategy_id, base_asset)` | `idx_paper_account_tenant (tenant_id, strategy_id)` | |
| **code-dictionary** | concept | `BIGINT AI` | `concept_id VARCHAR(100) UNIQUE` | `idx_concept_category (category)`, `idx_concept_level (level)` | 검색은 OpenSearch 가 담당 |
| **code-dictionary** | concept_synonym | `BIGINT AI` | — | `idx_synonym_concept (concept_id)` (FK) | |
| **code-dictionary** | concept_relation | `BIGINT AI` | `uk_relation (source_concept_id, target_concept_id)` | (UNIQUE 가 인덱스 역할) | |
| **code-dictionary** | concept_index | `BIGINT AI` | — | `idx_concept_index_concept`, `idx_concept_index_file` | |
| **gifticon** | gifticons, share_*, push_subscription | `BIGINT AI` | (use case 별 UNIQUE) | DDL auto-generated | Hibernate DDL — 별도 관리 필요 |
| **chatbot** | conversation, message | `BIGINT AI` | — | (conversation_id, created_at 후보) | DDL auto-generated |
| **experiment** | experiment, variant | `BIGINT AI` | (experiment_key UNIQUE 권장) | DDL auto-generated | |
| **warehouse** | warehouse | `BIGINT AI` | — | DDL auto-generated | |
| **analytics** | (ClickHouse) | (sorted MergeTree key) | — | skip index | OLAP — 본 학습 범위 외 |
| **search** | (Elasticsearch) | doc_id | — | inverted index | 본 학습 범위 외 |

## 패턴 분류

### Pattern A: 단순 PK + 1-2 secondary

대부분의 entity (product, order, member, wishlist, auth) 가 이 패턴.

특징:
- BIGINT AUTO_INCREMENT PK (Primary Key, 기본 키).
- WHERE 자주 쓰는 컬럼에 단독 secondary 1-2 개.
- selectivity 검증 안 한 인덱스 (status 류) 가 종종 있음.

문제:
- low-cardinality (status, gender) 단독 인덱스는 옵티마이저가 외면 → 디스크/write 비용만 발생 (17 의 후보).

### Pattern B: 명시적 UNIQUE 비즈니스 키

`member.uk_sso`, `wishlist.uk_member_product`, `auth.uk_member_role`, `quant.uq_cred_tenant_exchange`.

특징:
- 비즈니스 룰 (1인 1 SSO (Single Sign-On, 단일 로그인) 매핑, 위시리스트 중복 방지) 을 DB 단으로 강제.
- UNIQUE 가 자동으로 leftmost 컬럼 (member_id 등) 인덱스 역할도 함.
- 별도 인덱스 추가 불필요한 경우 많음.

장점:
- 어플리케이션 버그가 도메인 invariant 깨도 DB 가 마지막 방어선.

함정:
- UNIQUE 위반 → DataIntegrityViolationException → application 에서 적절한 처리 필요 (이미 있는지 select 후 insert 패턴은 race condition 발생).

### Pattern C: Multi-Tenant 복합 인덱스 (quant)

`idx_*_tenant (tenant_id, ...)` 패턴 일관 적용.

특징:
- 모든 SELECT/UPDATE 가 `WHERE tenant_id = ?` 시작.
- tenant_id leftmost 로 필수 — INV-05 (도메인 invariant).

장점:
- tenant 격리 + 인덱스 효율 동시.
- 옵티마이저가 항상 tenant 부분으로 좁힐 수 있음.

함정:
- 단일 tenant 대량 데이터 시 hotspot — 인덱스 한쪽에 집중. 향후 sharding 후보.

### Pattern D: Outbox 인덱스 모범 (quant)

`idx_outbox_unpublished (published_at, occurred_at)` 가 정확히 outbox relay 쿼리에 맞춰 설계됨.

```sql
-- 쿼리 (OutboxJpaRepository.findTop100ByPublishedAtIsNullOrderByOccurredAtAsc)
SELECT * FROM outbox
WHERE published_at IS NULL
ORDER BY occurred_at
LIMIT 100;
```

- leftmost = published_at (IS NULL 검색 가능).
- 다음 컬럼 = occurred_at → ORDER BY 까지 인덱스로 해결 (filesort 없음).
- ✅ 모범 인덱스 설계.

비교 — inventory.outbox_event 는 인덱스 미정의:
```kotlin
@Table(name = "outbox_event")
class OutboxJpaEntity(
    ...
    var status: String = "PENDING",
    val createdAt: LocalDateTime,
    var publishedAt: LocalDateTime? = null,
)
```
- 기본 PK (id) 외 인덱스 없음.
- relay 쿼리 `findAllByStatusOrderByCreatedAtAsc("PENDING")` 가 ALL → 인덱스 후보 (17 에서).

### Pattern E: ProcessedEvent (멱등성)

`quant.processed_event`:
```sql
PRIMARY KEY (event_id, consumer_group)
```

- ADR (Architecture Decision Record, 아키텍처 결정 기록)-0012 의 idempotent consumer 패턴.
- PK 가 자연스러운 dedupe 키. 별도 secondary 불필요.
- INSERT 시 PK 충돌 → 이미 처리된 이벤트 → 무시.

다른 서비스 (order, fulfillment, inventory) 도 ProcessedEventJpaEntity 보유 — 패턴 통일.

## 잠재 문제 (17 에서 액션)

### 1. product.idx_products_status — 단독 status

- selectivity 낮음 (3-4 distinct).
- 운영에서 거의 안 탐.
- → 제거 후보.

### 2. order.idx_orders_status — 동일 문제

- → 제거 또는 (user_id, status, created_at) 복합으로 흡수.

### 3. wishlist 의 created_at 정렬

- `findByMemberId(memberId, pageable)` 의 기본 정렬이 `created_at DESC` 일 가능성.
- 현재 인덱스로는 filesort.
- → (member_id, created_at) 추가 후보 OR keyset pagination.

### 4. inventory.outbox_event 인덱스 부재

- relay 쿼리가 ALL 가능성.
- → (status, created_at) 인덱스 추가 (quant 와 동일 패턴).

### 5. inventory.reservation.expired_at 인덱스

- 만료 정리 배치에 자주 쓰일 컬럼. 인덱스 미정의.
- → (status, expired_at) 후보.

### 6. quant 의 round_slot 의 (run_id, round_index)

- ✅ 이미 잘 설계됨.

### 7. UUID PK 의 secondary 인덱스 비용

- quant 의 BINARY(16) PK → 모든 secondary leaf 가 16B PK 보유.
- BIGINT 8B 대비 2배 → 인덱스 크기 ↑.
- INV-05 (tenant_id 필수) 와 결합 시 (tenant_id, ...) leftmost 인덱스가 항상 있어 PK 직접 lookup 빈도는 낮음.
- → 디자인 trade-off 의식한 설계.

## 면접 답변 시 활용

> "저희 msa 는 11개 서비스 각자 MySQL DB 를 가지고, JPA `@Entity` 의 `@Table(uniqueConstraints, indexes)` + Flyway DDL 양쪽으로 인덱스를 정의합니다. 가장 정교한 건 quant 의 outbox — `(published_at, occurred_at)` 복합 인덱스로 IS NULL 조회 + 정렬을 한 인덱스로 해결합니다. multi-tenant 서비스는 모든 secondary 가 `(tenant_id, ...)` leftmost 로 시작하는 컨벤션이 있습니다. 단점은 enum status 단독 인덱스가 일부 남아 있어 selectivity 검증 후 제거가 필요합니다."

## 멘탈 모델

> 인덱스 전수표는 **DB 의 가구 배치도**. 어떤 가구 (인덱스) 가 있고, 어디에 (테이블) 배치돼 있고, 자주 쓰이는지 안 쓰이는지. 운영의 1순위는 안 쓰이는 가구 치우기 (불필요 인덱스 제거) + 자주 쓰는 가구 가까이 두기 (복합 인덱스 추가).

## 핵심 포인트

- **PK 컨벤션**: BIGINT AUTO_INCREMENT (대부분) / BINARY(16) UUID (quant, 글로벌 식별 필요).
- **UNIQUE = 비즈니스 룰의 마지막 방어선** — `uk_sso`, `uk_member_product`.
- **Multi-tenant** 는 항상 `(tenant_id, ...)` leftmost 패턴.
- **Outbox 인덱스의 모범** = quant 의 `idx_outbox_unpublished`.
- **저-카디널리티 단독 인덱스** (product/order 의 status) 는 운영에서 거의 안 탐 → 제거 후보.
- 일부 서비스는 Hibernate DDL auto 에 의존 → 명시 SQL + Flyway 통일이 권장.

## 다음 학습
- [15-msa-queries.md](15-msa-queries.md) — 자주 호출되는 쿼리 패턴 + slow 후보
- [17-improvements.md](17-improvements.md) — 인덱스 추가/제거 ADR 후보
