---
parent: 19-search-engine
seq: 41
title: 벡터 검색 고급 — kNN with filter / Vector quantization (BBQ·INT8·INT4) / OS k-NN engines (faiss·nmslib·lucene)
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 08-vector-search-hnsw.md
  - 09-hybrid-search-rrf.md
  - 11-elasticsearch-vs-opensearch.md
  - 18-hybrid-search-poc.md
  - 28-elser-semantic-text.md
  - 29-os-search-pipeline-neural.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dense-vector
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-your-data/knn-search
  - https://www.elastic.co/search-labs/blog/better-binary-quantization-lucene-elasticsearch
  - https://www.elastic.co/search-labs/blog/scalar-quantization-in-lucene
  - https://docs.opensearch.org/3.5/vector-search/k-nn
  - https://docs.opensearch.org/3.5/vector-search/optimizing-storage
  - https://docs.opensearch.org/3.5/vector-search/optimizing-storage/disk-based-vector-search
  - https://github.com/facebookresearch/faiss/wiki
catalog-row: "§M.kNN-with-filter / §M.Vector-quantization (★ → ✅), §Q.k-NN-engines / §Q.k-NN-quantization (★ → ✅)"
---

# 41. 벡터 검색 고급 — kNN with filter / Vector quantization / OS k-NN engines

> 카탈로그 매핑: §99 §M `kNN with filter`, `Vector quantization (BBQ / INT8 / INT4 / scalar)` (★ → ✅), §Q `k-NN engines (faiss / nmslib / lucene)`, `k-NN 양자화 (FP16 / INT8 / Binary) + disk-based vectors` (★ → ✅).
> 학습 시간 예상: ~2.5h · 자가평가 입구 레벨: B+

> §08 (HNSW basic) 의 위 layer. HNSW 만으로는 1억 vector × 1024d 운영이 메모리·예산상 어려움. 본 글은 (1) kNN + filter 의 pre/post 의미와 recall 함정, (2) ES Vector quantization (BBQ / INT8 / INT4) 의 메모리 절감 비율과 정밀도 손실, (3) OpenSearch 의 3-engine (faiss / nmslib / lucene) 분기 + FP16 / INT8 / Binary + disk-based 옵션, (4) 운영 reindex 패턴까지 정리. §18 PoC 의 다음 단계 (quantization 적용 / engine 선택) 가이드.

---

## 1. 한 줄 핵심

> **HNSW 는 "검색 알고리즘" 이고, quantization 은 "저장 표현" 이다 — 둘은 직교한다.**
> ES 8.x 의 BBQ (Better Binary Quantization) 는 1bit/dim 까지 압축해 32x 메모리 절감 + recall 95%+ 를 가능하게 했고, OpenSearch 는 faiss 의 PQ + IVF + disk-based vector 로 디스크에 데이터를 두고 RAM 만 그래프에 쓰는 길을 연다. 100M doc × 1024d 규모에서 quantization 결정이 RAM 비용을 수십 배 갈라낸다.

---

## 2. §08 의 한계 — 왜 본 챕터가 필요한가

§08 에서 다룬 것:
- HNSW 의 3-파라미터 (M / ef_construction / ef_search)
- dense_vector 매핑 + kNN search 기본형
- ES vs OS 의 매핑 syntax 차이 (한 절)

§08 에서 다루지 못한 것 (= 본 글의 영역):

| 빠진 영역 | 본 글 §  |
|---|---|
| filter 의 pre vs post 의미 + recall 영향 | §3 |
| `num_candidates` 와 `ef_search` 의 정확한 관계 + 정확도 모델 | §4 |
| `similarity` 4종 (cosine / dot / l2 / max_inner_product) 도메인 매칭 | §5 |
| ES 의 vector quantization 4종 (flat / int8_hnsw / int4_hnsw / bbq_hnsw) | §6 |
| OS 의 3 engine (faiss / nmslib / lucene) + 각 engine 의 sub-알고리즘 (HNSW / IVF / PQ) | §7 |
| OS 의 양자화 (FP16 / INT8 / Binary) + disk-based vectors | §8 |
| 메모리 / 디스크 / latency 의 정량 모델 (1억 doc 시나리오) | §9 |
| reindex 로 quantization 변경하는 운영 패턴 | §10 |

> §08 = "벡터 검색 입문", §41 = "벡터 검색 운영 / 비용 최적화" 로 직교 분담.

---

## 3. kNN with filter — pre-filter vs post-filter

### 3-1. 두 가지 결합 시점

```
[query vector] ──→ [HNSW traverse] ──→ [filter] ──→ [top-k]   ← post-filter (naive)
[query vector] ──→ [filter aware HNSW] ──→ [top-k]              ← pre-filter (ES 8.x 기본)
```

ES 8.x 의 `knn.filter` 는 **pre-filter** — HNSW 가 그래프 탐색 중에 필터를 평가하면서 후보를 좁힘. OpenSearch 의 `knn` query 안 `filter` 는 engine 에 따라 다름 (lucene = pre-filter, faiss = post-filter 가 기본, 옵션으로 변경 가능).

### 3-2. 의미 차이

| 방식 | 동작 | recall 영향 | latency 영향 |
|---|---|---|---|
| **post-filter** | HNSW 로 top-N (예: 100) → filter → 남는 doc 만 반환 | 필터 매치 doc 이 top-N 밖에 있으면 누락 → recall 폭락 | 그래프 탐색은 가벼움 |
| **pre-filter** | 그래프 탐색하면서 매 candidate 마다 filter 평가, 매치만 셈 | 정확함 (단, 매치율 낮으면 탐색 거리 폭증) | 매치율 ↓ → 그래프 더 깊게 봐야 → latency ↑ |

### 3-3. 매치율과 recall 의 관계 (수치 직관)

```
1억 doc, k=10, num_candidates=100, filter 매치율 1% (= 100만 doc)
  post-filter:
    top-100 중 평균 1개만 매치 (1%) → top-10 못 채움 → recall 거의 0
  pre-filter:
    HNSW 가 매치까지 100개 모을 때까지 탐색 → ef_search 가 자연스럽게 ↑ → 정확하지만 latency ↑
```

⚠ 매치율이 0.1% 이하로 떨어지면 pre-filter 도 탐색이 폭증해 brute-force 보다 느릴 수 있음. ES 는 이를 감지해 자동으로 brute-force 로 fallback (8.6+).

### 3-4. ES 의 dynamic switching (8.6+)

ES 8.6 부터 `knn.filter` 가 매치 doc 비율을 추정해 다음 분기:

```
estimated_matches / total_docs < threshold(0.01~0.05) ?
  yes → exact kNN (filtered docs 만 brute force)
  no  → HNSW with filter aware traversal
```

→ 사용자는 `filter` 를 그냥 쓰고, ES 가 알아서 빠른 길 선택. OS 는 engine 별로 다름 (§7).

### 3-5. 안티패턴 정리

```
1) filter 가 매우 좁음 (0.01% 매치) + post-filter
   → recall ≈ 0, "왜 결과가 없냐" 버그처럼 보임

2) filter 가 매우 좁음 + pre-filter + 작은 num_candidates(=k)
   → 그래프 탐색이 충분히 못 가서 빈번하게 timeout

3) filter 안에 무거운 query (script / wildcard)
   → 매 candidate 마다 평가 → 그래프 탐색 비용 폭증
```

권장:
- filter 는 **간단한 term/range** 만 (script ❌)
- 매치율 < 1% → **인덱스 분리 검토** (per-tenant / per-category index)
- ES 라면 8.6+ 사용 — dynamic switching 활용

→ §08 §12-5 ("filter 가 너무 좁음") 의 정량 보강.

---

## 4. num_candidates / ef_search / 정확도 모델

### 4-1. 두 이름, 거의 같은 것

| 시스템 | 이름 | 의미 |
|---|---|---|
| Lucene 내부 | `efSearch` | HNSW 탐색 중 유지하는 후보 큐 크기 |
| ES kNN API | `num_candidates` | shard 별 efSearch 와 같음, 최종은 합쳐서 top-k |
| OS k-NN (lucene engine) | `k` (검색 시) + index time `ef_search` | 양쪽 다 효과 있음 |
| OS k-NN (faiss/nmslib) | `ef_search` (index parameter) | 검색 시점에는 query 안 `k` 만 |

### 4-2. 정확도 (recall) 와 num_candidates

경험식 (소규모~중규모, M=16 기준):

```
recall ≈ 1 - exp(- ef_search / (k × α))
α ≈ 1.5~3 (도메인/모델/임베딩 분포에 따라)
```

실험치 (1M doc, 768d, M=16, ef_construction=100):

| num_candidates | recall@10 | latency p99 |
|---|---|---|
| 10  | 0.55 | 2 ms |
| 50  | 0.88 | 4 ms |
| 100 | 0.95 | 6 ms |
| 200 | 0.98 | 11 ms |
| 500 | 0.995 | 28 ms |
| 1000 | 0.999 | 60 ms |

→ **k 의 10~20 배** 가 sweet spot. 그 이상은 한계 효용 체감.

### 4-3. shard 와의 상호작용

ES 의 `num_candidates` 는 **shard 마다** 적용:
```
shard 5개, num_candidates=100, k=10
→ shard 마다 100 후보 → shard 마다 top-10 → coordinator 가 50개 → 최종 top-10
```

⚠ shard 수가 많으면 같은 num_candidates 라도 더 많은 후보를 본 효과 (over-fetch) → 정확도 ↑, 비용 ↑. 반대로 over-shard 하면 shard 마다 그래프가 얕아져 recall ↓ → §12 (cluster topology) 참조.

### 4-4. Adaptive ef_search

ES 9.x / OS 2.16+ 부터 query-time 에 ef_search 를 별도로 넘길 수 있음. recall SLO 가 빡빡한 endpoint 만 ef_search ↑ 하고, 일반 endpoint 는 default 유지하는 패턴 가능.

---

## 5. similarity 함수 — 도메인별 선택

### 5-1. 4종 비교

| similarity | 수식 | 정규화 요구 | 도메인 |
|---|---|---|---|
| `cosine` | `(A·B) / (|A|·|B|)` | 무관 | 텍스트 임베딩 일반 (가장 흔함) |
| `dot_product` | `A·B` | **반드시 정규화 (norm=1)** | 정규화된 텍스트 임베딩 — cosine 보다 빠름 |
| `l2_norm` | `√Σ(Aᵢ-Bᵢ)²` | 무관 | 이미지 / CV embedding, 절대 거리 의미 있는 도메인 |
| `max_inner_product` | `A·B` (정규화 가정 없이) | 안 함 | LLM-style retriever (DPR / ColBERT). 길이가 정보 |

### 5-2. score 변환

ES 는 모든 similarity 를 `_score >= 0` 으로 정규화해 반환:

```
cosine    → (1 + cos) / 2          ∈ [0, 1]
dot       → (1 + dot) / 2          ∈ [0, 1] (정규화 가정)
l2        → 1 / (1 + l2²)          ∈ (0, 1]
max_inner → if dot ≥ 0 → dot+1, else 1/(1-dot)  ∈ (0, ∞)
```

⚠ hybrid 검색 (§09 RRF) 에서 score 단위가 다르면 weighted sum 이 무의미. RRF 처럼 rank 만 쓰는 결합이 안전.

### 5-3. 모델별 권장

| 모델 | 정규화 | similarity |
|---|---|---|
| OpenAI text-embedding-3-* | norm=1 | `cosine` 또는 `dot_product` (둘이 동일) |
| sentence-transformers (대부분) | norm=1 | `cosine` |
| bge-m3 | norm=1 | `cosine` |
| multilingual-e5-large | norm=1 (모델 출력 시) | `cosine` |
| CLIP image embedding | norm=1 | `cosine` |
| DPR (Dense Passage Retrieval) | **정규화 안 됨** | `max_inner_product` |
| ColBERT 의 token-level | 정규화 안 됨 | `max_inner_product` |

권장 디폴트: 잘 모르겠으면 `cosine`. 모델 docs 가 "we recommend dot product" 면 `dot_product` (그리고 정규화 검증).

### 5-4. 함정

```
모델: norm=1 출력
similarity: dot_product
→ OK, cosine 과 동치, 빠름

모델: norm=1 출력 안 함 (raw)
similarity: dot_product
→ score 가 vector 길이에 좌우됨 → 잘못된 유사도

모델: raw
similarity: cosine
→ ES 가 매번 norm 계산 → 약간 느림, 정확함
```

→ §08 §12-3 의 정밀 보강.

---

## 6. ES Vector quantization

### 6-1. 왜 양자화가 필요한가

원본 (float32) 비용:
```
1억 doc × 1024 dim × 4 bytes = 400 GB (벡터만)
+ HNSW 그래프: 1억 × 16 × 8 bytes ≈ 12 GB (M=16, edge per node ≈ 32, edge size ≈ 8 bytes)
≈ 412 GB
```

이를 모두 RAM 에 올리려면 노드 32~64 개 — 비현실적. 양자화로 RAM 4~32 배 감소 가능.

### 6-2. ES 의 4가지 index_options.type (8.7+)

| type | 표현 | 메모리 (vs flat) | 정확도 (recall@10) | 비고 |
|---|---|---|---|---|
| `flat` (= 8.6 이전 기본) | float32 그대로 | 1.0x (= 4 bytes/dim) | 100% | rerank 용으로 보존 |
| `int8_hnsw` (8.7+, 8.13+ default) | int8 (scalar quantization) | 0.25x (= 1 byte/dim) | 99% | 가장 안전한 절감 |
| `int4_hnsw` (8.14+) | int4 packed | 0.125x (= 0.5 byte/dim) | 95~98% | 정밀 손실 약간 |
| `bbq_hnsw` (8.15+) | 1-bit per dim + scalar correction | 0.03125x (= 1 bit/dim) | 90~95% (rerank 시 99%+) | rerank 필수 |

### 6-3. INT8 scalar quantization

각 dimension 의 float32 값을 [min, max] 구간으로 mapping → int8 (-128~127):

```
quantized[i] = round((raw[i] - min) / (max - min) × 255 - 128)
```

per-dimension 또는 per-vector 의 min/max 보정. ES 는 segment 마다 quantile 기반 (q=0.99) 으로 outlier 의 영향을 줄임.

매핑 예:
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
          "type": "int8_hnsw",
          "m": 16,
          "ef_construction": 100,
          "confidence_interval": 0.95
        }
      }
    }
  }
}
```

→ recall 손실 1% 미만, 메모리 4x 절감. **2026 시점 dense_vector 의 default 권장**.

### 6-4. INT4 quantization

각 dim 을 4-bit (16 단계) 로 더 압축. 두 dim 을 1 byte 에 packing:
```
1 byte = [hi 4-bit | lo 4-bit] ← dim_2k 와 dim_2k+1
```

매핑:
```json
"index_options": { "type": "int4_hnsw", "m": 16, "ef_construction": 100 }
```

- 메모리 8x 절감
- recall 95~98% (도메인 따라)
- 검색 SIMD optimization 으로 INT8 보다 느리지 않음 (오히려 빠를 수 있음 — cache hit 향상)

### 6-5. BBQ — Better Binary Quantization (Elastic 8.15+)

핵심 아이디어:
1. 각 dim 의 sign 만 1-bit 로 저장 (true binary)
2. 추가로 vector 별 magnitude (스칼라) 1개 저장
3. 검색 시 hamming distance + magnitude 보정 → 거친 score 산출
4. **rerank 단계에서 원본 (또는 INT8) 으로 정확 score 재계산**

```
저장: 1024d × 1 bit = 128 bytes (+ 4 bytes magnitude ≈ 132 bytes)
원본: 1024d × 4 bytes = 4096 bytes
비율: ~32x 절감
```

매핑 + rerank:
```json
{
  "mappings": {
    "properties": {
      "embedding": {
        "type": "dense_vector",
        "dims": 1024,
        "similarity": "cosine",
        "index_options": { "type": "bbq_hnsw", "m": 16, "ef_construction": 100 }
      }
    }
  }
}
```

```json
POST /products/_search
{
  "knn": {
    "field": "embedding",
    "query_vector": [...],
    "k": 10,
    "num_candidates": 200,
    "rescore_vector": { "oversample": 3.0 }
  }
}
```

→ `rescore_vector.oversample = 3.0` 은 num_candidates 의 3배를 가져와 원본 (raw float) 으로 재계산. recall 95→99%+ 회복.

⚠ 주의: BBQ 는 raw float 도 segment 에 함께 저장 (rerank 용). RAM 절감은 hot path 만 — 디스크는 여전히 큼. heap 가 아닌 RAM(off-heap) 에서 1bit 만 들고 다닌다는 의미.

### 6-6. flat / hnsw / quantization 조합 정리

```
flat       → brute force, float32   → 작은 인덱스 / rerank용 / ground truth
hnsw       → graph,        float32   → 8.6 이전 default, 메모리 큼
int8_hnsw  → graph,        int8      → 권장 default (8.13+)
int4_hnsw  → graph,        int4      → 메모리 빠듯한 경우
bbq_hnsw   → graph,        binary+rerank → 1억+ doc 운영
```

### 6-7. 메모리 절감 효과 정량 (1억 × 1024d 가정)

| 옵션 | RAM (벡터만) | + 그래프 | 합계 | recall@10 |
|---|---|---|---|---|
| flat (float32) | 400 GB | 12 GB | 412 GB | 100% |
| int8_hnsw | 100 GB | 12 GB | 112 GB | 99% |
| int4_hnsw | 50 GB | 12 GB | 62 GB | 96% |
| bbq_hnsw (no rerank) | 12.5 GB | 12 GB | 24.5 GB | 92% |
| bbq_hnsw (oversample=3) | 12.5 GB + raw 디스크 | 12 GB | 24.5 GB RAM + 디스크 | 99% |

→ BBQ 가 RAM 17x 절감. 노드 수 17x ↓, 비용 비슷한 비율로 ↓.

---

## 7. OS k-NN engines — faiss / nmslib / lucene

### 7-1. 3-engine 의 사연

OpenSearch 는 처음부터 vector search 를 별도 plugin (k-NN plugin) 으로 분리하면서 **알고리즘 백엔드를 교체 가능**하게 설계. ES 가 lucene 만 쓰는 것과 대조.

| engine | 라이브러리 | 알고리즘 | 메모리 | 강점 | 약점 |
|---|---|---|---|---|---|
| **lucene** | Apache Lucene | HNSW | heap | ES 와 동등, 매핑 호환, segment merge 안정 | IVF/PQ 미지원 |
| **nmslib** | non-metric space lib (deprecated 진행) | HNSW | off-heap (mmap) | 안정적, 첫 OS 1.x 부터 | 신규 기능 (filter aware) 부족 |
| **faiss** | Facebook AI similarity search | HNSW + IVF + PQ + GPU 옵션 | off-heap | 대규모 (1억+), 양자화 풍부 | tuning 어려움, segment merge 느림 |

### 7-2. faiss 의 sub-알고리즘

faiss engine 안에서 다시 method 선택:

```json
"method": {
  "name": "hnsw",          // 또는 "ivf"
  "space_type": "cosinesimil",
  "engine": "faiss",
  "parameters": {
    "m": 16,
    "ef_construction": 100,
    "encoder": {
      "name": "pq",        // product quantization
      "parameters": { "code_size": 8, "m": 16 }
    }
  }
}
```

옵션:
- **HNSW (단독)**: ES 와 동급
- **IVF (Inverted File)**: 벡터를 K 개 cluster (centroid) 로 나눔 → 검색 시 가까운 N 개 cluster 만 탐색. 1억+ 에서 HNSW 보다 빌드 빠름, 정확도 약간 낮음
- **HNSW + PQ (Product Quantization)**: HNSW 그래프 + PQ 압축 (각 vector 를 sub-vector 별 codebook index 로). 메모리 8~16x 절감
- **IVF + PQ**: 가장 압축적. 1억+ 운영의 표준 (Faiss recipe 의 OPQ + IVF + PQ)

### 7-3. 어떤 engine 을 쓸 것인가

```
규모 < 1천만, ES 와 호환성 중요             → lucene
규모 < 1억, 안정성 우선                       → lucene (2026 기준)
규모 1억+, 메모리 빠듯, IVF/PQ 필요          → faiss
GPU 가속 있는 환경                            → faiss
nmslib                                        → 새 인덱스에는 비권장 (legacy 유지용)
```

### 7-4. engine 별 filter 지원

| engine | filter 동작 | 비고 |
|---|---|---|
| lucene | pre-filter (ES 와 동일) | 권장 |
| faiss | post-filter (default) → `efficient_filter` 옵션으로 pre-filter (2.10+) | 옵션 명시 필요 |
| nmslib | post-filter only | filter 강한 워크로드에 부적합 |

→ filter 무거운 워크로드는 lucene engine 유지가 안전.

### 7-5. 매핑 비교 (ES vs OS 3-engine)

```jsonc
// ES (8.13+)
{
  "type": "dense_vector",
  "dims": 1024,
  "similarity": "cosine",
  "index_options": { "type": "int8_hnsw", "m": 16, "ef_construction": 100 }
}

// OS lucene engine
{
  "type": "knn_vector",
  "dimension": 1024,
  "method": {
    "name": "hnsw",
    "space_type": "cosinesimil",
    "engine": "lucene",
    "parameters": { "m": 16, "ef_construction": 100 }
  }
}

// OS faiss engine + IVF + PQ
{
  "type": "knn_vector",
  "dimension": 1024,
  "method": {
    "name": "ivf",
    "space_type": "innerproduct",
    "engine": "faiss",
    "parameters": {
      "nlist": 4096,
      "nprobes": 16,
      "encoder": { "name": "pq", "parameters": { "code_size": 8, "m": 16 } }
    }
  }
}
```

---

## 8. OS quantization + disk-based vectors

### 8-1. OS 의 양자화 옵션 (engine 별)

| engine | 옵션 | 메모리 | 특이점 |
|---|---|---|---|
| lucene | (없음) | float32 | 2.18+ scalar quantization 지원 검토 중 |
| faiss | FP16 / INT8 / Binary / PQ | 2x / 4x / 32x / 8~32x | 풍부 |
| nmslib | (없음) | float32 | EOL 진행 |

faiss FP16:
```json
"encoder": { "name": "fp16" }
```
→ 메모리 절반, 정밀도 손실 미미.

faiss Binary (1-bit):
```json
"data_type": "binary",
"space_type": "hamming"
```
→ 입력부터 1-bit (사전 학습된 binary embedding 모델). hamming distance 검색.

### 8-2. Disk-based vector search (OS 2.17+)

핵심 아이디어:
- 풀 정밀도 (float32) 벡터는 **디스크** 에 저장
- HNSW 그래프 + quantized (binary) 표현만 RAM
- 검색: HNSW + binary 로 후보 → 디스크에서 풀 정밀도 fetch → rerank

```json
{
  "type": "knn_vector",
  "dimension": 1024,
  "mode": "on_disk",
  "compression_level": "32x",
  "method": {
    "name": "hnsw",
    "space_type": "innerproduct",
    "engine": "faiss",
    "parameters": { "m": 16, "ef_construction": 100 }
  }
}
```

옵션 `compression_level`: `1x` / `2x` / `4x` / `8x` / `16x` / `32x`. 32x = ES BBQ 와 동급. 디스크 IO 가 추가되지만 NVMe 면 latency 증분 작음.

### 8-3. ES BBQ vs OS on_disk 32x 비교

| 항목 | ES BBQ | OS on_disk 32x |
|---|---|---|
| RAM (1억 × 1024d) | ~25 GB | ~25 GB |
| 디스크 | full float32 보존 | full float32 보존 |
| rerank | `rescore_vector.oversample` | 자동 (engine 내부) |
| recall@10 | 99% (oversample=3) | 95~99% (compression_level 따라) |
| GA 시점 | ES 8.15 (2024) | OS 2.17 (2024) |
| filter 친화 | ES 8.6+ dynamic | engine 따라 |

→ 두 엔터프라이즈가 같은 결론에 비슷한 시기에 도착. 운영자 입장에서는 **거의 동등** — 선택은 ES vs OS 라이선스 / 생태계로 결정.

---

## 9. 비용 모델 — RAM / disk / latency

### 9-1. 1억 doc × 768d 시나리오

가정:
- 1억 doc, 768d, M=16, ef_construction=100
- 노드 RAM 32 GB / 디스크 NVMe 1TB
- replica = 1

| 옵션 | RAM/노드 필요 | 노드 수 | latency p99 | recall@10 |
|---|---|---|---|---|
| flat (float32) | 320 GB total | ~10 | 6 ms | 100% |
| int8_hnsw | 80 GB | ~3 | 7 ms | 99% |
| int4_hnsw | 40 GB | ~2 | 8 ms | 96% |
| bbq_hnsw + rerank | 12 GB RAM + 디스크 | ~1 | 12 ms | 99% |
| OS faiss IVF+PQ | 15 GB | ~1 | 15 ms | 95% |
| OS on_disk 32x | 12 GB RAM | ~1 | 18 ms | 97% |

→ 동일 recall 목표 (99%) 라면 **bbq + rerank** 가 노드 10x 절감.

### 9-2. 인덱싱 비용

```
1억 doc HNSW build (lucene, M=16, ef_construction=100):
  - 단일 노드 기준 ~12~24 시간
  - 임베딩 추론 별도 (모델·하드웨어 따라 hours~days)

faiss IVF + PQ:
  - centroid 학습 (sample 100K~1M)
  - 빠른 인덱싱 (HNSW 보다 2~5x 빠름)
```

### 9-3. 디스크

quantization 적용해도 raw float 가 segment 에 남는 옵션 (rerank 용) 이 일반적:
- ES BBQ: float32 raw + bbq compressed → 디스크 = 원본 + α
- OS on_disk 32x: float32 raw → 디스크 = 원본 + α

→ **디스크는 양자화로 줄지 않음. RAM 만 준다**. 오해 주의.

---

## 10. 운영 패턴 — quantization 전환

### 10-1. 매핑은 immutable

dense_vector 의 `index_options.type` 은 매핑 단계 고정. 변경하려면 reindex.

### 10-2. 무중단 reindex 절차

```
1) 새 인덱스 (alias 미연결) 생성 — int8_hnsw 또는 bbq_hnsw 매핑
2) reindex API 또는 search:batch 로 데이터 복사
   - 기존 vector 가 raw float 로 저장되어 있어야 함 (재임베딩 불요)
3) ground truth 평가 (sample 1K query)
   - recall@10 회귀 검사 (95% 이상 유지)
4) alias swap (atomic)
5) 옛 인덱스 삭제 (snapshot 후)
```

⚠ vector 만 quantization 바꾸는 reindex 는 **임베딩 비용 0** (raw vector 가 있다면). 임베딩 모델 변경과 혼동 금지.

### 10-3. A/B 테스트 패턴

```
- index-a (int8_hnsw)  ← 50% traffic
- index-b (bbq_hnsw)   ← 50% traffic
- 동일 query 로 양쪽 호출 → recall@10, p99 latency, click-through 비교
- 1주~2주 후 winner 선정
```

§09 의 hybrid 평가 / experiment 서비스 (msa) 와 결합 가능.

### 10-4. 점진 전환 (인덱스 단계별)

```
phase 1: flat (검증)
phase 2: int8_hnsw (default 권장 적용, recall -1% 확인)
phase 3: bbq_hnsw + rerank (대규모 진입 시)
```

각 phase 의 latency / recall / RAM / 비용 표를 ADR 에 기록.

---

## 11. 안티패턴 모음

### 11-1. post-filter 를 모르고 `filter` 쓰기 (OS faiss default)

```
OS, faiss engine, query 안 filter → post-filter
filter 매치율 1% → recall@10 ≈ 0
```

→ `efficient_filter: true` 명시 또는 lucene engine.

### 11-2. num_candidates = k

```
k=10, num_candidates=10 → recall ≈ 50~60% (도메인 따라)
```

→ 최소 k×10. 권장 k×10~20.

### 11-3. dimension 너무 큼

```
3072d 모델 사용, 1억 doc × float32 → 1.2 TB 벡터만
```

→ Matryoshka representation (768d 까지 자르기) 또는 다른 모델. ES BBQ 라도 1bit/dim × 3072 = 384 bytes/vec × 1억 = 38 GB — 여전히 부담.

### 11-4. similarity 잘못 — score 가 음수처럼 보임

```
모델: norm 안 한 출력
similarity: dot_product
→ score 가 vector 길이에 좌우, 직관과 어긋남
```

→ 모델 docs 확인. 정규화 안 됐으면 `cosine` 또는 `max_inner_product`.

### 11-5. quantization 후 raw 재임베딩

```
bbq_hnsw 적용했는데 새 doc 인덱싱 시 raw float 가 없음
→ rerank 불가, recall 폭락
```

→ raw float 도 함께 인덱싱해야 함 (기본은 함께 저장).

### 11-6. filter 안 무거운 query

```
"filter": [{ "script": { "source": "doc['price'].value > params.x", ... } }]
→ 매 candidate 마다 script 평가 → 그래프 탐색 비용 폭증
```

→ filter 는 term/range 만. 복잡한 조건은 별도 인덱스 또는 후처리.

### 11-7. shard 너무 많음

```
shard 50개, 100만 doc → shard 마다 2만 vector → 그래프 너무 얕음 → recall ↓
```

→ shard 마다 최소 10만~100만 vector 권장. §12 cluster topology 와 연동.

### 11-8. BBQ 매핑인데 oversample 누락

```
bbq_hnsw 매핑, knn 쿼리 rescore_vector 누락
→ binary score 만 사용 → recall 92% 정도에 그침
```

→ BBQ 는 oversample 거의 필수. PoC 단계부터 함께 검증.

---

## 12. msa 적용 — §18 PoC 의 다음 단계

§18 의 hybrid PoC 가 다음 결정을 미뤄둠 (PoC 단계라 자연스러움):
- vector quantization 미적용 (flat / hnsw 기본)
- ES vs OS engine 선택 보류
- recall / cost 정량 측정 부재

본 글의 적용 단계:

### 12-1. dense_vector 매핑 — 본격 적용 시

```kotlin
// search/app/src/main/kotlin/.../EsMappings.kt (예시 위치)
val productEmbeddingMapping = """
{
  "type": "dense_vector",
  "dims": 1024,
  "similarity": "cosine",
  "index_options": {
    "type": "int8_hnsw",
    "m": 16,
    "ef_construction": 100
  }
}
""".trimIndent()
```

→ §18 의 ProductEsDocument 매핑에서 `index_options.type` 을 `int8_hnsw` 로 바꾸는 것이 첫 단계.

### 12-2. 규모별 선택 가이드

| msa 규모 | 권장 |
|---|---|
| product < 1M | flat 또는 int8_hnsw (RAM 충분) |
| product 1M~10M | **int8_hnsw** (default 권장) |
| product 10M~1억 | int4_hnsw 또는 bbq_hnsw (rerank) |
| product 1억+ | bbq_hnsw + rerank, 또는 OS faiss IVF+PQ |

msa 의 product 카탈로그가 1M~10M 규모로 상정 — `int8_hnsw` 가 sweet spot.

### 12-3. ES 8.x 잔류 vs OS 전환 의사결정

§11 (ES vs OS) 에서 다룬 비교에 vector 관점 추가:

- **ES 잔류 시**: BBQ + rescore_vector + dynamic filter switching → 단순함, 통합 잘됨
- **OS 전환 시**: faiss engine + on_disk 옵션 → 1억+ 규모에서 비용 우위, 단 운영 복잡도 ↑

→ msa 1M~10M 규모에서는 양쪽 동등, 라이선스 / 생태계로 결정.

### 12-4. 측정 표준 (§09 와 연동)

PoC 다음 단계의 measurement plan:
- recall@10: 100 query × ground truth (flat 인덱스) 비교
- p99 latency: 부하 테스트 (k6 or gatling)
- RAM 사용량: `_nodes/stats?metric=indices,jvm`
- 디스크: `_cat/segments`

ADR 에 기록할 결과 양식:
```
| 옵션 | recall@10 | p99 (ms) | RAM (GB) | 비고 |
|---|---|---|---|---|
| flat | 1.000 | 6 | 40 | baseline |
| int8_hnsw | 0.992 | 7 | 10 | -1% recall, 4x RAM 절감 |
| bbq_hnsw + rerank=3 | 0.989 | 12 | 1.3 | -1.1% recall, 32x RAM 절감 |
```

---

## 13. ADR 후보 — 벡터 인덱스 quantization 표준

> `study/docs/00-ADR-CANDIDATES.md` 추가 후보.

### ADR-XXX. 벡터 인덱스 quantization 표준

**Context**:
- msa search 서비스에 hybrid (BM25 + vector) 도입 시 dense_vector 인덱스가 GB 단위로 증가
- §18 PoC 는 quantization 미적용 (flat) 으로 시작
- 운영 진입 시 RAM 비용과 recall 의 trade-off 결정 필요

**Decision (안)**:
1. dense_vector 의 default 매핑은 `int8_hnsw` (recall -1%, RAM 4x 절감)
2. 인덱스가 1천만 doc 초과 시 `bbq_hnsw + rescore_vector(oversample=3)` 검토
3. 모든 vector 인덱스는 raw float 도 함께 저장 (rerank / 검증용)
4. similarity 는 모델 출력 정규화 여부 검증 후 `cosine` (default) 또는 `dot_product`
5. filter 는 term/range 만 (script 금지) — pre-filter 활용

**Consequences**:
- (+) RAM 4~32x 절감 → 노드 비용 감소
- (+) recall 손실 1~5% — A/B 테스트로 비즈니스 영향 측정
- (−) 매핑 immutable → 변경 시 reindex 필요
- (−) BBQ 는 raw float 도 디스크에 보관 → 디스크는 줄지 않음

**Alternatives**:
- OpenSearch 전환 + faiss IVF+PQ: 1억+ 시점에 재검토
- 차원 축소 (Matryoshka 768→512): 모델 변경 없이 적용 가능, 단 학습 검증 필요

---

## 14. 면접 한 줄 답변

> **Q. ES 의 BBQ 가 32x 메모리 절감하는 원리는?**
> A. dimension 별로 sign(+/−) 만 1-bit 로 저장 (1024d → 128 bytes) + magnitude 1 scalar. 검색은 hamming + magnitude 보정으로 거친 score → rerank 단계에서 raw float 으로 정확 score. recall 손실은 oversample 로 회복.

> **Q. kNN 의 pre-filter 와 post-filter 차이는?**
> A. pre-filter 는 HNSW 가 그래프 탐색 중에 filter 평가 — 정확하지만 매치율 낮으면 탐색 비용 ↑. post-filter 는 top-N 받은 후 filter — 매치율 낮으면 recall 폭락. ES 8.6+ 는 매치율 추정해 자동 분기.

> **Q. num_candidates 와 k 의 관계?**
> A. num_candidates = HNSW 의 ef_search. shard 별로 적용. 권장 k×10~20. 너무 작으면 recall ↓, 너무 크면 latency ↑.

> **Q. OpenSearch 의 3 engine 중 무엇을 쓰나?**
> A. 1억 미만이면 lucene (ES 와 동급, filter 안전). 1억+ 면 faiss (IVF+PQ + GPU 가능). nmslib 는 legacy, 신규 인덱스에는 비권장.

> **Q. similarity 4종 중 max_inner_product 는 언제?**
> A. 정규화 안 된 임베딩 (DPR / ColBERT) 처럼 vector 길이가 정보를 담는 경우. cosine / dot 은 norm=1 가정.

> **Q. quantization 변경하려면?**
> A. dense_vector 매핑 immutable → 새 인덱스 + reindex. raw float 보존돼 있으면 재임베딩 불필요. ground truth 로 recall 회귀 검증 후 alias swap.

> **Q. BBQ 가 디스크도 줄여주나?**
> A. 아니다. BBQ 는 RAM 의 hot path 만 1-bit. raw float 은 segment 에 함께 저장 (rerank 용). 디스크는 오히려 약간 증가.

> **Q. filter 매치율 0.1% 인 kNN 의 권장 패턴은?**
> A. 인덱스 분리 (per-tenant / per-category). 한 인덱스에서 좁은 filter 는 pre-filter 라도 그래프 탐색 폭증. ES 8.6+ 는 brute-force 자동 fallback.

---

## 15. 회독 체크리스트

- [ ] ES 의 4-옵션 (flat / int8_hnsw / int4_hnsw / bbq_hnsw) 의 메모리 비율 즉답
- [ ] BBQ 의 동작 단계 (binary 저장 → hamming → rerank) 설명 가능
- [ ] kNN with filter 의 pre vs post 의미 + recall 영향 그림
- [ ] num_candidates 와 ef_search 의 관계 + recall 경험식
- [ ] similarity 4종의 정규화 요구 + 도메인
- [ ] OS 의 3-engine 비교표 + faiss 의 IVF/PQ 의미
- [ ] disk-based vector 의 저장 구조 (RAM = binary, disk = raw)
- [ ] msa 1M~10M 규모 권장 = `int8_hnsw` 의 근거 (recall / RAM)
- [ ] reindex 절차 5단계 (생성 → reindex → 검증 → swap → 삭제)
- [ ] 안티패턴 8개 중 5개 이상 즉답

---

## 16. 연결 학습

| 이전 | 다음 |
|---|---|
| §08 (HNSW basic) | §41 (본 글) |
| §41 (양자화 / engine) | §09 (RRF hybrid) — score 결합 |
| §41 | §18 (PoC) — 적용 단계 |
| §41 | §11 (ES vs OS) — engine 선택 컨텍스트 |
| §41 | §28 (ELSER / semantic_text) — sparse 트랙 비교 |

추후 보강 후보:
- ColBERT / late interaction 모델 (현재 ES/OS 미지원, 수동 구현)
- Matryoshka representation 의 운영 자르기 패턴
- GPU 가속 (faiss-gpu) 의 인덱싱 / 검색 가속 측정

---

## 부록 A. 빠른 참조 — quantization 의사결정 트리

```
규모는?
  < 1M           → flat 또는 int8_hnsw (RAM 충분)
  1M ~ 10M       → int8_hnsw (default)
  10M ~ 100M     → int4_hnsw 또는 bbq_hnsw + rerank
  > 100M         → bbq_hnsw + rerank, 또는 OS faiss IVF+PQ + on_disk

filter 매치율은?
  > 10%          → pre-filter (ES) / lucene (OS) 그대로
  1% ~ 10%       → pre-filter, num_candidates 2~3x
  < 1%           → 인덱스 분리 검토 / brute-force (ES 8.6+)

recall SLO 는?
  > 99%          → flat 또는 int8_hnsw, oversample 3x
  95~99%         → int4_hnsw / bbq_hnsw + rerank
  < 95%          → bbq_hnsw 단독 (rerank 없이)

similarity 는?
  텍스트 (norm=1)         → cosine 또는 dot_product
  텍스트 (norm 없음)       → cosine
  CLIP / 이미지           → cosine
  DPR / late interaction → max_inner_product
  CV / geometric         → l2_norm
```
