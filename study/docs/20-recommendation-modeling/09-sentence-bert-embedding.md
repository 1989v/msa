---
parent: 20-recommendation-modeling
seq: 09
title: Sentence-BERT 임베딩 — Siamese BERT, mean pooling, 한국어 모델 (KoBERT/Electra/RoBERTa/BART)
type: deep
created: 2026-05-12
---

# 09. Sentence-BERT 임베딩

> **Phase 5 첫 파일**. §02-03 의 CF 가 행동 기반 유사도였다면, §09-11 은 콘텐츠 기반 유사도 — 텍스트 → dense vector → cosine. ES MoreLikeThis (TF-IDF) 의 차세대.

---

## 1. Sentence-BERT 의 등장 배경

### 1-1. BERT 의 문장 임베딩 함정

원본 BERT (Bidirectional Encoder Representations from Transformers, Google 2018) 는 토큰 단위 임베딩 모델. **문장 임베딩** 으로 그대로 쓰면 함정:
- `[CLS]` 토큰의 hidden state 사용 → 의미적으로 문장 표현이 약함
- 두 문장 cosine similarity 계산하려면 매번 BERT forward pass 2번 + concat 입력 → 비쌈
- 1만 문장 페어 검색 = 5천만 BERT inference → 며칠 소요

→ 추천/검색에 직접 사용 불가능했음.

### 1-2. Sentence-BERT (Reimers & Gurevych, EMNLP 2019)

핵심 아이디어: **Siamese BERT 구조** + Mean Pooling + Cosine 학습.

```
문장 A ──► BERT_shared ──► mean_pool ──► vec_A ──┐
                                                  ├─► cosine(A, B) ──► loss
문장 B ──► BERT_shared ──► mean_pool ──► vec_B ──┘
```

핵심 변경 3가지:
1. **공유 BERT** (Siamese — 같은 가중치 BERT 두 번 사용)
2. **Mean Pooling** — 모든 토큰 hidden state 의 평균 (CLS 토큰보다 우월)
3. **Cosine similarity loss** — 두 문장의 의미 거리를 직접 학습

→ 학습 후: 각 문장을 한 번만 forward pass → vec 추출 → 모든 cosine 한 번에 계산 가능. **1만 문장 비교가 1만 BERT inference + 행렬곱** 으로 단축.

---

## 2. 학습 방식 — Loss Functions

### 2-1. Cosine Similarity Loss (회귀)

데이터 형태: (문장 A, 문장 B, 유사도 점수 0~5)

```
loss = MSE( cosine(vec_A, vec_B), label_score / 5.0 )
```

STS-B (Semantic Textual Similarity) 벤치마크 학습 시 사용.

### 2-2. Triplet Loss

데이터 형태: (anchor, positive, negative)

```
loss = max( 0, distance(anchor, positive) - distance(anchor, negative) + margin )
```

추천 시스템에 더 적합 — **"같은 사용자가 클릭한 아이템 (positive) 이 random 아이템 (negative) 보다 가까워야 한다"**.

### 2-3. Multiple Negatives Ranking Loss (산업 default)

배치 안의 모든 negative 를 동시에 사용:

```
loss = -log( exp(sim(anchor, positive)) / Σ_neg exp(sim(anchor, neg)) )
```

In-batch negative sampling. 배치 크기 256 → 255개 negative 자동 활용. 학습 효율 높음.

---

## 3. 한국어 임베딩 모델 비교

### 3-1. KoBERT (SKT, 2019)

- Multilingual BERT 한국어 추가 학습
- 한국어 위키 + 뉴스 코퍼스
- vocab 8002 (sentencepiece)

**특징**: 가장 흔히 사용되는 한국어 베이스라인. 라이선스 자유.

### 3-2. KLUE-BERT (KLUE Benchmark, 2021)

- KLUE (Korean Language Understanding Evaluation) 벤치마크에 맞춰 학습
- 다양한 도메인 (뉴스, 위키, 게시판, 리뷰)
- vocab 32000

**특징**: 한국어 NLU 표준 벤치마크에서 KoBERT 보다 우월.

### 3-3. Electra (KoELECTRA, Park 2020)

- Electra (Clark et al., ICLR 2020) 의 한국어 버전
- Generator + Discriminator 사전학습
- BERT 대비 효율적 (동일 데이터로 더 좋은 성능)

**특징**: 학습 효율. 임베딩 품질 KoBERT 와 비슷하거나 약간 우월.

### 3-4. RoBERTa (KLUE-RoBERTa)

- RoBERTa (Liu et al., 2019) — BERT 의 사전학습 레시피 개선
- Dynamic masking, NSP 제거, 더 긴 학습
- 한국어 버전 KLUE-RoBERTa-base/large

**특징**: 임베딩 품질 가장 우월. 모델 크기 큼 (base ~110M, large ~340M).

### 3-5. BART (KoBART)

- BART (Lewis et al., ACL 2020) — Bidirectional + Auto-Regressive Transformer
- Seq2seq 사전학습 (denoising autoencoder)
- 임베딩보다 **요약/생성** 에 강함

**특징**: 추천에서는 임베딩 sub-optimal. 콘텐츠 생성 (제품 설명 자동 생성) 에 적합.

### 3-6. 비교 표

| 모델 | 임베딩 품질 | 학습 효율 | 메모리 | 산업 사용 |
|---|---|---|---|---|
| KoBERT | 중간 | 보통 | 110M | 가장 흔함 |
| KLUE-BERT | 우월 | 보통 | 110M | 표준 벤치마크 |
| KoELECTRA | 우월 | **빠름** | 110M | 학습 효율 우선 |
| KLUE-RoBERTa | **가장 우월** | 느림 | 110M / 340M | 최고 품질 추구 |
| KoBART | 약함 (생성용) | 보통 | 140M | 생성 / 요약 |

**산업 선택**:
- 빠른 prototyping: KoBERT
- 일반 production: KLUE-BERT 또는 KoELECTRA
- 최고 품질: KLUE-RoBERTa-large
- 생성 결합: KoBART

---

## 4. Sentence-BERT 학습 — 산업 코드 패턴

### 4-1. sentence-transformers 라이브러리

```python
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader

# 사전학습 모델 로드
model = SentenceTransformer('jhgan/ko-sroberta-multitask')
# 또는 직접 정의: SentenceTransformer 의 from_pretrained + Pooling

# 학습 데이터 (Multiple Negatives 형식)
train_examples = [
    InputExample(texts=['앵커 텍스트', '관련 텍스트']),
    ...
]
train_loader = DataLoader(train_examples, batch_size=64, shuffle=True)
train_loss = losses.MultipleNegativesRankingLoss(model)

# Fine-tuning
model.fit(
    train_objectives=[(train_loader, train_loss)],
    epochs=3,
    warmup_steps=100,
)

# 추론
embeddings = model.encode(['상품 설명 1', '상품 설명 2', ...])
# shape: (N, 768)
```

### 4-2. 추천 학습 데이터 구축

산업 표준 방법:
- **(query, clicked_product)** 페어 → in-batch negative
- **(product, similar_product)** 페어 → CF 데이터 활용
- **(product, product)** 페어 + 도메인 룰 (같은 카테고리 = positive)

### 4-3. 학습 vs Fine-tuning

| | 처음부터 학습 | Fine-tuning |
|---|---|---|
| 데이터 요구 | 수억 페어 | 수만 페어 |
| 계산 비용 | GPU 며칠~몇 주 | GPU 수 시간 |
| 도메인 적응 | 일반 → 도메인 직접 학습 | 일반 사전학습 + 도메인 fine-tune |
| 산업 선택 | 거의 안 함 | **항상** (사전학습 모델 fine-tune) |

---

## 5. 임베딩 활용 — 추천 시스템에서

### 5-1. Content-based Filtering 강화 (§01 §3-1)

```
사용자가 본 상품 텍스트 → 임베딩 → 평균 (user embedding 대용)
모든 후보 상품 텍스트 → 임베딩 (사전 계산)
cosine(user, candidates) → Top-N
```

### 5-2. Cold-start 안전망 (Phase 7 §17)

신상품 → 행동 데이터 없음 → CF 불가 → **텍스트 임베딩으로 cosine 매칭** 으로 fallback.

### 5-3. Two-Tower 의 item tower 입력 (Phase 6 §13)

```
item_tower(item_id, item_text_embedding, item_features) → item_vec
```

Sentence-BERT 임베딩이 item tower 의 input feature 로. 학습 가능한 신경망이 이 임베딩을 변환.

### 5-4. Hybrid Search 의 dense vector (#19 §07)

검색의 BM25 + dense vector hybrid. 추천의 임베딩 인프라가 그대로 검색에 활용 → **공유 인프라 가치**.

---

## 6. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "BERT `[CLS]` 토큰을 문장 임베딩으로 사용" | 의미적으로 약함. Mean Pooling (Sentence-BERT) 가 표준. |
| 2 | "사전학습 모델 그대로 추천에 사용" | 일반 도메인 학습. 추천 도메인 fine-tuning 필수 (간단 — 수 시간). |
| 3 | "임베딩 차원 클수록 좋다" | 768 (default) 가 산업 표준. 1024+ 는 계산 비용 큼. |
| 4 | "한국어는 multilingual BERT 가 충분" | 한국어 특화 모델 (KLUE-BERT, KoELECTRA) 가 우월. |
| 5 | "Sentence-BERT 가 검색에 그대로 좋다" | 추천 vs 검색 task 다름. 검색은 (query, doc) asymmetric → DPR / ColBERT 더 적합. |
| 6 | "임베딩 한 번 학습 후 영구 사용" | 도메인 drift, 신상품 추가 → 정기 재학습 (월 1회) 권장. |
| 7 | "negative sampling 어렵다" | In-batch negative (Multiple Negatives Ranking Loss) 가 단순 + 강력. |

---

## 7. 꼬리 질문 (§26 면접 카드 후보)

1. **Sentence-BERT 가 원본 BERT 의 문장 임베딩 함정을 어떻게 해결?**
   - 답: (1) Siamese 구조 — 두 문장을 독립적으로 인코딩 → 한 번 인코딩 후 cosine 가능, (2) Mean Pooling — `[CLS]` 보다 의미 풍부, (3) Cosine loss 로 학습 — 임베딩 공간이 의미 거리에 직접 정렬.

2. **Multiple Negatives Ranking Loss 가 산업 default 인 이유는?**
   - 답: In-batch negative 활용. 배치 256 → 255개 negative 자동. 명시적 negative sampling 불필요. 계산 효율 + 성능 균형. 추천 도메인 fine-tuning 의 표준.

3. **한국어 추천에 KLUE-RoBERTa 와 KoBERT 중 선택 기준은?**
   - 답: 품질 우선 → KLUE-RoBERTa (large 가 가장 우월). 단순/속도 → KoBERT. KoELECTRA 가 중간 (KoBERT 정도 모델 크기 + KLUE-BERT 정도 품질). 산업 production 은 KLUE-BERT 또는 KoELECTRA 가 default.

4. **임베딩이 cold-start 를 어떻게 해결?**
   - 답: 신상품은 행동 데이터 없음 → CF 불가. 그러나 텍스트 (제품명, 설명) 는 즉시 사용 가능. Sentence-BERT 로 임베딩 → 기존 상품들과 cosine → 가장 가까운 상품의 인기로 fallback. **즉시 의미 있는 추천**.

5. **추천 임베딩 vs 검색 임베딩 차이는?**
   - 답: 추천은 (item, item) symmetric — Sentence-BERT default. 검색은 (query, doc) asymmetric — DPR (Dense Passage Retrieval, Karpukhin et al. 2020) / ColBERT 가 더 적합. 두 task 다른 임베딩 학습 필요.

---

## 8. cross-ref

| 주제 | 연결된 study |
|---|---|
| BM25 / TF-IDF | #19 §06 (§11 에서 dense vector 와 비교) |
| Vector Search HNSW | #19 §08 + §10 (다음 파일) |
| Hybrid Search (BM25 + dense) | #19 §07 |
| Two-Tower 의 item tower | Phase 6 §13 |
| Cold-start | Phase 7 §17 |
| Negative sampling | Phase 6 §13 (Two-Tower 학습) |
| 검색 임베딩 (DPR, ColBERT) | #19 §08 (vector-semantic-search) |
