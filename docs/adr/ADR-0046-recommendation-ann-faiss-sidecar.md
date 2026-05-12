# ADR-0046 Recommendation ANN 인덱스 — FAISS Python Sidecar

## Status
Proposed (2026-05-12)

## Context

ADR-0044 의 Phase 3 (Two-Tower retrieval) 도입 시 임베딩 ANN 서빙 인프라 필요.

학습된 user/item embedding (64-128 dim dense vector) 의 cosine/dot product Top-K 검색이 핵심. 1억 item 까지는 ANN 색인 메모리 ~30GB. 검색 latency 목표 <10ms.

옵션 (학습 §10 §5):
- **A. FAISS Python sidecar** — 별도 Python 서비스
- **B. Elasticsearch `knn` (native)** — 기존 search 서비스 확장
- **C. Qdrant / Milvus** — 전용 Vector DB
- **D. ONNX Runtime + DJL (Kotlin 내장)** — recommendation 서비스 직접

## Decision

**Option A: FAISS Python Sidecar** (`recommendation-ann` 서비스 신규).

근거:
- ✅ **검증된 성숙도** — FAISS 는 Meta 산업 표준 (수십억 vector)
- ✅ **알고리즘 풍부** — IVF / PQ / HNSW 등 옵션 자유 선택
- ✅ **Python ML 생태계** — PyTorch 모델 학습 → ONNX export → 즉시 활용
- ✅ **Decoupling** — 임베딩 모델 변경 시 recommendation 서비스 (Kotlin) 영향 없음
- ✅ **GPU 지원** — 향후 대규모 vector 검색 시 GPU 가속 가능

## Architecture

```
recommendation 서비스 (Kotlin, port 8092)
   ↓ REST POST /search { user_id, country, device, k }
recommendation-ann 서비스 (Python FastAPI, port 8000)
   ├─ user_tower.onnx     ← ONNX Runtime 으로 user_id → user_embedding 추론
   ├─ item_embeddings.npy ← 사전 계산된 item embedding (NumPy)
   └─ FAISS HNSW index    ← in-memory 색인 (M=16, ef_construction=200, ef_search=100)
   ↓ 응답 { item_ids, scores }
recommendation 서비스
   ↓ Top-K 후보 → GetPersonalizedUseCase → Cold-start fallback → 응답
```

## Alternatives Considered

### B. ES knn (native)
- ✅ 기존 ES 인프라 활용 (search 서비스)
- ✅ Hybrid Search (BM25 + dense) 자연
- ❌ HNSW 만 지원 (FAISS 의 IVFPQ 같은 메모리 압축 옵션 부재)
- ❌ search 서비스의 인덱스 부담 증가
- → Hybrid Search 통합 명확한 가치 있을 때 (Phase 4+) 재고

### C. Qdrant
- ✅ Rust 기반 매우 빠름, 풍부한 filtering
- ❌ 신규 인프라 추가 (Helm chart + StatefulSet + 운영 부담)
- → ES 한계 부딪힐 때 (Phase 5+) 검토

### D. ONNX Runtime + DJL (Kotlin 내장)
- ✅ 네트워크 hop 없음, latency 최저
- ❌ Kotlin 의 ML 생태계 약함 (FAISS Java binding 미성숙)
- ❌ 모델 업데이트 시 Kotlin pod 재배포
- → Latency 매우 critical 한 use case (단일 자릿수 ms) 에만

## Consequences

### 긍정
- Python ML 생태계 100% 활용 — PyTorch / ONNX / FAISS / NumPy
- 모델 변경이 recommendation 서비스 (Kotlin) 영향 없음
- recommendation-ann 의 메모리/CPU 독립 스케일링
- Reindex (모델 재학습 후 인덱스 재빌드) 가 atomic swap

### 부정
- 두 서비스 운영 (Kotlin + Python)
- 네트워크 hop 추가 (1-2ms latency)
- 인증/모니터링 분리

### 리스크 완화
- recommendation-ann 의 health/readiness probe 필수 (FAISS 인덱스 load 시간 길음)
- 모델/인덱스 파일은 PVC 또는 ConfigMap (작은 경우) 으로 마운트
- Cold-start fallback chain (§17) 이 recommendation-ann 장애 시 안전망

## Implementation

Phase 3 plan: `docs/plans/2026-05-12-recommendation-phase3.md`

핵심 컴포넌트:
1. PyTorch 모델 학습 (MovieLens-1M 또는 실 데이터)
2. ONNX export — `user_tower.onnx`
3. Item embedding 사전 계산 — `item_embeddings.npy`
4. recommendation-ann Python 서비스 (FastAPI + FAISS HNSW + ONNX Runtime)
5. EmbeddingAnnRestClient (Kotlin) + GetPersonalizedUseCase
6. K8s Deployment + Service + PVC (model storage)

## References

- 학습 노트: `study/docs/20-recommendation-modeling/10-ann-faiss-hnsw.md`, `13-paper-two-tower.md`, `24-msa-two-tower-ann.md`
- 함께: ADR-0044 (도입 단계), ADR-0045 (데이터 파이프라인)
- Plan: `docs/plans/2026-05-12-recommendation-phase3.md`
