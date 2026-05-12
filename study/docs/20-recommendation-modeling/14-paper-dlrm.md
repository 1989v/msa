---
parent: 20-recommendation-modeling
seq: 14
title: DLRM — Deep Learning Recommendation Model (Naumov et al., Meta 2019) — Ranking 표준
type: deep
created: 2026-05-12
---

# 14. Paper 3 — DLRM (Meta 2019)

> **Phase 6 - Ranking 모델 표준**. Naumov et al., "Deep Learning Recommendation Model for Personalization and Recommendation Systems", arXiv 2019. Meta (Facebook/Instagram) 의 ad ranking 산업 사례.

논문: https://arxiv.org/abs/1906.00091

---

## 1. 핵심 통찰 — Sparse + Dense Feature 의 명시적 분리

### 1-1. 추천 시스템 feature 의 두 종류

```
Sparse (Categorical) features:
   user_id, item_id, country, device, category, ...
   → 매우 큰 vocabulary (수백만)
   → embedding table lookup 필요

Dense (Numerical) features:
   age, price, time_of_day, click_count, ...
   → 연속값
   → 그대로 사용 가능
```

기존 모델 (Wide & Deep) 도 두 타입 다루지만 **암묵적**. DLRM 은 둘을 **명시적으로 분리하는 아키텍처**.

### 1-2. DLRM 의 3-stage 구조

```
1. Bottom MLP for dense features
2. Embedding for sparse features
3. Feature Interaction (pairwise dot product)
4. Top MLP
```

이 구조가 **현대 ranking 모델의 산업 표준** 이 됨. 후속 모델 (DCN-v2, AutoInt 등) 모두 변형.

---

## 2. 모델 구조 상세

### 2-1. 전체 아키텍처

```
Dense Features                     Sparse Features
(age, price, time, ...)            (user_id, item_id, category, ...)
   │                                   │ (각각 embedding lookup)
   ↓                                   ↓
Bottom MLP                         Embedding Tables
(transform dense → dense_vec)      (각 sparse → embedding_vec)
   │                                   │
   └────────┬──────────────────────────┘
            ↓
   [dense_vec, emb_1, emb_2, ..., emb_n] ← list of vectors
            ↓
   Feature Interaction
   (pairwise dot product: dot(v_i, v_j) for all i,j)
            ↓
   [dense_vec, dot products, ...] ← concat
            ↓
   Top MLP
            ↓
   sigmoid → P(click | user, item)
```

### 2-2. Bottom MLP (Dense Features)

```python
bottom_mlp = Sequential([
    Dense(512, ReLU),
    Dense(256, ReLU),
    Dense(64, ReLU),  # 출력 차원 = embedding 차원과 같게 (interaction 위해)
])

dense_vec = bottom_mlp(dense_features)  # shape (batch, 64)
```

**핵심**: dense feature 의 출력 차원 = sparse embedding 차원 → 다음 stage 의 interaction 에서 동일하게 처리.

### 2-3. Embedding Tables (Sparse Features)

```python
embedding_tables = {
    'user_id': Embedding(num_users, 64),
    'item_id': Embedding(num_items, 64),
    'category': Embedding(num_categories, 64),
    ...
}

embeddings = [embedding_tables[name](sparse_features[name]) for name in feature_names]
# 각 embedding shape: (batch, 64)
```

**규모**: Meta 에서 user_id vocab ~수억, item_id vocab ~수십억 → embedding table 만 TB 단위. **Model parallelism + Data parallelism 결합** 필요.

### 2-4. Feature Interaction — Pairwise Dot Product

```
vectors = [dense_vec, emb_1, emb_2, ..., emb_n]  # n+1 vectors

interaction = []
for i in range(n+1):
    for j in range(i+1, n+1):
        interaction.append(dot(vectors[i], vectors[j]))

# shape: (batch, (n+1) × n / 2)  ← pairwise 개수
```

**핵심 관찰**: FM (Factorization Machine, Rendle 2010) 의 정신과 동일. **모든 feature pair 의 interaction 을 dot product** 로 표현.

Wide & Deep 의 cross product (수동) vs DLRM 의 dot product (자동, 학습 가능) → DLRM 이 우월.

### 2-5. Top MLP

```python
top_mlp = Sequential([
    Dense(512, ReLU),
    Dense(256, ReLU),
    Dense(1, Sigmoid),  # P(click)
])

input_to_top = concat([dense_vec, interaction])
score = top_mlp(input_to_top)
```

### 2-6. Loss

```
Loss = BCE (Binary Cross-Entropy)
   y: click (0 or 1)
   p: model output
   L = -y log(p) - (1-y) log(1-p)
```

---

## 3. DLRM 의 산업 가치 — Scalability

### 3-1. Meta 의 규모

- **30억 사용자**
- **수백억 광고**
- **하루 수십억 inference**

이 규모에서 학습/서빙 가능한 모델이 DLRM. 논문의 주된 기여는 알고리즘 자체보다 **분산 학습 시스템**.

### 3-2. Model Parallelism + Data Parallelism

```
Embedding Tables: 너무 커서 한 머신에 안 들어감 (TB)
   → Model Parallelism: 각 머신이 일부 embedding table 만 저장
   → 학습 시 feature 별로 해당 머신에 forward/backward
   
MLP weights: 작음 (MB)
   → Data Parallelism: 모든 머신에 복제
   → 배치 분할 학습
```

**결과**: 100~1000 GPU 동시 학습 가능.

### 3-3. Inference Optimization

- **Embedding lookup**: 매우 sparse → embedding table 의 row 단위 read
- **MLP forward**: GPU 의 GEMM (General Matrix Multiplication)
- **Pairwise interaction**: 벡터화된 dot product

Meta 의 ad serving: ~10ms latency per request, 수십억 QPS.

---

## 4. DLRM vs Wide & Deep 비교

| 축 | Wide & Deep (§12) | DLRM (§14) |
|---|---|---|
| **Cross feature** | Manual (Wide part) | 자동 (pairwise dot product) |
| **Sparse 처리** | Embedding + concat | Embedding + interaction |
| **Dense 처리** | Concat with embedding | **별도 Bottom MLP** |
| **표현력** | Wide 의 manual cross 에 한계 | 모든 pair interaction 자동 |
| **계산 비용** | 작음 | 큼 (pairwise = O(n²)) |
| **산업 적용** | Google Play 2016 | Meta (Facebook/Instagram) 2019 |
| **현재 표준** | 입문 / 단순 케이스 | **대규모 ranking 의 표준** |

### 4-1. DLRM 이 우월한 시나리오

- ✅ 많은 sparse feature (10+)
- ✅ 모든 pair 의 interaction 가치 있을 때
- ✅ 대규모 (수억 사용자, 수십억 item)
- ✅ Meta-scale 인프라

### 4-2. Wide & Deep 이 적합한 시나리오

- ✅ Domain knowledge 로 의미 있는 cross 만 선정 가능 (적은 수)
- ✅ 적은 sparse feature (≤ 10)
- ✅ 인프라 단순화 우선
- ✅ Interpretability 필요

---

## 5. 구현 패턴 — PyTorch

### 5-1. DLRM 모델 정의

```python
import torch
import torch.nn as nn

class DLRM(nn.Module):
    def __init__(
        self,
        dense_feature_dim: int,
        sparse_feature_sizes: list,  # [num_categories per feature]
        embedding_dim: int = 64,
        bottom_mlp_dims: list = [512, 256, 64],
        top_mlp_dims: list = [512, 256, 1],
    ):
        super().__init__()
        
        # Bottom MLP for dense features
        bottom_layers = []
        in_dim = dense_feature_dim
        for out_dim in bottom_mlp_dims:
            bottom_layers.append(nn.Linear(in_dim, out_dim))
            bottom_layers.append(nn.ReLU())
            in_dim = out_dim
        self.bottom_mlp = nn.Sequential(*bottom_layers[:-1])  # 마지막 ReLU 제거
        
        # Embedding tables
        self.embeddings = nn.ModuleList([
            nn.Embedding(vocab_size, embedding_dim)
            for vocab_size in sparse_feature_sizes
        ])
        
        # Top MLP
        n_features = len(sparse_feature_sizes) + 1  # +1 for dense_vec
        interaction_dim = (n_features * (n_features - 1)) // 2
        top_input_dim = embedding_dim + interaction_dim
        
        top_layers = []
        in_dim = top_input_dim
        for out_dim in top_mlp_dims:
            top_layers.append(nn.Linear(in_dim, out_dim))
            top_layers.append(nn.ReLU())
            in_dim = out_dim
        self.top_mlp = nn.Sequential(*top_layers[:-1])
        self.sigmoid = nn.Sigmoid()
    
    def forward(self, dense_features, sparse_features):
        # Dense features → dense_vec
        dense_vec = self.bottom_mlp(dense_features)  # (B, embedding_dim)
        
        # Sparse features → embeddings
        embeddings = [
            self.embeddings[i](sparse_features[:, i])
            for i in range(len(self.embeddings))
        ]
        
        # Stack all vectors: [dense_vec, emb_1, ..., emb_n]
        vectors = torch.stack([dense_vec] + embeddings, dim=1)  # (B, n+1, dim)
        
        # Pairwise dot product
        interaction = torch.bmm(vectors, vectors.transpose(1, 2))  # (B, n+1, n+1)
        
        # Take upper triangle (i < j)
        idx = torch.triu_indices(vectors.size(1), vectors.size(1), offset=1)
        interaction_flat = interaction[:, idx[0], idx[1]]  # (B, n+1 choose 2)
        
        # Concat with dense_vec
        top_input = torch.cat([dense_vec, interaction_flat], dim=1)
        
        # Top MLP
        score = self.top_mlp(top_input)
        return self.sigmoid(score).squeeze(-1)

# 사용
model = DLRM(
    dense_feature_dim=13,
    sparse_feature_sizes=[100000, 50000, 100, 200, 1000],  # 5 sparse features
    embedding_dim=64,
)
```

### 5-2. 학습 루프

```python
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.BCELoss()

for epoch in range(10):
    for batch in train_loader:
        dense, sparse, labels = batch
        
        optimizer.zero_grad()
        scores = model(dense, sparse)
        loss = criterion(scores, labels.float())
        loss.backward()
        optimizer.step()
```

---

## 6. DLRM 의 후속 모델

### 6-1. DCN-v2 (Google 2020)

DLRM 의 pairwise interaction 을 **explicit cross network** 로 발전:
```
x_{l+1} = x_0 * (W_l x_l + b_l) + x_l
```

다항식 형태의 명시적 cross. DLRM 보다 표현력 약간 우월.

### 6-2. AutoInt (Song et al. 2019)

DLRM 의 pairwise dot product 를 **multi-head self-attention** 으로 일반화. feature interaction 의 weight 자체를 학습.

### 6-3. Meta DHEN (2022)

DLRM 후속. Heterogeneous interaction module 로 더 복잡한 cross 학습.

---

## 7. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "DLRM 의 pairwise interaction 이 무조건 우월" | n features 면 O(n²) 계산. n=100+ 면 expensive. AutoInt 같은 attention 으로 개선 가능. |
| 2 | "Embedding 차원 모두 동일해야" | Bottom MLP 출력과 embedding 차원만 일치하면 OK. Sparse feature 별로 다른 차원 가능. |
| 3 | "DLRM 만 알면 ranking 충분" | 진화 중. DCN-v2, AutoInt 가 후속. Domain 에 맞춰 선택. |
| 4 | "Embedding table 이 작아서 model parallelism 불필요" | Meta-scale 에서 TB 단위. 일반 산업도 GB 단위 → 분산 학습 필수. |
| 5 | "BCE loss 만 사용" | Ranking 에는 pairwise loss (BPR) 또는 listwise (LambdaRank) 가 더 적합할 때 있음. |
| 6 | "DLRM 이 Two-Tower 의 retrieval 도 대체" | DLRM 의 non-separable score → ANN 불가. Retrieval 은 Two-Tower, Ranking 은 DLRM. |
| 7 | "Sparse + Dense 분리 없이 한 MLP 로 처리" | Embedding 의 sparsity 와 dense 의 numeric scale 다름. 별도 처리가 학습 안정성 ↑. |

---

## 8. 꼬리 질문 (§26 면접 카드 후보)

1. **DLRM 의 Sparse + Dense 분리가 우월한 이유는?**
   - 답: Sparse (categorical, embedding) 와 Dense (numerical) 의 학습 dynamics 가 다름. Sparse 는 embedding lookup + sparse gradient. Dense 는 그대로 + dense gradient. 별도 Bottom MLP 로 dense 를 dense_vec (embedding 차원과 동일) 으로 변환 → 통합 interaction 가능.

2. **DLRM 의 pairwise dot product interaction 이 Wide & Deep 의 cross 보다 우월한 이유는?**
   - 답: Wide & Deep 의 cross 는 manual. 도메인 지식으로 의미 있는 pair 선정. DLRM 은 모든 pair 의 interaction 자동 (학습 가능). 더 풍부한 표현력. 단점은 O(n²) 계산.

3. **Meta 가 DLRM 을 위해 model parallelism 을 도입한 이유는?**
   - 답: Embedding table 이 너무 큼 (TB 단위). 한 머신/GPU 의 메모리에 안 들어감. Model parallelism — 각 머신이 일부 embedding table 만 저장. Data parallelism (MLP weights) 과 결합. 100~1000 GPU 동시 학습.

4. **DLRM 이 retrieval (Two-Tower) 을 대체하지 못하는 이유는?**
   - 답: DLRM 의 score = MLP(pairwise interaction(...)) → user 와 item 의 feature 가 섞임 → non-separable. 모든 (user, item) pair 에 inference 필요 → 수십억 item 에서 retrieval 불가. Two-Tower 의 dot product 만 ANN 가능.

5. **DLRM 의 후속 모델 (DCN-v2, AutoInt) 의 발전 방향은?**
   - 답: DLRM 의 pairwise dot product 의 limitation → 더 정교한 interaction. DCN-v2 — explicit polynomial cross. AutoInt — multi-head self-attention 으로 interaction weight 학습. 둘 다 DLRM 보다 표현력 약간 우월 + 도메인에 따라 다른 적합.

---

## 9. cross-ref

| 주제 | 연결된 study |
|---|---|
| Two-stage retrieval | §01 §4 (DLRM 은 Stage 2 ranking) |
| Wide & Deep | §12 (DLRM 의 선조) |
| Two-Tower | §13 (Funnel 의 다른 stage) |
| MF / FM | §03 (DLRM 의 pairwise = FM 정신) |
| Embedding | §09 (DLRM 의 sparse feature 처리) |
| Toy training | §16 (DLRM 직접 구현) |
| Negative sampling | §02 §9-4 |
| msa ranking 도입 | Phase 10 §24 (향후 Phase 4 ADR 후보) |
