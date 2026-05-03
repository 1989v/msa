---
parent: 19-search-engine
seq: 10
title: Re-Ranking — Cross-Encoder, Learning To Rank (LTR), Business Re-Ranking
type: deep
created: 2026-05-03
---

# 10. Re-Ranking

> 묶음 2 (A) 의 마지막 풀어쓰기. RRF 까지가 stage 1, re-rank 가 stage 2. 검색 품질의 마지막 1마일.

## 1. 한 줄 핵심

> **Stage 1 (BM25 + vector + RRF) 가 후보 100개를 추린다면, Stage 2 (re-rank) 가 그 중 정밀하게 top 10 을 결정한다.**
> 비용이 큰 모델/계산을 후보에만 적용하는 것이 검색 품질 vs latency 의 표준 해법.

## 2. Re-Ranking 이 필요한 이유

### 2-1. Stage 1 의 한계

BM25 + vector + RRF 까지로:
- 후보 set 은 좋아짐 (recall ↑)
- 하지만 1~10 위의 미세한 순위는 부정확
- 동의어 / 의미 / business signal / 사용자 컨텍스트 모두 균등 반영 ❌

### 2-2. Re-Rank 가 풀어주는 것

- **세밀한 의미 매칭** — bi-encoder (vector) 는 query/doc 독립 인코딩, cross-encoder 는 query+doc 동시 입력 → 정확도 ↑
- **비즈니스 시그널** — function_score 보다 정교한 결합 (LTR)
- **개인화** — 사용자 컨텍스트 (구매 이력, 카테고리 선호)
- **광고 / 프로모션** — 별도 layer 로 분리

## 3. 두 갈래 — Cross-Encoder vs LTR

### 3-1. Cross-Encoder

- BERT / RoBERTa 같은 transformer 가 (query, doc) 쌍을 입력으로 받아 score 출력
- query 와 doc 의 token 간 attention 으로 **단어 수준 매칭**
- bi-encoder (벡터 독립 인코딩) 보다 정확하지만 **느림**

### 3-2. LTR (Learning To Rank)

- 머신러닝 모델 (LambdaMART / XGBoost) 이 다양한 feature (BM25 score, click rate, freshness, ...) 를 입력으로 받아 ranking 학습
- 클릭 로그 / 정답 라벨로 학습
- 빠르고 비즈니스 시그널 결합 자연스러움

### 3-3. 비교

| 축 | Cross-Encoder | LTR |
|---|---|---|
| 모델 종류 | Transformer (BERT 계열) | LambdaMART / XGBoost |
| 입력 | (query, doc) text 쌍 | feature 벡터 (BM25, click rate, ...) |
| 학습 데이터 | judgment list (query, doc, relevance) | 클릭 로그 + judgment |
| 추론 비용 | 큼 (~10ms / pair) → top 50~100 만 | 작음 (수 µs) → top 200~1000 도 가능 |
| 정확도 | 매우 높음 (의미 매칭 정밀) | 높음 (feature engineering 의존) |
| 비즈니스 시그널 | 어색 (text 만 보는 경향) | 자연스러움 (feature 로) |
| 운영 부담 | GPU 필요 가능 | CPU only OK |
| 적용 시점 | 후처리 (Stage 2) | 후처리 또는 통합 |

→ 이커머스: **LTR 이 더 일반적**. 의미 매칭이 핵심이면 cross-encoder 추가.

## 4. Cross-Encoder 상세

### 4-1. Bi-Encoder vs Cross-Encoder

```
Bi-Encoder (vector search):
  query  → [encoder] → vector_q
  doc    → [encoder] → vector_d
  similarity = cosine(vector_q, vector_d)
  → 사전 인덱싱 가능, 빠름

Cross-Encoder:
  (query, doc) → [encoder] → score
  → 매번 같이 인코딩, 사전 인덱싱 ❌
  → 정확하지만 느림
```

### 4-2. 모델 예시

| 모델 | 언어 | 특성 |
|---|---|---|
| `cross-encoder/ms-marco-MiniLM-L-12-v2` | 영어 | 가벼움, 빠름 |
| `cross-encoder/ms-marco-electra-base` | 영어 | 더 정확 |
| `bge-reranker-v2-m3` | 다국어 | 한국어 OK, 강력 |
| `ko-sroberta-cross-encoder` | 한국어 특화 | 한국어 best |
| `bge-reranker-large` | 다국어 | 최강 (느림) |

→ msa: **bge-reranker-v2-m3** 가 다국어 + 한국어 균형 잘 맞음.

### 4-3. 적용 흐름

```
Stage 1: hybrid (BM25 + vector + RRF) → top 100 후보
                ↓
Stage 2: cross-encoder 가 (query, doc) 쌍 100개 추론
         → 100개의 새 score
         → 재정렬
         → top 10
```

### 4-4. 비용 산정

```
top 100 × 10ms / pair = 1초 (단일 모델)
GPU 사용 시: 100 batch → ~50ms
```

→ GPU 없으면 top 50 또는 더 작은 모델로 줄임.

### 4-5. ES 의 text_similarity_reranker (8.14+)

```json
"retriever": {
  "text_similarity_reranker": {
    "retriever": {
      "rrf": { ... }   // Stage 1
    },
    "field": "description",
    "inference_id": "my-rerank-endpoint",   // 등록된 cross-encoder
    "inference_text": "사용자 쿼리"
  }
}
```

→ ES 8.14+ 에서 cross-encoder rerank 가 native. ELSER / Cohere reranker 등 통합.

### 4-6. 외부 reranker API

- Cohere Rerank API
- Jina AI Reranker
- self-hosted (HuggingFace + FastAPI)

→ ES native 가 아니어도 application 레이어에서 후처리 가능.

## 5. Learning To Rank (LTR)

### 5-1. 직관

```
주어진 쿼리 q 에 대해 doc d 의 ranking 을 결정하는 함수 f(q, d) 학습.

f(q, d) = w1 × BM25_score + w2 × click_rate + w3 × freshness + ...
```

→ 핵심: **feature engineering** + **순위 학습 알고리즘**.

### 5-2. 주요 알고리즘

| 알고리즘 | 종류 | 특성 |
|---|---|---|
| **Pointwise** | regression / classification | 각 doc 의 절대 점수 학습 (단순) |
| **Pairwise** (RankNet, LambdaRank) | pair 비교 | "A 가 B 보다 위" 학습 |
| **Listwise** (LambdaMART, ListNet) | 전체 list 평가 | nDCG 직접 최적화 |

→ 실무 표준: **LambdaMART** (Listwise + GBDT). LightGBM / XGBoost 의 LambdaRank objective.

### 5-3. Feature Engineering

LTR 의 성패는 feature 에 달림. 일반적 feature:

#### Query-only features
- 쿼리 길이 (토큰 수)
- 쿼리에 카테고리 키워드 포함 여부
- 쿼리 빈도 (popular query)

#### Doc-only features
- 가격 / 재고 / 평점
- 클릭 횟수 / 구매 횟수
- 신상도 (created_at)
- 카테고리 / 브랜드

#### Query-Doc features
- BM25 score (per field)
- vector cosine similarity
- 매칭 토큰 수
- highlight 일치 비율
- 카테고리 매칭

#### User-Doc features (개인화)
- 사용자 카테고리 선호 점수
- 사용자 가격대 선호
- 과거 클릭 / 구매 이력

→ 보통 50~200개 feature.

### 5-4. 학습 데이터 (Judgment List)

LTR 학습에는 (query, doc, relevance) 트리플 필요.

| relevance | 의미 |
|---|---|
| 0 | 무관 |
| 1 | 약간 관련 |
| 2 | 관련 |
| 3 | 매우 관련 |
| 4 | 완벽 |

source:
- 도메인 전문가 라벨링 (정확, 비쌈)
- **클릭 로그 (Implicit Feedback)** — 가장 흔함
- 구매 / 장바구니 / 체류 시간

#### 클릭 로그 → judgment 변환

```
사용자가 query 검색 → 결과 [d1, d2, d3, d4, d5] 중 d3 클릭
  → d3 의 relevance ↑ (예: 1.0)
  → 위 d1, d2 는 "스킵된 doc" → 부정 신호 (예: 0.0)
  → d4, d5 는 보지 않음 (스킵 X) → 무신호
```

⚠ position bias — 위에 있을수록 클릭률 ↑ (관련도와 무관하게). debiasing 기법 필요.

### 5-5. Cascade — Stage 1 + LTR

```
Stage 1: BM25 + vector + RRF → top 200 (feature 추출)
Stage 2: LTR 모델 → 200개 scoring → top 10
```

→ LTR 은 cross-encoder 보다 빠르므로 후보 수 ↑ 가능.

## 6. ES LTR Plugin

### 6-1. plugin 설치

```bash
# elasticsearch-learning-to-rank plugin (o19s)
elasticsearch-plugin install \
  https://github.com/o19s/elasticsearch-learning-to-rank/releases/download/v1.5.X/ltr-plugin-...
```

### 6-2. Feature Set 정의

```json
POST _ltr/_featureset/product_features
{
  "featureset": {
    "features": [
      {
        "name": "title_bm25",
        "params": ["query"],
        "template_language": "mustache",
        "template": {
          "match": { "name": "{{query}}" }
        }
      },
      {
        "name": "popularity",
        "template_language": "derived_expression",
        "template": "doc['popularity'].value"
      }
    ]
  }
}
```

### 6-3. 모델 등록

LightGBM / XGBoost / RankLib 의 model 파일을 ES 에 업로드:

```json
POST _ltr/_featureset/product_features/_createmodel
{
  "model": {
    "name": "v1_lambda_mart",
    "model": {
      "type": "model/lightgbm+json",
      "definition": "..."
    }
  }
}
```

### 6-4. 검색 시 적용 (rescore)

```json
POST /products/_search
{
  "query": { "match": { "name": "갤럭시" } },   // Stage 1: 후보 추출
  "rescore": {
    "window_size": 100,
    "query": {
      "rescore_query": {
        "sltr": {
          "params": { "query": "갤럭시" },
          "model": "v1_lambda_mart"
        }
      }
    }
  }
}
```

→ top 100 만 LTR 적용, 빠름.

## 7. OpenSearch LTR

> **[OS 차이]** OpenSearch 는 자체 LTR plugin 보유 (o19s plugin 의 fork). ES LTR 와 거의 호환되지만 import 차이 있음. 커뮤니티 활발.

`opensearch-learning-to-rank` plugin 으로 거의 동일 패턴.

## 8. Business Re-Ranking — 별도 layer

### 8-1. 왜 별도인가

비즈니스 룰 (광고 boost, 프로모션, 카테고리 균형) 은:
- 자주 바뀜
- 비기술 팀이 결정
- A/B 테스트 빈번

→ ML 모델 안에 박지 말고 **별도 후처리 레이어** 로 분리.

### 8-2. 패턴

```
Stage 1: BM25 + vector + RRF
Stage 2: LTR (자동 학습)
Stage 3: Business Re-Rank (수동 룰)
  - 광고 상품 top 3 에 강제 삽입
  - 카테고리 균형 (동일 카테고리 5개 이상 안 보이게)
  - 프로모션 boost
```

### 8-3. 구현

application 레이어 (search:app) 에서 ES 응답 받은 후 후처리.

```kotlin
val esResults = esClient.search(...)
val rerankedByLTR = ltrModel.rerank(esResults)
val finalResults = businessRules.apply(rerankedByLTR, context)
```

→ ML 과 룰 분리 = 유지보수성 ↑.

## 9. 평가

### 9-1. 메트릭

- nDCG@10 (전체 ranking)
- MRR (첫 정답 위치)
- CTR (실제 클릭률)
- CVR (구매 전환율)

### 9-2. 단계별 비교

```
Stage 1 only:    nDCG@10 = 0.62
Stage 1 + LTR:   nDCG@10 = 0.71  ← LTR 효과
Stage 1 + LTR + Business:  CTR ↑ 8% (실 사용자)
```

### 9-3. A/B 테스트

- group A: Stage 1
- group B: Stage 1 + LTR
- group C: Stage 1 + LTR + cross-encoder
- 메트릭 차이 통계적 유의성 검증

## 10. msa 시사점

### 10-1. LTR feature source

- **BM25 score** — ES query 에서
- **클릭 / 구매 로그** — `analytics` 서비스의 ClickHouse
- **사용자 선호** — `member` 서비스
- **상품 메타** — `product` 서비스

→ analytics 가 LTR judgment list 의 source 가 됨.

### 10-2. 도입 단계

1. judgment list 수집 인프라 (analytics → judgment)
2. feature extraction 파이프라인
3. 오프라인 학습 (LightGBM)
4. ES LTR plugin 설치 + 모델 등록
5. 검색 API rescore 통합
6. A/B 테스트

→ 한 번에 다 못 함. 단계적 도입 + 측정.

### 10-3. ADR 후보

- "검색 LTR 도입 — judgment list 인프라 + 모델 운영 + A/B 플랫폼"

## 11. 흔한 실수 패턴

### 11-1. Stage 1 부실하게 LTR 만 의존

→ 후보가 안 좋으면 LTR 도 못 살림. recall (Stage 1) 먼저.

### 11-2. judgment 데이터 적음

→ 100~1000개로는 모델 학습 부족. 최소 10,000+ judgment.

### 11-3. position bias 무시

→ "위에 있어서 클릭됨" 을 "관련도 있어서 클릭됨" 으로 학습. 모델이 단순히 위 위치 모방.
→ Inverse Propensity Weighting (IPW) 같은 debiasing.

### 11-4. cross-encoder 를 모든 후보에

→ 100,000 개 후보에 cross-encoder = 분 단위 latency. top 50~100 으로 줄임.

### 11-5. business 룰을 LTR 에 통합

→ 룰 변경마다 모델 재학습. 분리 운영.

### 11-6. 메트릭 없이 도입

→ "직관적으로 좋아짐" → 검증 ❌. nDCG / CTR 측정.

### 11-7. feature 너무 많이

→ overfitting + feature 추출 비용. feature importance 측정 후 가지치기.

## 12. 자주 듣는 오해 정정

> **"LTR 이 BM25 보다 항상 좋다"**

- ⚠ judgment 충분, 운영 능력 있을 때. 작은 규모는 BM25 + function_score 가 ROI ↑.

> **"cross-encoder 가 LTR 보다 정확하다"**

- ⚠ 의미 매칭은 ↑, 비즈니스 시그널 결합은 LTR 이 자연스러움. 결합 권장.

> **"LTR 한 번 학습하면 끝"**

- ❌ 데이터 drift, 신상품 출현, 트렌드 변화 → 주기적 재학습 (보통 주/월 단위).

> **"LambdaMART 가 LambdaRank 보다 좋다"**

- ⚠ MART = boosting + LambdaRank. listwise 의 진화형. 실무 표준.

> **"클릭 데이터만 있으면 충분하다"**

- ⚠ position bias 보정 필수. 도메인 전문가 라벨 일부 결합 권장.

> **"re-rank 는 검색 latency 를 크게 늘린다"**

- ⚠ LTR 은 거의 무시 가능 (수 ms). cross-encoder 만 비쌈 → top N 제한.

## 13. 다음 학습

- [11-elasticsearch-vs-opensearch.md](11-elasticsearch-vs-opensearch.md) — LTR plugin 의 ES vs OS
- [15-msa-search-grounding.md](15-msa-search-grounding.md) — analytics → judgment 파이프라인 설계
- [19-improvements.md](19-improvements.md) — LTR 도입 ADR 초안
- [20-interview-qa.md](20-interview-qa.md) — re-rank 면접 질문

> **§10 회독 체크리스트**:
> - [ ] Stage 1 (recall) vs Stage 2 (precision) 의 역할 분리
> - [ ] Cross-encoder vs LTR 의 비교 (정확도 / 비용 / 비즈니스 시그널)
> - [ ] LambdaMART 가 listwise 인 이유와 nDCG 직접 최적화
> - [ ] LTR feature engineering 의 4가지 카테고리 (Query / Doc / Q-D / User-D)
> - [ ] judgment list 의 source (도메인 라벨 vs 클릭 로그)
> - [ ] position bias 와 그 보정 (IPW)
> - [ ] business 룰을 별도 layer 로 분리하는 이유
> - [ ] ES rescore 패턴 (top N 만 비싼 모델)
