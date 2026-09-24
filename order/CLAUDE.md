# Order Service

주문 생성, 상태 전이, 외부 결제 연동을 담당하는 커머스 핵심 서비스.

## Modules

| Gradle path | 역할 |
|---|---|
| `:order:domain` | Pure Kotlin 도메인 (Order, OrderItem, Money, OrderStatus) |
| `:order:feature` | 비-bootable 라이브러리 — **commerce:app 이 폴드** (ADR-0058). 전용 datasource `order_db` |

## 구조 상태 (ADR-0083)

표준 준수 (2026-08-26, 플랜 P3 완료) — 두 방식으로 갈려 있던 디렉토리를 `git mv` 로 합쳤다(36파일, package 무변경). UseCase 인터페이스 3 · Port 4 · Adapter 5. Outbox·멱등 원장은 common 서브인터페이스(`OrderOutboxRepository`·`OrderProcessedEventRepository`) — 정본 패턴.

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
- **금액은 원 단위 `Long`**(`Money.amount`). `order_items` 는 `unit_price_won` 을 읽고, 확장 단계라 옛 `unit_price` 에도 같은 값을 쓴다(삭제는 다음 단계)
- **읽기 모델**(`product_view`·`seller_view`·`coupon_definition_view`·`user_coupon_view`·`point_balance_view`)은
  `OrderReadModelConsumer`(그룹 `order-read-model`)가 이벤트로만 채운다. 늦게 온 옛 이벤트는 `occurred_at` 으로 거른다.
  플랫폼 판매자 1 은 이벤트가 없어 마이그레이션이 시드한다
- **배포 뒤 1회**: 상품 이벤트는 변경 때만 나가므로 기존 상품은 읽기 모델에 없다 —
  어드민 토큰으로 `POST /api/v1/admin/products/republish` 를 한 번 부른다(여러 번 불러도 안전).
  확인: `SELECT COUNT(*) FROM order_db.product_view` = `SELECT COUNT(*) FROM product_db.products`
- 주문서 `POST /api/v1/order-sheets`·장바구니 `/api/v1/cart/**` 는 ROLE_USER, 본인 것만. 가격 필드를 받지 않는다.
  판매 불가·쿠폰/포인트 불가는 422, 남의 주문서 조회는 없는 주문서와 같은 404

## Docs

- [서비스 상세](docs/service.md) — 도메인 모델, 포트, 인프라 어댑터
