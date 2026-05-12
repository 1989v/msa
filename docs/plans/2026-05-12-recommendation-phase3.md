# Plan — Recommendation 서비스 Phase 3 (Two-Tower retrieval + FAISS sidecar)

> 작성: 2026-05-12
> 범위: PoC — 작은 Two-Tower 모델 + recommendation-ann Python 서비스 + personalized API
> 학습 근거: §13 (Two-Tower) + §10 (FAISS) + §16 (toy training) + §24 (msa 구현)
> 선행: ADR-0044 (도입 단계), ADR-0046 (ANN 선택)

---

## 1. 목표 — PoC 수준 검증

Phase 3 의 production 화는 충분한 사용자 행동 데이터 (수백만+ events) 와 PyTorch GPU 학습 인프라 + 일일 재학습 파이프라인이 필요. 본 PoC 는 **인프라 + 흐름 검증** 에 집중.

### 1-1. 산출물

1. PyTorch Two-Tower 모델 학습 script (CPU, mock 데이터)
2. ONNX export — `user_tower.onnx`
3. Item embedding 사전 계산 — `item_embeddings.npy`
4. recommendation-ann Python FastAPI 서비스
5. EmbeddingAnnRestClient (Kotlin) + GetPersonalizedUseCase
6. K8s Deployment + Service + 모델 mount
7. `GET /api/v1/recommendations/personalized?userId=&limit=`

### 1-2. PoC 단순화

- Mock seed 데이터 (3000 events, 5 users) → 의미 있는 embedding 아닐 수 있음. 인프라/흐름 검증만.
- 모델 학습 1-2 epoch (CPU 환경, 수십 초)
- Item embedding dim = 64 (메모리 절약)
- FAISS HNSW (M=16, ef_construction=200, ef_search=100)
- 일일 재학습 파이프라인 미구현 — 수동 trigger 만

### 1-3. 학습 → 구현 매핑

| 학습 노트 | 적용 |
|---|---|
| §13 §5-1 PyTorch Two-Tower | `train_two_tower.py` |
| §13 §3-4 Sampling bias correction | learning loss 의 logit correction |
| §10 §3 HNSW 파라미터 | FAISS HNSW config |
| §24 §3 recommendation-ann | Python FastAPI 코드 |
| §24 §4 EmbeddingAnnRestClient | Kotlin REST adapter |
| §17 §3-2 cold-start | 비로그인 / 신규 사용자 → CB fallback |

---

## 2. 구현 단계

### Phase 3-A. Domain (0.5h)
- `EmbeddingAnnPort` interface
- `UserMetadataPort` (cityId/categoryId for cold-start fallback)
- ItemMetadata 의 user 버전 추가

### Phase 3-B. Python 모델 학습 (1.5h)
- `recommendation-ml/` (별도 디렉토리, msa 본 레포 안)
- `train_two_tower.py` — PyTorch Two-Tower 학습 + ONNX export
- `requirements.txt` — torch / onnx / scikit-learn
- Dockerfile 추가 (학습 결과를 PVC 또는 ConfigMap 으로 출력)

### Phase 3-C. recommendation-ann 서비스 (2h)
- `recommendation-ann/` (Python FastAPI)
- `app.py` — POST /search + /reindex + /health
- ONNX Runtime + FAISS HNSW
- Dockerfile + K8s Deployment
- 모델 파일 mount (ConfigMap binary 또는 PVC)

### Phase 3-D. Kotlin 통합 (1h)
- `EmbeddingAnnRestClient` (Kotlin)
- `GetPersonalizedUseCase` — cold-start fallback to CB
- `RecommendationController` /personalized endpoint
- ItemMetadataPort 의 user 버전

### Phase 3-E. K8s + 검증 (1h)
- recommendation-ann Deployment + Service
- NetworkPolicy: recommendation → recommendation-ann
- 모델 파일 import 방식 (PVC, ConfigMap, hostPath)
- curl 으로 personalized API 검증

**예상 총 시간**: 6h

---

## 3. 단순화된 모델 학습

mock 데이터 한계:
- 5 users × ~120 items = 충분치 않음
- 학습된 embedding 이 거의 random 일 가능성

→ 학습 자체보다 **파이프라인 검증** 이 목적. Recall@K 같은 정성 평가는 Phase 3.5 에서.

### 3-1. 모델 구조 (학습 §13)

```python
class UserTower(nn.Module):
    user_emb = Embedding(N_USERS, 32)
    mlp = MLP([32, 64, 64])  # 출력 64-dim

class ItemTower(nn.Module):
    item_emb = Embedding(N_ITEMS, 32)
    mlp = MLP([32, 64, 64])

forward: score = (user_vec · item_vec).sum(-1)
loss: in-batch CrossEntropy (positive=diagonal)
```

### 3-2. ONNX Export

```python
torch.onnx.export(model.user_tower, dummy_user_id, "user_tower.onnx",
                  input_names=['user_id'], output_names=['user_embedding'],
                  dynamic_axes={'user_id': {0: 'batch'}})

# Item embeddings 사전 계산 후 numpy 저장
np.save('item_embeddings.npy', item_embeddings)
np.save('item_ids.npy', item_ids)
```

---

## 4. recommendation-ann FastAPI 서비스

```python
@app.post("/search")
def search(req: SearchRequest):
    user_emb = user_tower_onnx.run(['user_embedding'],
        {'user_id': np.array([req.user_id], dtype=np.int64)})[0]
    distances, indices = index.search(user_emb.astype('float32'), req.k)
    return SearchResponse(
        item_ids=item_ids[indices[0]].tolist(),
        scores=distances[0].tolist(),
    )

@app.post("/reindex")
def reindex():
    # 모델/임베딩 재로드 + 인덱스 재빌드 + atomic swap
```

K8s Deployment — port 8000, 2GB memory, health probe `/health`.

---

## 5. Kotlin Integration

```kotlin
@Component
class EmbeddingAnnRestClient(
    @Value("\${recommendation.ann.url}") private val annUrl: String,
) : EmbeddingAnnPort {
    fun search(userId: Long, k: Int): List<RecommendationItem> = ...
}

@UseCase
class GetPersonalizedUseCase(
    private val annClient: EmbeddingAnnPort,
    private val userMetadata: UserMetadataPort,
    private val categoryBest: GetCategoryBestUseCase,
) {
    fun execute(userId: Long, limit: Int): Recommendation {
        val items = annClient.search(userId, limit)
        if (items.isInsufficient(limit)) {
            // Cold-start fallback to CB
            ...
        }
        return Recommendation(...)
    }
}
```

REST API: `GET /api/v1/recommendations/personalized?userId=1&limit=10`

---

## 6. 리스크 + 한계

### 6-1. Mock 데이터 한계
- 5 users 만으로는 의미 있는 embedding 학습 불가
- recall/precision 측정 X
- **인프라 검증만 목적** — 실 데이터 적용은 Phase 3.5

### 6-2. K3s-lite 자원
- recommendation-ann 메모리 1-2GB (FAISS 인덱스 + ONNX runtime)
- 단일 노드에서 다른 서비스와 경쟁
- → resource limits 보수적 설정

### 6-3. 모델 파일 배포
- ONNX (~MB) + item_embeddings.npy (수 MB) 를 어떻게 mount?
- 옵션:
  - PVC (선호) — 별도 Job 으로 학습 후 동일 PVC mount
  - ConfigMap binaryData (작은 경우)
  - 컨테이너 이미지에 baked-in (재학습 시 이미지 재빌드)
- → PoC 는 **이미지 baked-in**, production 은 PVC

### 6-4. 일일 재학습 미구현
- Phase 3.5 에서 Argo Workflow 로 자동화
- 현재는 수동 trigger

---

## 7. 체크리스트

- [ ] Phase 3-A: EmbeddingAnnPort, UserMetadataPort
- [ ] Phase 3-B: recommendation-ml/train_two_tower.py + ONNX export
- [ ] Phase 3-C: recommendation-ann/app.py + Dockerfile + K8s manifest
- [ ] Phase 3-D: EmbeddingAnnRestClient + GetPersonalizedUseCase + Controller
- [ ] Phase 3-E: K8s 배포 + NetworkPolicy + curl 검증

---

## 8. Phase 3.5 (향후)

- 실 사용자 데이터로 모델 학습 (수십만+ events)
- Argo Workflow 일일 재학습 파이프라인
- PVC 기반 모델 배포 + atomic swap
- A/B 테스트 (Phase 1 CB / Phase 2 CF / Phase 3 Two-Tower 비교)
- Recall@K / NDCG offline metric 측정
- Sampling bias correction (Yi et al. 2019)

---

**상태**: Proposed (2026-05-12)
**선결**: ADR-0046 acceptance
**제약**: Mock 데이터 환경에서 인프라/흐름 검증 위주 PoC
