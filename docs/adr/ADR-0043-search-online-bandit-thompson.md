# ADR-0043 검색 결과 랭킹의 온라인 학습 트랙 — Thompson Sampling 기반 MAB rerank

## Status
Proposed (2026-05-12)

## Context

현재 `search` 서비스 랭킹은 정통 오프라인 트랙만 사용한다.

- `ProductSearchAdapter` (`search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductSearchAdapter.kt:21-73`):
  `match("name") + filter(status=ACTIVE) + function_score(popularityScore, ctr) + scoreMode=Sum + boostMode=Sum`.
- `popularityScore`/`ctr`/`cvr` 는 `analytics` 가 산출한 **단일 스칼라** 를 `analytics.score.updated` 이벤트로 받아
  `ProductScoreUpdateConsumer` 가 ES 문서에 덮어쓴다.

이 구조의 결정적 한계:

1. **uncertainty 소실** — `ctr: Double` 만 저장하므로 1/2 와 500/1000 의 분포 폭 차이를 표현할 수 없다.
   신상품은 평균 CTR 0 으로 영구 하위 노출, 우연히 클릭 1번 받으면 평균 50% 로 과대 평가된다.
2. **exploration 부재** — deterministic ranking 만 존재한다. 신규 상품 / 트렌드 변화 / 데이터 부족 arm 에
   대한 **자동 시험 노출** 메커니즘이 없다.
3. **bucket 단위 부재** — global CTR 평균만 보관. 같은 상품이라도 카테고리 컨텍스트마다 반응이 다른
   사실(예: 동일 가전이 디지털 카테고리 vs 키친 카테고리에서 CTR 격차) 을 학습할 수 없다.
4. **튜닝 surface 빈약** — `RankingProperties(popularityWeight, ctrWeight)` 만 외부화. prior / decay /
   hybrid weight / impression threshold 같은 온라인 학습 표준 튜닝 노브가 없다.

`study/docs/19-search-engine/` 45 파일은 BM25 → vector → RRF → LambdaMART → cross-encoder 의 **오프라인 학습 트랙** 은 풀 커버하지만 **온라인 학습 트랙(MAB / Bayesian / Thompson)** 은 통째로 빈 영역이다 (`grep -ril "MAB\|bandit\|Thompson\|UCB"` → 0건).

## Decision

검색 결과 랭킹에 **온라인 학습 트랙** 을 별도 레이어로 신설한다. 핵심 알고리즘은 **Beta-Bernoulli conjugate posterior 기반 Thompson Sampling**, bucket 키는 `(categoryId, productId)`.

### 데이터 모델

- arm 식별: `BanditKey(categoryId: String, productId: String)`. `categoryId` 가 비면 `"_default_"` 로 fallback.
- state: `BanditState(alpha: Double, beta: Double, lastUpdatedAt: Instant)`
  - `alpha = clicks + priorAlpha`, `beta = impressions − clicks + priorBeta`
  - prior 는 카테고리 평균 CTR 으로 empirical Bayes (`priorAlpha = avgCtr × k`, `priorBeta = (1 − avgCtr) × k`)
- 저장소: Redis hash `bandit:state:{categoryId}:{productId} = {clicks, impressions, lastTs}`
  - 클릭/노출 누적은 `HINCRBY` atomic
  - posterior 는 조회 시 계산 (저장 안 함)

### 랭킹 파이프라인

```
Stage 1: ES function_score (현재 로직 유지) → top-N(예: 100) 후보
Stage 2: ThompsonReranker
         ├ BanditStatePort.fetch(categoryId, productId) for each candidate (parallel/batch)
         ├ sample = Beta(alpha, beta).sample()       // 매 요청마다 새 샘플
         ├ final = hybridWeight × esNorm(esScore) + (1 − hybridWeight) × sample
         └ impressionThreshold 미만 arm 은 cold-start prior 만 사용
Stage 3: top-K(예: 20) 반환
```

- `hybridWeight` default 0.8 — ES relevance 가 dominate, TS 가 미세 조정.
- 결정성 우선 시 `BanditProperties.enabled=false` 로 즉시 off.
- 세션 캐시(`sessionCacheSeconds`, default 60s) 로 flicker 방지 — 동일 (userId|sessionId, query) 의
  N 초 내 재요청은 같은 샘플 사용.

### 이벤트 흐름

| 토픽 | 발행 | 수신 | 페이로드 |
|---|---|---|---|
| `search.impression.logged` | search:app (`/api/v1/search/impressions`) | analytics | `{searchId, categoryId, productId, position, userId?, ts}` |
| `search.click.logged` | search:app (`/api/v1/search/clicks`) | analytics | 동일 |
| `analytics.bandit.state.snapshot` | analytics | (선택) search:consumer 또는 monitoring | `{categoryId, productId, clicks, impressions, ts}` |

- analytics 는 두 토픽을 소비 → Redis `bandit:state:*` 에 누적
  (`HINCRBY clicks` / `HINCRBY impressions` + `HSET lastTs`).
- search 는 Redis 를 직접 read-through (낮은 latency, ADR-0025 P99 정합).

### Decay (시간 감쇠)

읽기 시점에 `age = now − lastTs` 로 weighted update:

```
effectiveClicks      = clicks × exp(−λ × ageDays)
effectiveImpressions = impressions × exp(−λ × ageDays)
```

`decayLambdaPerDay` default 0.02 (=반감기 35일). λ=0 으로 비활성 가능.

### Cold-start

- prior: `priorAlpha`/`priorBeta` 글로벌 default 는 `(1.0, 9.0)` (10% CTR 가정).
- 카테고리별 prior override 는 `BanditProperties.categoryPriors: Map<String, Pair<Double,Double>>` 로
  외부화. Phase 2 에서 analytics 가 자동 산출하도록 확장.
- `impressionThreshold` (default 50) 미만일 때는 prior 만 사용해 noise 폭주 방지.

### ProductEsDocument 매핑 변경

- 신규 keyword 필드 `categoryId` 추가. nullable 허용 (legacy doc 은 `"_default_"` 로 보정).
- alias swap 절차로 1회 재색인 — `IndexAliasManager.createIndex` 매핑에 추가.

## Alternatives Considered

| 대안 | 평가 |
|---|---|
| **ε-greedy** | 단순하나 탐색이 균등 랜덤 → 명백한 쓰레기 arm 도 동일 확률로 노출. 운영 위험. 기각. |
| **UCB1** | uncertainty bonus 가 결정적 → flicker 적음. 단, 분포 자체를 보지 않아 prior/empirical Bayes 결합이 어색. 후보. |
| **LinUCB / Contextual Bandit** | user × category 컨텍스트 feature 결합 가능. 가장 강력하지만 feature engineering / 평가 인프라 부담 큼. Phase 3 으로. |
| **순수 ES script_score 내 sampling** | ES JVM 안 random state 가 noisy(노드별 시드 분기). top-N rerank 보다 latency 가산 모호. 기각. |
| **LTR (LambdaMART) plugin 도입** | 오프라인 학습. 본 ADR 의 온라인 학습 트랙과 직교 — 별개 ADR 후보. 본 ADR 채택과 무관. |
| **변경 없음 (현행 function_score Sum)** | uncertainty 무시 / 신상품 cold-start / 트렌드 반응 못 함. 명시적 기각. |

선정: **Thompson Sampling**. Beta-Bernoulli 가 CTR 도메인의 자연 conjugate, prior 튜닝이 직관적, 분포 폭이 자동으로 exploration 강도를 정한다.

## Consequences

### Positive

- 신상품 노출률 SLA 정의 가능 — top-K 노출 중 `impressions < threshold` arm 의 비율.
- A/B 평가 (TS off vs on) 와 nDCG@10 / CTR / CVR 단계별 비교가 가능.
- `BanditProperties` 로 prior / decay / hybridWeight 를 외부화 — A/B 실험 시 hot reload.
- 동일 상품이라도 카테고리별로 분리된 학습 — 컨텍스트 sensitivity 확보.

### Negative / Risk

- **추가 latency**: top-N=100 sampling + Redis MGET batch. 측정 후 ADR-0025 P99 200ms 예산 안에서 운영.
- **flicker**: 매 요청 샘플링이 동일 사용자에게 다른 순위를 줄 수 있다. session cache 로 mitigation.
- **position bias**: impression 위치별 클릭률 차이가 그대로 학습됨. Phase 3 에서 IPW 도입.
- **데이터 정합성**: search → Redis read, analytics → Redis write. eventually consistent. lag SLA 정의 필요.
- **Redis 의존성 ↑**: bandit state 손실 시 cold-start 로 복귀(rebuildable). RDB 가 SoR 가 아닌 점 명시.

### Migration Phases

| Phase | 범위 | 산출물 |
|---|---|---|
| **P1** (본 ADR) | search:domain port + Redis adapter + ThompsonReranker + Properties + impression/click endpoint + analytics consumer + ProductEsDocument.categoryId + ADR + study 3 deep file | 본 PR |
| **P2** | FE / gateway 의 impression tracking 자동화, dashboard, A/B 토글, prior auto-tune | 별도 PR |
| **P3** | Contextual Bandit (LinUCB) + IPW position bias 보정 + LTR 통합 | 별도 ADR |

### 관련 문서

- `docs/adr/ADR-0025-latency-budget.md` — Tier 1 P99 정합성
- `docs/architecture/kafka-convention.md` — 신규 토픽 3종
- `study/docs/19-search-engine/42-bayesian-beta-thompson.md` (신설)
- `study/docs/19-search-engine/43-mab-algorithms.md` (신설)
- `study/docs/19-search-engine/44-msa-bandit-grounding.md` (신설)
- `study/docs/19-search-engine/19-improvements.md` — ADR 후보 8번으로 등록
