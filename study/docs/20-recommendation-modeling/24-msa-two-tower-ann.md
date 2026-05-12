---
parent: 20-recommendation-modeling
seq: 24
title: Phase 3 구현 — Two-Tower retrieval, ONNX export, FAISS sidecar, personalized API
type: deep
created: 2026-05-12
---

# 24. Phase 3 — Two-Tower ANN 서빙

> **Phase 10 - Phase 3, 최종 단계**. §13 Two-Tower + §10 FAISS ANN + §16 toy training 의 production 화. Python 학습 + ONNX export + Python sidecar (recommendation-ann) 서빙.

---

## 1. 구현 범위

```
Spark CF (Phase 2) → user/item embedding 학습 데이터 준비
   ↓
Python Two-Tower 학습 (PyTorch/TF)
   ↓
ONNX export (모델 + item embeddings)
   ↓
recommendation-ann (Python FastAPI + FAISS)
   ↓
gRPC ← recommendation 서비스 (Kotlin)
   ↓
GET /api/v1/recommendations/personalized
```

---

## 2. Two-Tower 학습 — Python (PyTorch)

### 2-1. 모델 정의 (§13 §5-1 의 production 버전)

```python
# recommendation-ml/two_tower/model.py
import torch
import torch.nn as nn

class UserTower(nn.Module):
    def __init__(self, vocab_sizes: dict, embedding_dim: int = 128):
        super().__init__()
        self.user_emb = nn.Embedding(vocab_sizes['user'], 64)
        self.country_emb = nn.Embedding(vocab_sizes['country'], 16)
        self.device_emb = nn.Embedding(vocab_sizes['device'], 8)
        
        self.mlp = nn.Sequential(
            nn.Linear(64 + 16 + 8 + 8, 256),  # +8 for dense features
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, embedding_dim),
        )
    
    def forward(self, user_id, country, device, dense_features):
        x = torch.cat([
            self.user_emb(user_id),
            self.country_emb(country),
            self.device_emb(device),
            dense_features,
        ], dim=-1)
        return torch.nn.functional.normalize(self.mlp(x), dim=-1)


class ItemTower(nn.Module):
    def __init__(self, vocab_sizes: dict, content_dim: int = 768, embedding_dim: int = 128):
        super().__init__()
        self.item_emb = nn.Embedding(vocab_sizes['item'], 64)
        self.category_emb = nn.Embedding(vocab_sizes['category'], 16)
        self.content_proj = nn.Linear(content_dim, 64)  # Sentence-BERT (§09) input
        
        self.mlp = nn.Sequential(
            nn.Linear(64 + 16 + 64, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, embedding_dim),
        )
    
    def forward(self, item_id, category_id, content_embedding):
        x = torch.cat([
            self.item_emb(item_id),
            self.category_emb(category_id),
            self.content_proj(content_embedding),
        ], dim=-1)
        return torch.nn.functional.normalize(self.mlp(x), dim=-1)


class TwoTower(nn.Module):
    def __init__(self, user_tower, item_tower):
        super().__init__()
        self.user_tower = user_tower
        self.item_tower = item_tower
    
    def forward(self, user_inputs, item_inputs):
        u = self.user_tower(**user_inputs)
        v = self.item_tower(**item_inputs)
        return (u * v).sum(dim=-1)
```

### 2-2. 학습 데이터 준비

```python
# ClickHouse 에서 학습 데이터 추출
# (user_id, item_id, label=1 for click_or_purchase)

import pandas as pd

actions_df = pd.read_sql("""
    SELECT user_id, item_id, 
           if(action_type='reservation', 5.0, 
              if(action_type='click', 1.0, 0.0)) AS weight
    FROM recommendation_events
    WHERE timestamp >= now() - INTERVAL 60 DAY
      AND action_type IN ('click', 'reservation')
""", connection)
```

### 2-3. 학습 with Sampling Bias Correction (§13 §3-4)

```python
def train_two_tower(model, train_loader, items_loader, epochs=20):
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    
    # Item popularity 추정 (sampling bias correction 용)
    item_freq = compute_item_frequency(train_data)
    
    for epoch in range(epochs):
        for batch in train_loader:
            user_inputs = batch['user_inputs']
            item_inputs = batch['item_inputs']
            item_ids = batch['item_id']
            
            u = model.user_tower(**user_inputs)  # (B, D)
            v = model.item_tower(**item_inputs)  # (B, D)
            
            # In-batch scores
            scores = u @ v.T  # (B, B)
            
            # Sampling bias correction (Yi et al. 2019)
            log_p = torch.log(item_freq[item_ids] + 1e-6)
            scores = scores - log_p.unsqueeze(0)
            
            # Cross-entropy with diagonal as positive
            labels = torch.arange(scores.size(0))
            loss = nn.CrossEntropyLoss()(scores, labels)
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
```

### 2-4. ONNX Export

```python
import torch.onnx

# User tower export
dummy_user_input = {
    'user_id': torch.tensor([1]),
    'country': torch.tensor([0]),
    'device': torch.tensor([0]),
    'dense_features': torch.randn(1, 8),
}
torch.onnx.export(
    model.user_tower,
    tuple(dummy_user_input.values()),
    "user_tower.onnx",
    input_names=list(dummy_user_input.keys()),
    output_names=['user_embedding'],
    dynamic_axes={'user_id': {0: 'batch'}, 'user_embedding': {0: 'batch'}},
)

# Item tower export
dummy_item_input = {
    'item_id': torch.tensor([1]),
    'category_id': torch.tensor([0]),
    'content_embedding': torch.randn(1, 768),
}
torch.onnx.export(
    model.item_tower,
    tuple(dummy_item_input.values()),
    "item_tower.onnx",
    input_names=list(dummy_item_input.keys()),
    output_names=['item_embedding'],
    dynamic_axes={'item_id': {0: 'batch'}, 'item_embedding': {0: 'batch'}},
)

# 모든 item embedding 사전 계산
model.eval()
with torch.no_grad():
    all_item_embeddings = []
    for batch in items_loader:
        emb = model.item_tower(**batch).numpy()
        all_item_embeddings.append(emb)
    item_embeddings = np.concatenate(all_item_embeddings)

np.save("item_embeddings.npy", item_embeddings)
```

---

## 3. recommendation-ann — Python FastAPI + FAISS

ADR-XXXX-3 (§20) 의 결정에 따라 Python sidecar.

### 3-1. 모델 로드 + FAISS 색인

```python
# recommendation-ann/app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import onnxruntime as ort
import faiss

app = FastAPI()

# Models load (startup)
user_tower_session = ort.InferenceSession("user_tower.onnx")
item_embeddings = np.load("item_embeddings.npy")  # shape (N, 128)
item_ids = np.load("item_ids.npy")  # shape (N,)

# FAISS HNSW index (§10)
index = faiss.IndexHNSWFlat(128, M=16)
index.hnsw.efConstruction = 200
index.add(item_embeddings.astype('float32'))


class SearchRequest(BaseModel):
    user_id: int
    country_id: int = 0
    device_id: int = 0
    dense_features: list = None
    k: int = 100


class SearchResponse(BaseModel):
    item_ids: list
    scores: list


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    # User tower inference
    dense = req.dense_features or [0.0] * 8
    user_emb = user_tower_session.run(
        ['user_embedding'],
        {
            'user_id': np.array([req.user_id], dtype=np.int64),
            'country': np.array([req.country_id], dtype=np.int64),
            'device': np.array([req.device_id], dtype=np.int64),
            'dense_features': np.array([dense], dtype=np.float32),
        }
    )[0]
    
    # FAISS ANN search
    index.hnsw.efSearch = 100
    distances, indices = index.search(user_emb.astype('float32'), req.k)
    
    matched_item_ids = item_ids[indices[0]].tolist()
    scores = distances[0].tolist()
    
    return SearchResponse(item_ids=matched_item_ids, scores=scores)


@app.post("/reindex")
def reindex():
    """ANN 인덱스 재빌드 (일일 모델 재학습 후 호출)"""
    global index, item_embeddings, item_ids
    
    item_embeddings = np.load("item_embeddings.npy")
    item_ids = np.load("item_ids.npy")
    
    new_index = faiss.IndexHNSWFlat(128, M=16)
    new_index.hnsw.efConstruction = 200
    new_index.add(item_embeddings.astype('float32'))
    
    index = new_index  # atomic swap
    return {"status": "ok", "n_items": len(item_ids)}
```

### 3-2. K8s 배포

```yaml
# k8s/overlays/prod-k8s/recommendation/recommendation-ann.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: recommendation-ann
spec:
  replicas: 2
  selector:
    matchLabels:
      app: recommendation-ann
  template:
    metadata:
      labels:
        app: recommendation-ann
    spec:
      containers:
        - name: ann
          image: gcr.io/kgd/recommendation-ann:1.0.0
          ports:
            - containerPort: 8000
          resources:
            requests:
              cpu: 2
              memory: 8Gi
            limits:
              cpu: 4
              memory: 16Gi
          volumeMounts:
            - mountPath: /models
              name: models-pvc
      volumes:
        - name: models-pvc
          persistentVolumeClaim:
            claimName: recommendation-models
---
apiVersion: v1
kind: Service
metadata:
  name: recommendation-ann
spec:
  selector:
    app: recommendation-ann
  ports:
    - port: 8000
```

---

## 4. recommendation 서비스의 Adapter

```kotlin
// recommendation/app/.../infrastructure/client/EmbeddingAnnRestClient.kt
@Component
class EmbeddingAnnRestClient(
    @Value("\${recommendation-ann.url}") private val annUrl: String,
    private val restTemplate: RestTemplate,
) : EmbeddingAnnPort {
    
    override fun retrieveCandidates(userEmbedding: FloatArray, k: Int): List<RecommendationItem> {
        // (이 메서드는 사용 안 함 — Python 측이 user tower 호출까지 함)
        throw UnsupportedOperationException()
    }
    
    override fun lookupUserEmbedding(userId: Long): FloatArray? {
        // recommendation-ann 에 user_id + context 만 보내고 user_tower forward 까지 위임
        return null
    }
    
    fun search(userId: Long, country: Int, device: Int, k: Int): List<RecommendationItem> {
        val request = mapOf(
            "user_id" to userId,
            "country_id" to country,
            "device_id" to device,
            "k" to k,
        )
        val response = restTemplate.postForObject<SearchResponse>(
            "$annUrl/search", request, SearchResponse::class.java
        )
        
        return response.itemIds.zip(response.scores).map { (itemId, score) ->
            RecommendationItem(
                itemId = itemId,
                score = score.toDouble(),
                source = "two-tower-ann",
            )
        }
    }
}

data class SearchResponse(val itemIds: List<Long>, val scores: List<Double>)
```

---

## 5. Use Case + Controller

```kotlin
// application/usecase/GetPersonalizedUseCase.kt
@UseCase
class GetPersonalizedUseCase(
    private val annClient: EmbeddingAnnRestClient,
    private val categoryBestUseCase: GetCategoryBestUseCase,
    private val userMetadataPort: UserMetadataPort,
) {
    fun execute(userId: Long, limit: Int): Recommendation {
        val user = userMetadataPort.getUser(userId)
        
        // Cold-start: 신규 사용자 (행동 0) → demographic-based CB (§17)
        if (user.actionCount < 5) {
            return categoryBestUseCase.execute(
                cityId = user.preferredCityId ?: 1,
                categoryId = user.preferredCategoryId ?: 1,
                limit = limit,
            ).copy(type = RecommendationType.PERSONALIZED, userId = userId)
        }
        
        // Active user: Two-Tower retrieval
        val items = annClient.search(
            userId = userId,
            country = user.countryId,
            device = user.deviceId,
            k = limit,
        )
        
        return Recommendation(
            type = RecommendationType.PERSONALIZED,
            userId = userId,
            context = RecommendationContext(null, null, null),
            items = items,
            generatedAt = Instant.now(),
        )
    }
}

// presentation/RecommendationController.kt 확장
@GetMapping("/personalized")
fun personalized(
    @RequestParam userId: Long,
    @RequestParam(defaultValue = "20") limit: Int,
): ApiResponse<RecommendationDto> {
    val result = getPersonalized.execute(userId, limit)
    return ApiResponse.ok(result.toDto())
}
```

---

## 6. 일일 재학습 파이프라인

```yaml
# Argo Workflow: 일일 Two-Tower 재학습
apiVersion: argoproj.io/v1alpha1
kind: CronWorkflow
metadata:
  name: recommendation-two-tower-daily
spec:
  schedule: "0 3 * * *"
  workflowSpec:
    entrypoint: pipeline
    templates:
      - name: pipeline
        steps:
          - - name: prepare-data
              template: spark-data-prep
          - - name: train-model
              template: pytorch-training
          - - name: export-onnx
              template: onnx-export
          - - name: reindex-ann
              template: ann-reindex
      
      - name: pytorch-training
        container:
          image: gcr.io/kgd/recommendation-ml:1.0.0
          command: [python, /opt/train.py]
          resources:
            requests: { nvidia.com/gpu: 1, memory: 16Gi }
          
      - name: ann-reindex
        container:
          image: curlimages/curl:latest
          command: [sh, -c]
          args:
            - "curl -X POST http://recommendation-ann:8000/reindex"
```

---

## 7. 성능 / SLA

```
학습 시간 (일일):
   Spark data prep: ~30 min
   PyTorch training (1 GPU, 20 epochs): ~2 hours
   ONNX export: ~5 min
   ANN reindex: ~3 min

API latency:
   User Tower forward (Python ONNX): ~5 ms
   FAISS HNSW search (1억 items, k=100): ~5 ms
   Network hop (Kotlin → Python): ~2 ms
   Total: ~12 ms (P99 < 30 ms)
```

---

## 8. 모니터링

핵심 메트릭:
- `recommendation_ann_search_latency` (histogram)
- `recommendation_two_tower_recall_at_100` (daily, offline)
- `recommendation_personalized_ctr` (online, A/B)
- `recommendation_personalized_cold_start_rate` (CB fallback 비율)

---

## 9. 점진 도입 체크리스트 (Phase 3)

- [ ] Python 학습 환경 (PyTorch + GPU)
- [ ] Two-Tower 모델 구현 + 학습
- [ ] Sampling bias correction
- [ ] ONNX export
- [ ] recommendation-ann Python 서비스 (FastAPI + FAISS)
- [ ] K8s Deployment + PV (model storage)
- [ ] `EmbeddingAnnRestClient` adapter
- [ ] `GetPersonalizedUseCase` + cold-start fallback
- [ ] GET /api/v1/recommendations/personalized
- [ ] Argo daily retraining workflow
- [ ] CB / CF / Personalized A/B 비교

---

## 10. cross-ref

| 주제 | 연결된 study |
|---|---|
| Two-Tower 논문 | §13 |
| ANN (FAISS / HNSW) | §10 |
| Toy training | §16 |
| Sentence-BERT 임베딩 | §09 |
| Cold-start fallback | §17 |
| ADR ANN 인덱스 선택 | §20 |
| Phase 1 (CB), Phase 2 (CF) | §22, §23 |
| 다음: Gateway + A/B | §25 |
