# Module & Build Rules

## Common 모듈

- `bootJar` 없이 `jar`만 생성
- 서비스 모듈은 `implementation(project(":common"))`으로 common 의존
- **선택적 기능 로드**: Spring Boot Auto-Configuration 방식 (`kgd.common.*.enabled`)
  - exception/response는 항상 로드
  - Security/Redis/WebClient는 서비스별 `application.yml`에서 활성화
  - 가이드: `/docs/architecture/common-features.md`

## 버전 & 빌드

- 모든 버전은 `gradle/libs.versions.toml` Version Catalog에서 중앙 관리
- Java 25 LTS toolchain 전 모듈 통일: `JavaLanguageVersion.of(25)`
- QueryDSL Q클래스는 `build/generated/source/kapt/`에 생성 (git ignore 대상)

## Nested Submodule 구조

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
