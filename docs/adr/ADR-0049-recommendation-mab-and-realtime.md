# ADR-0049 Phase 6 MAB Thompson Sampling + Phase 7 실시간 메트릭

## Status
Proposed (2026-05-13)

## Context

Phase 5 (DLRM) 까지 funnel 의 모든 알고리즘 완성. Phase 4.5 의 deterministic A/B 는 통계적 rigor 보장하지만 **누적 reward 최대화** 측면에서 sub-optimal. 좋은 variant 가 발견된 후에도 50:50 split 유지.

학습 자료 §08 §6 + §19 §5:
- **Phase 6**: Thompson Sampling — Beta-Binomial posterior 에서 sampling → 자동 exploration/exploitation
- **Phase 7**: 실시간 click/impression 메트릭 집계 (Kafka Streams) — Thompson sampling 의 reward 입력

## Decision

### Phase 6 — Thompson Sampling Variant Selection
- recommendation 서비스 내 in-memory ThompsonSampler (per-instance, eventually consistent)
- 4 variants: control / retrieval-only / retrieval-and-rank (W&D) / retrieval-and-rank-dlrm
- 각 variant 의 Beta(α, β) — α=success(click), β=failure(no-click)
- 매 요청: 4개 variant 에서 sample → argmax → 해당 variant 실행
- 학습: API 응답에 variant 포함 → 클라이언트의 click event 가 analytics 로 → Kafka → recommendation 의 reward update

### Phase 7 — Real-time Reward Aggregation
- Kafka topic `recommendation.impression.recorded` + `recommendation.click.recorded`
- recommendation 서비스가 consume → in-memory ThompsonSampler update
- 운영 안전성: posterior 가 instance 별 다를 수 있음 — eventually consistent
- 대안 (향후): Redis hash 로 cluster-shared posterior

## Architecture

```
Client → GET /personalized?userId=N
   ↓
recommendation: thompson.select() → variant
   ↓ (variant 별 funnel 실행)
RecommendationItem 응답 + Kafka publish impression event
                                      ↓
                              recommendation.impression.recorded
   
Client → click event → analytics → Kafka
                                      ↓
                              recommendation.click.recorded
                                      ↓
   recommendation Consumer → thompson.update(variant, clicked=true)
```

## Trade-offs

### 긍정
- 누적 reward 최대화 (exploitation)
- 새 variant 도 적정 노출 (exploration)
- A/B 와 달리 동적 — 시즌 변화에 자동 적응

### 부정
- Instance 별 posterior 차이 (k3d-lite 1 replica 라 OK, multi-instance 에서는 sync 이슈)
- Thompson sampling 의 통계적 rigor 약함 (rapid prototype 용)
- Phase 4.5 A/B 와 동시 운영 불가 — variant 선택 메커니즘 충돌 → env 로 disable

## References
- 학습: `study/docs/20-recommendation-modeling/08-season-trip-home-mab.md` §6, `19-evaluation-ab-mab.md` §5
- ADR-0044, ADR-0048
