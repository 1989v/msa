---
parent: 7-distributed-systems
seq: 21
type: deep-dive
title: 합의 알고리즘 심화 — FLP / Paxos / Raft / Multi-Raft / BFT
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 02-cap-pacelc-flp.md
  - 04-replica-quorum.md
  - 05-clocks-ordering.md
  - 06-paxos-raft.md
  - 07-2pc-3pc.md
sources:
  - "Lamport, The Part-Time Parliament (1998)"
  - "Lamport, Paxos Made Simple (2001)"
  - "Ongaro & Ousterhout, In Search of an Understandable Consensus Algorithm (USENIX ATC 2014)"
  - "Fischer, Lynch, Paterson, Impossibility of Distributed Consensus with One Faulty Process (1985)"
  - "Castro & Liskov, Practical Byzantine Fault Tolerance (OSDI 1999)"
  - "Buchman et al., Tendermint: Byzantine Fault Tolerance in the Age of Blockchains (2018)"
  - "Yin et al., HotStuff: BFT Consensus in the Lens of Blockchain (PODC 2019)"
  - "DeCandia et al., Dynamo: Amazon’s Highly Available Key-value Store (SOSP 2007)"
  - "https://raft.github.io/"
  - "Kafka KRaft: KIP-500"
catalog-row: §B Quorum / §B Raft / §B PBFT
---

# 21. 합의 알고리즘 심화 — FLP, Paxos, Raft, Multi-Raft, Byzantine

> 06-paxos-raft 가 합의 알고리즘의 입문이라면, 본 문서는 **FLP 의 정확한 의미부터 시작해, Paxos 의 모든 변형, Raft 의 안전성 증명 골격, 그리고 Multi-Raft / BFT 까지** 더 깊게 들어간다. msa 코드베이스는 직접 Raft 를 구현하지 않지만, Kafka KRaft (Kafka Raft, Kafka 의 Raft 기반 메타데이터 합의), etcd, Strimzi controller 등 인프라가 합의 위에 서 있다는 점을 grounding 한다.

---

## §1. 합의 (Consensus) 문제와 FLP impossibility

### 1.1 합의 문제의 정확한 정의

**합의 (Consensus, 분산 환경에서 여러 노드가 단 하나의 값에 동의)** 문제는 다음 4 속성을 동시에 만족해야 한다.

| 속성 | 의미 | 위반 시 |
|---|---|---|
| Agreement | 모든 정상 (correct) 노드가 같은 값을 결정 | safety violation — split-brain |
| Validity | 결정된 값은 어떤 노드가 제안한 값이어야 함 (창작 금지) | 의미 없는 결정 |
| Termination | 모든 정상 노드가 결국 결정에 도달 | liveness violation — 영원히 hang |
| Integrity | 노드는 한 번만 결정, 이후 변경 불가 | 합의 자체가 무의미 |

> **safety vs liveness**: Agreement / Validity / Integrity 는 safety (절대 일어나지 말아야 할 일이 안 일어남), Termination 은 liveness (좋은 일이 결국 일어남).

### 1.2 FLP impossibility (Fischer-Lynch-Paterson, 1985)

> **정리**: 비동기 (asynchronous, 메시지 지연 상한 없음) 시스템에서 **단 1개의 노드 fail-stop 을 허용**할 때, **결정론적 (deterministic) 합의 알고리즘은 존재하지 않는다.**

증명 핵심 (sketch):

```
1. 시스템 상태를 "0-결정 가능", "1-결정 가능", "양쪽 모두 가능 (bivalent)" 로 분류.
2. 초기 상태는 bivalent 가 존재함을 보임.
3. 어떤 bivalent 상태에서든 한 메시지를 적절히 지연시키면
   다음 상태도 bivalent 로 만들 수 있음 (어떤 노드가 죽었는지 vs 단지 느린지 구분 불가).
4. 따라서 영원히 결정에 도달하지 않는 schedule 이 존재.
```

**핵심 통찰**: "노드가 죽었는가, 아니면 단지 메시지가 늦게 오는가" 를 비동기 환경에선 **구분할 방법이 없다**.

### 1.3 FLP 우회법 — 실제 시스템이 합의를 푸는 법

FLP 는 "결정론적 + 완전 비동기 + 모든 케이스" 가 동시에 성립할 때만 적용. 실용 시스템은 셋 중 하나를 깬다.

| 우회법 | 어떻게 | 예시 |
|---|---|---|
| Partial synchrony | "메시지 지연 상한이 있다" 가정 + timeout 도입 | Paxos / Raft (실제) |
| Randomization | timeout 을 무작위화 — adversary scheduler 무력화 | Raft 의 election timeout (150~300ms 무작위) |
| Failure detector | "죽었는지" 를 검사하는 별도 모듈 (불완전해도 됨) | Chandra-Toueg ⋄S — eventually strong |

> Raft 가 실제로 영원히 split vote 에 빠질 **이론적 가능성** 은 있지만, 무작위 timeout 으로 확률이 지수적으로 작아진다. FLP 는 살아있지만 "0-확률 사건" 으로 밀어낸 것.

### 1.4 합의의 실제 도달 가능 영역

- **Crash fault-tolerant (CFT)**: 노드는 죽기만 함, 거짓말 안 함 → Paxos / Raft. 정족수 = ⌈(N+1)/2⌉, 즉 majority. **N=2f+1 노드로 f 개 fail-stop 허용**.
- **Byzantine fault-tolerant (BFT)**: 노드가 임의의 잘못된 행동 (악의적 / 버그) → PBFT / Tendermint / HotStuff. 정족수 = ⌈(2N+1)/3⌉. **N=3f+1 노드로 f 개 byzantine 허용**.

→ msa 의 Kafka / etcd / Redis Sentinel 은 모두 CFT (내부 인프라이므로 byzantine 불필요). BFT 는 블록체인 / 멀티 조직 분산.

---

## §2. Paxos — 정확하지만 이해 못 함

### 2.1 Basic Paxos (Lamport, 1998 / 2001)

**역할 분리** (한 노드가 여러 역할 겸할 수 있음):

| 역할 | 책임 |
|---|---|
| Proposer | 값을 제안 |
| Acceptor | 제안에 투표 / 약속 |
| Learner | 결정된 값을 학습 (state machine 에 적용) |

**2-phase 프로토콜**:

```
Phase 1 — Prepare (read phase):
  Proposer    → all Acceptors: PREPARE(n)
  Acceptor[i] → Proposer (조건: n > 자기가 본 모든 ballot 번호):
                  PROMISE(n, prev_accepted_n, prev_accepted_v)
  Acceptor[i] : 이후 n 미만의 PREPARE/ACCEPT 모두 거부 약속

Phase 2 — Accept (write phase):
  Proposer 가 majority promise 받으면:
    - prev_accepted_v 가 있으면 그 중 가장 큰 prev_accepted_n 의 v 를 자기 v 로 채택
    - 없으면 자기가 원래 제안하려던 v 를 사용
    - → ACCEPT(n, v) 발송
  Acceptor[i] : PROMISE 한 n 보다 작지 않은 ACCEPT 만 수락
                → ACCEPTED(n, v)

majority 가 ACCEPTED 한 (n, v) → 결정됨 (chosen)
Learner 들은 ACCEPTED 메시지 (또는 별도 채널) 로 학습
```

### 2.2 왜 안전한가 — 핵심 invariant

```
P2c (Paxos invariant):
  어떤 (n, v) 가 chosen 이라면, 이후의 모든 (n', v') with n' > n 도 v' = v.

이유:
  - n' 는 n 의 acceptor majority 와 반드시 1개 노드에서 겹침 (pigeonhole, majority 둘은 교집합 ≥ 1)
  - 그 겹친 노드는 (n, v) 를 PROMISE 의 prev_accepted 로 보고
  - Phase 2 에서 Proposer 는 가장 큰 prev_accepted_n 의 v 를 채택
  - → v' = v
```

### 2.3 Multi-Paxos — 실제 사용 형태

Basic Paxos 는 **단 1개 값** 만 결정. 실제론 여러 값 (= log entry 들) 을 결정해야 함 → 같은 acceptor 그룹에 대해 여러 instance 의 Paxos 를 돌림.

최적화 핵심:
- **Stable leader** 로 Phase 1 을 한 번만 (Phase 1a 는 ballot 당, Phase 2 는 instance 당). 1 RTT (Round-Trip Time) 로 commit 가능.
- Leader 가 죽으면 다른 노드가 Phase 1 부터 다시.

**문제점**: leader election 이 Paxos 에 명시되지 않음 → 구현마다 다름. dueling proposers 가능.

### 2.4 Paxos 변형들

| 이름 | 차이 | 용도 |
|---|---|---|
| Basic Paxos | 1 값 결정 | 학술 |
| Multi-Paxos | 안정 leader + log | Google Chubby / Spanner |
| Cheap Paxos | 일부 acceptor 가 대기 (auxiliary), 비용 ↓ | 자원 제약 환경 |
| Fast Paxos | client → acceptor 직접, RTT ↓ but quorum 더 큼 (3N/4) | 저지연 |
| Generalized Paxos | commutative 명령어 동시 처리 | CRDT-like |
| Egalitarian Paxos (EPaxos) | leader 없음, 모든 노드 평등, 의존성 그래프 | 지리분산 |

### 2.5 Paxos 가 어려운 이유

1. **단일 값 vs 로그**: 논문이 단일 값에 집중, log replication 으로 확장하는 부분이 모호.
2. **Leader election 미명시**: dueling proposers 시 liveness 가 깨짐 (영원히 다음 ballot 으로).
3. **표현이 비유적**: "Part-Time Parliament" 의 그리스 의회 비유는 직관적이지만 구현 가이드 X.
4. **Membership change**: 노드 추가/제거가 명시되지 않음 → 구현마다 다름.

→ 결과적으로 Lamport 자신이 "Paxos Made Simple" 을 후속 발표. 그래도 풀리지 않아 Raft 등장.

---

## §3. Raft — 이해할 수 있는 합의

### 3.1 설계 철학 (Ongaro 2014)

> "Paxos 와 동등한 안전성을 가지면서 **이해 가능 (understandability)** 을 1차 목표로 하는 알고리즘."

핵심 분리:

```
Raft = Leader Election + Log Replication + Safety
```

세 부분이 거의 독립적으로 추론 가능 — Paxos 처럼 모든 게 한 번에 엮여 있지 않다.

### 3.2 노드 상태와 전이

```
       timeout                  win election
Follower ──────► Candidate ─────────────────► Leader
   ▲                 │                          │
   │                 │ discover higher term     │
   │                 ▼                          │
   └──────────────────── higher term / heartbeat ─┘
```

**불변 규칙**:
- 한 시점에 같은 term 에서 leader 는 0 또는 1명.
- 노드가 자기보다 큰 term 을 보면 즉시 follower 로 step-down.

### 3.3 Term — 논리 시계 (logical clock)

Raft 의 term 은 election 마다 증가하는 단조 logical clock.

```
term 1 (Leader A) ──► term 2 (election failed, no leader) ──► term 3 (Leader B) ──► ...
```

Term 의 역할:
- **Stale leader 검출**: 옛 leader (작은 term) 가 부활해도 자기보다 큰 term 을 보면 항복.
- **Log entry 의 epoch tag**: 각 entry 는 (term, index, command).

### 3.4 Leader Election

```
1. Follower 가 election timeout (보통 150~300ms 무작위) 안에
   leader 의 AppendEntries (heartbeat) 를 못 받음
2. Follower → Candidate, currentTerm += 1, voteFor = self
3. RequestVote(term, candidateId, lastLogIdx, lastLogTerm) RPC 를 모든 노드에
4. Voter 의 응답 규칙:
   - term < currentTerm 이면 거부
   - 이미 다른 후보에게 투표했으면 거부
   - candidate 의 log 가 자기보다 "최신이 아니면" 거부 (Election Restriction, §3.6)
5. Majority (> N/2) 의 vote 받으면 → Leader, heartbeat 시작
6. 다른 leader 의 AppendEntries 를 받으면 (term ≥ self) → Follower 로 복귀
7. timeout 까지 결과 없으면 → 다시 timeout 후 새 election (term +1)
```

**무작위 timeout**: split vote (여러 candidate 동시) 확률을 지수적으로 감소.

### 3.5 Log Replication — AppendEntries RPC

각 노드는 log = `[(term, index, command), ...]` 를 가진다.

```
Client → Leader: command
Leader: log 에 append (uncommitted)
Leader → Followers: AppendEntries(
                       term, leaderId,
                       prevLogIdx, prevLogTerm,    // consistency check
                       entries[],                   // 새 entry 들
                       leaderCommit                 // commit 알림
                     )
Follower:
  - prevLogIdx, prevLogTerm 일치 확인 → 일치하면 entry append, 불일치면 거부
Leader:
  - majority ack → commitIndex 갱신 → 다음 AppendEntries 에 leaderCommit 실어 전파
Follower:
  - commitIndex 까지 state machine 에 apply
```

**불일치 복구**: follower 가 거부하면 leader 가 nextIndex[follower] -= 1 후 재시도. 끝까지 일치 지점 찾으면 그 이후를 덮어씀.

### 3.6 Safety 속성 5종

Raft 의 안전성은 5개 invariant 의 곱.

| 속성 | 의미 |
|---|---|
| Election Safety | 한 term 에 leader 는 최대 1명 |
| Leader Append-Only | leader 는 자기 log entry 를 절대 덮어쓰거나 삭제하지 않음 |
| Log Matching | 두 log 의 (idx, term) 이 같으면 그 이전 모든 entry 도 같음 |
| Leader Completeness | 어떤 term 에서 commit 된 entry 는 그보다 큰 모든 term 의 leader 에 존재 |
| State Machine Safety | 한 idx 에 적용된 명령은 모든 정상 노드에서 같음 |

**Leader Completeness** 가 가장 중요 — 이것이 보장되어야 새 leader 가 commit 된 데이터를 절대 잃지 않는다.

#### Election Restriction — Leader Completeness 의 보호 장치

```
voter 가 candidate 에게 vote 하는 조건:
  candidate.lastLogTerm > voter.lastLogTerm
  OR
  (candidate.lastLogTerm == voter.lastLogTerm
   AND candidate.lastLogIdx >= voter.lastLogIdx)
```

→ 즉, candidate 의 log 가 자기보다 **최신이거나 같아야** vote. 이로써 commit 된 (= majority 가 가진) entry 는 새 leader 에 반드시 존재.

### 3.7 Membership change — Joint Consensus

노드 추가/제거 시 quorum 정의가 바뀌므로 위험. Raft 는 **2단계 joint consensus** 도입:

```
1. C_old + C_new (joint config) 를 log 에 commit
   - 이 시점부터 모든 결정은 C_old 와 C_new 양쪽에서 majority 필요
2. C_new 단독 config 를 log 에 commit
   - 이 시점부터 C_new 만 majority
```

→ 두 config 가 동시에 단독 majority 를 가질 수 없음 (split-brain 방지).

### 3.8 Snapshot — log 무한 증가 방지

```
1. state machine 의 현재 상태를 snapshot
2. snapshot 까지의 log entry 삭제
3. 새 follower / 뒤처진 follower 는 InstallSnapshot RPC 로 snapshot 부터 받음
```

---

## §4. Raft 변형들 — 실제 구현체

| 구현 | 특징 | 사용처 |
|---|---|---|
| etcd-raft (Go) | hashicorp 와 함께 가장 많이 쓰이는 라이브러리, batching / pipelining | etcd, CockroachDB, TiKV, Kubernetes (간접) |
| hashicorp/raft (Go) | Consul 발, simplicity 중시 | Consul, Nomad, Vault |
| TiKV Raft (Rust) | etcd-raft 포팅 + Multi-Raft + Joint Consensus 적극 활용 | TiKV, TiDB |
| LogCabin (C++) | Raft 논문 저자의 reference 구현 | 학술 / 참조 |
| Apache Ratis (Java) | Hadoop / Ozone 용 | Apache Ozone, IoTDB |
| Kafka KRaft | metadata 전용 simplified Raft (KIP-500) | Kafka 3.x+ controller |
| MongoDB Raft (변형) | replica set 의 election + oplog | MongoDB 4.0+ |

### 4.1 Kafka KRaft — Raft 의 Kafka 적용

ZooKeeper 의존성을 제거하기 위해 Kafka 3.x 부터 도입된 metadata 합의 layer.

```
[KRaft controllers]  ── metadata log replication ── [KRaft controllers]
        │                                                  │
        │ pull-based                                        │
        ▼                                                  ▼
[Kafka brokers]                                    [Kafka brokers]
  (data plane: Kafka 의 ISR 기반 replication 그대로)
```

차이점:
- **Pull-based**: follower 가 leader 에게 fetch (Kafka 의 일관된 패턴 재활용).
- Metadata 만 합의 — topic / partition / config. Data 는 Kafka 의 기존 ISR (In-Sync Replicas) / HW (High Watermark) 모델.
- Leader epoch ↔ Raft term 매핑.

### 4.2 etcd Raft — 라이브러리 패턴

```go
// 의사 코드 — etcd raft 의 사용 패턴
node := raft.StartNode(config, peers)
for {
    select {
    case rd := <-node.Ready():
        // 1. persist HardState + entries
        // 2. send messages to peers
        // 3. apply committed entries to state machine
        node.Advance()
    case <-tickC:
        node.Tick()
    }
}
```

핵심: **알고리즘과 IO 분리**. Raft 라이브러리는 순수 상태 기계 (입력 → 다음 상태 + 출력 메시지), 네트워크/디스크는 사용자 책임.

---

## §5. Multi-Raft — Sharding 위의 합의

단일 Raft 그룹은 leader bottleneck 으로 throughput 한계. **Multi-Raft = 데이터 partition 별로 별도 Raft group**.

### 5.1 Multi-Raft 구조

```
[Region 1: keys A-M]   [Region 2: keys M-Z]
  Raft group 1            Raft group 2
  Leader: node1           Leader: node2
  Followers: 2,3          Followers: 1,3
```

각 region 마다:
- 자체 leader
- 자체 log
- 자체 commit index

### 5.2 적용 사례

| 시스템 | 단위 | 비고 |
|---|---|---|
| TiKV / TiDB | Region (96MB default) | split / merge 자동 |
| CockroachDB | Range (512MB) | Region 과 거의 동일 개념 |
| YugabyteDB | Tablet | Spanner 영향 |
| Spanner | Tablet | Multi-Paxos (Raft 와 동등) |

### 5.3 challenges

1. **Leader 분포 불균형**: 모든 region 의 leader 가 한 노드에 몰리면 → "leader balancer" 필요.
2. **Cross-region transaction**: 두 region 을 묶는 트랜잭션 → 2PC 또는 Calvin / Spanner 식 timestamp ordering.
3. **Hot region**: 한 key range 에 트래픽 집중 → split / heat-based balancing.
4. **Heartbeat 비용**: region 수만큼 heartbeat → batch / piggyback 으로 감축.

---

## §6. vs Quorum-based Replication (Dynamo / Cassandra)

Raft / Paxos 는 **Strong consistency + Strong leader**. 반면 Dynamo 스타일은 **Leaderless quorum**.

### 6.1 N / W / R 모델

```
N = replica 수
W = write quorum (몇 개 노드에 쓰면 성공)
R = read quorum (몇 개 노드에서 읽으면 성공)

조건: W + R > N    → strong consistency (overlap 보장)
      W + R ≤ N    → eventual consistency
```

예시:
- N=3, W=3, R=1: read 빠름, write 비쌈, leader 없음
- N=3, W=2, R=2: 균형 (Cassandra QUORUM)
- N=3, W=1, R=1: 최고 가용성, eventually consistent

### 6.2 Raft vs Dynamo 비교

| 측면 | Raft | Dynamo (leaderless) |
|---|---|---|
| Consistency | Linearizable (CP) | Tunable (W+R>N 시 strong, 아니면 eventual) |
| Write 경로 | Leader 통과 | 모든 replica 직접 |
| Latency | Leader RTT | 가장 빠른 W 노드 RTT |
| Hot leader | 발생 가능 | 없음 |
| Conflict | 없음 (single leader) | 발생 → CRDT / LWW (Last Write Wins) / vector clock |
| Failover | term 증가 + election | 자동 (read repair / hinted handoff) |
| 사용처 | etcd, Spanner, KRaft | Cassandra, DynamoDB, Riak |

### 6.3 언제 무엇을 쓰는가

| 상황 | 추천 | 이유 |
|---|---|---|
| 메타데이터, config, 락 | Raft / Multi-Paxos | 강한 일관성, write 적음 |
| 멤버십, leader election | Raft | "한 명만 합의" 가 본질 |
| 시계열, 카운터, log | Quorum (eventual) | write 폭발, 느슨한 정합성 OK |
| 사용자 프로필, 카탈로그 | Quorum (W+R>N) | 가용성 우선 + 약한 일관성 허용 |
| 결제 / 주문 상태 | Raft / 2PC | 강한 정합성 필수 |

---

## §7. Byzantine Fault Tolerance — PBFT / Tendermint / HotStuff

### 7.1 Byzantine fault 란

> Crash fault: 노드가 죽거나 응답 안 함 (조용히).
> Byzantine fault: 노드가 **임의의 잘못된 행동** — 거짓 메시지, 메시지 누락, 다른 노드에 다른 답.

원인: 악의적 노드 (블록체인), 메모리 corruption, 버그, 펌웨어 오류.

### 7.2 BFT 의 정족수 — N=3f+1

```
이유 (직관):
  - f 개가 byzantine 일 때 안전하려면 정상 노드만으로 majority 보장 필요
  - N - f 개가 정상이고, 그중 majority = (N-f)/2 + 1
  - byzantine f 개와 dropped f 개가 겹쳐도 무관해야 → N - 2f > f → N > 3f
  - 최소 N = 3f + 1
```

→ 1개 byzantine 허용에 4 노드, 2개에 7 노드, 3개에 10 노드.

### 7.3 PBFT (Castro & Liskov, 1999)

3-phase 프로토콜:

```
Pre-prepare (primary → backups):
  primary 가 client 요청에 sequence number 부여 후 broadcast
Prepare (모든 노드 → 모든 노드):
  pre-prepare 받으면 prepare 메시지 broadcast
  2f+1 개 prepare 모이면 → "prepared" 상태
Commit (모든 노드 → 모든 노드):
  prepared 가 되면 commit broadcast
  2f+1 commit 모이면 → execute + reply
```

Primary 가 byzantine 일 수 있어 **view change** 메커니즘으로 교체. 메시지 복잡도 O(N²).

### 7.4 Tendermint — 블록체인 BFT

PBFT 의 변형 + 블록체인 친화 (Cosmos / Binance Chain).

```
Propose → Prevote → Precommit → Commit
```

특징:
- Round-robin proposer
- 결정론적 finality (확률적 finality 인 비트코인과 다름)
- 네트워크 동기 가정

### 7.5 HotStuff (Yin et al. 2019)

PBFT 의 메시지 복잡도를 O(N²) → **O(N)** 로 개선. Facebook Libra / Diem 채택.

핵심 아이디어:
- **Threshold signature** 사용 — 2f+1 서명을 1개로 압축
- **Linear view change** — view 교체도 O(N)
- **Pipelining** — 단계 간 작업 겹침

### 7.6 BFT 가 왜 msa 에 직접은 안 쓰이는가

- msa 의 모든 노드는 같은 신뢰 도메인 (단일 조직, 동일 코드베이스)
- byzantine 위협보다는 fail-stop / fail-slow 가 현실적
- BFT 는 latency / 비용 모두 비쌈 (N=3f+1 + 메시지 복잡도)

→ BFT 가 필요한 영역: 블록체인, 멀티 조직 컨소시엄, 군사 / 금융 결제망 (RTGS).

---

## §8. msa 에서 합의가 어디 숨어 있는가

msa 는 합의 알고리즘을 **직접 구현하지 않는다**. 그러나 다음 인프라가 합의 위에 서 있다.

### 8.1 합의 위에 선 인프라들

| 컴포넌트 | 합의 알고리즘 | 무엇을 합의하는가 |
|---|---|---|
| Kafka (KRaft mode) | Raft (KIP-500 변형) | 토픽 / 파티션 / config metadata |
| Kafka (legacy) | ZAB (ZooKeeper Atomic Broadcast, Zookeeper 의 Paxos 변형) | 같은 metadata, ZK 통해 |
| etcd (k3d / k8s control plane) | Raft (etcd-raft) | k8s 의 모든 리소스 상태 |
| Strimzi Kafka Operator | etcd 위 (k8s CRD 통해) | Kafka 클러스터 spec / status |
| Redis Sentinel | Raft 변형 (failover quorum) | 누가 master 인가 |
| MySQL Group Replication | Paxos 변형 (XCom) | binlog 순서 |
| Spring Cloud Eureka (없어진 의존성, ADR-0019 Phase 1b) | (합의 없음 — eventual) | 서비스 인스턴스 |

> ADR-0019 Phase 1b 에서 Eureka 가 제거됨 (`/Users/gideok-kwon/IdeaProjects/msa/docs/adr/ADR-0019-k8s-migration.md`). msa 는 이제 **k8s service discovery → CoreDNS → etcd Raft** 의 라인 위에서 서비스 발견을 한다.

### 8.2 msa 토폴로지에서 Raft 의 위치

```
┌─────────────────────────────────────────────────────────┐
│ User                                                     │
└────────────┬────────────────────────────────────────────┘
             │
       ┌─────▼─────┐
       │  Gateway  │  ← K8s Service / CoreDNS (etcd Raft 위)
       └─────┬─────┘
             │
   ┌─────────┴──────────┬─────────────────────┐
   │                    │                     │
┌──▼──┐             ┌───▼───┐            ┌────▼────┐
│order│             │product│            │inventory│
└──┬──┘             └───┬───┘            └────┬────┘
   │ Kafka             │ Kafka              │ Kafka
   └────────┬──────────┴────────┬───────────┘
            │                   │
        ┌───▼───┐          ┌────▼─────┐
        │ Kafka │          │ MySQL    │
        │(KRaft)│          │(Replica) │
        └───┬───┘          └──────────┘
            │
    metadata Raft 합의
   (controller quorum)
```

### 8.3 직접 사용 가능했지만 안 쓰는 영역

| 영역 | 합의가 풀 수 있었음 | msa 의 선택 |
|---|---|---|
| 분산 락 | etcd / ZK 로 강한 락 | Redis Redlock / `@Transactional` 비관적 락 (ADR-0015) |
| Idempotency 키 저장 | etcd 로 강한 일관성 | DB `processed_event` 테이블 (ADR-0029) — local TX 로 충분 |
| Saga state | etcd / Temporal | DB + Outbox (ADR-0011) — 단일 서비스 내 ACID |
| Leader election (배치 단일 실행) | etcd lease | (현재 미적용 — `@Scheduled` 가 모든 인스턴스에서 실행됨, 개선 후보) |

→ **합의는 비싸다**. 단일 서비스 내 ACID 가 가능하면 합의 없이 풀고, 인프라가 이미 합의를 제공하면 (Kafka / etcd) 그 위에 올라타는 게 msa 의 일관된 패턴이다.

### 8.4 ADR-0019 Phase 6 의 K8s 전환 = etcd Raft 의 도입

`docs/adr/ADR-0019-k8s-migration.md` 의 Phase 1b ~ Phase 6 흐름:

1. Phase 1b: Eureka 제거 → K8s service discovery 로 전환
2. Phase 2~5: Jib + StatefulSet + Operator
3. Phase 6: `docker compose` 경로 제거

→ msa 의 메타데이터 (서비스 등록 / 위치 / 헬스) 는 **etcd Raft 의 단일 합의 그룹** 위로 이동했다. CoreDNS, kube-proxy, kubelet 모두 etcd 의 watch API 를 통해 일관된 상태를 본다.

---

## §9. 함정 — 합의 도입 시 흔한 실수

### 9.1 "그냥 ZK / etcd 쓰면 되겠지"

**문제**: 합의는 latency 비쌈 (수 ms ~ 수십 ms / 결정). hot path 에 넣으면 throughput 폭락.

**해법**:
- 합의는 **메타데이터 / 드물게 변하는 상태** 에만.
- 데이터 plane 은 합의 밖 (Kafka data 는 ISR, Redis 데이터는 master-replica).

### 9.2 클러스터 크기 잘못 잡기

| 노드 수 | majority | f-tolerance | 비고 |
|---|---|---|---|
| 3 | 2 | 1 | 작은 클러스터 표준 |
| 5 | 3 | 2 | sweet spot |
| 7 | 4 | 3 | latency ↑, 별 이득 없음 |
| 짝수 | 권장 X | — | tie breaker 필요 |

### 9.3 Cross-DC Raft 의 latency

DC 간 RTT 가 수십 ~ 수백 ms 인데 모든 write 가 Raft majority 를 거치면 → 사용자 latency 폭발.

**해법**:
- Witness / arbiter 노드 (data 없이 vote 만)
- DC-local read (lease read)
- Multi-Raft + region affinity

### 9.4 Membership change 동안의 split

joint consensus 없이 한 번에 노드 추가/제거 시 split-brain 가능. Raft 는 명시적으로 풀었지만, 직접 구현 시 흔한 버그.

### 9.5 Snapshot 누락 → log 무한 증가

Snapshot 안 찍으면 log 가 디스크를 가득 채워 노드가 죽음. 새 follower 도 log 만으로 따라잡을 수 없을 때까지 지연.

### 9.6 "Dynamo 의 W+R>N 이면 linearizable" 오해

W + R > N 은 **read 가 최신 write 를 본다는 보장** 일 뿐, **linearizable 이 아니다**. 두 client 의 write 순서가 뒤집혀 보일 수 있음. 진짜 linearizable 하려면 sync replication + read-after-write 보장 메커니즘 (read repair + version) 필요.

### 9.7 BFT 가 fail-stop 도 막아주지 않음

BFT 는 byzantine 을 막지만, **liveness 조건은 동기성 가정** 에 의존. 네트워크가 분리되면 진행 불가 (CP 그 자체).

---

## §10. 면접 5문답

### Q1. "FLP impossibility 가 뭐고 Raft 는 어떻게 우회하나요?"

> FLP 는 비동기 시스템 + 1 fail-stop 환경에서 결정론적 합의가 불가능하다는 정리. 노드가 죽었는지, 단지 메시지가 늦은지 비동기에선 구분 못 하므로 영원히 결정 못 하는 schedule 이 존재. Raft 는 partial synchrony 가정 (메시지 지연 상한 있음) + **무작위 election timeout** 으로 split vote 확률을 지수적으로 감소시켜 우회. 이론적으로 영원히 hang 가능하지만 확률이 0 에 수렴.

### Q2. "Paxos 와 Raft 의 본질적 차이는?"

> 안전성은 동등 — 둘 다 majority quorum 기반. 차이는 **명시성**. Paxos 는 leader election 이 알고리즘에 명시되지 않고 dueling proposers 가능. Raft 는 강한 leader 를 명시적으로 도입하고 election + log replication + safety 를 분리해 추론을 쉽게 함. Multi-Paxos 의 stable leader 최적화는 사실상 Raft 의 leader 와 같지만, 표현과 구현 가이드가 명확.

### Q3. "Multi-Raft 가 왜 필요한가요?"

> 단일 Raft 그룹은 leader bottleneck — 모든 write 가 한 노드 거침. throughput / cluster 크기 한계. Multi-Raft 는 데이터를 partition / region 단위로 나눠 각각 별도 Raft group 운영. TiKV, CockroachDB, YugabyteDB 가 채택. 트레이드오프는 cross-region transaction 비용 (2PC 또는 Calvin/Spanner 식 timestamp ordering) 과 leader balancer 운영.

### Q4. "Quorum 기반 (Dynamo) 과 Raft 의 차이는?"

> Raft 는 strong leader + linearizable, write 가 leader 를 통과 (CP). Dynamo 는 leaderless, W+R>N 으로 strong consistency 를 tunable 하게 제공 — write 는 가장 빠른 W 노드로 끝나 latency 낮음 (AP 지향). 충돌 처리도 다름: Raft 는 single leader 라 충돌 없음, Dynamo 는 vector clock / CRDT / LWW 로 사후 해결. 메타데이터엔 Raft, 카탈로그/카운터엔 Dynamo 가 적합.

### Q5. "msa 가 Raft 를 직접 안 쓰는 이유는?"

> 합의는 비싸다 — latency 수 ms, throughput 제한. msa 는 단일 서비스 내 ACID (DB local TX) 가 가능하면 그쪽으로 풀고, 분산 정합성은 Saga + Outbox 로 eventual consistency 로 해결. 인프라 (Kafka KRaft, etcd, Redis Sentinel) 가 이미 Raft / 변형을 내부 제공하므로 그 위에 올라타는 식. 직접 Raft 를 짤 만한 영역 (분산 락 / leader election / state machine 복제) 은 msa 규모에선 etcd / Redis 로 충분.

---

## §11. 한 줄 요약 + 더 읽기

> **합의는 메타데이터 전용 — 데이터 plane 에는 절대 넣지 마라.**
> Raft = (Leader Election + Log Replication + 5개 Safety invariant) 로 분해 가능.
> msa 는 합의를 직접 안 짜고 Kafka KRaft / etcd Raft 위에서 산다.
> Multi-Raft 가 throughput 문제를 풀고, BFT 는 신뢰 경계가 다른 영역 (블록체인) 에서만.

### 더 읽기

- Lamport, "The Part-Time Parliament" (1998) — 원조 Paxos
- Lamport, "Paxos Made Simple" (2001) — 같은 알고리즘 재설명
- Ongaro & Ousterhout, "In Search of an Understandable Consensus Algorithm" (USENIX 2014) — Raft 원논문
- Ongaro 박사학위 논문 (2014) — Raft 의 모든 디테일 + membership change + log compaction
- Fischer, Lynch, Paterson, "Impossibility of Distributed Consensus with One Faulty Process" (1985) — FLP 원논문
- Castro & Liskov, "Practical Byzantine Fault Tolerance" (OSDI 1999) — PBFT
- Yin et al., "HotStuff: BFT Consensus in the Lens of Blockchain" (PODC 2019) — 선형 BFT
- Kleppmann, "Designing Data-Intensive Applications", Ch.9 (Consistency and Consensus)
- Raft 시각화: https://raft.github.io/
- Kafka KRaft (KIP-500): https://cwiki.apache.org/confluence/display/KAFKA/KIP-500
- etcd Raft 라이브러리: https://github.com/etcd-io/raft

### Cross-ref

- 02-cap-pacelc-flp.md — FLP 의 입문
- 04-replica-quorum.md — Quorum 기반 replication
- 05-clocks-ordering.md — Lamport / Vector / HLC clock
- 06-paxos-raft.md — Raft / Paxos 입문 (본 문서의 전제)
- 07-2pc-3pc.md — 2PC / 3PC vs 합의
