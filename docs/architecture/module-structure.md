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

`settings.gradle.kts` 가 원본이다 (2026-08-26 기준 51 모듈). 레이어 규칙은 `docs/conventions/package-structure.md`.

### 상주 JVM (`:app`)

| Gradle 경로 | 역할 |
|------------|------|
| `:product:domain` / `:product:app` | 카탈로그 SSOT (재고는 inventory 가 SSOT, ADR-0013) |
| `:search:domain` / `:search:app` / `:search:consumer` / `:search:batch` | OpenSearch 읽기 모델 — API · Kafka 색인(Worker) · 전체 색인(CronJob) |
| `:place:domain` / `:place:app` | 지리 계층 · POI · 관광지 SSOT (ADR-0056/0065) |
| `:analytics:domain` / `:analytics:app` | Kafka Streams + ClickHouse 스코어 (Worker tier) |
| `:experiment:domain` / `:experiment:app` | A/B 실험 |
| `:recommendation:domain` / `:recommendation:app` | 추천 (ADR-0044~0049) |
| `:chatbot:domain` / `:chatbot:app` | 대화형 AI (ADR-0052) |
| `:quant:domain` / `:quant:app` | 트레이딩 플랫폼 (ADR-0033/0036/0037) |
| `:gifticon:domain` / `:gifticon:app` | 기프티콘 — **서브모듈** `1989v/msa-gifticon` |
| `:auth:domain` / `:auth:app` | OAuth · RBAC — **private 서브모듈** |
| `:code-dictionary:domain` / `:code-dictionary:app` | 개념 사전 + **폴드 호스트** (game · deal · blog · ranking) |
| `:commerce:app` | **폴드 호스트** 전용 부트스트랩 (자기 도메인 없음, ADR-0058) |
| `:agent-viewer:api` | 개발 도구 (플랫폼 서비스 아님) |
| `:gateway` · `:common` | 단일 모듈 — 게이트웨이 · 공유 라이브러리 |

### 폴드된 라이브러리 (`:feature`, 비-bootable — ADR-0058)

| Gradle 경로 | 호스트 | 스키마 |
|------------|------|------|
| `:order:domain` / `:order:feature` | `commerce:app` | 전용 `order_db` |
| `:inventory:domain` / `:inventory:feature` | `commerce:app` | 전용 `inventory_db` — **레이어 표준 견본** |
| `:fulfillment:domain` / `:fulfillment:feature` | `commerce:app` | 전용 `fulfillment_db` |
| `:warehouse:domain` / `:warehouse:feature` | `commerce:app` | 전용 `warehouse_db` |
| `:member:domain` / `:member:feature` | `commerce:app` | 전용 `member_db` |
| `:wishlist:domain` / `:wishlist:feature` | `commerce:app` | 전용 `wishlist_db` |
| `:game:domain` / `:game:feature` (+ `:game:sim` · `:game:web` KMP) | `code-dictionary:app` | 전용 `game_db` |
| `:deal:domain` / `:deal:feature` | `code-dictionary:app` | 호스트 스키마 공유 |
| `:blog:domain` / `:blog:feature` | `code-dictionary:app` | 호스트 스키마 공유 |
| `:ranking:domain` / `:ranking:feature` | `code-dictionary:app` | 호스트 스키마 공유 |

- **domain 모듈 규칙**: Spring/JPA 어노테이션 사용 시 컴파일 에러 (의존성 없음). 예외는 `search:domain` 하나
- **app/feature 모듈**: `implementation(project(":{service}:domain"))` 으로 domain 의존
- **feature 모듈**: `bootJar` disabled · `@SpringBootApplication` 없음 · 다른 feature 를 의존하지 않음

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
├── application/                     ← {service}:app 또는 :feature 서브모듈
│   └── {entity}/
│       ├── usecase/      # UseCase 인터페이스 (Inbound Port) — 필수, ADR-0083
│       ├── service/      # UseCase 구현체
│       ├── port/         # Outbound Port 인터페이스 — 여기에만 (domain 모듈 금지)
│       └── dto/          # Command, Result, Query
├── infrastructure/                  ← {service}:app 또는 :feature 서브모듈
│   ├── persistence/
│   │   └── {entity}/
│   │       ├── entity/   # JPA Entity
│   │       ├── repository/ # Spring Data Repository + QueryDSL
│   │       └── adapter/  # RepositoryPort 구현체
│   ├── client/           # WebClient 기반 외부 API Adapter
│   ├── messaging/        # Kafka Producer/Consumer Adapter
│   └── config/           # 기술 설정 (DataSource, Redis, Kafka 등)
└── presentation/                    ← {service}:app 또는 :feature 서브모듈
    └── {entity}/
        ├── controller/   # RestController
        └── dto/          # Request DTO, Response DTO
```
