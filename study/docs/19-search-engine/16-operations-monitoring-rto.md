---
parent: 19-search-engine
seq: 16
title: 운영 — Cluster Health, Hot Threads, Slow Log, Snapshot, 재색인 RTO 측정
type: deep
created: 2026-05-03
---

# 16. 운영 — 모니터링 + RTO

> 묶음 3 (B) 시니어 의사결정. "ES (Elasticsearch) 가 갑자기 느려졌다" / "노드 죽었다" / "데이터 사라졌다" 의 진단 / 복구 절차.

## 1. 한 줄 핵심

> **운영의 핵심 = 4축 모니터링 (cluster health / latency / saturation / errors) + 정기 RTO (Recovery Time Objective, 복구 시간 목표) 훈련 + snapshot 자동화.**
> SoR (System of Record, 원본 데이터 시스템) (RDB (Relational Database, 관계형 데이터베이스)) 가 아닌 ES 의 RTO = "재색인 시간". 이 숫자를 모르면 운영 안전망 없음.

## 2. Cluster Health — 첫 번째 신호

### 2-1. Health API

```http
GET /_cluster/health

{
  "cluster_name": "commerce",
  "status": "green",
  "number_of_nodes": 3,
  "number_of_data_nodes": 3,
  "active_primary_shards": 14,
  "active_shards": 28,
  "relocating_shards": 0,
  "initializing_shards": 0,
  "unassigned_shards": 0,
  "pending_tasks": 0,
  "active_shards_percent_as_number": 100.0
}
```

### 2-2. 색상 의미 (다시)

- **green** — 모든 primary + replica OK
- **yellow** — primary OK, replica 일부 미할당 → 데이터 손실 위험 ↑ (가용성 ↓)
- **red** — primary 일부 미할당 → 검색 / 인덱싱 일부 불가

### 2-3. 모니터링 알람 정책

| 상태 | Alert |
|---|---|
| yellow > 5분 | warning |
| red | critical |
| pending_tasks > 100 | warning |
| pending_tasks > 1000 | critical |
| relocating_shards > 0 ongoing | info (정상 운영 중) |
| disk 85% | warning |
| disk 90% | critical |

## 3. Hot Threads — 성능 병목

### 3-1. API

```http
GET /_nodes/hot_threads?threads=3&interval=500ms
```

### 3-2. 응답 해석

```
::: {node-1}{...}
   Hot threads at 2026-05-03T10:30:00.000Z
   
   89.5% (447ms out of 500ms) cpu usage by thread 'elasticsearch[node-1][search][T#5]'
     10/10 snapshots sharing following 30 elements
        java.base@17/...
        org.apache.lucene.search.IndexSearcher.search(...)
        ...
```

→ "어떤 작업이 CPU 잡아먹는지" 식별. 가장 흔한 패턴:
- `search` 스레드 → 무거운 query (스크립트, wildcard)
- `bulk` / `index` 스레드 → 인덱싱 폭주
- `merge` 스레드 → segment merge 진행 중
- `refresh` 스레드 → refresh 너무 잦음

### 3-3. 활용 시점

- search latency spike → hot_threads 즉시
- CPU 사용률 90%+ → hot_threads
- 노드별 부하 imbalance → 노드별 hot_threads 비교

## 4. Slow Log — 느린 쿼리 추적

### 4-1. 설정

```http
PUT /products/_settings
{
  "index.search.slowlog.threshold.query.warn": "10s",
  "index.search.slowlog.threshold.query.info": "5s",
  "index.search.slowlog.threshold.query.debug": "2s",
  "index.search.slowlog.threshold.query.trace": "500ms",
  "index.search.slowlog.threshold.fetch.warn": "1s",
  "index.indexing.slowlog.threshold.index.warn": "10s"
}
```

### 4-2. 로그 위치

기본: `$ES_HOME/logs/<cluster>_index_search_slowlog.json`

K8s 환경: stdout / log forwarder (Loki, ELK) 로 수집.

### 4-3. 분석

slow log 의 query body 를 추출 → `_validate/query` 또는 `profile: true` 로 재실행하여 원인 분석.

## 5. 핵심 메트릭 (4-Golden Signals 적용)

### 5-1. Latency

- search latency (P50, P95, P99)
- indexing latency (P50, P95, P99)
- per-shard latency (skewed shard 식별)

### 5-2. Traffic

- search rate (QPS)
- indexing rate (docs/sec)
- bulk rate (bulk/sec)

### 5-3. Errors

- search errors (rate, type)
- bulk failed items
- Kafka consumer lag (msa 의 search-indexer)

### 5-4. Saturation

- CPU usage per node
- heap usage (>75% 위험, >85% 즉시 GC 폭주)
- disk usage (watermark)
- thread pool queue (search, bulk, write 큐 — 가득 차면 reject)
- merge queue depth

### 5-5. ES 전용 메트릭

- segment count per shard
- query cache hit rate
- field data cache memory
- circuit breaker triggered count
- pending_tasks
- cluster state size

## 6. Prometheus / Grafana 통합

### 6-1. ES Exporter

```yaml
# elasticsearch_exporter
- es.uri=http://es-cluster:9200
- es.indices=true
- es.cluster_settings=true
```

→ ES API → Prometheus metrics.

### 6-2. 표준 dashboard

Grafana 의 ES dashboard (1818, 6483 등) 활용.

### 6-3. msa 시사점

- ADR-0010 / ADR-0015 (resilience) 와 결합
- analytics 서비스 (ClickHouse) 와 별도 search 메트릭

## 7. Snapshot / Restore — 백업의 표준

### 7-1. Snapshot Repository 등록

```http
PUT /_snapshot/s3_repo
{
  "type": "s3",
  "settings": {
    "bucket": "my-es-backups",
    "region": "ap-northeast-2",
    "base_path": "production/"
  }
}
```

→ S3 / GCS / Azure Blob / shared filesystem 지원.

### 7-2. Snapshot 생성

```http
PUT /_snapshot/s3_repo/snapshot_2026_05_03?wait_for_completion=false
{
  "indices": "products,orders,members",
  "ignore_unavailable": true,
  "include_global_state": false
}
```

→ 모든 인덱스 또는 특정 인덱스. include_global_state 는 클러스터 설정 포함 여부.

### 7-3. 자동화 (SLM — Snapshot Lifecycle Management)

```http
PUT /_slm/policy/daily_snapshots
{
  "schedule": "0 30 1 * * ?",   // 매일 01:30 UTC
  "name": "<daily-snap-{now/d}>",
  "repository": "s3_repo",
  "config": {
    "indices": ["*"],
    "ignore_unavailable": true,
    "include_global_state": false
  },
  "retention": {
    "expire_after": "30d",
    "min_count": 7,
    "max_count": 30
  }
}
```

→ daily 자동 + 30일 보관 + 최소 7개 / 최대 30개.

### 7-4. Restore

```http
POST /_snapshot/s3_repo/snapshot_2026_05_03/_restore
{
  "indices": "products",
  "rename_pattern": "products",
  "rename_replacement": "products_restored",
  "include_aliases": false
}
```

→ 새 이름으로 복구 후 검증, 옵션으로 alias swap.

### 7-5. msa 시사점

- ES 가 SoR 가 아니므로 snapshot 은 **RTO 단축 도구** (재색인보다 빠름)
- snapshot 만 있고 재색인 능력 없으면 운영 안 됨 → snapshot + 재색인 이중 안전망
- msa 의 backup 정책 (`docker/backup/README.md`, `k8s/infra/prod/backup/`) 과 통합

## 8. 재색인 RTO — ES 의 진짜 복구 시간

### 8-1. RTO 정의

> **RTO (Recovery Time Objective)** = 장애 발생 후 서비스 정상 복구까지 최대 허용 시간.

ES 의 RTO = 다음 중 빠른 것:
- snapshot restore 시간
- product DB → ES 재색인 시간 (search:batch)

### 8-2. 측정 방법 (분기 1회 권장)

```
1. staging 환경에 product DB 의 production 사본 준비
2. ES 인덱스 전체 삭제
3. search:batch reindex 실행 → 시간 측정
4. 검색 sanity test (sample query)
5. 결과 기록 + RTO 갱신
```

### 8-3. RTO 예시

product 100만 건, 평균 5KB:
- snapshot restore (S3): ~10분
- DB reindex (search:batch, 1000 doc/batch): ~30분
- 검증 sanity: ~5분
- **RTO ≈ 15~45분**

### 8-4. RTO 단축 방법

- snapshot 자주 (daily)
- search:batch parallel 처리 (multi-thread / multi-pod)
- replica = 0 + refresh = -1 인덱싱 (§13)
- bulk 사이즈 / batch size 튜닝

## 9. 운영 사고 시나리오 / 진단 플레이북

### 9-1. 시나리오 1: 검색 latency P99 > 5s

```
1. cluster health → green/yellow/red 확인
2. hot_threads → 무거운 작업 식별
   - search 스레드 폭주: 무거운 query (script, wildcard)
   - merge 스레드: segment 폭증 (refresh_interval 검토)
   - bulk 스레드: 인덱싱 폭주
3. slow_log → 느린 query 패턴 식별
4. 메트릭 → CPU / heap / GC pause / disk IO 확인
5. 조치
   - 무거운 query → query 재작성 (filter 분리, wildcard 제거)
   - segment 폭증 → refresh_interval ↑ (1s → 30s)
   - 인덱싱 폭주 → consumer batch ↓
```

### 9-2. 시나리오 2: yellow 지속 (5분+)

```
1. cluster_health → unassigned_shards 확인
2. allocation_explain
   GET /_cluster/allocation/explain
3. 원인별 조치
   - allocation awareness: 노드 zone 확인
   - disk watermark: 디스크 정리 또는 노드 추가
   - max_shards_per_node: 클러스터 설정
   - shard 손상: snapshot 복구
```

### 9-3. 시나리오 3: red — primary 손실

```
1. cluster_health → 어떤 인덱스 / shard
2. 해당 인덱스 readonly + 검색 불가
3. snapshot 가용 → restore (다른 이름) → 검증 → alias swap
4. snapshot 없음 → product DB reindex (search:batch)
5. 사후: snapshot 정책 / replica 수 / allocation awareness 점검
```

### 9-4. 시나리오 4: disk 95% (flood_stage)

```
1. _cat/allocation 으로 노드별 disk 확인
2. 즉시 조치:
   - 옛 인덱스 삭제 (시계열이면)
   - 노드 추가
   - watermark 임시 조정
3. 사후: 디스크 모니터링 강화, ILM/ISM
```

### 9-5. 시나리오 5: 임베딩 모델 변경 후 검색 품질 ↓

```
1. mapping 의 model 메모 확인 (의도된 변경 vs silent)
2. silent 변경이면 → 옛 모델로 롤백 또는 옛 인덱스로 alias swap
3. 의도 변경이면 → 옛/신 모델 동시 운영 (vector field 두 개) 후 점진 전환
```

### 9-6. 시나리오 6: Kafka consumer lag 급증

```
1. consumer lag 메트릭 확인 (per partition)
2. 원인:
   - ES 인덱싱 느림 → ES 부하 (cluster health, hot_threads)
   - consumer 처리 느림 → bulk batch / scaling
   - producer 폭주 → 정상이면 consumer scale-out
3. 조치: search:consumer pod 추가 / 처리 batch 조정 / DLQ 정리
```

## 10. K8s 환경 운영 (msa)

### 10-1. ECK / OpenSearch Operator

- ECK (Elastic Cloud on K8s): ES 공식 operator
- OpenSearch Operator (Apache 2.0)
- helm chart 보다 operator 권장 (라이프사이클 자동화)

### 10-2. msa 의 k8s 매니페스트 위치

- `k8s/infra/local/elasticsearch/` (또는 유사)
- `k8s/infra/prod/elasticsearch/`

→ `k8s/infra/local/` 디렉토리 직접 확인 필요 (탐색 작업).

### 10-3. K8s 모니터링

- Prometheus operator + ES exporter
- Loki 로 ES 로그 수집 (slow log 포함)
- Grafana dashboard

### 10-4. PDB / Resource 제한

- PodDisruptionBudget — voluntary disruption 시 최소 가용 (예: minAvailable=2)
- resources.limits — heap 의 2배 정도 (page cache 여유)

## 11. msa 시사점 / ADR 후보

### 11-1. 모니터링 표준

- "ES / OpenSearch 4-Golden Signals 표준 — Prometheus exporter + Grafana dashboard 의무화"

### 11-2. RTO SLA

- "ES 인덱스 RTO SLA: P95 < 30분, 분기마다 RTO 훈련" (ADR 후보)

### 11-3. Snapshot 자동화

- "SLM daily snapshot to S3 + 30일 보관" (ADR 후보)

### 11-4. 사고 플레이북

- `docs/runbooks/search-incident-response.md` 신규 작성 권장

## 12. 흔한 실수 패턴

### 12-1. health 모니터링 없음

→ yellow 가 며칠째 진행 중인데 모르고 있음.

### 12-2. snapshot 만 있고 restore 훈련 없음

→ "snapshot 있다" 만으로 안심. 실제 restore 시 권한 / 호환성 / 매핑 문제로 실패.

### 12-3. RTO 측정 안 함

→ "ES 죽으면 얼마나 걸리지?" → 모름. SLA 정의 불가.

### 12-4. slow log 끔

→ default 가 ES 7+ 부터 비활성. 명시적으로 켜야 함.

### 12-5. alert 임계값 default

→ default 가 너무 관대 / 엄격. 도메인에 맞게 조정.

### 12-6. snapshot 보관 정책 없음

→ S3 비용 폭증 / 옛 snapshot 누적.

### 12-7. ES log 비활성

→ `discovery.type: single-node` 도 안 보고 single-node 운영.

### 12-8. Kibana / OpenSearch Dashboards 보안 무시

→ public 노출 → 인덱스 데이터 / mapping / cluster info 누출.

## 13. 자주 듣는 오해 정정

> **"yellow 면 데이터 손실"**

- ❌ yellow = replica 미할당 (가용성 ↓), primary 는 OK. red 가 데이터 손실 위험.

> **"snapshot 이 있으면 안전"**

- ⚠ restore 가 작동해야 안전. 정기 훈련 필수.

> **"hot_threads 는 한 번만 보면 된다"**

- ⚠ 순간 snapshot. 간격 / 반복 측정 필요.

> **"slow log 는 자동으로 켜져 있다"**

- ❌ 명시적 설정 필요.

> **"RTO 는 snapshot 시간이다"**

- ⚠ snapshot 가용성 + restore + 검증 + DNS / alias swap 까지 포함.

> **"refresh_interval 늘리면 검색 느려진다"**

- ⚠ "lag 가 길어진다" 가 정확. 단일 검색 성능은 영향 ❌, 오히려 segment 정리로 ↑ 가능.

> **"ES 메모리는 heap 만 보면 된다"**

- ❌ OS page cache 가 매우 중요. RAM 의 절반은 page cache 용.

## 14. 다음 학습

- [17-k8s-failure-simulation.md](17-k8s-failure-simulation.md) — k3d 에서 실제 장애 시뮬레이션
- [18-hybrid-search-poc.md](18-hybrid-search-poc.md) — vector search PoC 구현
- [19-improvements.md](19-improvements.md) — RTO SLA / snapshot 정책 ADR

> **§16 회독 체크리스트**:
> - [ ] cluster health 색상 (green/yellow/red) 의 정확한 의미
> - [ ] hot_threads / slow_log 활용 시점
> - [ ] 4-Golden Signals (latency / traffic / errors / saturation) 의 ES 적용
> - [ ] snapshot + SLM 자동화 패턴
> - [ ] RTO 정의 + 측정 방법 + 단축 기법
> - [ ] 사고 시나리오 6개의 진단 절차
> - [ ] disk watermark 3단계의 자동 동작
