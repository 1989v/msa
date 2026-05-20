<!-- source: search -->
# Raw Idea — Search Quality Improvements

## 작업 요약 (2026-05-19)

> search 프로젝트의 검색 품질 개선 방향. 이미 더 좋게 되어있으면 스킵, 아니면 플래닝 진행 후 문서화.

본 spec 은 **commerce (product) 도메인 기준**. 모든 항목은 일반화된 ranking / MAB / 평가 인프라로 다룬다.

### 작업 대상 (즉시 적용 예정)
- 판매 스코어, 생성일 기준 정렬 요소 추가
- CTR, CVR 기반 스코어링

### 추가 가능한 랭킹 정렬
- MAB, 톰슨샘플링 베이스 (5md)
- scope 별 MAB 분기 — category / brand 등 다중 bucket (10md)
- seller / brand 별 다양성 정렬, 부스팅 등 보완처리 (10md)
- 기본 스코어링 베이스에 부가적인 요소로 적용

### 적용 검토 (플래닝부터)
- 컨텍스트 베이스 MAB 고도화 (1mm)
- ML 베이스 리랭킹 (미정, 추천 모델링 협업 필요)

### 그 외 사이드 작업
- 카테고리 필터 기반 검색 외 자유 텍스트 (free-text) 검색 강화 여부 검토
- 통검 free-text 유입량 / 판매 지표 기반 도입 결정
- 쿼리 언더스탠딩 도입 검토
- 도메인 특화 용어 / 동의어 검색 개선 (synonyms graph)
- 랭킹 산정 결과 상세 모니터, A/B 사이드바이사이드 비교 페이지
- 랭킹 평가 모델: precision, NDCG, MRR
- 피처스코어(CTR/CVR/GMV) 기반 랭킹 + k값 스무딩
- 상품 생성일 기준 freshness 부스트 (MAB 도입 전)
- 최종 정렬 순서 보장을 위한 마지막 정렬 값(PK 등)
- 사이드바이사이드 비교 퍼널 — `_score`, `feature_score`, CTR, CVR, GMV, MRR, NDCG, BM25 노출
- 검색 쿼리 생성기 — 인덱스 필드 기준 매뉴얼 토글로 쿼리 조합 생성 후 비교

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
| 다중 scope MAB 분기 | `BanditKey`가 categoryId만 — 다중 scope 미지원 | M (BanditKey 재설계) |
| 다양성 rerank (brand diversity) | 부재 | M (MMR 또는 round-robin) |
| NDCG / MRR 평가 시스템 | 이론만 있음, 인프라 없음 | L (judgment set + offline job + dashboard) |
| Side-by-side A/B 비교 UI | 부재 | L (FE 새 페이지 + score breakdown API) |
| 쿼리 빌더 UI | 부재 | L (어드민 FE) |
| 쿼리 언더스탠딩 / 도메인 동의어 | `nori`만 사용, synonyms graph 없음 | M (synonyms file + analyzer 재설정) |
