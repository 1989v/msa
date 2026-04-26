# Code Convention 통합 레퍼런스

> **출처**: ADR-0014 에서 이전 (ADR-0026 분류 정책에 따른 재배치). 코드 작성 규칙이라 conventions/ 가 본질적 위치.
> **History**: 원본 ADR 본문은 git history 의 `ADR-0014-code-convention.md` 참조 (commit before this PR).

## Context

프로젝트 전반의 코드 작성 컨벤션이 여러 문서에 분산되어 있어, 새로운 서비스/모듈 추가 시 일관성 유지가 어렵다. 기존 코드에서 추출한 실제 패턴과 문서화된 규칙을 통합하여 단일 레퍼런스를 제공한다.

**관련 문서**:
- 아키텍처 원칙: `docs/architecture/00.clean-architecture.md`
- 패키지 구조: `docs/conventions/package-structure.md`
- 테스트 규칙: `docs/standards/test-rules.md`
- Kafka 컨벤션: `docs/architecture/kafka-convention.md`
- API 응답 포맷: `docs/conventions/api-format.md`

본 문서는 위 문서에서 다루지 않는 **네이밍, DI 방향, 클래스 역할 정의** 를 보완한다.

## 1. 클래스 네이밍 컨벤션

| 레이어 | 컴포넌트 | 네이밍 패턴 | 예시 |
|--------|---------|------------|------|
| **Domain** | Aggregate/Entity | `{Entity}` | `Product`, `Inventory`, `FulfillmentOrder` |
| | Value Object | `{Concept}` | `Money`, `ProductStatus`, `FulfillmentStatus` |
| | Domain Event | `{Entity}Event` (sealed class) | `InventoryEvent.StockReserved` |
| | Domain Exception | `{Concept}Exception` | `InsufficientStockException` |
| **Application** | UseCase (Inbound Port) | `{Action}{Entity}UseCase` | `CreateProductUseCase`, `ReserveStockUseCase` |
| | Service (UseCase 구현) | `{Entity}Service` | `ProductService`, `InventoryService` |
| | Transactional Service | `{Entity}TransactionalService` | `OrderTransactionalService` |
| | Outbound Port | `{Purpose}Port` | `ProductRepositoryPort`, `OutboxPort`, `PaymentPort` |
| | Command/Result | UseCase 내부 data class | `CreateProductUseCase.Command`, `.Result` |
| **Infrastructure** | JPA Entity | `{Entity}JpaEntity` | `ProductJpaEntity`, `OutboxJpaEntity` |
| | ES Document | `{Entity}EsDocument` | `ProductEsDocument` |
| | JPA Repository | `{Entity}JpaRepository` | `ProductJpaRepository` |
| | QueryDSL Repository | `{Entity}QueryRepository` | `ProductQueryRepository` |
| | Port 구현체 (Adapter) | `{Purpose}Adapter` | `ProductRepositoryAdapter`, `PaymentAdapter` |
| | Kafka Consumer | `{Entity}EventConsumer` | `InventoryEventConsumer` |
| | Kafka Event DTO | `{Entity}Events` / `{Domain}KafkaEvents` | `OrderEvents`, `InventoryKafkaEvents` |
| | Outbox Publisher | `OutboxPollingPublisher` | 서비스별 동일 이름 |
| | Config | `{Purpose}Config` | `KafkaConfig`, `DataSourceConfig` |
| **Presentation** | Controller | `{Entity}Controller` | `ProductController` |
| | Exception Handler | `{Entity}ExceptionHandler` | `ProductExceptionHandler` |
| | Request DTO | `{Action}{Entity}Request` | `CreateProductRequest` |
| | Response DTO | `{Entity}Response` | `ProductResponse` |

## 2. DI(의존성 주입) 방향 규칙

```
Controller → UseCase (interface)
                ↑
            Service (impl) → Port (interface)
                                  ↑
                              Adapter (impl)
```

- **Controller** 는 UseCase 인터페이스에만 의존 (구현체 모름)
- **Service** 는 Outbound Port 인터페이스에만 의존 (JPA/Kafka 모름)
- **Adapter** 는 Port 를 구현하고, 프레임워크 기술에 의존
- 생성자 주입만 사용 (field injection 금지)
- `@Component`/`@Service` 로 Spring 자동 주입

## 3. Domain 모델 생성 패턴

```kotlin
class Product private constructor(
    val id: Long?,
    val name: String,
    // ...
) {
    companion object {
        fun create(name: String, ...): Product { ... }   // 신규 생성
        fun restore(id: Long, ...): Product { ... }      // DB 복원
    }

    fun updateName(name: String) { ... }
}
```

- `private constructor` + factory method (`create`, `restore`)
- `create`: 비즈니스 검증 포함, id 는 null
- `restore`: DB 에서 복원, 검증 없이 상태 재구성
- mutable 필드는 `private set` + getter 메서드 또는 Kotlin property

## 4. JPA Entity ↔ Domain 매핑

```kotlin
@Entity @Table(name = "products")
class ProductJpaEntity(
    @Id @GeneratedValue val id: Long = 0,
    val name: String,
    // ...
) {
    fun toDomain(): Product = Product.restore(id, name, ...)

    companion object {
        fun fromDomain(product: Product) = ProductJpaEntity(
            id = product.id ?: 0,
            name = product.name,
        )
    }
}
```

- `toDomain()`: JPA Entity → Domain Model (인스턴스 메서드)
- `fromDomain()`: Domain Model → JPA Entity (companion object)

## 5. UseCase 인터페이스 패턴

```kotlin
interface CreateProductUseCase {
    fun execute(command: Command): Result

    data class Command(val name: String, val price: BigDecimal)
    data class Result(val id: Long, val name: String, val price: BigDecimal)
}
```

- 단일 `execute` 메서드
- `Command`/`Query`/`Result` 는 UseCase 내부 data class 로 정의
- 조회 UseCase 는 `Query` 사용

## 6. Transactional Service 분리 패턴

외부 API 호출이 포함된 유스케이스에서 DB 커넥션 점유를 최소화하기 위해 사용:

```
TX1 (짧은 트랜잭션): 엔티티 PENDING 저장
→ 외부 API 호출 (트랜잭션 밖)
→ TX2 (짧은 트랜잭션): 결과 반영 (COMPLETED/FAILED)
```

- `{Entity}TransactionalService`: 짧은 DB 트랜잭션만 담당
- `{Entity}Service`: 전체 흐름 오케스트레이션

상세 트랜잭션 사용 규칙 → ADR-0020 (분해 PR 진행 후 conventions 로 이전 예정)

## 7. 테스트 파일 규칙

- 파일명: `{ClassName}Test.kt`
- 프레임워크: Kotest BehaviorSpec + MockK
- Domain 테스트: Mock 없이 순수 단위 테스트
- Application 테스트: Outbound Port 를 MockK 로 대체
- 위치: `src/test/kotlin/{동일 패키지}/`

## 8. Application Main Class

```kotlin
@SpringBootApplication
class {Service}Application

fun main(args: Array<String>) {
    runApplication<{Service}Application>(*args)
}
```

- 파일명: `{Service}Application.kt`
- 위치: `com.kgd.{service}` 루트 패키지

## References

- 패키지 구조 상세: `docs/conventions/package-structure.md`
- Clean Architecture 원칙: `docs/architecture/00.clean-architecture.md`
- 테스트 규칙: `docs/standards/test-rules.md`
- Kafka 토픽 컨벤션: `docs/architecture/kafka-convention.md`
- API 응답 포맷: `docs/conventions/api-format.md`
- 본 컨벤션의 거버넌스: ADR-0026 docs taxonomy
