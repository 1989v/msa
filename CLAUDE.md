# Commerce Platform AI Working Agreement

## 1. Platform Intent

This project builds a production-ready MSA commerce platform.

The architecture must support:
- Horizontal scalability
- High availability
- Service isolation
- Kubernetes-ready deployment


## 2. Architecture Principles

This project strictly follows Clean Architecture.

- Dependency direction must always point inward.
- Domain layer must not depend on frameworks.
- Application layer depends only on ports.
- Infrastructure implements ports.
- Direct dependency from Application to Infrastructure is prohibited.
- Service-to-service database sharing is prohibited.

Reference: /docs/architecture/clean-architecture.md


## 3. Architectural Constraints

- Each service owns its database.
- Internal DB access remains blocking (JPA).
- External API communication uses WebClient.
- Coroutine usage is limited to external IO operations.
- Event-driven communication uses Kafka.
- Search is based on Elasticsearch.
- WebFlux full adoption is prohibited.
- Redis must be designed with cluster scalability in mind.


## 4. Architecture Governance

- Any architectural or structural change requires an ADR.
- Implementation code must not be generated before ADR approval.
- Existing ADRs must be reviewed before proposing new decisions.
- If a conflict with existing ADRs is detected, pause and request clarification.
- ADR numbering must be sequential.
- Superseded ADRs must explicitly reference replacement ADRs.


## 5. AI Execution Rules

Before generating implementation:

- Validate alignment with Architecture Principles.
- Validate consistency with existing ADRs.
- Validate consistency with relevant docs.
- If ambiguity or conflict exists, pause and request clarification.
- Avoid generating code before structure is finalized.


## 6. Module & Build Rules

- common 모듈은 `bootJar` 없이 `jar`만 생성 (실행 가능 JAR 아님)
- 서비스 모듈은 `implementation(project(":common"))`으로 common 의존
- 모든 버전은 `gradle/libs.versions.toml` Version Catalog에서 중앙 관리
- Java 25 LTS toolchain 전 모듈 통일: `JavaLanguageVersion.of(25)`
- QueryDSL Q클래스는 `build/generated/source/kapt/` 에 생성 (git ignore 대상)
- 빌드 명령: `./gradlew :{module}:build` (단일 모듈), `./gradlew build` (전체)


## 7. Package Naming Convention

Base package: `com.kgd.{service}`

Clean Architecture 레이어별 패키지:

```
com.kgd.{service}/
├── domain/
│   └── {entity}/
│       ├── model/        # Aggregate, Entity, Value Object
│       ├── policy/       # Domain Policy, Specification
│       ├── event/        # Domain Event
│       └── exception/    # Domain Exception
├── application/
│   └── {entity}/
│       ├── usecase/      # UseCase 인터페이스 (Inbound Port)
│       ├── service/      # UseCase 구현체
│       ├── port/         # Outbound Port 인터페이스
│       └── dto/          # Command, Result, Query
├── infrastructure/
│   ├── persistence/
│   │   └── {entity}/
│   │       ├── entity/   # JPA Entity
│   │       ├── repository/ # Spring Data Repository + QueryDSL
│   │       └── adapter/  # RepositoryPort 구현체
│   ├── client/           # WebClient 기반 외부 API Adapter
│   ├── messaging/        # Kafka Producer/Consumer Adapter
│   └── config/           # 기술 설정 (DataSource, Redis, Kafka 등)
└── presentation/
    └── {entity}/
        ├── controller/   # RestController
        └── dto/          # Request DTO, Response DTO
```

- 도메인 간 cross-reference 금지 (Order → Product 직접 참조 금지, API 호출만 허용)
- domain 패키지는 Spring/JPA 어노테이션 사용 금지


## 8. Test Rules

- 테스트 프레임워크: **Kotest BehaviorSpec** (BDD 스타일)
- 테스트 더블: **MockK** 사용 (Mockito 금지)
- Domain 테스트: Mock 사용 금지, 순수 단위 테스트
- Application 테스트: Outbound Port는 MockK로 Mock
- 테스트 파일 위치: `src/test/kotlin/{패키지}/...`
- 테스트 파일 이름: 구현체와 동일 이름 + `Test` suffix (예: `ProductTest.kt`)

### Kotest BehaviorSpec 예시

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

## 9. Kafka Topic Convention

형식: `{domain}.{entity}.{event}`

| 토픽 | 발행 서비스 | 수신 서비스 |
|------|------------|------------|
| `product.item.created` | product | search |
| `product.item.updated` | product | search |
| `order.order.placed` | order | - |
| `order.order.completed` | order | - |

- Consumer Group ID: `{service}-{purpose}` 형식 (예: `search-indexer`)
- DLQ 설계는 ADR-0009 참조 (추후 결정)


## 10. API Response Format

모든 HTTP 응답은 `ApiResponse<T>` (common 모듈)로 래핑한다.

**성공 응답:**
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

**실패 응답:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "상품을 찾을 수 없습니다"
  }
}
```

- Controller는 `ApiResponse.success(data)` 또는 `ApiResponse.error(errorCode)` 사용
- GlobalExceptionHandler가 최종 에러 변환 담당 (common 모듈 제공)
- HTTP Status 코드는 의미에 맞게 사용 (200/201/400/401/403/404/500)


## 11. Docker & Local Dev Rules

- 로컬 인프라 기동: `docker compose -f docker/docker-compose.infra.yml up -d`
- 전체 기동: `docker compose -f docker/docker-compose.yml up -d`
- 서비스별 독립 실행 가능 (Eureka, 해당 DB만 있으면 됨)
- `.env` 파일은 `docker/.env` (git ignore 대상, `.env.example` 제공)
- 환경변수 주입: `SPRING_PROFILES_ACTIVE=docker` 로 Docker 전용 설정 활성화