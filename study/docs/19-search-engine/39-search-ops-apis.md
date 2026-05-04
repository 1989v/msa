---
parent: 19-search-engine
seq: 39
title: ES 검색/인덱스 운영 API 통합 — _msearch / _async_search / _reindex / _tasks / Cat / profile
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 13-indexing-pipeline-ilm.md
  - 16-operations-monitoring-rto.md
  - 17-k8s-failure-simulation.md
  - 24-pit-search-after.md
  - 25-field-collapsing-rescore.md
  - 26-aggregations-catalog.md
  - 36-autocomplete-ngram-edgengram.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/multi-search
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-template
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/async-search
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reindex
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/update-by-query
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/split-index
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/task-management
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cat-apis
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-profile
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/field-caps
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/simulate-pipeline
catalog-row: "§H _msearch / _count / _field_caps / _search_shards / _validate / _search/template / _async_search · §K _update_by_query / _delete_by_query / _split / _shrink / _clone / _reindex · §P _cat/* / _tasks / _cluster/allocation/explain · §J simulate"
depth: full
---

# 39. ES 검색/인덱스 운영 API 통합

> 카탈로그 매핑: §99 §H `_msearch` `_count` `_field_caps` `_search_shards` `_validate/query` `_search/template` `_async_search` (★ → ✅), §K `_update_by_query` `_delete_by_query` `_split` `_shrink` `_clone` (★ → ✅), §P `_tasks` `_cluster/allocation/explain` `_cat/*` profile (★/🟡 → ✅), §J ingest `simulate` (★ → ✅).
> 학습 시간 예상: ~3h · 자가평가 입구 레벨: B

`_search` 한 줄 끝나면 끝이 아니다. 운영에서는 **요청 묶음 줄이기 (`_msearch`)**, **클라이언트와 쿼리 분리 (`_search/template`)**, **장기 검색 비동기화 (`_async_search`)**, **인덱스 재단장 (`_split` / `_shrink` / `_reindex`)**, **shard 미할당 디버깅 (`_cluster/allocation/explain`)**, **느린 쿼리 해부 (`?profile=true`)** 같은 두 번째 줄의 API 들이 SLA (Service Level Agreement, 서비스 수준 협약) 와 MTTR (Mean Time To Recovery, 평균 복구 시간) 을 가른다. 이 챕터는 그 전체 지도를 한 번에 그린다.

---

## 1. 한 줄 핵심

> **`_search` 가 "검색 동사"라면 이 챕터의 API 들은 "검색 운영 동사"다.** 한 round-trip 으로 여러 검색 (`_msearch`), 비동기 장기 검색 (`_async_search`), 일괄 변경 (`_update_by_query` / `_reindex`), shard 재배치 (`_split` / `_shrink`), 진단 (`_tasks` / `_cluster/allocation/explain` / `_cat/*` / profile) — 시니어 백엔드는 이걸 RDB (Relational Database) 의 `EXPLAIN` / `pt-online-schema-change` / `SHOW PROCESSLIST` 와 같은 위치에서 본다.

---

## 2. 운영 API 의 전체 지도

| 분류 | API | 1줄 용도 | round-trip 절감 / 일관성 / 진단 |
|---|---|---|---|
| **검색 효율** | `_msearch` | NDJSON (Newline-Delimited JSON) 으로 여러 검색 묶음 | round-trip ↓ |
| | `_count` | doc 개수만 (size:0 대신) | payload ↓ |
| | `_field_caps` | 인덱스 패턴의 필드 메타 일괄 | data view 구성 |
| | `_search_shards` | 어떤 shard 가 hit 될지 사전 검사 | 캐시 워밍 / 디버깅 |
| | `_validate/query` | 쿼리 문법만 검증 | dry-run |
| **클라이언트 분리** | `_search/template` (Mustache) | 파라미터화된 쿼리 stored | versioning |
| | `_render/template` | 템플릿 → 실제 query JSON 미리보기 | 디버깅 |
| **장기 검색** | `_async_search` | 결과 ID 로 polling | 분석 / 대시보드 |
| | (PIT + search_after) | 일관 pagination | 24장 |
| | (`_search/scroll`) | legacy snapshot pagination | 8.x 비권장 |
| **일괄 변경** | `_update_by_query` | query 매칭 doc 일괄 update (script) | conflict 처리 |
| | `_delete_by_query` | query 매칭 doc 일괄 delete | DLQ (Dead Letter Queue, 데드 레터 큐) 패턴 |
| | `_reindex` | 인덱스 → 인덱스 복사 + transform | alias swap |
| | `_split` / `_shrink` / `_clone` | shard 수 변경 | rollover 보완 |
| | `_forcemerge` | segment 병합 | cold tier |
| **task 관리** | `_tasks` | 진행 중 task 조회 | reindex 추적 |
| | `_tasks/{id}/_cancel` | task 취소 | 폭주 차단 |
| **cluster 진단** | `_cluster/health` | green/yellow/red + active_shards | health-check |
| | `_cluster/stats` | 노드/인덱스 합계 | dashboard |
| | `_cluster/allocation/explain` | 왜 unassigned 인지 | shard 디버깅 핵심 |
| | `_nodes/stats` / `_nodes/hot_threads` | 노드 디테일 / thread dump | 16장 |
| **Cat** | `_cat/indices` `_cat/shards` `_cat/segments` `_cat/nodes` `_cat/recovery` `_cat/thread_pool` `_cat/aliases` `_cat/pending_tasks` | 사람이 읽는 표 | 운영 진단 |
| **품질 디버깅** | `?profile=true` | per-shard query/agg 비용 | 느린 쿼리 |
| | `_explain/{id}` | 특정 doc 의 매칭/점수 trace | relevance |
| **ingest** | `_ingest/pipeline/_simulate` | 파이프라인 dry-run | grok 디버깅 |

> 시야: **검색 동사** (`_search`) 와 **운영 동사** (이 표) 를 구분해서 기억. 모든 운영 동사는 "왜 이 결과인가?" 또는 "어떻게 한꺼번에 처리할 것인가?" 둘 중 하나의 질문에 답한다.

---

## 3. 검색 효율 API

### 3-1. `_msearch` — NDJSON multi-search

여러 검색을 한 HTTP 호출로 묶어서 round-trip 을 절감. 본문 형식은 **header 줄 + body 줄 페어** 의 NDJSON.

```bash
POST /_msearch
{ "index": "products" }
{ "query": { "match": { "name": "갤럭시" } }, "size": 5 }
{ "index": "products" }
{ "query": { "term":  { "status": "ACTIVE" } }, "size": 5 }
{ "index": "logs-*", "preference": "_local" }
{ "query": { "range": { "@timestamp": { "gte": "now-1h" } } } }
```

응답은 `responses` 배열로 각 검색 결과가 같은 순서로 반환. 일부만 실패해도 나머지는 성공할 수 있다.

#### 언제 쓰나

- **메인 페이지**: "추천 상품 12 + 인기 상품 12 + 최근 본 상품 12" 같이 동시에 여러 결과 → 클라이언트가 3 호출 vs `_msearch` 1 호출.
- **자동완성 + 검색 + 인기 키워드** 동시 호출.
- **A/B 테스트**: 같은 keyword 로 strategy A / B 동시 실행 후 결과 비교.

#### 함정

- 한 줄 = 한 JSON 객체 — line break 가 의미 있다. 문서 안에 `\n` 들어가면 깨진다.
- 호출 timeout 은 가장 느린 sub-query 가 결정 → tail latency 영향 ↑. `max_concurrent_searches` 로 조정.
- search slow log 는 sub-query 단위로 찍힘.

### 3-2. `_count` — 개수만

```bash
POST /products/_count
{ "query": { "term": { "status": "ACTIVE" } } }
# → { "count": 12345, "_shards": {...} }
```

`_search` + `size: 0` + `track_total_hits: true` 와 동일 결과지만:
- 응답 본문이 작아 클라이언트 파싱 비용 ↓
- aggregation 이 필요 없을 때 의도가 명확

> `track_total_hits` default 는 10000 cap. 정확한 카운트가 필요하면 `_count` 또는 `track_total_hits: true`.

### 3-3. `_field_caps` — 인덱스 패턴의 필드 메타

```bash
POST /logs-*,products/_field_caps?fields=*timestamp*,price
# → 인덱스별 / 필드별 type, searchable, aggregatable, indices, ...
```

- Kibana data view (이전 index pattern) 구성의 핵심.
- 와일드카드 인덱스 패턴에서 동일 필드가 여러 인덱스에 존재할 때 type 충돌 (e.g. `text` vs `keyword`) 도 한 번에 노출.
- 클라이언트 동적 query builder 가 "이 필드가 aggregatable 한가?" 를 묻기 위해 사용.

### 3-4. `_search_shards` — 어떤 shard 가 hit 되나

```bash
GET /products/_search_shards?routing=user_42
# → 라우팅·preference 적용 시 어느 shard 들을 hit 할지만 반환 (실제 검색 X)
```

용도:
- **캐시 워밍** — shard target 미리 알아서 routing aware caching.
- **디버깅** — `index.routing.allocation.include.*` 가 의도대로 동작하는지.
- **CCS (Cross-Cluster Search) 검증** — `cluster_one:products,cluster_two:products` 가 어느 remote 를 타는지.

### 3-5. `_validate/query` — 쿼리 dry-run

```bash
POST /products/_validate/query?explain=true
{ "query": { "match": { "namee": "갤럭시" } } }
# → valid:false  +  explanations[].error:"No mapping found for [namee]"
```

- **CI 단계** 에서 saved search / Watcher / Search Template 의 쿼리 syntax 를 빌드 시 검증.
- `?rewrite=true` 옵션으로 어떻게 lucene 으로 rewrite 되는지도 본다 (wildcard / multi_match 디버깅).

---

## 4. Search Template — Mustache

### 4-1. 왜 필요한가

클라이언트 코드 안에 거대한 query JSON 을 들고 있는 것은:
- relevance 튜닝 시 **클라이언트 재배포** 필요
- 마이크로서비스 4개가 같은 query 복붙 → drift
- 보안 — 사용자가 임의 query 주입 위험

→ **stored search template** 으로 query 를 cluster 에 저장, 클라이언트는 `params` 만 넘긴다.

### 4-2. 등록 / 호출 / 미리보기

```bash
# 1) 등록 — Mustache 템플릿
POST /_scripts/product-search-v2
{
  "script": {
    "lang": "mustache",
    "source": {
      "query": {
        "function_score": {
          "query": {
            "bool": {
              "must":  [{ "match": { "name": "{{keyword}}" } }],
              "filter":[{ "term":  { "status": "ACTIVE" } }]
            }
          },
          "functions": [
            { "field_value_factor": { "field": "popularityScore",
                                       "factor": "{{#popWeight}}{{popWeight}}{{/popWeight}}{{^popWeight}}1.0{{/popWeight}}",
                                       "modifier": "log1p", "missing": 0 } }
          ],
          "score_mode": "sum",
          "boost_mode": "sum"
        }
      },
      "size": "{{size}}{{^size}}20{{/size}}"
    }
  }
}

# 2) 호출
POST /products/_search/template
{
  "id": "product-search-v2",
  "params": { "keyword": "갤럭시", "popWeight": 0.5, "size": 12 }
}

# 3) 미리보기 (실제 검색 X) — 어떻게 rendering 되는지만
POST /_render/template
{
  "id": "product-search-v2",
  "params": { "keyword": "갤럭시" }
}
```

### 4-3. 운영 패턴

- **Versioning**: `product-search-v1` → `product-search-v2` 는 새 id 로 등록 후 클라이언트에서 점진 전환. `_scripts/{id}` 자체는 in-place 업데이트 가능하지만 **A/B 테스트는 별도 id** 로 분리.
- **Search Application API (8.x)**: search template + query rule + endpoint 를 한 묶음으로 추상. 본 챕터는 raw template 까지만 다루고 §99 §H Search Application 은 별도.
- **Mustache 한계**: `{{#x}}...{{/x}}` 조건 / `{{#arr}}...{{/arr}}` 반복은 가능하지만 if-else / 산술 X. 복잡 분기는 painless `script` 또는 클라이언트 단에서 params 가공.

> msa 적용: search:app 의 `ProductSearchAdapter` 는 NativeQuery 빌더를 직접 코드로 작성한다 (`/Users/gideok-kwon/IdeaProjects/msa/search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductSearchAdapter.kt`). function_score weight 튜닝마다 재배포 필요 → **search template 로 분리하면 weight 만 K8s ConfigMap 또는 etcd 에 두고 hot-reload** 할 수 있다 (개선 후보).

---

## 5. long-running search 패턴

### 5-1. `_async_search` — 비동기 제출

```bash
# 1) 제출 — 즉시 ID 반환 (혹은 wait_for_completion_timeout 안에 끝나면 결과 즉시)
POST /sales-*/_async_search?wait_for_completion_timeout=2s&keep_alive=10m
{
  "size": 0,
  "aggs": {
    "by_country": { "terms": { "field": "country", "size": 50 } }
  }
}
# → { "id": "FjJl...", "is_running": true, "is_partial": true, "response": { "_shards": {...}, "hits": {...} } }

# 2) Polling
GET /_async_search/FjJl...

# 3) 정리
DELETE /_async_search/FjJl...
```

- **partial result**: `_shards.successful < total` 이라도 그때까지의 부분 집계가 나온다. 대시보드 "loading 99 of 100 shards…" UX 에 적합.
- `keep_alive` 만료 시 자동 GC. 클라이언트 timeout 이 아니라 **서버 측 자원 점유 기간**.
- `_async_search/status/{id}` — 결과는 안 받고 진행 상태만.

### 5-2. PIT vs scroll vs async vs `_msearch` — 한 표

| 기준 | `_msearch` | PIT + search_after | scroll (legacy) | `_async_search` |
|---|---|---|---|---|
| 목적 | round-trip ↓ | 일관 pagination | 일관 pagination (구) | 장기 단일 query |
| 결과 시점 | 동기 | 동기 (페이지 단위) | 동기 (cursor) | 비동기 |
| stateful? | X | 약함 (pit_id) | 강함 (scroll_id) | 약함 (search_id) |
| deep page 비용 | from+size 한계 | O(size) | O(size) | N/A |
| 추천 시점 | 동시 여러 search | UI 페이징 / 배치 export | (legacy, 신규 X) | 분석 / 대시보드 |
| 8.x 권장 | ✅ | ✅ | 🟡 (PIT 권장) | ✅ |

> 일반 원칙: **사용자 UI 페이징 = PIT + search_after**, **운영 배치 export = PIT + search_after**, **분석/대시보드 = `_async_search`**, **메인 페이지의 동시 여러 결과 = `_msearch`**. scroll 은 신규 시스템에서 도입하지 않는다.

---

## 6. 일괄 변경 API

### 6-1. `_update_by_query`

```bash
POST /products/_update_by_query?conflicts=proceed&slices=auto&wait_for_completion=false
{
  "query": { "term": { "status": "DRAFT" } },
  "script": {
    "lang": "painless",
    "source": "ctx._source.status = 'ARCHIVED'; ctx._source.archivedAt = params.now",
    "params": { "now": "2026-05-05T00:00:00Z" }
  }
}
# → { "task": "node1:1234" }   (wait_for_completion=false 일 때)
```

- **`conflicts=proceed`** — version conflict 가 나도 다음 doc 으로 진행. default 는 abort.
- **`slices=auto`** — 내부 병렬 slice (=shard 수 권장). long task 시간 단축.
- **`wait_for_completion=false`** — task ID 반환 → `_tasks/{id}` 로 추적.
- **`refresh=true`** — 끝난 직후 즉시 검색 가시성. default 는 false.

함정: script 안에서 `ctx.op = 'noop'` 또는 `ctx.op = 'delete'` 로 분기 가능 — 의도치 않은 delete 방지를 위해 review 필수.

### 6-2. `_delete_by_query`

```bash
POST /logs-2026-04/_delete_by_query?conflicts=proceed&slices=auto
{
  "query": { "range": { "@timestamp": { "lt": "2026-04-01" } } }
}
```

- **무필터 (match_all) 위험** — 인덱스 통째로 비울 수 있다. 차라리 인덱스 자체를 `DELETE /index` 하는 게 빠르다 (segment 단위 삭제 vs 문서 단위 tombstone).
- 디스크 즉시 회수 X — segment merge 후에야 실제 회수. cold/warm 인덱스에는 `_forcemerge?only_expunge_deletes=true` 병행.
- ILM (Index Lifecycle Management, 인덱스 생명주기 관리) 의 delete phase 와 역할 분리: **시간 기반 삭제는 ILM, 비즈니스 조건 삭제는 `_delete_by_query`**.

### 6-3. `_reindex` — 인덱스 → 인덱스

```bash
POST /_reindex?wait_for_completion=false&slices=auto
{
  "source": { "index": "products_v1",
              "query": { "term": { "status": "ACTIVE" } },
              "_source": ["id","name","price","status","popularityScore"] },
  "dest":   { "index": "products_v2", "op_type": "create" },
  "script": { "source": "ctx._source.popularityScore = ctx._source.popularityScore ?: 0" }
}
```

#### Alias swap 패턴 (msa 의 search:batch 채택)

```
1) products_20260505120000 인덱스 생성 + 매핑/analyzer 적용
2) _reindex source: products (alias) → dest: products_20260505120000
3) (옵션) consumer 가 동안 들어온 변경분도 반영 — outbox / CDC 더블 라이트
4) updateAliases: remove products → products_20260504000000, add products → products_20260505120000
5) 검증 OK 면 retention 초과 인덱스 DELETE
```

→ **무중단 매핑 변경**의 표준 패턴. `IndexAliasManager.updateAliasAndCleanup` 가 이 4~5단계를 담당:

```kotlin
// /Users/gideok-kwon/IdeaProjects/msa/search/batch/src/main/kotlin/com/kgd/search/infrastructure/indexing/IndexAliasManager.kt:47
fun updateAliasAndCleanup(alias: String, newIndexName: String, maxRetention: Int = 2) {
    val existingIndices = getIndicesForAlias(alias)
    esClient.indices().updateAliases { req -> req.actions { action ->
        existingIndices.forEach { oldIndex ->
            action.remove { r -> r.index(oldIndex).alias(alias) }
        }
        action.add { a -> a.index(newIndexName).alias(alias) }
    } }
    existingIndices.sortedDescending().drop(maxRetention).forEach { ... }
}
```

#### Remote reindex

```bash
POST /_reindex
{
  "source": {
    "remote": { "host": "https://leader-cluster:9200", "username": "u", "password": "p" },
    "index":  "products"
  },
  "dest":   { "index": "products_local" }
}
```

- DR (Disaster Recovery, 재해 복구) / 마이그레이션 / on-prem → 클라우드 이전.
- `reindex.remote.whitelist` cluster 설정 사전 등록 필요.
- CCR (Cross-Cluster Replication) 가 더 적합한 시나리오 (지속 복제) 와 구분 — `_reindex` 는 **단발성 스냅샷**.

### 6-4. `_split` / `_shrink` / `_clone` — shard 수 변경

| API | shard 수 | 전제 조건 | 용도 |
|---|---|---|---|
| `_split` | N → N×K (K 정수) | source `index.number_of_routing_shards` 가 K 배수 허용해야 | 데이터 폭증 후 shard 증설 |
| `_shrink` | N → N/K | source 가 read-only + 모든 shard 가 한 노드 | 시계열 cold tier — shard 응집 |
| `_clone` | N → N (동일) | source read-only | 매핑/설정 변경 사전 복제 |

```bash
# _shrink 절차
PUT /products/_settings
{ "settings": { "index.routing.allocation.require._name": "node-cold-1",
                "index.blocks.write": true } }
# 모든 shard 가 node-cold-1 로 모이고 read-only 가 된 후
POST /products/_shrink/products_shrunk
{ "settings": { "index.number_of_shards": 1, "index.number_of_replicas": 0 } }
```

- **rollover 와의 차이**: rollover 는 시간/크기 기반으로 **새 인덱스를 시작**, shrink/split 은 **기존 인덱스를 변형**.
- shard 변경은 **재배치 (network transfer)** 가 동반 — disk usage spike 주의.

### 6-5. `_forcemerge` — segment 병합

```bash
POST /products_old/_forcemerge?max_num_segments=1&only_expunge_deletes=false
```

- cold/warm 인덱스에서 `max_num_segments=1` 권장 → 검색 효율 최대.
- hot 인덱스에는 금지 — 큰 merge 가 indexing throughput 을 잡아먹는다.
- `only_expunge_deletes=true` — `_delete_by_query` 후 disk 회수 빠르게.

---

## 7. Task 관리

### 7-1. 진행 중 task 조회

```bash
GET /_tasks?actions=*reindex*&detailed=true
# 또는 특정 노드만
GET /_tasks?nodes=node1&actions=indices:data/write/update/byquery
```

응답 구조 핵심 필드:
- `tasks.{node}:{id}.action` — 어떤 action (`indices:data/write/reindex`, `indices:data/write/update/byquery`, ...)
- `description` — 사람 읽는 query 요약
- `running_time_in_nanos`
- `cancellable` — true 면 cancel 가능
- `status` — reindex 진행도 (`{"total":1000000, "updated":234567, "version_conflicts":12}`)

### 7-2. Task cancel

```bash
POST /_tasks/{node}:{id}/_cancel
# 또는 action 패턴으로
POST /_tasks/_cancel?actions=*update/byquery&nodes=node1
```

cancel 하면 task 가 **soft cancel** 신호를 받아 안전한 지점에서 종료. `_update_by_query` / `_reindex` 는 cancellation point 가 batch 단위라 즉시 멈추진 않는다.

### 7-3. 운영 워크플로우 — `_update_by_query` 폭주 차단

```
1) 운영자 A 가 product 1억 doc 에 _update_by_query (script 잘못)
2) Kibana → Stack Monitoring 에서 indexing latency 스파이크 감지
3) GET /_tasks?actions=*update/byquery&detailed=true
   → task FjJl... running_time 5m, total=100M, updated=2M
4) POST /_tasks/{id}/_cancel
5) 원인 분석 후 script 수정 → 다시 실행 (slices=auto, conflicts=proceed)
```

> **시니어 시그널**: long task 를 cancel 할 줄 모르면 운영 사고 시 클러스터 재시작이라는 강수를 둔다 — 데이터 손실 위험.

---

## 8. Cluster 진단

### 8-1. `_cluster/health`

```bash
GET /_cluster/health?level=indices&wait_for_status=yellow&timeout=30s
```

- **status**: `green` (모든 primary + replica OK) / `yellow` (모든 primary OK, replica 일부 미할당) / `red` (primary 일부 미할당 = 검색 일부 결과 누락 가능).
- `?level=indices` — 인덱스별 status. `?level=shards` — shard 별.
- `?wait_for_status=green&timeout=30s` — health-check / readiness probe 에 활용.

### 8-2. `_cluster/allocation/explain` — shard 미할당 디버깅 핵심

가장 자주 묻는 시나리오: "왜 status 가 red 인가?"

```bash
POST /_cluster/allocation/explain
{
  "index": "products_20260505120000",
  "shard": 0,
  "primary": true
}
```

응답에서 봐야 하는 필드:
- `current_state`: `unassigned` / `started`
- `unassigned_info.reason`: `INDEX_CREATED` / `NODE_LEFT` / `ALLOCATION_FAILED` / `REPLICA_ADDED` / `DANGLING_INDEX_IMPORTED` / ...
- `node_allocation_decisions[]` — 각 노드별 `decider` 단계의 yes/no 와 사유
  - `disk_threshold` (NODE_DISK_USAGE_HIGH)
  - `awareness` (zone aware 위반)
  - `same_shard` (primary/replica 같은 노드 X)
  - `filter` (`index.routing.allocation.require/include/exclude`)
  - `enable` (`cluster.routing.allocation.enable`)

#### 운영 워크플로우 — shard unassigned 트러블슈팅

```
1) GET /_cluster/health → status: red, unassigned_shards: 3
2) GET /_cat/shards?v&h=index,shard,prirep,state,node | grep UNASSIGNED
   → products_v2 shard 0 primary UNASSIGNED
3) POST /_cluster/allocation/explain { index, shard:0, primary:true }
   → unassigned_info.reason: ALLOCATION_FAILED, last_failure: "disk_threshold"
   → node_allocation_decisions: 3 노드 중 2개 disk_threshold no
4) GET /_cat/allocation?v → 노드별 disk.percent 확인
5) 조치 분기:
   - 디스크 정리 (cold tier 로 이동, _delete_by_query, ILM 진행)
   - 임시: PUT /_cluster/settings { "transient": { "cluster.routing.allocation.disk.watermark.high": "95%" } }
   - 영구: 노드 추가 (StatefulSet replica 증가)
6) (필요 시) POST /_cluster/reroute?retry_failed=true — 실패 횟수 reset
```

`_cluster/reroute?retry_failed=true` 는 max_retries 도달 후 stuck 일 때만. 원인 해결 전에 남발하면 무한 retry.

### 8-3. `_cluster/stats`

```bash
GET /_cluster/stats?human&filter_path=indices.count,indices.shards,nodes.count,nodes.os.mem
```

- 인덱스 / shard / 노드 / heap / disk 합계.
- Prometheus exporter 의 입력 — Grafana dashboard 의 KPI (Key Performance Indicator, 핵심 성과 지표).

---

## 9. Cat APIs — 사람이 읽는 운영 표

| API | 용도 | 자주 쓰는 옵션 |
|---|---|---|
| `_cat/indices` | 인덱스별 doc 수 / 크기 / health / status | `?v&s=store.size:desc&h=index,health,docs.count,store.size` |
| `_cat/shards` | shard 분포 / state / node / prirep | `?v&h=index,shard,prirep,state,docs,store,node` |
| `_cat/segments` | 인덱스의 segment 단위 (size, deleted docs) | `?v&h=index,shard,segment,size,docs.deleted` |
| `_cat/nodes` | 노드 / role / heap / cpu / load | `?v&h=name,node.role,heap.percent,cpu,load_1m` |
| `_cat/recovery` | 진행 중 recovery (shard 복구 단계) | `?v&active_only=true` |
| `_cat/thread_pool` | thread pool active/queue/rejected | `?v&h=node_name,name,active,queue,rejected` |
| `_cat/aliases` | alias → 인덱스 매핑 | `?v&h=alias,index,is_write_index` |
| `_cat/pending_tasks` | 마스터 큐의 대기 task | `?v` |
| `_cat/allocation` | 노드별 shard 수 / disk 사용 | `?v&h=node,shards,disk.indices,disk.used,disk.percent` |
| `_cat/repositories` `_cat/snapshots` | snapshot repo / snapshot 목록 | `?v` |

#### 운영자가 매일 보는 3 표

```bash
# 1) 어떤 인덱스가 큰가
GET /_cat/indices?v&s=store.size:desc&h=index,health,docs.count,store.size&format=text

# 2) 어떤 thread pool 이 reject 되고 있는가 (write rejection = back-pressure 신호)
GET /_cat/thread_pool/write,search?v&h=node_name,name,active,queue,rejected,completed

# 3) 디스크 가득찬 노드는 누구인가
GET /_cat/allocation?v&h=node,shards,disk.percent&s=disk.percent:desc
```

> Cat APIs 는 JSON `_cluster/*` 의 사람용 버전. Grafana / 자동화는 JSON, 운영 콘솔은 cat.

---

## 10. profile / explain 디버깅

### 10-1. `?profile=true` — per-shard 비용

```bash
POST /products/_search?profile=true
{ "query": { "match": { "name": "갤럭시" } }, "size": 0,
  "aggs": { "by_status": { "terms": { "field": "status" } } } }
```

응답 `profile.shards[]` 안:
- `searches[].query[]` — query tree 의 각 lucene 단계 (`type`, `description`, `time_in_nanos`, `breakdown.{advance, score, next_doc, ...}`)
- `searches[].rewrite_time` — query rewrite 비용
- `searches[].collector[]` — TopScoreDocCollector 등
- `aggregations[]` — agg 단계별 비용

#### 읽는 법

```
profile.shards[i].searches[0].query[0].breakdown
  next_doc_count: 1000000  next_doc: 250ms     ← lucene posting iterate 비용
  score_count:    1000     score:    20ms      ← 점수 계산
```

→ next_doc_count 가 score_count 의 1000배 = filter 가 부족해 모든 doc 을 iterate. `must` → `filter` 로 빠진 게 있는지 검토.

### 10-2. `_explain/{id}`

```bash
GET /products/_explain/12345
{ "query": { "match": { "name": "갤럭시" } } }
```

해당 doc 이 매칭되는지 + 점수 trace. relevance 디버깅 — "왜 doc A 가 doc B 보다 위인가?" 답할 때.

### 10-3. profile 의 한계

- profile=true 는 자체 비용이 있다 — 운영 트래픽에 항상 켜면 latency ↑. **샘플링 또는 디버깅 시점**에만.
- 여러 shard 응답이 합쳐 큰 페이로드. `filter_path=profile.shards.searches.query` 로 필요 부분만.
- profile 만으로 안 보이는 비용 (network / coordinating 단계) 은 search slow log + APM (Application Performance Monitoring, 앱 성능 모니터링) trace 와 결합.

---

## 11. 안티패턴

### 11-1. `_search/scroll` 신규 도입

8.x 부터 PIT + search_after 가 표준. 신규 코드에서 scroll API 도입 = 기술 부채. 기존 scroll 도 점진 마이그레이션.

### 11-2. `_delete_by_query` 무필터

```bash
POST /products/_delete_by_query
{ "query": { "match_all": {} } }   # 인덱스 통째로 비움
```

- 차라리 `DELETE /products` 가 빠르고 disk 즉시 회수.
- 매칭 doc 수가 인덱스의 50% 이상이면 reindex (남길 doc 만 새 인덱스로) 가 효율적.

### 11-3. `_update_by_query` 에서 `wait_for_completion=true` 로 1억 doc

- HTTP timeout 또는 클라이언트 connection drop → task 는 background 로 계속 돈다.
- 항상 **`wait_for_completion=false` + task polling**.

### 11-4. `_reindex` 후 alias swap 안 함

- products_v1 → products_v2 reindex 만 하고 alias 그대로 → 클라이언트는 여전히 v1 검색.
- alias 가 single source of truth 여야 한다. 코드는 alias 만 알도록.

### 11-5. `_forcemerge` 를 hot 인덱스에

- merge 가 indexing throughput 을 잡아 indexing latency / kafka consumer lag 폭증.
- forcemerge 는 read-only 만. ILM warm 이후 단계에서 자동화.

### 11-6. shard 미할당 시 즉시 `_cluster/reroute?retry_failed=true`

- 원인 (디스크 / awareness / filter) 해결 전에 재시도 = 또 실패. 로그만 누적.
- 반드시 `_cluster/allocation/explain` 으로 원인 파악 → 조치 → 그 다음에 retry.

### 11-7. `?profile=true` 를 prod 트래픽 전체에

- profile 자체 비용이 latency 에 추가. 디버깅 모드 endpoint 또는 샘플링.

### 11-8. `_msearch` 안에 무거운 query 1 + 가벼운 query 9

- timeout 은 가장 느린 sub-query 가 결정. 가벼운 query 9개도 무거운 1개를 기다림.
- partition 분리 — 무거운 쪽은 `_async_search`.

### 11-9. Cat API 응답을 코드가 파싱

- cat 은 사람용 텍스트, 컬럼 순서가 버전 따라 변할 수 있다. 자동화는 `_cat/*?format=json` 또는 `_cluster/*` JSON.

### 11-10. `_search_shards` 결과를 캐시 하면서 cluster topology 변경 감지 X

- 노드 추가/제거 / shard 재분배 후 stale. TTL 짧게 + cluster state version 체크.

---

## 12. msa 적용

### 12-1. search:batch 의 `_reindex` + alias swap

현재 구현:
- `IndexAliasManager.createTimestampedIndexName` → `products_yyyyMMddHHmmss`
- `IndexAliasManager.createIndex` → nori analyzer + 매핑 적용
- `ProductDbReindexJobConfig` / `ProductApiReindexJobConfig` (Spring Batch) 가 source 데이터 읽어서 새 인덱스에 bulk 색인
- `IndexAliasManager.updateAliasAndCleanup` → alias 교체 + 오래된 인덱스 retention 관리

> 본 챕터의 **alias swap 패턴** 을 그대로 구현. `_reindex` REST API 자체는 사용하지 않고 외부 source (DB / Product API) 에서 재구성하는 모델 — 이는 ES 의 `_reindex` 가 source / dest 가 ES 인덱스로 한정되기 때문. 매핑이 영향받는 transform 은 ProductRow / ProductEsItemWriter 단계에서 처리.

#### 개선 후보

| 개선 | 현재 | 제안 |
|---|---|---|
| reindex 진행도 UI | 로그만 | search:batch 가 task ID 를 expose → operator UI 가 `_tasks/{id}` polling |
| 일부 매핑 변경 (필드 추가) | 풀 reindex | ES `_reindex` (인덱스 → 인덱스) 로 더 빠르게 — DB 재조회 불필요한 시나리오 |
| reindex 중 변경분 누락 | consumer 가 alias 통해 새 인덱스에도 동시 쓰기 | reindex 시작 시점 timestamp 저장 → reindex 완료 후 timestamp 이후 변경분 catch-up |
| 무한 retention | maxRetention=2 hard-coded | snapshot 으로 archive 후 인덱스 삭제 |

### 12-2. search:app 의 `_msearch` 후보

현재 `ProductSearchAdapter.search` 는 단일 keyword 검색만:
- 메인 페이지 "추천 + 인기 + 최근 본" → 클라이언트 3 호출 → `_msearch` 1 호출로 latency ↓.
- A/B 테스트: same keyword 로 weight 조합 A / B 두 query 동시 → 결과 분포 비교 → §34 nDCG 측정과 결합.

### 12-3. search template 도입 후보

```
Phase 1: ProductSearchAdapter 의 NativeQuery 코드를 _search/template + Mustache 로 stored
Phase 2: weight (popularityWeight, ctrWeight) 를 K8s ConfigMap 으로 분리
Phase 3: A/B 테스트 = 두 search template id (product-search-A / product-search-B) experiment 서비스가 분기
```

### 12-4. 운영 dashboard — Cat + Cluster API

| 패널 | 사용 API |
|---|---|
| 인덱스 크기 top 10 | `_cat/indices?s=store.size:desc&format=json` |
| Disk usage by node | `_cat/allocation?format=json` |
| Pending tasks | `_cat/pending_tasks?format=json` |
| Active recoveries | `_cat/recovery?active_only=true&format=json` |
| Thread pool reject | `_cat/thread_pool/write,search?format=json` |
| Cluster status | `_cluster/health` |
| Long-running tasks (reindex / by_query) | `_tasks?actions=*reindex*,*update/byquery&detailed=true` |
| Shard unassigned 원인 | `_cluster/allocation/explain` (alert 시 자동 호출) |

→ 16장 (operations-monitoring-rto) 에서 health / hot_threads 만 다뤘던 것을 본 챕터에서 보완.

### 12-5. DLQ + `_delete_by_query` 비교 — 멱등 consumer 와의 관계

search:consumer 가 멱등 처리 (ADR-0012) 로 중복 message 를 흡수하지만, **잘못된 doc 이 색인된 후 발견** 했을 때:
- 단건 — `_delete/{id}` 또는 새 이벤트 publish (correction).
- 다건 (예: bug 로 status=DRAFT 인 doc 이 색인됨) — `_delete_by_query?q=status:DRAFT` + 멱등 idempotency-key 로 재처리 차단.

> §15 msa-search-grounding 의 점검표에 "재색인 트리거 표준화" 가 있으면 본 챕터의 `_delete_by_query` + `_reindex` + alias swap 흐름을 표준 절차로 박는다.

---

## 13. 면접 한 줄 답변

### Q. `_msearch` 와 `_search` 를 같은 결과를 위해 둘 다 쓸 수 있다면 언제 `_msearch` 인가?

> "여러 search 결과가 한 번의 UI 응답에 필요할 때 — 메인 페이지의 추천/인기/최근 본 같이 동시 호출 패턴입니다. round-trip 1 회로 줄여 latency 를 줄이는 효과인데, timeout 은 가장 느린 sub-query 가 결정하므로 무거운 query 와 가벼운 query 를 섞지 않는 게 원칙입니다."

### Q. `_search/scroll` 을 신규 시스템에 도입할 의향은?

> "안 합니다. 8.x 부터 PIT + search_after 가 표준이고 scroll 은 stateful + 슬롯 점유 + 단일 사용자 스타일이라 동시 사용이 어렵습니다. 사용자 페이징과 배치 export 모두 PIT, 분석 long-running 은 `_async_search` 가 맞는 분기입니다."

### Q. `_async_search` 와 PIT 의 차이는?

> "PIT 는 `일관된 페이지 단위 검색` 을 위한 snapshot 자원, `_async_search` 는 `완료까지 오래 걸리는 단일 query 의 비동기 제출` 입니다. PIT 는 `_search` 와 함께 매 페이지 호출, async 는 ID 받고 polling — 목적이 다르므로 같이 쓸 수도 있습니다 (PIT 안에서 async 로 큰 aggregation)."

### Q. `_update_by_query` 가 도중에 멈췄을 때 어떻게 추적하나요?

> "`wait_for_completion=false` 로 제출하면 task ID 가 반환되고, `_tasks/{id}` 로 진행도 (`total/updated/version_conflicts`) 를 polling 합니다. 멈춰야 하면 `_tasks/{id}/_cancel` 로 soft cancel 신호를 보내고, 재시도 시 `slices=auto&conflicts=proceed` 로 회복력을 높입니다. cancel 은 batch 단위 cancellation point 라 즉시 멈추진 않습니다."

### Q. shard 가 unassigned 일 때 가장 먼저 보는 API 는?

> "`_cluster/allocation/explain` 로 인덱스/shard/primary 를 지정해서 호출합니다. 응답의 `unassigned_info.reason` 과 `node_allocation_decisions[]` 의 decider 가 `disk_threshold`/`awareness`/`filter` 중 어디서 막혔는지 알려주는데, 이게 첫 분기점입니다. 디스크면 cold tier 이전 또는 노드 추가, awareness 면 zone 정책 점검, filter 면 `index.routing.allocation.*` 설정 검토 — 원인 해결 전에 `_cluster/reroute?retry_failed=true` 는 권장하지 않습니다."

### Q. `_reindex` 후 alias swap 의 정합성은 어떻게 보장하나요?

> "reindex 시작 timestamp 를 저장하고, alias 교체 직전에 그 시점 이후 변경 이벤트 (CDC / Kafka) 를 catch-up 합니다. msa 의 search:batch 는 IndexAliasManager 가 updateAliases atomic 호출로 remove old + add new 를 한 번에 적용해서 검색 클라이언트가 부분 결과를 보는 윈도우가 없습니다. 그 다음 retention 초과 인덱스를 정리하는데 즉시 삭제가 아니라 N개 보존 — 롤백 여지를 남깁니다."

### Q. Cat API 의 결과를 자동화 코드가 파싱하면 안 되는 이유는?

> "Cat 은 사람용 텍스트 표라 컬럼 순서나 포맷이 버전 따라 변할 수 있습니다. 자동화는 `?format=json` 으로 받거나 `_cluster/*` / `_nodes/*` JSON API 를 써야 안전하고, Cat 은 사람이 ssh 들어가서 한 줄로 보는 진단 도구로 한정합니다."

### Q. `_search?profile=true` 에서 `next_doc_count` 가 `score_count` 의 1000배면 무엇을 의미하나요?

> "lucene 이 1000배 많은 doc 을 iterate 한 후 점수까지 계산한 doc 은 1/1000 이라는 뜻입니다 — filter 가 부족해 candidate set 이 너무 큽니다. `must` 로 들어간 조건 중 점수 영향 없는 것을 `filter` 로 옮기거나 빠른 term/range filter 를 앞에 두어 candidate 를 줄이는 튜닝이 필요합니다."

---

## 14. 회독 체크리스트

> §39 회독 체크리스트:
> - [ ] 운영 API 의 4 분류 (검색 효율 / 일괄 변경 / cluster 진단 / cat) 와 각 대표 API 1개씩
> - [ ] `_msearch` 의 NDJSON 형식 (header + body 페어)
> - [ ] `_count` vs `_search size:0` 의 차이 (의도 + payload)
> - [ ] `_field_caps` 가 Kibana data view 에서 하는 역할
> - [ ] `_validate/query` 의 CI 활용 패턴
> - [ ] Search Template (Mustache) 의 등록/호출/render 3 단계
> - [ ] `_async_search` 의 wait_for_completion_timeout / keep_alive / partial result
> - [ ] PIT / scroll / `_async_search` / `_msearch` 의 분기 기준 (목적 + 결과 시점)
> - [ ] `_update_by_query` 의 `conflicts=proceed&slices=auto&wait_for_completion=false` 권장 조합
> - [ ] `_delete_by_query` 와 ILM delete phase 의 역할 분리
> - [ ] `_reindex` + alias swap 패턴 5 단계
> - [ ] `_split` / `_shrink` / `_clone` 의 전제 조건 (read-only / 한 노드 응집)
> - [ ] `_forcemerge` 가 hot 인덱스에 금지인 이유
> - [ ] `_tasks` 조회 + cancel 의 운영 워크플로우
> - [ ] `_cluster/health` 의 status 의미 + `wait_for_status` 활용
> - [ ] `_cluster/allocation/explain` 의 `unassigned_info.reason` 과 `node_allocation_decisions[]` 읽는 법
> - [ ] shard unassigned 트러블슈팅 6 단계
> - [ ] Cat API 6종 (`indices`/`shards`/`segments`/`nodes`/`recovery`/`thread_pool`) 의 자주 쓰는 옵션
> - [ ] `?profile=true` 의 `next_doc_count` vs `score_count` 해석
> - [ ] msa 의 IndexAliasManager 가 본 챕터의 alias swap 5단계 중 어디를 담당하는지
> - [ ] search:app 에 `_msearch` 도입할 후보 시나리오 3개
> - [ ] search template 단계적 도입 (Phase 1~3)
> - [ ] DLQ + `_delete_by_query` 의 멱등 consumer 와의 관계
> - [ ] `_search/scroll` 안티패턴 + PIT 권장
> - [ ] Cat 결과 자동화 파싱 안티패턴 (사람용 vs JSON)

---

## 15. 연결 학습

- §13 — Indexing pipeline / ILM (rollover 와 split/shrink 의 역할 분리)
- §16 — Operations / monitoring / RTO (health / hot_threads / slow log) — 본 챕터가 `_cluster/allocation/explain` + `_tasks` + Cat 풀 매트릭스로 보강
- §17 — K8s 장애 시뮬레이션 (shard unassigned / disk full 시나리오의 대응 절차)
- §24 — PIT + search_after (long-running 패턴 표 §5-2)
- §25 — Field collapsing / Rescore (검색 본 query 와 본 챕터의 연결)
- §26 — Aggregations 카탈로그 (`_async_search` 가 큰 aggregation 에 사용되는 이유)
- §28 — ELSER / semantic_text (`_search/template` 으로 inference query 추상화)
- §32 — Specialized queries (rule_query / pinned 를 search template + Search Application 으로 운영)
- §34 — `_rank_eval` (Search Template 과 결합한 자동 relevance 회귀)
- §36 — 자동완성 (`_terms_enum` 이 본 카탈로그 §H 같은 family)

---

> Status: completed (2026-05-05). §99 §H / §K / §P / §J 의 ★ 항목 13개를 일괄 ✅ 로 승격.
