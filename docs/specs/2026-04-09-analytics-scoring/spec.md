# Spec — Analytics & Scoring System

## 1. Overview

커머스 플랫폼에 지표 기반 컨텐츠 평가 체계를 구축한다.
노출/클릭/전환 이벤트를 수집하고, CTR·CVR·인기도 스코어를 준실시간으로 산출하여
검색 랭킹과 상품 정렬에 활용한다. A/B 테스트 플랫폼으로 가중치 실험을 지원한다.

### 신규 서비스

| 서비스 | 역할 | 포트 |
|--------|------|------|
| `analytics` | 이벤트 수집, 스코어 산출, 스코어 조회 API | 8090 |
| `experiment` | A/B 테스트 실험 관리, 버킷 할당, 결과 분석 | 8091 |

### 모듈 구조 (Clean Architecture)

```
analytics/
  domain/       # 순수 도메인 (Event, Score 모델, 산출 로직)
  app/          # Spring Boot (REST API + Kafka Streams + ClickHouse)

experiment/
  domain/       # 순수 도메인 (Experiment, Variant, Assignment 모델)
  app/          # Spring Boot (REST API + MySQL) — ClickHouse 직접 접근 안 함
```

---

## 2. 이벤트 수집

### 2.1 공통 이벤트 스키마

```kotlin
// common 모듈에 위치
data class AnalyticsEvent(
    val eventId: String,          // UUID, 멱등키
    val eventType: EventType,     // SEARCH_KEYWORD, PAGE_VIEW, PRODUCT_VIEW, PRODUCT_CLICK, ADD_TO_CART, ORDER_COMPLETE
    val userId: Long?,            // 로그인 사용자
    val visitorId: String,        // 비로그인 포함 전체 사용자
    val sessionId: String,
    val timestamp: Instant,
    val experimentAssignments: Map<Long, String>?, // experimentId → variantName (Gateway 주입)
    val payload: Map<String, Any> // 이벤트별 상세 데이터
)

enum class EventType {
    SEARCH_KEYWORD,    // payload: { keyword, resultCount, position? }
    PAGE_VIEW,         // payload: { pageType, pageId }
    PRODUCT_VIEW,      // payload: { productId, source, position? }
    PRODUCT_CLICK,     // payload: { productId, source, position, keyword? }
    ADD_TO_CART,       // payload: { productId, quantity }
    ORDER_COMPLETE     // payload: { orderId, productIds, totalAmount }
}
```

### 2.2 이벤트 발행 SDK (common 모듈)

```kotlin
// common 모듈: kgd.common.analytics
@Component
class AnalyticsEventPublisher(
    private val kafkaTemplate: KafkaTemplate<String, AnalyticsEvent>
) {
    fun publish(event: AnalyticsEvent) {
        kafkaTemplate.send(
            "analytics.event.collected",
            event.visitorId,  // 파티션 키: 사용자 단위 순서 보장
            event
        ).whenComplete { _, ex ->
            if (ex != null) log.warn("Event publish failed: ${event.eventId}", ex)
        }
    }
}
```

- **fire-and-forget**: 발행 실패가 비즈니스 로직에 영향 없음
- Auto-Configuration: `kgd.common.analytics` 네임스페이스
- 각 서비스에서 `AnalyticsEventPublisher`를 주입받아 사용

### 2.3 Gateway 사용자 식별

```
┌─ Client Request ─────────────────────────────┐
│                                              │
│  ┌─ Gateway Filter Chain ──────────────────┐ │
│  │ 1. VisitorIdFilter (PRE, order=-10)     │ │
│  │    - Cookie 'vid' 존재 → X-Visitor-Id   │ │
│  │    - 없으면 UUID 생성 → Set-Cookie + 헤더│ │
│  │                                          │ │
│  │ 2. AuthenticationGatewayFilter (기존)    │ │
│  │    - JWT → X-User-Id 헤더               │ │
│  │                                          │ │
│  │ 3. ExperimentAssignmentFilter (PRE)     │ │
│  │    - 활성 실험 조회 (캐시)               │ │
│  │    - userId/visitorId → 버킷 할당        │ │
│  │    - X-Experiment-{id}: {variant} 헤더   │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 2.4 ClickHouse 테이블 설계

```sql
CREATE TABLE analytics.events (
    event_id       String,
    event_type     LowCardinality(String),
    user_id        Nullable(Int64),
    visitor_id     String,
    session_id     String,
    timestamp      DateTime64(3),
    payload        String,  -- JSON string
    
    -- 자주 쿼리하는 필드를 컬럼으로 추출
    product_id     Nullable(Int64),
    keyword        Nullable(String),
    source         Nullable(String),
    position       Nullable(Int32),
    
    -- A/B 실험 컨텍스트
    experiment_ids     Array(Int64),            -- 적용된 실험 ID 목록
    experiment_variants Array(String)            -- 대응하는 variant 이름 목록
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (event_type, timestamp, visitor_id)
TTL timestamp + INTERVAL 90 DAY;
```

### 2.5 Kafka 토픽

| 토픽 | Producer | Consumer | 용도 |
|------|----------|----------|------|
| `analytics.event.collected` | 각 서비스 (common SDK) | analytics 서비스 | 이벤트 수집 |
| `analytics.score.updated` | analytics 서비스 | search:consumer | 스코어 변경 → ES 업데이트 |

---

## 3. 스코어 산출

### 3.1 Kafka Streams 토폴로지

```
analytics.event.collected
    │
    ├─ branch(PRODUCT_VIEW, PRODUCT_CLICK, ORDER_COMPLETE)
    │     │
    │     └─ groupByKey(productId)
    │           │
    │           └─ windowedBy(TimeWindows.ofSizeWithNoGrace(1h))
    │                 │
    │                 └─ aggregate(ProductMetrics)
    │                       │
    │                       └─ compute(CTR, CVR, popularity)
    │                             │
    │                             ├─ to(analytics.score.updated)  // Kafka 발행
    │                             ├─ sink(Redis)                  // 캐시
    │                             └─ sink(ClickHouse)             // 영구 저장
    │
    └─ branch(SEARCH_KEYWORD, PRODUCT_CLICK with keyword)
          │
          └─ groupByKey(keyword)
                │
                └─ windowedBy(TimeWindows.ofSizeWithNoGrace(1h))
                      │
                      └─ aggregate(KeywordMetrics)
                            │
                            └─ compute(keywordScore)
                                  │
                                  ├─ sink(Redis)                  // 캐시
                                  └─ sink(ClickHouse)             // 영구 저장

### 3.1.1 에러 핸들링

- `DeserializationExceptionHandler`: LogAndContinueExceptionHandler (역직렬화 실패 → 로그 + skip)
- `ProductionExceptionHandler`: AlwaysContinueProductionExceptionHandler (발행 실패 → 로그 + continue)
- 처리 실패 이벤트: DLQ 토픽 `analytics.event.dlq`로 전달 (ADR-0015 준수)
- ClickHouse 쓰기 실패: Kafka consumer 수동 오프셋 커밋 — CH 쓰기 성공 후에만 커밋, 실패 시 재시도
```

### 3.2 스코어 모델 (domain)

```kotlin
// analytics/domain
data class ProductScore(
    val productId: Long,
    val impressions: Long,
    val clicks: Long,
    val orders: Long,
    val ctr: Double,             // clicks / impressions
    val cvr: Double,             // orders / clicks
    val popularityScore: Double, // normalized weighted score
    val updatedAt: Instant
)

data class KeywordScore(
    val keyword: String,
    val searchCount: Long,
    val totalClicks: Long,
    val totalOrders: Long,
    val ctr: Double,
    val cvr: Double,
    val score: Double,           // normalized composite score
    val updatedAt: Instant
)
```

### 3.3 정규화 로직 (domain)

```kotlin
object ScoreNormalizer {
    fun normalize(
        value: Double,
        min: Double,
        max: Double,
        clipPercentile: Double = 0.95
    ): Double {
        val upperBound = max * clipPercentile
        if (upperBound <= min) return 0.0  // 데이터 부족 또는 동일값 → 기본 스코어
        val clipped = value.coerceIn(min, upperBound)
        return (clipped - min) / (upperBound - min)
    }
}
```

- 유형별 독립 정규화: 상품 스코어는 상품끼리, 키워드 스코어는 키워드끼리 별개 산출
- 상품 스코어와 키워드 스코어는 서로 다른 모집단에서 min/max 산출

### 3.4 Redis 캐시 구조

```
score:product:{productId}  → ProductScore JSON  (TTL: 2h)
score:keyword:{keyword}    → KeywordScore JSON  (TTL: 2h)
score:product:stats         → { min, max, p95 }  (TTL: 1h, 상품 스코어 정규화 기준)
score:keyword:stats         → { min, max, p95 }  (TTL: 1h, 키워드 스코어 정규화 기준)
```

### 3.5 스코어 조회 API

```
GET  /api/v1/scores/products/{productId}
GET  /api/v1/scores/products/bulk?ids=1,2,3
GET  /api/v1/scores/keywords/{keyword}
```

- 응답: `ApiResponse<ProductScoreResponse>` 표준 포맷
- Redis hit → 즉시 반환, miss → ClickHouse 조회 + Redis 캐시

---

## 4. 검색 통합

### 4.1 ES 문서 스코어 필드 확장

```kotlin
@Document(indexName = "products")
data class ProductEsDocument(
    // ... 기존 필드 ...
    @Field(type = FieldType.Double) val popularityScore: Double = 0.0,
    @Field(type = FieldType.Double) val ctr: Double = 0.0,
    @Field(type = FieldType.Double) val cvr: Double = 0.0,
    @Field(type = FieldType.Long)   val scoreUpdatedAt: Long = 0
)
```

### 4.2 스코어 업데이트 흐름

```
analytics (Kafka Streams)
    │
    └─ publish: analytics.score.updated
         │         { productId, popularityScore, ctr, cvr }
         │
         └─ search:consumer
              │
              └─ ProductScoreUpdateConsumer
                   │
                   └─ ES partial update (doc API)
                        - 스코어 필드만 업데이트
                        - 전체 리인덱싱 불필요
```

- 토픽: `analytics.score.updated`, consumer group: `search-score-updater`
- 멱등 처리: scoreUpdatedAt 타임스탬프 비교, 이전 값이면 skip

### 4.3 검색 랭킹 쿼리

```json
{
  "query": {
    "function_score": {
      "query": {
        "match": { "name": "검색어" }
      },
      "functions": [
        {
          "field_value_factor": {
            "field": "popularityScore",
            "modifier": "none",
            "missing": 0
          },
          "weight": 10
        },
        {
          "field_value_factor": {
            "field": "ctr",
            "modifier": "none",
            "missing": 0
          },
          "weight": 5
        }
      ],
      "score_mode": "sum",
      "boost_mode": "sum"
    }
  }
}
```

- 가중치(weight)는 설정 파일에서 관리
- A/B 실험 시 variant별 가중치 오버라이드 가능

### 4.4 키워드 기반 부스팅 (FR-3.3)

검색 요청 시 키워드 스코어를 활용한 추가 부스팅:

1. 검색 요청 수신 → analytics 스코어 API에서 `KeywordScore` 조회 (Redis 캐시, < 5ms)
2. 키워드 CTR/CVR이 높으면 → 해당 키워드로 전환된 상위 상품에 추가 boost
3. 구현: ES `function_score`의 `script_score`에 키워드 스코어를 파라미터로 전달

```json
{
  "script_score": {
    "script": {
      "source": "_score + params.keyword_boost",
      "params": { "keyword_boost": 0.8 }
    }
  }
}
```

- `keyword_boost` = KeywordScore.score (0.0~1.0, 정규화된 값)
- 키워드 스코어 없으면 boost = 0 (기본 텍스트 매칭만 적용)

---

## 5. A/B 테스트 플랫폼 (experiment 서비스)

### 5.1 도메인 모델

```kotlin
// experiment/domain
data class Experiment(
    val id: Long?,
    val name: String,
    val description: String,
    val status: ExperimentStatus,        // DRAFT, RUNNING, PAUSED, COMPLETED
    val trafficPercentage: Int,          // 0-100, 실험 대상 트래픽 비율
    val variants: List<Variant>,
    val startDate: LocalDateTime?,
    val endDate: LocalDateTime?,
    val createdAt: LocalDateTime
)

data class Variant(
    val id: Long?,
    val name: String,                    // "control", "treatment_a", "treatment_b"
    val weight: Int,                     // 할당 비율 (합계 100)
    val config: Map<String, Any>         // 변형별 설정값 (예: 랭킹 가중치)
)

enum class ExperimentStatus {
    DRAFT, RUNNING, PAUSED, COMPLETED
}
```

### 5.2 버킷 할당 (결정적 해싱)

```kotlin
// experiment/domain
object BucketAssigner {
    fun assign(userId: String, experimentId: Long, variants: List<Variant>): Variant {
        val hash = murmurHash3("${experimentId}:${userId}")
        val bucket = (hash % 10000).absoluteValue  // 0-9999
        
        var cumulative = 0
        for (variant in variants) {
            cumulative += variant.weight * 100  // weight(%) → 0-10000 범위
            if (bucket < cumulative) return variant
        }
        return variants.last()
    }
}
```

- 같은 입력 → 항상 같은 결과 (stateless)
- DB 조회 불필요 → 지연 최소화

### 5.3 API

```
POST   /api/v1/experiments              # 실험 생성
GET    /api/v1/experiments              # 실험 목록
GET    /api/v1/experiments/{id}         # 실험 상세
PUT    /api/v1/experiments/{id}         # 실험 수정
PATCH  /api/v1/experiments/{id}/status  # 상태 변경

GET    /api/v1/experiments/{id}/assignment?userId={uid}  # 버킷 할당
GET    /api/v1/experiments/{id}/results                  # 결과 분석
```

### 5.4 결과 분석

```sql
-- ClickHouse: 실험 기간 variant별 지표 비교
SELECT
    experiment_variant,
    count(*) as total_events,
    countIf(event_type = 'PRODUCT_CLICK') as clicks,
    countIf(event_type = 'PRODUCT_VIEW') as impressions,
    countIf(event_type = 'ORDER_COMPLETE') as orders,
    clicks / impressions as ctr,
    orders / clicks as cvr
FROM analytics.events
WHERE timestamp BETWEEN {start} AND {end}
  AND experiment_id = {expId}
GROUP BY experiment_variant
```

- experiment 서비스는 ClickHouse에 직접 접근하지 않음 (DB 공유 금지)
- analytics 서비스가 실험 결과 분석 API 제공:
  `GET /api/v1/analytics/experiments/{id}/metrics?start={}&end={}`
- experiment 서비스는 analytics API를 호출하여 결과 데이터 조회
- 통계적 유의성: Chi-squared test 또는 Z-test (experiment/domain 로직)

### 5.5 Gateway 통합

```kotlin
// gateway: ExperimentAssignmentFilter
@Component
class ExperimentAssignmentFilter(
    private val experimentClient: ExperimentClient  // WebClient → experiment 서비스
) : GlobalFilter {
    
    // 활성 실험 목록 캐시 (Redis, TTL 1분)
    private val activeExperimentsCache: ...
    
    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val userId = exchange.request.headers["X-User-Id"]?.first()
            ?: exchange.request.headers["X-Visitor-Id"]?.first()
            ?: return chain.filter(exchange)
        
        return getActiveExperiments()
            .flatMap { experiments ->
                val mutated = exchange.request.mutate()
                experiments.forEach { exp ->
                    val variant = BucketAssigner.assign(userId, exp.id, exp.variants)
                    mutated.header("X-Experiment-${exp.id}", variant.name)
                }
                chain.filter(exchange.mutate().request(mutated.build()).build())
            }
    }
}
```

- `BucketAssigner`는 common 모듈에 배치 → Gateway, experiment 서비스 모두 의존
- 활성 실험 목록만 Redis 캐시에서 조회 (experiment 서비스가 캐시 갱신)

---

## 6. 인프라 구성

### 6.1 Docker Compose 추가

```yaml
# docker/docker-compose.infra.yml에 추가
clickhouse:
  image: clickhouse/clickhouse-server:24.3
  ports:
    - "8123:8123"   # HTTP
    - "9000:9000"   # Native
  volumes:
    - clickhouse-data:/var/lib/clickhouse
    - ./clickhouse/init.sql:/docker-entrypoint-initdb.d/init.sql
  environment:
    CLICKHOUSE_USER: ${CLICKHOUSE_USER:-analytics}
    CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD:-analytics}
    CLICKHOUSE_DB: ${CLICKHOUSE_DB:-analytics}
```

### 6.2 서비스 의존성

```
gateway ──► experiment (활성 실험 캐시)
각 서비스 ──► common:analytics (이벤트 SDK)
analytics ──► Kafka (소비), ClickHouse (저장), Redis (스코어 캐시)
analytics ──► Kafka (발행: score.updated)
search:consumer ──► Kafka (소비: score.updated) → ES (부분 업데이트)
experiment ──► MySQL (실험 CRUD), analytics API (결과 분석 조회)
```

---

## 7. 확장 포인트

### 7.1 개인화/추천 (Phase 2)
- 사용자별 행동 프로파일: ClickHouse에 사용자별 관심 카테고리, 선호 가격대 집계
- 협업 필터링: 유사 사용자 기반 추천 (별도 ML 파이프라인)
- 개인화 스코어: 전체 인기도 + 사용자 선호도 조합

### 7.2 카테고리별 세분화 (Phase 2)
- Product 서비스에 카테고리 필드 추가
- 상품 스코어를 카테고리 내에서 추가 세분화 정규화
- 카테고리 간 비교가 필요한 경우 글로벌 정규화와 이중 적용

### 7.3 실시간 대시보드 (Phase 2)
- ClickHouse Materialized View로 실시간 집계
- Grafana 연동 모니터링
