---
parent: 20-recommendation-modeling
seq: 15
title: TabTransformer — Tabular Data Modeling Using Contextual Embeddings (Huang et al., Amazon 2020)
type: deep
created: 2026-05-12
---

# 15. Paper 4 — TabTransformer (Amazon 2020)

> **Phase 6 - Transformer 의 정형 데이터 적용**. Huang et al., "TabTransformer: Tabular Data Modeling Using Contextual Embeddings", arXiv 2020. NLP 에서 검증된 Transformer 를 추천/분류의 정형 데이터에 적용.

논문: https://arxiv.org/abs/2012.06678

---

## 1. 핵심 통찰 — Contextual Embedding for Categorical Features

### 1-1. 기존 Embedding 의 한계

```
user_id → embedding (학습된 벡터)
country → embedding
device → embedding
   ↓ (concat)
MLP
```

각 categorical feature 의 embedding 이 **독립적**. 다른 feature 의 영향을 받지 않음.

**문제**: 사용자가 한국에서 모바일로 접속 vs 한국에서 데스크탑으로 접속 → embedding 동일 → 차이 학습 어려움.

### 1-2. Contextual Embedding 의 아이디어

NLP 의 BERT 가 단어 의미를 **문맥에 따라 다르게** 표현하듯, 추천에서도 categorical feature 의 의미를 **다른 feature 와의 관계** 에 따라 다르게 표현.

```
[user_id, country, device, ...] → Transformer → contextual embeddings
   ↓
각 feature 의 embedding 이 다른 모든 feature 의 정보 반영
```

### 1-3. TabTransformer 의 구조

```
Categorical Features                   Continuous Features
────────────────────                   ──────────────────────
[cat_1, cat_2, ..., cat_n]            [num_1, num_2, ..., num_m]
   ↓ (column embedding)
[emb_1, emb_2, ..., emb_n] ∈ R^(n×d)
   ↓ (Transformer encoder, multi-head self-attention)
[ctx_emb_1, ctx_emb_2, ..., ctx_emb_n] ← contextual!
   ↓ (concat with continuous)
[ctx_emb_1, ..., ctx_emb_n, num_1, ..., num_m]
   ↓ (MLP)
score
```

핵심 컴포넌트:
- **Column Embedding**: 각 categorical feature 의 초기 embedding
- **Transformer Encoder**: multi-head self-attention 으로 contextual 변환
- **Continuous Features**: 그대로 concat (transformer 안 거침)

---

## 2. Column Embedding — Categorical 의 초기 표현

### 2-1. 일반 Embedding vs Column Embedding

```
일반 (DLRM, Wide&Deep):
   user_id="user_123" → emb (32 dim)
   country="KR"       → emb (32 dim)
   → concat

TabTransformer:
   user_id="user_123" → emb (32 dim)
   country="KR"       → emb (32 dim)
   → stack as sequence (sequence length = n columns)
```

차이: TabTransformer 는 categorical features 를 **sequence** 로 봄. NLP 의 token sequence 와 같은 형태.

### 2-2. Position Encoding 불필요

NLP 의 Transformer 는 token 순서를 위해 positional encoding 필요. 정형 데이터의 column 은 **고정된 순서** → positional encoding 불필요 (column 자체가 식별자).

→ TabTransformer 의 단순화 포인트.

---

## 3. Transformer Encoder — Contextual Embedding 생성

### 3-1. Self-Attention 의 적용

```
Input: [emb_1, emb_2, ..., emb_n]  (각 32 dim)

Self-Attention:
   Q, K, V = linear projections of inputs
   Attention(Q,K,V) = softmax(QK^T / √d) V
   
   각 feature 의 representation 이 다른 모든 feature 와의 attention weight 로 업데이트
```

**핵심**: country 의 contextual embedding 이 user_id, device 등을 보고 생성. 모든 feature 가 서로 영향.

### 3-2. Multi-Head Attention

여러 attention head 로 다양한 관계 학습:
- Head 1: user-country 관계
- Head 2: device-time 관계  
- Head 3: ...

산업 표준: 4~8 heads, 6~12 layers.

### 3-3. FFN (Feed-Forward Network)

각 contextual embedding 에 추가 변환:
```
FFN(x) = ReLU(x W_1 + b_1) W_2 + b_2
```

### 3-4. Layer Norm + Residual

```
output = LayerNorm(x + Attention(x))
output = LayerNorm(output + FFN(output))
```

NLP Transformer 의 표준 구조 그대로.

---

## 4. Continuous Features 처리

TabTransformer 의 흥미로운 디자인 결정: **연속값 features 는 transformer 통과 안 시킴**.

```
[contextual_emb_1, ..., contextual_emb_n, cont_1, cont_2, ..., cont_m]
                                          ↑
                                          그대로 concat
```

**왜**:
- ✅ Continuous 는 이미 정렬된 numeric → embedding 변환이 정보 손실
- ✅ MLP 가 continuous 처리에 충분
- ✅ Transformer 계산 비용 줄임

**단점**:
- ❌ Continuous 와 Categorical 의 interaction 이 Top MLP 에서만 발생 → DLRM 보다 약할 수 있음

→ 후속 연구 (TabNet, NODE) 는 continuous 도 처리.

---

## 5. 학습 — Pre-training 과 Fine-tuning

### 5-1. NLP 처럼 Pre-training 가능

```
Pre-training 1: Masked Language Model (BERT 처럼)
   - 일부 categorical feature 를 mask
   - Transformer 가 mask 된 feature 예측
   
Pre-training 2: Replaced Token Detection (ELECTRA 처럼)
   - Generator + Discriminator
   - 더 효율적
```

**가치**: 라벨 없는 데이터 (대량의 user log) 에서 사전학습 → 라벨 있는 데이터 (구매/클릭) 에서 fine-tune.

### 5-2. End-to-End 학습

```
loss = BCE(model(features), labels)
```

라벨 있는 데이터로 직접 학습. Pre-training 없이 가능. 산업 표준.

---

## 6. 산업 적용 — Amazon 사례

### 6-1. 데이터셋 (Amazon 의 Tabular 데이터)

논문은 15개 공개 benchmark 에서 평가:
- Credit risk (대출)
- Income prediction
- Online news
- Customer churn
- 기타 tabular classification

### 6-2. 성능 비교

TabTransformer vs MLP (baseline) vs Gradient Boosted Trees (XGBoost, LightGBM):

| Dataset | MLP | XGBoost | TabTransformer |
|---|---|---|---|
| Average AUC across 15 | 0.852 | **0.881** | 0.878 |

**관찰**:
- TabTransformer 가 MLP 대비 평균 +2% 우월
- XGBoost 와 비슷 (transformer 가 tree 모델 따라잡음)
- 일부 데이터셋에서 TabTransformer 가 XGBoost 우월

### 6-3. 추천 시스템 적용

TabTransformer 가 추천 ranking 에 도입되는 케이스:
- Categorical features 가 많을 때 (10+)
- Feature 간 복잡한 interaction 가치 있을 때
- Pre-training 데이터 풍부할 때

산업 도입은 **DLRM 보다 늦음** — 2020 년 이후 점진 도입.

---

## 7. TabTransformer vs DLRM 비교

| 축 | DLRM (§14) | TabTransformer |
|---|---|---|
| **Categorical interaction** | Pairwise dot product | Multi-head self-attention |
| **Continuous 처리** | Bottom MLP | 그대로 concat |
| **표현력** | O(n²) pairwise | O(n²) attention + multi-head |
| **계산 비용** | 비교적 가벼움 | Transformer layer 무거움 |
| **Pre-training** | 어색함 | NLP 처럼 자연스러움 |
| **산업 적용** | Meta 표준 | Amazon, 점진 도입 |
| **Categorical 수 한계** | n=100 까지 OK | Self-attention O(n²) — n=50 권장 |

### 7-1. 언제 TabTransformer 가 적합한가

- ✅ Categorical features 10~50 개
- ✅ Pre-training 데이터 풍부
- ✅ Feature 간 복잡한 interaction 의심
- ✅ Tabular classification (대출, churn) — 추천 외 도메인에서 더 검증됨

### 7-2. 언제 DLRM 이 적합한가

- ✅ Categorical features 50~수백
- ✅ 대규모 (Meta-scale)
- ✅ Continuous features 영향력 큼
- ✅ End-to-end 학습 (pre-training 불필요)

---

## 8. 구현 패턴 — PyTorch

### 8-1. TabTransformer 모델 정의

```python
import torch
import torch.nn as nn

class TabTransformer(nn.Module):
    def __init__(
        self,
        categorical_sizes: list,  # vocab size per categorical column
        num_continuous: int,
        embedding_dim: int = 32,
        n_heads: int = 8,
        n_layers: int = 6,
        ff_dim: int = 256,
        mlp_dims: list = [128, 64, 1],
    ):
        super().__init__()
        
        # Column embeddings
        self.embeddings = nn.ModuleList([
            nn.Embedding(vocab_size, embedding_dim)
            for vocab_size in categorical_sizes
        ])
        
        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embedding_dim,
            nhead=n_heads,
            dim_feedforward=ff_dim,
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
        
        # MLP
        n_cat = len(categorical_sizes)
        mlp_input_dim = n_cat * embedding_dim + num_continuous
        
        mlp_layers = []
        in_dim = mlp_input_dim
        for out_dim in mlp_dims:
            mlp_layers.append(nn.Linear(in_dim, out_dim))
            mlp_layers.append(nn.ReLU())
            in_dim = out_dim
        self.mlp = nn.Sequential(*mlp_layers[:-1])  # 마지막 ReLU 제거
        self.sigmoid = nn.Sigmoid()
    
    def forward(self, categorical, continuous):
        # Embedding lookup → (B, n_cat, emb_dim)
        embeddings = torch.stack([
            self.embeddings[i](categorical[:, i])
            for i in range(len(self.embeddings))
        ], dim=1)
        
        # Transformer → contextual embeddings
        contextual = self.transformer(embeddings)  # (B, n_cat, emb_dim)
        
        # Flatten + concat with continuous
        contextual_flat = contextual.flatten(start_dim=1)  # (B, n_cat * emb_dim)
        x = torch.cat([contextual_flat, continuous], dim=1)
        
        # MLP
        return self.sigmoid(self.mlp(x)).squeeze(-1)

# 사용
model = TabTransformer(
    categorical_sizes=[100000, 50000, 100, 200, 1000],  # 5 categorical
    num_continuous=13,
    embedding_dim=32,
    n_heads=4,
    n_layers=6,
)
```

---

## 9. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "Transformer 가 추천에 무조건 좋다" | Categorical 수가 적으면 (≤ 5) DLRM 충분. Transformer overhead 손해. |
| 2 | "Continuous features 도 transformer 통과" | 논문은 명시적으로 안 함. Continuous 는 numerical scale 그대로 가치. |
| 3 | "Positional encoding 필요" | Column 은 고정 순서 — positional encoding 불필요. NLP 와 차이. |
| 4 | "Pre-training 항상 도움" | 라벨 없는 데이터 풍부할 때만. 일반 추천은 click/purchase 라벨 충분. |
| 5 | "TabTransformer 가 XGBoost 보다 항상 우월" | 평균 비슷. 데이터셋마다 다름. XGBoost 가 여전히 강력한 baseline. |
| 6 | "Multi-head 수가 많을수록 좋다" | 4~8 default. 16+ 는 over-parametrized + 학습 어려움. |
| 7 | "DLRM 보다 항상 우월" | 대규모 (Meta-scale) 에서는 DLRM 의 단순함 + 분산 학습 우월. |

---

## 10. 꼬리 질문 (§26 면접 카드 후보)

1. **TabTransformer 의 contextual embedding 이 일반 embedding 보다 우월한 이유는?**
   - 답: 일반 embedding 은 각 feature 가 독립. Contextual — 다른 feature 와의 관계로 표현. user_id="A" 의 embedding 이 country="KR" 일 때와 "US" 일 때 다름 → feature interaction 학습. NLP BERT 의 contextual word embedding 정신.

2. **TabTransformer 가 continuous features 를 transformer 통과 안 시키는 이유는?**
   - 답: Continuous 는 이미 numerical scale 있음. Embedding 변환은 정보 손실 위험. MLP 가 continuous 처리에 충분. Transformer 계산 비용 절약. 단점은 continuous-categorical interaction 이 Top MLP 에서만 발생.

3. **TabTransformer 가 NLP Transformer 와 다른 점은?**
   - 답: (1) Positional encoding 불필요 — column 은 고정 순서. (2) Categorical 만 transformer, continuous 는 concat. (3) Token sequence 가 짧음 (~50) — NLP 의 512+ 와 다름.

4. **TabTransformer 가 DLRM 보다 적합한 시나리오는?**
   - 답: (1) Categorical features 10~50 (DLRM 의 pairwise O(n²) 이 부담스럽지만 transformer 는 OK), (2) Pre-training 데이터 풍부, (3) Feature 간 복잡한 interaction 가치. 대규모 (Meta-scale) 는 DLRM 우월 (분산 학습 친화적).

5. **Tabular classification 에서 XGBoost 가 여전히 강한 이유는?**
   - 답: Tree 모델의 feature interaction 학습 능력. Missing value 자연 처리. Feature engineering 없이도 좋은 성능. 작은~중간 데이터셋 (~수십만 row) 에서 우월. Deep learning 은 수백만+ row 에서 진가 발휘.

---

## 11. Phase 6 - A/B/C/D 통합

§12-15 의 4 논문 정리:

| 모델 | 출처 | Funnel 위치 | 핵심 |
|---|---|---|---|
| Wide & Deep | Google 2016 | Ranking | Memorization + Generalization joint |
| Two-Tower | YouTube 2016/2019 | Retrieval | Dot product → ANN 가능 |
| DLRM | Meta 2019 | Ranking | Sparse + Dense 분리 + pairwise interaction |
| TabTransformer | Amazon 2020 | Ranking | Self-attention contextual embedding |

**산업 표준 조합 (현재)**:
```
Retrieval: Two-Tower (또는 CF / Geo)
Ranking: DLRM 또는 Wide & Deep
```

**차세대 트렌드**:
- DCN-v2, AutoInt (DLRM 의 후속)
- TabTransformer 의 점진 도입
- LLM-based recommendation (GPT 등으로 ranking)

---

## 12. cross-ref

| 주제 | 연결된 study |
|---|---|
| Wide & Deep | §12 (TabTransformer 와 같은 ranking) |
| Two-Tower | §13 (Funnel 의 다른 stage) |
| DLRM | §14 (가장 유사 — ranking 모델) |
| Sentence-BERT Transformer | §09 (NLP Transformer 의 기초) |
| Toy training | §16 |
| Pre-training in NLP | #19 §05 (BERT 관련) |
