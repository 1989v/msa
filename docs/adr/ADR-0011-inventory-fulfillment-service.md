# ADR-0011 Inventory + Fulfillment Service 추가

## Status
Proposed

## Context

기존 Commerce Platform에 재고관리(Inventory) + 풀필먼트(Fulfillment) 도메인이 없다.
Order 서비스는 존재하지만, 재고 예약/차감과 출고 프로세스가 없어 전체 주문 흐름이 불완전하다.

핵심 설계 결정:
1. 2개의 독립 서비스 (inventory-service, fulfillment-service) 추가
2. Outbox 패턴으로 이벤트 발행의 원자성 보장
3. Saga Choreography로 서비스 간 분산 트랜잭션 처리

## Decision

### 1. 서비스 분리 기준
- Inventory: 재고 예약/차감/복구 (강한 정합성)
- Fulfillment: 출고 상태 관리 (상태 머신)
- Warehouse는 Phase 1에서 Inventory의 warehouse_id 필드로 처리, Phase 2에서 분리 검토

### 2. Outbox 패턴 도입
- DB 트랜잭션과 이벤트 발행의 원자성 보장
- Phase 1: Polling Publisher (`@Scheduled`)
- Phase 2: CDC (Debezium) 전환 가능

### 3. 재고 모델: 예약 기반
- `available_qty` / `reserved_qty` 분리
- Optimistic Lock (`@Version`)으로 동시성 제어
- Phase 2에서 Redis Lua script fast-path 추가

### 4. 이벤트 흐름: Saga Choreography
- 중앙 오케스트레이터 없이 이벤트 기반으로 서비스 간 연동
- 보상 트랜잭션은 각 서비스가 자체 처리

## Alternatives Considered

1. **Saga Orchestrator (Order가 중앙 제어)**: 복잡도 증가, Phase 1에서는 과도
2. **Redis 우선 전략**: 인프라 복잡도 증가, Phase 2로 연기
3. **단일 서비스 (Inventory+Fulfillment)**: 도메인 경계가 다름, SRP 위반

## Consequences

**긍정적:**
- 서비스별 독립 배포/스케일링 가능
- Outbox로 이벤트 유실 방지
- Phase 2 확장 경로 명확

**부정적:**
- 서비스 수 증가 (운영 복잡도)
- Outbox Polling은 1초 지연 존재 (CDC 전환으로 해소)
- Saga Choreography는 흐름 추적이 어려움 (향후 모니터링 필요)
