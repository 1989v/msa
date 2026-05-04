---
parent: 19-search-engine
seq: 37
title: Index Template / Component Template — 8.x composable + 인덱스 settings 핵심
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 12-cluster-topology-shard-sizing.md
  - 13-indexing-pipeline-ilm.md
  - 15-msa-search-grounding.md
  - 27-mapping-field-types.md
  - 36-autocomplete-ngram-edgengram.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/index-templates
  - https://www.elastic.co/docs/reference/elasticsearch/index-settings
  - https://www.elastic.co/docs/reference/elasticsearch/index-settings/index-modules-index-sorting
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/data-streams
catalog-row: "§C (Index Templates / Settings) — composable / component / codec / sort / refresh / translog"
---

# 37. Index Template / Component Template — 8.x composable + 인덱스 settings 핵심

> 카탈로그 매핑: §99 §C — `Index template / Component template (composable)` (★ → ✅), `index.codec` (★ → ✅), `index.sort.*` (★ → ✅).
> 학습 시간 예상: ~2h · 자가평가 입구 레벨: B

> 새 인덱스가 생성되는 순간 자동으로 "어떤 mapping / settings / aliases 를 입힐 것인가" 를 미리 정의하는 표준 메커니즘. 8.x 부터는 **composable** 이 정식 — 재사용 가능한 component 를 priority 로 합성해서 하나의 effective template 을 만든다. 본 deep file 은 legacy vs composable 의 차이, resolution 알고리즘, 핵심 인덱스 settings (`index.codec` / `index.sort.*` / `refresh_interval` / `translog.*`), msa 의 `IndexAliasManager` 에서 inline mapping 으로 처리하는 현행을 component template 으로 분해하는 도입 가이드까지 다룬다.

---

## 1. 한 줄 핵심

> **Index template = "이 패턴의 인덱스가 생기면 이 mapping/settings/aliases 를 적용해라" 의 규칙.**
> 8.x composable 은 여러 **component template** 을 priority 로 합성 — base 매핑 / 도메인 매핑 / lifecycle 정책을 별도 component 로 쪼개고 index template 에서 조립. 인덱스 settings 중 운영 영향이 큰 것은 `index.codec` (디스크 vs CPU), `index.sort.*` (early termination), `refresh_interval` (NRT (Near Real-Time, 준실시간) 가시성 vs throughput), `translog.*` (durability vs throughput).

---

## 2. 등장 배경 — 왜 composable 이 필요한가

### 2-1. legacy index template 의 한계

legacy `_template` API (~7.7 까지의 표준):

```http
PUT _template/products_template
{
  "index_patterns": ["products-*"],
  "order": 10,
  "settings": { ... },
  "mappings": { ... },
  "aliases": { ... }
}
```

- 모든 mapping/settings/aliases 를 **한 덩어리** 로 적어야 함.
- 여러 template 이 같은 패턴에 매칭되면 `order` 값으로 단순 우선순위 — 부분 override 가 어렵고 결과 mapping 을 디버깅하기 힘듦.
- 같은 base 매핑을 여러 도메인 (product / order / log) 이 공유하려 해도 **복붙** 외 방법이 없다.

### 2-2. 실패 시나리오 — legacy 의 복붙 지옥

msa 가정. 세 가지 인덱스가 있다고 하자:

```
products-*   — 상품 검색
orders-*     — 주문 audit log
logs-app-*   — 일반 애플리케이션 로그
```

세 인덱스 모두 다음 공통 매핑이 필요하다:

```json
{
  "@timestamp":  { "type": "date" },
  "service":     { "type": "keyword" },
  "trace_id":    { "type": "keyword" },
  "tenant_id":   { "type": "keyword" }
}
```

legacy 면 세 template 에 **같은 4개 필드를 세 번** 적어야 한다. 한 필드 타입을 바꿀 때 세 곳 동시에 갱신 — 누락하면 인덱스마다 매핑 drift.

### 2-3. composable 의 목표

- 매핑 / settings 를 **재사용 가능한 component** 로 쪼갠다.
- index template 은 component 를 **조립** 만 한다.
- priority 가 높은 template 1개만 매칭 → 결과 mapping 디버깅이 단순해진다 (`_simulate_index` API 로 사전 계산 가능).
- ILM (Index Lifecycle Management, 인덱스 생명주기 관리) / data stream 과 자연스럽게 통합.

### 2-4. 8.x 표준 = composable, legacy 는 deprecated

ES (Elasticsearch) 7.8 부터 composable 이 안정화, 8.x 부터는 legacy `_template` 이 deprecated. 새 코드는 항상 composable 을 써야 한다. `_index_template` (composable) vs `_template` (legacy) 의 endpoint 자체가 분리되어 있다.

---

## 3. 동작 원리 — composable resolution 알고리즘

### 3-1. 등장하는 3 종류

```
┌───────────────────────┐         ┌───────────────────────┐
│ Component Template A  │         │ Component Template B  │
│  - mapping fragment   │         │  - settings fragment  │
└──────────┬────────────┘         └──────────┬────────────┘
           │                                 │
           └─────────┬───────────────────────┘
                     ▼
           ┌───────────────────────┐
           │  Index Template X     │
           │  index_patterns: ...  │
           │  composed_of: [A, B]  │
           │  priority: 100        │
           │  template: { ... }    │  ← inline override
           └──────────┬────────────┘
                      ▼
           index "products-2026-05" 생성 시
                      ▼
           ┌───────────────────────┐
           │ Effective mapping +   │
           │ settings + aliases    │
           └───────────────────────┘
```

| 종류 | 역할 | endpoint |
|---|---|---|
| **Component Template** | 재사용 조각 (mapping fragment / settings fragment / aliases fragment) — 단독으론 인덱스에 적용 안 됨 | `PUT _component_template/<name>` |
| **Index Template** (composable) | `index_patterns` 와 `composed_of` 로 component 들을 합성 + 자체 inline override 가능 | `PUT _index_template/<name>` |
| Legacy template | (deprecated) | `PUT _template/<name>` |

### 3-2. resolution — 인덱스 생성 시 무엇이 일어나는가

새 인덱스 `products-2026-05` 가 (자동/수동) 생성될 때:

1. **매칭 후보 수집**: 모든 composable index template 중 `index_patterns` 가 매칭되는 것을 찾음.
2. **priority 비교**: 후보 중 가장 높은 `priority` 1개만 선택. 같은 priority 면 **에러** (충돌 명시화 — legacy 와의 차이).
3. **component 병합**: 선택된 template 의 `composed_of: ["A", "B", "C"]` 순서로 component 를 차례로 병합. 같은 키는 **뒤에 오는 것이 이김**.
4. **inline 병합**: index template 자체의 `template: { mappings, settings, aliases }` 가 **마지막** 으로 병합. 즉 inline 이 component 보다 우선.
5. **결과 mapping/settings 로 인덱스 생성**.

> 핵심 mental model: **"왼쪽 → 오른쪽, 그 다음 inline"** 순으로 깊은 merge.

### 3-3. 충돌 처리

| 상황 | 처리 |
|---|---|
| 같은 필드명, 같은 타입 | 뒤에 오는 component 의 옵션이 이김 (예: `analyzer` 변경) |
| 같은 필드명, 다른 타입 | 뒤에 오는 것으로 교체 (조용히 덮어씀 — 위험) |
| `settings` 의 같은 키 | 뒤에 오는 것이 이김 |
| 두 index template 이 같은 priority + 겹치는 pattern | **에러** (legacy 의 silent ordering 과 다름) |
| component 가 존재하지 않는 이름을 가리킴 | **에러** (PUT 시점 검증) |

### 3-4. `_simulate_index` — 사전 검증

composable 의 강점: 인덱스 생성 전에 effective mapping 을 미리 볼 수 있다.

```http
POST _index_template/_simulate_index/products-2026-05
```

응답:
```json
{
  "template": {
    "settings": { "index": { "number_of_shards": "3", "codec": "best_compression" } },
    "mappings": { "properties": { ... } },
    "aliases": { "products": {} }
  },
  "overlapping": []
}
```

`overlapping` 에 다른 매칭 후보가 노출 → priority 충돌 디버깅에 유용.

### 3-5. 반대 방향 — `_simulate` (template 자체 시뮬)

```http
POST _index_template/_simulate/my_template
{ "index_patterns": ["foo-*"], "composed_of": ["a", "b"] }
```

- "이 template 을 PUT 하면 어떻게 보일까" 를 dry-run.
- CI 에서 새 component 추가 전 회귀 검사용.

---

## 4. 사용 예제 — component + index template 조합

### 4-1. 시나리오: msa 의 `products` 인덱스를 component 로 분해

목표:
- 모든 검색 인덱스 공통 (timestamp / 멀티테넌시) → `commerce_base_mapping`
- 검색 도메인 공통 settings (한국어 nori + best_compression) → `commerce_search_settings`
- product 전용 매핑 (name / price / popularityScore / ...) → `product_mapping`
- ILM 정책 (warm 30d, delete 365d) → `commerce_lifecycle`

### 4-2. component template 정의

```http
PUT _component_template/commerce_base_mapping
{
  "template": {
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "tenant_id":  { "type": "keyword" },
        "trace_id":   { "type": "keyword" }
      }
    }
  },
  "_meta": {
    "owner": "search-team",
    "description": "msa 공통 base 매핑 (timestamp / tenant / trace)"
  }
}
```

```http
PUT _component_template/commerce_search_settings
{
  "template": {
    "settings": {
      "index": {
        "number_of_shards": 3,
        "number_of_replicas": 1,
        "codec": "best_compression",
        "refresh_interval": "5s",
        "analysis": {
          "analyzer": {
            "nori_analyzer": {
              "type": "custom",
              "tokenizer": "nori_tokenizer"
            }
          }
        }
      }
    }
  }
}
```

```http
PUT _component_template/product_mapping
{
  "template": {
    "mappings": {
      "properties": {
        "name": {
          "type": "text",
          "analyzer": "nori_analyzer",
          "fields": {
            "raw":          { "type": "keyword", "ignore_above": 256 },
            "autocomplete": { "type": "search_as_you_type" }
          }
        },
        "price":            { "type": "double" },
        "status":           { "type": "keyword" },
        "createdAt":        { "type": "date", "format": "yyyy-MM-dd'T'HH:mm:ss" },
        "popularityScore":  { "type": "double" },
        "ctr":              { "type": "double" },
        "cvr":              { "type": "double" },
        "scoreUpdatedAt":   { "type": "long" }
      }
    }
  }
}
```

```http
PUT _component_template/commerce_lifecycle
{
  "template": {
    "settings": {
      "index": {
        "lifecycle": {
          "name": "products_policy",
          "rollover_alias": "products"
        }
      }
    }
  }
}
```

### 4-3. index template 으로 조립

```http
PUT _index_template/products_template
{
  "index_patterns": ["products-*"],
  "priority": 100,
  "composed_of": [
    "commerce_base_mapping",
    "commerce_search_settings",
    "product_mapping",
    "commerce_lifecycle"
  ],
  "template": {
    "aliases": {
      "products": {}
    }
  },
  "_meta": {
    "managed_by": "search-batch",
    "version": 3
  }
}
```

이제:

```http
PUT products-2026-05-04T120000
```

→ effective mapping = base + search_settings + product_mapping + lifecycle + inline alias.
→ `IndexAliasManager.createIndex(...)` 가 **mapping 직접 빌드** 할 필요 없이 인덱스만 만들면 자동 적용 (§7 참조).

### 4-4. Kotlin (ES Java client) 으로 동일한 작업

```kotlin
import co.elastic.clients.elasticsearch.ElasticsearchClient
import co.elastic.clients.elasticsearch.indices.PutComponentTemplateRequest
import co.elastic.clients.elasticsearch.indices.PutIndexTemplateRequest

fun bootstrapTemplates(es: ElasticsearchClient) {
    es.cluster().putComponentTemplate { req ->
        req.name("commerce_base_mapping")
            .template { t ->
                t.mappings { m ->
                    m.properties("@timestamp") { p -> p.date { it } }
                     .properties("tenant_id")  { p -> p.keyword { it } }
                     .properties("trace_id")   { p -> p.keyword { it } }
                }
            }
    }

    es.cluster().putComponentTemplate { req ->
        req.name("commerce_search_settings")
            .template { t ->
                t.settings { s ->
                    s.numberOfShards("3")
                     .numberOfReplicas("1")
                     .codec("best_compression")
                     .refreshInterval { ri -> ri.time("5s") }
                }
            }
    }

    es.indices().putIndexTemplate { req ->
        req.name("products_template")
            .indexPatterns("products-*")
            .priority(100L)
            .composedOf("commerce_base_mapping",
                        "commerce_search_settings",
                        "product_mapping",
                        "commerce_lifecycle")
            .template { t ->
                t.aliases("products") { a -> a }
            }
    }
}
```

### 4-5. 분리 패턴 — mapping / settings / aliases only

component template 의 큰 장점은 "조각" 만 정의해도 된다는 것:

| 조각 | 예시 component |
|---|---|
| **mapping only** | `commerce_base_mapping`, `product_mapping` |
| **settings only** | `commerce_search_settings`, `commerce_lifecycle` |
| **aliases only** | `tenant_alias_acme`, `tenant_alias_globex` (멀티 테넌시) |

→ 도메인 별 mapping / 운영 별 settings / 테넌트 별 aliases 를 직교 분리.

---

## 5. 인덱스 settings 핵심

### 5-1. 한눈 비교

| 설정 | default | 운영 영향 | 변경 가능 여부 |
|---|---|---|---|
| `index.number_of_shards` | 1 (8.x) | 병렬도 / 라우팅 — primary 샤드 수 | 인덱스 생성 시점만 (이후 reindex 필요) |
| `index.number_of_replicas` | 1 | 가용성 / 검색 throughput | 동적 (`PUT _settings`) |
| `index.refresh_interval` | 1s | NRT 가시성 vs 인덱싱 throughput | 동적 |
| `index.codec` | `default` | 디스크 vs CPU | 인덱스 생성 시점 (이후 force_merge 필요) |
| `index.sort.*` | (없음) | segment 내 sort + early termination | **인덱스 생성 시점만** |
| `index.translog.durability` | `request` | 인덱싱 안정성 vs throughput | 동적 |
| `index.translog.sync_interval` | 5s | (async 모드) fsync 주기 | 동적 |
| `index.translog.flush_threshold_size` | 512mb | translog → segment flush trigger | 동적 |
| `index.max_result_window` | 10000 | from+size 깊이 한계 | 동적 |

### 5-2. `index.codec` — 디스크 vs CPU

| codec | 압축 | 압축 해제 CPU | 인덱스 크기 |
|---|---|---|---|
| `default` (LZ4) | 약함 | 빠름 | baseline 100% |
| `best_compression` (DEFLATE) | 강함 | 느림 (~25% ↑) | baseline 약 75% |
| `lucene_default` (= `default`) | 별칭 | | |

→ **8.10+ 부터 ZSTD 기반 새 codec 도입 진행** (서버리스 first, on-prem 8.x 에선 일부 옵션). 추세는 best_compression 자리를 ZSTD 가 대체.

#### 선택 기준

| 워크로드 | 권장 |
|---|---|
| 검색 위주, 디스크 비싸지 않음 | `default` |
| 시계열 / 로그 (한 번 쓰고 거의 안 읽음) | `best_compression` |
| 검색 매우 잦은 hot 인덱스 | `default` (CPU 절약) |
| 콜드 / 아카이브 인덱스 | `best_compression` 강제 |

#### 함정

- codec 은 **인덱스 생성 시점에만** 효과. 기존 인덱스 settings 변경해도 새 segment 부터 적용. `force_merge` 로 segment 재작성 시 비로소 전환 완료.
- ILM 의 cold/frozen phase 와 결합해서 자동 force_merge → codec 전환이 표준 패턴.

### 5-3. `index.sort.*` — segment 내 정렬 + early termination

#### 무엇인가

**index sort** 는 segment 내부의 doc 들을 특정 필드 순서로 미리 정렬해서 디스크에 기록하는 기능. 검색 결과를 같은 순서로 sort 하면 **상위 N 만 읽고 종료** (early termination) 가능.

```http
PUT products-2026-05
{
  "settings": {
    "index": {
      "sort.field":  ["popularityScore", "createdAt"],
      "sort.order":  ["desc", "desc"]
    }
  },
  "mappings": { ... }
}
```

#### 효과

```
일반 인덱스 + sort: popularityScore desc, size: 20
  → 모든 doc 평가 후 top 20 추출 (전체 segment 스캔)

index.sort = popularityScore desc 인덱스 + 같은 sort + size:20 + track_total_hits:false
  → 각 segment 의 첫 20 doc 만 읽고 종료 (early termination)
  → latency 50~80% 감소 (대용량 인덱스에서)
```

#### 제약

- **인덱스 생성 시점에만 설정 가능** — 이후 변경 ❌. 잘못 설정하면 reindex.
- 인덱싱 throughput 약 5~15% 감소 (sort 비용).
- 검색 시 **같은 sort** 를 명시해야 early termination 발동. random sort 면 효과 ❌.
- `track_total_hits: false` (또는 작은 숫자) 와 결합해야 발동. 정확한 hit 수가 필요하면 모든 segment 스캔.
- multi-field sort 시 첫 필드의 cardinality 가 너무 낮으면 (예: status keyword 3개) 효과 미미.

#### msa 에 적용 가능한 시나리오

`popularityScore` 가 검색의 dominant 정렬 키라면 (실제로는 BM25 + function_score 라 dominant 가 아닐 수 있음) `index.sort.field=["popularityScore"]` 로 hot 검색 latency 단축. 단 score 기반 sort 는 index sort 효과 없음 → **명시적 sort 필드** 가 있을 때만 의미.

### 5-4. `refresh_interval` — NRT 가시성 vs throughput

```
default: 1s — 1 초마다 segment 가시화
```

#### 트레이드오프

| 값 | NRT 지연 | 인덱싱 throughput | 적합 워크로드 |
|---|---|---|---|
| `-1` (off) | ∞ (수동 refresh 필요) | 최대 | 배치 reindex 중 |
| `1s` (default) | ~1s | baseline | 일반 검색 |
| `5s` | ~5s | +20~30% | 이커머스 검색 (msa 에 적합) |
| `30s` | ~30s | +50%+ | 로그 / 분석 |

#### 패턴

- **bulk reindex** 시작 전: `PUT _settings { "refresh_interval": "-1" }`
- bulk 완료 후: `PUT _settings { "refresh_interval": "5s" }`
- 마지막에 `_refresh` 한 번 호출.

→ `IndexAliasManager` 의 alias swap 직전 reindex 가 이 패턴의 적용 후보 (§7).

### 5-5. `index.translog.*` — durability vs throughput

translog 는 segment 가 fsync 되기 전 변경사항을 보장하는 WAL (Write-Ahead Log, 선기록 로그).

| 설정 | default | 의미 |
|---|---|---|
| `index.translog.durability` | `request` | `request` = 모든 인덱싱 요청마다 fsync. `async` = `sync_interval` 마다 fsync (loss window 최대 N초) |
| `index.translog.sync_interval` | 5s | (`async` 시) fsync 주기 |
| `index.translog.flush_threshold_size` | 512mb | 이 크기 초과 시 segment flush |

#### 패턴

| 워크로드 | durability | sync_interval |
|---|---|---|
| 결제 / 주문 audit | `request` | (default) |
| 검색 인덱스 (ES = 읽기 모델) | `async` | 5~30s |
| 로그 / 분석 | `async` | 30s+ |

→ msa 에서 `products` 인덱스는 SoR (System of Record, 원본 데이터 시스템) 가 product MySQL 이고 ES 는 읽기 모델이므로 `async` + 30s 도 안전. 손실 시 batch 리인덱싱으로 복구.

### 5-6. `index.number_of_shards` 와 `replicas`

→ §12 의 sizing 공식 참조. 본 문서는 template 에서의 설정 위치만:

```json
"settings": {
  "index": {
    "number_of_shards":   3,
    "number_of_replicas": 1
  }
}
```

⚠ `number_of_shards` 는 인덱스 생성 후 변경 불가 (split / shrink API 로만 가능). template 에 박을 때 도메인 별 정확한 값 필요.

### 5-7. `index.max_result_window` — deep pagination 가드

default: 10,000. `from + size > 10000` 이면 에러.

→ deep pagination 이 필요하면 **PIT + search_after** (§24) 사용 — `max_result_window` 늘리는 건 안티패턴 (heap 폭증).

---

## 6. 트레이드오프 / 안티패턴

### 6-1. component 너무 잘게 쪼개기

```
commerce_field_timestamp
commerce_field_tenant_id
commerce_field_trace_id
commerce_field_service
...
```

- component 가 10개 넘으면 조립 순서와 충돌 디버깅이 어려움.
- 권장: **3~5 개 component / template** 정도로 묶기 (도메인 / 운영 / 라이프사이클).

### 6-2. priority 충돌

```
products_template_a: priority=100, patterns=["products-*"]
products_template_b: priority=100, patterns=["products-2026-*"]
→ products-2026-05 생성 시 ERROR (같은 priority + 매칭)
```

- 명시적 priority 차등 (a=100, b=200) 또는 patterns 분리.
- legacy 의 `order` 는 같은 값 허용 (silent merge) 였으나 composable 은 명시 에러 — **good thing**.

### 6-3. inline override 남용

```json
{
  "composed_of": ["product_mapping"],
  "template": {
    "mappings": { "properties": { "name": { "type": "keyword" } } }
  }
}
```

- inline 이 component 의 `name: text` 를 `keyword` 로 silent override → 검색 깨짐.
- 원칙: **inline 은 aliases 와 priority-tail 만**, 매핑은 component 로.

### 6-4. legacy `_template` 와 composable 혼용

- 같은 패턴에 legacy + composable 둘 다 매칭 → composable 이 이김 (8.x 동작).
- 새 환경: **composable 만**. legacy 는 마이그레이션 후 삭제.

### 6-5. component 가 인덱스에 직접 적용된다고 오해

- component template 단독으론 어떤 인덱스에도 적용 안 됨. 반드시 index template 의 `composed_of` 에 들어가야 효과.

### 6-6. mapping 한 번에 다 적기 (= legacy 회귀)

- 새 도메인 추가 시 base + 도메인 매핑 분리하지 않고 한 component 에 다 적으면 재사용 불가.
- 새 인덱스 종류가 생길 때 base 부분 추출 리팩터링 비용 ↑.

### 6-7. `index.sort` 를 score 정렬에 기대하기

- BM25 score 정렬은 query time 계산 → index sort 영향 ❌.
- index sort 는 **명시적 numeric/date/keyword sort 필드** 만 효과.

---

## 7. msa 적용 — `IndexAliasManager` 를 component template 으로 분해

### 7-1. 현재 (`search/batch/.../IndexAliasManager.kt:20-42`)

```kotlin
fun createIndex(indexName: String) {
    esClient.indices().create { req ->
        req.index(indexName)
           .settings { s ->
               s.analysis { a ->
                   a.analyzer("nori_analyzer") { an ->
                       an.custom { c -> c.tokenizer("nori_tokenizer") }
                   }
               }
           }
           .mappings { m ->
               m.properties("name") { p -> p.text { t -> t.analyzer("nori_analyzer") } }
                .properties("status") { p -> p.keyword { it } }
                .properties("price") { p -> p.double_ { it } }
                .properties("createdAt") { p ->
                    p.date { d -> d.format("yyyy-MM-dd'T'HH:mm:ss") }
                }
           }
    }
}
```

문제:
1. mapping 이 코드에 **inline 하드코딩** — 매핑 변경하려면 배포 필요.
2. 운영 settings (codec / refresh_interval / number_of_shards) 가 default 그대로 — 검색 성능/저장 최적화 부재.
3. `popularityScore`, `ctr`, `cvr`, `scoreUpdatedAt` 필드는 누락 (실제 `ProductEsDocument` 와 drift).
4. `name.raw` (keyword) `name.autocomplete` (§36) 같은 multi-field 도 없음.
5. 새 인덱스 종류 (orders / search-logs) 가 생기면 같은 base 매핑을 또 적어야 함.

### 7-2. 도입 후 흐름

```
[부트스트랩 1회 — search/batch 또는 Helm chart]
  PUT _component_template/commerce_base_mapping
  PUT _component_template/commerce_search_settings
  PUT _component_template/product_mapping
  PUT _index_template/products_template

[리인덱싱 시 — IndexAliasManager.createIndex(...)]
  PUT products-2026-05-04T120000   ← mapping/settings 자동 적용
```

`IndexAliasManager.createIndex` 의 inline mapping 블록 **삭제**. 인덱스 이름만 만들어주면 ES 가 template resolution 으로 mapping/settings 채움.

### 7-3. 분해안

| component | 역할 | 변경 빈도 |
|---|---|---|
| `commerce_base_mapping` | @timestamp / tenant_id / trace_id | 분기에 1회 |
| `commerce_search_settings` | nori analyzer / shards=3 / replicas=1 / codec / refresh=5s | 월 1회 정도 |
| `product_mapping` | name (multi-field) / price / status / score 필드들 | 신규 필드 추가 시 |
| `commerce_lifecycle` | ILM 정책 연결 | 정책 개정 시 |

### 7-4. settings 권장값 (msa product 검색)

```json
{
  "index": {
    "number_of_shards":   3,
    "number_of_replicas": 1,
    "refresh_interval":   "5s",
    "codec":              "best_compression",
    "translog": {
      "durability":    "async",
      "sync_interval": "30s"
    }
  }
}
```

근거:
- shards=3: §12 sizing 기준 (1 shard 는 CPU 병렬도 부족, 5+ 는 cluster 작아 오버헤드).
- replicas=1: 검색 throughput 2x + 가용성. 클러스터가 2 노드면 1 권장.
- refresh=5s: 이커머스에서 5s NRT 면 충분 (default 1s 대비 throughput +20%).
- codec=best_compression: product 인덱스는 검색 빈도가 매우 높지 않고 디스크가 비쌈 (cluster 비용 ↓).
- translog async + 30s: ES 는 SoR 아님. 손실 시 batch 리인덱싱으로 복구 가능.

### 7-5. mapping 권장값 (자동완성 §36 결합)

```json
{
  "properties": {
    "name": {
      "type": "text",
      "analyzer": "nori_analyzer",
      "fields": {
        "raw":          { "type": "keyword", "ignore_above": 256 },
        "autocomplete": { "type": "search_as_you_type" }
      }
    },
    "popularityScore": { "type": "double" },
    "ctr":             { "type": "double" },
    "cvr":             { "type": "double" },
    "scoreUpdatedAt":  { "type": "long" }
  }
}
```

→ §36 의 자동완성 옵션 A (search_as_you_type) 을 자연스럽게 도입.

### 7-6. ILM 와의 결합 (가벼운 언급 — §40 에서 풀 다룸 예정)

`commerce_lifecycle` component 가 `lifecycle.name` 만 가리키고, 실제 정책은 별도 `_ilm/policy/products_policy` 로:

```http
PUT _ilm/policy/products_policy
{
  "policy": {
    "phases": {
      "hot":    { "min_age": "0ms",  "actions": { "rollover": { "max_age": "30d", "max_size": "50gb" } } },
      "warm":   { "min_age": "30d",  "actions": { "forcemerge": { "max_num_segments": 1 }, "set_priority": { "priority": 50 } } },
      "delete": { "min_age": "365d", "actions": { "delete": {} } }
    }
  }
}
```

product 인덱스는 시계열 아니므로 ILM 적용 의미 ↓ (오히려 alias swap 으로 충분). **ILM 은 logs / analytics 인덱스에서 의미** — §40 에서 data stream 과 함께.

### 7-7. 도입 단계 (Phase plan)

```
Phase 1: 부트스트랩 — component + index template 4개 PUT (1주)
         search-batch 의 Initializer 또는 Helm chart hook 으로 idempotent PUT
Phase 2: IndexAliasManager.createIndex 의 inline mapping 제거 (1주)
         template 적용 검증: _simulate_index 로 effective mapping 확인
Phase 3: settings 튜닝 — refresh=5s / codec=best_compression 적용 후
         indexing throughput / search latency 회귀 측정 (2주)
Phase 4: name.autocomplete multi-field 도입 (§36 옵션 A)
Phase 5: index.sort 검토 — score 정렬이 dominant 면 skip,
         최신순 sort 가 hot path 면 sort.field=createdAt 적용
```

---

## 8. ADR 후보 (검색 인덱스 표준화)

> **ADR-XXXX-7: 검색 인덱스 매핑/settings 표준화 — composable index template + component 분해**
>
> **Context**: 현재 `IndexAliasManager` 가 mapping 을 코드에 inline 하드코딩. 새 필드 추가 / settings 튜닝 시 배포 필요. 신규 인덱스 종류 (search-logs, orders-audit) 추가 시 base 매핑 복붙. settings 가 default 라 검색 throughput / 디스크 비효율.
>
> **Decision**: 8.x composable index template 채택.
> - component template 4개 (`commerce_base_mapping`, `commerce_search_settings`, `product_mapping`, `commerce_lifecycle`) 로 분해.
> - `products_template` 이 4개를 `composed_of` 로 조립.
> - inline mapping 은 코드에서 제거. `IndexAliasManager` 는 인덱스 이름만 PUT.
> - 부트스트랩은 search-batch Initializer 또는 Helm chart hook 에서 idempotent PUT.
>
> **Settings 표준값** (msa product):
> - `number_of_shards: 3`, `number_of_replicas: 1`
> - `refresh_interval: 5s`, `codec: best_compression`
> - `translog.durability: async`, `translog.sync_interval: 30s`
>
> **Consequences**:
> - (+) 매핑 변경이 데이터 작업 (template PUT) 로 격하 — 배포 분리.
> - (+) 새 인덱스 종류 추가 시 base + lifecycle 재사용.
> - (+) `_simulate_index` 로 사전 검증 → drift 방지.
> - (-) 부트스트랩 절차 추가 (template PUT 누락 시 인덱스가 default mapping 으로 생김).
> - (-) component 분해 학습 곡선 (search-team).
>
> **Alternatives 검토**:
> - legacy `_template` — deprecated. 채택 ❌.
> - 코드 inline 유지 — drift 지속 + 운영 유연성 ↓. 채택 ❌.
> - dynamic_templates 만으로 — 매핑 정확성 보장 어려움. 채택 ❌.

---

## 9. 면접 한 줄 답변

### Q. legacy index template 과 composable index template 의 차이는?

> "legacy `_template` 은 mapping/settings/aliases 를 한 덩어리로 적고 `order` 로 단순 우선순위를 매기는 방식이고, 8.x composable 은 재사용 가능한 component template 들을 `composed_of` 로 조립합니다. 같은 패턴에 같은 priority 가 매칭되면 명시 에러를 내고, `_simulate_index` 로 사전 검증이 가능해서 mapping drift 디버깅이 훨씬 쉽습니다. 8.x 부터 legacy 는 deprecated 입니다."

### Q. component template 의 resolution 순서는?

> "왼쪽 → 오른쪽으로 깊은 merge 한 뒤, 마지막에 index template 의 inline `template` 이 덮어씁니다. 같은 키는 뒤에 오는 것이 이기고, 두 index template 이 같은 priority + 겹치는 patterns 를 가지면 인덱스 생성이 에러로 막힙니다. legacy 의 silent merge 와 다른 점이 명시화입니다."

### Q. `index.sort` 의 효과와 제약은?

> "segment 내부 doc 들을 미리 정렬해서 디스크에 쓰고, 검색 시 같은 sort + 작은 size 면 상위 N 만 읽고 종료하는 early termination 이 가능합니다. latency 가 50~80% 단축될 수 있지만 인덱싱 throughput 약 5~15% 감소, 인덱스 생성 시점에만 설정 가능, score 정렬엔 효과 ❌, `track_total_hits: false` 와 결합해야 발동 — 4가지 제약이 있습니다."

### Q. `index.codec` 의 default 와 best_compression 의 차이는?

> "default 는 LZ4 기반으로 압축 약하고 압축 해제 빠름, best_compression 은 DEFLATE 기반으로 디스크 약 25% 절감하지만 압축 해제 CPU 약 25% 증가합니다. 검색 빈도가 매우 높은 hot 인덱스는 default, 시계열/콜드/아카이브는 best_compression. 8.10+ 부터는 ZSTD 옵션이 점진 도입 중입니다. codec 은 인덱스 생성 시점에만 효과가 있고, 기존 segment 는 force_merge 로 재작성해야 전환 완료됩니다."

### Q. `refresh_interval` 을 1s 에서 5s 로 늘리면 무엇이 좋아지나요?

> "인덱싱 throughput 이 약 20~30% 증가합니다. NRT 가시성이 1s 에서 5s 로 길어지는 trade-off 인데, 이커머스 검색 같은 도메인은 5s 가 사용자 경험상 충분합니다. 배치 reindex 중에는 `-1` (off) 로 끄고 끝난 뒤 `_refresh` 한 번 호출하는 패턴이 표준입니다."

### Q. msa 의 search 인덱스 매핑은 현재 어떻게 관리되나요?

> "현재 `IndexAliasManager.createIndex` 가 mapping 을 코드에 inline 하드코딩합니다. nori analyzer + name/status/price/createdAt 만 있고 popularityScore/ctr/cvr/scoreUpdatedAt 누락, settings 도 default 그대로입니다. component template 4개 (base / search_settings / product_mapping / lifecycle) 로 분해해서 composable index template 으로 조립하고, inline mapping 을 코드에서 제거하는 ADR 이 후보입니다."

### Q. ILM 과 index template 은 어떻게 결합되나요?

> "index template 의 settings 에 `index.lifecycle.name` 으로 ILM 정책 이름을 가리키면, 인덱스가 생성되는 순간 자동으로 정책에 묶입니다. 정책 자체는 별도 `_ilm/policy/<name>` 으로 관리하고 component template 으로 정책 참조만 분리하는 게 표준 패턴입니다. data stream 과 결합하면 hot-warm-cold 자동 rollover 까지 처리됩니다."

---

## 10. 흔한 오해 정정

> **"component template 만 PUT 하면 인덱스에 적용된다"**

- ❌ component 단독으론 어떤 인덱스에도 적용 안 됨. 반드시 index template 의 `composed_of` 에 들어가야 효과.

> **"legacy 와 composable 을 동시에 쓰면 legacy 가 이긴다"**

- ❌ 8.x 에서는 같은 패턴 매칭 시 composable 이 우선. legacy 는 deprecated 라 새 환경에선 쓰지 말 것.

> **"`index.sort` 가 BM25 검색도 빠르게 한다"**

- ❌ score 기반 정렬은 query 시점 계산이라 index sort 영향 ❌. 명시적 numeric/date/keyword sort 필드일 때만 early termination.

> **"`number_of_shards` 는 나중에 바꿀 수 있다"**

- ❌ 인덱스 생성 후 변경 불가. split / shrink API 로만 가능 (제약 많음). template 단계에서 정확한 값 결정 필수.

> **"`refresh_interval: -1` 이면 인덱싱이 안 된다"**

- ❌ 인덱싱은 됨, 검색에 보이지 않을 뿐. 끝나고 `_refresh` 한 번 호출하면 일괄 가시화. 배치 reindex 의 표준 패턴.

> **"best_compression 이 항상 좋다"**

- ⚠ 디스크는 절감되지만 CPU 비용 증가. 검색 매우 잦은 hot 인덱스는 default 가 더 빠름. 워크로드 의존.

> **"composable 은 충돌이 없다"**

- ❌ 같은 priority + 겹치는 patterns 는 명시 에러. 충돌이 사라진 게 아니라 silent merge 가 사라진 것.

> **"index template 의 inline `template` 은 component 와 동급"**

- ❌ inline 이 마지막에 병합 — component 보다 우선. 매핑은 component 에, aliases 정도만 inline 권장.

---

## 11. 회독 체크리스트

> §37 회독 체크리스트:
> - [ ] legacy `_template` vs composable `_index_template` 의 차이 (한 덩어리 vs `composed_of` 조립)
> - [ ] composable resolution 5단계 (매칭 → priority → component 병합 → inline 병합 → 인덱스 생성)
> - [ ] 같은 priority + 겹치는 patterns = ERROR (legacy 의 silent merge 와 차별점)
> - [ ] `_simulate_index` 와 `_simulate` 의 용도 차이 (effective mapping vs template dry-run)
> - [ ] component 분해 4 패턴 (mapping / settings / aliases / lifecycle 직교)
> - [ ] `index.codec` default(LZ4) vs best_compression(DEFLATE) 의 디스크/CPU trade-off + 변경 시점 (생성 시점 + force_merge)
> - [ ] `index.sort.*` 의 early termination 효과 + 4가지 제약 (생성 시점 / 인덱싱 -5~15% / score 정렬 ❌ / track_total_hits 결합)
> - [ ] `refresh_interval` 1s vs 5s vs -1 의 throughput 영향 + 배치 reindex 패턴
> - [ ] `translog.durability` request vs async — ES 가 SoR 가 아닐 때 async 안전
> - [ ] msa `IndexAliasManager` 의 inline mapping 문제 4가지 (drift / 배포 의존 / settings 부재 / 재사용 ❌)
> - [ ] component template 4 분해안 (base / search_settings / product_mapping / lifecycle)
> - [ ] index template + ILM 결합 (정책 참조만 component 로)

---

## 12. 연결 학습

- §12 cluster topology / shard sizing — `number_of_shards` 결정 근거 (이 파일은 template 에서의 설정 위치만)
- §13 인덱싱 파이프라인 / ILM — alias swap, ingest pipeline, ILM 정책 (이 파일은 template 에서 정책 참조하는 방법)
- §15 msa search grounding — `IndexAliasManager` 현황 (이 파일이 component 분해안 제시)
- §27 mapping field types — multi-field, nested, dynamic_templates (이 파일은 매핑을 component 로 패키징)
- §36 자동완성 — `name.autocomplete` (search_as_you_type) 도입을 component 로 깔끔하게
- §40 (예정) data stream + DSL — 시계열 인덱스 자동 rollover (본 파일은 가벼운 언급만)
