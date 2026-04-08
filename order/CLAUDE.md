# Order Service

주문 생성, 상태 전이, 외부 결제 연동을 담당하는 커머스 핵심 서비스.

## Modules

| Gradle path | 역할 |
|---|---|
| `:order:domain` | Pure Kotlin 도메인 (Order, OrderItem, Money, OrderStatus) |
| `:order:app` | Spring Boot 앱 (port 8082) |

## Commands

```bash
./gradlew :order:app:build       # 빌드
./gradlew :order:domain:test     # 도메인 테스트 (Spring context 없음)
./gradlew :order:app:bootJar     # bootJar 생성
```

## Key Rules

- 주문 시 Product 서비스에 **상품 유효성 + 재고 차감** API 호출 필수
- 결제는 외부 시스템 연동 (PaymentPort) — 장애 시 CircuitBreaker 적용 (ADR-0015)
- Kafka 발행 토픽: `order.order.completed`, `order.order.cancelled`
- 도메인의 OrderStatus 상태 전이 규칙을 반드시 준수

## Docs

- [서비스 상세](docs/service.md) — 도메인 모델, 포트, 인프라 어댑터
