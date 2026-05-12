# ADR-0048 Phase 4.5 A/B + Phase 5 DLRM 도입

## Status
Proposed (2026-05-13)

## Context

Phase 4 (Wide & Deep) 까지 funnel 완성. 후속 가치:
1. **Phase 4.5 A/B** — Phase 1 (CB) vs Phase 3 (retrieval-only) vs Phase 4 (retrieval+rank) 정량 비교
2. **Phase 5 DLRM** — Wide & Deep 의 manual cross → pairwise dot product 자동화 (Meta 2019)

## Decision

### Phase 4.5 A/B
- experiment 서비스 (port 8091) 연동
- 3-variant: `control` / `retrieval-only` / `retrieval-and-rank`
- `recommendation.experiment.id` env 로 활성화 (0 = disabled, default funnel)
- 실패 graceful: variant 조회 실패 → default variant

### Phase 5 DLRM
- recommendation-ml/train_dlrm.py — 학습 + ONNX export (`dlrm.onnx`)
- 모델 구조 (학습 §14 §2):
  - Bottom MLP for dense features (city_idx, category_idx 를 dense 로 cast)
  - Embedding tables: user_id, item_id (각 32 dim)
  - Pairwise dot product interaction (모든 쌍)
  - Top MLP → sigmoid
- recommendation-ann 의 `/rank` 에 `ranker_type` 파라미터 추가 (`wide_and_deep` 또는 `dlrm`)
- Phase 4.5 A/B 의 추가 variant: `retrieval-and-rank-dlrm`

## Consequences

### 긍정
- Funnel 정량 검증 가능
- DLRM 의 자동 pairwise interaction — manual cross 의 한계 극복

### 부정
- 모델 2개 운영 (Wide & Deep + DLRM)
- 학습 시간 약간 증가
- experiment 서비스 의존성 (서비스 다운 시 graceful → default)

## References
- 학습: `study/docs/20-recommendation-modeling/14-paper-dlrm.md`, `19-evaluation-ab-mab.md`
- ADR-0044 (도입 단계), ADR-0047 (W&D)
