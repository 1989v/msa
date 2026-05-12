# ADR-0047 Recommendation Ranking — Wide & Deep (Funnel Stage 2)

## Status
Proposed (2026-05-13)

## Context

ADR-0044 의 Phase 4 — Funnel 의 Stage 2 (Ranking) 도입.

Phase 1-3 까지가 모두 retrieval (Stage 1): 룰 기반 / Item-Item CF / Two-Tower 가 후보 Top-100 을 좁히는 역할. 그러나 **precision 측면에서 한계** — 사용자 × 아이템 의 풍부한 interaction feature 활용 못 함.

학습 자료 §01 §4-1 의 표준 funnel:
```
Retrieval (Phase 3 Two-Tower) → 수십억 → 수백 후보 (recall 중시, latency ~50ms)
Ranking (Phase 4, 이번 ADR)   → 수백 → 수십 정밀 정렬 (precision 중시, latency ~30ms)
```

선택지 (학습 §12-15):
- **A. Wide & Deep (Google 2016)** — Memorization + Generalization joint
- **B. DLRM (Meta 2019)** — Sparse + Dense feature 분리 + pairwise interaction
- **C. TabTransformer (Amazon 2020)** — Categorical self-attention
- **D. DeepFM / DCN-v2** — Wide&Deep 의 cross 자동화

## Decision

**Option A: Wide & Deep** 채택.

근거:
- ✅ **PoC 단순성** — Linear (wide) + DNN (deep) 결합, 학습/서빙 모두 단순
- ✅ **Joint training 표준** — 산업의 ranking 진입점
- ✅ **Manual cross feature** — PoC 에서는 도메인 지식으로 의미 있는 cross 만 (user_city × item_category)
- ✅ **Phase 3 의 PyTorch + ONNX + recommendation-ann 인프라 재활용** — 큰 변경 없이 추가
- ⚠️ DLRM 는 더 정교하지만 인프라 부담 (model parallelism 등). 데이터 규모 (현재 mock) 에 과한 복잡도.

## Architecture

```
gateway → recommendation 서비스
              ↓ GET /personalized?userId=N&limit=20
       Stage 1 Retrieval (Phase 3 Two-Tower)
              ↓ POST /search { user_id, k: 100 }
       recommendation-ann (FAISS) → Top-100 후보
              ↓ POST /rank { user_id, candidates: [...] }
       recommendation-ann (Wide & Deep) → Top-20 재정렬
              ↓
       PERSONALIZED 응답
```

**recommendation-ann 의 확장**:
- `/search` (Phase 3): user_tower + FAISS HNSW → retrieval
- `/rank` (Phase 4): wide_and_deep.onnx → ranking
- 같은 service 안에 두 모델 — 인프라 분리 없음 (PoC)

## Wide & Deep 모델 정의

```
Wide Component (memorization):
   - manual cross product: user_city × item_category
   - Linear regression: score_wide = w · cross_features
   
Deep Component (generalization):
   - user_emb (32) + item_emb (32) + user_city_emb (8) + item_category_emb (8)
   - concat → MLP [128, 64, 1]
   - score_deep = MLP(concat)
   
final_score = sigmoid(score_wide + score_deep)
loss = BCE (positive pair + 4 random negatives per positive)
```

## Alternatives Considered

### B. DLRM
- ✅ Meta 검증 표준, pairwise interaction 정교
- ❌ Model parallelism / 더 큰 embedding table — 데이터 규모 부적합
- ❌ Phase 5+ 검토

### C. TabTransformer
- ✅ Categorical self-attention 표현력
- ❌ Categorical features 5+ 일 때 우월. 현재 features 적음.

### D. DeepFM / DCN-v2
- ✅ Wide 의 manual cross 자동화
- ❌ PoC 에서 manual cross 만으로 충분. 후속 진화 후보.

## Consequences

### 긍정
- 첫 ranking 모델 production-shape — funnel 완성
- Retrieval (Two-Tower) 의 Top-100 안에서 precision 향상
- Joint training 패러다임 학습

### 부정
- 학습 데이터 부족 시 효과 제한 (mock 데이터 한계)
- Latency 추가 — 2개 모델 호출 (retrieval + rank)
- 모델 2개 유지보수 (재학습 시 둘 다)

### 리스크 완화
- Wide & Deep 학습/추론 모두 Phase 3 의 recommendation-ann 안에 통합 — 인프라 분리 없음
- Cold-start fallback chain 의 안전망 (§17) 유지
- A/B 테스트 (Phase 4.5) 로 Phase 3 vs Phase 4 정량 비교

## Implementation

Plan: `docs/plans/2026-05-13-recommendation-phase4.md`

핵심 컴포넌트:
1. recommendation-ml/train_ranking.py — Wide & Deep 학습 + ONNX export
2. recommendation-ann/app.py — POST /rank endpoint 추가 + wide_and_deep.onnx 로드
3. RankingPort (도메인) + RankingAnnRestClient (인프라)
4. GetPersonalizedUseCase — retrieval 결과를 ranking 으로 재정렬
5. Argo CronWorkflow 의 train pipeline 에 ranking 추가

## References

- 학습 노트: `study/docs/20-recommendation-modeling/12-paper-wide-and-deep.md`
- Wide & Deep 논문: https://arxiv.org/abs/1606.07792
- ADR-0044 (도입 단계 — Phase 4 정의)
- ADR-0046 (FAISS sidecar — 인프라 공유)
