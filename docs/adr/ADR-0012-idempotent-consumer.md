# ADR-0012 Idempotent Consumer Pattern

## Status
Accepted

## Context

현재 모든 Kafka Consumer(inventory, fulfillment, order, search)에 멱등성 처리가 없다.
Producer 측은 `enable.idempotence=true`로 중복 발행을 방지하지만, Consumer 측은 Kafka 리밸런스, 브로커 장애, Consumer 재시작 시 동일 메시지를 재처리할 수 있다.

**위험 시나리오:**
- 재고 이중 예약 (order.order.completed 중복 수신)
- 풀필먼트 이중 생성 (inventory.stock.reserved 중복 수신)
- 주문 이중 취소 (inventory.reservation.expired 중복 수신)

ADR-0011에서 Phase 2로 계획된 항목이며, `processed_event` 테이블 + eventId 기반 중복 제거 방식이 로드맵에 명시되어 있다.

## Decision

### 1. eventId 도입

모든 Kafka 이벤트 메시지에 고유 `eventId: String` (UUID) 필드를 추가한다.

- Outbox 패턴 사용 서비스: OutboxJpaEntity에 `eventId` 컬럼 추가, 발행 시 Kafka 메시지에 포함
- 직접 발행 서비스(order, product): 이벤트 생성 시 UUID 할당

### 2. processed_event 테이블

각 Consumer 서비스의 DB에 `processed_event` 테이블을 생성한다.

```sql
CREATE TABLE processed_event (
    event_id    VARCHAR(36) PRIMARY KEY,
    topic       VARCHAR(100) NOT NULL,
    processed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_processed_at (processed_at)
);
```

- 보관 주기: 7일 (스케줄러로 오래된 레코드 삭제)

### 3. Consumer 중복 체크 흐름

```
메시지 수신 → eventId 추출
  → processed_event 조회
    → 존재하면: ACK 후 skip (이미 처리됨)
    → 없으면: 비즈니스 로직 실행 + processed_event INSERT (같은 트랜잭션)
      → ACK
```

### 4. 공통 모듈 제공

common 모듈에 다음을 제공한다:
- `ProcessedEventRepository` 인터페이스 (Port)
- `ProcessedEventJpaEntity` JPA 엔티티
- `IdempotentEventHandler` 유틸리티 — 중복 체크 + 비즈니스 로직 실행을 감싸는 헬퍼

### 5. 적용 범위

| 서비스 | Consumer | 적용 |
|--------|----------|------|
| inventory | InventoryEventConsumer | ✓ |
| fulfillment | FulfillmentEventConsumer | ✓ |
| order | OrderEventConsumer | ✓ |
| search | ProductIndexingConsumer | △ (ES는 document ID로 자연 멱등, eventId 로깅만) |

## Alternatives Considered

1. **Kafka Exactly-Once (Transactional Consumer)**: Consumer + Producer를 트랜잭션으로 묶는 방식. DB 트랜잭션과 Kafka 트랜잭션이 분리되어 있어 적용 불가.
2. **Redis 기반 dedup**: 빠르지만 Redis 장애 시 보장 불가. DB 기반이 더 안전.
3. **Kafka Header 기반 eventId**: 메시지 본문 대신 Header에 eventId를 넣는 방식. 직렬화/역직렬화 시 누락 위험.

## Consequences

**긍정적:**
- at-least-once → effectively-once 시맨틱 달성
- 리밸런스/재시작 시에도 데이터 정합성 보장
- 공통 모듈로 일관된 패턴 적용

**부정적:**
- processed_event INSERT로 인한 미미한 쓰기 부하
- 7일 보관 정책 관리 필요 (스케줄러)
- 기존 이벤트 클래스에 eventId 필드 추가 필요 (하위 호환성 고려)
