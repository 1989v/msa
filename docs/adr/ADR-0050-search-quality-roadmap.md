# ADR-0050 검색 품질 고도화 로드맵 — 신호 확장 / 다중 scope MAB / 평가 인프라

## Status
Proposed (2026-05-19)

## Context

`search` 서비스는 ADR-0008 (텍스트 기반), ADR-0017 (analytics CTR/CVR/popularity 통합), ADR-0043 (Thompson Sampling MAB rerank) 의 3단 적층으로 운영 중이다. 구현 현황은 다음과 같다.

### 현재 동작 (2026-05-19)
- `ProductSearchAdapter` (`search/app/.../elasticsearch/ProductSearchAdapter.kt:34-77`): `match(name) + filter(status=ACTIVE) + function_score(popularityScore weight=10, ctr weight=5, log1p, scoreMode=Sum, boostMode=Sum)`
- `ThompsonReranker` (`bandit/ThompsonReranker.kt`): ES top-N 후 Beta-Bernoulli 샘플링 + hybrid weight blend
- `ProductScoreUpdateConsumer`: `analytics.score.updated` → ES partial update
- `ProductEsDocument`: `popularityScore`, `ctr`, **`cvr` (필드만 존재, function_score 미사용)**, `categoryId`, `createdAt` (미사용), `scoreUpdatedAt`
- `BanditKey(categoryId, productId)` — category scope 만, 다른 컨텍스트 분기 불가

### 한계 (2026-05-19 분석)
1. **GMV 신호 부재** — CTR/CVR 만으로는 저가 미끼 상품과 고가 매출 상품을 구분 못 함.
2. **CVR 미활용** — 매핑은 돼있으나 ranking 함수에 미반영, 단일 신호 (CTR) 편향.
3. **스무딩 부재 — ADR-0043 Context #1 재확인** — `ctr: Double` 만 저장하므로 `1/2` 와 `500/1000` 의 분포 폭 차이를 표현 못 함. 이 한계는 ADR-0043 의 MAB 단으로만 부분 해결됨 (rerank top-N 만 보호) — **ES function_score 단에서도 신호 스무딩 필요**.
4. **Freshness 부재** — `createdAt` 필드만 적재, 신상품 부스트 메커니즘 없음. MAB 의 cold-start 만으로 부족 (top-N 밖이면 MAB 도달 못 함).
5. **결정적 정렬 없음** — `_score` 동점시 ES 비결정 → 페이지네이션 flicker.
6. **단일 scope MAB** — `BanditKey(categoryId, productId)` 만 학습. 동일 상품이 다른 컨텍스트 (브랜드/가격대) 에서 다른 반응을 학습하지 못함.
7. **Seller diversity 부재** — top-K 가 한 셀러로 편중되는 상태 → 사용자 후보 다양성 ↓.
8. **평가 인프라 부재** — `study/19/34, 45` 에 이론(NDCG/MRR/online-offline-eval) 있으나 실제 잡/대시보드/judgment set 없음. **랭킹 변경의 효과를 객관 측정할 방법이 현재 0**.
9. **디버그 가시성 부재** — `_score` breakdown 을 운영 중 확인할 UI/API 없음. ES `explain` 은 raw, 가중치 계층/MAB sample 통합 분리 안 됨.

이 9개 한계는 사용자 (2026-05-19) 의 검색 품질 개선 플랜과 정확히 매핑된다.

## Decision

**4-Phase 로 단계적 도입**. 각 Phase 가 독립 production 산출물이며, 다음 Phase 의 fallback 역할.

### Phase 1 — Quick Wins (S/M 사이즈, ~3md)

| 항목 | 변경 | 기본 활성화 |
|---|---|---|
| 결정적 tiebreaker | `sort: [_score desc, id asc]` | ✅ on |
| CVR 가중치 활성화 | `RankingProperties.cvrWeight` + function_score 함수 추가 | ❌ default 0, 점진 활성화 |
| Freshness gauss decay | `RankingProperties.freshness.*` + `gauss(createdAt, origin=now, scale=14d, decay=0.5)` | ❌ default weight 0 |

### Phase 2 — Signal Expansion (M 사이즈, ~5md)

| 항목 | 변경 |
|---|---|
| GMV 신호 | analytics → `gmv7d, gmv30d` 발행 / `ProductEsDocument.gmv7d, gmv30d` 필드 / function_score 가중치 |
| 베이지안 스무딩 | analytics 측 `(clicks + α)/(impressions + α + β)` 산출, raw 값도 함께 발행 (`ctrRaw`, `cvrRaw`) |
| 신호 모니터링 | `search.feature_score.distribution{signal}` 메트릭 |

### Phase 3 — MAB Expansion (M/L 사이즈, ~10md)

| 항목 | 변경 |
|---|---|
| `BanditKey` 일반화 | `BanditKey(scope: String, productId: String)`, scope = `category:{id}` \| `brand:{id}` \| `_default_` |
| 다중 scope blend | `MultiScopeBanditBlender` — 여러 scope state 를 weighted average 로 합성 |
| Seller diversity rerank | top-K (default 20) MMR 또는 round-robin, `maxPerSeller` 외부화 |
| `ProductEsDocument.brand` 신규 필드 | product 도메인 모델 동기 필요 (별도 spec 합의 사항) |
| 기존 ADR-0043 P2 흡수 | analytics 가 prior 자동 산출 (category/brand 별) |

### Phase 4 — Evaluation Infrastructure (L 사이즈, ~10md+)

| 항목 | 변경 |
|---|---|
| NDCG/MRR 평가 잡 | `search:batch` 신규 Spring Batch Job, daily 02:00 trigger, ClickHouse 적재 |
| Judgment set | 약지도 (reservation=3, addwish=2, click=1) 부트스트랩 + 수동 보정 |
| Score breakdown API | `GET /api/v1/search/debug?query=...&variant=&explain=true` |
| Raw query API | `POST /api/v1/search/debug/raw-query` (ADMIN + Rate Limit) |
| Side-by-side UI | admin-fe 신규 페이지 — 두 variant 좌우 비교 + score breakdown 카드 |
| Query builder UI | admin-fe — `ProductEsDocument` 메타 자동 스캔하여 토글 UI 생성 |
| Grafana 대시보드 | `search.eval.ndcg10`, `search.diversity.unique_sellers_at_k` 등 |

### 비기능 / 운영 원칙
- 모든 신규 weight default = 0 또는 `enabled = false` → **회귀 보호 + 점진 활성화**.
- ADR-0025 Tier 1 P99 200ms 유지. function_score 함수 추가 / diversity rerank / scope blend 는 모두 in-memory 후처리 (top-N 한정) → ES 쿼리 단계 cost 변화 거의 없음.
- 설정 hot reload: K8s ConfigMap reload (Spring Cloud Config 미도입).

## Alternatives Considered

| 대안 | 평가 |
|---|---|
| **현행 유지 + ADR-0043 P2 만 진행** | 평가 인프라 없이 P2 (FE impression tracking + dashboard) 만 추가하면 "변경의 효과 측정" 이 여전히 불가. 본 ADR 의 Phase 4 가 ADR-0043 P2 를 흡수/대체. |
| **즉시 LinUCB / LTR 도입** | ADR-0043 P3 + ADR-0047 의 영역. 본 ADR 의 4 Phase 가 안정화돼야 컨텍스트 feature / judgment set 활용 가능. 선후 관계 명확. |
| **ES script_score 로 스무딩** | real-time 이지만 모든 쿼리마다 CPU 비용. analytics 가 이미 통계 책임 → analytics 측 산출이 SoT 측면에서 우월. |
| **search-fe 내 side-by-side** | 사용자 인터페이스 침투 위험. admin-fe 가 권한 제어 + 운영자 친화적. |
| **Vector / Semantic search 우선** | ADR-0008 후속 / study/19/08~11 의 영역. judgment set 이 없으면 vector 도 객관 평가 불가 → 평가 인프라가 선행. |

## Consequences

### Positive
- 신호 다양화 (popularity / CTR / CVR / GMV / freshness) + 다중 scope MAB → 단일 신호 편향 해소.
- **평가 인프라 도입으로 모든 후속 ranking 실험이 데이터 기반** — Wide&Deep, vector, semantic 도 같은 잣대로 평가 가능.
- side-by-side UI + score breakdown 으로 운영자 디버깅 비용 ↓.
- Seller diversity 로 long-tail 상품 노출 ↑ (recommendation 측 cold-start 와 시너지).

### Negative / Risk
- **운영 복잡도 ↑** — weight 외부화 항목이 10+ 개로 증가. 운영 가이드 + Grafana 대시보드로 mitigation.
- **NDCG/MRR judgment set 품질이 곧 평가 품질** — 약지도 bootstrap 의존도가 높으면 self-fulfilling prophecy 위험 → 정기 수동 spot-check 절차 필수.
- **Diversity vs Relevance tradeoff** — MMR lambda 잘못 설정하면 relevance 손실. 본 spec 의 default `mmrLambda=0.7` (relevance 우선) 로 안전선 확보.
- **MAB scope 확장 시 Redis state 메모리 ↑** — `scope * productId` 로 키 수 증가. brand 만 추가해도 약 10x 증가 추정. TTL + LRU eviction 정책 필요.
- **데이터 정합성** — `gmv7d`, `gmv30d` 추가로 analytics → search 동기 lag 영향 범위 확대. ADR-0030 read-after-write stickiness 와 무관 (eventually consistent 허용).

### Migration 순서
1. **Phase 1 (quick wins) 활성화 후 1주 관찰** — latency, error rate, baseline NDCG (judgment set 없이 BM25 spot-check)
2. **Phase 2 활성화 시 GMV weight 부터 단계적 ramp** (0 → 0.5 → 1.0 → 2.0)
3. **Phase 3 은 brand 필드 신설 후 separate ramp** — product 도메인 / search 도메인 동기 필요
4. **Phase 4 의 평가 인프라가 가장 큰 의존성** — Phase 2/3 ramp 전에 baseline 측정 인프라가 가동돼야 효과 측정 가능

## 관련 문서

- ADR-0008 (search strategy) — 텍스트 베이스
- ADR-0017 (analytics scoring system) — CTR/CVR/popularityScore 발행 책임
- ADR-0025 (latency budget) — Tier 1 P99 200ms
- ADR-0043 (online bandit thompson) — 본 ADR 의 Phase 3 이 P2/P3 일부 흡수
- ADR-0044 ~ ADR-0049 (recommendation series) — Wide&Deep / DLRM / MAB 측 시너지
- 본 spec: `docs/specs/2026-05-19-search-quality-improvements/`
- 본 plan: `docs/plans/2026-05-19-search-quality.md`
- 이론 자료: `study/docs/19-search-engine/{34,42,43,44,45}.md`

## 사용자 도메인 (OTA) 컨텍스트 보존

원 요청의 "지역별 MAB", "여행사 다양성", "명소 검색", "깜란↔나트랑 동의어", "패키지 검색 프리텍스트" 는 commerce 일반화에서 다음과 같이 매핑:

| 원 요청 | 본 ADR 매핑 | 분리 spec |
|---|---|---|
| 지역별 MAB | `scope = region:{id}` (Phase 3 의 일반화된 scope) | OTA 도메인 spec 시 region 필드 신설 |
| 여행사 다양성 | seller diversity rerank (Phase 3) | 동일 |
| 명소 기반 검색 | — | OTA 도메인 spec (attraction 모델 신설 필요) |
| 동의어 (깜란↔나트랑) | — | 본 ADR Phase 4 후속, synonyms graph + ES analyzer 재설정 |
| 패키지 검색 프리텍스트 | — | OTA 도메인 spec (package 모델 신설 필요) |
