---
parent: 19-search-engine
seq: 13
title: 인덱싱 파이프라인 + ILM/ISM — Ingest Pipeline, Alias Swap, Hot-Warm-Cold
type: deep
created: 2026-05-03
---

# 13. 인덱싱 파이프라인 + ILM/ISM

## 1. 한 줄 핵심

> **인덱싱 = doc 가공 (ingest pipeline) + 색인 + 라이프사이클 관리.**
> Alias swap 은 무중단 reindex 의 표준, ILM/ISM 은 시계열 데이터의 hot-warm-cold 자동화.

## 2. Bulk API — 모든 인덱싱의 출발점

### 2-1. 단일 vs Bulk

```http
POST /products/_doc/1   # 단일, ~수십 ms
{...}

POST /_bulk             # 배치, ~수 ms / doc
{"index": {"_index": "products", "_id": "1"}}
{...}
{"index": {"_index": "products", "_id": "2"}}
{...}
```

→ 단일 doc 인덱싱은 **거의 항상 안티패턴** (네트워크 / 인덱싱 오버헤드 비율 ↑).

### 2-2. Bulk 사이징

| 워크로드 | 권장 batch |
|---|---|
| 작은 doc (수 KB) | 1000~5000 doc / batch |
| 큰 doc (수십 KB) | 100~500 doc / batch |
| 임베딩 포함 (1024 차원) | 100~500 doc / batch |
| 한 batch 크기 | 5~15MB |

→ 너무 크면 (>50MB) timeout / 메모리. 너무 작으면 throughput ↓.

### 2-3. Bulk 응답 처리

```json
{
  "took": 30,
  "errors": false,
  "items": [
    { "index": { "_id": "1", "result": "created", "status": 201 } },
    { "index": { "_id": "2", "result": "updated", "status": 200 } }
  ]
}
```

⚠ `errors: true` 면 일부 실패. 각 item 의 status 확인 필요. 전체 batch 가 아닌 부분 실패.

### 2-4. 멱등성 (Idempotent)

```
PUT /products/_doc/123?version=20260503001&version_type=external
{...}
```

→ 같은 doc 의 옛 version 이 도착하면 ES 가 거부 (409). out-of-order Kafka 메시지 방어.

→ msa 의 `idempotent-consumer` (ADR-0012) 와 결합.

## 3. Ingest Pipeline — 색인 전 가공

### 3-1. 개념

doc 를 ES 에 저장하기 전 일련의 processor 적용.

```http
PUT _ingest/pipeline/product_pipeline
{
  "processors": [
    { "set": { "field": "indexed_at", "value": "{{_ingest.timestamp}}" } },
    { "lowercase": { "field": "category" } },
    { "remove": { "field": "internal_field" } },
    { "script": {
        "source": "ctx.full_name = ctx.brand + ' ' + ctx.name"
    } }
  ]
}
```

### 3-2. 적용

```http
POST /products/_doc?pipeline=product_pipeline
{ "name": "갤럭시", "category": "Smartphone", "internal_field": "x" }

# 또는 인덱스 default
PUT /products/_settings
{ "default_pipeline": "product_pipeline" }
```

### 3-3. 대표 processor

| Processor | 용도 |
|---|---|
| `set` | 필드 추가 |
| `remove` | 필드 제거 |
| `rename` | 필드 이름 변경 |
| `lowercase` / `uppercase` | 대소문자 |
| `trim` | 공백 제거 |
| `split` | 문자열 분할 |
| `date` | 날짜 파싱 |
| `geoip` | IP → 지리 |
| `grok` | 정규식 (Logstash 패턴) |
| `script` | Painless 스크립트 |
| `enrich` | 다른 인덱스에서 참조 데이터 추가 |
| `inference` | ML 모델 추론 (임베딩 등) |

### 3-4. ingest 노드

대량 ingest pipeline 은 무거움 → 전용 ingest 노드 분리 가능.

### 3-5. 응용 시나리오

- 로그 → grok 으로 파싱 → 필드 분리
- IP → geoip 으로 위치 정보 추가
- 텍스트 → inference 로 임베딩 (ES 에서 자동)
- 외부 reference → enrich 으로 lookup

## 4. Alias — 무중단 운영의 핵심

### 4-1. Alias 란

- 인덱스의 별칭 (별명)
- 클라이언트는 alias 로 검색 / 인덱싱
- alias 는 atomic 하게 다른 인덱스로 swap 가능

```http
POST /_aliases
{
  "actions": [
    { "add": { "index": "products_v1", "alias": "products" } }
  ]
}

# 클라이언트
GET /products/_search   # = products_v1 검색
```

### 4-2. Alias Swap (무중단 reindex)

```
1. 새 인덱스 생성 (products_v2, 새 매핑)
2. reindex 또는 외부 인덱싱 (products_v2)
3. atomic swap:
   POST /_aliases
   {
     "actions": [
       { "remove": { "index": "products_v1", "alias": "products" } },
       { "add":    { "index": "products_v2", "alias": "products" } }
     ]
   }
4. 클라이언트는 products 그대로 사용 → 자동으로 v2
5. 검증 후 products_v1 삭제 (또는 유지)
```

→ **사용자 lag = 0**. 모든 reindex / 매핑 변경의 표준 패턴.

### 4-3. Alias 의 다른 용도

- **읽기 / 쓰기 alias 분리**: `products_read` / `products_write`
- **filter alias**: 특정 user 만 보는 view
  ```http
  POST /_aliases
  { "actions": [{
      "add": {
        "index": "products",
        "alias": "products_premium",
        "filter": { "term": { "tier": "premium" } }
      }
  }] }
  ```
- **routing alias**: 자동 routing 설정

### 4-4. Index Pattern (Wildcard)

```http
GET /products-*/  _search    # 모든 products-2026-* 인덱스 검색
```

→ 시계열 데이터에서 자주 사용. 단, alias 가 더 명시적.

## 5. Reindex API

### 5-1. 기본

```http
POST /_reindex
{
  "source": { "index": "products_v1" },
  "dest": { "index": "products_v2" }
}
```

→ doc 단위로 source 에서 dest 로 복사. ES 내부에서 처리.

### 5-2. 변환

```http
POST /_reindex
{
  "source": {
    "index": "products_v1",
    "query": { "term": { "active": true } }
  },
  "dest": { "index": "products_v2" },
  "script": {
    "source": "ctx._source.indexed_version = 'v2'"
  }
}
```

### 5-3. 비동기 / 배치

```http
POST /_reindex?wait_for_completion=false&slices=auto
```

→ 큰 reindex 는 비동기 + slicing. task API 로 진행 추적.

### 5-4. 외부 reindex

대규모 (수억 doc) 는 _reindex 가 비효율. 대안:
- Kafka 재처리 (msa 패턴) — `search:batch` 가 새 인덱스 생성 후 모든 product 이벤트 재처리
- 외부 ETL (Spark, Flink)

## 6. ILM (Index Lifecycle Management) — ES

### 6-1. 개념

인덱스의 라이프사이클 자동화. 시계열 데이터 (로그, 메트릭) 에 핵심.

### 6-2. Phase 4단계

| Phase | 목적 | 작업 |
|---|---|---|
| **hot** | 활발한 쓰기 + 검색 | rollover, forcemerge |
| **warm** | 검색만, 자원 ↓ | shrink, allocation 변경 |
| **cold** | 가끔 검색, 매우 저렴 | freeze, searchable snapshot |
| **delete** | 삭제 | delete |

### 6-3. Policy 정의

```json
PUT _ilm/policy/logs_policy
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_size": "50gb",
            "max_age": "1d"
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 },
          "allocate": { "include": { "tier": "warm" } }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "freeze": {},
          "allocate": { "include": { "tier": "cold" } }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": { "delete": {} }
      }
    }
  }
}
```

### 6-4. Rollover

```
인덱스: logs-000001 (hot)
조건 (50GB 또는 1일) 도달
→ 새 인덱스 logs-000002 자동 생성
→ alias `logs` 가 가리키는 write 대상이 v2로
→ v1 은 read-only, warm phase 시작
```

### 6-5. Searchable Snapshot

- ES 7.10+ frozen tier
- snapshot (S3) 을 직접 검색 가능 (lazy load)
- 디스크 비용 매우 ↓ (검색 latency ↑)
- 오래된 데이터 (>90일) 에 적합

## 7. ISM (Index State Management) — OpenSearch

### 7-1. 개념

ILM 의 OpenSearch 버전. 거의 동일한 기능, 설정 다름.

```json
PUT _plugins/_ism/policies/logs_policy
{
  "policy": {
    "default_state": "hot",
    "states": [
      {
        "name": "hot",
        "actions": [
          { "rollover": { "min_index_age": "1d", "min_size": "50gb" } }
        ],
        "transitions": [
          { "state_name": "warm", "conditions": { "min_index_age": "7d" } }
        ]
      },
      {
        "name": "warm",
        "actions": [
          { "force_merge": { "max_num_segments": 1 } },
          { "allocation": { "include": { "tier": "warm" } } }
        ],
        "transitions": [
          { "state_name": "cold", "conditions": { "min_index_age": "30d" } }
        ]
      }
    ]
  }
}
```

→ JSON 구조가 ILM 과 다름. 기능은 동등.

> **[OS 차이]** snapshot management (SM) plugin 도 별도 — snapshot 자동화 기능.

## 8. msa 시사점

### 8-1. search:batch — Alias Swap Reindex

`search/CLAUDE.md` 에 명시된 패턴:

```kotlin
// search:batch (가정 코드)
fun reindexAll() {
    val newIndex = "products_v${timestamp}"
    
    // 1. 새 인덱스 생성 (새 매핑)
    esClient.createIndex(newIndex, mapping = currentMapping)
    
    // 2. 인덱싱 중 refresh / replica 끔
    esClient.updateSettings(newIndex, mapOf(
        "refresh_interval" to "-1",
        "number_of_replicas" to 0
    ))
    
    // 3. product DB 전체 → 새 인덱스
    productRepo.findAll().chunked(1000).forEach { batch ->
        val bulkRequest = BulkRequest()
        batch.forEach { product ->
            bulkRequest.add(IndexRequest(newIndex)
                .id(product.id.toString())
                .source(product.toEsDoc()))
        }
        esClient.bulk(bulkRequest)
    }
    
    // 4. 인덱싱 완료 후 settings 복구
    esClient.updateSettings(newIndex, mapOf(
        "refresh_interval" to "1s",
        "number_of_replicas" to 1
    ))
    
    // 5. forcemerge (선택)
    esClient.forcemerge(newIndex, maxNumSegments = 1)
    
    // 6. Alias swap (atomic)
    esClient.updateAliases(listOf(
        RemoveAliasAction(oldIndex, "products"),
        AddAliasAction(newIndex, "products")
    ))
    
    // 7. 옛 인덱스 보관 또는 삭제 (검증 후)
}
```

→ §15 에서 실제 코드 확인.

### 8-2. 시계열 안 씀

msa 의 product / order / search 인덱스는 시계열 X → ILM/ISM 큰 의미 없음.
analytics (event 수집) 는 시계열 → ILM/ISM 적용 가치 있음.

### 8-3. ingest pipeline 활용

- 임베딩 자동 생성 (inference processor)
- 카테고리 정규화 (lowercase / mapping)
- 시간 추가 (set / timestamp)

→ 단, msa 는 application 에서 가공하는 패턴이 더 일반적 (멱등성 / 테스트 용이).

## 9. 흔한 실수 패턴

### 9-1. bulk 안 쓰고 단일 인덱싱

→ throughput 100배 차이.

### 9-2. bulk 응답의 부분 실패 무시

→ `errors: true` 인데 그냥 넘어감. 일부 doc 누락.

### 9-3. version_type=external 안 쓴 분산 인덱싱

→ out-of-order 메시지가 새 doc 덮어씀. 데이터 손상.

### 9-4. reindex 중 사용자에 옛 인덱스 노출

→ alias swap 안 쓰고 새 인덱스 직접. 검색 결과 깨짐 + 사용자 lag.

### 9-5. ILM rollover 조건 잘못

```
max_size: "1tb" (너무 큼)
→ 단일 인덱스 너무 비대 → 검색 느림
```

### 9-6. ingest pipeline 을 무거운 inference 에

→ 인덱싱 throughput 폭락. 전용 ingest 노드 또는 application 레이어로 이동.

### 9-7. force_merge 운영 인덱스에

→ IO 폭증 + 새 doc 의 small segment 가 다시 생김. read-only 인덱스만.

## 10. 자주 듣는 오해 정정

> **"_reindex API 가 외부 ETL 보다 빠르다"**

- ⚠ 단일 클러스터 내에서는 빠름. 대규모 (수억 doc) 는 외부 도구가 더 효율.

> **"alias 와 wildcard pattern 은 같다"**

- ⚠ 둘 다 multi-index 검색 가능. alias 가 명시적, wildcard 는 동적. swap 은 alias 만.

> **"ILM 은 자동이라 신경 쓸 거 없다"**

- ❌ phase 전환이 background. 에러 발생 시 멈춤. ILM API 모니터링 필수.

> **"ingest pipeline 은 가볍다"**

- ⚠ processor 따라 다름. inference / enrich 는 무거움.

> **"version_type=external 은 분산 환경에서만 필요"**

- ⚠ 사실상 모든 비동기 인덱싱 필요. Kafka consumer 면 항상.

## 11. 다음 학습

- [14-sync-outbox-cdc.md](14-sync-outbox-cdc.md) — Outbox / CDC 가 ingest pipeline 으로 흘러옴
- [15-msa-search-grounding.md](15-msa-search-grounding.md) — msa search:batch 의 alias swap 코드 분석
- [16-operations-monitoring-rto.md](16-operations-monitoring-rto.md) — reindex RTO 측정

> **§13 회독 체크리스트**:
> - [ ] bulk API 의 batch sizing 가이드
> - [ ] version_type=external 의 멱등성 보장 메커니즘
> - [ ] ingest pipeline 의 7가지 이상 processor
> - [ ] alias swap 으로 무중단 reindex 하는 5단계
> - [ ] reindex 중 `refresh_interval=-1` + `replica=0` 의 이유
> - [ ] ILM 의 4-phase (hot/warm/cold/delete) 와 각 작업
> - [ ] OpenSearch ISM 과 ILM 의 차이
