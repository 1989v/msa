---
parent: 14-crdt-mrdt
seq: 04
title: Counter CRDT — G-Counter · PN-Counter · Bounded Counter
type: deep
created: 2026-05-01
---

# 04. Counter CRDT

가장 단순한 CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입). **분산 카운터** — 여러 replica 가 동시에 increment/decrement 하면서 정확한 합계로 수렴.

## 단순 카운터의 문제

먼저 *왜 단순 카운터는 안 되는가* 부터.

```kotlin
// 단순 카운터 — 깨짐
data class NaiveCounter(val n: Long)
fun merge(a: NaiveCounter, b: NaiveCounter): NaiveCounter {
    return NaiveCounter(a.n + b.n)   // ✗
}
```

```
Replica A: increment → n=1, broadcast
Replica B: increment → n=1, broadcast

A 가 B 의 state 받음 → merge(1, 1) = 2  (정상)
B 가 A 의 state 받음 → merge(1, 1) = 2  (정상)

이제 A 가 자기 state 다시 받으면? merge(2, 1) = 3  ✗ idempotent 깨짐
```

idempotent 가 깨지면 같은 메시지 두 번 받을 때 카운터가 폭주. **이것이 G-Counter 가 per-replica 분리를 쓰는 이유**.

## G-Counter (Grow-only Counter)

각 replica 가 *자기 카운터만* 증가시키고, merge 는 max.

### 정의

```
state: Map<ReplicaId, Long>  (각 replica 가 발행한 increment 수)
update.increment(self): self 의 entry +1
merge(a, b): 각 replica 별 max
value: 모든 entry 의 합
```

### Kotlin 구현

```kotlin
data class GCounter(val counts: Map<String, Long> = emptyMap()) {

    fun increment(self: String, by: Long = 1): GCounter {
        require(by > 0) { "G-Counter only grows" }
        val current = counts[self] ?: 0L
        return GCounter(counts + (self to current + by))
    }

    fun merge(other: GCounter): GCounter {
        val ids = counts.keys + other.counts.keys
        val merged = ids.associateWith { id ->
            maxOf(counts[id] ?: 0L, other.counts[id] ?: 0L)
        }
        return GCounter(merged)
    }

    fun value(): Long = counts.values.sum()
}
```

### 시나리오

```
초기 (모든 replica 가 ⊥):
  A: {}      B: {}      C: {}

A.increment("A") → A: {A: 1}
A.increment("A") → A: {A: 2}
B.increment("B") → B: {B: 1}

A 와 B 가 sync:
  A.merge(B) = {A: 2, B: 1}    value = 3
  B.merge(A) = {A: 2, B: 1}    value = 3

C.increment("C") → C: {C: 1}
C 가 A sync:
  C.merge(A) = {A: 2, B: 1, C: 1}   value = 4
  ↑ B 의 increment 가 A 를 통해 전파됨

A 가 자기 state 두 번 받아도 (idempotent):
  A.merge(A) = {A: 2, B: 1}   변화 없음
```

### 왜 max 인가?

**idempotent 보장**. `max(a, a) = a`. 같은 메시지가 두 번 와도 안전.

만약 sum 으로 했다면 — `merge(a, b) = a + b` — `merge(a, a) = 2a` 로 폭주.

### Semilattice 검증

```
merge 가 ACI 인가?
  - associative: max(max(a,b), c) = max(a, max(b,c))  ✓ (자연수 max 의 성질)
  - commutative: max(a, b) = max(b, a)                ✓
  - idempotent: max(a, a) = a                         ✓
```

각 replica entry 별로 ACI → 전체 Map 도 ACI. 따라서 G-Counter 는 join semilattice.

## PN-Counter (Positive-Negative Counter)

G-Counter 의 한계: **decrement 불가**. 빼기를 추가하려면? 답은 **양수 카운터 + 음수 카운터**.

### 정의

```
state: (P: G-Counter, N: G-Counter)
increment(self): P[self] +1
decrement(self): N[self] +1
value: P.value() - N.value()
merge: P 와 N 각각 G-Counter 처럼
```

### Kotlin 구현

```kotlin
data class PNCounter(
    val pos: GCounter = GCounter(),
    val neg: GCounter = GCounter()
) {
    fun increment(self: String, by: Long = 1): PNCounter =
        copy(pos = pos.increment(self, by))

    fun decrement(self: String, by: Long = 1): PNCounter =
        copy(neg = neg.increment(self, by))

    fun merge(other: PNCounter): PNCounter =
        PNCounter(pos.merge(other.pos), neg.merge(other.neg))

    fun value(): Long = pos.value() - neg.value()
}
```

### 시나리오

```
A.increment("A") → A: P{A:1}, N{}     value = 1
A.decrement("A") → A: P{A:1}, N{A:1}  value = 0
B.increment("B") → B: P{B:1}, N{}     value = 1

A.merge(B) = (P{A:1,B:1}, N{A:1})    value = 1
```

### 주의: decrement 의 의미 보존

`decrement` 는 *순수히 새 음수 increment* 다. 이전 positive 를 *취소* 하는 것이 아님.

```
A: increment, increment, decrement → P{A:2}, N{A:1} → value=1

이건 "+2 후 -1" 의 history 가 보존된 결과.
```

## Bounded Counter

PN-Counter 의 한계: 음수 또는 상한 초과 가능. 예) 재고 (음수 안 됨), 무료 사용량 (상한 있음).

### 단순 접근의 문제

```kotlin
// Naive: increment 시 상한 검사
fun increment(self: String, max: Long): PNCounter? {
    if (value() >= max) return null  // ✗ — local view 만 봄
    return ...
}
```

문제: replica 별 local view 가 전체 view 와 다름. A 와 B 가 동시에 검사 통과 후 increment → 합치면 상한 초과.

### Escrow / Reservation 패턴

[Balegas et al. 2015 "Putting Consistency back into Eventual Consistency"](https://hal.inria.fr/hal-01103053) 의 escrow 모델.

```
초기 상한 100, 노드 3개:
  - 각 노드에 33 씩 reservation 분배

A 가 increment:
  - A 의 reservation 에서 차감
  - A 의 reservation 0 → A 는 더 이상 increment 불가
  - 다른 노드와 협상해 reservation 이전 (sync 필요)
```

### 트레이드오프

- 강한 상한 보장 vs eventual 운영 — 트레이드오프 불가피
- **rights transfer** 가 필요한 순간 strong consistency 등장
- 실 시스템은 *느슨한 상한* (soft cap) + 사후 보정 으로 타협

## Counter CRDT 가 가진 정보

```
G-Counter / PN-Counter 가 잃지 않는 것:
  ✓ 각 replica 가 발행한 increment 수
  ✓ 모든 increment 의 합
  ✓ idempotent (재전송 안전)

잃는 것:
  ✗ increment 의 시간 순서 (LWW 와 비슷)
  ✗ decrement 후 increment 의 의도 (모두 누적)
```

decrement 는 cancel 이 아니라 *새로운 음수 op*. 이 의미를 잘못 이해하면 버그.

## 트레이드오프 박스

| 측면 | G-Counter | PN-Counter | Bounded Counter |
|---|---|---|---|
| 연산 | inc only | inc, dec | inc, dec + 상한 |
| state 크기 | O(replica 수) | 2× G-Counter | + reservation |
| 가용성 | 무한 | 무한 | reservation 소진 시 차단 |
| 복잡도 | 낮음 | 낮음 | 높음 (escrow) |

## msa 적용 검토

[17-msa-application.md](17-msa-application.md) 에서 자세히 다루지만 미리 결론:

```
analytics.PV/UV  — 현재 ClickHouse 단일 region. 단일 노드면 그냥 SUM.
                   multi-region active-active 시 PN-Counter 후보.

analytics.likes — 좋아요 수. multi-region 시 PN-Counter (좋아요 취소 가능).

product.stock — 재고. Bounded Counter. 강한 상한 필요 → CRDT 보다 Saga + Reservation 패턴이 일반적.

quant.pnl — 손익. 정확성 매우 중요 → CRDT 부적합. single-master 유지.
```

**현 msa 결론**: 단일 region 이라 G/PN-Counter 도 불필요. ADR-0019 가 multi-region 으로 확장될 때 재검토.

## 면접 포인트

- **"분산 카운터를 만들라면?"** — G-Counter. 각 replica 가 자기 entry 만 증가, merge 는 max, value 는 sum. naive sum-merge 는 idempotent 깨져 폭주.
- **"PN-Counter 가 G-Counter 두 개인 이유?"** — 단일 G-Counter 로는 decrement 표현 불가 (monotonic 깨짐). 양수/음수 분리하면 둘 다 grow-only 유지.
- **"재고 카운터로 PN-Counter 충분?"** — 부족. Bounded Counter / Escrow 필요. 또는 그냥 single-master + Saga 가 현실적.
- **"replica 1만개면 G-Counter state 크기?"** — 1만 entry. delta-CRDT 로 변경분만 전송 가능. 또는 hierarchical (region 단위 aggregation).

## 다음 학습

- [05-set-crdts.md](05-set-crdts.md) — Set CRDT, OR-Set 의 unique tag 트릭
- [11-delta-crdt.md](11-delta-crdt.md) — Counter state 의 변경분만 전송하는 법
