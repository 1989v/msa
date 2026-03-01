# ADR-0003: 서비스 간 통신 방식

## Status
Accepted

## Context
서비스 간 통신을 동기/비동기로 분리해야 한다. 장애 전파 방지와 결합도 감소 필요.

## Decision
- **동기**: WebClient + Resilience4j CircuitBreaker (Gateway → 내부 서비스, 외부 API 호출)
- **비동기**: Kafka 이벤트 기반 (도메인 이벤트 전파, 검색 인덱스 업데이트)
- Kafka 토픽 명명: `{domain}.{entity}.{event}` (예: product.item.created, order.order.placed)
- CircuitBreaker: Sliding Window 기반, 실패율 50% 이상 시 Open, Half-open 지원
- Timeout: 외부 API 3초, 내부 서비스 5초
- Retry: 멱등 요청에 한해 최대 3회, 지수 백오프 적용

## Alternatives Considered
- gRPC: Protocol Buffer 관리 부담, 팀 학습 비용
- REST without CircuitBreaker: 장애 전파 위험
- RabbitMQ: Kafka 대비 대용량 처리 및 리플레이 기능 부족

## Consequences
- 서비스 간 강한 일관성 불가 → Eventual Consistency 허용
- Kafka Consumer Group 기반 메시지 처리로 수평 확장 지원
- Dead Letter Queue 설계 필요
