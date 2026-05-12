---
parent: 20-recommendation-modeling
seq: 21
title: recommendation 서비스 스캐폴딩 — nested submodule, Clean Architecture, Kafka topic, DB schema
type: deep
created: 2026-05-12
---

# 21. recommendation 서비스 스캐폴딩

> **Phase 10 - msa 본 레포에 신규 서비스 추가**. msa 의 nested submodule 패턴 (`{service}:domain` / `{service}:app`) + Clean Architecture + Kafka topic + DB schema.

---

## 1. 모듈 구조

msa CLAUDE.md 의 표준 패턴 따름:

```
recommendation/
├── domain/             # Pure domain (no Spring/JPA)
│   ├── build.gradle.kts
│   └── src/main/kotlin/com/kgd/recommendation/
│       └── (domain entities, ports, business rules)
├── app/                # Spring Boot application
│   ├── build.gradle.kts
│   └── src/main/kotlin/com/kgd/recommendation/
│       ├── application/   # use cases
│       ├── presentation/  # REST controllers
│       └── infrastructure/  # adapters
└── batch/              # Spark CF jobs (Phase 2)
    ├── build.gradle.kts
    └── src/main/scala/com/kgd/recommendation/batch/
```

### 1-1. `settings.gradle.kts` 등록

```kotlin
// settings.gradle.kts (msa 본 레포)
include(":recommendation:domain")
include(":recommendation:app")
include(":recommendation:batch")
```

### 1-2. `recommendation/domain/build.gradle.kts`

```kotlin
plugins {
    kotlin("jvm")
}

dependencies {
    implementation(project(":common"))
    implementation("org.springframework.data:spring-data-commons")  // Page / Pageable
}
```

### 1-3. `recommendation/app/build.gradle.kts`

```kotlin
plugins {
    id("org.springframework.boot")
    id("io.spring.dependency-management")
    kotlin("jvm")
    kotlin("plugin.spring")
    kotlin("plugin.jpa")
}

dependencies {
    implementation(project(":recommendation:domain"))
    implementation(project(":common"))
    
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation("org.springframework.kafka:spring-kafka")
    
    runtimeOnly("com.clickhouse:clickhouse-jdbc")
    
    testImplementation("io.kotest:kotest-runner-junit5")
    testImplementation("io.mockk:mockk")
}
```

---

## 2. Clean Architecture 매핑

### 2-1. 디렉토리 구조

```
recommendation/
├── domain/src/main/kotlin/com/kgd/recommendation/
│   ├── recommendation/
│   │   ├── Recommendation.kt          # Aggregate root
│   │   ├── RecommendationItem.kt
│   │   ├── RecommendationType.kt      # enum: CATEGORY_BEST, SIMILAR_ITEMS, PERSONALIZED
│   │   └── RecommendationScore.kt
│   ├── port/
│   │   ├── RecommendationRepository.kt    # Output port
│   │   ├── ItemSimilarityPort.kt          # Output port (Phase 2)
│   │   └── EmbeddingAnnPort.kt            # Output port (Phase 3)
│   └── service/
│       └── RecommendationService.kt        # Domain logic (사용자 약점 영역에 따라 행동 가중합 등 도메인 룰)
│
└── app/src/main/kotlin/com/kgd/recommendation/
    ├── application/
    │   ├── usecase/
    │   │   ├── GetCategoryBestUseCase.kt
    │   │   ├── GetSimilarItemsUseCase.kt
    │   │   └── GetPersonalizedUseCase.kt
    │   └── service/
    │       └── RecommendationApplicationService.kt
    ├── presentation/
    │   └── RecommendationController.kt
    └── infrastructure/
        ├── persistence/
        │   ├── ClickHouseRecommendationAdapter.kt
        │   └── RedisRecommendationCacheAdapter.kt
        ├── client/
        │   └── EmbeddingAnnGrpcClient.kt
        └── kafka/
            └── RecommendationEventConsumer.kt
```

### 2-2. 의존성 방향 (Clean Architecture)

```
Domain  ←  Application  ←  Infrastructure / Presentation
   ↑                          ↓
   └──────────── Port ────────┘
```

핵심:
- Domain 은 Spring / JPA / Kafka 모르고
- Application 이 Domain port 를 통해 Infrastructure 호출
- Infrastructure adapter 가 port 구현

---

## 3. Domain 레이어 — Pure Kotlin

### 3-1. Aggregate Root

```kotlin
// recommendation/domain/.../recommendation/Recommendation.kt
package com.kgd.recommendation.recommendation

data class Recommendation(
    val type: RecommendationType,
    val userId: Long?,
    val context: RecommendationContext,
    val items: List<RecommendationItem>,
    val generatedAt: Instant,
) {
    fun topK(k: Int): Recommendation =
        copy(items = items.sortedByDescending { it.score }.take(k))
}

data class RecommendationItem(
    val itemId: Long,
    val score: Double,
    val source: String,  // which engine produced it
)

enum class RecommendationType {
    CATEGORY_BEST,
    SIMILAR_ITEMS,
    PERSONALIZED,
}

data class RecommendationContext(
    val cityId: Long?,
    val categoryId: Long?,
    val sourceItemId: Long?,  // similar-items 의 anchor
)
```

### 3-2. Output Ports

```kotlin
// recommendation/domain/.../port/RecommendationRepository.kt
package com.kgd.recommendation.port

interface RecommendationRepository {
    fun findCategoryBest(cityId: Long, categoryId: Long, limit: Int): Recommendation
    fun saveCategoryBest(recommendation: Recommendation)
}

// recommendation/domain/.../port/ItemSimilarityPort.kt
interface ItemSimilarityPort {
    fun findSimilar(itemId: Long, limit: Int): List<RecommendationItem>
}

// recommendation/domain/.../port/EmbeddingAnnPort.kt
interface EmbeddingAnnPort {
    fun retrieveCandidates(userEmbedding: FloatArray, k: Int): List<RecommendationItem>
    fun lookupUserEmbedding(userId: Long): FloatArray?
}
```

### 3-3. Domain Service — 행동 가중합 (§05 활용)

```kotlin
// recommendation/domain/.../service/RecommendationService.kt
package com.kgd.recommendation.service

object ActionWeightedScore {
    const val WEIGHT_RESERVATION = 100.0
    const val WEIGHT_CLICK = 20.0
    const val WEIGHT_ADDWISH = 10.0
    const val WEIGHT_PAGEVIEW = 1.0
    
    fun compute(
        reservationCount: Long,
        clickCount: Long,
        addwishCount: Long,
        pageviewCount: Long,
    ): Double = reservationCount * WEIGHT_RESERVATION +
        clickCount * WEIGHT_CLICK +
        addwishCount * WEIGHT_ADDWISH +
        pageviewCount * WEIGHT_PAGEVIEW
}

object WilsonLcb {
    /** §06 의 Wilson score lower confidence bound (95%, z=1.96) */
    fun compute(positives: Long, total: Long): Double {
        if (total == 0L) return 0.0
        val p = positives.toDouble() / total
        val n = total.toDouble()
        val z = 1.96
        val numerator = p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
        val denominator = 1 + z * z / n
        return Math.max(0.0, numerator / denominator)
    }
}
```

이 두 객체가 **§05, §06 의 학습 내용의 production 화**. 도메인 로직이므로 Spring 의존성 없음.

---

## 4. Application 레이어 — Use Cases

```kotlin
// recommendation/app/.../application/usecase/GetCategoryBestUseCase.kt
package com.kgd.recommendation.application.usecase

@UseCase
class GetCategoryBestUseCase(
    private val repository: RecommendationRepository,
) {
    fun execute(cityId: Long, categoryId: Long, limit: Int): Recommendation {
        return repository
            .findCategoryBest(cityId, categoryId, limit)
            .topK(limit)
    }
}
```

---

## 5. Presentation — REST API

```kotlin
// recommendation/app/.../presentation/RecommendationController.kt
@RestController
@RequestMapping("/api/v1/recommendations")
class RecommendationController(
    private val getCategoryBest: GetCategoryBestUseCase,
    private val getSimilarItems: GetSimilarItemsUseCase,
    private val getPersonalized: GetPersonalizedUseCase,
) {
    @GetMapping("/category-best")
    fun categoryBest(
        @RequestParam cityId: Long,
        @RequestParam categoryId: Long,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ApiResponse<RecommendationDto> {
        val result = getCategoryBest.execute(cityId, categoryId, limit)
        return ApiResponse.ok(result.toDto())
    }
    
    @GetMapping("/similar-items")
    fun similarItems(
        @RequestParam itemId: Long,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ApiResponse<RecommendationDto> {
        val result = getSimilarItems.execute(itemId, limit)
        return ApiResponse.ok(result.toDto())
    }
    
    @GetMapping("/personalized")
    fun personalized(
        @RequestParam userId: Long,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ApiResponse<RecommendationDto> {
        val result = getPersonalized.execute(userId, limit)
        return ApiResponse.ok(result.toDto())
    }
}
```

`ApiResponse<T>` 는 msa 의 표준 응답 포맷 (docs/architecture/api-response.md).

---

## 6. Kafka Topic 정의

`docs/architecture/kafka-convention.md` 의 표준 따름.

```
Topic: recommendation.events.v1
Format: Avro
Schema:
   record UserAction {
     long user_id;
     long item_id;
     string action_type;  // "pageview", "click", "addwish", "reservation"
     string city_id;
     string category_id;
     long timestamp;
   }
Partitions: 12
Replication: 3 (production)
Retention: 7 days (raw events, ClickHouse 가 영구 보관)
```

Consumer:
```kotlin
@KafkaListener(topics = ["recommendation.events.v1"], groupId = "recommendation-events-consumer")
class RecommendationEventConsumer(
    private val clickHouseAdapter: ClickHouseRecommendationAdapter,
) {
    @KafkaHandler
    fun handle(event: UserActionEvent, ack: Acknowledgment) {
        try {
            clickHouseAdapter.insertEvent(event)
            ack.acknowledge()
        } catch (e: Exception) {
            // §6 멱등성 패턴 — 재시도 가능
            throw e
        }
    }
}
```

---

## 7. DB Schema — ClickHouse

```sql
-- 사용자 행동 이벤트 (raw)
CREATE TABLE recommendation_events (
    user_id UInt64,
    item_id UInt64,
    action_type Enum8('pageview'=1, 'click'=2, 'addwish'=3, 'reservation'=4),
    city_id UInt32,
    category_id UInt32,
    timestamp DateTime64(3)
) ENGINE = MergeTree()
ORDER BY (city_id, category_id, timestamp)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 90 DAY;

-- 룰 기반 score (Phase 1) — Materialized View 로 실시간 집계
CREATE MATERIALIZED VIEW recommendation_score_daily
ENGINE = SummingMergeTree()
ORDER BY (city_id, category_id, item_id, event_date)
AS SELECT
    city_id,
    category_id,
    item_id,
    toDate(timestamp) AS event_date,
    sumIf(1, action_type='reservation') AS reservation_count,
    sumIf(1, action_type='click') AS click_count,
    sumIf(1, action_type='addwish') AS addwish_count,
    sumIf(1, action_type='pageview') AS pageview_count
FROM recommendation_events
GROUP BY city_id, category_id, item_id, event_date;

-- Item-Item Similarity (Phase 2) — Spark CF 결과
CREATE TABLE item_similarity (
    item_id_a UInt64,
    item_id_b UInt64,
    similarity Float32,
    metric Enum8('cosine'=1, 'pmi'=2, 'jaccard'=3),
    computed_at DateTime
) ENGINE = ReplacingMergeTree(computed_at)
ORDER BY (item_id_a, similarity DESC, item_id_b);
```

---

## 8. Redis Cache 설계

```
Key 패턴:
   reco:cb:{city_id}:{category_id}     → ZSET (item_id, score)
   reco:similar:{item_id}              → ZSET (similar_item_id, similarity)
   reco:user_embedding:{user_id}       → BYTES (float32 vector, 64 dim = 256 bytes)

TTL:
   cb, similar: 1 hour (재계산 주기와 일치)
   user_embedding: 24 hours (일일 재학습)
```

---

## 9. Test 전략 — Kotest BehaviorSpec

```kotlin
// recommendation/domain/src/test/kotlin/.../service/WilsonLcbSpec.kt
class WilsonLcbSpec : BehaviorSpec({
    Given("CTR 5% with 10000 impressions") {
        val wilson = WilsonLcb.compute(positives = 500, total = 10000)
        Then("LCB should be close to empirical (4.6%)") {
            wilson shouldBe (0.046..0.047)
        }
    }
    
    Given("CTR 100% with 1 impression") {
        val wilson = WilsonLcb.compute(positives = 1, total = 1)
        Then("LCB should be significantly lower than 100%") {
            wilson shouldBeLessThan 0.30
            wilson shouldBeGreaterThan 0.15
        }
    }
})
```

---

## 10. 점진 도입 체크리스트

- [ ] `recommendation/domain` 모듈 + Aggregate / Port 정의
- [ ] `recommendation/app` 모듈 + Spring Boot 부팅
- [ ] Kafka topic `recommendation.events.v1` 생성
- [ ] ClickHouse 스키마 마이그레이션
- [ ] Redis cache 키 설계
- [ ] Phase 1 (§22) 룰 기반 CB 구현
- [ ] gateway 라우팅 추가 (`/api/v1/recommendations/*`)
- [ ] 통합 테스트 + A/B 실험

---

## 11. cross-ref

| 주제 | 연결된 study |
|---|---|
| msa 모듈 구조 | docs/architecture/module-structure.md |
| Kafka 토픽 컨벤션 | docs/architecture/kafka-convention.md |
| API 응답 포맷 | docs/architecture/api-response.md |
| 멱등성 패턴 | docs/conventions/idempotent-consumer.md |
| Test 표준 | docs/standards/test-rules.md |
| §22 구현 (Phase 1) | 다음 파일 |
| §23 (Phase 2 Spark) | 다음 파일 |
| §24 (Phase 3 Two-Tower) | 다음 파일 |
