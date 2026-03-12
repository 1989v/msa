# product:domain

상품(Product) 도메인의 순수 비즈니스 규칙 모듈.
Spring/JPA 의존성이 없으며, 컴파일 타임에 프레임워크 오염을 차단한다.

## 포함 요소

| 패키지 | 설명 |
|--------|------|
| `domain.product.model.Product` | 상품 Aggregate Root |
| `domain.product.model.Money` | 가격 Value Object (BigDecimal 래핑) |
| `domain.product.model.ProductStatus` | ACTIVE / INACTIVE |
| `domain.product.exception` | `ProductNotFoundException`, `InsufficientStockException` |

## 도메인 규칙

- `Product.create(name, price, stock)` — 생성 시 ACTIVE 상태
- `product.decreaseStock(quantity)` — 재고 부족 시 `InsufficientStockException`
- `product.deactivate()` — ACTIVE 상품만 비활성화 가능
- 가격은 `Money` 타입을 통해서만 전달 (원시 BigDecimal 직접 사용 금지)

## 테스트 실행

Spring Context 없이 순수 단위 테스트만 실행된다.

```bash
./gradlew :product:domain:test
```

## 의존성 제약

이 모듈에 Spring, JPA, Kafka 등 프레임워크 의존성을 추가하면 빌드 에러가 발생한다.
외부 의존성이 필요한 코드는 `product:app` 모듈에 작성한다.
