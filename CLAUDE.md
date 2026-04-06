# CLAUDE.md
# Commerce Platform Project Configuration

---

## Unified Rules

- **AGENTS.md**: Shared baseline navigation (if exists)
- **CLAUDE.md**: Project-specific overrides (this file)
- **PLANS.md**: Complex work orchestration

**On conflict**: CLAUDE.md wins.

---

## Environment

### Build Commands

```bash
./gradlew build                        # 전체 빌드
./gradlew :{module}:build              # 단일 모듈 (예: ./gradlew :product:app:build)
./gradlew :{service}:domain:test       # 도메인 테스트 (Spring context 없음)
./gradlew :{service}:app:bootJar       # 실행 JAR 생성
```

### Test Commands

```bash
./gradlew test                         # 전체 테스트
./gradlew :{module}:test               # 단일 모듈 테스트
```

### Docker Commands

```bash
docker compose -f docker/docker-compose.infra.yml up -d   # 로컬 인프라
docker compose -f docker/docker-compose.yml up -d          # 전체 기동
```

---

## Agent Behavior Standards

코드 수정/생성 작업 시 다음 표준을 적용하세요:

- **리스크 분류 & 검증 루프** → `agent-os/standards/agent-behavior/confirmation.md`
  - Level 1-3 분류, Ralph Loop (BUILD→TEST→FIX, max 3회), Level 3 승인 필수
- **구현 후 리뷰** → `agent-os/standards/agent-behavior/self-review.md`
  - Level 1-2: 자동 lint, Level 3: fresh context reviewer
- **문서 동기화** → `agent-os/standards/agent-behavior/doc-gardening.md`
  - 구현 성공 후 Doc Impact Scan 실행

**범용 행동 원칙**:
- **탐색 우선, 증거 기반** → `agent-os/standards/agent-behavior/core-rules.md`
- **컴팩션 복구** → `agent-os/standards/agent-behavior/compaction.md`
- **세션 관리** → `agent-os/standards/agent-behavior/session.md`

---

## Architecture

This project strictly follows **Clean Architecture + Microservice**.

- Dependency direction must always point inward
- Domain layer must not depend on frameworks
- Application layer depends only on ports
- Infrastructure implements ports
- Direct dependency from Application to Infrastructure is prohibited
- Service-to-service database sharing is prohibited
- Any architectural or structural change requires an ADR

Reference: `/docs/architecture/clean-architecture.md`

---

## Module & Build Rules

- common 모듈은 `bootJar` 없이 `jar`만 생성
- 서비스 모듈은 `implementation(project(":common"))`으로 common 의존
- **common 선택적 기능 로드**: `@EnableCommonFeatures(CommonFeature.SECURITY, ...)` 어노테이션으로 필요한 기능만 활성화. exception/response는 항상 로드, Security/Redis/WebClient는 명시적 선언 필요. 가이드: `/docs/architecture/common-features.md`
- 모든 버전은 `gradle/libs.versions.toml` Version Catalog에서 중앙 관리
- Java 25 LTS toolchain 전 모듈 통일: `JavaLanguageVersion.of(25)`
- QueryDSL Q클래스는 `build/generated/source/kapt/`에 생성 (git ignore 대상)

### Nested Submodule 구조

| Gradle 경로 | 파일시스템 경로 | 역할 |
|------------|---------------|------|
| `:product:domain` | `product/domain/` | 순수 도메인 (Spring/JPA 없음) |
| `:product:app` | `product/app/` | Spring Boot 앱 |
| `:order:domain` | `order/domain/` | 순수 도메인 |
| `:order:app` | `order/app/` | Spring Boot 앱 |
| `:search:domain` | `search/domain/` | 순수 도메인 |
| `:search:app` | `search/app/` | 검색 REST API (읽기 전용) |
| `:search:consumer` | `search/consumer/` | Kafka 증분 색인 (BulkIngester) |
| `:search:batch` | `search/batch/` | Spring Batch 전체 색인 (alias swap) |

- **domain 모듈 규칙**: Spring/JPA 어노테이션 사용 시 컴파일 에러 (의존성 없음)
- **app 모듈**: `implementation(project(":{service}:domain"))`으로 domain 의존

---

## Package Naming Convention

Base package: `com.kgd.{service}`

```
com.kgd.{service}/
├── domain/                          ← {service}:domain Gradle 서브모듈
│   └── {entity}/
│       ├── model/        # Aggregate, Entity, Value Object
│       ├── policy/       # Domain Policy, Specification
│       ├── event/        # Domain Event
│       └── exception/    # Domain Exception
├── application/                     ← {service}:app Gradle 서브모듈
│   └── {entity}/
│       ├── usecase/      # UseCase 인터페이스 (Inbound Port)
│       ├── service/      # UseCase 구현체
│       ├── port/         # Outbound Port 인터페이스
│       └── dto/          # Command, Result, Query
├── infrastructure/                  ← {service}:app Gradle 서브모듈
│   ├── persistence/
│   │   └── {entity}/
│   │       ├── entity/   # JPA Entity
│   │       ├── repository/ # Spring Data Repository + QueryDSL
│   │       └── adapter/  # RepositoryPort 구현체
│   ├── client/           # WebClient 기반 외부 API Adapter
│   ├── messaging/        # Kafka Producer/Consumer Adapter
│   └── config/           # 기술 설정 (DataSource, Redis, Kafka 등)
└── presentation/                    ← {service}:app Gradle 서브모듈
    └── {entity}/
        ├── controller/   # RestController
        └── dto/          # Request DTO, Response DTO
```

---

## Architectural Constraints

- Each service owns its database
- Internal DB access remains blocking (JPA)
- External API communication uses WebClient
- Coroutine usage is limited to external IO operations
- Event-driven communication uses Kafka
- Search is based on Elasticsearch
- WebFlux full adoption is prohibited
- Redis must be designed with cluster scalability in mind
- 도메인 간 cross-reference 금지 (API 호출만 허용)

---

## Test Rules

- 테스트 프레임워크: **Kotest BehaviorSpec** (BDD 스타일)
- 테스트 더블: **MockK** 사용 (Mockito 금지)
- Domain 테스트: Mock 사용 금지, 순수 단위 테스트
- Application 테스트: Outbound Port는 MockK로 Mock
- 테스트 파일 위치: `src/test/kotlin/{패키지}/...`
- 테스트 파일 이름: 구현체와 동일 이름 + `Test` suffix

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

---

## Kafka Topic Convention

형식: `{domain}.{entity}.{event}`

| 토픽 | 발행 서비스 | 수신 서비스 |
|------|------------|------------|
| `product.item.created` | product | search |
| `product.item.updated` | product | search |
| `order.order.completed` | order | - |
| `order.order.cancelled` | order | - |

- Consumer Group ID: `{service}-{purpose}` 형식 (예: `search-indexer`)

---

## API Response Format

모든 HTTP 응답은 `ApiResponse<T>` (common 모듈)로 래핑.

```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null,    "error": { "code": "NOT_FOUND", "message": "..." } }
```

---

## Architecture Governance

- Any architectural or structural change requires an ADR
- Implementation code must not be generated before ADR approval
- Existing ADRs must be reviewed before proposing new decisions
- If a conflict with existing ADRs is detected, pause and request clarification
- ADR numbering must be sequential

---

## AI Execution Rules

Before generating implementation:
- Validate alignment with Architecture Principles
- Validate consistency with existing ADRs
- Validate consistency with relevant docs
- If ambiguity or conflict exists, pause and request clarification
- Avoid generating code before structure is finalized

---

## Standards & Conventions

All rules are routed via `agent-os/standards/`.

---

## Active Commands

| Command | Purpose |
|---------|---------|
| `/hnsf:shape-spec` | 요구사항 수집 및 스펙 폴더 초기화 |
| `/hnsf:write-spec` | 스펙 문서 작성 |
| `/hnsf:create-tasks` | 태스크 분해 |
| `/hnsf:implement-tasks` | 구현 (워크트리 옵션) |
| `/hnsf:orchestrate-tasks` | 순차/병렬 오케스트레이션 |
| `/hnsf:drift-check` | 구현-스펙 불일치 감지 |
| `/hnsf:interview-capture` | 구현 전 게이트 인터뷰 |
| `/hnsf:verify` | 검증 (표준→린트→빌드→테스트) |
| `/hnsf:spec-review` | 스펙 리뷰 (architecture/implementation/usecase) |

---

## Navigation Tips

- Feature-specific work → `docs/specs/`
- Standards → `agent-os/standards/`
- Product context → `agent-os/product/`
- Architecture docs → `docs/architecture/`
- ADRs → `docs/adr/`

---

## Docker & Local Dev Rules

- 서비스별 독립 실행 가능 (Eureka, 해당 DB만 있으면 됨)
- `.env` 파일은 `docker/.env` (git ignore 대상, `.env.example` 제공)
- 환경변수 주입: `SPRING_PROFILES_ACTIVE=docker`
