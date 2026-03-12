# order:domain

주문(Order) 도메인의 순수 비즈니스 규칙 모듈.
Spring/JPA 의존성이 없으며, 컴파일 타임에 프레임워크 오염을 차단한다.

## 포함 요소

| 패키지 | 설명 |
|--------|------|
| `domain.order.model.Order` | 주문 Aggregate Root |
| `domain.order.model.OrderItem` | 주문 항목 Value Object |
| `domain.order.model.Money` | 금액 Value Object |
| `domain.order.model.OrderStatus` | PENDING / COMPLETED / CANCELLED |
| `domain.order.exception` | `OrderNotFoundException` 등 |

## 도메인 규칙

- 주문 생성 시 PENDING 상태
- 결제 완료 시 COMPLETED 전환
- COMPLETED 주문은 취소 불가
- 총 금액은 OrderItem 목록에서 자동 계산

## 테스트 실행

Spring Context 없이 순수 단위 테스트만 실행된다.

```bash
./gradlew :order:domain:test
```

## 의존성 제약

이 모듈에 Spring, JPA, Kafka 등 프레임워크 의존성을 추가하면 빌드 에러가 발생한다.
외부 의존성이 필요한 코드는 `order:app` 모듈에 작성한다.
