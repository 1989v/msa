# ADR-0014 Code Convention 통합 레퍼런스

## Status
Accepted

## Context

프로젝트 전반의 코드 생성 컨벤션이 여러 문서에 분산되어 있어,
새로운 서비스/모듈 추가 시 일관성을 유지하기 어렵다. 기존 코드에서 추출한 실제 패턴과 문서화된 규칙을 통합하여 단일 레퍼런스를 제공한다.

**기존 문서 참조 관계:**
- 아키텍처 원칙: `docs/architecture/00.clean-architecture.md`
- 패키지 구조: `docs/conventions/package-structure.md`
- 테스트 규칙: `docs/standards/test-rules.md`
- Kafka 컨벤션: `docs/architecture/kafka-convention.md`
- API 응답 포맷: `docs/conventions/api-format.md`

이 ADR은 위 문서에서 다루지 않는 **네이밍, DI 방향, 클래스 역할 정의**를 보완한다.

## Decision

### 1. 클래스 네이밍 컨벤션

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

### 2. DI(의존성 주입) 방향 규칙

```
Controller → UseCase (interface)
                ↑
            Service (impl) → Port (interface)
                                  ↑
                              Adapter (impl)
```

- **Controller**는 UseCase 인터페이스에만 의존 (구현체 모름)
- **Service**는 Outbound Port 인터페이스에만 의존 (JPA/Kafka 모름)
- **Adapter**는 Port를 구현하고, 프레임워크 기술에 의존
- 생성자 주입만 사용 (field injection 금지)
- `@Component`/`@Service`로 Spring 자동 주입

### 3. Domain 모델 생성 패턴

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

    // 비즈니스 메서드
    fun updateName(name: String) { ... }
}
```

- `private constructor` + factory method (`create`, `restore`)
- `create`: 비즈니스 검증 포함, id는 null
- `restore`: DB에서 복원, 검증 없이 상태 재구성
- mutable 필드는 `private set` + getter 메서드 또는 Kotlin property

### 4. JPA Entity ↔ Domain 매핑

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
            // ...
        )
    }
}
```

- `toDomain()`: JPA Entity → Domain Model (인스턴스 메서드)
- `fromDomain()`: Domain Model → JPA Entity (companion object)

### 5. UseCase 인터페이스 패턴

```kotlin
interface CreateProductUseCase {
    fun execute(command: Command): Result

    data class Command(val name: String, val price: BigDecimal)
    data class Result(val id: Long, val name: String, val price: BigDecimal)
}
```

- 단일 `execute` 메서드
- `Command`/`Query`/`Result`는 UseCase 내부 data class로 정의
- 조회 UseCase는 `Query` 사용

### 6. Transactional Service 분리 패턴

외부 API 호출이 포함된 유스케이스에서 DB 커넥션 점유를 최소화하기 위해 사용:

```
TX1 (짧은 트랜잭션): 엔티티 PENDING 저장
→ 외부 API 호출 (트랜잭션 밖)
→ TX2 (짧은 트랜잭션): 결과 반영 (COMPLETED/FAILED)
```

- `{Entity}TransactionalService`: 짧은 DB 트랜잭션만 담당
- `{Entity}Service`: 전체 흐름 오케스트레이션

### 7. 테스트 파일 규칙

- 파일명: `{ClassName}Test.kt`
- 프레임워크: Kotest BehaviorSpec + MockK
- Domain 테스트: Mock 없이 순수 단위 테스트
- Application 테스트: Outbound Port를 MockK로 대체
- 위치: `src/test/kotlin/{동일 패키지}/`

### 8. Application Main Class

```kotlin
@SpringBootApplication
class {Service}Application

fun main(args: Array<String>) {
    runApplication<{Service}Application>(*args)
}
```

- 파일명: `{Service}Application.kt`
- 위치: `com.kgd.{service}` 루트 패키지

## Alternatives Considered

1. **별도 conventions 문서로만 관리**: ADR로 결정 기록을 남기지 않으면 "왜 이 컨벤션인지" 추적 불가.
2. **코드 생성 도구(Archetype) 도입**: 현 규모에서는 과도. 문서 레퍼런스가 더 유연.

## Consequences

**긍정적:**
- 새 서비스/모듈 추가 시 일관된 구조 보장
- AI 에이전트가 코드 생성 시 참조할 단일 레퍼런스
- 기존 분산된 문서의 빈 곳(네이밍, DI, 도메인 패턴)을 보완

**부정적:**
- 컨벤션 변경 시 이 ADR도 함께 업데이트 필요
- 기존 코드 중 컨벤션에 맞지 않는 부분은 점진적 정리 필요

## References

- 패키지 구조 상세: `docs/conventions/package-structure.md`
- Clean Architecture 원칙: `docs/architecture/00.clean-architecture.md`
- 테스트 규칙: `docs/standards/test-rules.md`
- Kafka 토픽 컨벤션: `docs/architecture/kafka-convention.md`
- API 응답 포맷: `docs/conventions/api-format.md`
