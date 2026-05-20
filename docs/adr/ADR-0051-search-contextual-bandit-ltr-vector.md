# ADR-0051 검색 ranking 의 고급 단 — Contextual Bandit / LTR / Vector

## Status
Proposed (2026-05-20) — **draft only**, 결정 미확정

## Context

ADR-0050 의 4 Phase 가 모두 출고된 상태 (2026-05-20). 다음 한계가 남는다:

1. **컨텍스트 학습 부재** — ADR-0050 Phase 3 의 multi-scope MAB 는 *static weighted blend*. 사용자/세션 컨텍스트 (시간대, 디바이스, 이전 클릭 sequence, 가격대, 카테고리 친밀도 등) 를 학습에 활용 못 함.
2. **LTR (Learning-to-Rank) 미도입** — 오프라인 학습 기반 ranking 모델 부재. NDCG/MRR 평가 인프라 (Phase 4) 는 갖췄으나 모델 학습 파이프라인 없음.
3. **Vector / Semantic search 부재** — `nori` BM25 만 사용. 동의어/오타/문맥 의미 매칭 한계. study 19/8~9 (vector + RRF) 가 이론으로만 존재.

본 ADR 은 이 셋을 단일 로드맵으로 묶되, **결정은 별도 spec/PR 로 분리** (각 항목 5md~1mm+ 규모).

## Decision (Proposed)

### 트랙 A: Contextual Bandit (LinUCB)

**언제**: ADR-0050 Phase 4 의 평가 인프라가 안정화되고 (3개월 운영), `judgment set` 가 충분 (≥ 500 query × 5 click context) 일 때.

**무엇**:
- `BanditKey(scope, productId)` → `ContextualBanditKey(scope, productId, contextHash)` 로 확장
- context feature: `(hour_of_day, day_of_week, user_segment, prior_session_clicks_n)`
- LinUCB algorithm: 각 arm 의 `θ` 벡터 학습, UCB 신뢰구간으로 exploration
- 저장: Redis 한계 → ClickHouse 또는 PostgreSQL + pgvector 후보
- Phase 3 multi-scope blender 위에 contextual term 추가

**왜 별도 ADR 인가**:
- Redis-only state 의 메모리/latency 가정이 무너짐 — 인프라 결정 필요
- context feature 선택 자체가 운영적/A/B 의사결정 — 본 ADR 에서 확정 불가
- ADR-0049 (recommendation-mab-and-realtime) 와 인프라 공유 가능성 검토 필요

**참조 자료**: Li et al. (2010) "Contextual Bandits with Linear Payoff Functions"

### 트랙 B: LTR (Learning-to-Rank)

**언제**: 트랙 A 와 독립. judgment set 의 양보다 *질* (수동 보정 비율, ADR-0050 Phase 4 의 spotcheck 절차) 가 검증된 시점.

**무엇**:
- 알고리즘: LambdaMART (XGBoost) — 가장 산업 검증된 LTR 알고리즘. Wide&Deep 은 ADR-0047 의 recommendation 영역과 중복.
- feature engineering:
  - text: BM25 score, name length, exact match flag
  - popularity: CTR, CVR, GMV (모두 ADR-0050 Phase 2 에서 신호 추가됨)
  - context: query length, query type (single keyword / phrase / category-name)
  - product: price percentile in category, age days, brand popularity
- 학습 데이터: ClickHouse `search_judgments` + `analytics.events` 의 click-through pair
- 서빙: ES rescore (Elasticsearch LTR plugin) 또는 sidecar 모델
- 평가: NDCG@10 (이미 갖춰진 평가 잡으로 자연 비교)

**왜 별도 ADR**:
- ES Learning-to-Rank plugin 의존성 결정
- 모델 학습 파이프라인 (Argo Workflows? Airflow?) 인프라 의사결정
- recommendation 의 ADR-0047 (Wide&Deep) 와 feature pipeline 공유 여부

**참조**: Burges (2010) "From RankNet to LambdaRank to LambdaMART"

### 트랙 C: Vector / Semantic Search

**언제**: 트랙 A/B 와 독립. study 19/8~11 이 이론적으로 완비됨.

**무엇**:
- 텍스트 임베딩: ONNX export 된 ko-sroberta 계열 (한국어 우선) 또는 multilingual-e5-small
- ES 인덱스 매핑: `dense_vector` field + HNSW
- 하이브리드 검색: RRF (Reciprocal Rank Fusion) 로 BM25 + vector 결합
- 평가: 같은 query / judgment set 에서 BM25 vs RRF 의 NDCG 비교

**왜 별도 ADR**:
- 임베딩 모델 선택 (multilingual vs ko-only) — 도메인 별 영향 큼
- HNSW 파라미터 (m, ef_construction, ef_search) 튜닝 + 메모리 요구사항
- recommendation ADR-0046 (ANN FAISS sidecar) 와 인프라 공유 vs 분리

**참조**: ES Vector docs, study/19/08-vector-search-hnsw.md

## Alternatives Considered

| 대안 | 평가 |
|---|---|
| **단일 큰 ADR 로 통합** | 세 트랙은 독립 진행 가능 + 의사결정 시점이 다름. 단일 ADR 은 결정 늦춤. 기각. |
| **즉시 트랙 A/B/C 모두 시작** | 평가 인프라가 막 가동된 상태 (ADR-0050 Phase 4) → 효과 측정 데이터 없음. 6개월 운영 데이터 누적 후 진행 권장. 기각. |
| **트랙 C (vector) 우선 도입** | semantic search 가 동의어 / 오타 / 의미 매칭 문제 해결에 직접 기여. 단, judgment set 없으면 객관 평가 불가 → ADR-0050 Phase 4 가 선행. 후속 ADR 자체 결정. |

## Consequences

### Positive
- 검색 ranking 의 천장 ↑ — BM25-only → contextual + ML + vector 의 3축
- 각 트랙이 독립 산출물 — 한 트랙 실패가 다른 트랙 영향 없음
- recommendation 측 ADR-0047/0049 와 자연 통합 가능 (long-term)

### Negative / Risk
- **운영 복잡도 ↑↑** — 모델 학습 파이프라인 / vector store / 컨텍스트 hashing 모두 신규 인프라
- **평가 잣대의 self-fulfilling** — judgment set 이 BM25 의 click-through 로 만들어졌으면 vector/LTR 의 효과가 underestimate 됨
- **학습 인프라 부담** — LTR / contextual bandit / vector store 의 각 분야가 독립 운영 노하우를 요구. 외부 자문 또는 학습 비용 명시 필요
- **search vs recommendation 책임 모호** — Wide&Deep / DLRM 같은 모델은 추천 측 자산 (ADR-0047/0048). 본 ADR 의 LTR (LambdaMART) 와 명확히 분리 필요

## 후속 ADR 후보

각 트랙이 진행되면 별도 ADR:
- `ADR-00XX-search-contextual-bandit-linucb.md` — 트랙 A
- `ADR-00XX-search-ltr-lambdamart.md` — 트랙 B
- `ADR-00XX-search-hybrid-vector-rrf.md` — 트랙 C

## 의사결정 게이트

본 ADR 을 Accepted 로 승격하려면:
1. ADR-0050 Phase 4 의 평가 잡 3개월 운영
2. judgment set 의 수동 보정 비율 ≥ 30% 도달
3. Latency 회귀 마진 산출 (현재 ADR-0025 P99 200ms 대비)
4. 사용자 / 이해관계자 합의 (위 negative/risk 검토)

## 관련 문서
- ADR-0008 (search strategy) / ADR-0017 (analytics) / ADR-0043 (bandit thompson) / ADR-0050 (search quality roadmap)
- ADR-0046 (recommendation ANN FAISS), ADR-0047 (Wide&Deep), ADR-0049 (recommendation MAB)
- study/19/{08-vector,09-rrf,10-rerank-cross-encoder-ltr,42-thompson,43-mab,45-online-offline-eval-bias}
