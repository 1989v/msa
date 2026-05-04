---
parent: 14-crdt-mrdt
seq: 03
title: CvRDT vs CmRDT — state-based 와 op-based 의 차이
type: deep
created: 2026-05-01
---

# 03. CvRDT vs CmRDT

## 두 패러다임의 차이

CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입) 는 두 방식으로 정의된다 — **state 를 주고받느냐, op 를 주고받느냐**.

```
CvRDT (state-based)              CmRDT (op-based)
─────────────────                ─────────────────
local update                     local update
   ↓                                ↓
state' = update(state, op)       state' = effect(state, op)
   ↓                                ↓
broadcast state                  broadcast op
   ↓                                ↓
remote: merge(local, state)      remote: effect(state, op)
```

## CvRDT (Convergent / state-based)

### 동작 흐름

```kotlin
// 의사 코드 — G-Counter
class CvGCounter(val counts: Map<ReplicaId, Long>) {
    fun increment(self: ReplicaId): CvGCounter =
        CvGCounter(counts + (self to (counts[self] ?: 0) + 1))

    fun merge(other: CvGCounter): CvGCounter {
        val merged = (counts.keys + other.counts.keys).associateWith { id ->
            maxOf(counts[id] ?: 0L, other.counts[id] ?: 0L)
        }
        return CvGCounter(merged)
    }

    fun value(): Long = counts.values.sum()
}

// 사용:
var local = CvGCounter(emptyMap())
local = local.increment("A")    // 로컬 변경
broadcast(local)                // 전체 state 송신

// 수신측:
fun onReceive(remote: CvGCounter) {
    local = local.merge(remote)
}
```

### 특징

- **broadcast 는 eventual** — 메시지 손실/중복 OK (idempotent merge)
- **gossip 친화적** — 주기적으로 random peer 에게 state 전송
- **단점**: state 자체가 크면 전송량 폭증
  - G-Counter: replica 수만큼 entry → 100 노드 = 100 entry
  - OR-Set: 원소 수 × tag 수
- **delta-CRDT** 가 이 문제의 해 — state 의 *변경분* 만 전송

## CmRDT (Commutative / op-based)

### 동작 흐름

```kotlin
// 의사 코드 — Op-based G-Counter
class OpGCounter(val counts: Map<ReplicaId, Long>) {
    sealed interface Op
    data class Increment(val replicaId: ReplicaId) : Op

    fun prepare(self: ReplicaId): Op = Increment(self)

    fun effect(op: Op): OpGCounter = when (op) {
        is Increment -> OpGCounter(counts + (op.replicaId to (counts[op.replicaId] ?: 0) + 1))
    }

    fun value(): Long = counts.values.sum()
}

// 사용:
val op = local.prepare("A")
local = local.effect(op)
reliableBroadcast(op)   // ← reliable, exactly-once 또는 idempotent

// 수신측:
fun onReceive(op: Op) {
    local = local.effect(op)
}
```

### 특징

- **reliable causal broadcast 필수** — op 도착 순서가 인과 일관성 보장
- **op 만 전송** — 전송량 작음
- **단점**:
  - exactly-once delivery 는 분산 시스템 hard problem — 보통 idempotent op 로 우회
  - 중복 처리 위험 — Increment 가 두 번 들어오면 카운터 폭주
  - causal context (vector clock) 가 message 마다 필요할 수 있음

### causal delivery 의 의미

```
Replica A 이벤트:
  e1: add("apple")
  e2: remove("apple")  (e1 이후)

Replica B 가 e2 먼저 받고 e1 나중에 받으면 → "apple" 이 살아있음 ✗
```

A 가 e1, e2 을 같은 순서로 (causal order) 보냈는데도 네트워크가 reorder 하면 깨진다. 그래서 op-based CRDT 는 **causal broadcast layer** 가 필요 — vector clock 을 써서 "e1 이전 모든 op 받기 전엔 e2 적용 보류".

## 동등성 (CvRDT ↔ CmRDT)

Shapiro et al. 2011 은 **두 정의가 등가** 임을 증명했다.

- CvRDT 가 있으면 그 update 함수를 op 로 packing 해서 CmRDT 만들기 가능
- CmRDT 가 있으면 op set 을 누적하는 state 로 CvRDT 만들기 가능 (단, GC 필요)

```
CvRDT (G-Counter)
  state = {A: 3, B: 2}
       ↕ 등가
CmRDT (Op G-Counter)
  ops = [Inc(A), Inc(A), Inc(A), Inc(B), Inc(B)]
  state = ops 를 fold 한 결과
```

## 비교 표

| 측면 | CvRDT | CmRDT |
|---|---|---|
| 전송 단위 | 전체 state (또는 delta) | op |
| 전송량 (naive) | 큼 | 작음 |
| 전송량 (optimized) | delta-CRDT 로 작아짐 | 변화 없음 |
| 전달 보장 | eventual gossip | causal reliable broadcast |
| 중복 처리 | idempotent merge → 무관 | exactly-once 또는 idempotent op |
| 새 replica 합류 | state full sync 한 번 | op 처음부터 replay or state snapshot |
| 구현 핵심 | merge 함수 | broadcast layer |
| 사용처 | Riak DT (gossip), Redis CRDB | Yjs, Automerge (causal vector) |

## 실제 시스템의 선택

```
CvRDT 채택:
  - Riak DT — 노드 간 gossip 으로 state sync
  - Redis CRDB (Enterprise) — 지역 간 anti-entropy
  - delta-CRDT 로 전송량 압축

CmRDT 채택:
  - Yjs — 협업 에디터, op (insertion/deletion) 의 vector clock
  - Automerge — op 의 causal history 보존, document = 모든 op 의 함수
  - WebSocket 기반 실시간 sync

Hybrid:
  - 평소엔 op-based (실시간), 새 replica 합류 시 state snapshot 한 번
```

## 어떻게 고르는가?

```
질문                                         → 선택
────────                                       ─────
1. 메시지 인프라가 reliable + causal 인가?    → 예: CmRDT, 아니오: CvRDT
2. state 크기가 폭증할 위험?                  → 예: CvRDT + delta, 아니오: 어느 쪽이든
3. 새 replica 가 자주 합류?                   → CvRDT 가 자연 (state snapshot)
4. op 가 idempotent?                        → CmRDT 도 OK
5. 전체 op log 보존이 부담?                  → CvRDT 가 GC 단순
```

## 코드 예시: 둘 다 동작하는 PN-Counter

PN-Counter (양수/음수 분리, 아래 [04 참고](04-counter-crdts.md)) 를 두 방식으로 구현해 비교.

### CvRDT 버전

```kotlin
data class CvPNCounter(
    val pos: Map<String, Long> = emptyMap(),
    val neg: Map<String, Long> = emptyMap()
) {
    fun inc(self: String): CvPNCounter =
        copy(pos = pos + (self to (pos[self] ?: 0) + 1))

    fun dec(self: String): CvPNCounter =
        copy(neg = neg + (self to (neg[self] ?: 0) + 1))

    fun merge(other: CvPNCounter): CvPNCounter {
        fun mergeMap(a: Map<String, Long>, b: Map<String, Long>) =
            (a.keys + b.keys).associateWith { maxOf(a[it] ?: 0, b[it] ?: 0) }
        return CvPNCounter(mergeMap(pos, other.pos), mergeMap(neg, other.neg))
    }

    fun value(): Long = pos.values.sum() - neg.values.sum()
}
```

### CmRDT 버전

```kotlin
data class OpPNCounter(
    val pos: Map<String, Long> = emptyMap(),
    val neg: Map<String, Long> = emptyMap()
) {
    sealed interface Op { val replicaId: String }
    data class Inc(override val replicaId: String) : Op
    data class Dec(override val replicaId: String) : Op

    fun prepareInc(self: String): Op = Inc(self)
    fun prepareDec(self: String): Op = Dec(self)

    fun effect(op: Op): OpPNCounter = when (op) {
        is Inc -> copy(pos = pos + (op.replicaId to (pos[op.replicaId] ?: 0) + 1))
        is Dec -> copy(neg = neg + (op.replicaId to (neg[op.replicaId] ?: 0) + 1))
    }

    fun value(): Long = pos.values.sum() - neg.values.sum()
}
```

**비교**:
- CvRDT — peer 가 매번 전체 `(pos, neg)` 송신, merge 가 max
- CmRDT — peer 가 op 하나만 송신, 단 reliable causal broadcast 필요

## 트레이드오프 박스

```
┌─────────────────────────────────────────────────┐
│  CvRDT 가 유리한 경우                           │
│  ─────────────────                              │
│  • 메시지 인프라가 unreliable/eventual          │
│  • op 가 idempotent 하지 않음                   │
│  • 새 replica 가 자주 합류                      │
│  • delta-CRDT 로 전송량 최적화 가능             │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  CmRDT 가 유리한 경우                           │
│  ─────────────────                              │
│  • 메시지 인프라가 reliable + causal (Kafka 등) │
│  • state 가 크고 op 가 작음                     │
│  • 협업 에디터처럼 실시간성 중요                │
│  • 정확한 변경 의도 보존 필요                   │
└─────────────────────────────────────────────────┘
```

## 면접 포인트

- **"CvRDT 와 CmRDT 의 차이는?"** — 전송 단위. state 를 주고 받느냐 (CvRDT, gossip 친화), op 를 주고 받느냐 (CmRDT, reliable causal broadcast 필요).
- **"왜 둘이 등가인데 둘 다 쓰나?"** — 운영 환경 차이. 메시지 인프라 reliability, state 크기, op 빈도에 따라 한 쪽이 자연스럽다.
- **"Kafka 위에 CRDT 올린다면 어느 쪽?"** — Kafka 는 partition 내 ordering + at-least-once. exactly-once 는 transactional API 또는 idempotent consumer. op-based 가 자연스럽지만 idempotent op 강제가 필요.
- **"새 replica 가 합류했을 때?"** — CvRDT 는 state full sync 한 번. CmRDT 는 처음부터 op 모두 replay (불가능) 하니 보통 state snapshot + 이후 op stream.

## 다음 학습

- [04-counter-crdts.md](04-counter-crdts.md) — 가장 단순한 CRDT 부터 손으로 검증
- [10-causal-context.md](10-causal-context.md) — CmRDT 의 causal delivery 가 정확히 어떻게 동작하는지
- [11-delta-crdt.md](11-delta-crdt.md) — CvRDT 의 전송량 폭증 해결책
