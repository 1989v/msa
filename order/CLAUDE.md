# Order Service

주문 생성, 상태 전이, 외부 결제 연동을 담당하는 커머스 핵심 서비스.

## Modules

| Gradle path | 역할 |
|---|---|
| `:order:domain` | Pure Kotlin 도메인 (Order, OrderItem, Money, OrderStatus) |
| `:order:feature` | 비-bootable 라이브러리 — **commerce:app 이 폴드** (ADR-0058). 전용 datasource `order_db` |

## 구조 상태 (ADR-0083)

모양은 표준(UseCase 인터페이스 3 · Port 4 · Adapter 5)이지만 **디렉토리가 두 방식으로 갈라져 있다** —
`order/order/controller/` 와 `order/presentation/order/controller/` 가 같은 패키지를 나눠 가진다 (feature 26 + domain 5 파일).
플랜 P3 에서 `git mv` 로 합친다. **그 전까지 새 파일은 `presentation/`·`application/`·`infrastructure/` 전체 경로 쪽에 만든다.**
Outbox 는 common 서브인터페이스(`OrderOutboxRepository`) — 정본 패턴.

## Commands

```bash
./gradlew :order:feature:build   # 빌드
./gradlew :order:domain:test     # 도메인 테스트 (Spring context 없음)
./gradlew :commerce:app:build    # 배포 단위(폴드 앱) 빌드
```

## Key Rules

- 주문 시 Product 서비스에 **상품 유효성 + 재고 차감** API 호출 필수
- 결제는 외부 시스템 연동 (PaymentPort) — 장애 시 CircuitBreaker 적용 (ADR-0015)
- Kafka 발행 토픽: `order.order.completed`, `order.order.cancelled`
- 도메인의 OrderStatus 상태 전이 규칙을 반드시 준수

## Docs

- [서비스 상세](docs/service.md) — 도메인 모델, 포트, 인프라 어댑터
