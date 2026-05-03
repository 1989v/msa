---
parent: 19-search-engine
seq: 08
title: Vector Search + HNSW — dense_vector, kNN, M / ef_construction / ef_search 파라미터
type: deep
created: 2026-05-03
---

# 08. Vector Search + HNSW

> 묶음 2 (A) 풀어쓰기 시작. 임베딩 / 벡터 검색 / HNSW 가 처음이라는 가정으로 개념부터 단단히.

## 1. 한 줄 핵심

> **Vector Search = "의미가 비슷한" 문서 검색.**
> BM25 가 정확한 단어를 찾는다면, vector search 는 단어가 달라도 의미가 같으면 찾는다. 핵심 도구는 dense vector 임베딩 + HNSW 그래프 기반 ANN (근사 최근접 이웃).

## 2. 왜 Vector Search 인가

### 2-1. BM25 의 한계

```
질문: "냉장고가 시원하지 않아요"
정답 문서: "냉동실 온도가 너무 높습니다 → 컴프레서 점검"
```

BM25 매칭:
- 질문 토큰: [냉장고, 시원, 않다]
- 문서 토큰: [냉동실, 온도, 높다, 컴프레서, 점검]
- **공통 토큰 없음 → 매칭 ❌**

→ "냉장고 = 냉동실", "시원하지 않다 = 온도 높다" 같은 **의미적 유사성**을 BM25 는 모름.

### 2-2. Vector Search 의 해법

- 텍스트 → **임베딩 (embedding)** 으로 변환 (보통 768~1536차원 실수 벡터)
- 의미가 비슷한 텍스트 = 벡터 공간에서 가까움
- 검색 = 쿼리 벡터와 가장 가까운 K개 문서 벡터 찾기 (kNN)

```
"냉장고가 시원하지 않아요" → [0.12, -0.34, 0.56, ...]  (768차원)
"냉동실 온도가 높습니다"     → [0.15, -0.32, 0.51, ...]  (가까움 → cosine ≈ 0.92)
"신상 갤럭시 폴드"          → [0.78, 0.12, -0.45, ...] (멈 → cosine ≈ 0.05)
```

→ 벡터 공간에서 cosine similarity 가 의미적 유사성을 근사.

## 3. 임베딩 모델

### 3-1. 종류

| 모델 | 차원 | 특성 |
|---|---|---|
| OpenAI `text-embedding-3-small` | 1536 | 다국어, 균형, 유료 (저렴) |
| OpenAI `text-embedding-3-large` | 3072 | 고품질, 유료 |
| Sentence-Transformers `all-MiniLM-L6-v2` | 384 | 영어, 가볍, 오픈 |
| Sentence-Transformers `paraphrase-multilingual-mpnet-base-v2` | 768 | 다국어, 오픈 |
| Cohere `embed-multilingual-v3` | 1024 | 다국어, API |
| **KoSimCSE / Ko-Sentence-BERT** | 768 | 한국어 특화, 오픈 |
| **bge-m3** | 1024 | 다국어 + 한국어 우수, 오픈 |
| **E5 (multilingual-e5-large)** | 1024 | 다국어, 오픈, 강력 |

### 3-2. 한국어 선택 기준

- 한국어 전용 → KoSimCSE / Ko-SBERT
- 다국어 (한국어 + 영어 + 기타) → bge-m3 / multilingual-e5-large
- API 편의 → OpenAI / Cohere
- self-hosted → bge-m3, multilingual-e5

→ msa 같은 한국어 + 영어 혼재 도메인 = **bge-m3** 또는 **multilingual-e5-large** 가 무난.

### 3-3. 임베딩 비용

- 차원 ↑ → 메모리/디스크 ↑ (벡터 1개 = `dim × 4 bytes` for float32)
  - 1536 차원 = 6KB / doc
  - 100만 doc = 6GB 그냥 벡터만
- 인덱싱 시간 = HNSW 그래프 빌드 (다음 §)
- 검색 시간 = HNSW traversal (수 ms)

### 3-4. 임베딩 파이프라인

```
[Document] → [Embedding Model] → [Vector] → [ES dense_vector field]
[Query]    → [Embedding Model] → [Vector] → [kNN search]
```

⚠ 인덱싱 모델과 검색 모델이 **반드시 같아야 함**. 다르면 같은 공간 아님 → 무의미한 검색.

## 4. 거리 / 유사도 함수

### 4-1. 종류

| 함수 | 수식 | 사용 |
|---|---|---|
| **cosine** | `cos(θ) = (A·B) / (|A||B|)` | 가장 일반적 (방향만 봄, 크기 무시) |
| **dot product** | `A·B` | 정규화된 벡터끼리는 cosine 과 동일, 빠름 |
| **L2 (Euclidean)** | `√Σ(Aᵢ-Bᵢ)²` | 절대 거리, 임베딩에는 덜 흔함 |
| **L1 (Manhattan)** | `Σ|Aᵢ-Bᵢ|` | 거의 안 씀 |

### 4-2. 정규화의 함정

- 임베딩 모델이 정규화된 벡터 출력 (norm=1) → cosine 과 dot product 가 동일
- 정규화 안 됐으면 cosine 사용 (크기 영향 제거)

→ 모델 문서 확인 필수.

## 5. ANN (Approximate Nearest Neighbor)

### 5-1. 정확 kNN 의 비용

100만 doc 의 1536차원 벡터에서 가장 가까운 10개 찾기:
- brute force = 100만 × 1536 ops = 15억 곱셈 + sqrt
- 단일 쿼리 약 ~1초
- 운영 ❌

### 5-2. ANN 의 트레이드오프

> 정확도 (recall) 를 약간 양보하고 검색 속도를 100~1000배 빠르게.

알고리즘:
- **HNSW** (Hierarchical Navigable Small World) — 그래프 기반, 가장 인기
- **IVF** (Inverted File) — 클러스터 기반, FAISS 에서 인기
- **PQ** (Product Quantization) — 벡터 압축
- **ScaNN** (Google) — 양자화 + 트리

→ Lucene 9.x+ / ES 8.x+ / OpenSearch 2.x+ 모두 **HNSW** 채택.

## 6. HNSW — Hierarchical Navigable Small World

### 6-1. 직관

여러 층으로 된 그래프:
- 최상위 층: 노드 적음, 멀리 jump
- 하위 층: 노드 많음, 가까이 탐색
- 검색: 최상위에서 시작 → 가까운 이웃으로 이동 → 한 층 내려감 → 반복

```
Layer 2:    A ─── E ─── J          (대략적 nav)
            │     │     │
Layer 1:    A─B   E─F   J─K        (중간)
            │ │   │ │   │ │
Layer 0:    A B C D E F G H I J K  (모든 노드, 정밀 탐색)
```

검색 "쿼리와 가장 가까운 노드":
1. Layer 2 진입 → A → E → J 중 쿼리에 가까운 후보 선택
2. Layer 1 내려감 → 후보 주변의 더 정밀한 이웃 탐색
3. Layer 0 → 최종 후보

→ **logarithmic 탐색 깊이** + **그리디 navigation** = 빠른 ANN.

### 6-2. HNSW 의 3-파라미터 (시니어 면접 단골)

| 파라미터 | 의미 | 영향 |
|---|---|---|
| **M** | 노드당 평균 연결 수 (그래프 밀도) | M ↑ → 메모리 ↑, 정확도 ↑ |
| **ef_construction** | 인덱싱 시 후보 탐색 너비 | ↑ → 인덱싱 시간 ↑, 그래프 품질 ↑ |
| **ef_search** | 검색 시 후보 탐색 너비 | ↑ → 검색 latency ↑, recall ↑ |

### 6-3. 기본값과 튜닝

Lucene / ES / OpenSearch defaults:
- M = 16
- ef_construction = 100
- ef_search = 100 (또는 num_candidates)

튜닝:
- 정확도 부족 → ef_search ↑ (예: 200, 500)
- 인덱싱 너무 느림 → ef_construction ↓ (단, 그래프 품질 ↓)
- 메모리 빠듯 → M ↓ (단, 정확도 ↓)
- 정확도 매우 중요 → M=32~64, ef_construction=200~400

### 6-4. 그래프 빌드 비용

```
인덱싱 100만 doc, 1536차원, M=16, ef_construction=100:
  - 그래프 빌드: 약 1~3시간 (단일 노드 기준)
  - 메모리: 약 8~12GB (그래프 + 벡터)
```

→ 임베딩 추론 비용은 별도 (모델 따라 1초~수십 ms / doc).

### 6-5. 검색 비용

```
검색 1쿼리, 100만 doc, num_candidates=100:
  - HNSW traversal: 1~5ms
  - rank/머지: 1ms 미만
  - 총 5~10ms
```

→ 정확 kNN (1초) 대비 100~200배 빠름. recall 95~99% (튜닝에 따라).

## 7. ES dense_vector 필드

### 7-1. 매핑

```json
PUT /products
{
  "mappings": {
    "properties": {
      "embedding": {
        "type": "dense_vector",
        "dims": 1024,
        "index": true,
        "similarity": "cosine",
        "index_options": {
          "type": "hnsw",
          "m": 16,
          "ef_construction": 100
        }
      }
    }
  }
}
```

옵션:
- `dims` — 벡터 차원 (모델별 고정)
- `similarity` — `cosine` / `dot_product` / `l2_norm`
- `index: true` — HNSW 인덱스 생성 (false 면 brute force only)
- `index_options.type` — `hnsw` (현재 ES 의 유일한 선택지)
- `index_options.m` / `ef_construction` — 위 §6 참고

### 7-2. 인덱싱

```json
POST /products/_doc/1
{
  "name": "갤럭시 폴드",
  "embedding": [0.12, -0.34, 0.56, ...]
}
```

⚠ 1024 개의 float 를 매번 클라이언트에서 모델 호출해서 만들어야 함 → 인덱싱 파이프라인에 임베딩 단계 필요.

### 7-3. ingest pipeline 으로 자동 임베딩 (8.x+)

```json
PUT _ingest/pipeline/embed_pipeline
{
  "processors": [
    {
      "inference": {
        "model_id": ".my_embedding_model",
        "input_output": [
          { "input_field": "name", "output_field": "embedding" }
        ]
      }
    }
  ]
}
```

→ ES 가 인덱싱 시 자동 임베딩. 모델을 ES 에 배포해야 함 (eland 도구).

⚠ 외부 모델 (OpenAI 등) 호출은 별도 — application 레이어에서 처리.

## 8. kNN 검색

### 8-1. 기본 kNN

```json
POST /products/_search
{
  "knn": {
    "field": "embedding",
    "query_vector": [0.12, -0.34, 0.56, ...],
    "k": 10,
    "num_candidates": 100
  }
}
```

- `k` — 반환할 top-K
- `num_candidates` — HNSW 의 ef_search (탐색 후보 너비)

### 8-2. kNN + filter

```json
{
  "knn": {
    "field": "embedding",
    "query_vector": [...],
    "k": 10,
    "num_candidates": 100,
    "filter": [
      { "term": { "category": "smartphone" } },
      { "range": { "price": { "lte": 2000000 } } }
    ]
  }
}
```

→ kNN 후 필터 적용. 단, 너무 좁은 필터 + 작은 num_candidates → recall 폭락.

### 8-3. kNN + 일반 query (hybrid 의 시작)

```json
{
  "knn": { "field": "embedding", "query_vector": [...], "k": 10, "num_candidates": 100 },
  "query": { "match": { "name": "갤럭시" } }
}
```

→ ES 8.4+ 에서 둘의 score 합산 (boost 조정 가능). 본격 hybrid 는 §09 의 RRF.

### 8-4. semantic_text 필드 (8.13+)

```json
"description": {
  "type": "semantic_text",
  "inference_id": "my-elser-endpoint"
}
```

→ ES 가 매핑 정의만으로 임베딩 자동 처리. ELSER (Elastic Sparse Encoder) 와 결합.

⚠ ES 전용 (OpenSearch 미지원). 라이선스 + ES lock-in 검토.

## 9. OpenSearch 의 kNN

> **[OS 차이]** OpenSearch 의 kNN 은 별도 plugin (k-NN plugin, default 번들). API 약간 다름.

```json
PUT /products
{
  "settings": { "index": { "knn": true } },
  "mappings": {
    "properties": {
      "embedding": {
        "type": "knn_vector",
        "dimension": 1024,
        "method": {
          "name": "hnsw",
          "space_type": "cosinesimil",
          "engine": "lucene",
          "parameters": { "m": 16, "ef_construction": 100 }
        }
      }
    }
  }
}
```

- `knn_vector` (vs ES 의 `dense_vector`)
- `dimension` (vs `dims`)
- `method.name = hnsw`
- `method.engine` — `lucene` / `nmslib` / `faiss` 선택 (OpenSearch 의 강점)

검색:
```json
POST /products/_search
{
  "query": {
    "knn": {
      "embedding": { "vector": [...], "k": 10 }
    }
  }
}
```

→ ES 의 top-level `knn` 과 다른 구조. OpenSearch 가 일반 query 안에 kNN 을 넣는 구조.

### 9-1. OpenSearch 가 ES 보다 빠른 안정화

OpenSearch 가 vector search 를 ES 보다 1~2년 먼저 안정화 (NMSLIB / FAISS engine 옵션 포함). 2026 시점에는 ES 도 따라잡았지만 OpenSearch 의 vector 옵션이 더 풍부.

## 10. 인덱싱 비용 / 운영

### 10-1. dense_vector 인덱스의 특수성

- segment 별로 HNSW 그래프 빌드 → segment merge 시 그래프 재빌드 (비싼 작업)
- merge 부하 ↑ → refresh interval 보수적으로 (1s default 가 무리 가능, 30s 검토)
- replica 수 = 메모리 N배 (그래프가 메모리 캐시되어야 빠름)

### 10-2. 임베딩 모델 변경 = 전체 reindex

- 다른 모델 = 다른 벡터 공간 → 호환 ❌
- 절차:
  1. 새 인덱스 생성 (새 모델 임베딩)
  2. 모든 doc 재인덱싱 + 재임베딩 (비싼 작업)
  3. alias swap
  4. 옛 인덱스 삭제

→ 임베딩 모델은 신중히 선택. **mapping 에 model name + version 메모** (예: `_meta` 필드).

### 10-3. dimension 줄이기 (PCA / Matryoshka)

- OpenAI text-embedding-3 는 dimension 줄이기 지원 (`dimensions` 파라미터)
- Matryoshka representation = 차원 일부 잘라도 의미 유지
- 1536 → 768 → 384 로 줄이면 메모리 / 검색 비용 1/4
- 정확도 손실 측정 후 결정

## 11. msa 시사점 (잠재 적용)

현재 msa search 서비스는 BM25 only (가정). vector search 도입 시:

- 인덱스 매핑에 `embedding` 필드 추가 (dimension 1024, bge-m3 가정)
- 인덱싱 파이프라인:
  - product event 수신 (`product.item.created/updated`)
  - 임베딩 모델 호출 (외부 API 또는 self-hosted)
  - ES bulk 에 vector 포함
- 검색 API: kNN 단독 또는 hybrid (§09)
- 운영:
  - 모델 변경 시 reindex 절차 (search:batch 활용)
  - 임베딩 latency 가 인덱싱 throughput 의 병목 가능
  - dense_vector 메모리 사용량 모니터링

→ §18 에서 PoC 코드.

## 12. 흔한 실수 패턴

### 12-1. 인덱싱 / 검색 모델 불일치

```
인덱싱: bge-m3
검색: multilingual-e5-large
→ 다른 공간, 무의미
```

→ mapping 에 model 명시 + 검색 시점에 같은 모델 사용 강제.

### 12-2. dims 잘못

```
모델: 1024차원
mapping dims: 768
→ ES 거부 (인덱싱 실패)
```

### 12-3. similarity 잘못

```
모델: 정규화 안 됨
similarity: cosine  →  OK
similarity: dot_product  →  잘못된 score
```

### 12-4. num_candidates 너무 작음

```
k=10, num_candidates=10
→ recall 폭락 (HNSW 가 충분히 탐색 못 함)
```

→ num_candidates 는 보통 k × 10~20.

### 12-5. filter 가 너무 좁음

```
kNN k=10 + filter (희소 카테고리, 0.1% doc)
→ HNSW 가 거의 다 필터링당함. recall ↓
→ 해법: pre-filter 인덱스 분리 또는 num_candidates ↑
```

### 12-6. dense_vector 의 sort/agg 시도

→ dense_vector 는 sort/agg 불가. kNN search only.

### 12-7. 임베딩 모델 변경을 silent

→ 옛 doc = 옛 모델 벡터, 새 doc = 새 모델 벡터. 같은 인덱스에 섞이면 검색 품질 폭락.

## 13. 자주 듣는 오해 정정

> **"vector search 가 BM25 보다 항상 좋다"**

- ❌ 정확한 키워드 매칭 (제품 코드, 정확 이름) 은 BM25 가 우수. hybrid (§09) 가 답.

> **"HNSW 는 정확한 kNN 이다"**

- ❌ ANN (근사). recall 95~99% 가 일반적, 100% 보장 없음.

> **"dense_vector 인덱스는 BM25 보다 빠르다"**

- ⚠ 검색 자체는 빠를 수 있지만 메모리 사용량 ↑ + 인덱싱 비용 ↑.

> **"임베딩 모델은 한 번 정하면 끝"**

- ⚠ 더 좋은 모델이 계속 나옴. 1~2년마다 검토 권장 + reindex 비용 평가.

> **"kNN + filter 는 자유롭게 조합"**

- ⚠ 필터가 너무 좁으면 recall 폭락. pre-filter / 인덱스 분리 / num_candidates ↑.

> **"semantic_text 가 표준이다"**

- ⚠ ES 8.13+ 전용. OpenSearch 미지원. lock-in 위험.

## 14. 다음 학습

- [09-hybrid-search-rrf.md](09-hybrid-search-rrf.md) — BM25 + dense vector 결합
- [10-reranking-cross-encoder-ltr.md](10-reranking-cross-encoder-ltr.md) — kNN 후보를 cross-encoder 로 재정렬
- [13-indexing-pipeline-ilm.md](13-indexing-pipeline-ilm.md) — 임베딩 reindex 절차
- [18-hybrid-search-poc.md](18-hybrid-search-poc.md) — msa 의 hybrid PoC

> **§08 회독 체크리스트**:
> - [ ] vector search 가 BM25 의 어떤 한계를 보완하는가
> - [ ] 임베딩 모델 선택 기준 (한국어 / 다국어 / 차원 / 비용)
> - [ ] cosine vs dot product 의 관계
> - [ ] HNSW 의 3-파라미터 (M / ef_construction / ef_search) 와 트레이드오프
> - [ ] dense_vector 매핑의 핵심 옵션
> - [ ] kNN + filter 의 함정 (recall 폭락 시나리오)
> - [ ] 임베딩 모델 변경 = 전체 reindex 인 이유
> - [ ] ES dense_vector vs OpenSearch knn_vector 의 차이
