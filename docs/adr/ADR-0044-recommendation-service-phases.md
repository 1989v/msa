# ADR-0044 Recommendation 서비스 도입 단계

## Status
Proposed (2026-05-12)

## Context

msa 본 레포에 추천 서비스 미구현. 추천 시스템 도입의 비즈니스 가치는 크다 (cross-sell, retention, GMV) — 그러나 한 번에 풀스택 (Two-Tower, DLRM, ANN) 구축은 비용/리스크가 매우 크다.

산업 검증된 패턴은 **단계적 도입 (incremental delivery)** 이다. 룰 기반 → CF → 딥러닝 → Ranking 순서로 점진 진화. 각 단계마다 production 가치가 누적되고, 다음 단계의 fallback 역할을 한다.

학습 근거: `study/docs/20-recommendation-modeling/` (Phase 1-10 + 부록, 12K 줄).

## Decision

4단계 도입 — 각 단계가 독립 production 산출물:

### Phase 1: 룰 기반 Category Best (현재 도입 대상)
- 산출물: `recommendation` 서비스 (domain + app) + ClickHouse SQL 룰 기반 CB
- 알고리즘: 행동 가중합 (`reservation×100 + click×20 + addwish×10 + pageview×1`) + Wilson LCB (95% 신뢰)
- 도메인: 도시×카테고리 Top-N
- API: `GET /api/v1/recommendations/category-best`
- 가치: cold-start 안전망, 운영 개입 가능, 즉시 production
- 인프라: analytics 서비스의 ClickHouse + Redis + Argo CronWorkflow (daily 02:00)

### Phase 2: Item-Item CF Spark PoC (향후)
- 산출물: `recommendation/batch` 모듈 + Spark Operator 잡
- 알고리즘: 공출현 행렬 + PPMI (Positive Pointwise Mutual Information) 또는 Spark MLlib ALS
- 도메인: 상품 간 유사도 (similar-items)
- API: `GET /api/v1/recommendations/similar-items`
- 가치: 개인화 시작 — 사용자 이력 기반
- 별도 plan + ADR 작성 예정

### Phase 3: Two-Tower retrieval (향후)
- 산출물: Python 사이드카 (FastAPI + FAISS) + ONNX export 파이프라인
- 알고리즘: Two-Tower (user/item tower + dot product + ANN HNSW)
- 도메인: 사용자별 personalized 추천
- API: `GET /api/v1/recommendations/personalized`
- 가치: deep embedding 의 scalable serving
- ADR-0046 (ANN 인덱스 선택) 별도 작성 예정

### Phase 4: Ranking 모델 (Funnel Stage 2, 더 후속)
- 산출물: DLRM 또는 Wide & Deep 의 정밀 ranking
- 가치: Top-K quality ↑ — Two-stage retrieval 완성

## Alternatives Considered

### A. 한 번에 Two-Tower 부터 도입
- 학습 인프라 (Python GPU) + 서빙 인프라 (FAISS sidecar) 동시 구축 필요
- 데이터 부족 단계에서 모델 성능 검증 어려움
- 단기 ROI 부재 — 인프라 구축에 1-2개월
- → 단계 1 의 즉시 가치 vs 점진 학습 곡선이 우월

### B. 룰 기반만 유지 (Phase 1 영구)
- 개인화 가치 손실 — CTR/CVR ceiling 명확
- 시장 표준 (Two-Tower 기반 retrieval) 대비 경쟁력 부족
- 장기적으로 부적합

### C. 외부 SaaS (Amazon Personalize, Vertex AI 등)
- 데이터 외부 이동 — privacy / cost concern
- msa 의 self-hosted 원칙과 충돌
- 비용 (요청당 과금) 이 자체 운영보다 비쌈 (특정 규모 이상)

→ 단계적 자체 도입이 비용/가치/리스크 균형 최적.

## Consequences

### 긍정
- 단계별 production 가치 — 매 Phase 가 독립 가치
- 리스크 분산 — 한 단계 실패해도 다음 갈 수 있음
- 인프라 점진 도입 — Spark Operator, Python sidecar, FAISS 등 필요한 시점에만
- Fallback chain 보장 — Phase 2/3 가 데이터 부족 시 Phase 1 (룰 기반) 으로 자동 폴백 (cold-start)
- 학습 자산 (study/docs/20-recommendation-modeling/) 으로 ramp-up 시간 단축

### 부정
- 4 단계 운영 = 4 종 인프라 동시 관리 (장기적)
- Phase 1 → Phase 4 의 코드 진화 부담 — 도메인 모델 변경 시 회귀 테스트 부담
- 단기 ROI 작음 — Phase 1 만으로는 큰 매출 효과 어려움 (cold-start 안전망 + 운영 개입 가치 위주)

### 리스크 완화
- 각 Phase 마다 A/B 테스트로 정량 검증 후 ramp-up (50:50 → 100:0)
- Phase 별 인프라가 누적 (이전 단계 폐기 안 함, fallback 역할)
- 코드 컨벤션: Phase 별 별도 use case (GetCategoryBestUseCase / GetSimilarItemsUseCase / GetPersonalizedUseCase) — Strategy 패턴
- 신상품 cold-start 는 항상 Phase 1 (룰 기반) 가능

## Implementation

Phase 1 의 실행 계획: `docs/plans/2026-05-12-recommendation-phase1.md`.

Phase 2, 3 은 Phase 1 안정화 + A/B 검증 후 별도 plan + ADR.

## References

- 학습 노트: `study/docs/20-recommendation-modeling/20-msa-adr-three.md`
- 함께 작성: ADR-0045 (데이터 파이프라인)
- 향후 작성: ADR-0046 (ANN 인덱스 선택, Phase 3 시점)
- Plan: `docs/plans/2026-05-12-recommendation-phase1.md`
