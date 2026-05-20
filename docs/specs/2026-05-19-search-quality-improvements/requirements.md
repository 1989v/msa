<!-- source: search -->
# Requirements — Search Quality Improvements

상위 ADR: `docs/adr/ADR-0050-search-quality-roadmap.md`
선행 ADR: `docs/adr/ADR-0008-search-strategy.md`, `ADR-0017-analytics-scoring-system.md`, `ADR-0043-search-online-bandit-thompson.md`

## 0. 목표 (Goals)

- 검색 결과 랭킹 신호의 표현력을 늘리고 (GMV, CVR, Freshness), 노이즈를 줄인다 (베이지안 스무딩, 결정적 tiebreaker).
- 다양성 (seller diversity) 과 다중 scope MAB (region, brand 등) 을 도입해 단일 카테고리 prior 의 한계를 깬다.
- 평가 인프라 (NDCG/MRR + 오프라인 judgment set + 온라인 A/B side-by-side UI + 쿼리 빌더 UI) 를 구축해, **실험 가능한** 검색 시스템으로 전환한다.

## 1. 랭킹 신호 확장 (Ranking Signals)

### FR-1.1 GMV (판매액) 신호
- analytics 가 상품별 GMV (최근 N일 합) 산출 후 `analytics.score.updated` 페이로드에 추가
- `ProductEsDocument.gmv: Double` 신규 필드
- `ProductSearchAdapter` function_score 에 `gmv` weight 함수 추가 (default `gmvWeight = 0.0` — 점진 활성화)

### FR-1.2 CVR 가중치 활성화
- 이미 존재하는 `ProductEsDocument.cvr` 를 function_score 에 반영
- `RankingProperties.cvrWeight` 신규 (default `0.0`)
- 활성화 시 popularity / CTR / CVR / GMV 4-축 정렬

### FR-1.3 베이지안 스무딩 (Bayesian Smoothing)
- raw `clicks / impressions` 대신 `(clicks + α) / (impressions + α + β)` 형태로 스무딩
- α, β 는 카테고리 평균 CTR 기반 empirical Bayes (ADR-0043 의 prior 와 동일 출처 재사용)
- 산출 위치: **analytics 서비스** (이미 통계 집계 책임) → `score.updated` 페이로드의 `ctr`/`cvr` 는 스무딩된 값
- raw 값도 별도 필드 (`ctrRaw`, `cvrRaw`) 로 함께 발행 — 디버그/평가용

### FR-1.4 Freshness Boost
- `ProductEsDocument.createdAt` 을 function_score `gauss` decay 로 부스트
- 파라미터 외부화 (`RankingProperties.freshness.{origin,scale,offset,decay,weight}`)
- default: 신상품 30일간 부스트, half-life ≈ 14일
- `weight = 0.0` 이면 off → 안전한 점진 활성화

### FR-1.5 결정적 Tiebreaker
- ES sort: `[_score desc, id asc]`
- 동점 시 페이지네이션 안정성 확보 (search_after 와 직교)

## 2. MAB 확장 (Multi-Armed Bandit Expansion)

### FR-2.1 다중 Scope MAB
- 현재 `BanditKey(categoryId, productId)` 를 `BanditKey(scope: String, productId: String)` 로 일반화
- `scope` 값 후보: `category:{id}`, `brand:{id}`, `_default_` (확장 가능)
- 동일 productId 에 대해 **여러 scope 의 state 를 병렬 조회 → blend** (가중 평균)
- 외부화: `BanditProperties.scopes: List<ScopeConfig>` — 각 scope 별 weight, priors

### FR-2.2 Seller (Brand) Diversity Rerank
- top-K (default 20) 내 seller 편중 완화
- 알고리즘: MMR (Maximal Marginal Relevance) 또는 supplier round-robin
- `RankingProperties.diversity.{enabled, maxPerSeller, mmrLambda}` 외부화
- ThompsonReranker 출력 직후 적용

### FR-2.3 컨텍스트 MAB / LinUCB / LTR
- 본 spec 범위 외 — ADR-0043 Phase 3 + ADR-0047 (Wide&Deep) 의 영역
- 본 spec 의 Phase 1~4 가 안정화된 후 ADR 분리

## 3. 평가 인프라 (Evaluation Infrastructure)

### FR-3.1 NDCG / MRR 오프라인 평가
- judgment set: `(query, productId, relevance: 0~3)` CSV 또는 ClickHouse 테이블
- relevance 산출 옵션 (둘 다 지원):
  - (a) 수동 라벨링 (어드민 UI 후속 작업)
  - (b) 로그 기반 약지도 (`reservation=3, addwish=2, click=1, impression_only=0`)
- 평가 잡 (Spring Batch 또는 분리된 Python 잡, 본 spec 은 Spring Batch 채택):
  - 같은 query 로 ES 검색 실행 → top-K 추출 → NDCG@10, MRR, MAP 산출
  - 결과 ClickHouse 적재: `search_eval_results(eval_id, ts, variant, query, ndcg10, mrr, map, precision_at_k)`

### FR-3.2 온라인 A/B Side-by-Side UI
- 어드민 FE 신규 페이지 — 같은 query 를 두 variant (예: legacy vs new ranking) 에 동시 실행 후 좌우 비교
- 각 결과 카드에 score breakdown 표시: `_score`, `bm25Score`, `featureScore (popularity/CTR/CVR/GMV)`, `freshnessBoost`, `banditSample`, `finalScore`
- 모음 지표: 두 variant 의 평균 NDCG/MRR (judgment set 의 query 일 때만)
- search:app 신규 API: `GET /api/v1/search/debug?query=...&variant={A|B}&explain=true`
  - `explain=true` 시 ES `explain` API 결과 + ThompsonReranker 의 sample 값 + 가중치 적용 단계별 점수 반환

### FR-3.3 쿼리 빌더 (Query Builder) UI
- 어드민 FE 신규 페이지 — `ProductEsDocument` 의 필드 메타데이터를 자동 스캔하여 토글 UI 생성
- 각 필드별 옵션: match / term / range / function_score weight
- 생성된 쿼리를 ES 에 직접 실행하고 결과를 side-by-side UI 에 좌측/우측으로 보낼 수 있음
- search:app 신규 API: `POST /api/v1/search/debug/raw-query` — 보안: ADMIN 권한 필요 + Rate Limit

## 4. 외부화 / 운영 (Operations)

### FR-4.1 Configuration Hot Reload
- `RankingProperties`, `BanditProperties` 의 weight 류는 `@ConfigurationProperties` + Spring Cloud Bus 또는 K8s ConfigMap reload 로 hot reload
- 본 spec 에서는 ConfigMap reload 만 지원 (Spring Cloud Config 미도입 상태)

### FR-4.2 모니터링 / 알람
- 신규 메트릭:
  - `search.feature_score.distribution{signal}` — popularity/CTR/CVR/GMV/freshness 분포
  - `search.eval.ndcg10{variant}` — 정기 평가 결과
  - `search.diversity.unique_sellers_at_k{k=10,20}` — 다양성 측정
- alert: 평가 NDCG@10 이 baseline 대비 N% 하락하면 Slack 알림

## 5. 비기능 / 제약 (Non-functional)

- **Latency**: ADR-0025 Tier 1 P99 200ms 유지. function_score 함수 추가, diversity rerank, 다중 scope MAB blend 가 추가됨 — 모두 top-N rerank 라 ES 쿼리 단계가 아닌 in-memory 처리로 흡수. 측정 후 회귀 발생 시 weight 비활성화 fallback.
- **Backward compatibility**: 모든 신규 weight default = 0 또는 enabled=false → 단계적 활성화.
- **Domain coverage**: 본 spec 은 commerce 일반 도메인 한정. 추가 scope (예: 가격대 / region 등) 를 활용하려면 product 도메인 모델 확장이 선행 — 일반화된 `scope` 메커니즘은 이미 갖춰져 있음.
- **Test rule**: 도메인 모듈 BehaviorSpec + MockK (CLAUDE.md), 베이지안 스무딩 / freshness gauss 같은 수학 로직은 unit + property test.

## 6. 범위 제외 (Out of Scope)

- LinUCB / Wide&Deep / DLRM 본격 도입 — ADR-0043 Phase 3, ADR-0047
- Vector / Semantic search — ADR-0008 후속, study/19/08 ~ 11 참조
- 도메인 특화 동의어 / synonyms graph 운영 자동화 — Phase 4 후속
- 어드민 FE 의 judgment set 라벨링 UI — Phase 4 후속 (Phase 3 은 CSV 업로드만 지원)

## 7. 성공 기준 (Success Criteria)

| 항목 | 기준 |
|---|---|
| Tiebreaker | 동일 query / 동일 데이터 재호출 시 결과 순서 100% 일치 |
| GMV/CVR/Freshness | 통합 A/B 변수에서 NDCG@10 baseline 대비 ≥ +3% (judgment set 50개 query) |
| Smoothing | 신상품 (impressions < 100) 의 top-20 노출률, 기존 대비 ≥ +20% |
| Diversity | top-20 의 unique seller count, 기존 대비 ≥ +50% (편중 query 기준) |
| Eval infra | 매일 02:00 자동 평가 잡 통과, 결과 ClickHouse 적재, Grafana 대시보드 가시화 |
| Side-by-side UI | 어드민이 좌우 비교 가능, score breakdown 모든 신호 노출 |
