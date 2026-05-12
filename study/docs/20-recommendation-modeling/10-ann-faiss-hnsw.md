---
parent: 20-recommendation-modeling
seq: 10
title: ANN 인덱스 deep-dive — FAISS · HNSW · Annoy · ScaNN, ef_construction/M trade-off
type: deep
created: 2026-05-12
---

# 10. ANN 인덱스 deep-dive

> **사용자 약점 deep-dive**. ANN (Approximate Nearest Neighbor, 근사 최근접 이웃) 인덱스 4종 비교 + HNSW 파라미터 (M, ef_construction, ef_search) 의 trade-off 측정. #19 §08 의 보강 + 추천 관점.

---

## 1. ANN 의 필요성 — Brute Force 의 한계

### 1-1. 문제

```
사용자 query embedding: 768차원 vector
검색 대상: 1억 item embedding
   각 비교: 768 dim cosine = ~1500 flops
   1억 비교: 1.5 × 10¹¹ flops = ~150 ms (NVMe SSD 기준 메모리 IO 포함)
```

단일 query 에 150ms — 추천 retrieval latency budget (~50ms, §01 §4-1) 초과. 1000 QPS 면 더 심각.

### 1-2. ANN 의 해결

**정확한 nearest neighbor 대신 근사 nearest neighbor**:
- 정확도 100% → 99% 로 살짝 양보
- latency 100배 단축
- recall@10 ≈ 99% 일반적

산업 표준 — 거의 모든 vector 검색이 ANN.

---

## 2. ANN 인덱스 4종 — 알고리즘 비교

### 2-1. FAISS (Meta, 2017)

```
구조: 여러 알고리즘 통합 라이브러리
   - IndexFlatL2 / IndexFlatIP: brute force (정확)
   - IndexIVFFlat: inverted file (cluster)
   - IndexIVFPQ: IVF + Product Quantization (압축)
   - IndexHNSWFlat: HNSW (그래프)
   - IndexHNSWSQ: HNSW + Scalar Quantization
```

**핵심 알고리즘**:
- **IVF (Inverted File Index)**: k-means clustering → 가장 가까운 클러스터에서만 검색
- **PQ (Product Quantization)**: 768차원을 8차원 × 96 subvector → 각 subvector quantize → 메모리 96배 압축

**산업 사용**:
- Meta (Facebook/Instagram) 내부 표준
- 가장 풍부한 알고리즘 옵션
- GPU 지원 (대규모 학습)

### 2-2. HNSW (Hierarchical Navigable Small World, Malkov & Yashunin 2016)

```
구조: 다층 그래프 (소셜 네트워크 같은)
   레벨 0: 모든 점, 짧은 거리 연결
   레벨 1: 일부 점, 중간 거리 연결
   레벨 2: 극소수 점, 긴 거리 연결
   ...
   
검색: 위층부터 시작 → greedy 로 가까운 노드 따라가기 → 아래층으로 내려가며 정밀화
```

**파라미터**:
- **M**: 노드당 연결 수 (보통 16~64). 메모리 ↔ 정확도 trade-off.
- **ef_construction**: 빌드 시 후보 너비 (보통 200~400). 빌드 시간 ↔ 인덱스 품질.
- **ef_search**: 검색 시 후보 너비 (보통 50~200). 검색 latency ↔ recall.

**산업 사용**:
- Elasticsearch / OpenSearch 의 native vector search 알고리즘
- 가장 흔히 쓰이는 ANN
- 사실상 표준

### 2-3. Annoy (Spotify, 2014)

```
구조: 랜덤 forest of binary trees
   각 트리: 데이터를 hyperplane 으로 재귀 분할
   여러 트리 (보통 100개) 의 결과 합산
```

**파라미터**:
- **n_trees**: 트리 수 (보통 50~200)
- **search_k**: 검색 시 탐색할 노드 수

**산업 사용**:
- Spotify 음악 추천 (이름의 유래)
- 단순함 + 메모리 효율
- HNSW 보다 성능 약간 낮음 (현재는 비주류)

### 2-4. ScaNN (Google, 2020)

```
구조: AH (Asymmetric Hashing) + score-aware quantization
   기존 IVF + PQ 보다 더 정교한 quantization
```

**산업 사용**:
- Google 내부 — TensorFlow Recommenders 와 통합
- HNSW 와 비슷한 성능 + 메모리 효율 우월
- 학습 곡선 가파름 (Google 외부 사용 적음)

### 2-5. 비교 표

| 축 | FAISS | HNSW | Annoy | ScaNN |
|---|---|---|---|---|
| **알고리즘** | 통합 (여러 옵션) | 그래프 | 트리 forest | AH + quantization |
| **속도** | 알고리즘별 | 빠름 (산업 표준) | 보통 | 매우 빠름 |
| **정확도 (Recall@10)** | 99%+ (PQ 옵션은 95%) | 98~99% | 95~98% | 99%+ |
| **메모리** | PQ 로 압축 가능 | 큼 (그래프 저장) | 작음 | 작음 (quantization) |
| **빌드 시간** | 보통 | 길음 (M, ef_construction 비례) | 빠름 | 보통 |
| **GPU** | ✅ | ❌ | ❌ | ✅ |
| **ES / OpenSearch native** | ❌ | **✅** | ❌ | ❌ |
| **산업 사용** | Meta | 가장 흔함 | Spotify | Google |

**산업 선택**:
- **ES / OpenSearch 통합** → HNSW (native)
- **대규모 GPU** → FAISS
- **메모리 제약** → FAISS IVFPQ 또는 ScaNN
- **단순성** → Annoy

---

## 3. HNSW Deep-dive — 산업 표준 알고리즘

### 3-1. 알고리즘 핵심

**Small World**: "Six degrees of separation" — 임의의 두 사람이 평균 6단계로 연결.

**Navigable**: 그래프에서 시작점에서 목표로 가는 길이 짧고 찾기 쉬움.

**Hierarchical**: 다층 구조 — 위층은 sparse (긴 거리 연결), 아래층은 dense (짧은 거리 연결).

```
검색 알고리즘:
   1. 진입점 시작 (보통 최상위 레벨의 임의 노드)
   2. 현재 레벨에서 greedy search — 가장 가까운 이웃으로 이동
   3. 더 이상 가까워질 수 없으면 아래 레벨로
   4. 가장 아래 레벨까지 반복
   5. ef_search 만큼 후보 유지 → Top-K 선택
```

### 3-2. 파라미터 의미 — Deep

#### M (노드당 연결 수)

```
M = 16: 각 노드가 16개 이웃과 연결 → 그래프 sparse
M = 64: 각 노드가 64개 이웃과 연결 → 그래프 dense

trade-off:
   M ↑ → 검색 정확도 ↑ (more paths to target)
   M ↑ → 메모리 ↑ (M × 노드 수 × 8 bytes for pointers)
   M ↑ → 빌드 시간 ↑
```

**산업 권장**:
- 일반 추천: M = 16~32
- 고품질 추천: M = 48~64
- 메모리 제약: M = 8~12

#### ef_construction (빌드 시 후보 너비)

```
ef_construction = 100: 빌드 시 100개 후보 유지하며 그래프 구성
ef_construction = 400: 더 정교한 그래프 구성

trade-off:
   ef_construction ↑ → 인덱스 품질 ↑ (더 좋은 그래프)
   ef_construction ↑ → 빌드 시간 ↑ (선형 비례)
```

**산업 권장**: 200~400 (한 번 빌드 후 영구 사용이므로 후하게).

#### ef_search (검색 시 후보 너비)

```
ef_search = 50: 검색 시 50개 후보 유지 → 빠름, recall 낮음
ef_search = 500: 500개 후보 → 느림, recall 높음

trade-off (가장 자주 튜닝):
   ef_search ↑ → recall@10 ↑ (점근적으로 100%)
   ef_search ↑ → latency ↑ (대략 선형)
```

**산업 권장**: 100~200 (recall@10 ≈ 99% 보통).

### 3-3. 실측 trade-off 그래프 (개념)

```
recall@10  
   1.0 ┤              ●─●─●  (ef_search=200~)
       │           ●
   0.95┤        ●
       │      ●
   0.90┤    ●
       │  ●
   0.85┤●
       └─┴──────────────────► latency
        10   50   100  200  500 ms

ef_search:   16  64   100  150  200
```

**관찰**: ef_search 50~150 구간이 sweet spot. 200 넘으면 recall 한계 (asymptotic) — latency 만 손해.

### 3-4. M / ef_construction / ef_search 의 결합 효과

```
M ↑ + ef_search ↑: 가장 좋은 recall (하지만 메모리 + latency 둘 다 손해)
M ↓ + ef_search ↑: 메모리 절약 + recall 회복 (산업 흔한 선택)
M ↑ + ef_search ↓: 빠른 검색 + 보통 recall (latency 우선)
```

산업 sweet spot (1억 vector, 768 dim):
- M = 16
- ef_construction = 200
- ef_search = 100
- 메모리: ~30 GB
- Latency: ~5 ms / query
- Recall@10: ~98%

---

## 4. 벤치마크 측정 패턴

### 4-1. ann-benchmarks (Aumüller et al.)

표준 ANN 벤치마크 도구. 다양한 알고리즘 + 데이터셋 + 메트릭.

**측정 메트릭**:
- **Recall@K**: ground truth Top-K 중 몇 개를 ANN 이 찾았나
- **QPS**: queries per second
- **Build time**: 인덱스 구축 시간
- **Index memory**: 메모리 사용량

### 4-2. 실측 코드 — HNSW (Python `hnswlib`)

```python
import hnswlib
import numpy as np
import time

# 데이터 준비
dim = 768
num_items = 1_000_000
item_vecs = np.random.rand(num_items, dim).astype('float32')

# 인덱스 빌드
index = hnswlib.Index(space='cosine', dim=dim)
index.init_index(max_elements=num_items, ef_construction=200, M=16)
index.add_items(item_vecs, np.arange(num_items))

# 검색 — ef_search 별 latency vs recall 측정
queries = np.random.rand(1000, dim).astype('float32')

for ef in [50, 100, 200, 500]:
    index.set_ef(ef)
    
    start = time.time()
    labels, distances = index.knn_query(queries, k=10)
    latency_ms = (time.time() - start) * 1000 / 1000  # per query
    
    # ground truth (brute force) 와 비교 → recall 계산
    recall = compute_recall(labels, ground_truth_labels)
    
    print(f"ef_search={ef}: latency={latency_ms:.2f}ms, recall@10={recall:.4f}")
```

### 4-3. 산업 측정 패턴 (Phase 6 §16 toy training 에서 재사용)

```python
# 1. M 고정 + ef_search 변화 → recall/latency 곡선
# 2. ef_search 고정 + M 변화 → memory/recall 곡선
# 3. 데이터 크기 변화 → scalability 확인
# 4. 차원 수 변화 → curse of dimensionality 영향
```

---

## 5. ANN 서빙 인프라 — Production Pattern

### 5-1. 단일 머신 vs 분산

**단일 머신 (~1억 vector)**:
- HNSW 인덱스 → 메모리 ~30GB → 대형 머신 1대
- 단순 + 빠름
- 산업의 80%

**분산 (~10억+ vector)**:
- IVF 로 shard → 각 shard 가 1억 vector → cluster
- 검색 시 router → relevant shard 만 검색
- FAISS / Milvus / Vespa / Qdrant

### 5-2. ES / OpenSearch native (HNSW)

```json
PUT /products
{
  "mappings": {
    "properties": {
      "embedding": {
        "type": "dense_vector",
        "dims": 768,
        "index": true,
        "similarity": "cosine",
        "index_options": {
          "type": "hnsw",
          "m": 16,
          "ef_construction": 200
        }
      }
    }
  }
}

POST /products/_search
{
  "knn": {
    "field": "embedding",
    "query_vector": [...],
    "k": 10,
    "num_candidates": 100   // ef_search
  }
}
```

**장점**: 기존 ES 인프라 활용 + BM25 결합 (Hybrid Search) + 운영 도구 (X-Pack).

### 5-3. 전용 Vector DB

| 시스템 | 특징 |
|---|---|
| **Milvus** | 오픈소스, 분산, GPU 지원 |
| **Pinecone** | 매니지드 서비스 (SaaS) |
| **Qdrant** | Rust 기반, 빠름, 풍부한 필터링 |
| **Weaviate** | GraphQL + 임베딩 모델 통합 |
| **Vespa** | Yahoo, 추천 + 검색 통합 |

ES 사용 안 하면 Qdrant 또는 Milvus 가 산업 가속 트렌드.

---

## 6. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "ANN 은 정확도 손실로 사용 안 한다" | 99% recall + 100배 속도 — 산업 표준. brute force 는 prototype 에만. |
| 2 | "FAISS 만 알면 충분" | ES 통합 시 HNSW (ES native) 가 더 적합. 알고리즘 선택은 인프라 따라. |
| 3 | "M 클수록 좋다" | 메모리 + 빌드 시간 큼. M = 16~32 가 sweet spot. |
| 4 | "ef_construction 작아도 OK" | 인덱스 영구 사용이므로 후하게 (200~400). 한 번 빌드 후 손실 영구. |
| 5 | "ef_search 키워서 recall 100% 가능" | 점근적 한계. 200 넘으면 latency 만 손해. recall@10 ≈ 99% 가 산업 표준. |
| 6 | "Cosine vs L2 같은 결과" | embedding 이 normalize 안 됐으면 다름. cosine 사용 시 vector normalize 필수. |
| 7 | "HNSW 인덱스 업데이트 가능" | Insert OK, delete 는 soft delete. 대량 변경 시 재빌드. |

---

## 7. 꼬리 질문 (§26 면접 카드 후보)

1. **HNSW 의 M / ef_construction / ef_search 의 역할 차이는?**
   - 답: M — 빌드 시 노드당 연결 수 (메모리 ↔ 정확도 영구). ef_construction — 빌드 시 후보 너비 (빌드 시간 ↔ 인덱스 품질, 영구). ef_search — 검색 시 후보 너비 (latency ↔ recall, runtime 튜닝 가능). M, ef_construction 은 빌드 후 고정, ef_search 만 dynamic.

2. **FAISS IVFPQ 가 메모리 96배 압축 가능한 메커니즘은?**
   - 답: PQ (Product Quantization) — 768차원을 8차원 × 96 subvector 로 split → 각 subvector 를 256 (1바이트) 클러스터로 quantize → 원본 (768 × 4 byte = 3072 bytes/vector) → 압축 (96 bytes/vector). 96배 압축. 단 정확도 약간 손실.

3. **ANN 의 Recall@10 = 99% 가 산업 표준인 이유는?**
   - 답: 추천에서 top-100 후보 → ranking 이 더 중요. 1% 손실은 후보 수백 중 한 자리 누락 — ranking 으로 회복 가능. 100% 추구하면 latency 폭발 (brute force). 99% 가 latency-quality sweet spot.

4. **ES native HNSW vs 외부 Vector DB (Pinecone, Qdrant) 선택?**
   - 답: 기존 ES 사용 + Hybrid Search 필요 → ES native. 검색 안 쓰고 vector 만 → Qdrant / Milvus (더 빠름 + 풍부한 필터링). 매니지드 우선 → Pinecone. 산업 default 는 ES (인프라 통합) + 차세대는 Qdrant 가 부상.

5. **HNSW 인덱스 빌드 후 업데이트 전략은?**
   - 답: Insert — 단일 노드 추가 OK (HNSW 그래프에 추가 연결). Delete — soft delete (tombstone), 검색 시 필터링. 대량 변경 (>10%) → 재빌드 필수. 산업은 일일 배치 재빌드 + 실시간 incremental insert 결합.

---

## 8. cross-ref

| 주제 | 연결된 study |
|---|---|
| Vector Search HNSW 기본 | #19 §08 (검색 관점 deep-dive) |
| Hybrid Search (BM25 + dense) | #19 §07 (ES 의 knn + bm25 결합) |
| Sentence-BERT 임베딩 | §09 (임베딩 만드는 쪽) |
| Two-Tower retrieval | Phase 6 §13 (학습된 embedding 의 ANN 서빙) |
| msa Two-Tower ANN 구현 | Phase 10 §24 (FAISS 또는 ES knn 선택) |
| 벤치마크 측정 | Phase 6 §16 (toy training 의 latency/recall 측정) |
| ADR ANN 인덱스 선택 | Phase 10 §20 (FAISS vs ES vs ScaNN 선택 ADR) |
