---
parent: 19-search-engine
seq: 23
title: Retrievers API — RRF / Linear / Text Similarity Reranker / Rule (ES 8.14+)
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 09-hybrid-search-rrf.md
  - 10-reranking-cross-encoder-ltr.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion
catalog-row: "§H Retrievers API"
depth: full
---

# 23. Retrievers API — Hybrid · Rerank 의 현 표준

> 카탈로그 매핑: §99 §H Retrievers API — `★ 신규 (현 표준)` → `✅ 커버`
> 학습 시간: ~2h · 자가평가: A

---

## 1. 한 줄 핵심

ES (Elasticsearch) 8.14+ 의 **retriever** 는 "어떤 후보 집합을 어떻게 재정렬할지" 를 **트리 구조** 로 표현하는 search request 의 새 1급 시민. 기존 `query` + `knn` + `rescore` 분산 표현을 **재귀 합성 가능한 단일 DSL (Domain-Specific Language, 도메인 특화 언어)** 로 통합.

## 2. 공식 정의 + 등장 배경

- 등장 배경: hybrid (키워드+벡터) + rerank (cross-encoder/LTR (Learning to Rank, 랭킹 학습)) 가 표준화되자, 기존 `query` / top-level `knn` / `rescore` 의 **분산 표현이 합성 불가능** 했다 (예: kNN (K-Nearest Neighbors, K-최근접 이웃) + BM25 (Best Match 25) RRF 후 다시 cross-encoder rerank).
- **retriever** 는 트리 노드처럼 중첩 가능 — outer `text_similarity_reranker` → inner `rrf` → leaf `standard` / `knn`.
- 8.14 GA, 9.x 에서 정착. 신규 검색 코드는 모두 retriever 작성을 권장.

## 3. 동작 원리

```
                ┌─────── text_similarity_reranker ──── 외곽 (Two-Stage 의 2차)
                │   inference_id, field, top_n
                │
                └─── rrf ─────────────────── 중간 (Hybrid 의 융합)
                       │  rank_window_size, rank_constant
                       │
              ┌────────┴───────────┐
              │                    │
         standard             knn
         (BM25 leaf)          (vector leaf)
```

**핵심 노드 타입**:
- `standard` — 기존 `query` block. BM25/term/bool 등 그대로
- `knn` — top-level kNN (dense_vector). `field`/`query_vector`/`k`/`num_candidates`
- `rrf` — 아래 retriever 들의 결과를 RRF (Reciprocal Rank Fusion, 상호 순위 융합) 로 융합. `rank_window_size`/`rank_constant`
- `linear` — weighted-sum 융합 (정규화 필수). 각 child 에 `weight` + `normalizer`
- `text_similarity_reranker` — 아래 retriever 결과 top_n 을 inference endpoint(cross-encoder)로 재정렬. `inference_id`/`field`/`inference_text`/`chunk_rescorer`
- `rule` — search application 의 query rule 적용 (조건부 pinned/exclude). 가장 바깥에 둔다
- `rescorer` — 기존 rescore 의 retriever 형태

| 파라미터 | 의미 |
|---|---|
| `rank_window_size` | 융합 창 크기 (rerank 대상). 클수록 recall↑ 비용↑ |
| `rank_constant` (RRF) | RRF 의 k. default 60 |
| `weight` (linear) | 가중치 |
| `normalizer` (linear) | minmax / l2 — 점수 분포 정규화 방식 |
| `top_n` (reranker) | reranker 입력 크기 (보통 50~200) |

## 4. 사용 예제

### 4-1. RRF 로 BM25 + kNN 융합 (가장 흔한 패턴)

```json
POST /products/_search
{
  "retriever": {
    "rrf": {
      "retrievers": [
        { "standard": { "query": { "term": { "text": "shoes" } } } },
        { "knn": { "field": "vector", "query_vector": [1.25, 2, 3.5],
                   "k": 50, "num_candidates": 100 } }
      ],
      "rank_window_size": 50,
      "rank_constant": 20
    }
  }
}
```

### 4-2. Linear 융합 (가중치 + minmax 정규화)

```json
{
  "retriever": {
    "linear": {
      "retrievers": [
        { "retriever": { "standard": { "query": { "term": { "topic": "ai" } } } },
          "weight": 2, "normalizer": "minmax" },
        { "retriever": { "knn": { "field": "vector", "query_vector": [...],
                                   "k": 3, "num_candidates": 5 } },
          "weight": 1.5, "normalizer": "minmax" }
      ],
      "rank_window_size": 10
    }
  }
}
```

### 4-3. Two-Stage: RRF → cross-encoder rerank

```json
{
  "retriever": {
    "text_similarity_reranker": {
      "retriever": {
        "rrf": {
          "retrievers": [
            { "standard": { "query": { "query_string": { "query": "AI in IR" } } } },
            { "knn": { "field": "vector", "query_vector": [...], "k": 10, "num_candidates": 50 } }
          ],
          "rank_window_size": 50, "rank_constant": 1
        }
      },
      "field": "text",
      "inference_id": "my-rerank-model",
      "inference_text": "What are the state of the art applications of AI in information retrieval?",
      "chunk_rescorer": { "size": 1, "chunking_settings": { "strategy": "sentence", "max_chunk_size": 300 } }
    }
  }
}
```

### 4-4. Rule retriever (가장 바깥)

```json
{
  "retriever": {
    "rule": {
      "match_criteria": { "query_string": "harry potter" },
      "ruleset_ids": ["my-ruleset"],
      "retriever": { "rrf": { "retrievers": [...] } }
    }
  }
}
```

## 5. 트레이드오프 / 안티패턴

| 측면 | 장점 | 비용 |
|---|---|---|
| 표현력 | hybrid/rerank/rule 의 **합성** 가능 — 한 트리로 끝 | 복잡도 ↑ — `_source: false` + 명시적 fields 추출 패턴 정착 필요 |
| 호환성 | 8.14+. 8.x 클러스터에선 미지원 | OpenSearch 미지원 (분기점 — OS 는 search pipeline 으로 대응, §29 참조) |
| 클라이언트 | Java/Python/JS 공식 클라이언트 8.14+ 지원 | 구버전 클라이언트는 raw JSON |
| 디버깅 | profile / explain 동작 | retriever 트리가 깊으면 trace 길어짐 |

- **언제 쓴다**: ES 8.14+ 신규 검색 — hybrid 또는 rerank 가 한 번이라도 등장하면
- **언제 쓰지 않는다**: 단일 BM25 검색만 (그냥 `query` 가 짧고 명확)
- **안티패턴**: retriever 와 top-level `query`/`knn`/`rescore` 를 동시 사용 (한쪽만 골라야 함)

## 6. ES vs OpenSearch

| 측면 | ES | OS |
|---|---|---|
| Retrievers API | 8.14+ 표준 | **미지원** |
| 대안 표현 | retriever 트리 | **search pipeline + hybrid query** (request/response/search-phase processor) |
| RRF | retriever 노드로 자연 표현 | normalization-processor 의 `rrf` 기법 (search pipeline 안) |
| Rerank | text_similarity_reranker retriever | rerank processor (검색 파이프라인) + ML Commons |

> ★ Hybrid/Rerank 의 **표현 모델이 두 진영 갈림길**. 마이그레이션 시 client 코드 큰 변경 필요. → ES vs OS 일원화 ADR (Architecture Decision Record, 아키텍처 결정 기록) 후보 (#11 19-improvements ADR-3) 의 핵심 근거 1.

## 7. 운영 / 모니터링

- **`_search?profile=true`** 로 retriever 노드별 비용 측정 가능 (RRF 융합 / inference 호출 / rescore 단계 분리)
- **inference latency**: cross-encoder rerank 가 큰 비용 — `chunk_rescorer.size` / `top_n` 으로 통제
- **circuit breaker**: rank_window_size 가 커지면 메모리 부담 → request circuit breaker 모니터
- **캐싱**: `standard` retriever 의 leaf query 가 filter context 면 query cache hit 가능. RRF 노드 자체는 캐시 X

## 8. msa 코드베이스 grounding

| 위치 | 현재 | 적용 후보 |
|---|---|---|
| `search/app` ProductSearchAdapter | function_score 기반 BM25 + business signal | retriever 트리로 재작성 — `linear` + standard + knn (벡터 도입 시) |
| `18-hybrid-search-poc.md` PoC | top-level query + knn 분리 표현 | retriever 의 `rrf` 노드로 단일화 — 코드 단순화 |
| 운영 | ES 8.x 또는 OS 2.x 환경 의존 | OS 환경이면 retriever 미지원 → search pipeline 으로 등가 표현 (§29) |

## 9. 적용 후보 / ADR

**ADR-XXXX (Proposed)**: "검색 hybrid/rerank 표현은 retrievers API 표준화"
- **제안**: ES 8.14+ 환경에선 모든 hybrid 검색을 retriever 트리로 작성 (PoC 코드 + 운영 모두)
- **이유**: function_score / 분산 표현보다 합성성·디버깅성↑
- **전제**: ES 8.14+ 또는 OS 환경이면 search pipeline 동치 표현으로 분기
- **위험**: client lib 버전 매트릭스 관리 부담

## 10. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. retrievers API 가 등장한 이유? | hybrid+rerank 합성 표현이 기존 query/knn/rescore 분리로 불가능 → 트리 합성 표현 필요 | 왜 ES 8.14 까지 늦었나? (RRF GA + inference API 안정화 후) |
| Q2. RRF retriever vs linear retriever 선택 기준? | 점수 분포 다른 시스템 융합이면 RRF (rank only). 도메인 가중치 튜닝이 가능하면 linear (정규화 필수) | linear 의 normalizer minmax vs l2 차이는? |
| Q3. retriever 와 OS search pipeline 의 매핑은? | retriever = 트리 표현 / search pipeline = 단계 표현. 등가 작업이지만 표현 모델 다름 | 마이그레이션 시 어디가 가장 깨지나? (rerank inference 모델 호환) |
| Q4. text_similarity_reranker 의 chunk_rescorer 는 왜 있나? | doc 본문 길면 reranker 입력 토큰 한계 — sentence chunking 후 best chunk 만 reranker 에 보냄 | strategy 종류와 trade-off |

## 11. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "retriever 가 query 를 대체한다" | 보완재. retriever 안에 standard 노드의 query 가 그대로 들어감 |
| "RRF 는 무조건 60 (rank_constant)" | 60은 default. 도메인에 따라 20~80 튜닝 |
| "rescore 와 retriever 는 다른 기능" | rescore 도 retriever 노드(`rescorer`)로 통합되는 추세 |

## 12. 다음 학습

- §99 §H 인접: PIT/search_after (→ [24-pit-search-after.md](24-pit-search-after.md)), Field collapsing (→ [25-field-collapsing-rescore.md](25-field-collapsing-rescore.md))
- ES Inference API + ELSER (→ [28-elser-semantic-text.md](28-elser-semantic-text.md)) — text_similarity_reranker 가 호출하는 endpoint 의 정체
- OpenSearch search pipeline (→ [29-os-search-pipeline-neural.md](29-os-search-pipeline-neural.md)) — retrievers 의 OS 등가물
