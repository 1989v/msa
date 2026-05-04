---
parent: 19-search-engine
seq: 28
title: Inference API + ELSER + semantic_text — Elastic 8.x 시맨틱 스택
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 08-vector-search-hnsw.md
  - 27-mapping-field-types.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/inference
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/semantic-text
catalog-row: "§M Inference API + ELSER + semantic_text"
depth: full
---

# 28. Inference API + ELSER + semantic_text

> 카탈로그 매핑: §99 §M — `★ 신규 (현 표준)` → `✅ 커버`
> 학습 시간: ~2.5h · 자가평가: A

---

## 1. 한 줄 핵심

ES (Elasticsearch) 8.x 의 **Inference API + semantic_text** 는 "임베딩 파이프라인을 ES 안에 넣자" 의 최종 해답. 매핑 한 줄 (`semantic_text`) + inference endpoint 등록만 하면 chunking·embedding·검색이 자동. **ELSER (Elastic Learned Sparse EncodeR)** 는 그 기본 sparse retrieval 모델.

## 2. 등장 배경

- 기존 dense vector 워크플로우: app 에서 임베딩 호출 → ES bulk → 매핑·차원·모델버전 관리 → 모델 변경 = 전체 reindex
- 이 모든 단계가 **app 코드 + ES 매핑 두 곳에 분산** → 버전 정합 어려움, 모델 교체 비용 큼
- 8.x: **Inference API** (모델 등록 → endpoint 호출 추상화) + **semantic_text field** (매핑이 chunking·embedding 자동 트리거)
- ELSER: 사전학습된 영어 sparse retrieval 모델 — BM25 (Best Match 25) 보다 의미 매칭 우수, dense vector 보다 가벼움
- E5: multilingual dense embedding 모델 — 다국어 (한국어 포함)

## 3. 동작 원리

```
[Inference API]
  PUT _inference/sparse_embedding/elser-prod-1
    { "service": "elasticsearch", "service_settings": { "model_id": ".elser_model_2" } }

[semantic_text 매핑]
  "content": { "type": "semantic_text", "inference_id": "elser-prod-1" }

[색인]
  PUT /docs/_doc/1
    { "content": "긴 본문 텍스트" }
  → ES 가 자동으로:
       1) chunking (sentence/word strategy)
       2) chunk 마다 inference endpoint 호출
       3) sparse_vector / dense_vector 저장
       4) 원문도 _source 에 보존

[검색]
  POST /docs/_search
    { "query": { "semantic": { "field": "content", "query": "찾고 싶은 의미" } } }
  → ES 가 자동으로:
       1) 쿼리 텍스트 → inference 호출
       2) sparse_vector / kNN 매칭
       3) hits 반환 (chunk 단위 score, 원문 doc 단위 집계)
```

| 컴포넌트 | 역할 |
|---|---|
| **Inference API** | 모델 등록·교체·endpoint 단위 호출. provider: elasticsearch / openai / cohere / azure / vertex / huggingface / watsonx |
| **service** | 어디서 추론을 돌리나 — `elasticsearch` (내장 모델) vs 외부 |
| **service_settings.model_id** | `.elser_model_2`, `.multilingual-e5-small`, `text-embedding-ada-002` 등 |
| **semantic_text** field | 매핑 트리거 — chunking + embedding 자동 |
| **chunking_settings** | sentence / word / max_chunk_size / sentence_overlap |

## 4. 사용 예제

### 4-1. Inference endpoint 등록 (ELSER)

```http
PUT _inference/sparse_embedding/elser-prod-1
{
  "service": "elasticsearch",
  "service_settings": {
    "model_id": ".elser_model_2",
    "num_allocations": 1,
    "num_threads": 1
  }
}
```

### 4-2. 매핑 + 색인

```json
PUT /products
{
  "mappings": {
    "properties": {
      "title": { "type": "text" },
      "description": {
        "type": "semantic_text",
        "inference_id": "elser-prod-1",
        "chunking_settings": { "strategy": "sentence", "max_chunk_size": 250, "sentence_overlap": 1 }
      }
    }
  }
}

POST /products/_doc/1
{ "title": "런닝화", "description": "쿠션이 두꺼운 데일리 런닝화 ..." }
```

### 4-3. 검색

```json
POST /products/_search
{
  "query": {
    "semantic": { "field": "description", "query": "발에 부담 적은 신발" }
  }
}
```

또는 retrievers + hybrid:

```json
{
  "retriever": {
    "rrf": {
      "retrievers": [
        { "standard": { "query": { "match": { "title": "런닝화" } } } },
        { "standard": { "query": { "semantic": { "field": "description", "query": "쿠션 좋은" } } } }
      ]
    }
  }
}
```

### 4-4. dense (E5 multilingual)

```http
PUT _inference/text_embedding/e5-multi-1
{
  "service": "elasticsearch",
  "service_settings": { "model_id": ".multilingual-e5-small" }
}
```
+ `semantic_text` field 의 inference_id 만 e5 로 변경 — 매핑 분리 시 dense_vector 자동 적용.

## 5. 트레이드오프 / 안티패턴

| 측면 | 장점 | 비용 |
|---|---|---|
| 코드 단순화 | app 에서 임베딩 호출 코드 제거 — ES 가 알아서 | inference 노드 자원 (CPU/GPU/메모리) ES 클러스터에 통합 |
| 모델 교체 | inference_id 만 바꿈 (단, 매핑 변경은 여전히 reindex) | 모델 호환 안 되면 chunking·embedding 다 다시 |
| Sparse (ELSER) | BM25 같은 token-level 점수 + 의미 매칭. 디스크·메모리 dense 보다 가벼움 | 영어 학습 모델 — 한국어 성능 제한 |
| Dense (E5) | multilingual 강함, 한국어 가능 | 차원 큼 (256~1024) → 양자화 필수 |
| Auto chunking | 긴 문서도 자동 분할 | chunk 경계가 의미 손상 가능 — overlap 조정 |

- **언제 쓴다**: 새 RAG (Retrieval-Augmented Generation, 검색 증강 생성) / semantic search 워크로드, ES 8.x 클러스터
- **언제 쓰지 않는다**:
  - OpenSearch 환경 (지원 X — Neural plugin 으로 다름, §29)
  - 자체 임베딩 파이프라인 자산이 이미 있고 control 이 중요할 때
  - dense vector 차원이 큰데 양자화 미적용 → 메모리 폭발

## 6. ES vs OpenSearch

| 항목 | ES | OS |
|---|---|---|
| Inference API | 8.x 표준 (provider 다양) | OS 도 ML Commons + connector — 다른 표현 (§29) |
| ELSER | Elastic 자체 모델 (라이선스 OK) | OS 는 neural sparse 로 다른 모델 (e.g. opensearch-project/opensearch-sparse-encoding) |
| semantic_text 매핑 | **ES 전용** | OS 미지원 — neural search 의 ingest pipeline + neural query 로 등가 |
| Re-ranker | text_similarity_reranker retriever | rerank processor (search pipeline) |

## 7. 운영 / 모니터링

- inference endpoint 별 throughput / latency 모니터 (`_inference/_stats`)
- num_allocations / num_threads 조정 — CPU 의 경우 클러스터 노드 부하 직접 영향
- 모델 cache: 처음 ELSER deploy 시 download 시간 ↑
- chunk 폭증 방지: max_chunk_size + 본문 길이 SLO (Service Level Objective, 서비스 수준 목표)
- 매핑 변경 vs inference_id 변경: 후자는 이전 색인 무력화 위험 — alias swap 전략 필수

## 8. msa 코드베이스 grounding

| 위치 | 현재 | 적용 후보 |
|---|---|---|
| 18-hybrid-search-poc | 외부 임베딩 클라이언트 추상화 + ES bulk | semantic_text 로 chunking + embedding 을 ES 가 흡수 — 코드 ↓ |
| product description | text + nori | text + nori + semantic_text (E5 multilingual) — 의미 검색 추가 |
| analytics 답변 검색 (가설) | 없음 | RAG 형 검색 — semantic_text + ELSER (영문) 또는 E5 (다국어) |
| ES 클러스터 사이징 | search 워크로드 위주 | inference workload 추가 시 dedicated ML 노드 검토 (master/data 와 분리) |

## 9. 적용 후보 / ADR

**ADR-XXXX (Proposed)**: "신규 semantic 검색은 semantic_text + Inference API 로 표준화 (ES 8.x 환경)"
- **이유**: 임베딩 파이프라인 코드/매핑 정합 비용 ↓, 모델 교체 추상
- **전제**: ES 8.13+ 환경 + ML 노드 자원
- **위험**: OS 환경 호환 불가 → ADR-3 (ES vs OS 일원화) 와 묶어 결정 필요
- **대안**: 외부 임베딩 호출 + dense_vector 직접 색인 (현 구조 유지)

## 10. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. semantic_text 가 매력적인 이유? | 매핑 한 줄로 chunking + embedding 자동 — app 코드 ↓ | inference_id 가 바뀌면 어떤 일? |
| Q2. ELSER 가 dense vector 대비 가지는 강점? | sparse 라 디스크·메모리 가벼움, 점수 해석 가능 (token weight) | 한국어 한계? |
| Q3. dense (E5) 와 sparse (ELSER) 같이 쓰는 이유? | 보완재. RRF 융합으로 keyword + 의미 둘 다 잡음 | 한 모델만 쓸 때 어느 워크로드? |
| Q4. Inference API 의 추상화 핵심? | provider 분리 (elasticsearch / openai / cohere / vertex), endpoint 단위 모델 교체 가능 | 외부 provider 쓰면 cost·latency 함정? |
| Q5. semantic_text 매핑 + 모델 변경 시 reindex 필수? | 매핑 자체는 그대로, inference_id 변경해도 기존 색인은 옛 모델 결과 유지 — alias swap 권장 | 부분 reindex 가능한가? |

## 11. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "ELSER 가 BM25 를 대체" | 보완재 — 의미 매칭 추가. BM25 도 같이 |
| "semantic_text 면 양자화 신경 안 써도 됨" | dense 모델이면 동일하게 양자화 검토 |
| "Inference API 는 OpenAI 만 지원" | 8.x 부터 elasticsearch (내장 ELSER/E5) / openai / cohere / azure / vertex / huggingface / watsonx |

## 12. 다음 학습

- §99 §H text_similarity_reranker retriever (→ [23-retrievers-api.md](23-retrievers-api.md))
- §99 §Q OS Neural / Neural Sparse / ML Commons (→ [29-os-search-pipeline-neural.md](29-os-search-pipeline-neural.md))
- §99 §A 의 dense_vector 양자화 (→ [27-mapping-field-types.md](27-mapping-field-types.md))
