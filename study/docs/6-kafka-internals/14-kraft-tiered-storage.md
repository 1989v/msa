---
parent: 6-kafka-internals
seq: 14
title: KRaft mode + Tiered Storage + Cruise Control — 4.0 표준 운영 스택
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 03-controller-kraft.md
  - 05-broker-internals.md
  - 06-replication-isr.md
sources:
  - https://kafka.apache.org/40/documentation.html#kraft
  - https://kafka.apache.org/40/documentation.html#tiered_storage
  - https://cwiki.apache.org/confluence/display/KAFKA/KIP-500
  - https://cwiki.apache.org/confluence/display/KAFKA/KIP-405
  - https://cwiki.apache.org/confluence/display/KAFKA/KIP-866
  - https://github.com/linkedin/cruise-control
  - https://strimzi.io/docs/operators/latest/full/configuring.html
catalog-row: "§A KRaft mode (★ → ✅), Tiered Storage (★ → ✅), Cruise Control (★ → ✅), Leader election clean/unclean (★ → ✅)"
---

# 14. KRaft mode + Tiered Storage + Cruise Control — 4.0 표준 운영 스택

> 카탈로그 매핑: §99 §A — `KRaft mode (no ZooKeeper)`, `Tiered Storage`, `Cruise Control`, `Leader election (clean / unclean)` (★ → ✅).
> 학습 시간 예상: ~2.5h · 자가평가 입구 레벨: B+

> §03 이 KRaft 의 도입 배경과 Raft 합의 흐름을 다뤘다면, 본 deep file 은 4.0 표준이 된 **KRaft 운영의 실제 — 메타데이터 quorum 사이징, ZK → KRaft 마이그레이션 (KIP-866) 의 5 단계, Tiered Storage (KIP-405) 의 hot/cold segment 분리와 latency 변동성, Cruise Control 의 자동 리밸런싱과 tiered storage 결합** — 까지를 한 묶음으로 다룬다. msa 는 이미 KRaft 로 시작했고 Strimzi 가 운영 자동화를 일부 대신하지만, tiered storage 와 Cruise Control 도입 결정은 ROI (Return On Investment, 투자 대비 수익) 계산이 필요한 운영 결정이라 본 chapter 의 목표는 **"언제 켜고 언제 끄나"** 의 의사결정 가이드.

---

## 1. 한 줄 핵심

> **KRaft 는 Kafka 가 ZooKeeper 라는 외부 합의 시스템을 떼어내 자체 Raft quorum 으로 메타데이터를 관리하게 만든 변화** — 4.0 부터 ZK 모드는 완전 제거됐다. **Tiered Storage 는 segment 를 hot (local disk) + cold (S3 호환 객체 스토리지) 두 계층으로 나눠 broker 디스크 비용을 90%+ 절감**하지만 cold fetch 의 latency 변동성을 새 SLO (Service Level Objective, 서비스 수준 목표) 로 받아들여야 한다. **Cruise Control 은 partition 분포 / disk 사용량 / network throughput 을 입력으로 자동 리밸런싱 plan 을 산출** 하는 LinkedIn 발 도구로, tiered storage 와 결합하면 cold tier 가동 후 broker 추가/이탈 시 데이터 이동량을 수십 배 줄인다.

---

## 2. 등장 배경 — 왜 4.0 에 이 셋이 한꺼번에 표준이 됐나

### 2-1. ZK 시대의 누적된 통증

§03 에서 정리한 ZK 의 한계를 운영 관점으로 다시:

| 차원 | ZK 시대 통증 | 4.0 KRaft 의 답 |
|---|---|---|
| **운영 단순도** | ZK + Kafka = 두 분산 시스템 학습/모니터링/백업/업그레이드 | Kafka 단일 시스템 |
| **메타데이터 부하** | 토픽/파티션 수가 늘면 znode 수 폭증 + watch 채널 폭증 | `__cluster_metadata` 단일 토픽으로 압축 |
| **Controller failover** | 파티션 수에 비례 (수만 파티션 = 분 단위) | event log 의 마지막 위치부터 catch-up = 초 단위 |
| **메타데이터 일관성** | ZK 변경과 broker 의 watch 사이 race 가능 | leader 가 commit 한 record 를 broker 가 직접 read |
| **운영 보안** | ZK 인증과 Kafka 인증이 분리됨 | Kafka 의 SASL/mTLS 하나로 통합 |

> 4.0 는 ZK 모드 제거의 **마지막 차수**. 3.x 까지는 hybrid (ZK 또는 KRaft) 였는데 4.0 부터 KRaft only.

### 2-2. 디스크 비용 곡선의 변화

Kafka 가 처음 설계된 2010 년대 초엔 SSD 가 비싸고 HDD 가 저렴해서 broker 안에 디스크를 두는 게 자연스러웠다. 2020 년대 들어:

- 클라우드 객체 스토리지 (S3 / GCS / Azure Blob) 의 단가가 broker 의 EBS 대비 **5~10배 저렴**.
- 보관 정책이 길어진다 (감사 / 재처리용 30~365일).
- 그런데 실제 read 의 95%+ 는 **최근 24h 이내** 의 segment 에서 일어남.

→ **"오래된 segment 를 broker 디스크에 두는 건 낭비"** 라는 통찰이 KIP-405 (Tiered Storage) 의 출발점.

### 2-3. 운영 자동화 압력

3 broker × 6 partition × 3 replica 까지는 사람이 partition reassignment 를 손으로 짤 수 있다. 30 broker × 수천 partition 이 되면:

- broker 추가 시 어떤 partition 을 어디로 옮길지 결정.
- broker 이탈 시 ISR (In-Sync Replicas) 보호하면서 plan 산출.
- disk usage 가 한쪽으로 쏠리는 걸 감지.
- network throughput 이 broker 마다 균등한지 검증.

이걸 사람이 하면 실수 + slow. **Cruise Control** 은 이를 metric → 목표 함수 → ILP (Integer Linear Programming, 정수 선형 계획법) 비슷한 plan 산출로 자동화.

### 2-4. 셋이 같이 가는 이유

- KRaft → controller failover 빠름 → 메타데이터 변경 (= reassignment) 이 더 안전해짐 → Cruise Control 이 더 자주 plan 실행 가능.
- Tiered Storage → broker 디스크는 hot 만 → broker 추가/이탈 시 옮길 데이터 양 감소 → Cruise Control 의 plan latency 감소.
- 셋의 결합이 **"30+ broker 운영의 cost-of-ownership"** 을 한 자릿수로 끌어내림.

---

## 3. 동작 원리 — KRaft 메타데이터 quorum

### 3-1. 메타데이터 토픽 (`__cluster_metadata`) 의 구조

KRaft 는 메타데이터를 일반 Kafka 토픽처럼 다룬다. 단:

- partition: **1** (메타데이터는 단일 sequence)
- replication: controller 노드 수와 동일 (3 controller → RF=3)
- cleanup.policy: `compact` (옛 metadata 는 정리)
- 일반 토픽이 아닌 **internal topic** — 일반 클라이언트는 produce/consume 불가.

```
__cluster_metadata, partition 0
┌──────┬──────────────────────────────────┐
│ off  │ record                            │
├──────┼──────────────────────────────────┤
│ 0    │ FeatureLevelRecord                │
│ 1    │ TopicRecord(name=order...)        │
│ 2    │ PartitionRecord(topic=order, p=0) │
│ ...  │                                   │
│ 1042 │ ConfigRecord(retention.ms=...)    │
│ 1043 │ BrokerRegistrationRecord(id=2)    │
│ 1044 │ LeaderChangeMessage(leader=3)     │
└──────┴──────────────────────────────────┘
```

각 record 는 컨트롤 평면의 **사실 (fact)** — 토픽 생성, 파티션 배치, leader 변경, ACL 추가 등. broker 는 이 토픽을 마지막 read offset 부터 따라가며 메모리에 메타데이터 view 를 만든다.

### 3-2. controller quorum 동작

```
3 controller 구성 (c1=leader, c2=follower, c3=follower)

[topic create 요청 → c1]
   c1: append "TopicRecord(...)" to local log @ offset 5000
   c1: replicate to c2, c3 (Raft AppendEntries RPC)
   c2: ack
   c3: ack
   c1: quorum (2/3) 도달 → committed
   c1: broker 들이 fetch 하면 offset 5000 까지 visible
```

| Raft 개념 | KRaft 매핑 |
|---|---|
| term | epoch |
| leader | active controller |
| follower | standby controller |
| log | `__cluster_metadata` partition 0 |
| committed | quorum 의 과반이 ack |
| election | leader 부재 (heartbeat timeout) → 새 controller term ↑ + 투표 |

### 3-3. broker 와 controller 의 관계

```
Broker 들은 leader controller 에게서 metadata 를 PULL (fetch)

┌────────────────┐   FETCH (lastSeenOffset)
│  Broker 5      │ ────────────────────────────┐
│                │                              ▼
│ MetadataCache  │   ┌──────────────────────────┐
│  (in-memory)   │ ◄ │ Active Controller (c1)   │
└────────────────┘   │  __cluster_metadata log  │
                     └──────────────────────────┘
```

- broker 가 `MetadataFetch` API 로 controller 의 log 를 `tail`.
- `lastSeenOffset` 만 보내면 controller 는 그 offset 이후의 record 만 응답 (incremental).
- broker 는 응답을 적용해서 in-memory metadata 갱신.
- 새 broker 가 합류하면 처음부터 catch-up — `__cluster_metadata` 가 compact 라 record 수 = 활성 토픽/파티션 수 정도라 빠름.

### 3-4. quorum 사이징 — 3 vs 5

| controller 수 | 장애 허용 | 합의 latency | 운영 비용 |
|---|---|---|---|
| 1 | 0 (장애 = 클러스터 정지) | 최소 | dev only |
| 3 | 1 | 낮음 (2/3 ack) | 표준 |
| 5 | 2 | 약간 증가 (3/5 ack) | mission-critical |
| 7 | 3 | 더 증가 (4/7 ack) | 거의 안 쓰임 |

> 표준은 **3** — 1대 장애까지 허용하면서 합의 latency 가 낮음. msa 가 Strimzi 로 controller pool replicas=3 으로 잡은 이유.

### 3-5. controller failover 의 실제

```
t=0    : c1 leader, c2/c3 follower, broker 들 정상
t=10s  : c1 죽음 (process crash)
t=10.5s: c2/c3 의 heartbeat timeout (default 1.5s) 도달
t=10.6s: c2 가 candidate 로 전환, term=N+1, c3 에 RequestVote
t=10.7s: c3 ack (자기 자신 + c3 = 2/3 quorum)
t=10.7s: c2 leader 확정
t=10.7s: broker 들의 FETCH 가 c2 로 자동 redirect (NotLeaderForPartition error)
t=11s  : 메타데이터 변경 다시 가능
```

ZK 시대엔 t=10s ~ t=수분 (메타데이터 양에 비례) 였던 게 KRaft 에선 **수백 ms**. msa 의 controller failover 시 SLO 영향 거의 0.

### 3-6. 결합 모드 vs dedicated 모드

| 모드 | 구성 | 적합 |
|---|---|---|
| **combined** | `KAFKA_CFG_PROCESS_ROLES=controller,broker` (한 노드가 둘 다) | dev / 소규모 / k3s-lite |
| **dedicated** | controller 노드 (3) + broker 노드 (N) 분리 | 프로덕션 |

dedicated 의 이유:

- broker 가 GC pause 나 disk 포화로 느려져도 controller 의 합의에 영향 ❌.
- controller 노드를 작은 인스턴스 (CPU 2 core / mem 1~2GB) 로 운영 가능 — 비용 절감.
- 보안 — controller 는 메타데이터만 다루므로 broker 의 데이터 파티션 권한 분리 가능.

msa 의 Strimzi 설정 (`k8s/infra/prod/strimzi/kafka-cluster.yaml:1-43`):

```yaml
KafkaNodePool: controller (replicas=3, roles=[controller], 1Gi mem)
KafkaNodePool: broker     (replicas=3, roles=[broker],     2Gi mem)
```

→ dedicated 모드의 정석.

---

## 4. ZK → KRaft 마이그레이션 — KIP-866 의 5 단계

### 4-1. 왜 알아야 하나

msa 는 처음부터 KRaft 라 직접 마이그레이션할 일은 없지만, **면접 단골** + **이직한 회사가 ZK 기반이면 마주칠 일** 이라 한 번은 정리.

### 4-2. 전체 흐름

```
[Phase 0: 사전 준비]
  - Kafka 3.5+ 로 업그레이드 (3.4 이전은 마이그레이션 미지원)
  - ZK metadata snapshot 백업
  - dev 환경에서 리허설

[Phase 1: dual-write 모드 활성화]
  - KRaft controller 노드 별도 기동 (3 node quorum)
  - controller 노드 config: process.roles=controller, zookeeper.metadata.migration.enable=true
  - controller 가 ZK 의 메타데이터를 import + KRaft log 에 write
  - 이 시점부터 메타데이터 변경 = ZK + KRaft 양쪽에 기록

[Phase 2: broker 를 KRaft 모드로 rolling]
  - 각 broker 의 config: process.roles=broker, controller.quorum.voters=<KRaft controller 들>
  - broker 가 ZK 가 아닌 KRaft controller 에게서 metadata fetch 시작
  - 한 번에 1대씩 재시작 (rolling) → ISR 안정 유지

[Phase 3: ZK migration 종료]
  - 모든 broker 가 KRaft 모드로 전환되면
  - controller 의 zookeeper.metadata.migration.enable=false
  - dual-write 종료, KRaft only

[Phase 4: ZK 의존 제거]
  - broker config 에서 zookeeper.connect 제거
  - ZK ensemble 종료 + 인스턴스 회수
```

### 4-3. 마이그레이션 중 주의

| 위험 | 방어 |
|---|---|
| dual-write 도중 controller crash | 양쪽 메타데이터 정합성 검증 도구 (`kafka-metadata-shell`) 로 사전 점검 |
| broker rolling 중 ISR shrink | 한 번에 1대만, `min.insync.replicas` 보다 충분한 여유 두기 |
| Phase 2 도중 producer 가 acks=all 받는 timeout 증가 | 미리 producer timeout 늘리기 (request.timeout.ms = 60s) |
| Phase 3 직후 rollback 불가 | Phase 3 전에 ZK snapshot 한 번 더 |

### 4-4. 4.0 부터의 강제 사항

- 4.0 는 ZK 모드 자체를 코드에서 제거 → 3.x 에서 4.0 로 가려면 **반드시** KRaft 마이그레이션이 선행돼야 한다.
- 3.7+ 는 KRaft only 클러스터 신규 생성을 권장 (default).

> msa 는 처음부터 KRaft → 마이그레이션 부담 0. 운 좋게 들어온 베스트 프랙티스.

---

## 5. Tiered Storage (KIP-405) — hot/cold segment 분리

### 5-1. 한 장 그림

```
Topic order.order.completed (RF=3, 7일 retention → 30일 retention 으로 늘림)

[Tiered Storage off (default)]
  Broker 1: [seg0 seg1 seg2 ... seg29]   ← 30일 segment 모두 로컬
  Broker 2: [seg0 seg1 seg2 ... seg29]
  Broker 3: [seg0 seg1 seg2 ... seg29]
  → 디스크 사용량 = topic 크기 × RF × 30일

[Tiered Storage on]
  Broker 1: [seg27 seg28 seg29]          ← hot (3일치)
  Broker 2: [seg27 seg28 seg29]
  Broker 3: [seg27 seg28 seg29]
  S3:       [seg0 seg1 ... seg26 (1 copy, 28일치)]
  → 디스크 사용량 = topic 크기 × RF × 3일 + S3 비용
```

### 5-2. 동작 원리

1. broker 가 segment 를 닫을 때 (기본 1GB 또는 1주일) `RemoteLogManager` 가 해당 segment 를 S3 (또는 다른 RemoteStorageManager) 에 업로드.
2. 업로드 완료되면 메타데이터 (`segment_id`, `s3_object_key`, `start/end_offset`) 를 `__remote_log_metadata` 토픽에 기록.
3. 로컬 segment 는 **local retention** (예: 3일) 만 지나면 삭제. 단, S3 에는 **remote retention** (예: 30일) 까지 보관.
4. consumer 가 cold offset 을 read 하면 broker 가 S3 에서 해당 segment 를 fetch → 캐시 → 응답.

### 5-3. 핵심 config

| config | 의미 | 권장값 |
|---|---|---|
| `remote.log.storage.system.enable` | 클러스터 전체 활성 | true (한 번만) |
| `remote.log.storage.manager.class.name` | S3 / GCS plugin | `org.apache.kafka.server.log.remote.storage.S3RemoteStorageManager` |
| `log.local.retention.ms` | hot 보관 시간 | 3d |
| `log.local.retention.bytes` | hot 디스크 한계 | broker disk 의 70% |
| `log.retention.ms` | 전체 (hot + cold) 보관 | 30d / 90d / 365d |
| topic-level `remote.storage.enable` | per-topic 활성화 | true (대상 토픽만) |

### 5-4. 장점

| 차원 | 효과 |
|---|---|
| broker 디스크 비용 | 70~95% 절감 (보관 정책 길수록 효과 ↑) |
| broker 추가/이탈 시 데이터 이동 | hot segment 만 이동 → 시간 1/10 |
| retention 정책 유연성 | "감사용 1년 보관" 이 현실적이 됨 |
| backup 단순화 | S3 쪽이 이미 cross-AZ 복제 → 별도 백업 ❌ |

### 5-5. 트레이드오프

| 차원 | 비용 |
|---|---|
| **cold fetch latency** | local read = 1~5 ms, S3 read = 50~500 ms (첫 read), 캐시 후 ~10 ms |
| **latency P99 변동성** | hot 비율 변하면 P99 가 쑥 튄다 |
| **운영 의존성** | S3 outage = 오래된 데이터 read 불가 (hot 은 정상) |
| **비용 모델 복잡** | S3 GET / PUT / egress 비용 추가 — 운영 누적 비용 모델링 필요 |
| **재처리 성능** | 한 토픽 전체 reprocess = S3 fetch 폭증 → throttle 필요 |
| **암호화 정책** | S3 server-side encryption + Kafka 의 mTLS 가 별개 → 정책 일관성 검증 |

### 5-6. 언제 켜야 하나

| 토픽 유형 | tiered storage |
|---|---|
| 단기 retention (< 7d), 자주 read | ❌ off — hot 만으로 충분 |
| 중기 retention (7~30d), 가끔 audit | △ off / ⚪ on (조직 비용 정책) |
| 장기 retention (30~365d) | ⚪ on — broker 디스크 절감 큼 |
| 재처리용 (event sourcing) | ⚪ on — 가끔 전체 read 라 cold fetch latency 허용 |
| latency-sensitive 실시간 처리 | ❌ off — cold fetch latency 가 SLA 위협 |

### 5-7. msa 에 도입 검토

현재 msa 의 토픽 (`k8s/infra/prod/strimzi/kafka-topics.yaml`):

| 토픽 | retention | tiered storage 검토 |
|---|---|---|
| `product.item.created/updated` | 7d | ❌ — 짧음, hot 만으로 충분 |
| `order.order.completed/cancelled` | 7d | ❌ — 짧음 |
| `analytics.event.collected` | 30d (`2592000000`) | ⚪ **on 후보** — 30일이라 디스크 압력 ↑ |
| `analytics.score.updated` | 7d | ❌ |

→ analytics 의 event 토픽이 첫 번째 후보. 단 analytics 는 Kafka Streams 가 모든 event 를 read 하므로 cold fetch 가 자주 발동될 수 있음 → 실제론 보관 기간 90일 이상 + 가끔만 reprocess 할 때가 더 자연스러움.

### 5-8. 함정 — "tiered storage 켜면 broker 가 가벼워진다" 의 오해

```
Local segment (hot 3일치) - broker 가 직접 read/write — 가벼움
S3 segment (cold 27일치) - broker 가 S3 client 로 fetch — broker CPU/네트워크 사용
```

cold fetch 가 빈번하면 broker 의 CPU 와 네트워크가 오히려 늘 수 있다. tiered storage 의 목표는 **디스크 비용 절감** 이지 **broker 부하 절감** 이 아니다. cold fetch 가 잦은 워크로드면 오히려 broker 인스턴스 수를 늘려야 할 수도 있다.

---

## 6. Cruise Control — 자동 리밸런싱

### 6-1. 무엇을 푸는가

```
[Cruise Control 없을 때]
- broker 5 추가 → 어떤 partition 을 어디로 옮길지 사람이 결정
- broker 2 이탈 (planned) → ISR 보호하면서 plan 짜기
- broker 3 의 disk 가 90% → 어떤 partition 을 옮길까

[Cruise Control 있을 때]
- broker 의 metric (disk / CPU / network / partition 분포) 을 수집
- 목표 함수 (균등 분포 + 제약 만족) 를 정의
- plan 자동 산출 + 실행 (옵션: human approval 후 실행)
```

### 6-2. 입력 metric

- broker 별 disk usage (%, GB)
- broker 별 inbound/outbound network throughput
- broker 별 CPU
- partition 별 size / produce rate / consume rate
- replica 분포 (leader / follower / RF)

→ JMX + Kafka metric reporter 로 자동 수집.

### 6-3. 목표 (goals) 의 우선순위

Cruise Control 은 여러 목표를 **hard constraint** + **soft goal** 로 구분:

| 종류 | 예시 |
|---|---|
| **Hard** | min.ISR 유지, rack-awareness 유지, replica RF 유지 |
| **Soft** | disk 균등, network 균등, CPU 균등, leader 분산 |

plan 산출 시 hard 는 반드시 만족, soft 는 가능한 만큼 최적화. msa 의 Strimzi Cruise Control 통합은 hard goal 위주 설정 (RF/ISR 보호) + soft goal 은 disk + leader 정도.

### 6-4. plan 실행

```
[plan 산출]
  partition order.order.completed-3 (broker 1) → broker 5
  partition order.order.completed-7 (broker 2) → broker 6
  ...

[실행 단계]
  1. broker 5 에 partition replica 추가 (catch-up)
  2. ISR 합류 확인 후 broker 1 의 replica 제거
  3. 다음 partition 으로
```

핵심: **한 번에 옮기는 partition 수를 throttle** 해서 cluster 부하가 폭증하지 않게 함 (`replication.bandwidth.limit.config`).

### 6-5. tiered storage 와의 결합

tiered storage 가 켜져 있으면 partition 의 데이터 중 **hot segment** 만 broker 디스크에 있다. Cruise Control 의 plan 실행 시 옮길 데이터 = hot 만 → 시간 단축 폭이 매우 크다.

| 상황 | broker 5 추가 시 데이터 이동량 (1 partition × 30일 retention) |
|---|---|
| tiered storage off | 30일치 segment 전체 (예: 30 × 1GB = 30GB) |
| tiered storage on (local 3일) | 3일치만 (예: 3 × 1GB = 3GB) |

→ **10x 빠른 broker 확장**.

### 6-6. msa 에서의 위치

Strimzi 는 Cruise Control 을 1st-class CRD (Custom Resource Definition, 커스텀 리소스 정의) 로 통합 (`kind: KafkaRebalance`). msa 의 `k8s/infra/prod/strimzi/` 에는 아직 KafkaRebalance 가 없다 — broker 3대 고정이라 필요성 낮음. broker pool 을 5+ 로 키우거나, partition 수가 수백 개 넘어가면 도입 후보.

---

## 7. 클린 vs 언클린 leader election

### 7-1. 두 모드

```
ISR = {leader=1, follower=2, follower=3}
broker 1 (leader) crash

[clean leader election (default, 권장)]
  → ISR 안에서만 새 leader 선출 (broker 2 또는 3)
  → 데이터 손실 ❌
  → ISR 이 비어 있으면 토픽 read/write 정지 (가용성 ↓)

[unclean leader election (unclean.leader.election.enable=true)]
  → ISR 밖의 follower (out-of-sync) 도 leader 후보
  → ISR 비어도 가용성 유지
  → 단, out-of-sync 의 LEO 가 옛 leader 보다 작으면 그만큼 데이터 손실
```

### 7-2. 4.0 default 변경

- 4.0 부터 `unclean.leader.election.enable=false` 가 default (이전엔 true 였던 시기 있음).
- 이유: 분산 시스템의 기본 원칙 = **CAP 의 CP 선택** (가용성 < 일관성).
- 가용성을 우선하고 싶으면 명시적으로 true.

### 7-3. msa 의 선택

```yaml
# k8s/infra/prod/strimzi/kafka-cluster.yaml
config:
  default.replication.factor: 3
  min.insync.replicas: 2
```

- RF=3 + min.ISR=2 → ISR 1개만 살아있으면 acks=all write 거부 (가용성 ↓), 2개 살아있어야 write 진행.
- unclean leader election 명시 안 함 → 4.0 default = false.
- 즉 msa 는 **CP 선택** — 결제/주문 정확성을 가용성보다 우선.

---

## 8. 트레이드오프 / 안티패턴

### 8-1. KRaft 의 함정

| 안티패턴 | 결과 | 방어 |
|---|---|---|
| controller 1 개 (single quorum) | 컨트롤러 죽으면 메타데이터 변경 불가 | 항상 3 또는 5 |
| controller 와 broker 같은 디스크 | broker IO 폭증 시 controller fsync 지연 | dedicated 모드 + 별도 PV (PersistentVolume, 영구 볼륨) |
| `controller.quorum.voters` 잘못 설정 | quorum 합류 실패 — silent (로그만) | 부트스트랩 후 `kafka-metadata-shell` 로 검증 |
| dual-write 중 controller crash 후 무시 | 메타데이터 정합성 깨짐 | 마이그레이션 룰 — 검증 도구 + 롤백 plan |

### 8-2. Tiered Storage 의 함정

| 안티패턴 | 결과 | 방어 |
|---|---|---|
| latency-critical 토픽에 켜기 | P99 polluted by S3 read | 용도 별 토픽 분리 |
| local retention 너무 짧게 (1d) | cold fetch 빈번 → broker 부하 ↑ | 워크로드 분석 후 hot ratio 측정 |
| S3 region cross | egress 비용 폭증 + latency ↑ | 같은 region 사용 |
| 암호화 키 회전 미고려 | S3 의 KMS (Key Management Service, 키 관리 서비스) 키 만료 → cold read 실패 | 키 회전 정책에 cold segment 포함 |
| `__remote_log_metadata` partition 부족 | metadata 처리 병목 | 토픽 수에 비례해 partition 수 (default 50) 검토 |
| reprocess 시 throttle 미설정 | S3 GET 폭증 + 비용 폭증 | per-consumer fetch.max.bytes throttle |

### 8-3. Cruise Control 의 함정

| 안티패턴 | 결과 | 방어 |
|---|---|---|
| auto-execute 켜고 leave | 새벽 5시에 plan 자동 실행 → on-call 호출 | human approval 모드 |
| network throttle 너무 낮음 | plan 시간이 며칠 걸림 | 점진적으로 ↑ |
| network throttle 너무 높음 | plan 중 application latency 폭증 | 시작 시 보수적 + 모니터 |
| hard goal 만 / soft goal 무시 | partition 분포 불균형 잔존 | disk + leader balance 는 soft 로 켜기 |
| Cruise Control crash 시 plan 중단 | 일관성 깨짐 | KafkaRebalance status 모니터링 |

### 8-4. 셋의 결합 함정

- **KRaft + Tiered Storage + Cruise Control 을 한꺼번에 켜기**: 각각 새 기능이라 도입 순서 중요. 권장: KRaft 먼저 (이미 default) → 운영 안정 후 Cruise Control → 그 다음 Tiered Storage.
- **Strimzi 버전 의존**: 셋 다 Strimzi 가 자동화하지만 버전마다 지원 범위 다름. 도입 전 Strimzi changelog 확인 필수.

---

## 9. msa 적용 — 도입 결정 매트릭스

### 9-1. 현재 상태 (2026-05 기준)

```
[Infra]
  Strimzi 0.x (Kafka 3.8.0, KRaft enabled)
  controller pool: replicas=3 (dedicated)
  broker pool:     replicas=3 (dedicated)
  authorization:   simple ACL

[Tiered Storage]
  off (KIP-405 설정 없음)

[Cruise Control]
  off (KafkaRebalance CR 없음)
```

### 9-2. KRaft

**현재 OK** — 처음부터 KRaft, dedicated 모드, 3 controller. 추가 작업 없음.

개선 후보:

- 메타데이터 quorum metric 모니터링 (Prometheus + JMX exporter)
- controller failover 시간 SLI (Service Level Indicator, 서비스 수준 지표) 정의 (목표: P99 < 2s)

### 9-3. Tiered Storage 도입 결정

| 요인 | 현재 값 | tiered storage on 권장 여부 |
|---|---|---|
| 가장 긴 retention | 30d (`analytics.event.collected`) | ⚪ 도입 후보 |
| broker disk 사용률 | < 30% | 아직 압력 ❌ |
| S3 비용 정책 | 기존 backup 도 S3 사용 중 | 운영 친숙 ⚪ |
| 토픽 read 패턴 | analytics streams 가 거의 매 event read | ❌ cold fetch 폭증 위험 |

**결론**: 현 단계에선 보류. broker pool 이 5+ 로 커지거나 retention 이 90d+ 로 늘 때 재검토.

### 9-4. Cruise Control 도입 결정

| 요인 | 현재 값 | Cruise Control on 권장 여부 |
|---|---|---|
| broker 수 | 3 | 너무 적음 — 사람 손으로도 충분 |
| partition 총 수 | ~70 (6 × 토픽 × 토픽 수) | 적은 편 |
| 운영 인력 | 1~2 명 | 자동화 가치 ↑ |
| 새 broker 추가 빈도 | 거의 없음 | 가치 ↓ |

**결론**: 현 단계에선 보류. Strimzi 의 `KafkaRebalance` CR 은 1회성 plan 으로 사용 가능 (필요 시점에만 enable).

### 9-5. unclean leader election 정책

```yaml
# 현재 미명시 → default = false (4.0 기준)
# 권장: 명시적으로 false 적시 (정책 가시화)
config:
  unclean.leader.election.enable: false
```

### 9-6. controller failover SLO 추가 (운영 표준화 후보)

```
SLO: KRaft controller failover P99 < 2s, P99.9 < 5s
SLI: kafka_controller_kafkacontroller_active_controller_count metric 의 0→1 전환 시간
대시보드: Grafana — Kafka Controller panel
알람:    failover > 5s 5분 내 발생 시 page
```

---

## 10. ADR 후보

> **ADR-XXXX: Kafka 운영 표준 — KRaft 명시 + Tiered Storage / Cruise Control 도입 게이트**
>
> **Context**: msa Kafka 가 처음부터 KRaft 로 운영 중이지만, 운영 표준 (controller quorum 사이징, unclean.leader.election 정책, failover SLO) 이 ADR 로 명시되지 않음. 향후 broker pool 확장 / retention 연장 시 Tiered Storage + Cruise Control 도입 결정 기준이 필요.
>
> **Decision**:
> 1. **KRaft 운영 표준 명시**:
>    - controller quorum = 3 (dedicated mode), broker pool 별도.
>    - `unclean.leader.election.enable=false` 명시 (CP 선택 가시화).
>    - controller failover SLO: P99 < 2s, P99.9 < 5s.
> 2. **Tiered Storage 도입 게이트**:
>    - 도입 트리거: 어떤 토픽 retention ≥ 90d AND broker disk 사용률 ≥ 60%.
>    - 1차 대상: `analytics.event.collected` (도입 시 retention 90d 로 연장).
>    - 도입 시 hot ratio = 3d / 90d = 3.3% 권장.
> 3. **Cruise Control 도입 게이트**:
>    - 도입 트리거: broker pool replicas ≥ 5 OR partition 총 수 ≥ 200.
>    - 도입 시 KafkaRebalance CR 의 `goals` 는 `RackAwareGoal` (hard) + `DiskCapacityGoal` (hard) + `ReplicaDistributionGoal` (soft) + `LeaderReplicaDistributionGoal` (soft) 로 시작.
>
> **Consequences**:
> - (+) 운영 정책이 ADR 로 가시화 — 신규 인프라 작업 시 결정 기준 명확.
> - (+) 도입 게이트가 객관적 metric 기반 — "필요할 때만" 도입 보장.
> - (-) Tiered Storage 도입 시 S3 비용 모델링 + cold fetch latency SLO 추가 작업.
> - (-) Cruise Control 도입 시 goal 튜닝 학습 곡선.
>
> **Alternatives 검토**:
> - Tiered Storage 즉시 도입 — 현 retention 짧고 disk 여유 있어 ROI 낮음. 채택 ❌.
> - Cruise Control 즉시 도입 — broker 3대라 자동화 가치 낮음. 채택 ❌.
> - 정책 ADR 없이 ad-hoc 운영 — 운영자 교체 시 정책 회귀 위험. 채택 ❌.

---

## 11. 면접 한 줄 답변

### Q. KRaft 가 ZooKeeper 대비 좋은 이유 3 가지는?

> "운영 단순화 (분산 시스템 1개로 통합), controller failover 가 메타데이터 양 비례에서 초 단위로 단축 (메타데이터를 Kafka 토픽으로 압축하고 incremental fetch), 그리고 보안/인증 통합 (SASL/mTLS 하나로 모든 통신 커버) — 셋입니다. 4.0 부터 ZK 모드 자체가 제거됐습니다."

### Q. controller quorum 을 3 으로 잡는 이유는?

> "1대 장애까지 허용하면서 합의 latency 가 가장 낮습니다. 5는 2대 장애까지 가지만 quorum 이 3/5 로 늘어 latency 와 운영 비용이 약간 증가합니다. mission-critical 한 곳만 5, 나머지는 3 이 표준입니다. msa 도 Strimzi 의 controller pool replicas=3 으로 운영 중입니다."

### Q. ZK → KRaft 마이그레이션 핵심 단계는?

> "Kafka 3.5+ 로 업그레이드 후, KRaft controller 를 별도 기동하면서 dual-write 모드 (KIP-866) 활성화, broker 들을 KRaft 모드로 rolling 재시작, 모든 broker 가 전환되면 dual-write 종료, 마지막에 ZK 의존 제거. 4.0 부터는 ZK 모드 자체가 제거돼서 4.0 으로 가려면 반드시 선행돼야 합니다."

### Q. Tiered Storage 의 동작 원리와 트레이드오프는?

> "broker 가 segment 를 닫으면 RemoteLogManager 가 S3 에 업로드하고 메타데이터를 `__remote_log_metadata` 토픽에 기록합니다. 로컬 retention (예: 3일) 이 지나면 broker 디스크에서 삭제되지만 S3 에는 remote retention (예: 30일) 까지 보관. 장점은 broker 디스크 70~95% 절감 + broker 추가/이탈 시 데이터 이동 1/10. 트레이드오프는 cold fetch latency 가 50~500ms 로 P99 변동성 ↑ + S3 GET 비용 + cold fetch 시 broker CPU 사용 — 즉 latency-critical 워크로드엔 부적합."

### Q. msa 가 Tiered Storage 를 안 쓰는 이유는?

> "현재 가장 긴 retention 이 30일 (analytics.event.collected), broker disk 사용률 30% 미만이라 도입 ROI 가 낮습니다. 게다가 analytics 의 Kafka Streams 가 거의 매 event 를 read 하므로 cold fetch 가 폭증할 위험이 있습니다. broker pool 이 5+ 로 커지거나 retention 이 90일+ 로 늘 때 재검토할 ADR 게이트를 잡아두는 게 타당합니다."

### Q. Cruise Control 이 푸는 문제는?

> "30+ broker 에서 partition reassignment 를 사람이 짜는 게 비현실적이라 metric (disk / network / CPU / partition 분포) 를 수집해서 hard constraint (RF/ISR/rack) + soft goal (균등 분포) 로 plan 을 자동 산출하는 도구입니다. tiered storage 와 결합하면 hot segment 만 옮기므로 broker 확장 시간이 10x 단축됩니다. msa 는 broker 3대라 아직 도입 가치가 낮아서 보류 중입니다."

### Q. unclean.leader.election.enable 의 의미와 4.0 default 는?

> "ISR 이 비었을 때 ISR 밖의 follower (out-of-sync) 도 leader 후보로 삼을지 결정하는 옵션입니다. true 면 가용성 우선 (단 데이터 손실 가능), false 면 일관성 우선 (가용성 ↓). 4.0 부터 default 가 false — CP 선택입니다. msa 는 결제/주문 정확성을 가용성보다 우선해야 해서 명시적으로 false 가 맞습니다."

### Q. KRaft 의 controller failover 가 ZK 의 그것보다 빠른 근본 이유는?

> "ZK 는 메타데이터를 znode 트리로 가지고 controller 가 모든 znode 를 watch — failover 시 새 controller 가 znode 를 다시 read 해야 해서 메타데이터 양에 비례합니다. KRaft 는 메타데이터가 Kafka 토픽 (`__cluster_metadata`) 의 record 들이고 새 controller 는 lastSeenOffset 부터 incremental fetch — 시간 차이가 분 단위에서 초 단위로 압축됩니다."

---

## 12. 흔한 오해 정정

> **"KRaft 는 ZooKeeper 보다 항상 빠르다"**

- ⚠ 메타데이터 변경 / failover 는 빠름. **데이터 plane (produce/consume)** 은 ZK / KRaft 무관 — broker 의 ISR 복제 메커니즘이 동일하므로.

> **"controller 와 broker 가 같은 노드여도 상관없다"**

- ⚠ dev/소규모는 OK (combined). 프로덕션은 broker 의 GC / disk 부하가 controller 합의에 영향 줄 수 있어 dedicated 권장.

> **"Tiered Storage 켜면 broker 가 가벼워진다"**

- ❌ 디스크는 가벼워지지만 cold fetch 시 broker CPU/네트워크가 사용된다. cold fetch 빈도가 높으면 broker 부하 오히려 증가.

> **"Tiered Storage 의 cold fetch 도 1ms 안에 된다"**

- ❌ 첫 fetch 50~500ms (S3 round-trip), 이후 broker 가 캐시하면 ~10ms. P99 변동성을 SLO 에 반영해야 함.

> **"Cruise Control 이 알아서 다 해 준다"**

- ⚠ goal 정의가 잘못되면 의도치 않은 reassignment. hard / soft goal 우선순위 + auto-execute vs human approval 정책 명확히.

> **"unclean leader election 켜면 가용성이 좋아진다"**

- ⚠ ISR 비어도 leader 선출 가능 = read/write 가능. 단 out-of-sync follower 가 leader 가 되면 그만큼 데이터 **삼킴**. 결제/주문엔 부적합.

> **"ZK 마이그레이션은 한 번에 끝낼 수 있다"**

- ❌ KIP-866 의 5 단계 — dual-write 모드 거쳐야 함. 한 번에 ZK 를 끄고 KRaft 를 켜면 메타데이터 정합성 깨짐.

> **"KRaft 의 metadata 토픽도 일반 토픽처럼 produce 할 수 있다"**

- ❌ `__cluster_metadata` 는 internal — 일반 클라이언트의 produce/consume 불가. controller 만 write, broker 가 read.

---

## 13. 회독 체크리스트

> §14 회독 체크리스트:
> - [ ] KRaft 의 메타데이터 quorum 동작 (Raft term/leader/log/committed 매핑)
> - [ ] `__cluster_metadata` 토픽의 internal 성격 (compact + RF=controller 수)
> - [ ] controller quorum 사이징 — 3 (표준) vs 5 (mission-critical) 결정 기준
> - [ ] combined vs dedicated 모드 — 운영 영향 차이
> - [ ] ZK → KRaft 마이그레이션 5 단계 (KIP-866 dual-write)
> - [ ] 4.0 부터 ZK 제거 — 4.0 업그레이드 전제 조건
> - [ ] Tiered Storage 동작 — RemoteLogManager + `__remote_log_metadata` 토픽
> - [ ] hot retention vs remote retention — local.retention.ms / log.retention.ms 분리
> - [ ] cold fetch latency 50~500ms — P99 변동성 SLO 영향
> - [ ] tiered storage 가 broker 부하를 줄이지 않는다는 함정 (cold fetch 시 CPU/네트워크 사용)
> - [ ] Cruise Control 의 hard / soft goal 구분 + tiered storage 와의 결합 효과
> - [ ] clean vs unclean leader election — 4.0 default = false (CP 선택)
> - [ ] msa 의 도입 결정 매트릭스 (KRaft = 이미 OK, Tiered Storage / Cruise Control = 게이트)

---

## 14. 연결 학습

- §03 controller / KRaft 기본 — 본 문서가 4.0 운영 관점으로 확장
- §05 broker internals — segment / page cache (tiered storage 의 hot segment)
- §06 replication / ISR — clean leader election 의 ISR 전제
- §10 idempotency / DLQ — controller failover 중 producer retry 행동
- §15 (다음) cooperative rebalancing + static membership — controller failover 후 consumer group 재조립
- §17 (다음) Streams API — `__cluster_metadata` 와 별개의 `application.id`-기반 metadata
