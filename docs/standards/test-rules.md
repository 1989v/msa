# Test Rules

## 프레임워크

- 테스트 프레임워크: **Kotest BehaviorSpec** (BDD 스타일)
- 테스트 더블: **MockK** 사용 (Mockito 금지)

## 레이어별 규칙

- **Domain 테스트**: Mock 사용 금지, 순수 단위 테스트
- **Application 테스트**: Outbound Port는 MockK로 Mock

## 파일 규칙

- 테스트 파일 위치: `src/test/kotlin/{패키지}/...`
- 테스트 파일 이름: 구현체와 동일 이름 + `Test` suffix

## 예시

```kotlin
class ProductTest : BehaviorSpec({
    given("상품 생성 시") {
        `when`("유효한 이름과 가격이 주어지면") {
            then("ACTIVE 상태의 상품이 생성되어야 한다") {
                val product = Product.create("테스트", Money(1000.toBigDecimal()), 10)
                product.status shouldBe ProductStatus.ACTIVE
            }
        }
    }
})
```
