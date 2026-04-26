# 1. System Architecture

> Clean Architecture를 **물리적 Gradle 모듈 분리**로 강제하는 19개 마이크로서비스 설계

---

## Clean Architecture — 컴파일 타임 강제

일반적인 Clean Architecture는 패키지 규칙으로만 관리하지만, 이 프로젝트는 **Gradle 서브모듈로 물리 분리**하여
도메인 레이어의 프레임워크 무의존성을 컴파일 에러로 보장.

```
{service}/
├── domain/                  # Zero-dependency (순수 Kotlin)
│   └── build.gradle.kts     # Spring/JPA 의존성 없음 → 컴파일 실패로 강제
└── app/                     # Spring Boot Application
    └── build.gradle.kts     # domain + Spring + Infra 의존성
```

**근거**: `docs/architecture/00.clean-architecture.md`

### 의존성 방향 (단방향)

```
Presentation → Application → Domain ← Infrastructure
                                ↑
                          (역방향 금지)
```

- **Domain**: Entity, Aggregate, ValueObject, DomainPolicy, DomainEvent
- **Application**: UseCase (Inbound Port), Port (Outbound), Service, DTO
- **Infrastructure**: JPA Adapter, WebClient Adapter, Kafka Producer/Consumer
- **Presentation**: Controller, Request/Response DTO

### 코드 위치

| 레이어 | 예시 파일 | 역할 |
|--------|---------|------|
| Domain Entity | `product/domain/src/.../domain/product/model/Product.kt` | 순수 도메인 모델 |
| Domain Policy | `product/domain/src/.../domain/product/policy/` | 도메인 정책/스펙 |
| UseCase (Port) | `product/domain/src/.../application/product/usecase/` | 인바운드 포트 인터페이스 |
| Outbound Port | `product/domain/src/.../application/product/port/` | 아웃바운드 포트 인터페이스 |
| Service (Impl) | `product/app/src/.../application/product/service/` | UseCase 구현체 |
| JPA Adapter | `product/app/src/.../infrastructure/persistence/` | RepositoryPort 구현 |
| Controller | `product/app/src/.../presentation/product/controller/` | REST API |

---

## Port & Adapter Pattern

모든 외부 의존성(DB, API, Kafka)은 **Port 인터페이스**를 통해 추상화.

```kotlin
// Domain layer — Outbound Port (product/domain/)
interface ProductRepositoryPort {
    fun save(product: Product): Product
    fun findById(id: Long): Product?
}

// Infrastructure layer — Adapter (product/app/)
@Component
class ProductRepositoryAdapter(
    private val jpaRepository: ProductJpaRepository
) : ProductRepositoryPort {
    override fun save(product: Product) = jpaRepository.save(product.toEntity()).toDomain()
}
```

**패턴 적용 범위**:
- `{Entity}RepositoryPort` — DB 접근
- `{Entity}EventPort` — Kafka 발행
- `{ExternalSystem}Port` — 외부 API 호출

---

## Feature-First Package Convention

```
com.kgd.{service}/
├── domain/{entity}/
│   ├── model/           # Aggregate, Entity, ValueObject
│   ├── policy/          # DomainPolicy, Specification
│   ├── event/           # DomainEvent
│   └── exception/       # DomainException
├── application/{entity}/
│   ├── usecase/         # Inbound Port (interface)
│   ├── service/         # UseCase 구현
│   ├── port/            # Outbound Port (interface)
│   └── dto/             # Command, Result, Query
├── infrastructure/
│   ├── persistence/     # JPA Entity, Repository, Adapter
│   ├── client/          # WebClient (외부 API)
│   ├── messaging/       # Kafka Producer/Consumer
│   └── config/          # DataSource, Redis, Kafka 설정
└── presentation/
    ├── controller/      # RestController
    └── dto/             # Request/Response
```

**근거**: `docs/conventions/code-convention.md`

---

## 서비스 간 통신 규칙

| 방식 | 용도 | 패턴 | 근거 |
|------|------|------|------|
| **WebClient (동기)** | 즉시 응답 필요 | CircuitBreaker 래핑 | ADR-0003 |
| **Kafka (비동기)** | 이벤트 전파, 최종 일관성 | Idempotent Consumer | ADR-0003, ADR-0012 |
| **DB 공유** | **금지** | API 호출만 허용 | Clean Architecture 원칙 |
| **Cross-reference** | **금지** | ID만 참조 | 서비스 독립성 |

---

## Bounded Context 분리

```
Product (SSOT)  ──kafka──→  Search (Read Model)
      │                         ↑
      │ kafka                   │ kafka
      ↓                         │
Inventory ──kafka──→ Fulfillment ──kafka──→ Order
      │
      └──redis──→ CQRS Read Cache
```

각 서비스는 자체 DB를 소유하며, 다른 서비스의 데이터는 **Kafka 이벤트** 또는 **API 호출**로만 접근.

---

## 아키텍처 거버넌스

- **22개 ADR**로 모든 아키텍처 결정 추적 (`docs/adr/`)
- ADR 충돌 시 구현 중단 → 확인 요청
- 구조 변경 시 ADR 신규 작성 필수
- Agent 하네스가 ADR 위반 자동 탐지 (`agent-os/standards/`)

---

*Code references: `settings.gradle.kts` · `docs/architecture/00.clean-architecture.md` · `docs/conventions/code-convention.md`*
