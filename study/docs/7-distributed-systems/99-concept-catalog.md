---
parent: 7-distributed-systems
seq: 99
title: 분산 시스템 개념 카탈로그 — Full-Coverage + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - "Designing Data-Intensive Applications (Kleppmann, 2017)"
  - "Database Internals (Petrov, 2019)"
  - "Distributed Systems for Practitioners (Akidau et al.)"
  - https://martin.kleppmann.com/papers/
  - https://raft.github.io/
  - https://lamport.azurewebsites.net/pubs/pubs.html
  - https://microservices.io/patterns/
---

# 99. 분산 시스템 개념 카탈로그

> **목적** — 7-distributed-systems 의 20+ deep file + Kleppmann/DDIA / Database Internals / microservices.io / 표준 논문 (Lamport, Raft, Paxos) 기준 빠진 영역 발굴.
> 본 카테고리는 **단일 공식 reference 가 없는 영역** — 정전 표준은 학술 논문 + 표준 텍스트북.

---

## 1. 기존 커버 매트릭스 (요약)

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| 이론 | CAP / PACELC / FLP | ✅ |
| 일관성 모델 | Linearizability / Sequential / Causal / Eventual | ✅ |
| 합의 | Paxos / Raft / 2PC / 3PC | ✅ |
| 트랜잭션 패턴 | Saga / TCC / Outbox | ✅ |
| 멱등성 | idempotency key, dedupe | ✅ |
| 회복성 | Circuit Breaker / Bulkhead / Retry / Backoff | ✅ |
| ID | Snowflake / UUID / ULID | ✅ |
| 시간 | Lamport / Vector / HLC (Hybrid Logical Clock) | ✅ |
| Replication | Leader-Follower / Multi-Leader / Leaderless | ✅ |
| Partitioning | Range / Hash / Consistent Hashing | ✅ |
| msa 적용 | ADR-0012, ADR-0015 | ✅ |
| Consensus 심화 | FLP / Paxos (Basic/Multi) / Raft / Multi-Raft / PBFT | ✅ 커버 ([21](21-consensus-raft-paxos.md)) |
| Saga 보상 심화 | Choreography vs Orchestration / Compensating tx / TCC / Temporal / Outbox+Inbox | ✅ 커버 ([22](22-saga-compensation-deep.md)) |

### 1-A. 갭 진단

1. **Quorum 시스템** — N/W/R 모델, Dynamo 스타일 (W+R>N)
2. **Read repair / Anti-entropy / Hinted handoff**
3. **CRDT** (#14 cross-ref) — separate
4. **Gossip protocol** — Cassandra/Consul/Serf
5. **Membership / Failure detection** — SWIM, phi accrual
6. **Service Discovery** — DNS, Eureka, Consul, K8s service
7. **Service Mesh** — Istio / Linkerd
8. **Sidecar pattern** — Envoy
9. **Backends for Frontends (BFF)**
10. **API Gateway 패턴**
11. **Strangler Fig / Anti-corruption layer / Branch by abstraction**
12. **Event Sourcing** + CQRS — separate vs combined
13. **Outbox / Inbox / Pollers**
14. **Two-Phase Commit (2PC) 의 함정** + 회피 패턴
15. **Three-Phase Commit (3PC)**
16. **Calvin / Spanner — deterministic / TrueTime**
17. **Spanner / CockroachDB / TiDB / YugabyteDB** — modern distributed SQL
18. **Cluster manager / Coordinator** — ZooKeeper, etcd, Consul
19. **Leader election 패턴** — using lock / lease
20. **Distributed Lock 표준** — Redis Redlock 논쟁
21. **Distributed Tracing** — OpenTelemetry (#10 cross)
22. **Distributed snapshot** — Chandy-Lamport
23. **TLA+ / formal methods** — 명세
24. **Chaos Engineering** — Netflix Chaos Monkey, Litmus, Gremlin
25. **Game day / fault injection**
26. **Saga orchestration vs choreography**
27. **Saga compensating action 설계**
28. **Idempotency key 저장소 설계** (TTL, key uniqueness)
29. **Outbox relay / polling vs CDC**
30. **Event Carried State Transfer vs Event Notification**
31. **Stream / Batch + Lambda / Kappa architecture**
32. **Watermark / late-arriving data** — Streams (Kafka Streams, Flink)
33. **Backpressure (분산)** — Reactive Streams 표준 (#16 cross)
34. **Bulkhead** — thread pool / semaphore / queue
35. **Sliding window vs Fixed window vs Token bucket vs Leaky bucket** (Rate Limiting)
36. **Distributed Rate Limiter** — Redis Lua script + token bucket
37. **Multi-tenancy 패턴** — DB per tenant / shared DB / row-level security
38. **GDPR / data subject 삭제 — eventual consistency 와의 충돌**
39. **CRDT (#14)** — multi-leader 해결 표준
40. **Conflict resolution** — LWW (Last Write Wins) / CRDT / app-defined merge

---

## 2. 카테고리별 개념 트리

### A. 이론

| 개념 | 정의 | 상태 |
|---|---|---|
| CAP | Consistency / Availability / Partition tolerance — 3 중 2 | ✅ |
| PACELC | Partition 시 A vs C, Else (no partition) Latency vs Consistency | ✅ |
| FLP impossibility | async + 1 fault = consensus 불가 (정해진 시간 안에) | ✅ |
| 8 Fallacies of Distributed Computing | 네트워크 가정 함정 | ✅ |
| Two Generals Problem | 신뢰 불가능한 메시지 | 🟡 |
| Byzantine Fault | 악의적 노드 — PBFT, Tendermint | ✅ 커버 ([21](21-consensus-raft-paxos.md)) |

### B. 일관성 모델 / 합의

| 개념 | 정의 | 상태 |
|---|---|---|
| Linearizability | 단일 객체 + real-time 순서 | ✅ |
| Sequential / Causal / Eventual | 약함 단계 | ✅ |
| Read-Your-Writes / Monotonic Reads / Writes | session 보장 | 🟡 |
| Paxos / Multi-Paxos | 합의 표준 | ✅ |
| **Raft** | 이해 가능한 합의 — 표준 | ✅ |
| **Viewstamped Replication** | 학술 | ✅ 커버 ([21](21-consensus-raft-paxos.md)) |
| **PBFT / Tendermint** | Byzantine | ✅ 커버 ([21](21-consensus-raft-paxos.md)) |
| **Calvin / Spanner / TrueTime** | deterministic / globally synced clock | ★ 신규 |
| Quorum (N/W/R, W+R>N) | Dynamo 스타일 | ★ 신규 |
| Read repair / Anti-entropy / Hinted handoff | Quorum 보강 | ★ 신규 |

### C. 시간 / Causality

| 개념 | 정의 | 상태 |
|---|---|---|
| Physical clock skew | NTP / chrony | ✅ |
| **Lamport Clock** | scalar logical | ✅ |
| **Vector Clock** | per-node counter | ✅ |
| **HLC (Hybrid Logical Clock)** | physical + logical | ✅ |
| TrueTime (Spanner) | bounded uncertainty | ★ 신규 |
| Causal+Consistency | causal + convergent | ★ 신규 |
| Happens-before relation | Lamport 1978 | ✅ |

### D. Replication / Partitioning

| 개념 | 정의 | 상태 |
|---|---|---|
| Leader-Follower | 단일 leader | ✅ |
| Multi-Leader | active-active | ✅ |
| Leaderless (Dynamo) | 모든 노드 write | 🟡 |
| Sync vs Async vs Semi-sync replication | trade-off | ✅ |
| Partitioning — Range / Hash | 분배 | ✅ |
| **Consistent Hashing** | re-balance 최소 | ✅ |
| Rendezvous Hashing (HRW) | 대안 | ★ 신규 |
| Replication topology | star / mesh / ring | 🟡 |
| Conflict resolution (LWW / app-defined / CRDT) | merge | 🟡 (#14) |

### E. 트랜잭션 / 일관성 패턴

| 개념 | 정의 | 상태 |
|---|---|---|
| **2PC** (Two-Phase Commit) | XA / 회피 권장 | ✅ |
| **3PC** | timeout 추가 — but blocking 여전 | ★ 신규 |
| **Saga** (orchestration / choreography) | local TX + 보상 | ✅ |
| **TCC** (Try-Confirm-Cancel) | 명시적 reservation | ✅ |
| **Outbox / Inbox** | 단일 DB TX 안에 outbox 만 | ✅ |
| **CDC** (Debezium) | binlog → Kafka | ✅ |
| Event Sourcing + CQRS | 이벤트만 저장 + 별도 read model | ★ 신규 |
| Saga compensating action 설계 | 보상 가능한가 | ✅ 커버 ([22](22-saga-compensation-deep.md)) |

### F. 회복성 (Resilience)

| 개념 | 정의 | 상태 |
|---|---|---|
| **Circuit Breaker** (Closed / Open / Half-Open) | 실패 격리 | ✅ |
| **Bulkhead** | 자원 격리 | ✅ |
| **Retry** + Exponential Backoff + Jitter | 재시도 | ✅ |
| **Timeout** | 모든 외부 호출 | ✅ |
| **Hedged Request** | duplicate 요청 후 첫 응답 | ★ 신규 |
| **Rate Limiting** (token bucket / leaky bucket / fixed/sliding window) | 보호 | 🟡 |
| **Distributed Rate Limiter** (Redis + Lua) | 분산 | ★ 신규 |
| **Health check** (liveness / readiness) | k8s | ✅ |
| **Failover** | active-standby | ✅ |
| **Graceful degradation** | 부분 기능 | 🟡 |

### G. 멤버십 / 발견

| 개념 | 정의 | 상태 |
|---|---|---|
| **Gossip protocol** (SWIM / phi accrual) | 멤버십 | ★ 신규 |
| **Service Discovery** — DNS / Consul / Eureka / K8s service | 발견 | 🟡 |
| **Coordinator** — ZooKeeper / etcd / Consul | metadata | ✅ |
| **Leader Election** (lease-based) | 단일 리더 보장 | ✅ 커버 ([21](21-consensus-raft-paxos.md)) |
| **Distributed Lock** | Redlock 논쟁 | ✅ |

### H. 패턴 (microservices.io)

| 개념 | 정의 | 상태 |
|---|---|---|
| API Gateway | edge | 🟡 (#1, msa 의 gateway) |
| **Backends for Frontends (BFF)** | 클라이언트별 gateway | ★ 신규 |
| **Strangler Fig** | 점진적 마이그레이션 | ★ 신규 |
| **Anti-corruption layer** | legacy 격리 | ★ 신규 |
| **Sidecar / Service Mesh (Istio)** | proxy 분리 | ★ 신규 |
| **Saga Orchestrator vs Choreography** | 흐름 모델 | ✅ |
| **Database per Service** | DB 공유 금지 | ✅ |
| **Shared DB anti-pattern** | 회피 | ✅ |

### I. 스트림 / 분석 패턴

| 개념 | 정의 | 상태 |
|---|---|---|
| **Lambda architecture** | batch + speed | ★ 신규 |
| **Kappa architecture** | stream-only | ★ 신규 |
| **Watermark** | late-arriving data | ★ 신규 |
| **Windowing** (Kafka/Flink) | tumbling / sliding / session | ★ 신규 (#6 cross) |
| **Event Carried State Transfer** | event 안에 state 포함 | ★ 신규 |
| **Event Notification** | event = id only | ★ 신규 |

### J. 검증 / 카오스

| 개념 | 정의 | 상태 |
|---|---|---|
| TLA+ | formal spec | ★ 신규 |
| Jepsen | consistency test | ★ 신규 |
| Chaos Engineering | Netflix Chaos Monkey, Litmus, Gremlin | ★ 신규 |
| Game Day | 정기 fault drill | ★ 신규 |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **Saga orchestration vs choreography 설계** | msa 핵심 패턴 — 명확한 결정 필요 |
| 2 | **Distributed Rate Limiter (Redis + Lua)** | gateway 의 rate limit 구현 표준 (#9 cross) |
| 3 | **Quorum (Dynamo 스타일) + Read repair / Hinted handoff** | Cassandra/DynamoDB 진입 시 |
| 4 | **HLC + Causal+ consistency** | event 순서 보장의 modern 해법 |
| 5 | **Event Sourcing + CQRS** | 분산 분석 표준 |
| 6 | **Service Mesh (Istio / Linkerd)** | sidecar 표준 |
| 7 | **TLA+ 또는 Jepsen** | 안전성 검증 도입 |
| 8 | **Chaos Engineering 운영화** | k3d/k8s 시나리오 (#19 #17 cross) |
| 9 | **Strangler Fig 전략** | legacy 마이그레이션 |
| 10 | **Hedged Request + Tail at Scale** | latency 최적화 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. 분산 특화:
- §3 → "원논문 / 핵심 정리" 한 줄 + ASCII 시퀀스
- §6 → "패턴 비교" (예: 2PC vs Saga vs TCC)
- §7 → "장애 시나리오 시뮬레이션" (#17 와 cross)

---

## 5. 참고 자료

- "Designing Data-Intensive Applications" (Kleppmann)
- "Database Internals" (Petrov)
- "Microservices Patterns" (Chris Richardson)
- microservices.io: https://microservices.io/patterns/
- Raft: https://raft.github.io/raft.pdf
- Lamport (Time, Clocks): https://lamport.azurewebsites.net/pubs/time-clocks.pdf
- Spanner: https://research.google/pubs/pub39966/
- Dynamo: https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf
- Calvin: http://cs.yale.edu/homes/thomson/publications/calvin-sigmod12.pdf
- Jepsen: https://jepsen.io/
- TLA+: https://lamport.azurewebsites.net/tla/tla.html
