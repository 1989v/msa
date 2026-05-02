---
parent: 6-kafka-internals
seq: 01
title: Broker · Topic · Partition · Replica
type: deep
created: 2026-05-01
---

# 01. Broker / Topic / Partition / Replica — Kafka 의 기본 구성

## 한 줄 요약

> Kafka 는 **append-only 분산 커밋 로그**다. 토픽은 N 개의 파티션으로 쪼개지고, 각 파티션은 broker 들에 복제된다. 파티션이 **병렬화 단위**이자 **순서 보장 단위**이며 **장애 복구 단위**다.

## 1. 클러스터 구성 요소

| 요소 | 역할 | 데이터 보관 | 메타데이터 |
|---|---|---|---|
| Broker | 메시지 저장 + 클라이언트 응답 | 파티션 로그 (디스크) | controller 가 관리 |
| Controller | 메타데이터(토픽/파티션/리더) 관리 | KRaft 시 자체 quorum | __cluster_metadata |
| Producer | 메시지 발행 | 없음 | 파티션 리더 위치 캐시 |
| Consumer | 메시지 구독 | 없음 (offset 만 broker에 저장) | __consumer_offsets |

```
┌──────────────────────────────────────────────────┐
│            Kafka Cluster (commerce ns)           │
│                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ broker-0   │  │ broker-1   │  │ broker-2   │  │
│  │ (leader p0)│  │ (leader p1)│  │ (leader p2)│  │
│  │ follower p1│  │ follower p2│  │ follower p0│  │
│  │ follower p2│  │ follower p0│  │ follower p1│  │
│  └────────────┘  └────────────┘  └────────────┘  │
│         ▲              ▲              ▲          │
│         └──── KRaft Controller Quorum ──┘        │
└──────────────────────────────────────────────────┘
```

> msa 프로덕션: Strimzi 로 3 controller + 3 broker, KRaft 모드. 로컬 k3s-lite: 단일 노드 (controller + broker 1 개 = combined mode).

## 2. Topic, Partition, Replica

### Topic
- 메시지의 **카테고리** (msa 컨벤션: `{domain}.{entity}.{event}` — 예: `order.order.completed`)
- 토픽 자체는 논리적, 실제 데이터는 파티션이 보관

### Partition
- 토픽을 N 개로 쪼갠 **물리적 로그 파일들**
- 각 파티션은 **단일 broker 가 leader**, 나머지는 follower
- **파티션 내부에서만 순서 보장** — 토픽 전체 순서 보장은 안 됨
- 파티션 수 = 컨슈머 그룹 내 최대 병렬도 (한 파티션은 한 컨슈머에만 할당)

### Replica
- 파티션의 **복제본** (RF=3 이면 leader 1 + follower 2)
- ISR (In-Sync Replica) 에 들어와 있어야 leader 후보
- min.insync.replicas 미달 시 acks=all producer 가 실패 (NotEnoughReplicasException)

```
Topic: order.order.completed (RF=3, partitions=6)
┌─────────────────────────────────────────────────┐
│ p0  leader=broker0  followers=[broker1,broker2] │
│ p1  leader=broker1  followers=[broker2,broker0] │
│ p2  leader=broker2  followers=[broker0,broker1] │
│ p3  leader=broker0  followers=[broker1,broker2] │
│ p4  leader=broker1  followers=[broker2,broker0] │
│ p5  leader=broker2  followers=[broker0,broker1] │
└─────────────────────────────────────────────────┘
```

## 3. msa 토픽 구성 (Strimzi)

`k8s/infra/prod/strimzi/kafka-topics.yaml` 발췌:

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: order.order.completed
spec:
  partitions: 6           # 병렬 처리 단위
  replicas: 3             # 데이터 복제본
  config:
    retention.ms: "604800000"     # 7일
    min.insync.replicas: "2"      # ISR 최소 2개 필요
```

| 토픽 | partitions | replicas | retention | 비고 |
|---|---|---|---|---|
| `product.item.*` | 6 | 3 | 7d | 검색 인덱싱 입력 |
| `order.order.*` | 6 | 3 | 7d | 결제/재고 트리거 |
| `inventory.stock.*` | 6 | 3 | (default) | Outbox SSOT |
| `analytics.event.collected` | **12** | 3 | **30d** | 트래픽 많음 + 재처리 윈도우 |
| `analytics.score.updated` | 6 | 3 | (default) | Streams 출력 |

**관찰**: 트래픽 큰 토픽(analytics.event)은 partition 12 + retention 30d, 일반 도메인 이벤트는 partition 6 + 7d.

## 4. 파티션 할당 키 (Partitioner)

Producer 가 메시지를 어느 파티션에 넣을지 결정:

| 전략 | 동작 | msa 사용 예 |
|---|---|---|
| key 지정 | `hash(key) % partitions` | `aggregateId.toString()` (대부분) |
| key=null | sticky (linger 동안 같은 파티션) | (없음) |
| 직접 지정 | `new ProducerRecord(topic, partition, key, value)` | (없음) |

**핵심 함정**:
- 같은 key → 항상 같은 파티션 → 순서 보장
- 파티션 수를 **사후에 늘리면** key 분포가 깨짐 (`hash(key) % 6` ≠ `hash(key) % 12`) → 순서 보장 깨짐
- 그래서 파티션 수는 초기 설계 시 여유 있게 잡거나, key-aware 재배치 필요

msa 의 OutboxRelay 코드:
```kotlin
// quant/.../infrastructure/outbox/OutboxRelay.kt
template.send(topic, entity.eventId.toString(), entity.payload)
//                   ^^^^^^^^^^^^^^^^^^^^^^^^^ key
//   eventId 가 partitioner key — 같은 이벤트 ID 는 같은 파티션
```

aggregate ID 가 아니라 eventId 를 key 로 쓰면 같은 aggregate 의 이벤트들이 다른 파티션에 흩어져 **순서가 꼬일 수 있다**. quant 은 Phase 2 단순화로 OK 지만, 일반적으로는 aggregateId(예: orderId) 를 key 로 쓰는 게 정공법.

inventory 의 OutboxPollingPublisher:
```kotlin
kafkaTemplate.send(event.eventType, event.aggregateId.toString(), enrichedPayload)
//                                  ^^^^^^^^^^^^^^^^^ aggregate 단위 순서 보장
```

이쪽이 도메인 이벤트 정공법.

## 5. 파티션 수 결정 가이드

```
원하는 throughput / consumer 1 개 처리율 ≤ 파티션 수
```

예시:
- 목표: 10,000 msg/s
- 컨슈머 1 개 처리율: 1,000 msg/s
- → 최소 10 파티션 필요 (여유 분 포함 12-16)

**다른 고려사항**:
- 파티션 수 ↑ → 브로커당 파일 핸들 수 ↑ → 너무 많으면 OS limit 도달 (보통 broker 당 4000 파티션 한도)
- 파티션 수 ↑ → 리더 election 시간 ↑ (장애 시 N 개 파티션 재선출)
- 파티션 수 ↑ → end-to-end latency 약간 ↑

**msa 기준** (6 partitions × 3 services × ~10 토픽 ≈ 180 파티션) — 여유 있음.

## 6. 토픽 레벨 vs Broker 레벨 설정

토픽 마다 override 가능:
```bash
kafka-configs.sh --bootstrap-server kafka:9092 \
  --entity-type topics --entity-name order.order.completed \
  --alter --add-config retention.ms=2592000000  # 30d로 변경
```

| 설정 | broker default | topic override |
|---|---|---|
| retention.ms | 7d (`log.retention.hours=168`) | per-topic |
| segment.bytes | 1GB | per-topic |
| min.insync.replicas | 1 | per-topic (msa는 2 강제) |
| compression.type | `producer` (그대로 보관) | per-topic |

## 7. CLI 로 파티션 / 리더 확인

```bash
kafka-topics.sh --bootstrap-server kafka:9092 \
  --describe --topic order.order.completed
```

출력 예:
```
Topic: order.order.completed  PartitionCount: 6  ReplicationFactor: 3
  Partition: 0  Leader: 0  Replicas: 0,1,2  Isr: 0,1,2
  Partition: 1  Leader: 1  Replicas: 1,2,0  Isr: 1,2,0
  Partition: 2  Leader: 2  Replicas: 2,0,1  Isr: 2,0,1
  ...
```

- `Replicas`: 모든 복제본 broker id
- `Isr`: 현재 동기화된(=ISR) broker id
- ISR 에 leader 가 항상 포함됨
- ISR 이 Replicas 보다 작으면 **Under-Replicated Partition (URP)** — 운영 알람 대상

## 8. 면접 포인트

- **Q. 파티션을 사후에 늘리면 어떤 문제?**
  > key→partition 매핑이 바뀌어 같은 key 메시지가 다른 파티션으로 가게 된다. 순서 보장이 깨지므로, 토픽을 새로 만들고 마이그레이션하거나, hash 기반이 아닌 일관된 매핑을 보장하는 custom partitioner 가 필요.

- **Q. 파티션 수가 throughput 의 상한인 이유는?**
  > 한 파티션은 한 시점에 한 컨슈머(같은 그룹 내)에만 할당된다. consumer instance 수를 아무리 늘려도 partition 수를 못 넘는다. 컨슈머 5 개 + 파티션 3 개 → 2 개 컨슈머는 idle.

- **Q. RF=3 인데 min.insync.replicas=1 이면?**
  > acks=all 의 의미가 사실상 acks=1 로 격하. leader 만 살아있으면 ack 보내고, leader 만 죽으면 데이터 손실. msa 는 min.ISR=2 강제로 이 함정 회피.

- **Q. Under-Replicated Partition (URP) 가 위험한 이유?**
  > ISR 이 줄면 가용한 replica 수가 줄어 leader 장애 시 데이터 손실 위험 ↑. RF=3 → ISR 1 까지 떨어지면 unclean.leader.election 미허용 시 가용성도 잃는다. URP 가 0 이상이면 즉시 조사.

## 9. 다음 단계

- [02-offset-retention-compaction.md](02-offset-retention-compaction.md) — 파티션 안의 메시지가 어떻게 보관되는지
- [05-broker-internals.md](05-broker-internals.md) — 파티션 로그 segment / page cache / sendfile
- [06-replication-isr.md](06-replication-isr.md) — Replica / ISR / HW 메커니즘
