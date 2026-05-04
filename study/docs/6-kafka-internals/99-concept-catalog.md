---
parent: 6-kafka-internals
seq: 99
title: Kafka 개념 카탈로그 — Full-Coverage Index + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://kafka.apache.org/documentation/
  - https://kafka.apache.org/40/documentation.html
  - https://docs.confluent.io/platform/current/
  - https://kafka.apache.org/40/javadoc/index.html
---

# 99. Kafka 개념 카탈로그

> **목적** — 6-kafka-internals 의 13+ deep file + Apache Kafka (4.0 기준) / Confluent Platform 공식 기준 빠진 영역 (KRaft, Tiered Storage, Streams 풀 카탈로그, ksqlDB, Connect 풀 패턴, Schema Registry, MirrorMaker 2 등) 발굴.

---

## 1. 기존 커버 매트릭스 (요약)

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| 아키텍처 | Broker, Topic, Partition, Replica, ISR | ✅ |
| Producer | acks, batch, linger.ms, compression, idempotent | ✅ |
| Consumer | group, offset, rebalance, poll loop | ✅ |
| EOS (Exactly Once Semantics) | idempotent producer + transaction | ✅ |
| 멱등성 | producer.enable.idempotence + consumer 멱등 키 | ✅ |
| DLQ | 실패 토픽 분리 | ✅ |
| msa 적용 | Kafka 토픽 컨벤션 + ADR-0012/0029 | ✅ |
| 운영 | lag, throughput, ISR shrink | ✅ |
| KRaft / Tiered Storage / Cruise Control | ZK 제거, hot/cold segment, 자동 리밸런서 | ✅ ([14](14-kraft-tiered-storage.md)) |
| Rebalance Protocols | Cooperative (KIP-429), Static Membership (KIP-345), KIP-848 신 protocol | ✅ ([15](15-rebalance-protocols.md)) |
| Log Compaction / Tombstone | key 별 최신 값, mixed (delete+compact), compacted topic 패턴 | ✅ ([16](16-log-compaction-tombstone.md)) |
| Streams DSL — KStream/KTable | KStream/KTable/GlobalKTable, EOS V2, DSL operators | ✅ ([17](17-streams-api-kstream-ktable.md)) |

### 1-A. 갭 진단 (Apache Kafka 4.0 기준)

1. **KRaft (Kafka Raft) — ZooKeeper 제거** — 4.0 부터 ZooKeeper 모드 제거
2. **Tiered Storage** — segment 를 hot(local) + cold(S3 등) 계층 분리
3. **Kafka Streams** 풀 카탈로그 — DSL (KStream/KTable/GlobalKTable, join, windowing, aggregations) + Processor API + state store
4. **ksqlDB** — Streams 위 SQL-like
5. **Schema Registry** — Avro/JSON/Protobuf compatibility 5 mode
6. **Kafka Connect** — Source/Sink, SMT (Single Message Transform), connector 풀 카탈로그 (Debezium, S3 Sink, JDBC, ES Sink, MongoDB)
7. **MirrorMaker 2 (MM2)** — cross-cluster replication
8. **Cooperative Rebalancing** (KIP-429) — incremental rebalance — 표준 권장
9. **Static Membership** (KIP-345) — group.instance.id — rebalance 회피
10. **Consumer 8.x — 신규 grouping protocol**
11. **Quotas** — producer/consumer/request 제한
12. **Authorization (ACL)** — ACL + RBAC (Confluent)
13. **SASL / mTLS** — 인증
14. **Encryption at rest** — Tiered storage + KMS
15. **Throughput vs Latency tuning** — `linger.ms`, `batch.size`, `compression.type` (gzip/snappy/lz4/zstd), `acks=1 vs all`
16. **Producer 의 max.in.flight.requests.per.connection 와 ordering 보장**
17. **Partitioner** (default / sticky / round-robin / custom)
18. **Consumer rebalance protocol** (eager vs cooperative)
19. **Offset commit 전략** — auto vs manual (sync/async)
20. **Consumer 의 max.poll.interval.ms / session.timeout.ms / heartbeat.interval.ms** 관계
21. **Transactional producer** — `transactional.id`, `init/begin/commit/abort`
22. **Read Committed vs Read Uncommitted** (consumer isolation level)
23. **Compaction (log compaction)** — key 기반 최신 값 유지
24. **Retention vs Compaction** — `cleanup.policy=delete|compact|delete,compact`
25. **Min ISR + acks=all** — 가용성 vs 일관성
26. **Unclean leader election** — 데이터 손실 위험
27. **Replica.lag.time.max.ms** — ISR 정의
28. **Reassignment / Cruise Control** — 자동 리밸런싱
29. **Kafka Streams 의 Exactly-once V2** — 더 가벼운 EOS
30. **Interactive Queries (Streams)** — state store 외부 노출
31. **Streams 의 windowing** (tumbling / hopping / session / sliding)
32. **KTable / GlobalKTable / Stream-Table join 종류**
33. **Suppress operator** — emit 정책
34. **Kafka 의 binary protocol + records v2** — header / timestamp
35. **Idempotent Producer 가 EOS 가 아닌 이유** — partition 단위만 보장
36. **Confluent Cloud / MSK 차이**

---

## 2. 카테고리별 개념 트리

### A. Cluster / 아키텍처

| 개념 | 정의 | 상태 |
|---|---|---|
| Broker / Controller | Controller = cluster metadata 관리 | ✅ |
| **KRaft mode** (no ZooKeeper) | 4.0 부터 표준 — Raft consensus | ✅ 커버 ([14](14-kraft-tiered-storage.md)) |
| Topic / Partition / Replica | 분산 단위 | ✅ |
| ISR (In-Sync Replicas) | acks=all + min.insync.replicas | ✅ |
| Leader election (clean / unclean) | data loss trade | ★ 신규 |
| Rack awareness | replica placement | 🟡 |
| **Tiered Storage** | hot/cold segment 분리 (S3) | ✅ 커버 ([14](14-kraft-tiered-storage.md)) |
| Reassignment | partition 이동 | 🟡 |
| **Cruise Control** (LinkedIn) | 자동 리밸런서 | ✅ 커버 ([14](14-kraft-tiered-storage.md)) |

### B. Producer

| 개념 | 정의 | 상태 |
|---|---|---|
| acks (0/1/all) | durability vs throughput | ✅ |
| batch.size / linger.ms | batching | ✅ |
| compression.type (none/gzip/snappy/lz4/zstd) | 비교 | ✅ |
| **enable.idempotence** | 중복 회피 (partition 단위) | ✅ |
| **transactional.id** | EOS — 다중 partition atomic | ✅ |
| max.in.flight.requests.per.connection | ordering 영향 | ★ 신규 |
| **Partitioner** (default / sticky / RR / custom) | key 분배 | 🟡 |
| Buffer memory | producer 내부 큐 | 🟡 |
| Send callbacks | 비동기 전송 + 실패 처리 | ✅ |

### C. Consumer

| 개념 | 정의 | 상태 |
|---|---|---|
| Group / Generation | rebalance 단위 | ✅ |
| Offset (committed / current) | 진행 위치 | ✅ |
| Auto vs Manual commit (sync/async) | 정책 | ✅ |
| **isolation.level** (read_committed / uncommitted) | EOS consumer 측 | ✅ |
| max.poll.records / max.poll.interval.ms | poll 주기 | ✅ |
| session.timeout.ms / heartbeat.interval.ms | 멤버십 | ✅ |
| **Cooperative Rebalancing** (KIP-429) | incremental | ✅ 커버 ([15](15-rebalance-protocols.md)) |
| **Static Membership** (KIP-345) | group.instance.id | ✅ 커버 ([15](15-rebalance-protocols.md)) |
| **Consumer Group Protocol 신규** (4.x) | next-gen | ✅ 커버 ([15](15-rebalance-protocols.md)) |
| Consumer fetcher (max.partition.fetch.bytes) | tuning | 🟡 |

### D. EOS / Idempotency

| 개념 | 정의 | 상태 |
|---|---|---|
| Idempotent Producer | PID + sequence — partition 단위 중복 회피 | ✅ |
| Transactional Producer | 다중 partition atomic | ✅ |
| Read Committed | aborted TX 안 읽음 | ✅ |
| Streams EOS V2 | 가벼운 EOS | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |
| **Consumer 멱등성** (msa 표준) | DB unique key + idempotency key | ✅ |
| DLQ 패턴 | 영구 실패 격리 | ✅ |

### E. Compaction / Retention

| 개념 | 정의 | 상태 |
|---|---|---|
| Retention (delete) | 시간/크기 기반 삭제 | ✅ |
| **Compaction** (log compaction) | key 별 최신 값 유지 | ✅ 커버 ([16](16-log-compaction-tombstone.md)) |
| Mixed (delete + compact) | 두 정책 결합 | ✅ 커버 ([16](16-log-compaction-tombstone.md)) |
| Tombstone | null value = 삭제 마커 | ✅ 커버 ([16](16-log-compaction-tombstone.md)) |
| Compacted topic 사용 패턴 | KTable, materialized view | ✅ 커버 ([16](16-log-compaction-tombstone.md)) |

### F. Kafka Streams

| 개념 | 정의 | 상태 |
|---|---|---|
| KStream / KTable / GlobalKTable | 스트림 vs 테이블 | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |
| DSL operators | map / filter / flatMap / branch / merge / through | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |
| join 종류 | KStream-KStream (windowed) / KStream-KTable / KTable-KTable / GlobalKTable | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |
| Windowing | tumbling / hopping / session / sliding | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |
| Aggregation | reduce / aggregate / count + windowed | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |
| State Store (RocksDB / in-memory) | 로컬 상태 | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |
| Interactive Queries | state store HTTP 노출 | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |
| Processor API | DSL 보다 저수준 | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |
| Suppress | window emit 정책 | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |
| Streams EOS V2 | exactly-once-v2 | ✅ 커버 ([17](17-streams-api-kstream-ktable.md)) |

### G. Connect

| 개념 | 정의 | 상태 |
|---|---|---|
| Source vs Sink | DB→Kafka / Kafka→DB | 🟡 |
| Standalone vs Distributed mode | 운영 모드 | ★ 신규 |
| **SMT (Single Message Transform)** | route / mask / cast / convert | ★ 신규 |
| Connector 카탈로그 | Debezium / JDBC / S3 / ES / Mongo / HDFS | 🟡 |
| Dead Letter Queue (Connect) | error.tolerance / errors.deadletterqueue.topic.name | ★ 신규 |
| Worker 클러스터 / rebalance | distributed mode | ★ 신규 |

### H. Schema Registry / Serdes

| 개념 | 정의 | 상태 |
|---|---|---|
| Avro / JSON Schema / Protobuf | 직렬화 + 스키마 | ★ 신규 |
| Compatibility 5 mode | BACKWARD / FORWARD / FULL / NONE / TRANSITIVE | ★ 신규 |
| Schema evolution | 필드 add/remove/rename 규칙 | ★ 신규 |
| Confluent Schema Registry / Apicurio | 구현 | ★ 신규 |

### I. Cross-cluster / DR

| 개념 | 정의 | 상태 |
|---|---|---|
| **MirrorMaker 2** | active-passive / active-active | ★ 신규 |
| Cluster Linking (Confluent) | KRaft 기반 mirror | ★ 신규 |
| Tiered Storage 와 결합 | 저렴한 백업 | ★ 신규 |

### J. 보안

| 개념 | 정의 | 상태 |
|---|---|---|
| SASL (PLAIN / SCRAM / GSSAPI) | 인증 | ★ 신규 |
| mTLS | 양방향 TLS | ★ 신규 |
| ACL | topic/group/cluster | ★ 신규 |
| OAuth (KIP-768) | OIDC | ★ 신규 |
| Quotas (producer/consumer/request) | 제한 | ★ 신규 |

### K. 운영 / 모니터링

| 개념 | 정의 | 상태 |
|---|---|---|
| Lag (consumer lag) | offset 차이 | ✅ |
| Under-replicated partitions | ISR shrink | ✅ |
| Throughput / RPS | metric | ✅ |
| JMX metrics + kafka_exporter (Prom) | observability | 🟡 |
| Burrow (lag) / CMAK / AKHQ | 도구 | 🟡 |
| **Cruise Control / Strimzi Operator** | k8s 기반 자동 운영 | ✅ 커버 ([14](14-kraft-tiered-storage.md)) |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **KRaft mode + ZK 제거** | 4.0 표준 — 운영 변경 |
| 2 | **Cooperative Rebalancing + Static Membership** | rebalance 안정화 표준 |
| 3 | **Schema Registry + 5 compatibility mode** | 이벤트 스키마 진화 표준 |
| 4 | **Compaction + Tombstone + KTable 패턴** | 보조 저장소 패턴의 토대 |
| 5 | **Kafka Streams DSL 풀 카탈로그** | stream processing 표준 |
| 6 | **Connect + SMT + Debezium** | CDC 와 직결 (#19) |
| 7 | **Tiered Storage** | 비용 절감 트렌드 |
| 8 | **MirrorMaker 2** | DR / multi-region |
| 9 | **Transactional producer + EOS V2** | 정확성 운영 |
| 10 | **Strimzi Operator + k8s** | 운영 자동화 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. Kafka 특화:
- §3 → "Producer/Broker/Consumer 측 동작 분리" 표
- §6 → "Apache Kafka vs Confluent vs MSK" 차이
- §7 → JMX metric / exporter / Burrow

---

## 5. 참고 자료

- Apache Kafka Documentation: https://kafka.apache.org/documentation/
- Confluent Platform: https://docs.confluent.io/platform/current/
- "Kafka: The Definitive Guide" (Narkhede, Shapira, Palino)
- "Designing Event-Driven Systems" (Ben Stopford)
- KIP index: https://cwiki.apache.org/confluence/display/KAFKA/Kafka+Improvement+Proposals
- Strimzi: https://strimzi.io/
- Debezium: https://debezium.io/
