---
parent: 19-search-engine
seq: 29
title: OpenSearch Search Pipeline + Hybrid + Neural / Neural Sparse / ML Commons
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 11-elasticsearch-vs-opensearch.md
  - 23-retrievers-api.md
  - 28-elser-semantic-text.md
sources:
  - https://docs.opensearch.org/3.5/search-plugins/search-pipelines/index
  - https://docs.opensearch.org/3.5/search-plugins/neural-text-search
  - https://docs.opensearch.org/3.5/search-plugins/neural-sparse-search
  - https://docs.opensearch.org/3.5/ml-commons-plugin/index
catalog-row: "§Q OS Search Pipeline / Hybrid / Neural / ML Commons"
depth: full
---

# 29. OpenSearch Search Pipeline + Neural Stack

> 카탈로그 매핑: §99 §Q (Search Pipeline / Hybrid / Neural / Neural Sparse / ML Commons) — `★ 신규` → `✅ 커버`
> 학습 시간: ~2.5h · 자가평가: A

---

## 1. 한 줄 핵심

OS (OpenSearch) 의 **Search Pipeline** = ES (Elasticsearch) 의 ingest pipeline 의 **검색 버전**. request / response / search-phase processor 3계층으로 검색 요청·응답을 변환. **Hybrid query + normalization-processor** 가 ES 의 retrievers RRF (Reciprocal Rank Fusion, 상호 순위 융합) 등가물이고, **Neural / Neural Sparse + ML Commons** 가 ES 의 Inference API + ELSER 등가물.

## 2. 등장 배경

- ES 8.x 가 retrievers API 로 hybrid/rerank 를 트리 표현으로 통합한 동안, OS 는 **search pipeline + hybrid query + neural search** 의 조합으로 같은 문제를 다른 모양으로 해결
- 두 진영 모두 "검색 = 단순 query → results" 가 아닌 "복합 단계의 변환" 이라는 인식이 일치, 표현 모델만 다름
- **ML Commons**: OS 의 generic ML 모델 등록·서빙 plugin — neural / sparse / rerank 의 토대

## 3. 동작 원리

```
[Search Pipeline 3 처리기]
  Request Processor   →  변환된 query  →  shards
                                          │
                       (검색 phase 의 일부)│
  Search Phase Processor (예: normalization, rerank)
                                          │
                       results from shards│
  Response Processor  ←  최종 응답 변환

[ML Commons]
  PUT /_plugins/_ml/models  →  HuggingFace / 외부 connector / local
  → model_id 발급
  → Neural / Sparse / Rerank processor 가 model_id 사용
```

핵심 컴포넌트:
- **Hybrid query**: top-level `hybrid` — 여러 sub-query 의 결과 집합을 search pipeline 의 normalization processor 가 융합
- **normalization-processor** (search-phase): 점수 정규화 (`min_max` / `l2` / `rrf`) + 결합 (`arithmetic_mean` / `geometric_mean` / `harmonic_mean`)
- **Neural query**: `neural` — 자동 임베딩 + kNN (K-Nearest Neighbors, K-최근접 이웃). text → ML model → vector → kNN
- **Neural Sparse**: `neural_sparse` — token weight 기반 sparse retrieval (ES ELSER 등가)
- **Neural Sparse 2-phase processor**: 2단계 처리로 sparse retrieval 가속 (2.15+)
- **ML Commons**: model 등록, deploy, prediction. connector 로 외부 모델 (OpenAI, SageMaker, Bedrock) 도 통합

## 4. 사용 예제

### 4-1. Hybrid query + normalization-processor

```json
// 1) search pipeline 등록
PUT /_search/pipeline/nlp-search-pipeline
{
  "phase_results_processors": [
    {
      "normalization-processor": {
        "normalization": { "technique": "min_max" },
        "combination": {
          "technique": "arithmetic_mean",
          "parameters": { "weights": [0.3, 0.7] }
        }
      }
    }
  ]
}

// 2) hybrid 검색
GET /products/_search?search_pipeline=nlp-search-pipeline
{
  "query": {
    "hybrid": {
      "queries": [
        { "match":  { "title":     { "query": "런닝화" } } },
        { "neural": { "embedding": { "query_text": "쿠션 좋은 신발", "model_id": "abc123", "k": 10 } } }
      ]
    }
  }
}
```

### 4-2. Neural Search (ingest 자동 embedding + 검색)

```json
// 1) ingest pipeline 에 neural 임베딩 처리기
PUT /_ingest/pipeline/nlp-ingest-pipeline
{
  "processors": [
    {
      "text_embedding": {
        "model_id": "abc123",
        "field_map": { "description": "description_embedding" }
      }
    }
  ]
}

// 2) 인덱스 생성 (ingest pipeline 연결)
PUT /products
{
  "settings": { "default_pipeline": "nlp-ingest-pipeline" },
  "mappings": {
    "properties": {
      "description":           { "type": "text" },
      "description_embedding": { "type": "knn_vector", "dimension": 384 }
    }
  }
}

// 3) 색인 (텍스트만 넣어도 자동 embedding)
POST /products/_doc { "description": "쿠션이 두꺼운 데일리 런닝화" }

// 4) 검색
POST /products/_search
{
  "query": { "neural": { "description_embedding": { "query_text": "발에 편한 신발", "k": 5 } } }
}
```

### 4-3. Neural Sparse + 2-phase 가속

```json
PUT /_search/pipeline/two_phase_search_pipeline
{
  "request_processors": [
    {
      "neural_sparse_two_phase_processor": {
        "tag": "neural-sparse",
        "description": "Creates a two-phase processor for neural sparse search."
      }
    }
  ]
}

GET /docs/_search?search_pipeline=two_phase_search_pipeline
{
  "query": {
    "neural_sparse": {
      "passage_embedding": { "query_text": "검색어", "model_id": "xyz" }
    }
  }
}
```

### 4-4. Response Processor (rerank)

```json
PUT /_search/pipeline/rerank-pipeline
{
  "response_processors": [
    {
      "rerank": {
        "ml_opensearch": { "model_id": "rerank-cross-encoder-1" },
        "context": { "document_fields": ["title", "description"] }
      }
    }
  ]
}
```

## 5. 트레이드오프 / 안티패턴

| 측면 | 장점 | 비용 |
|---|---|---|
| 표현 분리 | request/phase/response 처리기 분리 — 검색 변환 단계 명확 | 구성 파일 산만 — pipeline 재사용 정책 필요 |
| Hybrid + normalization | 다양한 정규화·결합 전략 (min_max + arithmetic vs rrf + geometric) | 가중치 튜닝 부담 |
| Neural | text → vector 자동 — app 코드 ↓ | model 호스팅 자원 (ML 노드) |
| ML Commons | generic — local model + 외부 connector 모두 | 운영/보안 정책 (모델 다운로드 출처 검증) |

- **언제 쓴다**: OS 환경에서 hybrid / semantic / rerank 도입
- **언제 쓰지 않는다**: 단순 BM25 (기본 query 로 충분)
- **안티패턴**:
  - retrievers API 코드를 그대로 OS 로 옮기려 시도 — 표현 모델 다름
  - 모든 검색에 search pipeline 적용 — 캐시 친화성 ↓

## 6. ES 와 매핑

| 기능 | ES | OS |
|---|---|---|
| Hybrid 표현 | retrievers (`rrf`) | hybrid query + normalization-processor |
| Auto embedding | semantic_text + Inference | neural query + ML Commons + ingest pipeline |
| Sparse retrieval | sparse_vector + ELSER | neural_sparse + neural sparse models |
| Rerank | text_similarity_reranker retriever | rerank response processor |
| 모델 관리 | Inference API | ML Commons (model registry/deploy/predict) |

> **마이그레이션 비용 핵심**: 클라이언트 코드 (검색 요청 본문) 가 진영별로 형태 다름. 매핑 (`semantic_text` ↔ `knn_vector` + ingest pipeline) 도 다름. 이중 트랙 운영은 가능하나 코드/매핑 양쪽 유지 비용.

## 7. 운영 / 모니터링

- ML Commons: `_plugins/_ml/models/_search` 로 모델 상태 조회, deploy/undeploy
- 모델 메모리/CPU: ML 노드 분리 권장 (data/master 와)
- search pipeline 별 latency 추적: `?search_pipeline=...` 마다 별도 latency 비교
- normalization-processor 가중치 변경 → A/B 테스트 (analytics 클릭 데이터 기반)

## 8. msa 코드베이스 grounding

| 위치 | 현재 | 적용 후보 |
|---|---|---|
| local Dev (OS infra 존재) | OS 도 띄워져 있음 (ADR 후보 3 일원화 검토 중) | OS 가 main 이면 hybrid/neural 표준 = search pipeline + neural |
| 18-hybrid-search-poc.md | ES 가정 PoC | OS 시나리오: hybrid query + normalization-processor + neural query 로 등가 PoC |
| 19-improvements ADR-3 | ES vs OS 일원화 | 본 문서가 OS 트랙의 기술 디테일 — ADR 작성 시 참조 |

## 9. 적용 후보 / ADR

**ADR-XXXX (Proposed)**: "OS 일원화 시 hybrid 검색은 normalization-processor + hybrid query, semantic 은 neural + ML Commons"
- **이유**: OS 의 hybrid/rerank 는 retrievers 가 아닌 search pipeline 모델 — 일원화하면 표현·운영 일관
- **위험**: ES retrievers 의 합성성 (트리) 표현이 더 직관 — 개발자 학습 비용
- **체크포인트**: 모델 호환 (rerank cross-encoder 모델은 진영 따라 다름), client lib 변경, msa search adapter 재작성

## 10. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. ES retrievers 와 OS search pipeline 의 본질 차이? | retrievers = 트리 합성 / search pipeline = 단계 시퀀스 | 표현력 우열은? (둘 다 표현 가능, 친숙도 다름) |
| Q2. normalization-processor 의 RRF vs min_max + arithmetic 차이? | RRF 는 rank 기반 (정규화 불필요), min_max+arithmetic 은 score 정규화+가중평균 | 도메인 튜닝 자유도? |
| Q3. ML Commons 의 핵심 가치? | 모델 등록·serving 추상 — local + connector (OpenAI/SageMaker/Bedrock) | 모델 보안 (출처 검증) 정책? |
| Q4. neural_sparse 2-phase 가 가속하는 원리? | 1차 빠른 후보 추림 → 2차 정확 매칭 — top-k 만 비싼 매칭 | ELSER 와 모델 호환? |
| Q5. ES → OS 마이그레이션의 핵심 깨짐 지점? | hybrid/rerank/semantic 의 클라이언트 요청 본문 형태가 진영별 다름 + 모델 호환 | 일부 호환 가능한 영역? (BM25/term/aggs/snapshot 등 호환 높음) |

## 11. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "ES retrievers 코드를 OS 에 그대로" | 형태 다름 — search pipeline + hybrid 로 재작성 필요 |
| "normalization-processor 는 항상 켠다" | 캐시 친화성 ↓ — 필요한 hybrid 검색에만 |
| "Neural / Neural Sparse 모델은 호환" | 모델 자체는 다름 — ML Commons 등록 모델 재학습 또는 변환 필요할 수 있음 |

## 12. 다음 학습

- §99 §Q PPL (Piped Processing Language, OS 전용 piped query)
- §M ES 측 등가 (→ [28-elser-semantic-text.md](28-elser-semantic-text.md))
- §H ES retrievers 와의 표현 매핑 (→ [23-retrievers-api.md](23-retrievers-api.md))
- 19-improvements ADR-3 검토 시 본 문서 + #28 + #11 동시 참조
