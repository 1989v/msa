---
parent: 14-crdt-mrdt
seq: 02
title: Strong Eventual Consistency · Semilattice · 수렴 증명 직관
type: deep
created: 2026-05-01
---

# 02. SEC · Semilattice — CRDT 수렴의 핵심 이론

## Strong Eventual Consistency (SEC)

CRDT 는 *Eventually Consistent* 가 아니라 ***Strong* Eventually Consistent*다. 차이는 결정론.

| | Eventual Consistency | Strong Eventual Consistency |
|---|---|---|
| 보장 | "충분히 오래 기다리면 수렴" | EC + "같은 update 본 replica 는 *deterministic* 하게 같은 상태" |
| 예 | Cassandra LWW | CRDT |
| 역설계 가능성 | 시계/도착 순서로 다른 결과 가능 | 같은 update set → 같은 state |

### SEC 의 정식 정의 (Shapiro et al. 2011)

> 두 replica 가 같은 update 집합을 받았다면, 그들의 query 결과는 동일하다.

```
∀ replicas r1, r2:
    if updates(r1) == updates(r2):
        query(r1) == query(r2)
```

핵심은 *deterministic*. 도착 순서, 재전송, 메시지 손실 후 재전송 등에 관계없이 같은 update 집합이면 같은 state.

## Semilattice 의 정의

수학적으로 semilattice 는 **결합/교환/멱등인 binary 연산 ⊔** 을 갖는 partially ordered set.

```
Semilattice (S, ⊔)
1. Associativity:  (a ⊔ b) ⊔ c  =  a ⊔ (b ⊔ c)
2. Commutativity:  a ⊔ b  =  b ⊔ a
3. Idempotency:    a ⊔ a  =  a
```

Partial order 는 다음과 같이 자동 정의된다.
```
a ≤ b  ⟺  a ⊔ b = b
```

`a ⊔ b` 는 a 와 b 의 **least upper bound (join)** — 둘 다보다 같거나 큰 가장 작은 원소.

### 익숙한 예: 자연수와 max

```
(ℕ, max)
- max(a, max(b, c)) = max(max(a, b), c)  ✓ associative
- max(a, b) = max(b, a)                  ✓ commutative
- max(a, a) = a                          ✓ idempotent

partial order: a ≤ b ⟺ max(a, b) = b ⟺ a ≤ b (자연수의 ≤)
```

자연수에서 max 는 가장 단순한 join semilattice. **G-Counter 의 merge 가 정확히 이것**이다.

### 또 다른 예: 집합과 합집합

```
(2^X, ∪)
- (A ∪ B) ∪ C = A ∪ (B ∪ C)  ✓
- A ∪ B = B ∪ A              ✓
- A ∪ A = A                  ✓

partial order: A ⊆ B ⟺ A ∪ B = B
```

**G-Set 의 merge 가 합집합** — 두 grow-only Set 을 합치는 가장 자연스러운 join.

## 왜 ACI 면 수렴하는가?

직관: ACI 셋이 있으면 **순서/재전송/중복** 모두 무관해진다.

```
세 replica 가 같은 update 집합 {u1, u2, u3} 을 받음.

Replica A: u1, u2, u3 순서로 처리 →  s_A = u3 ⊔ (u2 ⊔ (u1 ⊔ ⊥))
Replica B: u3, u1, u2 순서로 처리 →  s_B = u2 ⊔ (u1 ⊔ (u3 ⊔ ⊥))
Replica C: u1, u1, u2, u3 (재전송) → s_C = u3 ⊔ (u2 ⊔ (u1 ⊔ (u1 ⊔ ⊥)))

associative + commutative → s_A = s_B
idempotent              → s_C = s_A
```

**ACI 셋 가운데 하나라도 빠지면 수렴 깨진다**.

```
non-associative 예: 평균 함수 mean(a, b) = (a+b)/2
  mean(mean(2, 4), 6) = mean(3, 6) = 4.5
  mean(2, mean(4, 6)) = mean(2, 5) = 3.5  ✗

non-idempotent 예: 단순 덧셈 (G-Counter 가 max 인 이유)
  (1+1) ≠ 1   → 같은 update 두 번 처리 시 값 폭주
```

## CRDT 의 두 가지 정의

CRDT 는 두 가지 방식으로 정식화된다.

### CvRDT (state-based, Convergent Replicated Data Type)

state 자체가 **join semilattice**.

```
CvRDT = (S, query, update, merge, ⊥)
  S: state 집합
  query: S → V (read)
  update: S × U → S (local write)
  merge: S × S → S (semilattice join)
  ⊥: 초기 state (identity element)

조건:
  - merge 가 associative · commutative · idempotent
  - update 가 monotonic — s ≤ update(s, u)
```

**핵심**: state 가 partial order 위에서 *오직 위로* 만 움직인다 (monotonic). 그리고 merge 는 join 이라 두 state 의 LUB 로 간다.

```
        s_A ⊔ s_B
       ╱       ╲
     s_A       s_B
       ╲       ╱
          ⊥
```

### CmRDT (op-based, Commutative Replicated Data Type)

op 가 **commutative**.

```
CmRDT = (S, query, prepare, effect)
  prepare: 로컬 op → broadcast 할 op 형태
  effect: S × Op → S (모든 replica 가 적용)

조건:
  - 동시(concurrent) op 들이 commutative
  - causal order 보장된 reliable broadcast 필수
  - exactly-once delivery (또는 idempotent effect)
```

**핵심**: op 들이 commutative 하면 도착 순서 무관. 단, **causal delivery** 가 필요 (인과 의존 op 가 먼저 도착).

> CvRDT 와 CmRDT 는 [등가성](https://hal.inria.fr/inria-00609399v1/document) — 한 쪽으로 정의된 것은 다른 쪽으로 변환 가능. 자세한 비교는 [03-cvrdt-vs-cmrdt.md](03-cvrdt-vs-cmrdt.md).

## Monotonic Update 의 중요성

CvRDT 의 update 는 **monotonic** 이어야 한다.

```kotlin
// Bad — non-monotonic:
fun update(state: GCounter, replicaId: String): GCounter {
    return state.copy(counts = state.counts + (replicaId to 0))  // 0 으로 리셋?
    // 이전 state 보다 작아짐 → state ⊔ this != this 가능
}

// Good — monotonic:
fun update(state: GCounter, replicaId: String): GCounter {
    val current = state.counts[replicaId] ?: 0
    return state.copy(counts = state.counts + (replicaId to current + 1))
    // 항상 증가
}
```

monotonic 이 깨지면 merge 가 *과거의 값* 으로 되돌릴 수 있다 → 수렴 안 됨.

## 직관적 비유: Git commit graph

CRDT 의 수렴을 Git 으로 비유하면 직관적이다.

```
Git commit graph (DAG):
       ┌── A1 ── A2 ── A3
       │              ╲
   ⊥ ──┤               M ← merge commit
       │              ╱
       └── B1 ── B2 ── B3

각 commit 은 monotonic — 이전 history 를 포함.
merge commit M 은 두 head 의 LUB.
```

차이: Git merge 는 사람이 충돌 해결, CRDT merge 는 자동. **MRDT** 는 Git 스타일을 그대로 가져오면서 사용자 정의 merge function 을 지원한다 ([13-mrdt.md](13-mrdt.md)).

## Bottom (⊥) 과 Identity

CRDT 의 초기 state ⊥ 은 semilattice 의 *bottom* — 모든 원소보다 작거나 같음.

```
∀ s ∈ S:  ⊥ ≤ s   ⟺   ⊥ ⊔ s = s
```

이는 **identity element** 와 같다. merge 의 단위원이라 새 replica 가 ⊥ 으로 시작해도 정상 동작.

## 트레이드오프 박스

| 측면 | CvRDT (state) | CmRDT (op) |
|---|---|---|
| 전송 단위 | 전체 state | op 하나 |
| 전송량 | 클 수 있음 (delta-CRDT 로 완화) | 작음 |
| 전달 보장 | eventual gossip OK | causal delivery 필수 |
| 중복 처리 | idempotent merge → OK | exactly-once 또는 idempotent op |
| 구현 난이도 | merge 가 핵심 | broadcast layer 가 핵심 |

## 면접 포인트

- **"CRDT 가 EC 와 다른 점은?"** — Strong EC. 단순 EC 는 수렴하지만 *어디로* 수렴할지 결정론적 보장이 없다. CRDT 는 같은 update 집합 → 같은 state.
- **"semilattice 가 왜 수렴 보장의 본질인가?"** — ACI 가 있으면 op 도착 순서/재전송/중복 셋 다 무관. 따라서 어떤 dispatch 순서로도 같은 결과.
- **"max 와 sum 중 왜 max 가 G-Counter 의 merge 인가?"** — sum 은 idempotent 가 아니라 같은 state 두 번 merge 하면 값 폭주. max 는 idempotent.
- **"monotonic update 가 깨지면 무슨 일이 생기나?"** — merge 가 과거 state 로 되돌릴 수 있음. 카운터가 감소, 셋에서 원소 사라짐 등.

## 다음 학습

- [03-cvrdt-vs-cmrdt.md](03-cvrdt-vs-cmrdt.md) — state vs op 비교, 언제 무엇을 쓰나
- [04-counter-crdts.md](04-counter-crdts.md) — G-Counter 가 정확히 어떤 semilattice 인지 직접 확인
