---
parent: 19-search-engine
seq: 12
title: 클러스터 토폴로지 + Shard 산정 — Master/Data/Coordinating, Shard 30-50GB 공식, Allocation Awareness
type: deep
created: 2026-05-03
---

# 12. 클러스터 토폴로지 + Shard 산정

> 묶음 3 (B) 시니어 의사결정. "shard 몇 개 잡을까?", "노드 구성 어떻게?", "갑자기 yellow 됐다 → 진단" — 운영 사고의 80% 가 여기서.

## 1. 한 줄 핵심

> **Shard 는 Lucene index 의 분산 단위 — 한 번 만들면 변경 못 함. 산정 공식: `샤드당 30-50GB`, `노드당 shard ≤ 20 × heap_GB`.**
> 노드는 역할별로 분리 (master 3개 전용, data 충분, coordinating 옵션) 하는 게 표준.

## 2. 노드 역할 (Node Roles)

ES/OpenSearch 클러스터의 노드는 여러 역할을 동시에 가질 수 있지만, 운영 환경에서는 **분리** 가 표준.

### 2-1. 노드 종류

| 역할 | 약자 | 책임 |
|---|---|---|
| **master** | M | 클러스터 상태 관리, shard allocation 결정, master election |
| **data** | D | 실제 인덱싱 / 검색 실행, segment 저장 |
| **coordinating** | (default) | 클라이언트 요청 받기, shard 들에 fan-out, 머지 |
| **ingest** | I | ingest pipeline 실행 (processor) |
| **ml** | (ES) | ML 모델 추론 |
| **transform** | (ES) | aggregation 변환 작업 |
| **remote_cluster_client** | R | cross-cluster search |

### 2-2. master 노드의 특수성

- 클러스터 상태 (cluster state) 를 메모리에 들고 있음
- 모든 인덱스 / shard / mapping 변경이 master 통과
- master 가 문제 = 클러스터 거의 모든 작업 정지

→ **master 는 전용 노드 3개** (split-brain 방지 quorum):
- 3개 중 2개 살아있으면 election 가능
- 1개만 두면 SPOF, 2개면 split-brain 위험, 4+ 는 낭비

```yaml
node.roles: ["master"]
node.master: true     # 7.x 이전
discovery.seed_hosts: [m1, m2, m3]
cluster.initial_master_nodes: [m1, m2, m3]
```

### 2-3. data 노드

실제 무거운 작업. 여러 tier 로 분리 가능:

| Tier | 역할 |
|---|---|
| `data_hot` | 최근 데이터, 쓰기 + 검색 빈번 |
| `data_warm` | 중간 데이터, 검색만, 작은 자원 |
| `data_cold` | 오래된 데이터, 검색 가능하지만 느림 |
| `data_frozen` | snapshot 기반 lazy load (ES 7.12+) |

→ 시계열 데이터 (로그, 메트릭) 에 활용. 일반 이커머스 검색은 hot only.

### 2-4. coordinating 전용 노드

- 큰 클러스터 (data 노드 10+ 이상) 에서 client 부하 흡수
- query fan-out / 머지가 무거운 워크로드 (대규모 aggregation) 에서 유용
- 작은 클러스터는 불필요 (data 가 coordinating 도 겸함)

```yaml
node.roles: []   # 모든 role 빼면 coordinating only
```

### 2-5. ingest 전용 노드

- ingest pipeline 이 무거운 경우 (예: 임베딩 추론)
- 일반은 data 가 겸함

## 3. Shard 의 정체

### 3-1. Shard = Lucene index 인스턴스

- 한 ES 인덱스 = N 개의 primary shard 로 분산
- 각 primary shard = 독립 Lucene index = segment 들의 집합
- replica shard = primary 의 복사본 (가용성 + 읽기 처리량)

```
ES Index: products
├── Primary shard 0  ──── Replica shard 0 (다른 노드)
├── Primary shard 1  ──── Replica shard 1
├── Primary shard 2  ──── Replica shard 2
└── Primary shard 3  ──── Replica shard 3
```

### 3-2. Shard 의 분산

- 인덱싱: doc 의 `_id` (또는 `routing`) hash → 어느 primary 에 갈지 결정
- 검색: 모든 primary (또는 replica) 에 fan-out → 결과 머지

### 3-3. Shard 개수는 변경 불가

- primary shard 개수 = 인덱스 생성 시 고정 (변경 ❌)
- replica 는 동적 변경 가능
- shard 개수 변경하려면 → 새 인덱스 + reindex

→ **shard 산정이 그토록 중요한 이유**.

## 4. Shard Sizing — 핵심 공식

### 4-1. 샤드 크기 가이드라인 (Elastic 공식)

> **샤드당 10-50GB (검색 위주)**, **샤드당 25-50GB (시계열)**.

너무 작으면 (예: 100MB):
- shard 개수 폭증 → master 부담 ↑ (cluster state 비대)
- merge 효율 ↓
- 검색 fan-out 비용 ↑

너무 크면 (예: 200GB):
- 단일 shard 검색 시간 ↑
- 복구 시간 ↑ (replica 재구성 등)
- merge 부담 ↑ (한 번 merge 가 거대)

### 4-2. 노드당 shard 개수 가이드라인

> **노드당 shard ≤ 20 × heap_GB**.

예: heap 16GB → 최대 320 shard.
이유: master state 가 shard 메타 보유, 노드의 file descriptor / 스레드 / 메모리 구조 한계.

### 4-3. 산정 예시

```
인덱스: products
예상 데이터 크기: 200GB (1년 후)
shard 크기 목표: 30GB
→ primary shard = ceil(200 / 30) = 7개

replica = 1 (가용성)
→ 총 shard = 7 × 2 = 14개

data 노드 3개 → 노드당 shard = 14 / 3 ≈ 5개 (충분)
```

```
시계열 (logs):
하루 100GB → 30 day 보관 = 3TB
일별 인덱스 (logs-2026-05-03 등):
  하루 100GB / 50GB shard = 2 primary shard / day
  30일 × 2 = 60 primary shard
  + 30일 × 2 replica = 120 shard 총
data 노드 3개 → 노드당 40 shard
```

### 4-4. 시니어 함정

- **future-proof 라며 shard 수 과대** — 작은 인덱스에 30 shard. 매 검색 30 shard fan-out. 안티패턴.
- **default = 1 primary 면 됨** — 현재 작아도 1년 내 50GB 안 되면 1 shard 로 시작.
- **shrink / split API** 로 사후 조정 가능 — 단, 인덱스 close 필요 + 제약 많음.

## 5. Replica 산정

### 5-1. 의미

- replica = primary 의 복사본 (다른 노드)
- 가용성: primary 죽어도 replica 가 promote
- 읽기 처리량: 검색은 모든 replica 에서 병렬 가능

### 5-2. 권장

- **운영 인덱스: replica = 1 이상** (가용성)
- 읽기 처리량 부족 → replica 추가 (단, 디스크 / 메모리 N배)
- 인덱싱 부하 ↑ → replica 인덱싱도 비용 (write amplification)

### 5-3. 동적 변경

```http
PUT /products/_settings
{ "number_of_replicas": 2 }
```

→ 즉시 적용 (background 복제). primary shard 수와 달리 자유.

### 5-4. bulk 인덱싱 시

- replica = 0 으로 두고 bulk 완료 후 replica 추가 (인덱싱 throughput ↑)
- 단, 그 동안 가용성 ❌ (replica 없음)

## 6. Allocation Awareness — 분산 안전망

### 6-1. 문제

기본 ES 는 random allocation. primary 와 replica 가 같은 zone / rack 에 있을 수 있음 → zone 장애 시 데이터 손실.

### 6-2. Allocation Awareness 설정

```yaml
# 노드 시작 시
node.attr.zone: "ap-northeast-2a"

# 클러스터 설정
cluster.routing.allocation.awareness.attributes: zone
```

→ ES 가 같은 zone 에 primary + replica 못 두게 강제.

### 6-3. Forced Awareness

```yaml
cluster.routing.allocation.awareness.force.zone.values: ["ap-northeast-2a", "ap-northeast-2b", "ap-northeast-2c"]
```

→ replica 가 다른 zone 에만 배치. zone 다운 시 자동 페일오버.

## 7. Shard Allocation Filtering

### 7-1. 인덱스별 노드 제약

```http
PUT /products/_settings
{
  "index.routing.allocation.require.tier": "hot"
}
```

→ products 인덱스 shard 는 `tier=hot` 노드에만.

### 7-2. ILM 과 결합

- 새 인덱스 → hot
- 7일 후 → warm 으로 이동 (allocation filter 변경)
- 30일 후 → cold
- 90일 후 → frozen / delete

→ 시계열 데이터에 자주 사용 (§13).

## 8. Routing — Custom Sharding

### 8-1. Default Routing

```
shard = hash(_id) % num_primary_shards
```

→ doc 이 어느 shard 에 갈지 자동 결정.

### 8-2. Custom Routing

```http
POST /products/_doc/123?routing=user_42
{...}

# 검색
GET /products/_search?routing=user_42
{ "query": ... }
```

→ 같은 routing 값의 doc 은 같은 shard 에. 사용자별 shard 격리.

### 8-3. 사용 시나리오

- 멀티테넌트 (사용자 / 회사별 데이터)
- join (parent-child) 의 부모-자식 같은 shard 강제
- 검색을 특정 shard 만으로 제한 (fan-out 비용 ↓)

### 8-4. 함정

- routing 값이 편향되면 shard imbalance (한 shard 만 큼)
- 검색 시 routing 안 주면 모든 shard fan-out (의미 X)

## 9. 클러스터 상태 (Cluster Health)

### 9-1. 상태 색상

| Color | 의미 |
|---|---|
| **green** | 모든 primary + replica 정상 |
| **yellow** | 모든 primary 정상, 일부 replica 미할당 |
| **red** | 일부 primary 미할당 → 데이터 손실 또는 검색 불가 |

### 9-2. 진단 절차 (yellow → red)

```bash
# 1. 클러스터 상태
GET /_cluster/health

# 2. 미할당 shard 이유
GET /_cluster/allocation/explain

# 3. 노드 상태
GET /_cat/nodes?v
GET /_cat/shards?v

# 4. 미할당 shard 강제 할당 시도
POST /_cluster/reroute?retry_failed=true

# 5. hot threads (성능 이슈)
GET /_nodes/hot_threads
```

### 9-3. 흔한 yellow / red 원인

- replica 가 같은 노드에 못 배치 (allocation awareness)
- 디스크 watermark 초과 (default 85% / 90% / 95%)
- 노드 재시작 / 네트워크 분할
- shard 너무 큼 → 복구 시간 길어 yellow 지속
- segment 손상

### 9-4. Disk Watermark

```
low (default 85%):  새 shard 할당 거부
high (default 90%): 기존 shard 다른 노드로 이동 시작
flood_stage (95%):  인덱스 read-only 강제
```

→ 디스크 모니터링 + alert 필수.

## 10. 운영 모니터링 핵심 지표

| 지표 | 정상 | 위험 |
|---|---|---|
| cluster status | green | yellow / red |
| node count | 안정 | 변동 |
| pending tasks | 0 | > 100 |
| disk watermark | < 85% | > 85% |
| heap usage | < 75% | > 85% |
| GC pause | < 200ms | > 1s |
| indexing latency | 안정 | spike |
| search latency p99 | 안정 | spike |
| segment count per shard | < 50 | > 100 |
| query cache hit rate | > 60% | < 30% |

→ §16 에서 모니터링 deep.

## 11. 클러스터 사이징 예시

### 11-1. 작은 운영 (<100GB, <100 QPS)

```
3 노드 (data + master eligible 겸용)
  - 4 vCPU / 16GB RAM / 200GB SSD each
  - heap = 8GB (RAM 절반, 절대 32GB 이하)
  - shard = 1 primary / 1 replica per index
  - replica = 1
```

### 11-2. 중간 (1TB, 1000 QPS)

```
3 master 전용 (2 vCPU / 4GB RAM)
5 data (8 vCPU / 32GB RAM / 1TB SSD)
  - heap = 16GB
  - shard 30GB target
  - replica = 1 또는 2
```

### 11-3. 대규모 (100TB+, 10K+ QPS)

```
3 master 전용
20+ data (16 vCPU / 64GB RAM / 4TB NVMe)
  - heap = 30GB (max compressed oops 보존)
3 coordinating 전용 (16 vCPU / 32GB RAM)
hot-warm-cold tier 분리
allocation awareness (multi-zone)
cross-cluster replication 검토
```

## 12. msa 시사점

### 12-1. 현재 (k3s-lite)

- `k8s/infra/local/` 에 단일 노드 ES + OS
- 학습 / 개발 환경 → 단일 노드 OK
- shard 산정 의미 작음 (1 primary, 0 replica)

### 12-2. 운영 (prod-k8s) 가정

product 검색 인덱스:
- 데이터 크기: 100만 product × 평균 5KB = 5GB
- + 임베딩 (vector) = 5GB + 4GB = ~10GB
- → primary shard = 1 또는 2 (작음, future 1년 50GB 가정)
- replica = 1 (가용성)
- 노드 = 3 data + 3 master (소형)

### 12-3. ADR / 설계 점검

- 신규 인덱스 만들 때 shard 산정 컨벤션 (예: "최소 1 primary, target 30GB shard")
- alert: yellow / red / disk watermark 모니터링
- 백업: snapshot S3 (§16)
- multi-zone 배치 (allocation awareness)

→ §16 (운영) / §17 (시뮬레이션) 에서 확장.

## 13. 흔한 실수 패턴

### 13-1. shard 수 너무 많이

```
처음부터 30 primary shard (한참 작은 인덱스)
→ 매 검색 30 fan-out. 매 작은 doc 도 30 shard 분산. 비효율.
```

→ 1 또는 2 로 시작, 성장 후 새 인덱스 + reindex.

### 13-2. master + data + coordinating 한 노드

```
모든 역할 한 노드에. master 가 무거운 검색에 영향 → cluster state 흔들림.
```

→ 운영은 master 분리 필수.

### 13-3. heap > 32GB

```
heap 64GB
→ JVM compressed oops 못 씀. 메모리 효율 ↓.
```

→ heap 은 절대 32GB 이하. 더 큰 노드면 RAM 으로 OS page cache 활용.

### 13-4. allocation awareness 없이 multi-zone

```
3 zone 에 노드 분산. allocation awareness 미설정.
→ primary + replica 같은 zone 가능 → zone 장애 시 데이터 손실.
```

### 13-5. routing 편향

```
사용자별 routing, 90% 트래픽이 한 사용자
→ 한 shard 만 hot. 클러스터 imbalance.
```

### 13-6. disk watermark 모니터링 없음

```
disk 95% → flood_stage → 모든 인덱스 read-only.
사용자 불만 후에야 발견.
```

### 13-7. master 노드 1개

```
master 1개 (테스트 환경 그대로 운영).
master 죽으면 클러스터 동작 중단.
```

→ 무조건 3개.

## 14. 자주 듣는 오해 정정

> **"shard 가 많을수록 빠르다"**

- ❌ 작은 인덱스에 너무 많은 shard 는 느림 (fan-out 비용).

> **"primary shard 도 동적으로 늘릴 수 있다"**

- ❌ 변경 불가. shrink / split / clone API 는 제약 많음.

> **"replica 는 인덱싱 부하 안 받는다"**

- ❌ replica 도 primary 처럼 인덱싱 받음 (write amplification).

> **"heap 을 RAM 의 90% 까지 줘야 빠르다"**

- ❌ OS page cache 가 매우 중요. heap = RAM 절반 + 32GB 이하.

> **"master 1개로 충분하다"**

- ❌ 무조건 3개 (split-brain 방지 + 가용성).

> **"yellow 는 무시해도 된다"**

- ⚠ 일시적이면 OK, 지속되면 문제. allocation explain 으로 원인 파악.

## 15. 다음 학습

- [13-indexing-pipeline-ilm.md](13-indexing-pipeline-ilm.md) — ILM 으로 hot-warm-cold 자동 전환
- [16-operations-monitoring-rto.md](16-operations-monitoring-rto.md) — cluster health / hot threads / snapshot
- [17-k8s-failure-simulation.md](17-k8s-failure-simulation.md) — 노드 죽이기 시뮬레이션 절차서

> **§12 회독 체크리스트**:
> - [ ] 노드 5종 (master/data/coordinating/ingest/ml) 의 역할
> - [ ] master 가 3개여야 하는 이유 (quorum)
> - [ ] shard 크기 가이드 (10-50GB) + 노드당 개수 가이드 (20 × heap_GB)
> - [ ] primary shard 가 변경 불가능한 이유와 우회 방법
> - [ ] cluster health (green/yellow/red) 의 정의와 진단 절차
> - [ ] disk watermark 3단계 (85/90/95%)
> - [ ] heap 32GB 한계 (compressed oops)
> - [ ] allocation awareness 의 필요성
