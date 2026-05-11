---
parent: 19-search-engine
seq: 44
title: msa search — Thompson Sampling rerank grounding (ADR-0043)
type: deep
created: 2026-05-12
related:
  - 15-msa-search-grounding.md
  - 19-improvements.md
  - 42-bayesian-beta-thompson.md
  - 43-mab-algorithms.md
sources:
  - private session — MAB 정렬 개념 설명
  - docs/adr/ADR-0043-search-online-bandit-thompson.md
  - docs/adr/ADR-0025-latency-budget.md
---

# 44. msa search — Thompson Sampling rerank grounding

> §42/§43 원리·카탈로그를 msa 의 실제 코드에 매핑한 grounding 문서.
> ADR-0043 의 Phase 1 산출물 (도메인 모델 / Redis state / Reranker / Kafka 흐름 / ProductEsDocument 변경) 직접 인용.

## 1. 한 줄 핵심

> **`search:app` 의 `ProductSearchAdapter` 결과 top-N 을 `ThompsonReranker` 가 후처리** 한다.
> arm 키 = `(categoryId, productId)`, state = Redis hash, prior = empirical Bayes, hybrid = ES + Beta sample.

## 2. 적용 전후 데이터 흐름

### 2-1. 기존 (§15 grounding 시점)

```
Client ──GET /api/search/products?keyword=─►  search:app
                                              SearchController
                                              SearchProductUseCase
                                              ProductSearchAdapter
                                                 │
                                                 ▼
                                              Elasticsearch
                                                 │
                                                 ▼  match("name") + filter(status=ACTIVE)
                                                    + function_score(popularityScore, ctr) Sum
                                              Page<ProductDocument>  ── return
```

### 2-2. ADR-0043 적용 후

```
Client ──GET /api/search/products?keyword=─►  search:app
                                              SearchController
                                              SearchProductUseCase
                                              ProductSearchAdapter (ES top-N)
                                                 │
                                                 ▼
                                              ThompsonReranker
                                                 │ (BanditStatePort.fetchBatch)
                                                 ▼
                                              Redis  bandit:state:{cat}:{pid}
                                                 │ (hybrid: w·esNorm + (1-w)·Beta sample)
                                                 ▼
                                              top-K ── return
                                              (response 에 searchId 동봉)

Client ──POST /api/v1/search/impressions ─►  SearchController
                                              ┌─ Kafka publish ──► search.impression.logged
Client ──POST /api/v1/search/clicks      ─►  SearchController
                                              └─ Kafka publish ──► search.click.logged

                                              analytics:app
                                              SearchImpressionConsumer / SearchClickConsumer
                                                 │
                                                 ▼ HINCRBY clicks/impressions
                                              Redis  bandit:state:{cat}:{pid}
                                                 │
                                                 ▼ (선택) snapshot 발행
                                              analytics.bandit.state.snapshot
```

## 3. 모듈 책임

| 모듈 | 책임 |
|---|---|
| `search:domain` | `BanditKey`, `BanditState`, `BanditPosterior`, `BanditStatePort` (read), `BanditEventPort` (write) |
| `search:app` | `BanditProperties`, `ThompsonReranker`, `BanditStateRedisAdapter`, `BanditEventKafkaAdapter`, controller 의 impression/click endpoint |
| `analytics:app` | `SearchImpressionConsumer`, `SearchClickConsumer`, Redis hash `HINCRBY` 누적 |
| (Phase 2) FE/gateway | 결과 노출 시 자동 impression 로깅, 클릭 시 자동 click 로깅 |

## 4. 도메인 모델

```kotlin
// search/domain/src/main/kotlin/com/kgd/search/bandit/model/BanditState.kt
data class BanditKey(val categoryId: String, val productId: String) {
    companion object {
        const val DEFAULT_CATEGORY: String = "_default_"
    }
}

data class BanditState(
    val key: BanditKey,
    val clicks: Long,
    val impressions: Long,
    val lastUpdatedAt: java.time.Instant
)

data class BanditPosterior(val alpha: Double, val beta: Double) {
    fun mean(): Double = alpha / (alpha + beta)
}
```

```kotlin
// search/domain/src/main/kotlin/com/kgd/search/bandit/port/BanditStatePort.kt
interface BanditStatePort {
    fun fetch(key: BanditKey): BanditState?
    fun fetchBatch(keys: Collection<BanditKey>): Map<BanditKey, BanditState>
}

interface BanditEventPort {
    fun recordImpression(event: ImpressionEvent)
    fun recordClick(event: ClickEvent)
}
```

## 5. Reranker 본체 (의사 코드, 상세는 §6 코드 인용)

```
입력: List<ProductDocument> esRanked, Pageable
1. take top-N (= BanditProperties.topN) candidates
2. keys = candidates.map { BanditKey(categoryId ?: DEFAULT, id) }
3. states = banditStatePort.fetchBatch(keys)
4. esNorm = min-max normalize(esScores)   // [0,1]
5. for each candidate:
       state = states[key]
       (effClicks, effImpressions) = applyDecay(state, λ)
       if effImpressions < impressionThreshold:
           sample = priorOnlySample(categoryId)
       else:
           α = effClicks + priorAlpha(categoryId)
           β = (effImpressions - effClicks) + priorBeta(categoryId)
           sample = Beta(α, β).sample()
       final = w × esNorm + (1 - w) × sample
6. sort by final desc
7. return top-K
```

session cache (요청 컨텍스트 `(userId|sessionId, query)`) 가 N 초 내 같은 sample 반환.

## 6. 코드 인용 — 본 PR 산출물

| 파일 | 역할 |
|---|---|
| `search/domain/.../bandit/model/BanditState.kt` | 도메인 데이터 클래스 |
| `search/domain/.../bandit/port/BanditStatePort.kt` | 포트 인터페이스 |
| `search/app/.../bandit/BanditProperties.kt` | 외부 설정 |
| `search/app/.../bandit/ThompsonReranker.kt` | reranker 본체 |
| `search/app/.../bandit/BetaSampler.kt` | Beta sampling util (Apache Commons Math) |
| `search/app/.../bandit/adapter/BanditStateRedisAdapter.kt` | Redis hash 어댑터 |
| `search/app/.../bandit/adapter/BanditEventKafkaAdapter.kt` | Kafka publisher |
| `search/app/.../search/controller/SearchController.kt` | `/impressions`, `/clicks` endpoint 추가 |
| `search/app/.../elasticsearch/ProductEsDocument.kt` | `categoryId` keyword 필드 추가 |
| `search/batch/.../indexing/IndexAliasManager.kt` | mapping 에 categoryId + decay 마이그레이션 |
| `analytics/app/.../bandit/SearchImpressionConsumer.kt` | impression Kafka 소비 → Redis HINCRBY |
| `analytics/app/.../bandit/SearchClickConsumer.kt` | click Kafka 소비 → Redis HINCRBY |
| `docs/adr/ADR-0043-search-online-bandit-thompson.md` | 본 ADR |
| `docs/architecture/kafka-convention.md` | 새 토픽 3종 등록 |

## 7. Redis state 스키마

```
KEY:    bandit:state:{categoryId}:{productId}
TYPE:   HASH
FIELDS:
   clicks       (long, HINCRBY)
   impressions  (long, HINCRBY)
   lastTs       (long, epoch millis, HSET)
TTL:    없음 (영속) — operator 가 카테고리 폐기 시 명시 삭제
```

운영 노트:

- `HINCRBY` 는 atomic, race condition 없음
- read-through (search 가 직접) — round-trip 한 번
- batch read 는 pipeline 또는 `HMGET`/`MGET` 으로 모음
- partition: `{categoryId}:{productId}` 키 분포가 자연스러워 hot key 위험 낮음 (단 단일 카테고리에 트래픽 쏠리면 Redis cluster 의 hash tag `{cat}` 사용 검토)

## 8. Kafka 토픽 정합성

`docs/architecture/kafka-convention.md` 의 `{domain}.{entity}.{event}` 컨벤션:

| 토픽 | 발행 | 수신 | 비고 |
|---|---|---|---|
| `search.impression.logged` | search:app | analytics:app | DLT 자동 |
| `search.click.logged` | search:app | analytics:app | DLT 자동 |
| `analytics.bandit.state.snapshot` | analytics:app | (선택) monitoring | 주기적 스냅샷 |

Consumer group: `analytics-bandit-impression`, `analytics-bandit-click`.

ADR-0012 (멱등성) 정합:

- payload 에 `searchId` (UUID) + `productId` + `position` + `ts` 포함
- analytics 는 `(searchId, productId, position)` 으로 중복 방어 (Redis SET 또는 짧은 TTL 기반)
- 본 PR 은 best-effort, 정밀 멱등은 Phase 2

## 9. ProductEsDocument 매핑 변경

기존:

```kotlin
@Document(indexName = "products")
data class ProductEsDocument(
    @Id val id: String,
    @Field(type = Text, analyzer = "nori") val name: String,
    ...
)
```

변경 후:

```kotlin
@Field(type = Keyword) val categoryId: String = BanditKey.DEFAULT_CATEGORY
```

- legacy doc 에는 `categoryId` 가 없을 수 있음 → `_default_` 로 fallback (Reranker 에서)
- 신규 doc 은 product 서비스에서 categoryId 를 채워 발행 가정 — 미지원 시 search 측 보정

`IndexAliasManager.createIndex` 의 mapping 에 `categoryId` keyword 추가. alias swap 1회로 무중단 재색인.

## 10. ADR-0025 (Latency Budget) 정합성

추가 latency 측정 포인트:

| 단계 | 예산 |
|---|---|
| ES function_score (Stage 1) | 50ms |
| BanditStatePort.fetchBatch(100) | 5ms (Redis pipeline) |
| Beta sampling × 100 | 1ms (Apache Commons Math) |
| 정렬 + 응답 직렬화 | 5ms |
| **합계** | ~ 61ms (Tier 1 P99 200ms 안) |

성능 회귀 시:

- `topN` 축소 (100 → 50)
- session cache hit rate 측정 → cache 강화
- Redis pipeline batch size 조정

## 11. 알고리즘 정합성 — §10 LTR 와의 관계

§10 의 Cascade 권장:

```
retrieve → function_score → LTR → MAB → business
```

본 PR (Phase 1) 은 LTR 미도입 — `function_score → MAB → business` 단순화. Phase 3 에서 LTR plugin
도입 시 LTR 결과를 `esScore` 자리에 끼우고 MAB 는 그대로 외곽 rerank.

## 12. 운영 노브 — 본 PR 의 기본값

```yaml
search:
  bandit:
    enabled: true
    top-n: 100
    prior-alpha: 1.0
    prior-beta: 9.0
    decay-lambda-per-day: 0.02
    hybrid-weight: 0.8
    impression-threshold: 50
    session-cache-seconds: 60
    category-priors:
      # categoryId: "alpha,beta" 
      # "fashion-women": "5.0,45.0"
```

- `enabled=false` 로 즉시 off (트래픽 영향 0)
- `hybrid-weight=1.0` → MAB 완전 비활성 (ES score 그대로)
- `hybrid-weight=0.0` → ES 무시, TS 만 (실험적)

## 13. 점검 / 회귀 시나리오

| 시나리오 | 기대 동작 |
|---|---|
| Redis 다운 | `BanditStatePort.fetchBatch` 빈 map 반환 → 모든 arm prior 만 사용 → 순서가 약간 흔들리지만 검색 가능 |
| categoryId null | `_default_` 카테고리로 fallback |
| 첫 배포 직후 (state 없음) | impressionThreshold 까지 prior 결정적 사용 — 큰 noise 없음 |
| flicker | session cache 가 같은 sample 반환 |
| 광고/프로모션 충돌 | Phase 1 미해결, Phase 3 의 business re-rank 레이어로 |

## 14. 모니터링 / 측정 권장

| 메트릭 | 의미 | 알람 |
|---|---|---|
| `bandit.fetch.latency_p99` | Redis fetch P99 | > 10ms |
| `bandit.sample.latency_p99` | top-N sampling | > 5ms |
| `bandit.empty_state_ratio` | state 없는 arm 비율 | > 30% (initial OK, 정착 후 ↓) |
| `search.results.new_product_share` | top-K 의 신상품(imp < threshold) 비율 | 도메인 SLA |
| `search.ctr@k` | 실제 CTR | A/B 비교 |
| `redis.bandit.key_count` | Redis key 수 | 비정상 증가 |
| `kafka.search.impression.dlt` | DLT 적재 | > 0 |

## 15. 면접 한 줄 답변

### Q. msa search 에 MAB 를 어떻게 끼웠나요?

> "ES function_score 결과 top-N(100) 을 가져와 `ThompsonReranker` 가 `(categoryId, productId)` 단위
> Redis state 를 batch fetch 한 후 `Beta(clicks+α₀, impressions−clicks+β₀)` 에서 샘플링,
> `hybrid = 0.8·esNorm + 0.2·sample` 로 재정렬합니다. Beta sampling 은 µs 단위라 ADR-0025 P99 200ms
> 예산 안에서 운영됩니다."

### Q. categoryId 없는 doc 은요?

> "`_default_` 카테고리로 fallback 합니다. 단일 default bucket 도 동작하지만, 카테고리별 prior 가
> 의미를 잃습니다. 마이그레이션은 alias swap 한 번으로 categoryId keyword 매핑을 추가합니다."

### Q. 클릭 데이터가 없을 때는?

> "`impressions < impressionThreshold` (50) 이면 prior 만 사용해 noise 폭주를 막습니다. 카테고리별
> prior 는 그 도메인의 평균 CTR 기반 empirical Bayes — 외부 설정으로 hot reload 가능합니다."

### Q. Redis 가 죽으면?

> "fetchBatch 가 빈 map 반환 → 모든 arm 이 prior 만 사용 → 결정적 prior mean 으로 순서가 약간만
> 흔들립니다. 검색 자체는 계속 동작 (graceful degradation). state 는 클릭/노출 이벤트에서 다시 누적."

### Q. ML Ranker (LTR) 와 어떻게 같이 쓰나요?

> "직교축입니다. LTR 은 오프라인 학습으로 nDCG 최적화 (Phase 3 ADR 별도), MAB 는 온라인 학습으로
> CTR 미세 조정. cascade 의 마지막 rerank 단계에 둡니다."

## 16. 회독 체크리스트

> §44 회독 체크리스트:
> - [ ] 적용 후 4-단계 흐름 (controller → ES → reranker → Redis) 그림 재현
> - [ ] BanditKey/State/Posterior 의 책임 분리
> - [ ] Redis hash 스키마 (`bandit:state:{cat}:{pid}`) 의 atomic HINCRBY
> - [ ] Kafka 3토픽 + ADR-0012 멱등성 정합 메커니즘
> - [ ] ProductEsDocument categoryId 추가 + alias swap 마이그레이션
> - [ ] ADR-0025 latency budget 안에서 +10ms 정도 추가
> - [ ] graceful degradation — Redis 다운 / categoryId 없음 / impression 부족 시 동작
> - [ ] 운영 노브 8종 (enabled / topN / prior / decay / hybridWeight / threshold / sessionCache / categoryPriors)
> - [ ] 모니터링 메트릭 7종

## 17. 다음 학습 / Phase 2-3 후보

- FE / gateway 의 impression 자동 로깅 (Phase 2)
- A/B 토글 + dashboard (Phase 2)
- LinUCB / contextual bandit + IPW position bias (Phase 3)
- LTR plugin (LambdaMART) 도입 + cascade 정렬 (별도 ADR)
- §16 운영 모니터링 — bandit 메트릭 추가
- §34 평가 메트릭 (nDCG@10 / CTR / CVR) 로 A/B 측정
