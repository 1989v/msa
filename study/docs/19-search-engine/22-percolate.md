---
parent: 19-search-engine
seq: 22
title: Percolate 쿼리 + percolator 필드 — Reverse Search 패턴
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 07-query-dsl-patterns.md
sources:
  - https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-percolate-query.md
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/percolator
catalog-row: "§G percolate"
depth: full
---

# 22. Percolate 쿼리 + percolator 필드 — Reverse Search

> 카탈로그 매핑: §99 §G 12행 (`percolate`) — `★ 신규` → `✅ 커버`
> 학습 시간: ~1.5h · 자가평가 입구: A (처음)

---

## 1. 한 줄 핵심

**보통 쿼리** 는 "주어진 query 로 doc 을 찾는다" 라면, **percolate** 는 "주어진 doc 으로 매칭되는 query 들을 찾는다" — 즉 **reverse search**. 알람·실시간 분류·saved-search·content moderation 의 ES (Elasticsearch) 네이티브 패턴.

## 2. 공식 정의 + 등장 배경

- 1차 등장: ES 1.x percolator API (별도 endpoint) → ES 5.x 부터 일반 query 로 통합 (`percolate` query) + `percolator` field type 으로 정상화
- 등장 배경: **저장된 N 만 개 alert rule** 을 새 이벤트마다 평가해야 하는 워크로드 — Kafka Stream 으로 풀면 분류 로직을 코드로 짜야 하지만, percolator 는 **ES Query DSL (Domain-Specific Language, 도메인 특화 언어) 그대로** alert 조건을 표현 가능
- 이전 대안: app 레이어에서 N 개 query 를 doc 마다 직접 evaluate (확장성 없음)

## 3. 동작 원리

```
[일반 검색]
  query  ──────►  inverted index  ──►  matching docs

[Percolate]
  doc    ──►  in-memory inverted index (한 doc 만)
                       ▲
                       │ 저장된 query 들이 이 메모리 인덱스를 검색
  percolator field 의 모든 query  ───────────►  matching queries
```

**핵심 메커니즘**:
1. `percolator` field 에 저장된 query 들은 ES 가 **query → 텍스트** 로 분해해서 사전 색인 (term/range 등 leaf 정보)
2. percolate 시점: 입력 doc 을 **임시 in-memory 인덱스** 로 만들고, **사전 색인된 query 메타** 로 후보 query 를 빠르게 추림 (`extracted_terms` 최적화)
3. 후보 query 만 실제 매칭 검증 → 매칭된 query 의 doc id 반환

| 파라미터 | 의미 | 비용/주의 |
|---|---|---|
| `field` | percolator 타입 필드 명 | 매핑 명시 필수 |
| `document` / `documents` | 단일 또는 배열. 배열은 한 번의 round-trip 으로 N 건 평가 | response 의 `_percolator_document_slot` 으로 매칭 doc 식별 |
| `name` | percolate 절 이름 — bool 안에 여러 percolate 묶을 때 식별용 | 응답 필드 `_percolator_document_slot_<name>` 로 분리 |

> ★ "expensive query" 군에 속함 — `search.allow_expensive_queries: false` 시 차단.

## 4. 사용 예제

### 4-1. 매핑 + 저장된 query

```json
PUT /alerts
{
  "mappings": {
    "properties": {
      "message": { "type": "text" },
      "query":   { "type": "percolator" }
    }
  }
}

PUT /alerts/_doc/1?refresh
{
  "query": { "match": { "message": "bonsai tree" } }
}
```

### 4-2. 입력 doc 을 percolate

```json
GET /alerts/_search
{
  "query": {
    "percolate": {
      "field": "query",
      "document": { "message": "A new bonsai tree in the office" }
    }
  }
}
```

→ 매칭된 alert id 1 이 hits 로 돌아온다.

### 4-3. 다중 doc + 다중 percolate

```json
GET /alerts/_search
{
  "query": {
    "bool": {
      "should": [
        { "percolate": { "field": "query", "document": { "message": "bonsai tree" }, "name": "q1" } },
        { "percolate": { "field": "query", "document": { "message": "tulip flower" }, "name": "q2" } }
      ]
    }
  }
}
```

## 5. 트레이드오프 / 안티패턴

| 측면 | 장점 | 비용 / 주의 |
|---|---|---|
| 표현력 | Query DSL 전체 (bool / range / nested / geo / span 등) 그대로 alert 표현 | LTR (Learning to Rank, 랭킹 학습) / vector / function_score 같은 "점수 계산" 류는 의미가 없음 (boolean 매칭 위주) |
| 확장성 | N 만개 query 도 1번 round-trip 에 평가 | query 수 증가 시 메모리·CPU 직접 비례 → shard sharding 전략 필요 |
| 실시간성 | refresh interval 후 즉시 활성 | dedicated cluster 권장 (검색 워크로드와 분리) |
| 운영 | mapping 변경이 잦은 ES 환경에선 **percolator field 의 query 들이 mapping change 에 깨질 수 있음** | analyzer/매핑 변경 시 query 재색인 + 검증 필요 |

- **언제 쓴다**: keyword alerting / saved search / 신규 article 자동 카테고리화 / 콘텐츠 모더레이션 / 가격 알람 (`range`)
- **언제 쓰지 않는다**: query 가 score 기반 ranking 에 의존 / vector 유사도 매칭 / 1만 미만 단순 룰 (앱에서 if 문이 더 싸다)
- **흔한 오해**: "percolator 는 별도 API 다" → 더 이상 아님 (5.x 부터 그냥 query)

## 6. ES vs OpenSearch

| 측면 | Elasticsearch | OpenSearch |
|---|---|---|
| field type 지원 | `percolator` 기본 번들 | `percolator` 기본 번들 (포크 시점부터 동일) |
| 라이선스 | AGPLv3 / Elastic License | Apache 2.0 |
| 미래 | 안정 유지 — 새 기능 추가는 적음 | 동일 |

> 현 시점 두 진영 모두 호환. 코드 마이그레이션 시 percolate 로직은 그대로 작동.

## 7. 운영 / 모니터링

- **메트릭**: indexing rate (저장된 query 색인 속도), search rate (percolate 트래픽), `_nodes/stats` 의 query cache hit
- **함정**: percolator field 가 있는 인덱스에 일반 doc 도 같이 저장하면 mapping conflict — **alert 전용 인덱스로 분리** 권장
- **재색인 비용**: percolator query 수만 건 단위면 reindex 자체는 가벼움 (query 본문 = 작은 JSON), 하지만 **analyzer 변경 시 결과가 달라질 수 있어 회귀 테스트 필수**

## 8. msa 코드베이스 grounding

| 위치 | 현재 상태 | 적용 가능성 |
|---|---|---|
| analytics | ClickHouse 기반 클릭/이벤트 집계 — alert 없음 | **신규 alerting MVP 후보** — 가격 변경/품절 알람을 ES alert 인덱스 + percolate 로 구현 가능 |
| product | Kafka 발행 (item created/updated) | 발행 직후 alert sink consumer 가 percolate 호출 → 매칭 alert id 로 사용자 알림 |
| search | product 검색 read-only | percolate 는 별도 인덱스 (`alerts`) 로 분리 권장 — 검색 클러스터와 워크로드 다름 |

> 적용 시: alert 인덱스를 **별도 샤드 / replica 1** 으로 작게 운영, indexing/search rate 를 product event throughput 기준으로 사이징.

## 9. 적용 후보 / ADR (Architecture Decision Record, 아키텍처 결정 기록) 후보

**ADR-XXXX (Proposed)**: "사용자 가격 알람 / 검색 saved-search 를 ES percolate 로 구현"
- **제안**: `alerts` 인덱스 + `percolator` field 신설, product 이벤트 컨슈머에서 percolate → 알람 발송
- **이유**: app 레이어 분기 로직 회피, alert rule 표현력을 Query DSL 에 위임
- **대안**:
  - (1) Kafka Streams + 룰 엔진 (Drools 등) — 표현력↑ 비용↑
  - (2) Redis SortedSet + range scan — 단순 가격 임계값만 가능
- **결정 기준**: alert rule 표현력 vs 인프라 복잡도 (전용 ES 인덱스 1개 추가)
- **위험**: percolator field 는 mapping 변경 회귀 위험 → 변경 시 회귀 테스트 자동화 필수

## 10. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. percolate query 의 본질은? | 일반 검색의 역방향 — doc 으로 매칭되는 query 를 찾음. saved-search/alerting 패턴 | 왜 별도 API 였다가 query 로 통합됐나? (운영 단순화 + Query DSL 일관성) |
| Q2. 알람 시스템을 ES percolate vs Kafka Streams 룰엔진 어떻게 고를까? | rule 표현력이 Query DSL 로 충분하면 percolate (인프라 적음). function 점수·복잡 로직은 Streams | 둘을 섞으면? 1차 percolate 후보 → 2차 Streams 라우팅 |
| Q3. percolator field 가 mapping 변경에 깨질 수 있다는 게 무슨 뜻? | 저장된 query 가 변경된 분석기/매핑 기준으로 재해석되어 결과가 달라질 수 있음 | 회귀 테스트 자동화 방법 (저장 query × 샘플 doc → 매칭 spec) |
| Q4. 100만 개 alert rule 시 확장 전략? | rule 인덱스 분리 + shard 늘림 + dedicated cluster + percolate 배치 (`documents` 배열) | alert 우선순위로 인덱스를 hot/cold 분리 가능 |

## 11. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "percolator 는 deprecated" | 아님. 5.x 이후 query 로 통합되어 안정. ES 9.x 까지 유지 |
| "alerting 은 무조건 Watcher 다" | Watcher 는 *주기 폴링 + action* 까지 묶음. event-driven alert 는 percolate 가 더 자연 |
| "ES vs OS 차이가 클 것" | 두 진영 모두 동일. 마이그레이션 자유 |

## 12. 다음 학습

- §99 §G 인접 행: `more_like_this`, `pinned`, `distance_feature` (→ [32-specialized-queries.md](32-specialized-queries.md))
- ES Watcher (Elastic 전용 — alerting workflow 의 다른 축)
- OpenSearch Alerting plugin (percolate 와 결합 가능한 OS 측 패턴)
