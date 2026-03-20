# PRD: Charting Service Kotlin/Spring 풀포팅 전략

**Status**: TODO
**Date**: 2026-03-20

## 개요

현재 Python(FastAPI/SQLAlchemy) 기반 Charting 서비스를 Kotlin/Spring Boot로 포팅하되,
yfinance/NumPy 의존 기능은 경량 Python 마이크로서비스로 분리하는 하이브리드 전략.

## 목표

- MSA 전체 아키텍처(Kotlin/Spring) 통일
- Spring Security, Gateway, Eureka와 네이티브 연동
- yfinance/NumPy 의존성은 Python 서비스로 격리
- 기존 기능 100% 호환

## 아키텍처

```
┌──────────────────────────────────────────────────────┐
│  charting:app (Kotlin/Spring Boot)                   │
│  Port: 8010                                          │
│                                                      │
│  ├── presentation/controller/ (REST API)             │
│  ├── application/usecase/                            │
│  ├── infrastructure/persistence/ (JPA + pgvector)    │
│  ├── infrastructure/client/                          │
│  │   └── PythonDataClient (WebClient → 8011)         │
│  └── infrastructure/config/                          │
│                                                      │
│  charting:domain (순수 Kotlin)                        │
│  ├── model/ (OhlcvBar, Pattern, Symbol, Embedding)   │
│  ├── port/ (RepositoryPort, DataClientPort)          │
│  └── policy/ (FeatureExtractionPolicy, ForecastPolicy)|
└──────────────────────────────────────────────────────┘
          │ WebClient
          ▼
┌──────────────────────────────────────────────────────┐
│  charting-data (Python, 경량)                         │
│  Port: 8011                                          │
│                                                      │
│  ├── GET  /fetch/ohlcv?ticker=&start=&end=           │
│  ├── GET  /fetch/intraday?ticker=&interval=5m        │
│  └── POST /compute/embedding  (body: closes[])       │
│                                                      │
│  내부: yfinance, numpy, scipy                         │
└──────────────────────────────────────────────────────┘
```

## 모듈 구조

### charting:domain (순수 Kotlin, Spring/JPA 없음)

```
com.kgd.charting/
├── domain/
│   ├── model/
│   │   ├── OhlcvBar.kt        (data class, interval/barTime 포함)
│   │   ├── Symbol.kt
│   │   ├── Pattern.kt
│   │   ├── Embedding.kt
│   │   └── SimilarityResult.kt
│   ├── port/
│   │   ├── OhlcvRepositoryPort.kt
│   │   ├── SymbolRepositoryPort.kt
│   │   ├── PatternRepositoryPort.kt
│   │   └── MarketDataClientPort.kt
│   ├── policy/
│   │   ├── FeatureExtractionPolicy.kt  (32차원 스펙 정의)
│   │   └── ForecastPolicy.kt
│   └── exception/
│       └── ChartingExceptions.kt
```

### charting:app (Spring Boot)

```
com.kgd.charting/
├── application/
│   ├── usecase/
│   │   ├── RegisterSymbolUseCase.kt
│   │   ├── IngestSymbolDataUseCase.kt
│   │   ├── GetSymbolOhlcvUseCase.kt
│   │   ├── SearchSimilarPatternsUseCase.kt
│   │   └── SyncIntradayUseCase.kt
│   ├── port/ (outbound)
│   └── dto/
├── infrastructure/
│   ├── persistence/
│   │   ├── entity/
│   │   │   ├── SymbolEntity.kt
│   │   │   ├── OhlcvBarEntity.kt   (@Column pgvector 미사용)
│   │   │   └── PatternEntity.kt    (@Column Vector(32))
│   │   ├── repository/
│   │   │   ├── SymbolJpaRepository.kt
│   │   │   ├── OhlcvBarJpaRepository.kt
│   │   │   └── PatternJpaRepository.kt  (pgvector 네이티브 쿼리)
│   │   └── adapter/
│   │       ├── SymbolRepositoryAdapter.kt
│   │       ├── OhlcvBarRepositoryAdapter.kt
│   │       └── PatternRepositoryAdapter.kt
│   ├── client/
│   │   └── PythonDataClient.kt  (WebClient → charting-data:8011)
│   ├── messaging/ (Kafka, 향후)
│   └── config/
│       ├── DataSourceConfig.kt
│       ├── WebClientConfig.kt
│       └── SchedulerConfig.kt
├── presentation/
│   ├── controller/
│   │   ├── SymbolController.kt
│   │   ├── OhlcvController.kt
│   │   ├── SimilarityController.kt
│   │   └── SyncController.kt
│   └── dto/
│       ├── SymbolRequest.kt / SymbolResponse.kt
│       ├── OhlcvBarResponse.kt
│       └── SimilarityRequest.kt / SimilarityResponse.kt
```

## 기술 매핑

| Python | Kotlin/Spring |
|--------|--------------|
| FastAPI router | `@RestController` |
| SQLAlchemy ORM | Spring Data JPA |
| Alembic | Flyway |
| pgvector-python | `com.pgvector:pgvector` (JPA 커스텀 타입) |
| APScheduler | `@Scheduled` + `@EnableScheduling` |
| structlog | Logback + MDC |
| Pydantic DTO | data class + `@Valid` |
| Depends() DI | `@Service` + 생성자 주입 |
| yfinance | PythonDataClient (WebClient → 8011) |
| numpy/scipy | PythonDataClient (POST /compute/embedding) |

## pgvector JPA 연동

```kotlin
// build.gradle.kts
implementation("com.pgvector:pgvector:0.1.4")

// PatternEntity.kt
@Entity @Table(name = "patterns")
class PatternEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    val symbolId: Long,
    val windowStart: LocalDate,
    val windowEnd: LocalDate,
    @Column(columnDefinition = "vector(32)")
    val embedding: PGvector,
    val return5d: BigDecimal? = null,
    val return20d: BigDecimal? = null,
    val return60d: BigDecimal? = null,
)

// PatternJpaRepository.kt
interface PatternJpaRepository : JpaRepository<PatternEntity, Long> {
    @Query(nativeQuery = true, value = """
        SELECT * FROM patterns
        WHERE symbol_id != :excludeSymbolId
        ORDER BY embedding <=> cast(:queryVector as vector)
        LIMIT :topK
    """)
    fun findSimilar(
        @Param("queryVector") queryVector: String,
        @Param("excludeSymbolId") excludeSymbolId: Long,
        @Param("topK") topK: Int,
    ): List<PatternEntity>
}
```

## Python Data Service (charting-data)

기존 Python 코드에서 추출. FastAPI 경량 서비스.

```python
# charting-data/main.py
@app.get("/fetch/ohlcv")
def fetch_ohlcv(ticker: str, start: str, end: str): ...

@app.get("/fetch/intraday")
def fetch_intraday(ticker: str, interval: str = "5m"): ...

@app.post("/compute/embedding")
def compute_embedding(closes: list[float]) -> list[float]: ...
```

## Spring Gateway 연동

```yaml
# gateway application.yml
spring:
  cloud:
    gateway:
      routes:
        - id: charting
          uri: lb://CHARTING
          predicates:
            - Path=/api/v1/symbols/**, /api/v1/*/ohlcv, /api/v1/similarity, /api/v1/*/sync
```

## Spring Security 연동

```kotlin
// charting:app SecurityConfig.kt
@Configuration
@EnableWebSecurity
class SecurityConfig {
    @Bean
    fun filterChain(http: HttpSecurity) = http
        .oauth2ResourceServer { it.jwt {} }
        .authorizeHttpRequests {
            it.requestMatchers("/health").permitAll()
            it.anyRequest().authenticated()
        }
        .build()
}
```

## Gradle 설정

```
settings.gradle.kts:
  include(":charting:domain")
  include(":charting:app")

charting/domain/build.gradle.kts:
  - 순수 Kotlin (Spring 없음)
  - jar만 생성 (bootJar 없음)

charting/app/build.gradle.kts:
  - implementation(project(":charting:domain"))
  - implementation(project(":common"))
  - Spring Boot, Spring Data JPA, WebClient, pgvector
```

## Docker Compose 변경

```yaml
services:
  charting-app:
    build:
      context: .
      dockerfile: docker/Dockerfile
      args:
        MODULE_GRADLE: "charting:app"
        MODULE_PATH: "charting/app"
    ports:
      - "8010:8010"
    depends_on:
      - charting-db
      - charting-data

  charting-data:
    build:
      context: ./charting
      dockerfile: infra/Dockerfile  # 기존 Python Dockerfile 재활용
    ports:
      - "8011:8011"
    command: uvicorn charting_data.main:app --host 0.0.0.0 --port 8011
```

## 마이그레이션 전략

1. **Phase 1**: charting-data Python 서비스 분리 (yfinance + numpy만)
2. **Phase 2**: Kotlin charting:domain + charting:app 구현
3. **Phase 3**: API 호환성 검증 (기존 프론트엔드 무변경 동작)
4. **Phase 4**: Gateway/Security/Eureka 연동
5. **Phase 5**: 기존 Python 서비스 제거

## 예상 공수

| Phase | 작업 | 예상 |
|-------|------|------|
| 1 | Python data service 분리 | 2일 |
| 2 | Kotlin domain + app 구현 | 5일 |
| 3 | API 호환성 테스트 | 1일 |
| 4 | Gateway/Security 연동 | 1일 |
| 5 | 정리 + Docker 업데이트 | 1일 |
| **총** | | **~2주** |

## 리스크

| 리스크 | 대응 |
|--------|------|
| pgvector JPA 매핑 복잡도 | 네이티브 쿼리로 우회 가능 |
| Python data service 장애 시 | Circuit breaker (Resilience4j) + fallback |
| yfinance 비공식 API 변경 | Python 서비스만 수정, Kotlin 무영향 |
| 마이그레이션 중 다운타임 | Blue-green: 신구 서비스 병렬 운영 후 전환 |
