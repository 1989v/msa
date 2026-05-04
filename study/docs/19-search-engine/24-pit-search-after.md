---
parent: 19-search-engine
seq: 24
title: Point in Time + search_after — Scroll 의 현 표준 후속
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 02-lucene-internals.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/paginate-search-results
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/async-search
catalog-row: "§H PIT + search_after"
depth: full
---

# 24. Point in Time (PIT) + search_after — Deep Pagination 의 현 표준

> 카탈로그 매핑: §99 §H PIT/search_after — `★ 신규` → `✅ 커버`
> 학습 시간: ~1h · 자가평가: B

---

## 1. 한 줄 핵심

`from + size` 는 N 개 건너뛰기에 O(from) 비용 → 1만 이상 deep page 불가능. **PIT (Point in Time, 시점 스냅샷) + search_after** 는 정렬값 keyset pagination 으로 일관성 + O(size) 비용을 보장. **Scroll API 는 이제 legacy.**

## 2. 공식 정의 + 등장 배경

- **from/size 한계**: ES 는 `index.max_result_window` (기본 10000) 로 deep `from` 차단. coordinator 가 `from + size` 만큼 모아서 정렬해야 하기 때문
- **Scroll** (legacy): snapshot + scroll_id — 단방향 일괄 처리에는 좋지만 **stateful** 이고 search 슬롯/메모리를 점유, 동시 사용 어려움
- **PIT (7.10+)** + **search_after**: snapshot 을 명시적 자원(`pit_id`)으로 분리, search_after 는 **마지막 hit 의 sort 값** 을 다음 호출에 전달 → **stateless** 한 keyset pagination
- 8.x 부터 ES 권장: scroll → PIT + search_after

## 3. 동작 원리

```
1) PIT 생성:  POST /index/_pit?keep_alive=1m  →  { "id": "pit_id_xxx" }
2) 첫 페이지: search { pit, sort, size }       →  hits[].sort = [..., _shard_doc]
3) 다음 페이지: search { pit, sort, search_after: 이전 마지막 sort, size }
4) 끝나면:    DELETE /_pit  (id 닫기)
```

**핵심 포인트**:
- PIT 는 **세그먼트 보존** — pit 가 살아있는 동안 segment merge 가 보존되어 페이지 간 일관 결과
- `search_after` 는 정렬 keyset 이므로 sort 값에 **고유 tie-breaker** 필수 → ES 가 자동 추가하는 `_shard_doc` 로 보장
- PIT 갱신: 매 search 응답에 새 `pit_id` 가 와서 그것을 다음에 사용 (stateless)
- `keep_alive` 가 만료되면 자동 정리 (또는 명시 DELETE)

| 항목 | from/size | scroll | PIT + search_after |
|---|---|---|---|
| 깊이 한계 | 10,000 (default) | 무한 | 무한 |
| 일관성 | 페이지마다 새 검색 (변동) | scroll 시점 고정 | PIT 시점 고정 |
| 동시성 | 자유 | 어려움 (slot/메모리) | 자유 (stateless) |
| 적합 워크로드 | UI 첫 N 페이지 | 일괄 export 한 번 | UI deep + 일괄 둘 다 |
| 권장 (2024+) | 얕은 페이지 | **deprecated 경로** | **표준** |

## 4. 사용 예제

### 4-1. PIT 열기

```http
POST /products/_pit?keep_alive=1m
```
응답: `{ "id": "<pit_id>" }`

### 4-2. 첫 페이지 (sort + tie-breaker)

```json
POST /_search
{
  "size": 100,
  "query": { "match": { "name": "shoes" } },
  "pit": { "id": "<pit_id>", "keep_alive": "1m" },
  "sort": [
    { "price": "asc" },
    { "_shard_doc": "asc" }   // tie-breaker (ES 가 자동 추가하지만 명시 권장)
  ]
}
```
응답 hits 마지막의 `sort: [12000, 4294967296]` 같은 배열을 보관.

### 4-3. 다음 페이지

```json
POST /_search
{
  "size": 100,
  "query": { "match": { "name": "shoes" } },
  "pit": { "id": "<응답의 새 pit_id>", "keep_alive": "1m" },
  "sort": [{ "price": "asc" }, { "_shard_doc": "asc" }],
  "search_after": [12000, 4294967296]
}
```

### 4-4. 종료

```http
DELETE /_pit   { "id": "<pit_id>" }
```

## 5. 트레이드오프 / 안티패턴

| 측면 | 장점 | 비용 / 주의 |
|---|---|---|
| 비용 | O(size) per page | PIT 자원 점유 (segment 보존 → 디스크 ↑) |
| 일관성 | PIT 동안 동일 segment 집합 | 색인이 갱신되면 새 PIT 필요 |
| 정렬 | sort + tie-breaker 만 있으면 동작 | 동일 sort 값 동률에서 `_shard_doc` 같은 tie-breaker 누락 시 페이지 누락/중복 위험 |
| 운영 | stateless | keep_alive 누수 = open PIT 누적 → `_pit/_all` / `_nodes/stats` 모니터링 |

- **언제 쓴다**: 1만 이상 deep page / 일괄 export / batch reindex / analytics fetch
- **언제 쓰지 않는다**: UI 의 1~10 페이지 (그냥 from/size 가 짧고 캐시 친화)
- **안티패턴**:
  - PIT 없이 search_after — 페이지 사이에 색인 변동 → 결과 inconsistency
  - `_shard_doc` 누락 — 동률 sort 시 페이지 어긋남
  - keep_alive 너무 길게 (10m+) → PIT 자원 누수

## 6. ES vs OpenSearch

| 항목 | ES | OS |
|---|---|---|
| PIT | 7.10+ 표준 | 2.4+ 도입 (`_search/point_in_time`) — 호환 |
| search_after | 동일 | 동일 |
| Scroll | deprecated 경로 | 사용 가능하지만 권장 X |

## 7. 운영 / 모니터링

- `_pit` open 수 ↑ → 디스크 ↑ (segment 보존). 임계 알람 권장
- batch reindex / analytics 에서 keep_alive 를 진행시간 기반으로 합리화 (예: 30s buffer)
- search profile 의 `query_then_fetch` 단계가 search_after 마다 발생 — coordinator latency 측정
- _shard_doc tie-breaker 자동 추가 정책: 8.x 부터 자동 부여, 7.x 는 명시 권장

## 8. msa 코드베이스 grounding

| 위치 | 현재 | 적용 후보 |
|---|---|---|
| search:batch (alias swap reindex) | reindex API 사용 — scroll 내부 사용일 수 있음 | reindex from remote / async reindex 시 PIT 권장 |
| analytics 데이터 export | 없음 (ClickHouse) | ES → 외부 sink export 시 PIT + search_after 패턴 |
| FE infinite scroll 검색 | from/size 가능성 | 1만 이상 catalog 면 search_after 권장 |

## 9. 적용 후보 / ADR

**ADR-XXXX (Proposed)**: "검색 deep pagination 표준 = PIT + search_after, scroll 미사용"
- **제안**: 모든 신규 deep page 코드는 PIT + search_after, scroll 사용 코드는 마이그레이션 백로그
- **이유**: scroll 의 stateful 슬롯·메모리 점유 회피, ES 공식 권장 방향과 일치
- **위험**: PIT 누수 시 디스크 폭증 → keep_alive 표준 + PIT open 수 알람 필수

## 10. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. ES 가 deep `from` 을 막은 이유? | coordinator 가 모든 shard 의 from+size 를 모아서 정렬해야 함 → O(from·shard) 메모리·CPU 폭발 | `index.max_result_window` 변경하면 안 되는 이유 |
| Q2. scroll vs PIT+search_after 차이? | scroll = stateful (slot/메모리), PIT = snapshot 자원 + stateless keyset | scroll 이 deprecated 인 이유는? |
| Q3. PIT 가 보장하는 일관성의 정확한 의미? | PIT 시점의 segment 집합 — 이후 색인은 안 보임 | PIT 동안 마이너 reindex 시 어떤 일? |
| Q4. search_after 동률 문제 대처? | tie-breaker (_shard_doc) 추가 — 누락 시 페이지 누락/중복 | 사용자 정의 sort 가 unique 면 tie-breaker 불필요? (안전장치로 권장) |

## 11. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "PIT 는 캐시" | 캐시가 아니라 segment 보존 자원. 디스크 점유 |
| "search_after = scroll" | search_after 는 stateless keyset, scroll 은 stateful slot |
| "PIT 없이 search_after 만 쓰면 됨" | 색인 변동 시 일관성 깨짐 — PIT 페어링 권장 |

## 12. 다음 학습

- §99 §H 인접: async search (long-running 시점), profile API
- §K 의 `_reindex` + reindex from remote — PIT 와의 결합
- `_mvt` (vector tile) 는 paginated geo 와 다른 패러다임
