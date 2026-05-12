---
parent: 20-recommendation-modeling
seq: 12
title: Wide & Deep Learning for Recommender Systems (Cheng et al., Google DLRS 2016) — 논문 독해
type: deep
created: 2026-05-12
---

# 12. Paper 1 — Wide & Deep (Google 2016)

> **Phase 6 시작**. 딥러닝 추천의 산업 진입점 논문. Cheng et al., "Wide & Deep Learning for Recommender Systems", DLRS 2016 (Google Play 추천 시스템 적용 사례).

논문: https://arxiv.org/abs/1606.07792

---

## 1. 핵심 통찰 — Memorization vs Generalization

### 1-1. Linear Model 의 강점/약점

**Linear (logistic regression) with cross product features**:
```
score = σ( w · feature_cross )
   feature_cross = [user_country=KR AND item_category=hotel, ...]
```

- ✅ **Memorization**: 자주 함께 등장한 feature 조합을 정확히 기억
   - "한국 사용자가 호텔을 자주 본다" 라는 패턴을 직접 학습
- ❌ **Generalization 부족**: 본 적 없는 조합은 score 0
   - 학습 데이터에 "프랑스 사용자 × 일식당" 조합이 없으면 평생 0

### 1-2. Deep Model (DNN) 의 강점/약점

**DNN with embedding**:
```
embedding_user, embedding_item → concat → MLP → score
```

- ✅ **Generalization**: 본 적 없는 조합도 embedding 으로 유사 패턴 추정
   - "프랑스 사용자" embedding 이 다른 유럽 사용자와 가까우면 일식당 score 추정 가능
- ❌ **Memorization 부족**: 매우 sparse 한 직접 매칭 (예: 특정 user × 특정 item) 약함
   - 학습 데이터에 한 번만 등장한 특정 조합도 embedding 으로 약하게만 학습

### 1-3. 결합 — Wide & Deep

```
final_score = σ( w_wide · linear_features + w_deep · DNN_output + b )
```

Linear + DNN 두 모델을 **하나의 logistic regression** 으로 결합. 동시 학습 (joint training).

장점:
- ✅ Memorization (linear) + Generalization (DNN) **동시 달성**
- ✅ 두 모델이 서로 보완 — 결합 학습이 단독 학습보다 우월
- ✅ 산업 추천에 즉시 적용 가능

→ **딥러닝 추천의 산업 진입점**. 이전에는 행렬 분해 (MF) + linear regression 분리 운영. Wide & Deep 이 통합 모델로 표준화.

---

## 2. 모델 구조 상세

### 2-1. 전체 아키텍처

```
Wide Component (linear)              Deep Component (DNN)
───────────────────                   ────────────────────
sparse features                       sparse features
   ↓ (cross product)                     ↓ (embedding lookup)
   x_wide                                embeddings (32~256 dim each)
                                         ↓ (concat with dense features)
                                         hidden layer 1 (1024 units, ReLU)
                                         ↓
                                         hidden layer 2 (512 units, ReLU)
                                         ↓
                                         hidden layer 3 (256 units, ReLU)
                                         ↓
                                         x_deep
   ↓                                     ↓
   └────────┬───────────────────────────┘
            ↓
   σ( w_wide · x_wide + w_deep · x_deep + b )
            ↓
         P(click | user, item)
```

### 2-2. Wide Component — Cross Product Transformation

```
feature_a: user_installed_app=netflix  (binary)
feature_b: impression_app=hbo_max      (binary)

cross_product(a, b) = 1 if (a=1 AND b=1) else 0
```

수동 feature engineering. 도메인 지식으로 의미 있는 cross 만 선정. 산업 적용에서 가장 시간 많이 드는 부분.

### 2-3. Deep Component — Embedding + MLP

```
categorical_feature (vocab 10000) → embedding (32 dim)
   - user_id
   - item_id  
   - country
   - device_type
   ...

dense_feature (그대로)
   - age (normalized)
   - days_since_last_click
   ...

concat([embedding_1, embedding_2, ..., dense_1, dense_2, ...]) 
   → MLP (1024 → 512 → 256)
```

### 2-4. Joint Training 의 핵심

**왜 두 모델을 따로 학습하지 않나**:
- 따로 학습 후 ensemble: 두 모델이 서로의 약점을 모름 → 같은 실수 반복
- Joint training: 두 모델이 서로의 출력을 보며 보완 → 진정한 보완

수식:
```
P(y=1 | x) = σ( w_wide^T · φ(x) + w_deep^T · a^(L) + b )
   φ(x): cross product features
   a^(L): deep model 의 마지막 layer
   
Loss: BCE (Binary Cross-Entropy)
   L = -y log(p) - (1-y) log(1-p)

Gradient: w_wide, w_deep, embedding, MLP weights 모두 동시 업데이트
```

### 2-5. Optimizer 분리

논문의 흥미로운 디테일:
- **Wide**: FTRL-Proximal (Follow-The-Regularized-Leader) — sparse + L1
- **Deep**: AdaGrad — dense + 적응적 학습률

이유: linear sparse feature 와 dense embedding 의 학습 dynamics 가 다름. 같은 optimizer 가 sub-optimal.

산업 구현에서 흔한 함정 — 한 optimizer 로 합치면 성능 손해.

---

## 3. Google Play 적용 사례 (논문의 핵심 실험)

### 3-1. 데이터 규모

- 500 billion (5천억) 학습 샘플
- 1억 dimensions feature
- 2 weeks 학습 데이터

### 3-2. A/B 테스트 결과

| 모델 | App Acquisition 변화 |
|---|---|
| Linear only (Wide) | baseline |
| DNN only (Deep) | +2.9% |
| **Wide & Deep** | **+3.9%** |

→ Deep 단독보다 Wide & Deep 이 1% 더 우월. 거대 트래픽에서 1% = 수억 달러 매출.

### 3-3. Online Serving Optimization

논문이 중요한 운영 디테일 공유:
- **Multithreading** for parallel inference
- **Mini-batching** for throughput
- 10ms latency budget 안에 inference 완료

→ 산업 배포의 표준 패턴이 됨.

---

## 4. Wide & Deep 의 산업 영향

### 4-1. 후속 모델들

Wide & Deep 이 영감을 준 후속 모델:
- **DeepFM** (2017): Wide 의 cross product 를 자동 학습 (Factorization Machine)
- **xDeepFM** (2018): 더 정교한 cross interaction
- **DCN (Deep & Cross Network)** (2017): cross 를 명시적으로 학습
- **DCN-v2** (2020): DCN 의 개선
- **AutoInt** (2019): self-attention 으로 feature interaction

→ 모두 **"manual cross feature 를 자동화"** 가 방향성. Wide & Deep 이 출발점.

### 4-2. 산업에 미친 영향

- ✅ Deep learning + 룰 기반 결합의 표준
- ✅ Feature engineering 의 중요성 재확인 (Wide part 는 수동)
- ✅ Joint training 패러다임
- ✅ 산업 추천 모델의 deep learning 진입

이후 DLRM (§14), Two-Tower (§13) 등이 모두 Wide & Deep 의 후예.

---

## 5. 구현 패턴 — TensorFlow / Keras

### 5-1. 모델 정의

```python
import tensorflow as tf
from tensorflow.keras import layers, Model

def build_wide_and_deep(
    wide_features_dim: int,
    deep_categorical_features: dict,  # {name: vocab_size}
    deep_dense_features_dim: int,
    embedding_dim: int = 32,
    hidden_units: list = [1024, 512, 256],
):
    # Wide Input (sparse cross product features)
    wide_input = layers.Input(shape=(wide_features_dim,), name='wide')
    
    # Deep Inputs
    cat_inputs = {}
    cat_embeddings = []
    for name, vocab_size in deep_categorical_features.items():
        inp = layers.Input(shape=(1,), name=f'cat_{name}', dtype='int32')
        emb = layers.Embedding(vocab_size, embedding_dim)(inp)
        emb = layers.Flatten()(emb)
        cat_inputs[name] = inp
        cat_embeddings.append(emb)
    
    dense_input = layers.Input(shape=(deep_dense_features_dim,), name='dense')
    
    # Deep Component
    deep = layers.Concatenate()(cat_embeddings + [dense_input])
    for units in hidden_units:
        deep = layers.Dense(units, activation='relu')(deep)
    
    # Combine
    combined = layers.Concatenate()([wide_input, deep])
    output = layers.Dense(1, activation='sigmoid')(combined)
    
    model = Model(
        inputs=[wide_input] + list(cat_inputs.values()) + [dense_input],
        outputs=output
    )
    
    return model

# 사용
model = build_wide_and_deep(
    wide_features_dim=1000,
    deep_categorical_features={'user_id': 100000, 'item_id': 50000, 'category': 100},
    deep_dense_features_dim=20,
)
model.compile(
    optimizer=tf.keras.optimizers.Adagrad(0.01),  # Deep + Wide 동일 optimizer (단순화)
    loss='binary_crossentropy',
    metrics=['AUC']
)
```

### 5-2. Optimizer 분리 (논문 충실)

```python
# Wide: FTRL
wide_optimizer = tf.keras.optimizers.Ftrl(learning_rate=0.1, l1_regularization_strength=0.01)
# Deep: AdaGrad
deep_optimizer = tf.keras.optimizers.Adagrad(learning_rate=0.01)

# Custom training loop 필요 (Keras 기본은 단일 optimizer)
```

---

## 6. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "Deep model 만 쓰면 충분" | Memorization 약함. specific user × item 매칭 손해. Wide 와 결합이 우월. |
| 2 | "Wide 와 Deep 따로 학습 후 ensemble" | Joint training 이 핵심. 서로 보완 못 함. |
| 3 | "Cross product feature 자동 생성" | 수동 feature engineering 필수. 도메인 지식으로 의미 있는 cross 만. |
| 4 | "한 optimizer 로 합치면 OK" | Wide (sparse, FTRL) vs Deep (dense, AdaGrad) dynamics 다름. 분리 권장. |
| 5 | "Wide & Deep 이 항상 DLRM/Two-Tower 보다 우월" | Wide & Deep 은 ranking 모델. Two-Tower 는 retrieval 모델. Funnel 의 다른 stage. |
| 6 | "Wide part 없이도 가능" | 가능하지만 1~3% 손해. 산업에서 1% 매출 차이. |
| 7 | "Embedding 차원 작을수록 빠름" | 32 default. 16 미만은 표현력 손실. 256 이상은 overfit + latency. |

---

## 7. 꼬리 질문 (§26 면접 카드 후보)

1. **Wide & Deep 의 Memorization vs Generalization 의미는?**
   - 답: Wide (linear + cross product) — 자주 함께 본 feature 조합을 정확히 외움 (memorization). 본 적 없는 조합에 약함. Deep (DNN + embedding) — embedding 으로 본 적 없는 조합도 유사 패턴 추정 (generalization). 매우 specific 한 직접 매칭에 약함. 결합으로 두 강점 동시 달성.

2. **Joint training 이 ensemble 보다 우월한 이유는?**
   - 답: Ensemble — 두 모델 독립 학습 후 평균. 서로의 약점 모름 → 같은 실수 반복. Joint — 같은 loss 로 동시 학습 → 서로의 출력 보며 보완. Gradient 가 두 component 모두에 의미 있게 흐름.

3. **Wide part 의 FTRL-Proximal optimizer 가 적합한 이유는?**
   - 답: FTRL = Follow-The-Regularized-Leader. Sparse feature + L1 regularization 에 강함. Linear model 의 standard. Online learning 친화적. Deep part 의 dense feature + AdaGrad 와 dynamics 다름 → 분리 필요.

4. **Wide & Deep 이후 DeepFM / DCN 의 진화 방향은?**
   - 답: Wide & Deep 의 manual cross product → 자동 학습. DeepFM = Factorization Machine 으로 cross 자동. DCN = explicit cross network. DCN-v2, AutoInt 등이 발전. 모두 "수동 cross 의 자동화" 방향.

5. **Wide & Deep 이 retrieval 모델인가 ranking 모델인가?**
   - 답: **Ranking 모델**. Funnel 의 Stage 2 (수백 → 수십). Retrieval 은 Two-Tower 같은 가벼운 모델 (Stage 1). Wide & Deep 은 사용자×아이템 pair 마다 점수 계산 → retrieval 에 그대로 쓰면 latency 폭발.

---

## 8. cross-ref

| 주제 | 연결된 study |
|---|---|
| §01 Two-stage retrieval | Wide & Deep 은 Stage 2 ranking |
| Joint training 정신 | §03 (MF 도 bias + interaction 동시 학습) |
| Embedding lookup | §03 (MF embedding 의 신경망 확장) |
| Two-Tower (retrieval) | §13 (Funnel 의 다른 stage) |
| DLRM | §14 (Wide & Deep 의 후예) |
| Optimizer 선택 | 일반 ML 지식 |
| Toy training | §16 (Wide & Deep 직접 구현) |
