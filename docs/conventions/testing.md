# Testing Convention

## Framework

- **Test Framework**: Kotest BehaviorSpec (BDD style)
- **Test Double**: MockK (Mockito 사용 금지)

## Test File Rules

- **위치**: `src/test/kotlin/{package}/...`
- **파일 이름**: 구현체와 동일 이름 + `Test` suffix (예: `ProductTest.kt`)

## Layer-specific Rules

### Domain Tests

- Mock 사용 금지, 순수 단위 테스트
- Spring context 불필요
- domain 모듈에서 독립 실행 가능: `./gradlew :{service}:domain:test`

### Application Tests

- Outbound Port는 MockK로 Mock
- UseCase 중심 테스트

### Infrastructure Tests

- 통합 테스트
- 실제 DB/외부 시스템 테스트

### Presentation Tests

- API 테스트
- 요청/응답 검증

## BehaviorSpec Example

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

## Application Service Test Example

```kotlin
class ProductServiceTest : BehaviorSpec({
    val productRepositoryPort = mockk<ProductRepositoryPort>()
    val productEventPort = mockk<ProductEventPort>()
    val service = ProductService(productRepositoryPort, productEventPort)

    given("상품 생성 UseCase 실행 시") {
        `when`("유효한 커맨드가 주어지면") {
            every { productRepositoryPort.save(any()) } returns savedProduct
            every { productEventPort.publishCreated(any()) } just Runs

            then("상품이 저장되고 이벤트가 발행되어야 한다") {
                val result = service.execute(command)
                result.id shouldBe 1L
                verify { productEventPort.publishCreated(any()) }
            }
        }
    }
})
```

## Build Commands

```bash
./gradlew test                        # 전체 테스트
./gradlew :product:domain:test        # 도메인 단위 테스트만
./gradlew :product:app:test           # 앱 모듈 테스트
```
