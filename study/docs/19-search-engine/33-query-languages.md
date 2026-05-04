---
parent: 19-search-engine
seq: 33
title: Query Languages — Query DSL · ES|QL · EQL · SQL · PPL
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 07-query-dsl-patterns.md
  - 26-aggregations-catalog.md
sources:
  - https://www.elastic.co/docs/reference/query-languages/esql
  - https://www.elastic.co/docs/reference/query-languages/eql
  - https://www.elastic.co/docs/reference/query-languages/sql
  - https://docs.opensearch.org/3.5/search-plugins/sql/ppl/index
catalog-row: "§N Query Languages 분기"
depth: full
---

# 33. Query Languages 분기 — DSL · ES|QL · EQL · SQL · PPL

> 카탈로그 매핑: §99 §N — `★ 신규` 다수 → `✅ 커버`
> 학습 시간: ~2h · 자가평가: B

---

## 1. 한 줄 핵심

ES (Elasticsearch) / OS (OpenSearch) 는 검색·분석·보안 워크로드별로 **5종 query language** 를 가진다. 표현력·도메인·운영자 친숙도 trade-off — **새 검색은 Query DSL, 분석은 ES|QL/PPL, security 는 EQL, BI 호환은 SQL**.

## 2. 5종 한 줄 비교

| 언어 | 모양 | 강점 | 도메인 | 진영 |
|---|---|---|---|---|
| **Query DSL** | JSON tree | 표현력 최대 (모든 query 지원) | 검색 일반 | ES + OS |
| **ES\|QL** (Elasticsearch Query Language) | piped (`FROM \| WHERE \| STATS \| LIMIT`) | 분석 워크로드 + Kibana Discover 차세대 | 로그/메트릭/분석 | **ES 8.11+ 전용** |
| **EQL** (Event Query Language) | sequence + 시간 윈도우 | 시퀀스/threat hunting | Security / SIEM | ES + OS (OS는 일부) |
| **SQL** | ANSI SQL subset (REST + JDBC) | BI 도구 호환, 운영자 친숙 | 분석 + BI | ES + OS |
| **PPL** (Piped Processing Language) | piped (`source=logs \| where ... \| stats ...`) | OS 의 piped 분석 — Splunk-like | 로그 분석 | **OS 전용** |

## 3. Query DSL (재확인)

본 19 시리즈 §07 + §99 §D~G 가 풀 커버. 최강의 표현력. JSON 트리. 모든 specialized / hybrid / vector / geo / span / percolate 가 가능.

## 4. ES|QL (8.11+)

### 4-A. 모양

```esql
FROM logs-*
| WHERE @timestamp >= NOW() - 1 hour AND status >= 500
| STATS error_count = COUNT(*) BY service
| SORT error_count DESC
| LIMIT 10
```

- piped 표현 — 좌→우 변환 흐름
- Kibana Discover 의 신규 표준 (8.11+)
- ES SQL 의 후속 — 더 표현력 높음

### 4-B. 핵심 명령

| 명령 | 역할 |
|---|---|
| `FROM` | 인덱스 패턴 |
| `WHERE` | 필터 (Painless 표현 가능) |
| `STATS` | 집계 (`STATS x = AVG(price) BY category`) |
| `EVAL` | 컬럼 derive |
| `KEEP` / `DROP` / `RENAME` | 컬럼 선택 |
| `LIMIT` | 행 수 |
| `SORT` | 정렬 |
| `LOOKUP JOIN` | 다른 인덱스 lookup join (CCS 가능) |
| `GROK` / `DISSECT` | 비정형 텍스트 파싱 |
| `MV_*` (multivalue functions) | 배열 처리 |

### 4-C. CCS 통합

```esql
FROM my-index, cluster_one:my-index, cluster_two:my-index*
| STATS COUNT(http.response.status_code) BY user.id
| LIMIT 2
```

옵션: `include_ccs_metadata: true` 로 cluster 별 metric 응답 포함

### 4-D. 트레이드오프

| 측면 | 장점 | 비용 / 한계 |
|---|---|---|
| 표현 | piped → 파이프라인 사고 자연 | Query DSL 의 모든 query 지원 X (vector/percolate/specialized 일부 미지원) |
| 운영 | Kibana 통합 ↑, 분석 워크로드 가속 | OS 미지원 (마이그레이션 깨짐) |
| 학습 | SQL/Splunk 익숙한 사람 친화 | 새 문법 학습 비용 |

## 5. EQL (Event Query Language)

### 5-A. 모양

```eql
sequence with maxspan=10s
  [ process where process.name == "powershell.exe" ]
  [ network where destination.port == 4444 ]
  | head 10
```

- **시퀀스** (이벤트 A → 이벤트 B 시간 안에) 표현이 1급 시민
- Threat hunting / SIEM (Security Information and Event Management, 보안 정보 이벤트 관리) 도메인
- ES Security solution 표준 query

### 5-B. 핵심

| 키워드 | 역할 |
|---|---|
| `sequence by <field>` | 그룹별 시퀀스 |
| `maxspan` | 시간 윈도우 |
| `until` | 종료 조건 |
| `head` / `tail` | 결과 자르기 |
| `where` | 필터 |

### 5-C. 트레이드오프

- 보안 도메인 외에는 표현력 제한
- security 워크로드면 다른 언어 대비 압도적 표현력

## 6. SQL (REST + JDBC)

### 6-A. 모양

```sql
SELECT user_id, COUNT(*) AS cnt
FROM "logs-*"
WHERE @timestamp >= NOW() - INTERVAL 1 DAY
GROUP BY user_id
ORDER BY cnt DESC
LIMIT 10
```

- ANSI SQL subset (Elasticsearch SQL = JDBC + REST endpoint, OpenSearch SQL = SQL plugin)
- Tableau / Power BI / DataGrip 등 BI 도구와 JDBC 로 직결
- 내부적으로는 ES Query DSL 로 변환 → 모든 SQL 이 가능한 건 아님 (window function 일부 한계)

### 6-B. CCS

```sql
SELECT emp_no FROM "my*cluster:*emp" LIMIT 1;
```

### 6-C. 트레이드오프

- BI 호환 = 운영자 친숙
- ES 8.x 부터 ES|QL 이 후속 권장 — SQL 은 안정 유지하지만 신기능은 ES|QL 로
- OS 는 SQL plugin (active maintain)

## 7. PPL (OpenSearch 전용)

### 7-A. 모양

```ppl
source=logs-*
| where status >= 500
| stats count() by service
| sort - count
| head 10
```

- Splunk-style piped query — 운영 로그 분석에 직관적
- OS Dashboards / Observability 통합
- ES|QL 의 OS 측 등가물 — but **상호 호환 X** (문법 다름)

### 7-B. 트레이드오프

- OS 진영의 분석 표준
- 마이그레이션 시 ES|QL ↔ PPL 변환 도구 미흡 — 수동 재작성

## 8. ES vs OpenSearch

| 언어 | ES | OS |
|---|---|---|
| Query DSL | 동일 (95% 호환) | 동일 |
| **ES\|QL** | 8.11+ 표준 | **미지원** |
| **EQL** | Security solution 표준 | **plugin (제한적)** |
| **SQL** | ES SQL (JDBC + REST) | OS SQL plugin (Apache 2.0) |
| **PPL** | **미지원** | OS 표준 |

> ★ 진영 분기점: ES|QL ↔ PPL — **분석 워크로드의 운영자 인터페이스가 진영별 갈림**.

## 9. 선택 가이드

| 워크로드 | 권장 |
|---|---|
| 검색 (relevance, vector, hybrid) | Query DSL 또는 retrievers |
| 분석 / Kibana Discover | ES|QL (ES) / PPL (OS) |
| BI 도구 연계 | SQL (양쪽) |
| Security threat hunting | EQL (ES) |
| ES → OS 마이그레이션 | Query DSL 위주 작성 — 호환 가장 높음 |

## 10. 운영 / 모니터링

- ES|QL / SQL / PPL 모두 내부적으로 Query DSL 로 변환 → search slow log 잡힘
- ES|QL 의 `LOOKUP JOIN` cross-cluster 시 latency 모니터
- SQL JDBC 의 fetch_size 튜닝 — 대용량 export 시
- `_query` (ES|QL) endpoint 별 메트릭

## 11. msa 코드베이스 grounding

| 시나리오 | 현재 | 권장 |
|---|---|---|
| 운영 로그 ad-hoc 분석 | (없음 가설) | ES|QL 또는 PPL — 운영자 self-service |
| BI 연계 | (없음 가설) | SQL — Tableau/Metabase 직결 |
| 검색 코드 | Query DSL | 유지 (호환 ↑) |
| Security | (해당 없음 — 별도 SIEM 도구 가능성) | EQL 도입은 ES Security 도입 시 |

## 12. 적용 후보 / ADR

**ADR-XXXX (Proposed)**: "분석 워크로드 인터페이스 — ES 환경이면 ES|QL, OS 면 PPL. SQL 은 BI 연계로만"
- **이유**: ES|QL/PPL 은 분석 표현력 + 진영 표준
- **위험**: 진영 변경 시 인터페이스 재작성 부담 → ES vs OS 일원화 ADR 와 결합

## 13. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. ES|QL 이 등장한 이유? | piped 표현으로 분석 워크로드 가속 + Kibana Discover 차세대 | SQL 과의 차이? |
| Q2. EQL 의 sequence 의 본질? | maxspan 안의 이벤트 순서 매칭 — security threat 패턴 | sequence vs Kafka Streams 룰? |
| Q3. SQL 이 모든 Query DSL 을 표현 못 하는 이유? | DSL 의 specialized/vector/nested 등 ANSI SQL 에 없는 개념 | window function 한계? |
| Q4. ES|QL ↔ PPL 마이그레이션 비용? | 문법 다름 — 수동 재작성. 둘 다 piped 라 사고 흐름은 비슷 | 자동 변환 도구 가능성? |
| Q5. 검색은 Query DSL 인 이유? | 표현력 최대 + 5종 중 유일하게 모든 query 지원 | retrievers 가 DSL 의 후속? |

## 14. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "ES SQL 이 Query DSL 의 후속" | 아님 — 보조 인터페이스. 후속은 ES|QL |
| "EQL 은 SQL 의 변형" | 시퀀스/시간 윈도우가 1급 시민 — 다른 패러다임 |
| "PPL = ES|QL" | 진영 다른 별개 언어 |
| "SQL 로 vector 검색 가능" | 일반적으로 X — DSL 또는 retrievers |

## 15. 다음 학습

- §99 §H 의 ES|QL `LOOKUP JOIN` cross-cluster 패턴 (→ [31-ccs-ccr-snapshots.md](31-ccs-ccr-snapshots.md))
- §99 §I 의 SQL ↔ aggregation 매핑
- ES Security solution + EQL (별도 학습)
