---
parent: 20-recommendation-modeling
seq: 25
title: Gateway 라우팅 + experiment A/B 연동 + analytics 메트릭 발행 (Phase 10 선택)
type: deep
created: 2026-05-12
---

# 25. Gateway 라우팅 + Experiment A/B + Analytics 연동

> **Phase 10 - 선택적 마무리**. 추천 서비스의 외부 노출 (gateway) + A/B 실험 통합 (experiment) + 메트릭 발행 (analytics). msa 의 기존 서비스들과의 통합.

---

## 1. Gateway 라우팅

### 1-1. msa Gateway 의 라우팅 추가

msa 본 레포의 `gateway/` 서비스에 라우팅 규칙 추가.

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
            - StripPrefix=0
            - name: CircuitBreaker
              args:
                name: recommendationCircuit
                fallbackUri: forward:/recommendation-fallback
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 100
                redis-rate-limiter.burstCapacity: 200
```

### 1-2. Ingress 추가

K8s overlay 의 ingress 에 path 추가:

```yaml
# k8s/overlays/prod-k8s/ingress/recommendation-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /api/v1/recommendations(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: gateway
                port:
                  number: 8080
```

### 1-3. CircuitBreaker Fallback

추천 서비스 장애 시:

```kotlin
// gateway/.../fallback/RecommendationFallbackController.kt
@RestController
class RecommendationFallbackController {
    @GetMapping("/recommendation-fallback")
    fun fallback(): ApiResponse<RecommendationDto> {
        return ApiResponse.ok(RecommendationDto(
            type = "FALLBACK",
            items = emptyList(),  // 또는 cached popular items
            message = "Recommendation service temporarily unavailable",
        ))
    }
}
```

→ ADR-0015 (Resilience Strategy) 의 CircuitBreaker / Fallback 패턴 적용.

---

## 2. Experiment 서비스 통합 — A/B

### 2-1. msa Experiment 서비스 API

msa 본 레포의 `experiment` 서비스가 A/B 플랫폼:

```
GET /api/v1/experiment/variant?experimentId={id}&userId={userId}
   → { "variant": "control" | "treatment_v1" | ... }

POST /api/v1/experiment/exposure
   Body: { experimentId, userId, variant, timestamp }
```

### 2-2. recommendation 서비스의 통합

```kotlin
// recommendation/app/.../infrastructure/client/ExperimentClient.kt
@Component
class ExperimentClient(
    @Value("\${experiment.url}") private val experimentUrl: String,
    private val restTemplate: RestTemplate,
) {
    private val logger = KotlinLogging.logger {}
    
    fun getVariant(experimentId: String, userId: Long): String {
        return try {
            val response = restTemplate.getForObject<VariantResponse>(
                "$experimentUrl/api/v1/experiment/variant?experimentId=$experimentId&userId=$userId",
                VariantResponse::class.java
            )
            response?.variant ?: "control"
        } catch (e: Exception) {
            logger.warn { "Failed to get variant for $experimentId, falling back to control: ${e.message}" }
            "control"
        }
    }
}

data class VariantResponse(val variant: String)
```

### 2-3. Controller 의 A/B Routing

```kotlin
// presentation/RecommendationController.kt 확장
@RestController
@RequestMapping("/api/v1/recommendations")
class RecommendationController(
    private val getCategoryBest: GetCategoryBestUseCase,
    private val getSimilarItems: GetSimilarItemsUseCase,
    private val getPersonalized: GetPersonalizedUseCase,
    private val experimentClient: ExperimentClient,
    private val analyticsPublisher: AnalyticsPublisher,
) {
    @GetMapping("/personalized")
    fun personalized(
        @RequestParam userId: Long,
        @RequestParam(defaultValue = "20") limit: Int,
    ): ApiResponse<RecommendationDto> {
        // A/B 분기
        val variant = experimentClient.getVariant("rec_phase_v1", userId)
        
        val result = when (variant) {
            "control" -> {
                // CB 만 사용 (Phase 1)
                getCategoryBest.execute(
                    cityId = 1, categoryId = 1, limit = limit
                ).copy(userId = userId)
            }
            "treatment_cf" -> {
                // CF Similar (Phase 2) — userId 의 최근 본 item 기반
                val recentItem = getRecentItem(userId) ?: 1L
                getSimilarItems.execute(recentItem, limit)
            }
            "treatment_two_tower" -> {
                // Two-Tower (Phase 3)
                getPersonalized.execute(userId, limit)
            }
            else -> getPersonalized.execute(userId, limit)
        }
        
        // 노출 이벤트 발행
        analyticsPublisher.publishImpression(
            userId = userId,
            items = result.items,
            variant = variant,
            experimentId = "rec_phase_v1",
        )
        
        return ApiResponse.ok(result.toDto())
    }
}
```

---

## 3. Analytics 메트릭 발행

### 3-1. Kafka 노출 이벤트 발행

```kotlin
// recommendation/app/.../infrastructure/kafka/AnalyticsPublisher.kt
@Component
class AnalyticsPublisher(
    private val kafkaTemplate: KafkaTemplate<String, ImpressionEvent>,
) {
    fun publishImpression(
        userId: Long,
        items: List<RecommendationItem>,
        variant: String,
        experimentId: String,
    ) {
        items.forEachIndexed { position, item ->
            val event = ImpressionEvent(
                userId = userId,
                itemId = item.itemId,
                position = position,
                score = item.score,
                source = item.source,
                variant = variant,
                experimentId = experimentId,
                timestamp = Instant.now().toEpochMilli(),
            )
            kafkaTemplate.send("analytics.impressions.v1", userId.toString(), event)
        }
    }
}

data class ImpressionEvent(
    val userId: Long,
    val itemId: Long,
    val position: Int,
    val score: Double,
    val source: String,
    val variant: String,
    val experimentId: String,
    val timestamp: Long,
)
```

### 3-2. analytics 서비스의 ClickHouse 적재

msa 의 `analytics` 서비스가 Kafka Streams 로 `analytics.impressions.v1` consume → ClickHouse 적재.

→ 이후 A/B 분석 시 `SELECT variant, COUNT(*), SUM(...) FROM impressions JOIN clicks ...` 같은 쿼리로 CTR / CVR 비교.

---

## 4. 종합 A/B 실험 예시

### 4-1. 실험 정의

```yaml
experimentId: rec_phase_v1
description: "추천 Phase 1 vs 2 vs 3 비교"
variants:
  control:
    weight: 33
    description: "Phase 1 - Category Best"
  treatment_cf:
    weight: 33
    description: "Phase 2 - Item-Item CF"
  treatment_two_tower:
    weight: 34
    description: "Phase 3 - Two-Tower"
primary_metric: ctr
secondary_metrics: [cvr, gmv_per_user, dwell_time]
duration: 14 days
min_sample_size: 10000  # per variant
```

### 4-2. 결과 분석 (ClickHouse)

```sql
WITH variant_stats AS (
  SELECT
    variant,
    COUNT(DISTINCT user_id) AS unique_users,
    COUNT(*) AS impressions,
    COUNTIf(action = 'click') AS clicks,
    COUNTIf(action = 'purchase') AS purchases,
    SUMIf(price, action = 'purchase') AS gmv
  FROM impressions_with_actions
  WHERE experiment_id = 'rec_phase_v1'
    AND timestamp >= now() - INTERVAL 14 DAY
  GROUP BY variant
)
SELECT
  variant,
  unique_users,
  impressions,
  clicks / impressions AS ctr,
  purchases / clicks AS cvr,
  gmv / unique_users AS gmv_per_user
FROM variant_stats
ORDER BY variant
```

예상 결과:
```
variant            unique_users  impressions  ctr     cvr     gmv_per_user
control            10000         200000       0.05    0.02    50.0
treatment_cf       10000         200000       0.06    0.025   75.0
treatment_two_tower 10000        200000       0.07    0.03    100.0
```

→ Two-Tower 가 CTR +40%, GMV +100%. 통계적 유의성 z-test 로 검증.

---

## 5. Phase 별 진화 모니터링

```
Phase 1 (CB 만):    baseline CTR 5%
Phase 2 (CF 추가): CTR +20% (variant_cf 더 높음 → CF 도입 결정)
Phase 3 (Two-Tower 추가): CTR +40% (variant_two_tower 더 높음)
```

각 Phase 도입 시:
1. 100% control → 50% control + 50% treatment 점진 ramp-up
2. 통계 유의 확인 후 100% treatment 전환
3. 다음 Phase 의 실험 시작

---

## 6. 메트릭 종합 — Recommendation Dashboard

### 6-1. Grafana 대시보드

```
panels:
  - Latency (P50, P99) per endpoint
  - Throughput (RPS) per variant
  - CTR per variant per category
  - Cache hit rate (Redis)
  - ANN search latency (recommendation-ann)
  - Error rate / Circuit breaker state
  - Cold-start fallback rate
```

### 6-2. Alerting

```yaml
- alert: RecommendationHighErrorRate
  expr: rate(http_requests_total{service="recommendation",status="5xx"}[5m]) > 0.05
  for: 5m
  
- alert: RecommendationLatencyP99
  expr: histogram_quantile(0.99, recommendation_latency_seconds_bucket) > 0.05
  for: 10m
  
- alert: AnnServiceDown
  expr: up{service="recommendation-ann"} == 0
  for: 1m
```

---

## 7. 통합 테스트 시나리오

### 7-1. End-to-End 통합

```kotlin
class RecommendationE2EIntegrationSpec : BehaviorSpec({
    val ctx = createTestEnvironment()  // K8s testcontainers 또는 minikube
    
    Given("user 1234 with click history") {
        ctx.kafka.publish("recommendation.events.v1", clickEvent(userId = 1234, itemId = 100))
        // wait for ClickHouse ingestion
        
        When("GET /api/v1/recommendations/personalized?userId=1234") {
            val response = ctx.restClient.get("/api/v1/recommendations/personalized?userId=1234")
            
            Then("status 200 + items > 0 + impressions event published") {
                response.status shouldBe 200
                response.body.items shouldNotBeEmpty
                
                // analytics Kafka 에 impression 발행 확인
                val impressions = ctx.kafka.consume("analytics.impressions.v1", timeout = 5.seconds)
                impressions shouldHaveSize response.body.items.size
                impressions.all { it.userId == 1234L } shouldBe true
            }
        }
    }
})
```

---

## 8. 점진 도입 체크리스트 (Phase 10 마무리)

- [ ] Gateway 라우팅 추가
- [ ] Ingress + CircuitBreaker fallback
- [ ] ExperimentClient + A/B routing
- [ ] AnalyticsPublisher (Kafka)
- [ ] analytics 서비스의 impression event consumer
- [ ] ClickHouse 분석 쿼리 정립
- [ ] Grafana 대시보드
- [ ] Alerting 룰
- [ ] End-to-end 통합 테스트
- [ ] Phase 1 → 2 → 3 점진 ramp-up
- [ ] ADR-XXXX-1/2/3 acceptance update (Proposed → Accepted)

---

## 9. 추천 시스템 도입 완료 — Beta 단계

3 Phase + Gateway + A/B 통합 완료 시 추천 시스템 Beta:
- ✅ 룰 기반 (CB) — production ready
- ✅ CF (similar-items) — production
- ✅ Two-Tower (personalized) — production
- ✅ A/B 검증
- ✅ Monitoring + Alerting

**다음 발전 단계** (Phase 4+ ADR 후보):
- Ranking 모델 (DLRM / Wide&Deep) 도입 → Funnel Stage 2
- Contextual Bandit (§08) — MAB exploration
- Real-time learning (Kafka Streams + 모델 incremental update)
- Cross-product 추천 (호텔 → 액티비티)

---

## 10. cross-ref

| 주제 | 연결된 study |
|---|---|
| Gateway / Ingress 패턴 | gateway 서비스 |
| CircuitBreaker / Fallback | ADR-0015 (Resilience Strategy) |
| Kafka topic 컨벤션 | docs/architecture/kafka-convention.md |
| Experiment 서비스 | experiment 서비스 |
| Analytics 서비스 | analytics 서비스 |
| A/B 메트릭 / Statistical 검정 | §19 |
| Phase 1~3 구현 | §22, §23, §24 |
| Phase 4+ 향후 | §27 (ADR 후보) |
