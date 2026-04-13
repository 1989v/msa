# 6. Testing Strategy

> BDD 기반 레이어별 격리 테스트 — 도메인은 순수 단위, 인프라는 실제 DB

---

## 프레임워크 선택

| 도구 | 용도 | 비고 |
|------|------|------|
| **Kotest 5.9.1** | 테스트 프레임워크 | BehaviorSpec (BDD) |
| **MockK 1.13.16** | Mocking | Mockito 금지 (Kotlin first) |
| **H2** | 인메모리 DB | Infrastructure 테스트 |
| **Kotest Assertions** | 검증 | `shouldBe`, `shouldThrow` |

---

## 레이어별 테스트 전략

| 레이어 | 방식 | Spring Context | Mock 대상 | 빌드 명령 |
|--------|------|:---:|-----------|----------|
| **Domain** | 순수 단위 테스트 | X | 금지 | `./gradlew :product:domain:test` |
| **Application** | UseCase 테스트 | X | Port 인터페이스 | `./gradlew :product:domain:test` |
| **Infrastructure** | 통합 테스트 | O | 최소 (실제 DB) | `./gradlew :product:app:test` |
| **Presentation** | API 테스트 | O | Service 레이어 | `./gradlew :product:app:test` |

---

## Domain Layer — 순수 단위 테스트

프레임워크 의존성 없이 도메인 로직만 검증. Mock 금지.

```kotlin
// product/domain/src/test/.../domain/product/model/ProductTest.kt
class ProductTest : BehaviorSpec({
    given("상품 생성 시") {
        `when`("유효한 이름과 가격이 주어지면") {
            then("ACTIVE 상태의 상품이 생성되어야 한다") {
                val product = Product.create("테스트 상품", Money(1000.toBigDecimal()), 10)
                
                product.name shouldBe "테스트 상품"
                product.price shouldBe Money(1000.toBigDecimal())
                product.status shouldBe ProductStatus.ACTIVE
            }
        }
        
        `when`("가격이 0 이하이면") {
            then("예외가 발생해야 한다") {
                shouldThrow<BusinessException> {
                    Product.create("테스트", Money(0.toBigDecimal()), 10)
                }
            }
        }
    }
})
```

**핵심**: `product/domain/build.gradle.kts`에 Spring/JPA 의존성이 없으므로 프레임워크 코드가 도메인에 침투하면 **컴파일 에러**.

---

## Application Layer — UseCase 테스트

Port 인터페이스를 MockK로 mock하여 비즈니스 로직 검증.

```kotlin
class CreateProductServiceTest : BehaviorSpec({
    val productRepository = mockk<ProductRepositoryPort>()
    val eventPublisher = mockk<ProductEventPort>()
    val service = CreateProductService(productRepository, eventPublisher)
    
    given("상품 생성 요청") {
        val command = CreateProductCommand("상품A", 1000, 10)
        
        `when`("정상 요청") {
            every { productRepository.save(any()) } returns Product.create(...)
            every { eventPublisher.publish(any()) } just runs
            
            then("상품이 저장되고 이벤트가 발행된다") {
                val result = service.execute(command)
                result.name shouldBe "상품A"
                verify { productRepository.save(any()) }
                verify { eventPublisher.publish(any()) }
            }
        }
    }
})
```

---

## Infrastructure Layer — 통합 테스트

Spring Context + 실제 DB (H2)로 어댑터 동작 검증.

```kotlin
@SpringBootTest
class ProductRepositoryAdapterTest : BehaviorSpec({
    // Spring 주입
    val adapter: ProductRepositoryAdapter = ...
    
    given("상품 저장") {
        `when`("유효한 상품이 주어지면") {
            then("JPA로 저장되고 도메인 모델로 반환된다") {
                val product = Product.create("테스트", Money(1000.toBigDecimal()), 10)
                val saved = adapter.save(product)
                saved.id shouldNotBe null
            }
        }
    }
})
```

---

## Kotest BehaviorSpec (BDD)

Given-When-Then 구조로 비즈니스 요구사항을 자연어에 가깝게 표현.

```
given("재고 예약 시")
    when("가용 수량이 충분하면")
        then("예약 수량만큼 차감된다")
    when("가용 수량이 부족하면")
        then("InsufficientStockException이 발생한다")
```

**Mockito 대신 MockK**:
- Kotlin 네이티브 (suspend 함수, companion object 지원)
- `every { }` / `verify { }` 문법이 Kotlin idiom에 자연스러움

---

## 빌드 명령

```bash
# 전체 테스트
./gradlew test

# 도메인 단위 테스트만 (Spring context 없이, 빠름)
./gradlew :product:domain:test
./gradlew :order:domain:test

# 서비스 전체 테스트 (통합 포함)
./gradlew :product:app:test
```

**근거**: `docs/conventions/testing.md` · `docs/adr/ADR-0014-code-convention.md`

---

*Code references: `docs/conventions/testing.md` · `{service}/domain/src/test/` · `{service}/app/src/test/`*
