---
parent: 20-recommendation-modeling
seq: 22
title: Phase 1 구현 — 룰 기반 Category Best, ClickHouse SQL + Redis 캐시 + API + 통합 테스트
type: deep
created: 2026-05-12
---

# 22. Phase 1 — 룰 기반 Category Best 구현

> **Phase 10 - Phase 1 production 구현**. §05 행동 가중합 + §06 Wilson LCB 의 ClickHouse SQL 화 + Redis 캐싱 + Spring Boot API. msa 첫 추천 서비스.

---

## 1. 구현 범위

```
사용자 행동 로그 (Kafka)
   ↓
ClickHouse (recommendation_score_daily Materialized View)
   ↓
Daily Argo Workflow: 행동 가중합 + Wilson LCB → Top-N
   ↓
Redis (reco:cb:{city_id}:{category_id})
   ↓
GET /api/v1/recommendations/category-best
```

---

## 2. ClickHouse 행동 가중합 SQL

```sql
-- 일일 Argo 잡: 룰 기반 Category Best score 산출
WITH recent_actions AS (
    SELECT
        city_id,
        category_id,
        item_id,
        sumIf(1, action_type='reservation') AS reservation_cnt,
        sumIf(1, action_type='click') AS click_cnt,
        sumIf(1, action_type='addwish') AS addwish_cnt,
        sumIf(1, action_type='pageview') AS pageview_cnt
    FROM recommendation_events
    WHERE timestamp >= now() - INTERVAL 30 DAY
    GROUP BY city_id, category_id, item_id
    HAVING reservation_cnt + click_cnt + addwish_cnt + pageview_cnt >= 10  -- 최소 노출 필터 (§02 §10)
),
scored AS (
    SELECT
        city_id,
        category_id,
        item_id,
        -- 행동 가중합 (§05)
        reservation_cnt * 100 
        + click_cnt * 20 
        + addwish_cnt * 10 
        + pageview_cnt * 1 AS raw_score,
        -- Wilson LCB CTR (§06)
        let total = click_cnt + pageview_cnt in
        if(total > 0,
            (click_cnt/total + 1.96*1.96/(2*total) 
             - 1.96 * sqrt((click_cnt/total)*(1 - click_cnt/total)/total + 1.96*1.96/(4*total*total))
            ) / (1 + 1.96*1.96/total),
            0
        ) AS wilson_ctr
    FROM recent_actions
),
final AS (
    SELECT
        city_id,
        category_id,
        item_id,
        -- 최종 score = raw × log(1 + wilson_ctr × 100)
        raw_score * log(1 + wilson_ctr * 100) AS final_score,
        raw_score,
        wilson_ctr,
        row_number() OVER (
            PARTITION BY city_id, category_id
            ORDER BY raw_score * log(1 + wilson_ctr * 100) DESC
        ) AS rank
    FROM scored
)
SELECT * 
FROM final 
WHERE rank <= 100  -- Top-100 per (city, category)
ORDER BY city_id, category_id, rank;
```

**핵심 설계 결정**:
- 30일 윈도우 (§05 §5 의 cliff time decay)
- 최소 노출 ≥ 10 (§02 §10 sparse 함정 회피)
- 행동 가중합 × Wilson LCB CTR (§05 + §06 결합)

---

## 3. ClickHouse → Redis 동기화

### 3-1. Argo Workflow 정의

```yaml
# k8s 추천 batch 워크플로
apiVersion: argoproj.io/v1alpha1
kind: CronWorkflow
metadata:
  name: recommendation-cb-daily
spec:
  schedule: "0 2 * * *"  # 매일 02:00
  workflowSpec:
    entrypoint: cb-pipeline
    templates:
      - name: cb-pipeline
        steps:
          - - name: compute-scores
              template: clickhouse-query
          - - name: sync-to-redis
              template: clickhouse-to-redis
      
      - name: clickhouse-query
        container:
          image: clickhouse/clickhouse-client:latest
          command: [clickhouse-client]
          args:
            - "--host=clickhouse-svc"
            - "--query=$(cat /scripts/cb-score.sql)"
            - "--format=TabSeparated"
          volumeMounts:
            - mountPath: /scripts
              name: scripts
      
      - name: clickhouse-to-redis
        container:
          image: recommendation-sync:1.0.0
          env:
            - name: SOURCE
              value: "clickhouse://clickhouse-svc/recommendation"
            - name: TARGET
              value: "redis://redis-svc:6379"
```

### 3-2. ClickHouse → Redis Sync 코드 (Kotlin)

```kotlin
// recommendation/batch/.../sync/CbScoreSync.kt
@Component
class CbScoreSync(
    private val clickHouse: NamedParameterJdbcTemplate,
    private val redisTemplate: RedisTemplate<String, String>,
) {
    fun sync() {
        val rows = clickHouse.query(
            """
            SELECT city_id, category_id, item_id, final_score
            FROM recommendation_cb_top100
            ORDER BY city_id, category_id, rank
            """,
            mapOf<String, Any>()
        ) { rs, _ ->
            CbRow(
                cityId = rs.getLong("city_id"),
                categoryId = rs.getLong("category_id"),
                itemId = rs.getLong("item_id"),
                score = rs.getDouble("final_score"),
            )
        }
        
        // Redis ZSET 으로 group by (city, category)
        rows.groupBy { it.cityId to it.categoryId }.forEach { (key, groupRows) ->
            val (cityId, categoryId) = key
            val redisKey = "reco:cb:$cityId:$categoryId"
            
            // 기존 키 삭제 (atomic 교체)
            val newKey = "${redisKey}:new"
            groupRows.forEach { row ->
                redisTemplate.opsForZSet().add(newKey, row.itemId.toString(), row.score)
            }
            redisTemplate.opsForZSet().add(newKey, "")  // placeholder
            redisTemplate.rename(newKey, redisKey)
            redisTemplate.expire(redisKey, Duration.ofHours(25))  // 25h TTL (다음 갱신 + 여유)
        }
    }
}
```

---

## 4. Repository Adapter

```kotlin
// recommendation/app/.../infrastructure/persistence/RedisRecommendationAdapter.kt
@Repository
class RedisRecommendationAdapter(
    private val redisTemplate: RedisTemplate<String, String>,
) : RecommendationRepository {
    
    override fun findCategoryBest(
        cityId: Long, 
        categoryId: Long, 
        limit: Int,
    ): Recommendation {
        val key = "reco:cb:$cityId:$categoryId"
        
        // ZRANGEBYSCORE (Top-N by score desc)
        val tuples = redisTemplate.opsForZSet()
            .reverseRangeWithScores(key, 0, (limit - 1).toLong())
            ?: emptySet()
        
        val items = tuples.map { tuple ->
            RecommendationItem(
                itemId = tuple.value?.toLong() ?: 0,
                score = tuple.score ?: 0.0,
                source = "category-best",
            )
        }
        
        return Recommendation(
            type = RecommendationType.CATEGORY_BEST,
            userId = null,
            context = RecommendationContext(
                cityId = cityId,
                categoryId = categoryId,
                sourceItemId = null,
            ),
            items = items,
            generatedAt = Instant.now(),
        )
    }
    
    override fun saveCategoryBest(recommendation: Recommendation) {
        // CbScoreSync 가 직접 저장. 여기는 빈 구현 또는 예외.
        throw UnsupportedOperationException("Use CbScoreSync for writes")
    }
}
```

---

## 5. Use Case + Controller

```kotlin
// application/usecase/GetCategoryBestUseCase.kt
@UseCase
class GetCategoryBestUseCase(
    private val repository: RecommendationRepository,
) {
    fun execute(cityId: Long, categoryId: Long, limit: Int): Recommendation {
        require(limit in 1..100) { "limit must be 1..100" }
        return repository.findCategoryBest(cityId, categoryId, limit)
    }
}

// presentation/RecommendationController.kt
@RestController
@RequestMapping("/api/v1/recommendations")
class RecommendationController(
    private val getCategoryBest: GetCategoryBestUseCase,
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
}
```

---

## 6. 통합 테스트 — Kotest

```kotlin
// recommendation/app/src/test/kotlin/.../GetCategoryBestUseCaseSpec.kt
class GetCategoryBestUseCaseSpec : BehaviorSpec({
    val repository = mockk<RecommendationRepository>()
    val useCase = GetCategoryBestUseCase(repository)
    
    Given("city=1, category=10, limit=20") {
        every { 
            repository.findCategoryBest(1, 10, 20) 
        } returns Recommendation(
            type = RecommendationType.CATEGORY_BEST,
            userId = null,
            context = RecommendationContext(1, 10, null),
            items = listOf(
                RecommendationItem(1001, 1000.0, "category-best"),
                RecommendationItem(1002, 800.0, "category-best"),
                // ...
            ),
            generatedAt = Instant.now(),
        )
        
        When("execute") {
            val result = useCase.execute(1, 10, 20)
            
            Then("returns items sorted by score desc") {
                result.items[0].itemId shouldBe 1001
                result.items[0].score shouldBeGreaterThan result.items[1].score
            }
        }
    }
    
    Given("invalid limit=0") {
        When("execute") {
            Then("throws IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> {
                    useCase.execute(1, 10, 0)
                }
            }
        }
    }
})

// ClickHouse → Redis sync 의 통합 테스트 (Testcontainers)
class CbScoreSyncIntegrationSpec : BehaviorSpec({
    val clickHouse = ClickHouseContainer("clickhouse/clickhouse-server:23.8")
    val redis = GenericContainer("redis:7").withExposedPorts(6379)
    
    Given("ClickHouse 에 test 데이터 + sync 실행") {
        // setup ClickHouse 데이터
        clickHouse.start()
        redis.start()
        
        val sync = CbScoreSync(createJdbcTemplate(clickHouse), createRedisTemplate(redis))
        
        When("sync 실행") {
            sync.sync()
            
            Then("Redis 에 reco:cb:{cityId}:{categoryId} 키 생성") {
                redisTemplate.hasKey("reco:cb:1:10") shouldBe true
                redisTemplate.opsForZSet().zCard("reco:cb:1:10") shouldBeGreaterThan 0
            }
        }
    }
})
```

---

## 7. Gateway 라우팅 추가

```yaml
# gateway/src/main/resources/application.yml
spring:
  cloud:
    gateway:
      routes:
        - id: recommendation
          uri: http://recommendation-svc:8080
          predicates:
            - Path=/api/v1/recommendations/**
          filters:
            - AddRequestHeader=X-Source-Service, gateway
```

또는 K8s Ingress (msa 본 레포의 ingress-nginx 패턴).

---

## 8. 성능 / SLA 목표

```
P50 latency: < 5 ms (Redis ZRANGEBYSCORE)
P99 latency: < 20 ms
Throughput: 1000 RPS (single instance)

Cache hit rate: 99%+ (실시간 ranking 안 함, 사전 계산)
Refresh latency: 30 min (Argo daily job 가 1시간 내 완료)
```

---

## 9. 운영 / 모니터링

### 9-1. 메트릭

```kotlin
@Component
class RecommendationMetrics(meterRegistry: MeterRegistry) {
    val categoryBestRequests = Counter.builder("recommendation.category_best.requests")
        .register(meterRegistry)
    
    val categoryBestLatency = Timer.builder("recommendation.category_best.latency")
        .register(meterRegistry)
    
    val emptyResults = Counter.builder("recommendation.category_best.empty")
        .description("Returned 0 items (cache miss or no data)")
        .register(meterRegistry)
}
```

### 9-2. 알림

- Cache miss rate > 5% → ClickHouse 갱신 실패 의심
- Empty result rate > 1% → cb-sync 잡 실패
- P99 latency > 50 ms → Redis 부하 의심

---

## 10. A/B 실험 통합 (Phase 9 §19)

`experiment` 서비스와 통합:

```kotlin
// presentation/RecommendationController.kt 확장
@GetMapping("/category-best")
fun categoryBest(
    @RequestParam cityId: Long,
    @RequestParam categoryId: Long,
    @RequestParam(defaultValue = "20") limit: Int,
    @RequestHeader("X-User-Id") userId: Long?,
): ApiResponse<RecommendationDto> {
    val variant = experimentClient.getVariant("rec_cb_v1", userId)
    
    val result = when (variant) {
        "control" -> getCategoryBest.execute(cityId, categoryId, limit)
        "treatment" -> getCategoryBestV2.execute(cityId, categoryId, limit)  // 새 알고리즘
        else -> getCategoryBest.execute(cityId, categoryId, limit)
    }
    
    // 노출 이벤트 → analytics (variant 기록)
    analyticsClient.recordImpression(userId, result.items, variant)
    
    return ApiResponse.ok(result.toDto())
}
```

---

## 11. 점진 도입 체크리스트 (Phase 1)

- [ ] `recommendation/domain` 모듈 + 도메인 객체 + Wilson LCB
- [ ] `recommendation/app` 모듈 + Spring Boot + ClickHouse 연결
- [ ] ClickHouse SQL 행동 가중합 + Wilson LCB
- [ ] Argo Workflow daily sync
- [ ] Redis 캐시 + ZSET 기반 룩업
- [ ] GET /api/v1/recommendations/category-best
- [ ] Kotest 단위 + 통합 테스트
- [ ] Gateway 라우팅 + Ingress
- [ ] 메트릭 + 알림
- [ ] (optional) experiment 서비스 연동 + A/B

---

## 12. cross-ref

| 주제 | 연결된 study |
|---|---|
| 행동 가중합 | §05 |
| Wilson LCB | §06 |
| Sparse data 함정 | §02 §10 |
| ADR 도입 단계 | §20 |
| msa 스캐폴딩 | §21 |
| 다음: CF Spark PoC | §23 |
| A/B 통합 | §19, Phase 10 §25 |
| ClickHouse SQL | analytics 서비스 |
