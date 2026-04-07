# Inventory + Fulfillment — Phase Roadmap

**Last updated**: 2026-04-07

---

## Phase 1: MVP (완료)

핵심 목표: 주문 → 재고 예약 → 풀필먼트 → 확정 차감 end-to-end 흐름 동작

### 포함 범위

| 영역 | 구현 내용 | 상태 |
|------|----------|------|
| **Inventory 도메인** | 예약 기반 재고 모델 (available/reserved 분리), Reservation entity | 완료 |
| **Fulfillment 도메인** | 상태 머신 (PENDING→PICKING→PACKING→SHIPPED→DELIVERED→CANCELLED) | 완료 |
| **동시성 제어** | DB Optimistic Lock (`@Version`) | 완료 |
| **이벤트 발행** | Outbox Polling Publisher (1초 간격) | 완료 |
| **서비스 간 연동** | Saga Choreography — order→inventory→fulfillment 이벤트 체인 | 완료 |
| **보상 트랜잭션** | shipped→확정, cancelled→해제, expired→주문취소 | 완료 |
| **예약 만료** | 스케줄러 기반 TTL 만료 자동 해제 (기본 30분) | 완료 |
| **API** | Inventory 5 endpoints, Fulfillment 5 endpoints | 완료 |
| **인프라** | MySQL master/replica (inventory_db, fulfillment_db), Docker Compose | 완료 |
| **테스트** | Domain 순수 단위 테스트, Application MockK 테스트 | 완료 |

### Phase 1 제약 (알려진 한계)

| 제약 | 영향 | 해소 Phase |
|------|------|-----------|
| warehouseId=1 하드코딩 | 단일 창고만 지원 | Phase 2 |
| Outbox Polling (1초 지연) | 이벤트 전파 지연 | Phase 2 |
| Idempotent consumer 미적용 | Kafka 중복 메시지 시 중복 처리 가능 | Phase 2 |
| Product 유효성 검증 없음 | 존재하지 않는 productId로 예약 가능 | Phase 2 |
| Gateway 라우팅 미적용 | Eureka 직접 접근만 가능 | Phase 2 |
| Redis 없음 | 높은 TPS에서 DB 병목 | Phase 3 |

---

## Phase 2: 운영 안정성 + 멀티 창고

핵심 목표: 프로덕션 레벨 안정성 확보, 멀티 창고 지원

### 포함 범위

| 영역 | 구현 내용 | 우선순위 |
|------|----------|---------|
| **Idempotent Consumer** | `processed_event` 테이블 + eventId 기반 중복 제거 | P0 |
| **Gateway 라우팅** | `/api/inventories/**`, `/api/fulfillments/**` 라우팅 추가 | P0 |
| **CDC (Debezium)** | Outbox Polling → Debezium CDC 전환 (지연 해소) | P1 |
| **Warehouse 서비스 분리** | 창고 관리 독립 서비스, 멀티 창고 라우팅 (closest warehouse) | P1 |
| **Product 유효성 검증** | WebClient로 Product 서비스 조회, Circuit Breaker 적용 | P1 |
| **Partial Fulfillment** | 하나의 주문 → 여러 창고에서 분할 출고 | P2 |
| **Reconciliation Batch** | DB ↔ 실제 재고 정합성 검증 배치 | P2 |
| **DLQ (Dead Letter Queue)** | 이벤트 처리 실패 시 DLQ로 이동, 재처리 메커니즘 | P2 |
| **Integration Test** | spring-kafka-test 기반 Outbox→Kafka E2E 테스트 | P2 |

### 의존 관계

```
Idempotent Consumer (독립)
Gateway 라우팅 (독립)
CDC ← Outbox Polling 대체
Warehouse 서비스 ← inventory의 warehouseId 활용
Product 검증 ← WebClient + Circuit Breaker
Partial Fulfillment ← Warehouse 서비스 완료 후
```

---

## Phase 3: 성능 최적화 (고트래픽 대응)

핵심 목표: 10만 TPS 급 트래픽 처리 가능한 구조

### 포함 범위

| 영역 | 구현 내용 | 우선순위 |
|------|----------|---------|
| **Redis Lua Script Fast-Path** | 재고 예약을 Redis에서 원자적 처리, DB는 비동기 반영 | P0 |
| **Redis ↔ DB Reconciliation** | 정기 배치로 Redis/DB 정합성 동기화 | P0 |
| **Admission Control** | 재고 초과 요청 사전 차단 (token bucket / Redis counter) | P1 |
| **Rate Limiting** | Flash sale 대비 API 레벨 rate limiting | P1 |
| **Hot Key Sharding** | `stock:{productId}:shard:{N}` — 인기 상품 Redis key 분산 | P1 |
| **CQRS Read Model** | 재고 조회 전용 read replica + cache | P2 |
| **부하 테스트** | k6 기반 시나리오 테스트 (flash sale, retry storm, partial failure) | P2 |
| **Redis 장애 Fallback** | Redis 장애 시 DB 기반 reserve, Circuit Breaker | P2 |

### 의존 관계

```
Redis Fast-Path (핵심)
  ← Reconciliation Batch (필수 동반)
  ← Hot Key Sharding (트래픽 분산)
  ← Redis Fallback (장애 대응)
Admission Control (독립)
Rate Limiting (독립)
CQRS (독립)
```

---

## Phase 4: 고도화 (장기)

| 영역 | 설명 |
|------|------|
| Kubernetes 배포 | HPA + autoscaling, Helm chart |
| 멀티 리전 재고 | region-local 재고, eventual 글로벌 동기화 |
| SLA 기반 출고 | 로켓배송 cut-off time, 배송 SLA 관리 |
| 물류 최적화 | Wave picking, zone picking, route optimization |
| Chaos Engineering | 장애 주입 테스트 (Redis 다운, Kafka lag, DB deadlock) |
| 검색 인덱싱 | 재고 수량 → Elasticsearch 실시간 반영 |

---

## Phase 간 전환 기준

| 전환 | 기준 |
|------|------|
| Phase 1 → 2 | Phase 1 기능 QA 통과 + 프로덕션 배포 준비 시작 |
| Phase 2 → 3 | 실제 트래픽 10K TPS 이상 또는 성능 병목 관측 시 |
| Phase 3 → 4 | 멀티 리전 확장 또는 SLA 요구사항 발생 시 |
