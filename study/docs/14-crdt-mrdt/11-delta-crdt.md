---
parent: 14-crdt-mrdt
seq: 11
title: Delta-CRDT · Anti-Entropy — state 전송량 폭증 해결
type: deep
created: 2026-05-01
---

# 11. Delta-CRDT · Anti-Entropy

CvRDT 의 가장 큰 운영 문제: **state 가 크면 매번 전체 전송이 부담**. Delta-CRDT 는 변경분만 전송하는 우아한 해결책.

## 동기

```
G-Counter, replica 1만 개:
  state = Map<replicaId, Long>   → 1만 entry
  매 sync 마다 1만 entry 전송 ✗

OR-Set, 100만 element:
  state = ... × 100만
  매 sync 마다 100만 entry 전송 ✗
```

CmRDT 는 op 만 전송 → 작음. 하지만 *reliable causal delivery* 가 필요. CvRDT 의 단순함은 유지하면서 전송량 줄이고 싶다.

## Delta-state CRDT (van der Linde et al. 2016)

### 핵심 아이디어

```
일반 CvRDT:
  update(state, op) → state'
  broadcast(state')

Delta CvRDT:
  update(state, op) → (state', delta)
  broadcast(delta)            ← 변경분만 전송
  remote: state ⊔ delta       ← merge

즉: "delta 도 작은 CRDT state 라서 join 가능"
```

### Delta 의 정식 정의

```
δ : S × U → S    (delta-mutator)
  - update(s, u) ≤ s' = s ⊔ δ(s, u)
  - δ(s, u) 만 broadcast 해도 모든 replica 가 같은 결과로 수렴
```

즉 delta 는 *update 의 효과를 표현하는 작은 state* — semilattice 의 element.

### 예: Delta G-Counter

```kotlin
data class GCounter(val counts: Map<String, Long> = emptyMap()) {
    fun merge(other: GCounter) = GCounter(
        (counts.keys + other.counts.keys).associateWith {
            maxOf(counts[it] ?: 0, other.counts[it] ?: 0)
        }
    )
}

class DeltaGCounter(val replicaId: String) {
    private var state = GCounter()

    fun increment(): GCounter {
        val newCount = (state.counts[replicaId] ?: 0L) + 1
        state = state.copy(counts = state.counts + (replicaId to newCount))

        // delta = "내 entry 만 들어있는 G-Counter"
        return GCounter(mapOf(replicaId to newCount))
    }

    fun merge(delta: GCounter) {
        state = state.merge(delta)
    }

    fun value(): Long = state.counts.values.sum()
}
```

### 시나리오

```
A.increment() → delta = {A: 1}
A.increment() → delta = {A: 2}
A.increment() → delta = {A: 3}

A 가 B 에게 delta 전송 (3 번):
  → 1번 sync 마다 1 entry → 매우 작음

B 가 받아 누적 merge:
  state = {} → {A:1} → {A:2} → {A:3}
```

각 sync 가 *전체 state 가 아닌 변경분*만 전송 → 통신량 폭감.

## Delta-Interval 과 Anti-Entropy

Delta 만 보내면 손실 시 영구 분기 위험. **Anti-Entropy** 가 필요.

```
정기적으로 (예: 1초):
  random peer 선택
  서로 last-seen sequence 교환
  gap 있으면 missing delta 재전송
```

이는 Riak / Cassandra 의 anti-entropy 와 동일 개념. Delta-CRDT + anti-entropy = Riak DT 의 운영 모델.

### Delta Buffer

```
DeltaBuffer:
  buffer: List<(seq, delta)>   ← 발행한 delta 와 sequence
  sentTo: Map<peer, seq>       ← 각 peer 가 마지막으로 받은 seq

전송:
  peer 의 lastSeq 보다 큰 delta 만 전송

GC:
  모든 peer 가 받은 seq 까지의 delta 는 buffer 에서 제거
```

## Delta vs Op 의 차이

```
CmRDT op:
  - 하나의 변경을 표현
  - causal context 필요
  - exactly-once 또는 idempotent 필요

Delta:
  - 여러 변경의 누적도 표현 가능 (idempotent)
  - causal context 불필요 (state 의 부분집합)
  - 중복 전송 OK (idempotent)
```

**Delta = state-based 의 op-based 변환**. CmRDT 의 가벼움 + CvRDT 의 단순함.

## Delta Compression

여러 delta 를 합쳐 더 작은 delta 로 압축 가능 (delta 가 semilattice 원소이므로).

```
delta1 = {A: 1}
delta2 = {A: 2}
delta3 = {A: 3}

compressed = delta1 ⊔ delta2 ⊔ delta3 = {A: 3}

→ peer 에 1번만 전송
```

특히 *high-frequency replica* 가 자주 발행할 때 유용.

## Delta-OR-Set 예시

OR-Set 의 delta 도 비슷.

```
state: ORSet (dotstore + ctx)

add(v):
  새 dot d
  delta = ORSet(dotstore={d → v}, ctx={d})

remove(v):
  toKill = { d | dotstore[d] = v }
  delta = ORSet(dotstore={}, ctx=toKill)   ← 죽이는 dot 만 ctx 에

merge(state, delta):
  state.dotstore += delta.dotstore (단, ctx 에 있고 dotstore 에 없는 건 제거)
  state.ctx += delta.ctx
```

핵심: delta 도 OR-Set 의 *부분 state* 이며 그 자체로 merge 가능.

## Anti-Entropy + Direct Delivery

```
구성:
  1. 직접 broadcast: increment 발생 시 즉시 random peer 에 delta 전송
  2. anti-entropy: 1초마다 random peer 와 gap 확인 + missing delta 재전송
  3. 신규 replica: 합류 시 full state 한 번 받음

장점:
  - 일반 운영은 작은 delta 로 빠른 sync
  - 메시지 손실 시 anti-entropy 가 재전송
  - 새 replica 도 빠르게 catch up
```

## 트레이드오프 박스

| 측면 | 일반 CvRDT | Delta-CRDT | CmRDT |
|---|---|---|---|
| 전송량 | 큼 (state 전체) | 작음 (delta) | 작음 (op) |
| 인프라 요구 | gossip OK | gossip OK | reliable causal |
| GC | state 단순 | delta buffer GC 필요 | op log GC 필요 |
| 새 replica | full state | full state + delta stream | snapshot + op stream |
| 구현 난이도 | 낮음 | 중간 | 높음 |

## 실 시스템

### Riak DT (Delta CRDT)
- Riak 2.0+ 에서 delta-CRDT 채택
- anti-entropy 로 long-running consistency

### Akka Distributed Data
- delta-CRDT 기반 분산 데이터
- gossip 기반 propagation

### Microsoft 의 Azure Cosmos DB
- multi-master 모드에서 CRDT 사용 (일부 정책)
- 자세한 알고리즘 비공개

## msa 적용 검토

현 msa 는 single-region — delta-CRDT 도 불필요. 다만:

```
Kafka topic-partition 의 replication ↔ 본질적으로 ISR (in-sync replica)
  → CRDT 와 다른 모델 (leader-follower)

Redis cluster ↔ master-replica + sentinel
  → CRDT 가 아님

만약 multi-region active-active Redis 를 도입한다면?
  → Redis Enterprise CRDB 가 delta-CRDT 사용
```

[16-real-systems.md](16-real-systems.md) 에서 더 자세히.

## 면접 포인트

- **"CvRDT 의 transmit 비용 문제 해결?"** — delta-CRDT. update 시 변경분 (delta) 만 broadcast. delta 자체가 작은 CRDT state 라 join 으로 merge.
- **"delta 가 op 와 다른 점?"** — delta 는 *상태의 부분집합* (idempotent merge). op 는 *변경 행위* (보통 idempotent 아님). delta 는 중복 전송에 강하고 causal context 도 불필요.
- **"delta 만 보내다 메시지 잃으면?"** — anti-entropy. 정기적으로 peer 와 last-seen seq 교환, gap 있으면 missing delta 재전송. eventual recovery.
- **"새 replica 가 합류하면?"** — full state snapshot 한 번 + 이후 delta stream. 두 번째부터는 delta 만으로 catch up.

## 다음 학습

- [12-garbage-collection.md](12-garbage-collection.md) — delta buffer 와 ctx GC
- [16-real-systems.md](16-real-systems.md) — Riak / Redis CRDB 의 anti-entropy 운영
