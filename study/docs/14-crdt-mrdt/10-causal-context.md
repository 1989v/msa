---
parent: 14-crdt-mrdt
seq: 10
title: Causal Context — dot · dot-context · dot store
type: deep
created: 2026-05-01
---

# 10. Causal Context — vector clock 의 진화

CRDT 의 메타데이터를 압축하고 정확한 *causal* 시맨틱을 부여하는 핵심 도구. **OR-Set 의 tag 폭증 문제** 를 해결한다.

## 동기: vector clock 만으로 부족한 이유

vector clock 은 두 op 의 happens-before 관계를 결정. 그러나 *어떤 op 가 정확히 어디서 발생했는가* 를 표현하기엔 부족.

```
OR-Set 의 tag 를 vector clock 으로?
  add("apple") at A 시점에 vc=(A:5, B:3) → tag = (A:5, B:3)?
  → 하지만 tag 는 *unique* 해야 하고, 이 vc 는 이전 op 의 종속도 포함
  → tag 로 쓰기엔 너무 무거움
```

해결: **dot** — 단일 op 의 unique 식별자.

## Dot — 단일 op 의 식별

```
dot = (replicaId, sequenceNumber)
    = (A, 5)
```

각 replica 가 자기 op 마다 sequence number 를 증가시켜 발급. 모든 op 이 *exactly one* dot.

```
A 가 op1, op2, op3 발행:
  op1.dot = (A, 1)
  op2.dot = (A, 2)
  op3.dot = (A, 3)
```

## Dot-context — 본 적 있는 dot 들의 집합

```
dot-context = Set<dot>
  예: { (A, 1), (A, 2), (A, 3), (B, 1), (B, 2) }

  → "A 의 1, 2, 3 그리고 B 의 1, 2 op 을 본 적 있다"
```

이 자체는 vector clock 과 같은 정보. 차이는 *압축 방식* + *멱등 처리*.

### Compact form (causal context)

연속된 dot 은 vector clock 의 entry 로 압축 가능.

```
{ (A, 1), (A, 2), (A, 3), (A, 4), (B, 1), (B, 2) }

→ vector clock entry: { A: 4, B: 2 }
   (A 의 1~4, B 의 1~2 모두 본 적)

만약 dot 이 띄엄띄엄:
{ (A, 1), (A, 2), (A, 4), (B, 1) }   ← A:3 빠짐

→ 두 부분으로:
   compact: { A: 2, B: 1 }   (1~2, 1)
   cloud:   { (A, 4) }       (gap 있는 것)

→ 전체 = compact ∪ cloud
```

이것이 **causal context** 의 표준 표현 (Almeida et al. 2014).

## Dot store — value 와 dot 의 매핑

OR-Set 의 자료구조를 dot store 로 다시 쓰면:

```
DotStore<V> = Map<dot, V>
  예: { (A, 1) → "apple", (A, 2) → "orange", (B, 1) → "apple" }

read all values: V 의 set
```

**OR-Set 을 dot store 로 표현**:
```
ORSet<T> = (dotstore: Map<dot, T>, context: CausalContext)

add(v):
  새 dot d = (self, ++clock)
  dotstore[d] = v
  context += d

remove(v):
  toKill = { d | dotstore[d] = v }
  dotstore -= toKill
  (context 는 그대로 — 제거된 dot 도 본 적은 있음)

merge(a, b):
  new_dotstore = { (d, v) | (d, v) in a.ds ∪ b.ds, d not in (a.ctx ∪ b.ctx) - own }
  ...
```

### Optimized OR-Set (Bieniusa et al. 2012)

위 표현의 핵심 트릭: **tombstone 자체를 저장하지 않음**.

```
A: add("apple")  → dot (A,1), dotstore = {(A,1) → "apple"}, ctx = {(A,1)}
A 와 B sync     → B 도 같은 상태
A: remove("apple") → dotstore = {}, ctx = {(A,1)}  ← (A,1) 은 ctx 에만 남음

B: add("apple")    → dot (B,1), dotstore = {(B,1) → "apple"}, ctx = {(A,1), (B,1)}

merge:
  combined ctx = {(A,1), (B,1)}
  combined dotstore = {(B,1) → "apple"}

  rule: "ctx 에 있지만 dotstore 에 없는 dot" 은 *삭제됐음을 의미*
        → (A,1) 은 삭제 (B 가 보지 못한 새 add 가 아님 — 둘 다 ctx 에 있음)
        → (B,1) 은 살아있음 (B 가 새로 add)

  결과 dotstore = {(B,1) → "apple"}
  → contains "apple" = true
```

**tombstone 을 명시 저장 안 해도 ctx 의 dot 과 dotstore 의 dot 차이가 곧 tombstone 정보**. 메타데이터 폭증을 크게 줄임.

## Causal Stability

언제 dot 을 안전하게 GC 할 수 있는가? 답: **모든 replica 가 그 dot 을 본 후**.

```
replica 의 ctx:
  A.ctx = {A:5, B:3, C:4}
  B.ctx = {A:4, B:5, C:3}
  C.ctx = {A:3, B:3, C:5}

stable = element-wise min = {A:3, B:3, C:3}

→ A:1, A:2, A:3, B:1, B:2, B:3, C:1, C:2, C:3 은 모두 stable
→ 이들은 GC 가능 (tombstone 정보 더 이상 필요 없음)
```

이는 [12-garbage-collection.md](12-garbage-collection.md) 의 핵심 도구.

## 시각화: dot store 의 동작

```
초기:
  Replica A: dotstore={}, ctx={}
  Replica B: dotstore={}, ctx={}

A: add("apple")  →  dot (A,1)
  A: dotstore={(A,1) → "apple"}, ctx={(A,1)}

A 가 B 에게 sync 메시지 전송:
  message = (dotstore, ctx) of A

B 가 받아 merge:
  B: dotstore={(A,1) → "apple"}, ctx={(A,1)}

B: remove("apple")
  toKill = {(A,1)}
  B: dotstore={}, ctx={(A,1)}    ← ctx 그대로, dotstore 비움

C: add("apple")  →  dot (C,1)
  C: dotstore={(C,1) → "apple"}, ctx={(C,1)}

이제 B 와 C sync:
  combined ctx = {(A,1), (C,1)}
  combined dotstore = {(C,1) → "apple"}

  rule: 어떤 dot d 가 ctx 에 있지만 dotstore 에 없으면 → 삭제됐음
        (A,1) 은 ctx 에 있고 dotstore 에 없음 → 삭제됐음
        (C,1) 은 dotstore 에도 있음 → 살아있음

  결과: contains "apple" = true (C 가 새로 add 함)
```

## 다른 CRDT 에 적용

Counter, Register, Map 모두 dot store 패턴으로 표현 가능.

### Dot-based Counter

```
state:
  dotstore: Map<dot, Long>  ← 각 increment 의 dot 과 value 저장은 사실 redundant
                              실제는 (replicaId, lastSeq) 만 충분

read: dotstore.values.sum()  ← 또는 latest seq 까지 합산
```

순수 G-Counter 와 거의 동일. dot 기반의 일반 framework 가 통용된다는 점이 중요.

### Dot-based Register

```
state:
  dotstore: Map<dot, V>    ← 각 write 의 dot

read: dotstore.values    ← MV-Register
or: tie-break 으로 단일 값  ← LWW-Register

write(v):
  new dot d
  dotstore = {d → v}    ← 이전 모두 overwrite (자기 view 기준)
  ctx += d

merge:
  rule: ctx 에 있지만 dotstore 에 없으면 dominated
  → MV-Register 의 sibling 처리 자동
```

## Causal Broadcast 와 dot

CmRDT 의 reliable causal broadcast 는 dot 으로 효율적 구현 가능.

```
op 송신 시:
  op.dot = (self, ++clock)
  op.deps = "이 op 발행 직전 본 모든 dot"
          = self ctx 의 snapshot

수신 시:
  if op.deps ⊆ self.ctx:
    apply op
    self.ctx += op.dot
  else:
    buffer op until deps available
```

deps 를 확인해 *인과 의존이 다 도착한 후* 적용. vector clock 비교의 일반화.

## 트레이드오프 박스

| 표현 방식 | 메모리 | merge 복잡도 | Tombstone 명시 |
|---|---|---|---|
| 순수 OR-Set (tag 명시) | 큼 | 단순 | 명시 |
| Optimized OR-Set (dot store + ctx) | 중간 | 중간 | 암묵 (ctx \ dotstore) |
| State-based G-Counter | 작음 | 단순 | n/a |
| MV-Register (dot store + ctx) | 중간 | 중간 | 암묵 |

## 면접 포인트

- **"vector clock 만으론 OR-Set 못 하는 이유?"** — tag 가 unique 해야 하는데 vc 는 이전 op 종속도 포함해 무거움. dot = (replica, seq) 라는 *경량 unique id* 가 필요.
- **"dot store 의 핵심 아이디어?"** — value 를 dot 으로 인덱싱 + causal context 를 따로. tombstone 을 명시 저장 안 하고 ctx \ dotstore 차이로 표현.
- **"causal stability 가 왜 중요?"** — 모든 replica 가 본 dot 이면 tombstone 정보가 더 이상 필요 없음 → GC 가능. 그렇지 않으면 tombstone 영원히 누적.
- **"vector clock 과 causal context 의 관계?"** — vc 는 압축된 형태의 ctx. ctx 의 연속 dot 은 entry 하나로 줄지만, gap 이 있으면 cloud 로 따로.

## 다음 학습

- [11-delta-crdt.md](11-delta-crdt.md) — state 전체 대신 delta 만 전송
- [12-garbage-collection.md](12-garbage-collection.md) — causal stability 활용한 tombstone GC
