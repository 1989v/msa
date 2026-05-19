<!-- source: search -->
# Raw Idea — Search Quality Improvements

## 원 요청 (사용자 메시지, 2026-05-19)

> search 프로젝트에 이런 플래닝으로 검색 품질을 개선하는 방향은 어때? 이미 더 좋게 되어있으면 스킵하고 아니라면 이런 방향으로 플래닝 진행 후 개선할 수 있도록 문서화해도 좋을거같아.

### 작업 대상 (즉시 적용 예정)
- 판매 스코어, 생성일 기준 정렬 요소 추가
- CTR, CVR 기반 스코어링

### 추가 가능한 랭킹 정렬
- MAB, 톰슨샘플링 베이스 (5md)
- 지역별 MAB 분기 (10md)
- 여행사별 다양성 정렬, 부스팅 등 보완처리 (10md)
- 기본 스코어링 베이스에 부가적인 요소로 적용

### 적용 검토 (플래닝부터)
- 컨텍스트 베이스 MAB 고도화 (1mm)
- ML 베이스 리랭킹 (미정, 추천 모델링 협업 필요)

### 그 외 사이드 작업
- 패키지 검색 프리텍스트 도입 검토
- 통검 프리텍스트 유입량/판매 지표 기반 검토
- 명소 기반의 검색 적용 검토 (현재: 지역 탐색 + 필터)
- 쿼리 언더스탠딩 기반 프리텍스 검색 개선
- 노출 카테고리, 명소 기반 검색
- 도메인 특화 용어 검색 개선 (예: 깜란 검색시 나트랑 상품 포함)
- 랭킹 산정 결과 상세 모니터, A/B 사이드바이사이드 비교 페이지
- 랭킹 평가 모델: precision, NDCG, MRR
- 피처스코어(CTR/CVR/GMV) 기반 랭킹 + k값 스무딩
- 상품 생성일 기준 freshness 부스트 (MAB 도입 전)
- 최종 정렬 순서 보장을 위한 마지막 정렬 값(PK 등)
- 사이드바이사이드 비교 퍼널 — `_score`, `feature_score`, CTR, CVR, GMV, MRR, NDCG, BM25 노출
- 검색 쿼리 생성기 — 인덱스 필드 기준 매뉴얼 토글로 쿼리 조합 생성 후 비교

## 도메인 컨텍스트 조정

원 요청은 **여행 OTA 도메인** (MyRealTrip — 사용자 운영 경험) 용어로 작성됨:
- "지역별 MAB" → 본 레포는 commerce 플랫폼이므로 "scope-based MAB" 로 일반화 (`scope` = category | region | brand | …)
- "여행사" → "seller" / "brand" 로 치환
- "명소" → 도메인에 없으므로 spec 에서 제외, study 노트로만 보존 (사용자가 별도 요청 시 OTA 컨텍스트 spec 분리)
- "패키지 검색" → 본 레포는 단일 product 모델, 별도 spec 후보

## 현재 상태 요약 (분석 결과, 2026-05-19)

### 이미 구현됨 (스킵 대상)
- ES function_score: `popularityScore` (w=10) + `ctr` (w=5) (`ProductSearchAdapter.kt`, `RankingProperties.kt`)
- Thompson Sampling MAB: Beta-Bernoulli + Marsaglia-Tsang gamma sampler, hybrid weight, time decay, cold-start prior, impression threshold (`ThompsonReranker.kt`, `BetaSampler.kt`, `BanditProperties.kt`)
- Category 단위 MAB 분기: `BanditKey(categoryId, productId)` + `categoryPriors` 외부화
- analytics → search 점수 파이프라인: `analytics.score.updated` → `ProductScoreUpdateConsumer` → ES partial update
- ProductEsDocument 필드: `popularityScore`, `ctr`, **`cvr` (필드는 있으나 가중치 미적용)**, `categoryId`, `createdAt`, `scoreUpdatedAt`
- 이론 자료: `study/docs/19-search-engine/` 45 파일 (NDCG/MRR/MAB/online-offline-eval 모두 포함)
- ADR-0008 (search-strategy), ADR-0017 (analytics-scoring), ADR-0043 (online-bandit-thompson)

### 갭 (이 spec 대상)
| 사용자 제안 | 갭 | 난이도 |
|---|---|---|
| GMV 가중치 | ES에 `gmv` 필드 없음, function_score 미반영 | M (필드 추가 + analytics 발행) |
| CVR 가중치 | 필드는 있으나 function_score 미사용 | S (1줄) |
| CTR/CVR 베이지안 스무딩 | 단일 스칼라 그대로 — ADR-0043 Context #1이 지적한 한계 | M (analytics 측 또는 ES script_score) |
| Freshness boost | `createdAt` 필드만 존재, function_score 미사용 | S (gauss decay function) |
| 결정적 tiebreaker | 동점시 ES 비결정 | XS (sort 추가) |
| 지역(scope) MAB 분기 | `BanditKey`가 categoryId만 — 다중 scope 미지원 | M (BanditKey 재설계) |
| 다양성 rerank (seller diversity) | 부재 | M (MMR 또는 round-robin) |
| NDCG / MRR 평가 시스템 | 이론만 있음, 인프라 없음 | L (judgment set + offline job + dashboard) |
| Side-by-side A/B 비교 UI | 부재 | L (FE 새 페이지 + score breakdown API) |
| 쿼리 빌더 UI | 부재 | L (어드민 FE) |
| 쿼리 언더스탠딩 / 도메인 동의어 | `nori`만 사용, synonyms graph 없음 | M (synonyms file + analyzer 재설정) |
