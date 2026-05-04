---
parent: 19-search-engine
seq: 25
title: Field Collapsing + Inner Hits + Rescore — Group-by 검색의 ES 네이티브
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 10-reranking-cross-encoder-ltr.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/collapse-search-results
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/filter-search-results
catalog-row: "§H Field collapsing, Rescore"
depth: full
---

# 25. Field Collapsing + Inner Hits + Rescore

> 카탈로그 매핑: §99 §H Field collapsing/Rescore — `★ 신규` / `🟡 부분` → `✅ 커버`
> 학습 시간: ~1.5h · 자가평가: B

---

## 1. 한 줄 핵심

- **Field Collapsing**: `terms` agg 같은 풀 group-by 가 아니라, **검색 결과 hits 안에서** 동일 필드 값을 묶어 **그룹별 top-N** 만 보여주는 기능 (예: 셀러별 대표 상품 1개씩)
- **Inner Hits**: 각 그룹/nested/parent-child 안의 매칭된 자식 hits 를 함께 반환
- **Rescore**: top-N window 만 secondary query 로 재점수 — Two-Stage retrieval 의 ES (Elasticsearch) 네이티브 표현

## 2. 공식 정의 + 등장 배경

- **Collapse**: 5.x 도입. `terms` agg 의 metric 으로는 불편한 "그룹별 대표 hit" 워크로드 (예: 검색 결과에 같은 셀러가 N 개 나오면 1 개로 압축) 를 검색 결과 자체에서 표현
- **Inner Hits**: nested / parent-child 매칭 시, 어떤 하위 doc 이 매칭됐는지 까지 응답 (단순 doc 매칭 정보로는 부족)
- **Rescore**: BM25 (Best Match 25) 1차 후 top-N 만 비싼 쿼리 (function_score, script_score) 로 재점수 → 전체 비용 ↓. **retrievers API 의 rescorer 노드**(8.14+)로 통합되는 추세

## 3. 동작 원리

### 3-A. Collapse

```
hits 정렬 → 동일 collapse.field 값마다 top-1 (or inner_hits 의 size N) 만 남김
```

- 단일 필드 collapse only. 다중 필드는 `runtime_field` 로 합성 후 collapse
- 페이지네이션 시 정확한 total 보장 안 함 (collapse 후 hit 수가 페이지 별로 다를 수 있음)

| 파라미터 | 의미 |
|---|---|
| `collapse.field` | keyword 필드 (집계 가능 타입) |
| `collapse.inner_hits` | 그룹 내 추가 hits (size, sort, _source) |
| `collapse.max_concurrent_group_searches` | inner_hits 병렬도 제한 |

### 3-B. Rescore

```
1차: query 로 top-N (window_size) 추출
2차: rescore.query (function_score / script_score / cross-encoder) 로 N 개만 재점수
```

| 파라미터 | 의미 |
|---|---|
| `window_size` | rescore 대상 (보통 50~500) |
| `query_weight` / `rescore_query_weight` | 1차/2차 점수 결합 가중 |
| `score_mode` | total / multiply / avg / max / min |

## 4. 사용 예제

### 4-1. Collapse + inner_hits

```json
POST /products/_search
{
  "query": { "match": { "name": "shoes" } },
  "collapse": {
    "field": "seller_id",
    "inner_hits": {
      "name": "same_seller",
      "size": 5,
      "sort": [ { "price": "asc" } ]
    },
    "max_concurrent_group_searches": 4
  },
  "sort": [ { "_score": "desc" } ]
}
```

→ 같은 `seller_id` 끼리 묶고, 각 그룹의 가격 오름차순 5 개를 inner_hits 에.

### 4-2. Rescore (cross-encoder 비싼 모델 적용)

```json
POST /products/_search
{
  "query": { "match": { "title": "laptop" } },
  "rescore": {
    "window_size": 100,
    "query": {
      "rescore_query": {
        "script_score": {
          "query": { "match_all": {} },
          "script": { "source": "doc['popularity'].value * Math.log(2 + doc['ctr'].value)" }
        }
      },
      "query_weight": 0.4,
      "rescore_query_weight": 1.6
    }
  }
}
```

### 4-3. Multi-stage rescore

```json
"rescore": [
  { "window_size": 200, "query": { ... 1차 rescore ... } },
  { "window_size": 50,  "query": { ... 2차 rescore (cross-encoder 등) ... } }
]
```

## 5. 트레이드오프 / 안티패턴

| 측면 | 장점 | 비용 |
|---|---|---|
| collapse | terms agg 보다 검색-친화적 (sort/score 보존) | 정확한 total 보장 X, 페이지 불균등 |
| inner_hits | 그룹 내 정확 매칭 정보 | 그룹마다 sub-search → 비용 ↑ |
| rescore | 비싼 쿼리를 top-N 만 적용 → 비용 통제 | window_size 작으면 candidate cutoff |

- **언제 쓴다**:
  - collapse — "셀러별 1개", "제품 variant 중 대표 1개" UI
  - rescore — function_score / cross-encoder 의 점수 비용 큰 함수
- **언제 쓰지 않는다**:
  - collapse 로 풀 group-by 통계가 필요하면 → terms agg
  - rescore 가 매번 도는 cross-encoder 면 → text_similarity_reranker retriever (§23)
- **안티패턴**:
  - collapse + deep pagination — 페이지 불균등으로 UX 깨짐
  - rescore window_size 와 size 가 같음 — 사실상 1차 점수 무시

## 6. ES vs OpenSearch

| 항목 | ES | OS |
|---|---|---|
| collapse | 동일 | 동일 |
| inner_hits | 동일 | 동일 |
| rescore | 동일 | 동일 |
| 통합 | retrievers 의 rescorer 노드로 통합 가속 | search pipeline 의 rerank/normalization processor 로 분리 표현 |

## 7. 운영 / 모니터링

- inner_hits 는 그룹마다 sub-search → request circuit breaker 영향
- rescore 가 무거우면 search slow log 에 잘 잡힘 — `index.search.slowlog.threshold.fetch` 도 확인
- collapse 응답의 `hits.total` 의미 (collapse 전 전체 매칭 수) — 클라이언트에 명시 주석 권장

## 8. msa 코드베이스 grounding

| 위치 | 현재 | 적용 후보 |
|---|---|---|
| product 검색 | 같은 모델/SKU 변종 다수 노출 가능 | collapse.field = `model_id` 로 대표 1개씩, inner_hits 에 색상/사이즈 |
| analytics 클릭 로그 → 인기도 점수 | function_score 로 BM25 + 인기도 결합 (가설) | 인기도 계산이 비싸지면 rescore 로 top-200 만 적용 |
| LTR 도입 시 | LTR rescorer | rescore 의 두 번째 단계 또는 text_similarity_reranker retriever 로 합성 |

## 9. 적용 후보 / ADR

**ADR-XXXX (Proposed)**: "검색 결과 group-by UI 는 collapse 표준, BM25 외 비용 큰 점수는 rescore"
- **이유**: terms agg 로 그룹 표현 시 정렬·정렬값 정보 누락. function_score 풀 적용 시 비용 폭발
- **위험**: collapse 의 total semantics 가 사용자 기대(전체 매칭 doc 수)와 다를 수 있음 → 클라이언트 표시 주의

## 10. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. collapse vs terms agg 선택 기준? | 검색 결과 정렬·hit 정보 보존이 필요하면 collapse, 통계만 필요하면 terms agg | collapse 의 total 의미는? |
| Q2. rescore 가 retriever 로 통합되는 이유? | 합성성(rescore + RRF + reranker 트리 표현) 필요 | rescore 와 text_similarity_reranker 의 본질 차이? |
| Q3. inner_hits 비용을 줄이는 방법? | size 작게, _source 필터, max_concurrent_group_searches 제한 | nested vs collapse inner_hits 차이는? |
| Q4. window_size 선정 기준? | 1차 query 의 recall@N (필요한 doc 가 N 안에 들어오는 N) 의 P95 | 너무 크게 잡으면? (rescore 비용↑, 메모리↑) |

## 11. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "collapse 가 group-by 통계까지 다 해준다" | 통계는 agg 영역. collapse 는 hits 차원 |
| "rescore 의 window_size 가 크면 더 정확하다" | recall 한계 후엔 비용만 증가 |
| "rescore 와 function_score 는 동일" | function_score 는 1차 점수 함수, rescore 는 2차 단계 |

## 12. 다음 학습

- §99 §H retrievers (→ [23-retrievers-api.md](23-retrievers-api.md)) — rescore 의 합성 표현
- §I aggregations 의 top_hits / top_metrics — group-by + 대표 hit 통계 워크로드
- §H 의 inner_hits 가 nested 와 결합되는 패턴 (§07)
