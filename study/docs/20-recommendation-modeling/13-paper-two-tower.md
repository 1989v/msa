---
parent: 20-recommendation-modeling
seq: 13
title: Two-Tower Model — Deep Neural Networks for YouTube Recommendations (Covington et al., RecSys 2016) → YouTube 2019
type: deep
created: 2026-05-12
---

# 13. Paper 2 — Two-Tower (YouTube 2016 / 2019)

> **Phase 6 핵심**. Retrieval 의 산업 표준. Covington et al., "Deep Neural Networks for YouTube Recommendations", RecSys 2016 + 후속 Two-Tower 일반화 (YouTube 2019).

논문: https://research.google/pubs/deep-neural-networks-for-youtube-recommendations/

---

## 1. 핵심 통찰 — Two-Stage Recommendation

### 1-1. 문제

YouTube 의 스케일:
- 수십억 개의 동영상
- 수십억 사용자
- 한 사용자에게 Top-10 추천

→ 한 모델로 모든 (user, video) pair 점수 계산 = **30억 × 30억 = 9 × 10¹⁸** = 불가능.

### 1-2. Two-Stage 해결 (§01 §4 cross-ref)

```
Stage 1: Candidate Generation (= Retrieval, Two-Tower 의 위치)
   - 수십억 video → 수백 후보
   - 빠르고 가벼운 모델
   - recall 중시

Stage 2: Ranking
   - 수백 → 수십
   - 무겁고 정확한 모델 (Wide & Deep, DLRM)
   - precision 중시
```

이 논문이 **2-stage 패러다임을 산업 표준화**. 이후 모든 산업 추천이 이 구조.

---

## 2. Candidate Generation — Two-Tower 의 원형

### 2-1. 학습 — 분류 문제로 정식화

```
사용자 u 가 다음에 볼 영상은 V 개 중 무엇? → V-way classification

Softmax:
   P(v=i | u, context) = exp(v_i · u) / Σ_j exp(v_j · u)

   v_i: 동영상 i 의 embedding (item tower 출력)
   u:   사용자 + context 의 embedding (user tower 출력)
```

핵심: **사용자 watch history 를 다음 video 예측 문제**로 학습.

### 2-2. Architecture

```
User Tower                        Item Tower (implicit, embedding table)
─────────                          ──────────────────────────────────────
watch_history (video_ids)          video_id → embedding (single lookup)
   ↓ (embedding lookup, average)   
embedded_history
   ↓ (concat)
search_history (query_tokens)
   ↓ (embedding, average)
embedded_search
   ↓ (concat with dense features)
geographic + age + gender + ...
   ↓
hidden layers (1024 → 512 → 256 → 256, ReLU)
   ↓
user_embedding u ∈ R^256

video_id → embedding (256 dim) → v_i

score(u, v_i) = u · v_i  ← dot product
```

### 2-3. Serving — Approximate Nearest Neighbor

학습 후:
- 모든 video embedding (item tower 출력) → 사전 계산 → **ANN 인덱스에 색인** (FAISS / HNSW)
- 사용자 요청 시:
  1. 사용자 정보 → user tower forward pass → user embedding u
  2. ANN 인덱스에서 u 와 가장 가까운 Top-N video → 후보 (Stage 1 완료)

**latency**: 수십억 video 중 Top-100 → ~10ms (ANN + dot product 만, neural network 한 번)

이게 **Two-Tower 의 산업 가치**. Stage 1 retrieval 의 표준이 된 이유.

---

## 3. Two-Tower 일반화 — YouTube 2019 + 산업 진화

### 3-1. 명시적 Two-Tower 구조 (YouTube 2019)

원본 논문 (2016) 은 user tower 만 명시적. Item embedding 은 단순 lookup. 2019 년 YouTube 의 후속 연구 ([Yi et al., RecSys 2019](https://research.google/pubs/sampling-bias-corrected-neural-modeling-for-large-corpus-item-recommendations/)) 가 **둘 다 신경망** 으로 일반화:

```
User Tower                        Item Tower
─────────                          ──────────
user_id                           item_id
user features                     item features
context                           item content
   ↓                                ↓
MLP → user_embedding              MLP → item_embedding
   ↓                                ↓
   └─────── dot product ────────────┘
                ↓
              score
```

### 3-2. Item Tower 도 신경망인 이유

- ✅ **Side feature 활용** — 영상 제목, 설명, 카테고리, duration 등
- ✅ **Cold-start 해결** — 신영상도 feature 만 있으면 embedding 생성
- ✅ **Content embedding 통합** — Sentence-BERT (§09) 같은 사전학습 임베딩을 input
- ✅ **Symmetric — 같은 dimension** 의 dense vector

### 3-3. Negative Sampling 의 중요성

```
사용자가 본 영상: 1개
사용자가 안 본 영상: 수십억 개

학습 시 모든 negative 사용 = 불가능
→ Negative Sampling 필요
```

**Sampling 전략**:
- **In-batch negatives**: 같은 배치의 다른 사용자가 본 영상이 negative
- **Random negatives**: 전체에서 random sample
- **Hard negatives**: 약간 어려운 negative (모델이 헷갈리는 것)
- **Popularity-debiased negatives**: 인기 영상을 더 자주 negative 로 (popular item bias 회피)

산업 표준: **In-batch + log-uniform sampling (popularity-debiased)**.

### 3-4. Sampling Bias Correction (Yi et al. 2019 의 핵심 기여)

In-batch negatives 의 문제:
- 인기 영상이 더 자주 negative 로 sampling 됨
- 모델이 "인기 영상 = negative" 라고 잘못 학습

해결책 — **logit correction**:
```
corrected_logit(v_i) = original_logit(v_i) - log(probability(v_i in batch))
```

각 영상의 batch 내 sampling 확률을 추정해서 그 log 만큼 logit 에서 차감. **popular item bias 보정**.

§02 §9-4 의 negative subsampling 과 동일 정신.

---

## 4. Two-Tower 의 산업 적용

### 4-1. ANN 서빙의 전제 — Dot Product

Two-Tower 의 score = u · v_i 의 형태 → **ANN 가능**.

만약 score 가 `f(u, v_i)` 형태 (non-separable) 라면:
- 모든 v_i 에 대해 f 계산 필요
- ANN 불가
- 산업 표준 retrieval 못 됨

**핵심**: Two-Tower 는 **유일하게 separable 한 retrieval 모델**. 다른 모델은 ranking 단계로 밀려남.

### 4-2. 학습 데이터 — Positive 정의

```
positive pair: (user, item) — user 가 item 에 강한 신호
   YouTube: watch > 50% completion
   e-commerce: purchase
   콘텐츠: click + scroll
   여행: reservation
```

논문의 통찰: **watch time 으로 weighted logistic regression** — 짧은 watch 보다 긴 watch 가 더 강한 신호.

### 4-3. Embedding 차원 선택

- 일반: 64~256 dim
- 산업 표준: 128
- 차원 ↑ → 표현력 ↑ but ANN 메모리 ↑
- 차원 ↓ → 속도 ↑ but 정확도 ↓

### 4-4. 학습 빈도

- 일일 batch retraining (산업 표준)
- 또는 incremental learning (실시간 업데이트)
- 모든 item embedding 재계산 → ANN 인덱스 재빌드

---

## 5. 구현 패턴 — TensorFlow Recommenders (TFRS)

### 5-1. Two-Tower 모델 정의

```python
import tensorflow as tf
import tensorflow_recommenders as tfrs

class UserTower(tf.keras.Model):
    def __init__(self, user_vocab_size, embedding_dim=128):
        super().__init__()
        self.user_embedding = tf.keras.Sequential([
            tf.keras.layers.IntegerLookup(vocabulary=user_vocab),
            tf.keras.layers.Embedding(user_vocab_size, 64),
        ])
        self.dense_layers = tf.keras.Sequential([
            tf.keras.layers.Dense(256, activation='relu'),
            tf.keras.layers.Dense(embedding_dim),
        ])
    
    def call(self, inputs):
        x = self.user_embedding(inputs['user_id'])
        return self.dense_layers(x)


class ItemTower(tf.keras.Model):
    def __init__(self, item_vocab_size, embedding_dim=128):
        super().__init__()
        self.item_embedding = tf.keras.Sequential([
            tf.keras.layers.IntegerLookup(vocabulary=item_vocab),
            tf.keras.layers.Embedding(item_vocab_size, 64),
        ])
        self.dense_layers = tf.keras.Sequential([
            tf.keras.layers.Dense(256, activation='relu'),
            tf.keras.layers.Dense(embedding_dim),
        ])
    
    def call(self, inputs):
        x = self.item_embedding(inputs['item_id'])
        return self.dense_layers(x)


class TwoTowerModel(tfrs.Model):
    def __init__(self, user_tower, item_tower, items_dataset):
        super().__init__()
        self.user_tower = user_tower
        self.item_tower = item_tower
        
        self.task = tfrs.tasks.Retrieval(
            metrics=tfrs.metrics.FactorizedTopK(
                candidates=items_dataset.batch(128).map(self.item_tower),
            )
        )
    
    def compute_loss(self, features, training=False):
        user_emb = self.user_tower({'user_id': features['user_id']})
        item_emb = self.item_tower({'item_id': features['item_id']})
        return self.task(user_emb, item_emb)
```

### 5-2. 학습 + ANN 인덱스 export

```python
model = TwoTowerModel(user_tower, item_tower, items_dataset)
model.compile(optimizer=tf.keras.optimizers.Adagrad(0.1))
model.fit(train_data, epochs=10)

# Item embeddings 추출
item_embeddings = []
for batch in items_dataset.batch(1000):
    emb = item_tower({'item_id': batch['item_id']})
    item_embeddings.append(emb.numpy())
item_embeddings = np.concatenate(item_embeddings)

# FAISS 색인
import faiss
index = faiss.IndexFlatIP(128)  # Inner Product
index.add(item_embeddings.astype('float32'))

# 실시간 retrieval
user_emb = user_tower({'user_id': [user_id]}).numpy().astype('float32')
distances, indices = index.search(user_emb, k=100)  # Top-100 candidates
```

---

## 6. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "Two-Tower 가 모든 추천을 해결" | Retrieval 전용. Ranking 에는 DLRM / Wide & Deep 같은 무거운 모델 필요. |
| 2 | "Item embedding 만 학습 (user tower 불필요)" | YouTube 2016 의 한계. 2019 후속 — 둘 다 신경망이 우월. |
| 3 | "In-batch negatives 만 사용" | Popular item bias. Logit correction (Yi et al. 2019) 필수. |
| 4 | "Dot product 대신 더 복잡한 score" | Non-separable → ANN 불가. Retrieval 의 가치 손실. |
| 5 | "차원 클수록 좋다" | 128 default. 256+ 는 memory/latency 손해. 64 미만은 표현력 손실. |
| 6 | "Item embedding 한 번 학습 후 영구" | 신영상 / drift 대응 못 함. 일일 재학습이 산업 표준. |
| 7 | "Two-Tower 가 MF 보다 항상 좋다" | Two-Tower = deep MF. Side feature 없으면 단순 MF (§03) 가 빠르고 비슷. |

---

## 7. 꼬리 질문 (§26 면접 카드 후보)

1. **Two-Tower 의 score 가 dot product 인 이유는?**
   - 답: ANN 색인 가능. 모든 item embedding 사전 계산 → 인덱스 → 사용자 요청 시 user embedding 만 forward → ANN 으로 Top-K 빠르게. 만약 score = f(u, v) non-separable 이면 모든 item 에 f 계산 필요 → 수십억 vid 에서 retrieval 불가.

2. **YouTube 2016 vs 2019 Two-Tower 의 차이는?**
   - 답: 2016 — User tower 만 신경망, item 은 단순 embedding lookup. 2019 — 둘 다 신경망 (Symmetric). Item side feature 활용 가능 → cold-start 개선 + 표현력 증가. Sampling bias correction (logit adjustment) 추가.

3. **Sampling bias correction 의 메커니즘은?**
   - 답: In-batch negatives 에서 인기 item 이 더 자주 negative 로 sampling → 모델이 "인기 = negative" 잘못 학습. Logit 에서 `log(P(item in batch))` 차감하여 보정. 인기 item 의 sampling probability 추정 (e.g., log-uniform). Popular item bias 회피.

4. **Two-Tower 의 학습 데이터에서 watch time weighting 의 의미는?**
   - 답: 50% watch 와 5% watch 가 같은 positive 아님. 긴 watch 가 강한 신호. Weighted logistic regression 으로 watch time 을 가중치로 → 모델이 "오래 본 영상" 을 더 강하게 학습. 짧은 click bait 회피.

5. **Two-Tower 는 retrieval, Wide & Deep 은 ranking 인 구조의 이유는?**
   - 답: Two-Tower 의 dot product → ANN 가능 → 수십억 candidate 에서 빠른 retrieval. Wide & Deep 의 non-separable feature interaction → 모든 candidate inference 필요. 후보 수백 개 ranking 에는 OK, 수십억 retrieval 에는 불가. Funnel 의 각 stage 에 다른 모델.

---

## 8. cross-ref

| 주제 | 연결된 study |
|---|---|
| Two-Stage Retrieval 패턴 | §01 §4 (Two-Tower ≠ Two-Stage 구분) |
| MF / FunkSVD / ALS | §03 (Two-Tower = deep MF) |
| Sentence-BERT 임베딩 | §09 (item tower 의 input feature) |
| ANN (HNSW / FAISS) | §10 (Two-Tower serving 의 핵심) |
| Wide & Deep (ranking) | §12 (Funnel 의 다음 stage) |
| Negative sampling | §02 §9-4 (cosine + sampling) |
| Contextual Bandit | §08 (Two-Tower user embedding 활용) |
| Toy training | §16 (Two-Tower 직접 구현) |
| msa Two-Tower ANN 서빙 | Phase 10 §24 |
