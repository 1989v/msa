# 9. Polyglot & Developer Experience

> Kotlin/Python/TypeScript 3개 언어, 공통 라이브러리 AutoConfiguration, Gradle Convention Plugin

---

## 3-Language Stack

| Language | 버전 | 용도 | 서비스 |
|----------|------|------|--------|
| **Kotlin** | 2.2.21 | 백엔드 메인 (18 JVM 서비스) | product, order, auth, search, gateway, ... |
| **Python** | 3.11 | 데이터/ML 특화 | charting (FastAPI, pgvector, yfinance) |
| **TypeScript** | 5.x | 프론트엔드 | admin, code-dictionary-fe, charting-fe, agent-viewer |

**선택 기준**: 각 언어의 생태계가 최적인 영역에 배치. Kotlin은 Spring 생태계, Python은 데이터/ML 라이브러리, TypeScript는 React 프론트엔드.

---

## Common Library — AutoConfiguration

19개 서비스가 공유하는 공통 기능을 **Spring Boot AutoConfiguration**으로 제공.
`application.yml`에서 feature flag로 선택적 활성화.

```kotlin
// common/src/.../config/CommonSecurityAutoConfiguration.kt
@AutoConfiguration
@ConditionalOnProperty("kgd.common.security.enabled", havingValue = "true")
class CommonSecurityAutoConfiguration {
    @Bean fun jwtUtil(properties: JwtProperties) = JwtUtil(properties)
    
    @Bean
    @ConditionalOnProperty("kgd.common.security.aes-enabled", havingValue = "true")
    fun aesUtil(properties: AesProperties) = AesUtil(properties)
}
```

### Feature Matrix

| Feature | Property | 제공 Bean | 사용 서비스 |
|---------|----------|----------|-----------|
| **Always** | (없음) | `BusinessException`, `ErrorCode`, `ApiResponse`, `GlobalExceptionHandler` | 전체 |
| **Security** | `kgd.common.security.enabled` | `JwtUtil`, `JwtProperties` | auth, gateway |
| **AES** | `kgd.common.security.aes-enabled` | `AesUtil` | auth, gifticon |
| **Redis** | `kgd.common.redis.enabled` | `LettuceConnectionFactory`, `RedisTemplate` | product, gateway, analytics |
| **WebClient** | `kgd.common.web-client.enabled` | `WebClientCustomizer`, `WebClientBuilderFactory` | order, gifticon |
| **Analytics** | `kgd.common.analytics.enabled` | `AnalyticsEventPublisher`, `BucketAssigner` | gateway, analytics, experiment |

### ApiResponse 통합 포맷

```kotlin
data class ApiResponse<T>(
    val success: Boolean,
    val data: T?,
    val error: ErrorResponse?,
    val timestamp: Instant
)

// 사용
@GetMapping("/products/{id}")
fun getProduct(@PathVariable id: Long): ApiResponse<ProductResponse> {
    return ApiResponse.success(productService.getById(id))
}
```

**코드 위치**: `common/src/main/kotlin/com/kgd/common/`

---

## Gradle Convention Plugin

빌드 설정을 `buildSrc` Convention Plugin으로 표준화.

```
buildSrc/
└── src/main/kotlin/
    └── commerce.jib-convention.gradle.kts  # Jib 컨테이너 빌드 규칙
```

### Version Catalog (`gradle/libs.versions.toml`)

```toml
[versions]
kotlin = "2.2.21"
spring-boot = "4.0.4"
spring-cloud = "2025.1.0"
kotest = "5.9.1"
mockk = "1.13.16"
querydsl = "6.12"
jjwt = "0.12.6"
clickhouse = "0.7.1"

[libraries]
spring-boot-starter-web = { module = "org.springframework.boot:spring-boot-starter-web" }
# ...

[plugins]
kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
spring-boot = { id = "org.springframework.boot:spring-boot-gradle-plugin", version.ref = "spring-boot" }
```

**장점**:
- 19개 서비스의 의존성 버전 단일 관리
- Convention Plugin으로 Jib/Test 설정 자동 적용
- `libs.plugins.*`, `libs.versions.*` 참조로 오타 방지

---

## 서비스별 CLAUDE.md

각 서비스에 AI 에이전트용 컨텍스트 파일을 배치하여 서비스 작업 시 자동 로드.

```
product/
├── CLAUDE.md          # 서비스 개요, 빌드 명령, 핵심 도메인 규칙
├── docs/              # 서비스 로컬 문서
├── domain/            # 순수 도메인
└── app/               # Spring Boot
```

**15개 서비스에 CLAUDE.md 존재** (나머지는 생성 예정)

---

## 22 ADR — 의사결정 추적

모든 아키텍처 결정을 ADR로 기록. 번호 체계로 참조 가능.

```
docs/adr/
├── ADR-0001-multi-module-gradle.md
├── ADR-0002-language-framework.md
├── ...
└── ADR-0022-entity-mutation-conventions.md
```

**ADR 거버넌스**:
- 구조 변경 시 ADR 작성 필수
- Agent가 구현 전 ADR 충돌 체크
- ADR 위반 시 구현 중단 → 사용자 확인

---

## Spec-Driven Development

기능 구현 전 스펙 문서를 먼저 작성하는 프로세스.

```
docs/specs/
├── 2026-04-06-backup-management-design.md
├── 2026-04-09-admin-backoffice-framework-design.md
├── 2026-04-09-code-dictionary-visualization-design.md
├── 2026-04-09-monitoring-infrastructure-design.md
├── 2026-03-29-agent-team-visualizer/       # nested (context/planning/verifications)
├── 2026-04-07-chatbot-service/
├── 2026-04-07-inventory-fulfillment/
├── 2026-04-09-analytics-scoring/
└── ... (42 spec files total)
```

**상세 구현 계획**:
```
docs/plans/
├── 2026-03-02-msa-commerce-platform.md       # 플랫폼 전체 블루프린트
├── 2026-04-09-admin-backoffice-framework.md  # 43KB 다단계 계획
├── 2026-04-09-code-dictionary-visualization.md # 77KB 태스크 분해
└── ... (8 plans)
```

---

## Kotlin 특화 패턴

### Coroutines (비동기)
```kotlin
// order 서비스 — 결제 API 비차단 호출
suspend fun processPayment(orderId: Long): PaymentResult {
    return circuitBreaker.executeSuspendFunction {
        paymentClient.charge(orderId)
    }
}
```

### Extension Functions
```kotlin
// JPA Entity ↔ Domain Model 변환
fun ProductEntity.toDomain() = Product(
    id = this.id,
    name = this.name,
    price = Money(this.price)
)
```

### kotlin-logging
```kotlin
// ADR-0021: 람다 기반 지연 평가
private val log = KotlinLogging.logger {}

fun process(order: Order) {
    log.info { "Processing order: ${order.id}" }  // 람다 (String 생성 지연)
}
```

---

## Python 서비스 (Charting)

```
charting/
├── pyproject.toml        # Hatch 빌드 백엔드
├── src/
│   ├── api/              # FastAPI 라우터
│   ├── domain/           # 도메인 모델
│   ├── infrastructure/   # SQLAlchemy, pgvector
│   └── service/          # 비즈니스 로직
├── alembic/              # DB 마이그레이션
└── frontend/             # React
```

**Clean Architecture를 Python에도 적용** — domain/service/infrastructure 분리.

---

*Code references: `common/` · `buildSrc/` · `gradle/libs.versions.toml` · `settings.gradle.kts` · `docs/adr/` · `docs/specs/` · `docs/plans/`*
