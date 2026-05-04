---
parent: 6-kafka-internals
seq: 03
title: Controller / KRaft / ZooKeeper Migration
type: deep
created: 2026-05-01
---

# 03. Controller / KRaft vs ZooKeeper — 메타데이터 관리

## 한 줄 요약

> Kafka 클러스터는 **메타데이터(토픽/파티션/리더/ACL)** 를 관리하는 컨트롤 플레인이 필요하다. 과거엔 외부 ZooKeeper 가 그 역할이었는데, **Kafka 3.3 부터 KRaft (Kafka Raft)** 모드로 자체 quorum 으로 대체. msa 는 로컬/프로덕션 모두 KRaft 사용 중.

## 1. 왜 메타데이터 컴포넌트가 필요한가

브로커 N 대로 클러스터를 구성하려면 누군가가 알아야 하는 것:
- 토픽이 몇 개 있고, 각각 파티션이 몇 개인가?
- 파티션마다 leader 가 어느 broker 인가?
- broker 가 살아있는지, 죽었는지?
- 누가 어떤 권한을 가졌는가? (ACL)
- 컨슈머 그룹의 멤버는?

→ 모든 broker 가 일관된 view 를 가져야 한다 = **분산 합의** 문제.

## 2. ZooKeeper 시대 (Kafka < 2.8)

```
┌────────────────────────┐    ┌────────────────────────┐
│  ZooKeeper Ensemble    │    │   Kafka Brokers        │
│  (3 or 5 nodes)        │    │                        │
│  - ZAB 합의 프로토콜    │◄───┤  Controller (1명)      │
│  - znode 트리           │    │  + 일반 broker (N-1)   │
│  - watch 메커니즘       │    │                        │
└────────────────────────┘    └────────────────────────┘
```

**문제점**:
- 외부 시스템 의존 — 별도 운영
- 메타데이터 = znode + watch ⇒ 토픽 수 늘어나면 znode 수 폭증, controller 가 모든 znode 를 watch 하느라 시작 시간 길어짐
- controller failover 시 모든 메타데이터를 ZooKeeper 에서 다시 읽음 → 파티션 수 만큼 시간 소요 (수만 파티션 = 수 분)
- 두 종류 합의(ZK + Kafka 내부) → 운영 복잡

## 3. KRaft 시대 (Kafka 3.3+ GA, 4.0 ZK 제거)

KRaft = **K**afka **Raft** — Kafka 자체에 Raft 합의 알고리즘을 구현해 ZooKeeper 제거.

```
┌─────────────────────────────────────────────────┐
│                Kafka Cluster                     │
│                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Controller │ │ Controller │ │ Controller │   │
│  │  (active)  │ │  (standby) │ │  (standby) │   │
│  │            │ │            │ │            │   │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘   │
│        │              │              │          │
│        └──────────────┴──────────────┘          │
│           __cluster_metadata 토픽               │
│           (Raft replicated log)                 │
│                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Broker 0  │ │  Broker 1  │ │  Broker 2  │   │
│  └────────────┘ └────────────┘ └────────────┘   │
└──────────────────────────────────────────────────┘
```

**핵심 변경**:
- **메타데이터 자체가 Kafka 토픽** (`__cluster_metadata`) — Raft 로 복제
- Controller 는 별도 노드 또는 broker 와 같은 노드에 두 가지 역할 가능 (combined)
- 새 broker 는 메타데이터 토픽을 마지막 위치부터 읽어 catch-up — 빠른 시작

**Process Roles**:
- `controller` — 메타데이터 quorum 멤버
- `broker` — 일반 데이터 처리
- `controller,broker` — 둘 다 (combined, 소규모/dev 권장)

## 4. msa 클러스터 구성

### 로컬 (k3s-lite, single-node combined)

`k8s/infra/local/kafka/statefulset.yaml`:
```yaml
- name: KAFKA_CFG_NODE_ID
  value: "1"
- name: KAFKA_CFG_PROCESS_ROLES
  value: "controller,broker"           # combined mode
- name: KAFKA_CFG_CONTROLLER_QUORUM_VOTERS
  value: "1@localhost:9093"            # 자기 자신만
- name: KAFKA_CFG_CONTROLLER_LISTENER_NAMES
  value: "CONTROLLER"
- name: KAFKA_CFG_OFFSETS_TOPIC_REPLICATION_FACTOR
  value: "1"
- name: KAFKA_CFG_TRANSACTION_STATE_LOG_REPLICATION_FACTOR
  value: "1"
- name: KAFKA_CFG_TRANSACTION_STATE_LOG_MIN_ISR
  value: "1"
```

→ controller + broker 1 개로 다 함. `__consumer_offsets` 와 `__transaction_state` 모두 RF=1 (개발/테스트만 안전).

### 프로덕션 (Strimzi, KRaft)

`k8s/infra/prod/strimzi/kafka-cluster.yaml`:
```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  annotations:
    strimzi.io/node-pools: enabled
    strimzi.io/kraft: enabled                # KRaft 모드
spec:
  kafka:
    version: 3.8.0
    metadataVersion: "3.8"
    config:
      default.replication.factor: 3
      min.insync.replicas: 2
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
---
# NodePool 분리 (controller 3 + broker 3)
kind: KafkaNodePool
metadata:
  name: controller
spec:
  replicas: 3
  roles: [controller]
---
kind: KafkaNodePool
metadata:
  name: broker
spec:
  replicas: 3
  roles: [broker]
```

- **Dedicated mode**: controller 와 broker 노드 분리 (프로덕션 권장)
- 3 controller → quorum 2/3 → 1대 장애까지 허용
- ZooKeeper 의존성 0

## 5. KRaft 의 합의 흐름 (간단히)

Raft 의 표준 동작:
1. controller 들 중 한 명이 **leader** (active controller)
2. 메타데이터 변경 (예: 새 토픽 생성) 은 leader 에게 요청
3. leader 가 `__cluster_metadata` 에 record 추가, follower 들에게 복제
4. quorum (과반) 이 ack → committed → broker 들에게 전파
5. leader 가 죽으면 election term 증가, 새 leader 선출 (보통 < 1초)

**일반 토픽 leader election** 과는 다른 메커니즘 (그쪽은 ISR (In-Sync Replicas) 에서 선택, 단순). 메타데이터의 합의가 Raft.

## 6. 메타데이터 vs 데이터 차이 정리

| 항목 | 메타데이터 (Controller) | 일반 데이터 (Broker) |
|---|---|---|
| 합의 알고리즘 | Raft (KRaft) / ZAB (ZK) | ISR 기반 (acks=all) |
| 저장 위치 | `__cluster_metadata` 토픽 | 일반 토픽의 파티션 로그 |
| 일관성 모델 | Strong (linearizable) | Eventual (단, ack=all 시 처리 후 강일관) |
| 가용성 | quorum 살아있어야 | min.ISR 만족하면 |
| 변경 빈도 | 낮음 (분/시간) | 높음 (초당 수만) |

## 7. ZK → KRaft 마이그레이션 (실무)

기존 ZK 기반 클러스터를 KRaft 로 마이그레이션:

1. **준비**: Kafka 3.5+ 로 업그레이드
2. **dual-write 모드**: ZK + KRaft 양쪽에 메타데이터 기록 (KIP-866)
3. **KRaft 모드 controller 기동**, ZK 메타데이터 import
4. **broker 들을 KRaft 모드로 재시작** (rolling)
5. **ZK 의존 제거** (ZK 삭제)

**주의**:
- Kafka 4.0 부터 ZK 모드는 **완전 제거** → 마이그레이션 강제됨
- 마이그레이션 중 메타데이터 정합성 검증 필수
- 사전에 dev 환경에서 리허설 권장

msa 는 처음부터 KRaft 시작 → 마이그레이션 부담 없음 (운 좋음).

## 8. 운영 체크포인트

- **Controller failover 시간** — KRaft 는 보통 < 1초, ZK 는 메타데이터 양에 비례
- **__cluster_metadata lag** — 새 broker 가 catch-up 못 하면 클러스터 합류 불가
- **Quorum size** — 3 → 1대 장애 허용, 5 → 2대 장애 허용. 짝수 비추 (split brain)
- **Disk for controller** — 메타데이터 크기는 작지만 fsync 성능 중요 (NVMe 권장)
- **Rack-awareness** — controller 들도 broker 처럼 rack 분산 권장 (KIP-392)

## 9. 면접 포인트

- **Q. KRaft 가 ZooKeeper 보다 좋은 이유 3가지?**
  > 1) 외부 시스템 의존 제거 (운영 단순), 2) 메타데이터를 토픽으로 관리해 빠른 catch-up (수만 파티션 환경에서 controller failover 가 분 → 초), 3) 합의 시스템 통일 (운영자가 두 시스템 학습/모니터링 안 해도 됨).

- **Q. KRaft 의 controller 와 broker 가 같은 프로세스에 있어도 되나?**
  > combined mode 로 가능. dev/소규모 OK. 프로덕션은 분리(dedicated) 권장 — broker 부하가 controller 합의에 영향 주는 걸 막기 위해. msa 는 로컬 combined, 프로덕션 dedicated.

- **Q. KRaft quorum 이 3 일 때 2대 동시 장애시?**
  > quorum 잃음 → 메타데이터 변경 불가. 기존 leader 가 살아있다면 데이터 read/write 는 어느 정도 계속될 수 있지만, 새 토픽 생성 / leader 재선출 / 새 broker 합류 등 메타데이터 변경 작업은 전부 중단. 그래서 5 controller (2대 장애 허용) 가 더 안전한 선택.

- **Q. ZK 와 KRaft, 트랜잭션 상태(__transaction_state)는 어디 있는가?**
  > `__transaction_state` 는 일반 토픽이라 broker 에 있다 (메타데이터 영역이 아님). KRaft / ZK 무관하게 동일. msa 프로덕션은 RF=3, min.ISR=2 로 설정.

## 10. 다음 단계

- [01-broker-topic-partition.md](01-broker-topic-partition.md) — 메타데이터로 관리되는 대상
- [04-producer-tuning.md](04-producer-tuning.md) — Producer 가 broker 와 어떻게 통신
- [06-replication-isr.md](06-replication-isr.md) — 일반 데이터의 leader election (controller 가 트리거)
