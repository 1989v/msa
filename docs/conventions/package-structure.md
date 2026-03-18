# Package Structure Convention

## Base Package

`com.kgd.{service}`

## Nested Submodule Layout

각 서비스는 `{service}:domain` / `{service}:app` 형태의 Gradle 서브모듈로 분리된다.

```
{service}/
├── domain/                              ← :{service}:domain (순수 Kotlin)
│   └── src/main/kotlin/com/kgd/{service}/
│       └── domain/
│           └── {entity}/
│               ├── model/        # Aggregate, Entity, Value Object
│               ├── policy/       # Domain Policy, Specification
│               ├── event/        # Domain Event
│               └── exception/    # Domain Exception
└── app/                                 ← :{service}:app (Spring Boot)
    └── src/main/kotlin/com/kgd/{service}/
        ├── application/
        │   └── {entity}/
        │       ├── usecase/      # UseCase interface (Inbound Port)
        │       ├── service/      # UseCase 구현체
        │       ├── port/         # Outbound Port interface
        │       └── dto/          # Command, Result, Query
        ├── infrastructure/
        │   ├── persistence/
        │   │   └── {entity}/
        │   │       ├── entity/   # JPA Entity
        │   │       ├── repository/ # Spring Data Repository + QueryDSL
        │   │       └── adapter/  # RepositoryPort 구현체
        │   ├── client/           # WebClient 기반 외부 API Adapter
        │   ├── messaging/        # Kafka Producer/Consumer Adapter
        │   └── config/           # 기술 설정
        └── presentation/
            └── {entity}/
                ├── controller/   # RestController
                └── dto/          # Request DTO, Response DTO
```

## Rules

1. **domain 모듈**: Spring/JPA 어노테이션 사용 금지 (의존성 자체가 없으므로 컴파일 에러)
2. **도메인 간 cross-reference 금지**: Order -> Product 직접 참조 금지, API 호출만 허용
3. **app 모듈**: `implementation(project(":{service}:domain"))`으로 domain 의존
4. **bootJar 이름**: `tasks.bootJar { archiveBaseName.set("{service}") }`

## Filesystem vs Package Declaration Note

app 모듈의 filesystem 디렉토리는 layer prefix(`application/`, `infrastructure/`, `presentation/`)를 생략하지만,
`.kt` 파일의 package 선언에는 전체 layer 경로를 포함한다. Kotlin 컴파일러는 이를 허용한다.

| Filesystem path | Package declaration |
|---|---|
| `product/product/controller/` | `com.kgd.product.presentation.product.controller` |
| `product/product/service/` | `com.kgd.product.application.product.service` |
| `product/persistence/product/adapter/` | `com.kgd.product.infrastructure.persistence.product.adapter` |

위 표의 convention 문서는 **package 선언** 기준이다. 새 파일 생성 시 filesystem과 package 선언 모두 기존 패턴을 따른다.

## Infrastructure-only Modules (Single-level)

- `common`: 공통 라이브러리 (jar only, no bootJar)
- `discovery`: Eureka Server
- `gateway`: Spring Cloud Gateway

## search:domain Port Exception

search:domain 모듈은 `product/port/` 패키지에 Outbound Port를 포함한다.
일반적으로 Port는 application 레이어에 위치하지만, search:domain은 `spring-data-commons`에 의존하여
`Page`/`Pageable` 타입을 Port 시그니처에 사용하기 위해 domain 모듈에 배치되었다.

## Search Service Exception

search는 3개의 app-level 서브모듈을 가진다:

| Gradle path | Role |
|---|---|
| `:search:app` | REST API (읽기 전용) |
| `:search:consumer` | Kafka 증분 색인 |
| `:search:batch` | Spring Batch 전체 색인 |
