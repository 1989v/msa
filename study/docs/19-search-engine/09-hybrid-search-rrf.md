---
parent: 19-search-engine
seq: 09
title: Hybrid Search — BM25 + Dense Vector + RRF (Reciprocal Rank Fusion), Two-Stage Retrieval
type: deep
created: 2026-05-03
---

# 09. Hybrid Search

> 묶음 2 (A) 풀어쓰기. BM25 (Best Match 25) 와 vector 의 결합이 왜 단순 합산이 어렵고, RRF 가 왜 표준이 되었는가.

## 1. 한 줄 핵심

> **BM25 와 vector score 는 서로 다른 척도여서 단순 합산이 안 된다.**
> RRF (Reciprocal Rank Fusion) 는 점수가 아닌 **순위만** 사용해서 정규화 없이 두 시스템을 결합한다.

## 2. 왜 Hybrid 인가

### 2-1. BM25 와 Vector 는 보완적

| 워크로드 | BM25 우세 | Vector 우세 |
|---|---|---|
| 정확한 키워드 (제품 코드, 정확 이름) | ✅ | ❌ |
| 동의어 / 의미 유사 | ❌ | ✅ |
| 오타 (약함) / 변형 | ⚠ (fuzzy 로 일부) | ✅ |
| 숫자 / 날짜 / enum | ✅ | ❌ |
| 자연어 질문 ("냉장고 안 시원") | ❌ | ✅ |
| 짧은 키워드 | ✅ | 균등 |
| 긴 자연어 | 균등 | ✅ |

→ 이커머스: "갤럭시 폴드" (BM25) + "접히는 큰 화면 폰" (vector) 둘 다 잘 처리하려면 hybrid.

### 2-2. 단순 합산의 함정

```
BM25 score = 0.5 ~ 50 (corpus / 쿼리 의존)
Vector cosine = 0 ~ 1 (정규화)

α × BM25 + (1-α) × cosine
→ α 잘못 두면 한쪽이 압도
→ 다른 쿼리로 바뀌면 BM25 range 가 변함 (재튜닝 필요)
```

**문제**: 두 score 의 분포가 다르고, 쿼리마다 BM25 range 가 달라서 α 정규화가 매우 어려움.

### 2-3. 해법 두 가지

1. **Score normalization + weighted sum** — 어렵지만 정밀
2. **RRF (rank-based)** — 간단하고 안정적, 점수 무관

→ 실무는 거의 **RRF** (또는 RRF + 후처리).

## 3. RRF — Reciprocal Rank Fusion

### 3-1. 수식

```
score_RRF(d) = Σ_i [ 1 / (k + rank_i(d)) ]

  i: 결합할 시스템 (BM25, vector, ...)
  rank_i(d): 시스템 i 에서 doc d 의 rank (1부터 시작)
  k: 상수 (보통 60, 논문 default)
```

### 3-2. 직관

- 각 시스템에서 doc 의 **순위만** 사용
- 1등이면 큰 점수, 100등이면 작은 점수
- 두 시스템 모두에서 상위면 → 합산 점수 ↑

```
doc A: BM25 rank 1, vector rank 5 → 1/(60+1) + 1/(60+5) = 0.0164 + 0.0154 = 0.0318
doc B: BM25 rank 50, vector rank 1 → 1/(60+50) + 1/(60+1) = 0.0091 + 0.0164 = 0.0255
doc C: BM25 rank 1, vector rank 100 → 1/(60+1) + 1/(60+100) = 0.0164 + 0.0063 = 0.0227

순위: A > B > C
```

### 3-3. 왜 잘 작동하는가

- **점수 분포 무관** — 1/(k+rank) 는 시스템마다 같은 함수
- **k=60 의 효과** — rank 1과 rank 5의 점수 차이를 부드럽게
  - k 작음 → 1등에 큰 가중치
  - k 큼 → 순위 차이 평준화
- 두 시스템 모두에서 합리적 순위인 doc 이 안정적으로 상위
- 한 시스템에서 1등이지만 다른 시스템에서 100등인 doc 은 적당히

### 3-4. k 파라미터

- 논문 default: 60
- 작게 (예: 10) → 1등에 매우 큰 가중치 (한 쪽 시스템에서 1등이면 안전)
- 크게 (예: 100) → 순위 차이 부드러움 (두 시스템 다 잘 매칭이 더 중요)

대부분 60 그대로 사용.

## 4. ES 의 RRF (8.8+)

### 4-1. 네이티브 지원

```json
POST /products/_search
{
  "retriever": {
    "rrf": {
      "retrievers": [
        {
          "standard": {
            "query": { "match": { "name": "갤럭시 폴드" } }
          }
        },
        {
          "knn": {
            "field": "embedding",
            "query_vector": [0.12, ...],
            "k": 50,
            "num_candidates": 100
          }
        }
      ],
      "rank_window_size": 100,
      "rank_constant": 60
    }
  },
  "size": 20
}
```

옵션:
- `rank_window_size` — 각 retriever 에서 몇 개 가져와서 RRF 할지
- `rank_constant` — RRF 의 k

### 4-2. ES 의 retriever 추상화 (8.14+)

`retriever` 가 새로 도입돼서 standard / knn / rrf / text_similarity_reranker 를 통합 추상화. 이전의 `query` + `knn` 분리보다 더 깔끔.

## 5. OpenSearch 의 RRF / Hybrid Search (2.10+)

> **[OS 차이]** OpenSearch 의 hybrid search 는 두 가지 방식 — `hybrid` query (가중 합) + `score_normalization` processor (RRF/min-max).

### 5-1. Hybrid Query

```json
POST /products/_search
{
  "_source": { "exclude": ["embedding"] },
  "query": {
    "hybrid": {
      "queries": [
        { "match": { "name": "갤럭시 폴드" } },
        {
          "knn": {
            "embedding": { "vector": [...], "k": 50 }
          }
        }
      ]
    }
  }
}
```

### 5-2. Search Pipeline 으로 정규화

```json
PUT /_search/pipeline/hybrid_pipeline
{
  "phase_results_processors": [
    {
      "normalization-processor": {
        "normalization": { "technique": "min_max" },
        "combination": {
          "technique": "arithmetic_mean",
          "parameters": { "weights": [0.4, 0.6] }
        }
      }
    }
  ]
}
```

```json
POST /products/_search?search_pipeline=hybrid_pipeline
{ "query": { "hybrid": { ... } } }
```

→ min-max normalize 후 weighted mean. RRF 는 별도 normalization technique 으로 지원.

### 5-3. ES vs OS 비교

| 영역 | ES | OS |
|---|---|---|
| RRF | retriever 네이티브 (8.8+) | search pipeline + RRF normalization |
| 가중 합 | retriever 의 score 결합 | hybrid query + arithmetic_mean |
| API 깔끔함 | retriever 추상화 우위 | pipeline 분리 (재사용성 ↑) |
| 명시적 가중치 | 어려움 (RRF 자체가 가중치 X) | weights 파라미터 |

## 6. Two-Stage Retrieval

### 6-1. 흐름

```
Stage 1 (Retrieval):  대량 후보 (100~1000) 빠르게 추출
                      ├─ BM25 retriever
                      └─ kNN retriever
                          (둘 다 fast, recall 위주)
                      
                      ↓ RRF 결합 (top 100)
                      
Stage 2 (Re-Ranking): cross-encoder 또는 LTR 로 정밀 재정렬 (top 10)
                      (slow, precision 위주)
```

### 6-2. 왜 두 단계인가

- Stage 1 (recall) — 빠르고 후보 많이 추출 (놓치면 안 됨)
- Stage 2 (precision) — 비싸지만 후보 적으니 (10~100) 가능

→ 검색 latency / 정확도 트레이드오프의 표준 패턴.

### 6-3. RRF 는 Stage 1 의 결합

RRF 는 retrieval 결과 결합. 이후 LTR / cross-encoder 가 stage 2 (§10).

## 7. Hybrid Search 의 평가

### 7-1. 단일 쿼리 검증

```
"갤럭시" 검색:
  BM25 only:    [갤럭시 노트, 갤럭시 워치, 갤럭시 폴드, ...]
  Vector only:  [폴더블 폰, 삼성 신상, 갤럭시 폴드, ...]
  Hybrid (RRF): [갤럭시 폴드, 갤럭시 노트, 폴더블 폰, ...]
```

→ 직관적으로 "둘 다 1등인 것" 이 hybrid 1등.

### 7-2. 정량 평가

- judgment list (정답 라벨) 준비
- 각 쿼리에 대해 BM25 / vector / hybrid 의 nDCG@10 비교
- 통계적 유의성 (paired t-test)

→ 실무: 클릭 로그 기반 자동 측정 + A/B 테스트.

### 7-3. A/B 테스트 패턴

- 사용자 traffic 50:50 분리
- group A: BM25 only
- group B: hybrid (RRF)
- 메트릭: CTR, CVR, MRR (클릭 위치)

## 8. Hybrid 의 한계와 보완

### 8-1. 메모리 / 인덱싱 비용 2배

- BM25 인덱스 + dense_vector 인덱스 둘 다 유지
- 메모리 / 디스크 ↑

### 8-2. 임베딩 모델 의존성

- 모델 변경 = vector reindex
- 모델 quality 가 hybrid quality 결정

### 8-3. 한쪽이 비어있을 때

- 매우 짧은 쿼리 ("a") → BM25 만 동작 (vector 의미 X)
- 매우 긴 자연어 → vector 만 동작 (BM25 매칭 적음)
- RRF 는 한쪽 결과만 있어도 작동 (다른 쪽 rank 부재 = 점수 0)

### 8-4. Filter 와의 조합

```json
"retriever": {
  "rrf": {
    "retrievers": [
      { "standard": { "query": { "bool": {
          "must": [{ "match": { "name": "갤럭시" } }],
          "filter": [{ "term": { "stock_available": true } }]
      } } } },
      { "knn": { "field": "embedding", "filter": [...] } }
    ]
  }
}
```

→ 두 retriever 모두에 같은 filter 적용 권장 (한쪽만 적용하면 후보 set 어긋남).

## 9. 실전 패턴 — 이커머스 hybrid

```json
POST /products/_search
{
  "retriever": {
    "rrf": {
      "retrievers": [
        {
          "standard": {
            "query": {
              "function_score": {
                "query": {
                  "bool": {
                    "must": [{
                      "multi_match": {
                        "query": "접히는 폰",
                        "fields": ["name^3", "description", "tags^2"]
                      }
                    }],
                    "filter": [
                      { "term": { "stock_available": true } },
                      { "range": { "price": { "lte": 3000000 } } }
                    ]
                  }
                },
                "functions": [
                  { "field_value_factor": { "field": "click_count", "modifier": "log1p" } }
                ],
                "boost_mode": "multiply"
              }
            }
          }
        },
        {
          "knn": {
            "field": "embedding",
            "query_vector": [0.12, ...],   // "접히는 폰" 임베딩
            "k": 50,
            "num_candidates": 200,
            "filter": [
              { "term": { "stock_available": true } },
              { "range": { "price": { "lte": 3000000 } } }
            ]
          }
        }
      ],
      "rank_window_size": 100,
      "rank_constant": 60
    }
  },
  "size": 20
}
```

→ BM25 (multi_match + function_score) + vector (kNN) → RRF → top 20.

## 10. msa 시사점

### 10-1. 도입 의사결정 (시니어 관점)

- product 검색에 hybrid 도입 가치:
  - 자연어 질문 ("접히는 폰") 처리 ↑
  - 동의어 / 변형 ↑
- 비용:
  - 임베딩 모델 운영 (self-hosted) 또는 외부 API
  - dense_vector 인덱스 메모리 (1024차원 × 100만 doc ≈ 4GB)
  - 인덱싱 latency (임베딩 추론 비용)

### 10-2. 단계적 도입

1. PoC: 한 카테고리 (예: 가전) 만 hybrid (vector 작은 corpus)
2. A/B: 전체 vs 카테고리별 메트릭 비교
3. 확장 또는 보류 결정

→ §18 에서 PoC 코드.

### 10-3. ADR 후보

- "검색 인덱스에 hybrid 도입 — RRF 기반, ES 또는 OS 선택"
- §19 의 ADR 4건 중 하나.

## 11. 흔한 실수 패턴

### 11-1. 단순 weighted sum 시도

```
α × BM25 + (1-α) × cosine
```

→ score 분포 다름. 쿼리마다 결과 달라짐. RRF 권장.

### 11-2. 두 retriever 의 filter 어긋남

→ 한 쪽만 필터 적용 → 후보 set 불일치 → RRF 후 이상한 결과.

### 11-3. num_candidates 너무 작음

```
kNN num_candidates=10
→ 후보 부족, RRF 효과 ↓
```

→ rank_window_size 와 일치 또는 그 이상.

### 11-4. 임베딩 모델 / search 모델 불일치

→ §08 의 함정 그대로. hybrid 에서도 동일.

### 11-5. RRF 후 추가 정렬 / boost

```
RRF score 기반 정렬 후 다시 popularity sort
→ RRF 무력화
```

→ RRF score 그대로 사용 또는 명시적 후처리 (re-rank, §10).

### 11-6. 평가 없이 도입

→ "직관적으로 hybrid 가 좋음" 으로 결정. 실 메트릭 측정 필수.

## 12. 자주 듣는 오해 정정

> **"RRF 가 항상 weighted sum 보다 좋다"**

- ⚠ score 정규화가 잘 되면 weighted sum 도 OK. RRF 는 안전한 default.

> **"RRF k 를 0 으로 두면 1등에 절대 가중치"**

- ⚠ k=0 이면 분모가 rank — 1등 score 가 1, 2등이 0.5. 의미는 있지만 비표준.

> **"hybrid 면 BM25 가중치 0 으로 줄여도 된다"**

- ❌ hybrid 의 의미는 둘 다 활용. 한쪽 무력화면 안 함만 못함.

> **"kNN 만으로 충분하다 (가장 정확)"**

- ⚠ 정확 키워드 (제품 코드) 매칭은 BM25 가 우수. 도메인 의존.

> **"RRF 는 점수 정보를 버리므로 정밀도 손실"**

- ⚠ 점수 정보 버림. 단, score 정규화의 어려움 + 안정성이 RRF 의 장점. 정밀도가 더 중요하면 LTR (§10).

> **"hybrid 면 인덱스 크기가 2배"**

- ⚠ inverted index + dense_vector 둘 다. 메모리는 dense_vector 가 보통 더 큼.

## 13. 다음 학습

- [10-reranking-cross-encoder-ltr.md](10-reranking-cross-encoder-ltr.md) — RRF 후의 정밀 재정렬
- [11-elasticsearch-vs-opensearch.md](11-elasticsearch-vs-opensearch.md) — ES retriever vs OS hybrid query 비교
- [18-hybrid-search-poc.md](18-hybrid-search-poc.md) — msa hybrid PoC

> **§09 회독 체크리스트**:
> - [ ] BM25 와 vector 를 단순 합산하면 안 되는 이유 (score 분포)
> - [ ] RRF 의 수식과 k 의 의미
> - [ ] RRF 가 score 정규화 없이 작동하는 이유
> - [ ] Two-Stage Retrieval (recall → precision) 의 직관
> - [ ] ES 의 retriever / OpenSearch 의 hybrid query 의 차이
> - [ ] hybrid 의 비용 (메모리, 인덱싱, 모델 의존성)
> - [ ] 두 retriever 에 filter 동기화 필요성
