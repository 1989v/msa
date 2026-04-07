# Inventory + Fulfillment Service — Requirements

## 1. 배경

기존 MSA 플랫폼에 재고관리(Inventory) + 풀필먼트(Fulfillment) 도메인을 신규 추가한다.
현재 Order 서비스가 존재하며, Kafka 기반 이벤트 발행 인프라가 갖춰져 있다.

## 2. Phase 1 범위 (MVP)

### 2.1 Inventory Service

**핵심 도메인: 예약 기반 재고 모델**

- `available_qty` / `reserved_qty` 분리
- 재고 예약 (reserve): available → reserved 이동
- 예약 확정 (confirm): reserved 확정 차감
- 예약 해제 (release): reserved → available 복구
- 재고 입고 (receive): available 증가
- 재고 조회: 상품별/창고별 가용 재고

**동시성 제어**
- DB optimistic lock (`@Version`) 기본 전략
- Redis Lua script 기반 fast-path는 Phase 2

**이벤트 발행**
- `inventory.stock.reserved` — 예약 성공
- `inventory.stock.released` — 예약 해제
- `inventory.stock.confirmed` — 확정 차감
- `inventory.reservation.expired` — TTL 만료

**Outbox 패턴**
- 도메인 이벤트를 outbox 테이블에 저장 (같은 TX)
- Outbox Polling Publisher가 Kafka로 발행
- Phase 2에서 CDC(Debezium)로 전환 가능

**예약 만료**
- Reservation에 `expiredAt` 필드
- 스케줄러가 만료된 예약 자동 해제

### 2.2 Fulfillment Service

**핵심 도메인: 출고 상태 머신**

상태 흐름:
```
PENDING → PICKING → PACKING → SHIPPED → DELIVERED
         ↘ CANCELLED (어느 단계에서든)
```

- 풀필먼트 생성 (주문 기반)
- 상태 전이 (상태 머신 기반, 유효하지 않은 전이 차단)
- 창고 배정

**이벤트 발행**
- `fulfillment.order.created`
- `fulfillment.order.shipped`
- `fulfillment.order.delivered`
- `fulfillment.order.cancelled`

### 2.3 서비스 간 연동 (이벤트 기반)

```
Order 생성 (order.order.completed)
  → Inventory 재고 예약 (inventory.stock.reserved)
    → Fulfillment 생성 (fulfillment.order.created)
      → 출고 완료 (fulfillment.order.shipped)
        → Inventory 확정 차감 (inventory.stock.confirmed)
```

보상 트랜잭션 (Saga Choreography):
- 재고 예약 실패 → 주문 취소 이벤트
- 결제 실패 → 예약 해제 이벤트
- 풀필먼트 취소 → 예약 해제 + 환불 이벤트

## 3. Phase 1 제외 (Phase 2+)

- Redis fast-path 재고 차감
- CDC (Debezium) 기반 outbox
- Warehouse 서비스 (Phase 1에서는 warehouse_id만 Inventory에 포함)
- Payment 서비스 연동 (기존 Order 서비스의 PaymentPort 활용)
- 멀티 창고 라우팅 / partial fulfillment
- Admission control / rate limiting
- CQRS read model
- 부하 테스트 (k6)

## 4. 기술 제약 (현재 프로젝트 컨벤션)

| 항목 | 규칙 |
|------|------|
| 언어 | Kotlin |
| 프레임워크 | Spring Boot 4.0.4, Spring Cloud 2025.1.0 |
| 모듈 구조 | Nested submodule (`inventory:domain`, `inventory:app`, `fulfillment:domain`, `fulfillment:app`) |
| 아키텍처 | Clean Architecture — Domain 레이어에 프레임워크 의존 금지 |
| 패키지 | `com.kgd.inventory`, `com.kgd.fulfillment` |
| 테스트 | Kotest BehaviorSpec + MockK |
| 이벤트 | Kafka, 토픽 네이밍 `{domain}.{entity}.{event}` |
| DB | MySQL (서비스별 독립 DB) — master/replica 구조 |
| API 응답 | `ApiResponse<T>` 래핑 |
| 서비스 디스커버리 | Eureka |

## 5. 인프라 추가 필요 항목

- MySQL: `inventory_db`, `fulfillment_db` (docker-compose.infra.yml에 추가)
- Kafka topics: inventory.*, fulfillment.* (자동 생성 or init script)
- Eureka 등록: inventory-service, fulfillment-service

## 6. Acceptance Criteria

- [ ] Inventory 예약/해제/확정 API 정상 동작
- [ ] Fulfillment 상태 전이 API 정상 동작 (유효하지 않은 전이 시 에러)
- [ ] 동시 예약 시 oversell 방지 (optimistic lock)
- [ ] Outbox → Kafka 이벤트 발행 정상 동작
- [ ] 예약 만료 스케줄러 정상 동작
- [ ] Domain 모듈에 Spring/JPA 의존성 없음
- [ ] 전체 빌드 성공 (`./gradlew build`)
- [ ] Domain 테스트 + Application 테스트 작성
