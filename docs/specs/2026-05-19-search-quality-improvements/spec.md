<!-- source: search -->
# Spec — Search Quality Improvements

상위 ADR: `docs/adr/ADR-0050-search-quality-roadmap.md`
관련 ADR: ADR-0008 / ADR-0017 / ADR-0025 / ADR-0043

## 0. 모듈 영향 요약

| 모듈 | 변경 종류 |
|---|---|
| `search:domain` | `BanditKey` 일반화 (Phase 3), eval metric 도메인 모델 (Phase 4) |
| `search:app` | `RankingProperties` 확장 (Phase 1/2), `ProductSearchAdapter` function_score 함수 추가, 신규 `MultiScopeBanditBlender`, `SellerDiversityReranker`, `SearchDebugController` (Phase 4) |
| `search:consumer` | `ProductScoreUpdateConsumer` 페이로드 확장 (Phase 2) |
| `search:batch` | NDCG/MRR 평가 잡 (Phase 4) |
| `analytics:app` | 베이지안 스무딩 산출 + GMV 집계 (Phase 2), 약지도 judgment 자동 생성 (Phase 4) |
| `product` (필드 추가) | `brand` 신설 (Phase 3) — product 도메인 합의 필요 |
| `admin-fe` | side-by-side UI + query builder UI (Phase 4) |

## 1. Phase 1 — Quick Wins (≤ 3md)

### 1.1 결정적 Tiebreaker
**대상 파일**: `search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductSearchAdapter.kt`

`NativeQuery.builder()` 에 sort 추가:
```kotlin
.withSort(Sort.by(Sort.Order.desc("_score")))
.withSort(Sort.by(Sort.Order.asc("id")))
```

`searchScored` / `search` 모두 적용. 페이지네이션 안정성 + 디버그 결과 재현성.

### 1.2 CVR 가중치 활성화
**대상**: `RankingProperties`, `ProductSearchAdapter`

```kotlin
// RankingProperties.kt
data class RankingProperties(
    val popularityWeight: Double = 10.0,
    val ctrWeight: Double = 5.0,
    val cvrWeight: Double = 0.0,                        // 신규
    val gmv7dWeight: Double = 0.0,                       // 신규 (Phase 2)
    val gmv30dWeight: Double = 0.0,                      // 신규 (Phase 2)
    val freshness: FreshnessConfig = FreshnessConfig()  // 신규
)

data class FreshnessConfig(
    val weight: Double = 0.0,
    val origin: String = "now",     // ES gauss origin
    val scale: String = "14d",
    val offset: String = "0d",
    val decay: Double = 0.5
)
```

`ProductSearchAdapter.executeSearch` 의 function_score 에 함수 추가:
```kotlin
if (rankingProperties.cvrWeight > 0.0) {
    fs.functions { fn ->
        fn.fieldValueFactor { fvf ->
            fvf.field("cvr")
                .factor(rankingProperties.cvrWeight)
                .modifier(FieldValueFactorModifier.Log1p)
                .missing(0.0)
        }
        fn.weight(1.0)
    }
}
```

### 1.3 Freshness Boost
같은 패턴, gauss decay function 사용:
```kotlin
if (rankingProperties.freshness.weight > 0.0) {
    fs.functions { fn ->
        fn.gauss { g ->
            g.field("createdAt")
                .placement { p ->
                    p.origin(JsonData.of(rankingProperties.freshness.origin))
                     .scale(JsonData.of(rankingProperties.freshness.scale))
                     .offset(JsonData.of(rankingProperties.freshness.offset))
                     .decay(rankingProperties.freshness.decay)
                }
        }
        fn.weight(rankingProperties.freshness.weight)
    }
}
```

### 1.4 Phase 1 테스트
- `ProductSearchAdapterTest` — Testcontainers ES 로 실제 쿼리 실행 후 `explain` 결과에 sort 와 cvr/freshness 함수 포함 확인
- 회귀: 모든 신규 weight = 0 일 때 기존 결과와 동일

## 2. Phase 2 — Signal Expansion (≤ 5md)

### 2.1 ProductEsDocument 확장
```kotlin
@Document(indexName = "products")
data class ProductEsDocument(
    // 기존 필드 ...
    @Field(type = FieldType.Double) val gmv7d: Double = 0.0,        // 신규
    @Field(type = FieldType.Double) val gmv30d: Double = 0.0,       // 신규
    @Field(type = FieldType.Double) val ctrRaw: Double = 0.0,       // 신규 (디버그용)
    @Field(type = FieldType.Double) val cvrRaw: Double = 0.0        // 신규 (디버그용)
)
```

**Migration**:
- ADR-0019 alias swap 절차 — `IndexAliasManager.createIndex` 매핑에 추가
- 기존 데이터는 1회 reindex (search:batch `ProductApiReindexJob` 활용)

### 2.2 analytics 측 스무딩 + GMV
**대상**: `analytics` Kafka Streams 앱

CTR/CVR 산출 시 베이지안 스무딩 적용:
```kotlin
// pseudo
fun smoothedCtr(clicks: Long, impressions: Long, category: String): Double {
    val (alpha, beta) = empiricalPriorForCategory(category) // 카테고리 avgCtr × k
    return (clicks + alpha) / (impressions + alpha + beta)
}
```

`analytics.score.updated` 이벤트 페이로드 확장:
```json
{
  "productId": "...",
  "popularityScore": 0.42,
  "ctr": 0.045,           // smoothed
  "cvr": 0.012,           // smoothed
  "ctrRaw": 0.067,        // unsmoothed
  "cvrRaw": 0.025,
  "gmv7d": 1234567.0,
  "gmv30d": 8901234.0,
  "updatedAt": "..."
}
```

`ProductScoreUpdateConsumer` 도 함께 확장.

### 2.3 function_score 에 GMV 추가
`ProductSearchAdapter.executeSearch` 에:
```kotlin
if (rankingProperties.gmv7dWeight > 0.0) {
    // fieldValueFactor gmv7d weight + log1p
}
if (rankingProperties.gmv30dWeight > 0.0) {
    // fieldValueFactor gmv30d weight + log1p
}
```

### 2.4 모니터링
- 신규 micrometer 메트릭:
  - `search.feature_score.distribution{signal=popularity|ctr|cvr|gmv7d|gmv30d|freshness}` — histogram
  - `search.score.update.lag.seconds` — Kafka consumer lag
- Grafana 대시보드: 신호별 분포 + lag

## 3. Phase 3 — MAB Expansion (≤ 10md)

### 3.1 BanditKey 일반화
**대상**: `search/domain/.../bandit/model/BanditKey.kt`

> **Note (vs ADR-0043 P3 Contextual Bandit)** — 본 spec 의 multi-scope MAB 는 정적 weight 의 weighted average blend 로, 컨텍스트 feature (사용자 임베딩, 시간대 등) 를 사용하지 않는다. LinUCB / Wide&Deep 같은 contextual bandit 은 ADR-0043 Phase 3 / ADR-0047 의 영역으로 분리.

```kotlin
data class BanditKey(
    val scope: String,        // "category:123", "brand:abc", "_default_"
    val productId: String
) {
    fun redisField(): String = "$scope:$productId"

    companion object {
        const val DEFAULT_SCOPE = "_default_"
        fun category(categoryId: String?, productId: String) =
            BanditKey("category:${categoryId.orDefault()}", productId)
        fun brand(brandId: String?, productId: String) =
            BanditKey("brand:${brandId.orDefault()}", productId)
    }
}
```

기존 `BanditKey.of(categoryId, productId)` 는 deprecated → `BanditKey.category(...)` 로 호출처 변경.

### 3.2 MultiScopeBanditBlender (신규)
```kotlin
@Component
class MultiScopeBanditBlender(
    private val banditStatePort: BanditStatePort,
    private val properties: BanditProperties
) {
    fun blend(productDocs: List<ProductDocument>, now: Instant): Map<String, Double> {
        val activeScopes = properties.scopes.filter { it.enabled }
        val keysPerScope: Map<ScopeConfig, List<BanditKey>> =
            activeScopes.associateWith { scope -> productDocs.map { keyFor(scope, it) } }

        val statesPerScope = keysPerScope.mapValues { (_, keys) -> banditStatePort.fetchBatch(keys) }

        return productDocs.associate { doc ->
            val blended = activeScopes.sumOf { scope ->
                val key = keyFor(scope, doc)
                val state = statesPerScope[scope]?.get(key)
                scope.weight * BetaSampler.sampleFromState(state, scope.prior, now, properties.decayLambdaPerDay)
            } / activeScopes.sumOf { it.weight }
            doc.id to blended
        }
    }
}
```

`ThompsonReranker.rerank` 가 `sampleFor` 대신 `MultiScopeBanditBlender.blend` 결과 사용.

### 3.3 BanditProperties 확장
```kotlin
@ConfigurationProperties(prefix = "search.bandit")
data class BanditProperties(
    val enabled: Boolean = true,
    val topN: Int = 100,
    val decayLambdaPerDay: Double = 0.02,
    val hybridWeight: Double = 0.8,
    val impressionThreshold: Long = 50,
    val sessionCacheSeconds: Long = 60,
    val scopes: List<ScopeConfig> = listOf(
        ScopeConfig("category", weight = 1.0, priorAlpha = 1.0, priorBeta = 9.0)
    )
)

data class ScopeConfig(
    val name: String,         // "category", "brand"
    val enabled: Boolean = true,
    val weight: Double = 1.0,
    val priorAlpha: Double = 1.0,
    val priorBeta: Double = 9.0,
    val overrides: Map<String, String> = emptyMap()  // bucket-specific priors
)
```

### 3.4 SellerDiversityReranker (신규)
```kotlin
@Component
class SellerDiversityReranker(private val properties: DiversityProperties) {
    fun rerank(scored: List<Pair<ProductDocument, Double>>): List<Pair<ProductDocument, Double>> {
        if (!properties.enabled) return scored
        // MMR variant: lambda * relevance - (1-lambda) * sim(seller already selected)
        // 또는 round-robin: per-seller counter, maxPerSeller 초과시 push down
        // 본 spec 은 round-robin from top-K 채택 (구현 단순)
        return roundRobinByBrand(scored, properties.maxPerSeller, properties.topK)
    }
}

@ConfigurationProperties(prefix = "search.diversity")
data class DiversityProperties(
    val enabled: Boolean = false,
    val maxPerSeller: Int = 3,
    val topK: Int = 20,
    val mmrLambda: Double = 0.7
)
```

`SearchProductService` 의 rerank chain: `ThompsonReranker` → `SellerDiversityReranker`.

### 3.5 product 모델 brand 필드
**전제**: product 서비스가 `brand` 또는 `sellerId` 를 보유해야 함. 현재 `Product` 도메인 모델 확인 후 합의 → product 측 spec 분리 또는 본 spec 에 절차 포함.

`ProductEsDocument.brand: String?` 추가, `product.item.created/updated` 이벤트 페이로드에 포함.

## 4. Phase 4 — Evaluation Infrastructure (≤ 10md+)

### 4.1 NDCG / MRR 산출 함수
**위치**: `search/domain/.../eval/RankingMetrics.kt` (pure)

```kotlin
object RankingMetrics {
    fun ndcgAtK(results: List<String>, judgments: Map<String, Int>, k: Int): Double {
        val dcg = results.take(k).mapIndexed { i, id ->
            val rel = judgments[id] ?: 0
            (2.0.pow(rel) - 1.0) / log2(i + 2.0)
        }.sum()
        val idealOrder = judgments.values.sortedDescending().take(k)
        val idcg = idealOrder.mapIndexed { i, rel ->
            (2.0.pow(rel) - 1.0) / log2(i + 2.0)
        }.sum()
        return if (idcg == 0.0) 0.0 else dcg / idcg
    }

    fun mrr(results: List<String>, judgments: Map<String, Int>, threshold: Int = 1): Double {
        results.forEachIndexed { i, id -> if ((judgments[id] ?: 0) >= threshold) return 1.0 / (i + 1) }
        return 0.0
    }

    fun mapAtK(results: List<String>, judgments: Map<String, Int>, k: Int, threshold: Int = 1): Double { /* ... */ }
}
```

### 4.2 Judgment Set 구조
ClickHouse 테이블:
```sql
CREATE TABLE search_judgments (
    query String,
    product_id String,
    relevance UInt8,           -- 0~3
    source Enum8('weak'=1, 'manual'=2, 'hybrid'=3),
    weight Float32 DEFAULT 1.0,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY (query, product_id);
```

약지도 생성 (Phase 4.1 — analytics 측):
```sql
INSERT INTO search_judgments
SELECT query, product_id,
    CASE
      WHEN sum(event_type = 'ORDER_COMPLETE') > 0 THEN 3
      WHEN sum(event_type = 'ADD_TO_CART') > 0 THEN 2
      WHEN sum(event_type = 'PRODUCT_CLICK') > 0 THEN 1
      ELSE 0
    END AS relevance,
    'weak' AS source
FROM analytics_events
WHERE timestamp >= now() - INTERVAL 30 DAY
GROUP BY query, product_id
HAVING relevance > 0;
```

### 4.3 평가 잡 (search:batch)
**신규 Spring Batch Job**: `SearchEvaluationJobConfig.kt`

```
Daily 02:00 trigger
  ├─ Step1: judgment set 로딩 (ClickHouse 또는 CSV)
  ├─ Step2: 각 query 에 대해 ES 검색 (variant=current)
  ├─ Step3: NDCG@10 / MRR / MAP@10 산출
  └─ Step4: ClickHouse search_eval_results 적재
```

variant 비교: K8s CronJob 두 개를 다른 ConfigMap 으로 실행 (variant A = 현재 weight, variant B = 실험 weight).

### 4.4 Debug API
**대상**: `search/app/.../controller/SearchDebugController.kt`

```
GET /api/v1/search/debug?query=...&variant={A|B|raw}&explain=true&page=0&size=20
```
- 응답: 각 결과별로 `id, name, _score, esExplain, bm25Score, featureScores{popularity,ctr,cvr,gmv7d,gmv30d,freshness}, banditSample, finalScore`
- variant 는 ConfigMap 의 weight set 을 선택 — variant A/B 의 `RankingProperties` / `BanditProperties` 를 동시 보유 (`Map<Variant, Properties>`)

```
POST /api/v1/search/debug/raw-query
Body: { "indexName": "products", "esQuery": { ... ES native JSON ... } }
```
- ADMIN 권한 필수 (gateway 측 인증 필터 통과 + service 내 `@PreAuthorize("hasRole('ADMIN')')`)
- Rate Limit (gateway `RateLimitingFilter`) — 분당 60req
- 안전 가드: `indexName` 화이트리스트 (`products`, `products_*`)

### 4.5 Side-by-Side UI (admin-fe)
**위치**: `admin/fe/src/pages/search-debug/`

기능:
- 상단 입력: query
- 좌측: variant A 결과, 우측: variant B 결과 (또는 raw-query 결과)
- 각 결과 카드: 이름, 가격, `finalScore`, score breakdown (expandable)
- 하단: judgment set 의 해당 query 가 있으면 양쪽의 NDCG@10 / MRR 표시
- 추가 패널: variant 별 ConfigMap 의 `RankingProperties` / `BanditProperties` 표시 (디버그)

### 4.6 Query Builder UI (admin-fe)
**위치**: `admin/fe/src/pages/search-query-builder/`

- `ProductEsDocument` 의 필드 메타 (이름/타입) 를 어드민 API 로 가져옴 (`GET /api/v1/search/debug/fields`)
- 각 필드별 토글 + 입력 (match / term / range)
- 각 function_score 함수 토글 + weight 슬라이더
- 생성된 ES JSON 을 raw-query 로 전송 → 결과를 side-by-side 좌/우로 push

## 5. 마이그레이션 / 출시 시나리오

| 시점 | 동작 |
|---|---|
| D+0 | Phase 1 머지 — tiebreaker 활성, cvrWeight/freshness weight 모두 0 (no-op) |
| D+1 ~ D+7 | latency / error rate 회귀 관찰 |
| D+7 | cvrWeight = 2.0 ramp, freshness weight = 1.0 ramp |
| D+14 | Phase 2 머지 (alias swap 1회 — 새 필드) |
| D+21 | Phase 4 evaluation 잡 + dashboard 가동 (Phase 2 활성화 효과 측정) |
| D+30 | Phase 3 (BanditKey 일반화 + diversity) — product brand 합의 완료 후 |
| D+60 | Phase 4 admin UI 완성 |

## 6. 회귀 / 롤백 시나리오

- 신규 weight 모두 0 / `enabled=false` → 기존 동작 동일 (회귀 보호 baseline)
- ES 매핑 변경 (Phase 2 의 신규 필드) 는 alias swap → 롤백 시 이전 alias 로 즉시 복귀
- Phase 3 `BanditKey` 변경은 Redis 키 prefix 변경 → 롤백 시 새 키 invalidate (cold-start 일시 발생, prior 만 사용)

## 7. 의존성

| 의존 | Phase | 비고 |
|---|---|---|
| analytics 서비스 (Kafka Streams 확장) | Phase 2 / 4 | 스무딩 산출 + GMV 집계 + 약지도 generation |
| product 서비스 (brand 필드 신설) | Phase 3 | 미확정 — product 측 spec 분리 후 진행 |
| ClickHouse (judgment / eval 테이블) | Phase 4 | 이미 analytics 가 사용 중 (ADR-0017) |
| admin-fe | Phase 4 | UI |
| K8s ConfigMap reload | Phase 1 ~ | weight hot reload, Spring Cloud Config 도입은 별도 |
| Grafana 대시보드 | Phase 2 ~ | 신규 메트릭 가시화 |

## 8. 본 spec 이 다루지 않는 것 (Out of Scope)

- OTA 도메인 (region/attraction/synonyms/package) — 별도 spec
- LinUCB / Wide&Deep / DLRM — ADR-0043 Phase 3, ADR-0047
- Vector / Semantic search — ADR-0008 후속
- 검색 자동완성 / 오타교정 (study/19/36 참조)
