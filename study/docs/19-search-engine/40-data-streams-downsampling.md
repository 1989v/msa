---
parent: 19-search-engine
seq: 40
title: ES 시계열 — Data Streams + DSL + Downsampling + Transforms + SLM/Searchable Snapshots
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 13-indexing-pipeline-ilm.md
  - 14-sync-outbox-cdc.md
  - 16-operations-monitoring-rto.md
  - 26-aggregations-catalog.md
  - 31-ccs-ccr-snapshots.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/data-streams
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/data-stream-lifecycle
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/downsampling
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/aggregate-metric-double
  - https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/histogram
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/transforms
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/snapshot-lifecycle-management
  - https://www.elastic.co/docs/reference/elasticsearch/searchable-snapshots
  - https://www.elastic.co/docs/reference/elasticsearch/index-settings/time-series
catalog-row: "§C.data-streams + DSL / §C.downsampling / §K.SLM / §K.Transforms / §K._split·_shrink / §K.searchable-snapshots / §K.frozen-tier"
---

# 40. ES 시계열 — Data Streams + DSL + Downsampling + Transforms + SLM/Searchable Snapshots

> 카탈로그 매핑: §99 §C `data-streams` + `DSL` (★ → ✅), §C `downsampling` (★ → ✅), §K `SLM` (★ → ✅), §K `Transforms` (★ → ✅), §K `_split`/`_shrink` (★ → ✅), §K `searchable-snapshots` 보강, §C `aggregate_metric_double` / `histogram` 필드 타입 (★ → ✅).
> 학습 시간 예상: ~3h · 자가평가 입구 레벨: B+

> §13 (인덱싱 파이프라인 + ILM) 가 일반 인덱스 + ILM 기본 4-phase 를 다뤘다면, 본 §40 은 그 위의 **시계열 전용 추상** — Data Streams, 8.x DSL (Data Stream Lifecycle), Downsampling, Transforms, SLM, Searchable Snapshots, TSDS — 을 풀어 쓴다. msa 의 analytics 도메인 (ClickHouse SoR + ES 보조 검색) 관점에서 "어디까지 ES 로 가져와야 하는가" 의 의사결정 입력까지.

---

## 1. 한 줄 핵심

> **시계열 데이터는 일반 인덱스가 아니라 Data Stream 으로 — write index 자동 rollover + read index 자동 누적.**
> ILM 의 hot/warm/cold/frozen/delete 5-phase 가 무거우면 8.x 의 DSL (Data Stream Lifecycle) 로 단순화하고, 오래된 metric 은 Downsampling 으로 사전 집계해 디스크 ↓, "user 별 last 30d 합계" 같은 entity-centric view 는 Transforms 로 materialize, snapshot 보관은 SLM 자동 스케줄, 90 일 이전 데이터는 Searchable Snapshots 로 frozen tier 에 두고 검색만 가능.

---

## 2. 시계열 인덱스 — 왜 일반 인덱스가 부족한가

### 2-1. 시계열 워크로드의 특징

| 특성 | 설명 | 일반 인덱스의 한계 |
|---|---|---|
| **append-only** | 쓰기는 항상 "지금" — 과거 update 거의 없음 | 일반 인덱스도 가능하지만 segment 누적 ↑ |
| **시간 키 분포** | 90% 의 검색이 최근 1~7일 | 한 인덱스에 다 넣으면 cold data 까지 hot tier 차지 |
| **수명 (retention)** | 30일 / 90일 / 1년 후 폐기 | `_delete_by_query` 는 비싸고 segment 즉시 정리 안 됨 |
| **shard 크기 제한** | 50 GB 권장 — 무한 append 면 초과 | 수동 split / shrink 필요 |
| **스키마 안정** | 한 번 정해진 mapping 으로 수개월 — 가끔 추가 필드 | 매핑 변경 시 reindex 비용 ↑ |

### 2-2. 일반 인덱스로 해결할 때의 파이프라인

```
products-2026-04   ← 한 달치 — alias products 로 묶음
products-2026-05   ← 새 달 시작 시 수동 생성 + alias swap
products-2026-06   ← ...
```

→ 운영 부담:
- 매월 인덱스 생성 cron 필요
- alias 의 write index 분리 수동
- 오래된 인덱스 삭제 cron 필요
- shrink / forcemerge 도 수동

### 2-3. Data Stream 이 해결하는 것

```
data stream `logs-app-default`
 ├─ .ds-logs-app-default-2026.04.01-000001  (read-only)
 ├─ .ds-logs-app-default-2026.05.01-000002  (read-only)
 └─ .ds-logs-app-default-2026.05.04-000003  ← write index (auto-rollover 대상)
```

→ 클라이언트는 `logs-app-default` 한 이름만 알면 됨. ES 가:
- write index 자동 rollover
- backing index 자동 명명 (`.ds-{name}-{date}-{seq}`)
- read 시 모든 backing 자동 fan-out
- ILM/DSL 과 native 통합

**한 줄**: alias + index template + rollover + ILM 의 합성 추상이 Data Stream.

---

## 3. Data Streams — 동작 원리

### 3-1. 구성 요소 4가지

| 요소 | 역할 |
|---|---|
| **Index template** (composable) | data stream 임을 선언 + mapping/settings 자동 적용 |
| **Backing indices** | 실제 데이터 저장. `.ds-{stream}-{yyyy.MM.dd}-{seq}` 명명 |
| **Write index** | backing 중 가장 최신 — 새 doc 가 항상 여기로 |
| **Lifecycle** (DSL or ILM) | rollover / retention 정책 |

### 3-2. 생성 — 5단계

```http
# 1) Index Lifecycle 정책 (DSL or ILM 중 하나)
PUT _data_stream/_lifecycle
{
  "data_retention": "30d"
}
# (DSL — 8.x 단순)

# 2) Component template — mapping (재사용 단위)
PUT _component_template/logs-app-mappings
{
  "template": {
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "service":    { "type": "keyword" },
        "level":      { "type": "keyword" },
        "message":    { "type": "text" },
        "duration_ms":{ "type": "long" }
      }
    }
  }
}

# 3) Component template — settings
PUT _component_template/logs-app-settings
{
  "template": {
    "settings": {
      "number_of_shards":   1,
      "number_of_replicas": 1,
      "index.codec":        "best_compression"
    }
  }
}

# 4) Index template (data_stream:{} 가 핵심 마커)
PUT _index_template/logs-app-template
{
  "index_patterns": ["logs-app-*"],
  "data_stream":   { },
  "composed_of":   ["logs-app-mappings", "logs-app-settings"],
  "priority": 200,
  "template": {
    "lifecycle": {
      "data_retention": "30d"
    }
  }
}

# 5) 첫 문서 인덱싱 — data stream 자동 생성
POST logs-app-default/_doc
{
  "@timestamp": "2026-05-04T10:23:01Z",
  "service":    "product-app",
  "level":      "INFO",
  "message":    "...",
  "duration_ms": 12
}
```

→ ES 가 자동으로:
1. data stream `logs-app-default` 생성
2. 첫 backing index `.ds-logs-app-default-2026.05.04-000001` 생성
3. write index 로 지정

### 3-3. 제약

| 제약 | 이유 |
|---|---|
| `@timestamp` 필드 필수 | data stream 의 정렬 / partition 키 |
| update / delete by id 금지 | append-only — `_update_by_query` 만 가능 |
| custom routing 금지 (TSDS 전 8.6 이전) | rollover 와 충돌 |
| write index 만 쓰기 가능 | read indices 는 strict read-only |

### 3-4. Data Stream API 체크

```http
GET _data_stream/logs-app-default
# → backing indices, generation, lifecycle, ilm_policy 확인

GET _data_stream/logs-app-default/_stats
# → backing 별 doc count / size / max_timestamp

POST _data_stream/logs-app-default/_rollover
# → 수동 rollover (조건 미달이어도 강제 가능)
```

---

## 4. Rollover — 자동/수동 인덱스 전환

### 4-1. 트리거 조건

```json
{
  "rollover": {
    "max_primary_shard_size": "50gb",
    "max_age":                "1d",
    "max_docs":               100000000,
    "max_primary_shard_docs": 200000000
  }
}
```

→ **OR 조건** — 하나라도 충족되면 새 backing 생성. 권장 조합:
- `max_primary_shard_size: 50gb` (sizing 기본)
- `max_age: 30d` (긴 retention 인 stream 의 catch-up safety net)
- `max_docs` / `max_primary_shard_docs` (TSDS 에서 더 의미)

> **[ES 8.x best practice]** `max_size` (전체 인덱스) 보다 `max_primary_shard_size` 가 권장 — replica 가 size 계산에 들어가지 않아 일관됨.

### 4-2. 자동 vs 수동

| 모드 | 호출 | 용도 |
|---|---|---|
| **자동 (ILM/DSL)** | rollover action 으로 매분 체크 | 일반 운영 |
| **수동 API** | `POST {stream}/_rollover` | 매핑 변경 후 즉시 신규 backing, 부하 테스트 reset |
| **lazy rollover** (8.x) | 다음 인덱싱이 들어올 때만 실제 생성 | empty stream 의 빈 backing 폭증 방지 |

### 4-3. 백엔드 인덱스 명명 규칙

```
.ds-{data_stream_name}-{yyyy.MM.dd}-{generation:000000}

예:
.ds-logs-app-default-2026.05.04-000001
.ds-logs-app-default-2026.05.05-000002
```

- 날짜 = rollover 시점 (인덱스 생성 시각)
- generation = 1부터 단조증가, 동일 날짜에 여러 rollover 가능
- 클라이언트가 직접 이 이름을 쓸 일은 없음 — data stream alias 만 사용

### 4-4. Rollover 시 주의

- **mapping 변경**: rollover 후 새 backing 부터 적용 — 옛 backing 은 변경 X
- **forcemerge 함정**: rollover 직후 forcemerge 는 검색 부하 ↑ — warm phase 에서
- **빈 인덱스 폭증**: 새벽 트래픽 0인데 `max_age:1d` 로만 설정 → empty backing 매일 — `min_*` 조건 추가 또는 lazy rollover 권장

---

## 5. 라이프사이클 — DSL (8.x 단순) vs ILM (복잡한 5-phase)

### 5-1. 두 모델의 위치

```
Data Stream
  ├─ Lifecycle: ILM    ← 7.x 부터, 5-phase, complex
  └─ Lifecycle: DSL    ← 8.x, 단순, rollover + retention 만
```

→ **둘 중 하나만 적용** (mutually exclusive). 같은 stream 에 둘 다 붙이면 priority 로 ILM 이 이김.

### 5-2. DSL — 8.x 단순 모델

```http
PUT _index_template/logs-app-template
{
  "index_patterns": ["logs-app-*"],
  "data_stream": { },
  "template": {
    "lifecycle": {
      "data_retention": "30d",
      "downsampling": [
        { "after": "7d",  "fixed_interval": "1m" },
        { "after": "30d", "fixed_interval": "1h" }
      ]
    }
  }
}
```

→ DSL 이 표현하는 것은 단 두 가지:
1. **data_retention** — N 일 후 backing index 삭제
2. **downsampling** — N 일 후 metric 사전 집계 (§6)

DSL 이 표현 못하는 것:
- shrink / forcemerge / freeze / searchable snapshot — 모두 ILM 에서만

### 5-3. ILM — 5-phase 복잡 모델

```json
PUT _ilm/policy/logs-app-policy
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_primary_shard_size": "50gb",
            "max_age": "1d"
          },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink":     { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 },
          "allocate":   { "include": { "data": "warm" } },
          "set_priority": { "priority": 50 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "searchable_snapshot": { "snapshot_repository": "s3-backups" },
          "set_priority": { "priority": 0 }
        }
      },
      "frozen": {
        "min_age": "90d",
        "actions": {
          "searchable_snapshot": { "snapshot_repository": "s3-backups" }
        }
      },
      "delete": {
        "min_age": "365d",
        "actions": { "delete": {} }
      }
    }
  }
}
```

### 5-4. DSL vs ILM — 비교표

| 기준 | DSL (8.x) | ILM |
|---|---|---|
| 적용 대상 | Data Stream 전용 | 일반 index + Data Stream |
| Phase 수 | 0 (flat) | 5 (hot/warm/cold/frozen/delete) |
| Action 다양성 | rollover + retention + downsampling | shrink, forcemerge, freeze, searchable snapshot, allocate, set_priority, ... |
| 운영 복잡도 | 낮음 (선언 1개) | 높음 (phase 별 min_age + actions) |
| Tier 이동 | X (single tier) | 가능 (allocate.include) |
| Searchable Snapshot | X | O (cold/frozen) |
| 학습 곡선 | 분 단위 | 시간 단위 |
| 적용 시점 | 단순 retention 만 필요한 신규 워크로드 | tier 이동 / DR / 장기 보존 필요 |

**한 줄**: 단순한 30~90 일 retention 만 → DSL. tier 분리 + Searchable Snapshot + 1년 이상 보존 → ILM.

### 5-5. 마이그레이션 — ILM → DSL 또는 그 반대

```http
# ILM 제거하고 DSL 로
PUT _index_template/logs-app-template
{
  "index_patterns": ["logs-app-*"],
  "data_stream": { },
  "template": {
    "settings": { "index.lifecycle.name": null },
    "lifecycle": { "data_retention": "30d" }
  }
}
```

→ 이미 backing index 에 ILM 이 붙어 있다면 `POST {index}/_ilm/remove` 로 detach 후.

---

## 6. Downsampling — 시계열 압축 + pre-aggregation

### 6-1. 문제: 1초 metric 을 1년 보관

```
node_cpu_usage 가 1초마다 1 doc — 노드 100개 × 86400초/day × 365day
= 31억 doc / 년 / metric
```

→ 평면 저장은 비현실적. 오래된 데이터는 "초 단위" 의미가 없음 — "1 시간 평균/p99" 면 충분.

### 6-2. Downsampling 의 동작

```
원본 (raw 1초 interval):
 t=10:00:00, cpu=42
 t=10:00:01, cpu=43
 t=10:00:02, cpu=41
 ... (60 doc/min)

downsampled (1m interval):
 t=10:00:00, cpu={ min:38, max:51, sum:2580, value_count:60 }
                  ↑ aggregate_metric_double 필드 타입
```

→ doc 수 60배 ↓, mapping 은 `aggregate_metric_double` 로 변환. 검색 시 `avg(cpu)` aggregation 이 자동으로 sum/count 사용.

### 6-3. DSL 에서 트리거

```json
{
  "lifecycle": {
    "data_retention": "365d",
    "downsampling": [
      { "after": "1d",  "fixed_interval": "1m"  },  // 1일 후 → 1분 단위
      { "after": "7d",  "fixed_interval": "5m"  },
      { "after": "30d", "fixed_interval": "1h"  },
      { "after": "90d", "fixed_interval": "1d"  }
    ]
  }
}
```

→ rollover + age 도달 시 ES 가 backing index 를 새 downsampled index 로 교체. 원본 삭제.

### 6-4. ILM 에서 트리거

```json
{
  "warm": {
    "min_age": "7d",
    "actions": {
      "downsample": { "fixed_interval": "1h" }
    }
  }
}
```

### 6-5. `aggregate_metric_double` 필드 타입

```http
PUT metrics-cpu/_mapping
{
  "properties": {
    "cpu_usage": {
      "type": "aggregate_metric_double",
      "metrics": ["min", "max", "sum", "value_count"],
      "default_metric": "max"
    }
  }
}
```

- 한 필드에 여러 사전계산 metric 저장
- aggregation 시 자동 사용 (`avg` 는 `sum/value_count`, `min`/`max` 는 직접)
- `default_metric` 은 sort / single value 가 필요한 곳에서 사용

### 6-6. `histogram` 필드 타입

분포 자체를 사전 집계.

```http
PUT latencies/_mapping
{
  "properties": {
    "request_latency": {
      "type": "histogram"
    }
  }
}

POST latencies/_doc
{
  "@timestamp": "2026-05-04T10:00:00Z",
  "request_latency": {
    "values":  [ 1, 5, 10, 50, 100, 500, 1000 ],
    "counts":  [50, 30, 20, 10,   5,   2,    1]
  }
}
```

→ `percentiles` aggregation 이 사전계산 분포로 즉시 계산. T-Digest / HDR 의 응용.

### 6-7. Downsampling 의 트레이드오프

| 장점 | 단점 |
|---|---|
| 디스크 60~3600배 ↓ | raw 손실 — 5분 spike 추적 X |
| aggregation latency ↓ | 매핑 한 번 결정하면 metric 추가 어려움 |
| retention 길게 가능 | TSDS / data stream 만 지원 (8.5+) |
| `aggregate_metric_double` 자동 활용 | interval 잘못 정하면 무의미 |

**핵심**: interval 은 워크로드의 **유효 분석 단위** 와 같아야. 7일 이내는 1초, 30일 이내는 1분, 90일 이내는 5분 — 비즈니스 요구로 결정.

---

## 7. Transforms — entity-centric pivot (continuous / batch)

### 7-1. 문제: 시계열의 "현재 상태"

```
events stream:
 user=u1, action=view,     t=10:00
 user=u1, action=cart,     t=10:05
 user=u1, action=purchase, t=10:10
 user=u2, action=view,     t=10:15
 ...
```

→ "각 user 의 마지막 30일 view 수 / cart 수 / purchase 합계" 를 매번 aggregation 하면 비싸다. 미리 만들어 두자.

### 7-2. Transform 의 동작

```http
PUT _transform/user-30d-summary
{
  "source": {
    "index": "events-*"
  },
  "dest": {
    "index": "user-30d-summary"
  },
  "pivot": {
    "group_by": {
      "user_id": { "terms": { "field": "user_id" } }
    },
    "aggregations": {
      "view_count":     { "value_count": { "field": "action" } },
      "purchase_total": { "sum": { "field": "amount" } },
      "last_seen":      { "max": { "field": "@timestamp" } }
    }
  },
  "sync": {
    "time": {
      "field": "@timestamp",
      "delay": "60s"
    }
  },
  "frequency": "1m",
  "retention_policy": {
    "time": { "field": "last_seen", "max_age": "30d" }
  }
}

POST _transform/user-30d-summary/_start
```

→ ES 가 1분마다 source 에서 last 60s 새 doc 만 읽어 dest index 의 user 별 doc 를 update. **continuous transform**.

### 7-3. continuous vs batch

| 모드 | 동작 | 용도 |
|---|---|---|
| **continuous** | sync.time + frequency 로 incremental | 운영 대시보드, 실시간 entity view |
| **batch** | 한 번 실행 후 종료 | 일회성 reindex + 변환 (대안: `_reindex` + script) |

### 7-4. Transform vs Aggregation — 사용 시점

| 시나리오 | 답 |
|---|---|
| 한 번 보고 끝 | aggregation |
| 대시보드 매분 갱신, 같은 query | transform (materialized) |
| 대상 doc 수 매우 많음 (수억) | transform (cardinality 제한 회피) |
| 실시간 < 1분 latency | aggregation (transform 은 frequency 만큼 lag) |
| 결과 doc 가 다른 검색의 source | transform (인덱싱되어 검색 가능) |

### 7-5. Transform 의 함정

- **frequency 너무 짧음** → cluster 부하 ↑. 최소 1분 권장
- **delay 너무 짧음** → late event 누락. 60s 이상 권장
- **retention_policy 미설정** → dest index 무한 증가
- **group_by cardinality 폭발** → user_id × product_id 등 multi-key 시 결과 doc 수 = 곱. composite agg 의 한계와 같음

### 7-6. msa 적용 후보

```
analytics events (Kafka → ClickHouse SoR)
  → ES 에 events-* data stream 으로도 색인 (검색용)
    → transform: user-30d-summary (entity-centric)
      → 검색 API: "30일간 가장 활동적인 user top-100"
```

→ ClickHouse 가 OLAP / SoR 면 transform 은 검색 보조용. SoR 와의 정합성은 transform 의 lag (delay + frequency) 만큼 허용.

---

## 8. SLM (Snapshot Lifecycle Management) + Searchable Snapshots

### 8-1. SLM — snapshot 자동 스케줄

```http
# 1) Snapshot repository 등록 (S3)
PUT _snapshot/s3-backups
{
  "type": "s3",
  "settings": {
    "bucket": "es-backups-prod",
    "region": "ap-northeast-2",
    "base_path": "elasticsearch"
  }
}

# 2) SLM policy
PUT _slm/policy/daily-backup
{
  "schedule": "0 30 1 * * ?",                  // 매일 01:30
  "name": "<daily-snap-{now/d}>",
  "repository": "s3-backups",
  "config": {
    "indices": ["logs-*", "metrics-*"],
    "include_global_state": false
  },
  "retention": {
    "expire_after": "30d",
    "min_count":    7,
    "max_count":    30
  }
}

# 3) 즉시 한 번 실행
POST _slm/policy/daily-backup/_execute
```

→ retention 의 3 키:
- `expire_after`: 30일 지나면 삭제
- `min_count`: 최소 7개는 보관 (실수로 다 지우지 않게)
- `max_count`: 최대 30개 — 디스크 폭증 방지

### 8-2. Searchable Snapshots

```http
POST {index}/_searchable_snapshots/mount?master_timeout=30s
{
  "repository": "s3-backups",
  "snapshot":   "daily-snap-2026.04.05",
  "index":      "logs-app-2026.04",
  "renamed_index": "logs-app-2026.04-frozen",
  "index_settings": {
    "index.routing.allocation.include._tier_preference": "data_frozen"
  }
}
```

→ snapshot 파일을 직접 마운트해 검색만 가능. 디스크에 데이터 X (lazy 로 일부 캐시).

| 비교 | 일반 인덱스 | Searchable Snapshot |
|---|---|---|
| 디스크 | 100% | 0~10% (cache) |
| 검색 latency | ms | 수백 ms~s |
| 인덱싱 | 가능 | X (read-only) |
| 비용 | EBS 가격 | S3 가격 (10~20배 ↓) |
| 적합 | hot/warm | cold/frozen |

### 8-3. Frozen tier — partially mounted

- `data_frozen` role 노드에 mount
- LRU 캐시 (디스크 일부) — 핫셋만 캐시
- 1년 이상 보존 데이터에 적합 (검색 빈도 매우 ↓)

### 8-4. ILM 안에서 자동화

```json
"frozen": {
  "min_age": "90d",
  "actions": {
    "searchable_snapshot": { "snapshot_repository": "s3-backups" }
  }
}
```

→ ILM 이 자동으로:
1. 90일된 backing index 의 snapshot 생성
2. 원본 index 삭제
3. snapshot 을 frozen tier 로 mount
4. data stream 이 계속 검색 가능 (단, 느려짐)

→ §31 (CCS/CCR/Snapshot) 와 cross-ref.

---

## 9. TSDS (Time-Series Data Stream) — 8.7+ metric 전용

### 9-1. 동기

일반 data stream 도 시계열에 쓰지만, **metric 전용** 워크로드에는 더 강한 최적화가 가능. `index.mode: "time_series"` 를 켜면 활성화.

### 9-2. TSDS 의 추가 최적화

| 최적화 | 효과 |
|---|---|
| **dimension** 필드 (keyword) | "노드 + 메트릭 이름" 같은 고유 시계열 키 |
| **`_tsid`** 자동 계산 | 모든 dimension 의 결정적 hash → 같은 시계열은 같은 shard / 인접 doc |
| **시간 + dimension 정렬** | segment 내부 정렬 → 압축률 ↑↑ (LZ4 보다 ZSTD 와 결합 시 30~50% ↓) |
| **`time_series_metric` 필드 속성** | `gauge` / `counter` / `histogram` 명시 — 미래 최적화 hook |
| **자동 latency window** | 미래 timestamp 거부 — out-of-order 보호 |

### 9-3. 매핑 예

```http
PUT _index_template/k8s-metrics-template
{
  "index_patterns": ["k8s-metrics-*"],
  "data_stream": { },
  "template": {
    "settings": {
      "index.mode": "time_series",
      "index.routing_path": ["pod.name", "metric_name"]
    },
    "mappings": {
      "properties": {
        "@timestamp":  { "type": "date" },
        "pod": {
          "properties": {
            "name": { "type": "keyword", "time_series_dimension": true }
          }
        },
        "metric_name": { "type": "keyword", "time_series_dimension": true },
        "value":       { "type": "double",  "time_series_metric": "gauge" }
      }
    }
  }
}
```

→ `routing_path` 의 dimension 으로 같은 시계열 doc 가 같은 shard 에 인접 저장. 압축 + scan 효율 ↑.

### 9-4. 일반 Data Stream vs TSDS

| 기준 | Data Stream | TSDS |
|---|---|---|
| 적용 대상 | 로그, 일반 시계열 | metric (Prometheus 류) 전용 |
| `_tsid` | X | O |
| dimension 명시 | X | O |
| 압축 | LZ4 / ZSTD | ZSTD + sort 결합 → 더 ↓ |
| 미래 timestamp | 허용 | 거부 (look_ahead_time 내) |
| Downsampling | O | O (기본 워크로드) |
| 도입 시점 | 로그 / event | Prometheus remote_write 대안 |

→ msa 의 analytics 가 metric 도 받으면 TSDS 후보. event 만 받으면 일반 data stream.

---

## 10. 비교표 — 헷갈리는 셋

### 10-1. Data Streams vs Index Aliases

| 기준 | Data Stream | Index Alias |
|---|---|---|
| 의도 | 시계열 / append-only | 무중단 reindex / 다중 view |
| Write 대상 | 자동 (write index) | 수동 지정 (`is_write_index: true`) |
| 매핑 | 단일 (template) | 인덱스마다 다를 수 있음 |
| Update / Delete by id | X | O |
| Custom routing | TSDS 만 | O |
| Backing index 명명 | 자동 (`.ds-*`) | 직접 정의 |
| ILM/DSL | 자연스럽게 통합 | 수동으로 인덱스에 ILM 부여 |
| 사용 시점 | 시계열 (logs/metrics/events) | 비-시계열 reindex / view alias |

### 10-2. DSL vs ILM

| 기준 | DSL | ILM |
|---|---|---|
| Phase | flat | 5-phase |
| Action | rollover, retention, downsampling | + shrink, forcemerge, freeze, searchable snapshot, allocate, set_priority |
| Tier 이동 | X | O |
| 적용 대상 | data stream 만 | data stream + 일반 index |
| 학습 시간 | 분 | 시간 |
| 운영 시점 | 단순 retention 만 필요 | tier 분리 + DR + 장기 보존 |

### 10-3. Rollover vs `_split` vs `_shrink` vs `_clone`

| API | shard 수 변화 | 적용 시점 | 인덱스 이름 |
|---|---|---|---|
| **rollover** | 새 인덱스 (shard 수 변경 X 또는 새로) | data stream / alias 의 자동 분할 | 새 이름 또는 `-{seq+1}` |
| **`_split`** | N → M*N (배수만) | hot phase 후 트래픽 폭증 | 새 이름 |
| **`_shrink`** | N → divisor of N | warm phase, 검색만 — shard 수 ↓ | 새 이름 |
| **`_clone`** | N → N (동일) | snapshot 직전 freeze | 새 이름 |

→ rollover 는 시간 축 분할, split/shrink 는 공간 축 변경.

```http
# split — primary shard 수 증가
POST source-index/_split/target-index
{ "settings": { "index.number_of_shards": 6 } }

# shrink — primary shard 수 감소 (먼저 read-only + allocate to single node)
POST source-index/_shrink/target-index
{ "settings": { "index.number_of_shards": 1, "index.codec": "best_compression" } }
```

> **[제약]** `_split`: 원본 = 1 shard 면 모든 배수 가능, > 1 이면 (N×k) 만. `_shrink`: 모든 primary shard 가 한 노드에 + 인덱스 read-only + N 의 약수만.

---

## 11. 안티패턴 — 본 절 핵심

### 11-1. Downsampling interval 잘못

```
요구: "30일 이내 5분 spike 추적 + 1년 보관"
잘못: after=1d → 1h interval downsample
     → 5분 spike 추적 불가능 (1일 만에 사라짐)
정답: after=30d → 5m, after=90d → 1h, after=365d → 1d
```

→ interval 은 **추적 단위 ≤ 보존 정책 단위**.

### 11-2. ILM 너무 복잡

```
hot (1d) → warm (3d, shrink+forcemerge+allocate)
       → cold (7d, searchable_snapshot+allocate)
       → frozen (30d, searchable_snapshot)
       → delete (90d)
```

→ 매 단계 transition 마다 backing index 가 처리됨. 작은 워크로드 (수 GB) 에는 운영 오버헤드 > 비용 절감. **30일 retention 만 필요하면 DSL 쓰기**.

### 11-3. Snapshot 보관 정책 부재

```
SLM: schedule="0 0 * * *", expire_after 미설정
→ 매일 snapshot 누적 → 1년에 365개 → S3 폭증
```

→ `expire_after`, `min_count`, `max_count` 셋 다 명시.

### 11-4. data stream 에 update by id

```http
POST logs-app-default/_update/abc-123  # ❌ data stream 거부
{ "doc": { "level": "ERROR" } }
```

→ append-only 원칙. 수정이 필요하면:
- `_update_by_query` (드물게)
- 새 doc 인덱싱 + `@timestamp` 새로
- 잘못된 워크로드 — 일반 인덱스로 변경

### 11-5. Transform frequency 너무 짧음

```json
"frequency": "10s"   // ❌ cluster 부하
```

→ 최소 1m 권장. 진짜 < 1m 필요하면 transform 이 아니라 stream 처리 (Kafka Streams / Flink).

### 11-6. Searchable Snapshot 을 hot tier 에

```
ILM: hot phase 에 searchable_snapshot
→ 자주 검색되는 데이터를 S3 lazy fetch → latency 폭증
```

→ Searchable Snapshot 은 **cold/frozen 만**. 90일 이상 retention.

### 11-7. TSDS 를 일반 로그에

```
로그 (text 비중 ↑, dimension 없음) 에 TSDS
→ routing_path 부재 → 모든 dimension 강제 → 매핑 거부
```

→ TSDS 는 metric 전용. 로그는 일반 data stream + DSL/ILM.

### 11-8. backing index 를 직접 쓰기

```
PUT .ds-logs-app-default-2026.05.04-000001/_doc  # ❌
```

→ data stream 이름만 사용. backing 직접 쓰기는 read-only 위반.

---

## 12. msa 적용 — analytics 의 시계열 워크로드

### 12-1. 현재 상태 (ADR-0017)

```
analytics:
  Kafka topic `analytics.event.collected`
    ↓ Kafka Streams
  ClickHouse (OLAP, SoR)
    ↓ Score 산출 + ES 인덱싱?  ← 미정 / 보조
  Redis (score TTL 2h)
```

- **SoR**: ClickHouse — 시계열 OLAP 의 본진
- **검색 보조**: ES 가 들어올 자리는?

### 12-2. ES 가 가져갈 / 안 가져갈 책임

| 책임 | SoR | 보조 |
|---|---|---|
| **시계열 raw 저장** | ClickHouse | (ES 안 함) |
| **분 / 시간 단위 집계** | ClickHouse `materialized view` | ES `transform` (선택) |
| **풀텍스트 검색 (event metadata)** | (ClickHouse 약함) | **ES** |
| **임의 차원 ad-hoc aggregation** | ClickHouse | ES (작은 부분집합) |
| **장기 보존 (1년+)** | ClickHouse + S3 export | ES Searchable Snapshot |
| **score 조회 / write** | (분리) | Redis + DB |

→ **결론**: ES 는 "**event metadata 풀텍스트 검색 + entity-centric pivot view**" 에 한정. raw OLAP 는 ClickHouse.

### 12-3. 제안 데이터 흐름

```
analytics.event.collected (Kafka)
  ├─ ClickHouse (SoR — 시계열 OLAP)
  └─ ES `events-app-*` data stream
       ├─ DSL: data_retention=30d
       ├─ Downsampling: after=7d → 1m, after=30d → 1h
       └─ Transform: user-30d-summary (continuous)
            ↓
        검색 API: "최근 30일 활동 user top-100", "campaign X 클릭한 user"
```

### 12-4. 매핑 초안

```http
PUT _component_template/events-app-mappings
{
  "template": {
    "mappings": {
      "properties": {
        "@timestamp":  { "type": "date" },
        "event_type":  { "type": "keyword" },
        "user_id":     { "type": "keyword" },
        "product_id":  { "type": "keyword" },
        "campaign_id": { "type": "keyword" },
        "duration_ms": { "type": "long" },
        "amount":      { "type": "double" },
        "metadata":    { "type": "object", "enabled": false }
      }
    }
  }
}

PUT _index_template/events-app-template
{
  "index_patterns": ["events-app-*"],
  "data_stream":   { },
  "composed_of":   ["events-app-mappings", "events-app-settings"],
  "priority": 200,
  "template": {
    "lifecycle": {
      "data_retention": "30d"
    }
  }
}
```

→ 1단계는 DSL (단순). tier 분리 / 1년 보존 요구가 생기면 ILM 으로 승격.

### 12-5. Transform 으로 user 활동 view

```http
PUT _transform/user-30d-activity
{
  "source": {
    "index": "events-app-*",
    "query": { "range": { "@timestamp": { "gte": "now-30d/d" } } }
  },
  "dest":   { "index": "user-30d-activity" },
  "pivot": {
    "group_by": {
      "user_id": { "terms": { "field": "user_id" } }
    },
    "aggregations": {
      "view_count":     { "filter": { "term": { "event_type": "view" } } },
      "purchase_count": { "filter": { "term": { "event_type": "purchase" } } },
      "purchase_total": { "sum": { "field": "amount" } },
      "last_seen":      { "max": { "field": "@timestamp" } }
    }
  },
  "sync": { "time": { "field": "@timestamp", "delay": "120s" } },
  "frequency": "5m",
  "retention_policy": {
    "time": { "field": "last_seen", "max_age": "30d" }
  }
}
```

→ frequency 5m / delay 120s 는 cluster 부하 + late event 균형. ClickHouse 의 score 와 정합성은 5m lag 까지 허용.

### 12-6. msa 의 일반 인덱스 (product/order/search) 와의 차이

- product / order / search 인덱스는 **시계열 X** — alias swap reindex (§13) 표준.
- analytics 만 시계열 — data stream + DSL.
- **혼동 금지**: "search 인덱스도 data stream 으로?" → ❌. 검색은 update/delete 가 잦고 점진적 매핑 변경이 많아 alias swap 이 더 적합.

---

## 13. ADR 후보 — analytics 검색 인덱스의 data stream 도입

### 13-1. 후보 ADR 제목

`ADR-XXXX: analytics 검색 보조 인덱스를 ES Data Stream + DSL 로 도입`

### 13-2. Context

- analytics 의 SoR 는 ClickHouse (ADR-0017)
- 검색 / ad-hoc 풀텍스트 / entity-centric view 는 ClickHouse 가 약함
- 현재 ES 보조 색인은 미정

### 13-3. Decision

- ES 에 `events-app-default` data stream 신설
- DSL: retention 30일, downsampling 7일/30일 cutoff
- Transform: `user-30d-activity` continuous (frequency=5m)
- ILM 미도입 (단순성 우선) — tier 분리 요구 생기면 재평가

### 13-4. Consequences

| 측면 | 영향 |
|---|---|
| 디스크 | ClickHouse 풀백업 + ES 30일 (요약본) — 3배 미만 추가 |
| 일관성 | ES lag = transform frequency + delay = 5~7분 |
| 운영 | DSL 단순 — index template 1개 + transform 1개 |
| 비용 | S3 snapshot 추가 시 SLM 자동화 |

### 13-5. Alternatives

- (a) 모든 검색을 ClickHouse `LIKE` / `tokenbf_v1` index 로 — 형태소 한계
- (b) ES 에 일반 인덱스 + alias swap — 매월 cron 운영
- (c) **ES Data Stream + DSL** ← 채택

### 13-6. 다음 단계

1. analytics/CLAUDE.md 에 ES 인덱싱 책임 명시
2. `events-app-template` PR
3. transform `user-30d-activity` 운영
4. `/study:gc` 로 ClickHouse 정합성 측정 (lag, doc count drift)

→ `study/docs/00-ADR-CANDIDATES.md` 에 등록 후보.

---

## 14. 면접 한 줄 답변

### Q1. Data Stream 과 Index Alias 의 차이?

> "Data Stream 은 시계열 append-only 추상으로 write index + read indices 를 ES 가 자동 관리하고 ILM/DSL 과 native 통합됩니다. Alias 는 매핑이 다를 수 있는 임의 인덱스의 view 추상이고 swap 으로 무중단 reindex 에 쓰입니다. 시계열은 Data Stream, 비-시계열 reindex 는 alias 라는 결정 규칙이 있습니다."

### Q2. DSL 과 ILM 중 무엇을 쓰나요?

> "DSL 은 8.x 의 단순 모델로 retention + rollover + downsampling 셋만, ILM 은 hot/warm/cold/frozen/delete 5-phase 에 shrink/forcemerge/freeze/searchable snapshot 같은 action 을 제공합니다. 30~90일 단순 retention 만 필요하면 DSL, tier 분리나 1년 이상 보존이면 ILM. msa 의 analytics 는 1단계 DSL, 검색 패턴이 정착하면 ILM 으로 승격이 합리적입니다."

### Q3. Downsampling 은 무엇이며 언제 쓰나요?

> "시계열 metric 을 더 큰 interval (1초 → 1분 → 1시간) 로 사전 집계해 doc 수와 디스크를 60~3600 배 줄이는 ES 8.5+ 기능입니다. `aggregate_metric_double` 필드 타입으로 min/max/sum/value_count 를 한 doc 에 저장하고, aggregation 시 자동 활용됩니다. interval 선택은 추적 단위 ≤ 보존 정책 단위 원칙으로 정합니다."

### Q4. Transform 과 일반 aggregation 의 차이?

> "Aggregation 은 매 query 마다 계산, Transform 은 결과 doc 를 별도 인덱스에 materialize 합니다. 같은 query 가 반복되거나 결과가 다른 검색의 source 가 되면 Transform, 일회성 분석은 aggregation. continuous transform 은 frequency + delay 만큼 lag 이 생기므로 실시간 < 1분 SLA 면 stream 처리로 가야 합니다."

### Q5. SLM 과 Searchable Snapshot 의 관계?

> "SLM 은 snapshot 자동 스케줄 + 보관 정책 (expire_after / min_count / max_count) 을 관리합니다. Searchable Snapshot 은 그 snapshot 을 직접 마운트해 검색 가능한 형태로 노출하고, ILM 의 cold/frozen phase 에서 자동으로 적용됩니다. 둘이 묶이면 90일 이전 데이터를 S3 가격으로 보관 + 가끔 검색이 가능합니다."

### Q6. TSDS 와 일반 Data Stream 의 차이?

> "TSDS 는 8.7+ 의 metric 전용 최적화로 dimension 필드와 `_tsid` 자동 hash 로 같은 시계열 doc 를 같은 shard 에 인접 저장하고 ZSTD 압축과 결합해 크기를 30~50% 더 줄입니다. routing_path 강제와 미래 timestamp 거부가 추가됩니다. Prometheus remote_write 대안 또는 metric SoR 후보일 때 TSDS, 로그/event 는 일반 data stream 입니다."

### Q7. msa 의 analytics 에 ES Data Stream 을 도입한다면?

> "ClickHouse 가 시계열 OLAP SoR 이므로 ES 는 풀텍스트 검색과 entity-centric pivot view 에 한정합니다. `events-app-default` data stream 을 신설해 DSL retention 30일 + downsampling 7d/30d cutoff, Transform `user-30d-activity` 를 frequency 5분으로 운영합니다. lag 는 5~7분으로 ClickHouse score 와의 정합성은 그 범위 내에서 허용합니다."

### Q8. data stream 에 update by id 가 안 되는데 수정이 필요하면?

> "기본은 append-only 가 맞아 새 doc 를 새 timestamp 로 인덱싱합니다. 정정이 꼭 필요하면 `_update_by_query` 가 가능하지만 비용이 큽니다. update 빈도가 잦다면 워크로드가 시계열이 아닌 신호 — 일반 인덱스 + alias 패턴으로 다시 봐야 합니다."

---

## 15. 회독 체크리스트

> §40 회독 체크리스트:
> - [ ] Data Stream 의 4 구성요소 (index template / backing / write index / lifecycle)
> - [ ] backing index 명명 규칙 `.ds-{stream}-{yyyy.MM.dd}-{generation}`
> - [ ] DSL vs ILM 의 표현력 차이 (action 종류, tier, searchable snapshot)
> - [ ] Downsampling 의 `aggregate_metric_double` / `histogram` 필드 타입
> - [ ] Downsampling interval 선택 원칙 (추적 단위 ≤ 보존 정책 단위)
> - [ ] Transform continuous vs batch + frequency / delay 의 의미
> - [ ] SLM 의 retention 3 키 (`expire_after` / `min_count` / `max_count`)
> - [ ] Searchable Snapshot 의 hot/warm 사용이 안티패턴인 이유
> - [ ] TSDS 의 `_tsid` + `routing_path` + `time_series_dimension`
> - [ ] Rollover vs `_split` vs `_shrink` vs `_clone` 의 적용 시점
> - [ ] msa analytics 에서 ClickHouse SoR 와 ES 책임 분리 (ES 는 검색 + entity view 만)
> - [ ] data stream 의 안티패턴 7가지 (update by id, frequency 짧음, snapshot 보관 정책 부재 ...)

---

## 16. 연결 학습

- §13 — 인덱싱 파이프라인 + ILM 기본 (이 파일이 8.x DSL / Data Stream / Downsampling 으로 보강)
- §14 — Outbox / CDC 가 data stream 의 source 가 될 수 있음
- §16 — Searchable Snapshot 의 RTO 측정과 frozen tier 운영 모니터링
- §26 — aggregation catalog (Transform 의 pivot 이 같은 표현 사용)
- §31 — CCS / CCR / Snapshot 과 Searchable Snapshot 의 관계
- ADR-0017 — analytics 스코어링 시스템 (본 절의 ES 도입 후보가 보강)
- §99 §C / §K — data-streams / DSL / downsampling / SLM / transforms / split-shrink 카탈로그 entry
