---
parent: 7-distributed-systems
type: deep
order: 04
created: 2026-05-01
---

# 04. Replica 구성과 Quorum

> 분산 데이터의 본질: **여러 복제본이 있는데, 누구한테 쓰고 누구한테 읽을 것인가**. 답은 **leader 모델 + quorum 수식** 두 가지로 압축된다.

## 1. 왜 replica 가 필요한가

| 목적 | 설명 |
|---|---|
| 가용성 (HA (High Availability, 고가용성)) | 1대 죽어도 서비스 계속 |
| 지리적 분산 | 사용자 가까이 read latency ↓ |
| 처리량 (read scale) | read fan-out |
| 백업 / DR (Disaster Recovery, 재해 복구) | replica = 부분적 백업 |

**비용**: write 가 더 비쌈 (모든 replica 에 propagate), 일관성 트레이드오프.

## 2. 3가지 Replication 모델

### 2.1 Single-Leader (Primary-Replica, Master-Slave)

```
       ┌─────────┐
write→ │ Leader  │ ─── replicate ──→ Replica1
       └─────────┘ ─── replicate ──→ Replica2
                  └── replicate ──→ Replica3
```

- write 는 leader 에만 / read 는 모두 (또는 leader 만 = strong read)
- **장점**: 충돌 없음, 구현 단순
- **단점**: leader 가 SPoF, write throughput 제한
- **예**: MySQL replication, PostgreSQL streaming, MongoDB primary, Redis master-replica

**복제 방식**:
- **Synchronous**: leader 가 모든 replica ack 대기 (느리지만 안전)
- **Semi-synchronous**: 적어도 1개 replica ack 대기 (MySQL 기본)
- **Asynchronous**: leader 가 ack 안 기다림 (빠르지만 leader 죽으면 데이터 손실)

### 2.2 Multi-Leader

```
[Leader A in Seoul] ←──→ [Leader B in Tokyo]
       ↓                       ↓
  follower A1             follower B1
```

- 여러 leader 가 write 받고, 서로 비동기 sync
- **장점**: 지역 분산, write latency ↓, leader 죽어도 다른 곳에서 write 가능
- **단점**: **충돌 (conflict)** 발생 가능 → 해결 전략 필요 (LWW / Vector Clock / CRDT)
- **예**: MySQL multi-master (위험), Cassandra (sort of), CouchDB

### 2.3 Leaderless (Dynamo-style)

```
client write → coordinator → [replica1, replica2, replica3] (W개 ack 받으면 성공)
client read  → coordinator → [replica1, replica2, replica3] (R개 응답으로 결정)
```

- leader 없음, 모든 replica 가 평등
- W (write quorum) + R (read quorum) > N (총 replica) 면 일관성
- **예**: Cassandra, DynamoDB (내부), Riak

## 3. Quorum 수식

Dynamo 스타일 leaderless 에서 일관성을 결정하는 핵심 수식:

```
W + R > N  →  read 가 가장 최신 write 를 적어도 1개 본다 (overlap 보장)
W ≥ ⌈(N+1)/2⌉  →  write quorum 이 majority (split-brain 방지)
```

| N | 일반적 W, R | 의미 |
|---|---|---|
| 3 | W=2, R=2 | 표준 (majority quorum, 1대 장애 허용) |
| 5 | W=3, R=3 | 더 안전, 2대 장애 허용 |
| 3 | W=3, R=1 | write 안전, read 빠름 (write 비쌈) |
| 3 | W=1, R=1 | 가장 빠름, **eventual consistency** (W+R=2 ≤ N) |

### 시각적 표현

```
N=3 의 경우:
write [X][X][ ]   (W=2, replica1,2 에 X 저장)
read  [ ][?][?]   (R=2, replica2,3 read → replica2 가 X 가짐, 최신 보장)
```

## 4. 충돌 해결 전략 (Multi-Leader / Leaderless)

### LWW (Last-Write-Wins)

```kotlin
// 가장 큰 timestamp 가 이김
val winner = if (a.timestamp > b.timestamp) a else b
```

- **단순** 하지만 **데이터 손실** 가능 (시계 어긋나면 더 늦게 쓴 게 짐)
- Cassandra default

### Vector Clock 기반 (concurrent 감지)

```
A: {nodeA: 3, nodeB: 1}
B: {nodeA: 2, nodeB: 2}
→ 둘 다 어느 한쪽이 다른 쪽의 후속이 아님 → CONCURRENT → 둘 다 보존, 사용자에게 merge 위임
```

- **DynamoDB** (구버전), **Riak**, **CouchDB** 가 사용
- 14번 CRDT/MRDT 와 직결

### CRDT (자동 merge 가능한 자료구조)

- G-Counter, OR-Set, LWW-Register 등
- 자동으로 수렴 — 사용자 개입 없음
- **Yjs, Automerge, 14번 토픽 참조**

## 5. msa 프로젝트 replica 현황

### 5.1 MySQL

| 모드 | 환경 | 비고 |
|---|---|---|
| local (k3s-lite) | single instance | replica 없음 |
| prod-k8s | single master + read replica (계획) | semi-sync 기본 |

→ 현재는 **single-leader async / semi-sync** 라 가정. multi-master 는 사용하지 않음.

### 5.2 Redis

| 환경 | 모드 |
|---|---|
| local | standalone single |
| prod | sentinel / cluster (계획) |

- 캐시 + Rate Limiting (gateway) + admission counter (inventory)
- Redis cluster 모드 시 hash slot 으로 sharding, 각 slot 은 single master + replicas

### 5.3 Kafka

```
3 broker → 토픽 partition replica = 3 (RF=3)
producer.acks=all  → ISR (In-Sync Replicas) 모두 ack
min.insync.replicas=2  → 적어도 2 replica 살아있어야 write 허용
```

→ Kafka 는 **leader 기반 + ISR quorum**. ZooKeeper / KRaft 가 controller election.

### 5.4 Elasticsearch

```
shard 당 replica = 1 (default)
write quorum: primary + at least one replica
```

→ ES 는 **primary-replica per shard**, search 서비스에서 사용.

## 6. Read 일관성을 quorum 으로 조절

Cassandra / Kafka 가 보여주는 패턴: **튜너블 일관성**.

```kotlin
// Cassandra (의사코드)
session.execute(
    SimpleStatement.builder("INSERT INTO ...").build()
        .setConsistencyLevel(ConsistencyLevel.QUORUM)  // W = majority
)
```

| ConsistencyLevel | 의미 |
|---|---|
| ANY | 최소 1 노드 ack (가장 약함) |
| ONE | 1 replica ack |
| QUORUM | majority ack |
| ALL | 전체 ack (가장 강함, 1대 죽으면 실패) |

→ 도메인별로 read/write 일관성 강도 조절. 면접에서 "튜너블 일관성" 이라는 용어를 쓰면 차별화.

## 7. Replication 의 함정

### 7.1 Replication Lag

- async replication 은 leader 와 replica 간 **lag** 존재
- replica 에서 read 시 stale data 가능
- **사용자 본인이 방금 쓴 글이 안 보이는** 버그 → Read-your-writes 위반
- 해법: master sticky, monotonic read

### 7.2 Failover 의 위험

leader 가 죽으면 새 leader 선출 → 기존 leader 가 보낸 일부 write 가 **유실** 될 수 있음 (async replication).

```
Leader A 가 commit한 write_100 → replica B,C 에 도달 전에 A 죽음
→ B 가 새 leader 됨 → write_100 사라짐
→ A 가 부활하면 자기는 write_100 가졌다고 우김 → split-brain
```

해법:
- **synchronous replication** (성능 비용)
- **fencing** (옛 leader 의 write 거부)
- **WAL + 합의 알고리즘** (Raft 의 term + log matching)

### 7.3 Split-brain

network partition 으로 양측이 서로 자신이 leader 라고 믿는 상황.
→ Quorum (majority) 만 leader 자격 → minority 측은 자동 step-down.

## 8. 데이터 분산: Replication vs Partitioning

| 차원 | Replication | Partitioning (Sharding) |
|---|---|---|
| 목적 | 가용성, read scale | write scale, 용량 분산 |
| 같은 데이터 | N 개 복사 | 다른 데이터를 N 개로 쪼갬 |
| 함께 사용 | O — 각 partition 마다 replica 있음 | |

**예**: Kafka 의 topic = N partitions, 각 partition = R replicas

## 9. 실무 체크리스트

- [ ] 모든 stateful 컴포넌트 (DB, Redis, Kafka, ES) 의 **replication 모드** 가 명시되어 있나?
- [ ] **write 일관성** (acks/quorum) 이 도메인 critical level 에 맞나?
- [ ] **failover 시 데이터 손실 가능성** 이 RPO (Recovery Point Objective, 복구 지점 목표) 에 부합하나?
- [ ] **read replica lag** 모니터링 SLI (Service Level Indicator, 서비스 수준 지표) 가 있나?
- [ ] **split-brain** 시나리오에 대한 대응이 있나? (fencing / quorum)

## 10. 한 줄 요약

> Replication = "어떻게 같은 데이터를 여러 곳에 두고 일관성을 유지할 것인가" 의 답.
> **Single-leader + Quorum** 이 90% 의 정답. multi-leader / leaderless 는 충돌 해결 전략을 같이 가져와야 함.
