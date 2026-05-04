---
parent: 14-crdt-mrdt
seq: 20
title: CRDT 자료구조 풀 카탈로그 — Counter · Set · Register · Sequence · Map · Graph · JSON
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 03-cvrdt-vs-cmrdt.md
  - 04-counter-crdts.md
  - 05-set-crdts.md
  - 06-register-crdts.md
  - 07-map-crdts.md
  - 08-sequence-crdts.md
  - 09-json-crdts.md
sources:
  - "Conflict-free Replicated Data Types (Shapiro, Preguiça, Baquero, Zawirski — INRIA RR-7687, 2011)"
  - "A comprehensive study of Convergent and Commutative Replicated Data Types (Shapiro et al., 2011)"
  - https://crdt.tech/
  - https://github.com/yjs/yjs
  - https://automerge.org/
  - "RGA: Replicated Growable Array (Roh et al., 2011)"
  - "Logoot: A Scalable Optimistic Replication Algorithm for Collaborative Editing (Weiss et al., 2010)"
  - "Treedoc: A WOOT-based Sequence CRDT (Preguiça et al., 2009)"
  - https://hal.inria.fr/inria-00555588/document
catalog-row: "Set CRDT / Counter CRDT / Register CRDT / Sequence CRDT / Map CRDT / Graph CRDT / JSON CRDT 풀 카탈로그 — State-based vs Op-based, 수렴 조건, msa wishlist/cart/gifticon 적용"
---

# 20. CRDT 자료구조 풀 카탈로그 — 종류와 사용 시점

## TL;DR

- **CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입)** 은 분산 환경에서 *수학적으로* 수렴이 보장되는 자료구조
- 두 갈래: **State-based (CvRDT)** — full state merge, idempotent join; **Op-based (CmRDT)** — operation broadcast, commutative
- 7 카테고리: **Counter, Set, Register, Sequence, Map, Graph, JSON**
- 수렴 3 조건: **commutativity (교환), associativity (결합), idempotency (멱등)** — 셋 다 만족하면 어떤 순서/중복 적용해도 같은 결과
- msa 적용: wishlist (다중 디바이스), gifticon (오프라인 우선), shopping cart (eventual consistency 카트)

본 글은 14-crdt-mrdt 의 04~09 범위를 *한 자리에* 모아 종류와 선택 기준을 빠르게 보는 카탈로그.

---

## 1. State-based vs Operation-based

### 1.1 CvRDT (Convergent Replicated Data Type)

- **state 전체** 를 송수신
- merge 함수 `⊔: S × S → S` 가 **join semilattice** 이어야 함
  - associative: `(a ⊔ b) ⊔ c = a ⊔ (b ⊔ c)`
  - commutative: `a ⊔ b = b ⊔ a`
  - idempotent: `a ⊔ a = a`
- 수렴 조건: 모든 replica 가 모든 update 를 결국 반영 → eventual consistency 보다 강한 **SEC (Strong Eventual Consistency, 강한 최종 일관성)**

```
replicaA: S_A = update₁(S₀)
replicaB: S_B = update₂(S₀)
gossip:   S_A.merge(S_B) = S_B.merge(S_A) = S_AB
```

### 1.2 CmRDT (Commutative Replicated Data Type)

- **operation 자체** 를 broadcast (causal order 보장 채널 필요)
- 두 op 가 concurrent 하면 *어느 순서로 적용해도 같은 결과*
- 보통 idempotency 는 channel 책임 (exactly-once delivery)
- `prepare(op)` → broadcast → `effect(op)` 로 분리

### 1.3 어느 쪽이 나은가

| 항목 | CvRDT | CmRDT |
|---|---|---|
| 네트워크 트래픽 | state 전체 (큼) | op (작음) |
| 채널 요구 | unreliable, anti-entropy gossip | causal broadcast |
| 구현 난이도 | merge 만 작성 | prepare/effect + 채널 |
| Anti-entropy 친화 | ✓ (Riak, Cassandra) | ✗ |
| 협업 에디터 | △ (메시지 큼) | ✓ (Yjs, Automerge) |

> 두 모델은 등가 — δ-CRDT (delta-CRDT) 가 둘의 절충 ([11-delta-crdt.md](11-delta-crdt.md)).

---

## 2. Counter 계열

### 2.1 G-Counter (Grow-only Counter)

각 replica i 가 자기 카운트 `P[i]` 만 증가. 전체 값 = `Σ P[i]`. merge = element-wise max.

```kotlin
data class GCounter(val P: Map<String, Long> = emptyMap()) {
    fun increment(replicaId: String, delta: Long = 1): GCounter =
        copy(P = P + (replicaId to (P.getOrDefault(replicaId, 0L) + delta)))

    fun value(): Long = P.values.sum()

    fun merge(other: GCounter): GCounter {
        val keys = P.keys + other.P.keys
        return GCounter(keys.associateWith { k ->
            maxOf(P.getOrDefault(k, 0L), other.P.getOrDefault(k, 0L))
        })
    }
}
```

**Vector Clock 과 동형**:
- `P` 의 element-wise max merge = vector clock 의 `merge(VC₁, VC₂) = max element-wise`
- 단, vector clock 은 *causality 추적용* (compare 가능), G-Counter 는 *값 합계용* (compare 불필요)

**한계**: 감소 불가. 페이지 뷰 / 좋아요 누적 / 광고 노출 카운트 등에 적합.

### 2.2 PN-Counter (Positive-Negative Counter)

G-Counter 두 개 (`P` for increment, `N` for decrement). `value = ΣP - ΣN`.

```kotlin
data class PNCounter(val P: GCounter = GCounter(), val N: GCounter = GCounter()) {
    fun increment(id: String, d: Long = 1) = copy(P = P.increment(id, d))
    fun decrement(id: String, d: Long = 1) = copy(N = N.increment(id, d))
    fun value() = P.value() - N.value()
    fun merge(o: PNCounter) = PNCounter(P.merge(o.P), N.merge(o.N))
}
```

**한계**: 음수로 갈 수 있음 (재고처럼 `≥ 0` 제약 못 강제). → **Bounded Counter** 필요 (escrow / reservation 메커니즘, AntidoteDB 가 구현).

### 2.3 카운터 외 변종

| 변종 | 핵심 |
|---|---|
| Bounded Counter | 상한/하한 enforce, escrow 기반 |
| Hybrid Counter | causally consistent + bounded |
| LWW-Counter | timestamp 기반, 정확도 떨어짐 (잘 안 씀) |

---

## 3. Set 계열

[05-set-crdts.md](05-set-crdts.md) 의 압축본.

### 3.1 G-Set

Add only. `merge = ∪` (합집합). 가장 단순. 사용처: append-only event log.

### 3.2 2P-Set (Two-Phase Set)

`added` Set + `removed` Set. `contains(x) = x ∈ added ∧ x ∉ removed`. **재추가 불가** — 한 번 죽인 원소는 영원히 죽음.

### 3.3 OR-Set (Observed-Remove Set) ★

각 add 에 unique tag `(replicaId, seq)` 부여. remove 는 *관찰한* tag 만 죽임. 새 add 는 새 tag → 살아남음.

```kotlin
data class ORSet<T>(
    val adds: Map<T, Set<Tag>> = emptyMap(),
    val tombstones: Set<Tag> = emptySet()
) {
    fun add(elem: T, replicaId: String, seq: Long): ORSet<T> {
        val tag = Tag(replicaId, seq)
        return copy(adds = adds + (elem to (adds[elem].orEmpty() + tag)))
    }

    fun remove(elem: T): ORSet<T> {
        val tags = adds[elem].orEmpty()
        return copy(tombstones = tombstones + tags)
    }

    fun contains(elem: T): Boolean =
        (adds[elem].orEmpty() - tombstones).isNotEmpty()

    fun merge(other: ORSet<T>): ORSet<T> = ORSet(
        adds = (adds.keys + other.adds.keys).associateWith {
            adds[it].orEmpty() + other.adds[it].orEmpty()
        },
        tombstones = tombstones + other.tombstones
    )
}

data class Tag(val replicaId: String, val seq: Long)
```

**Default 정책: Add-Wins** — concurrent `add(x)` + `remove(x)` 일 때 add 가 이김. 사용자가 *모르는* add 를 죽이지 않으니 협업 도구 / 카트 / wishlist 자연.

**Remove-Wins 변형 (RW-Set)** 도 있음 — 보안/권한 (e.g. ACL revoke) 에서 선호.

### 3.4 LWW-Element-Set

각 원소에 `(timestamp, op)` 첨부. `contains = 마지막 op 가 add`. **시계 의존** — clock skew 로 lost update 가능.

### 3.5 비교 표

| Set 종류 | 삭제 | 재추가 | concurrent add+rm | 메타데이터 |
|---|---|---|---|---|
| G-Set | ✗ | n/a | n/a | 없음 |
| 2P-Set | 1회 | ✗ | rm wins | tombstone |
| OR-Set | ✓ | ✓ | add wins | tag set |
| LWW-Set | ✓ | ✓ | timestamp | 2× ts |
| RW-Set | ✓ | △ | rm wins | 복잡 |

---

## 4. Register 계열

단일 값 저장. 충돌 시 정책이 다양.

### 4.1 LWW-Register (Last-Write-Wins Register)

```kotlin
data class LWWRegister<T>(val value: T?, val timestamp: Long, val replicaId: String) {
    fun assign(newValue: T, ts: Long, id: String): LWWRegister<T> =
        if (ts > timestamp || (ts == timestamp && id > replicaId))
            LWWRegister(newValue, ts, id)
        else this

    fun merge(o: LWWRegister<T>) = if (o.timestamp > timestamp ||
                                       (o.timestamp == timestamp && o.replicaId > replicaId)) o else this
}
```

`(timestamp, replicaId)` lexicographic order 로 동시 동순 tie-break. 단순하고 빠르지만 **lost update 위험** — concurrent write 중 하나가 그냥 사라짐.

### 4.2 MV-Register (Multi-Value Register)

concurrent write 가 *모두 살아남음*. read 시 set 반환 → 사용자가 충돌 해결.

```
A: assign("blue") at VC=[1,0]
B: assign("red")  at VC=[0,1]   (concurrent, neither dominates)
merge: {("blue", [1,0]), ("red", [0,1])}
read → {"blue", "red"}
```

Riak / DynamoDB 의 sibling resolution 모델이 이것.

### 4.3 정책 비교

| Register | 충돌 시 | UI/UX |
|---|---|---|
| LWW-Register | 마지막 timestamp 살아남음 (lost update OK) | 단순 |
| MV-Register | 모두 살아남음 → 사용자가 선택 | "이 항목에 충돌이 있습니다" UI 필요 |

---

## 5. Sequence (Ordered List) 계열

협업 에디터의 핵심. *문자/줄을 어디에 끼워 넣을지* 가 본질.

### 5.1 RGA (Replicated Growable Array)

각 원소에 `(timestamp, replicaId)` 부여. 새 원소는 *직전 원소* 의 reference + 자기 timestamp 로 위치 식별. tombstone 으로 삭제 표시.

```
"abc" 표현:
  a: (t=1, r=A, prev=null)
  b: (t=2, r=A, prev=a)
  c: (t=3, r=A, prev=b)

A: insert "X" between b and c
B: insert "Y" between b and c (concurrent)

→ X, Y 둘 다 prev=b, 자기 (t,r) 로 sort
→ "abXYc" or "abYXc" (replicaId tie-break)
```

장점: 직관적. 단점: tombstone 누적 → causal stability + GC 필요 ([12-garbage-collection.md](12-garbage-collection.md)).

### 5.2 Logoot

각 위치에 *position identifier* (실수 같은 dense order) 부여. 두 위치 사이에 항상 새 position 생성 가능 (Q 같은 dense set).

```
"a" at pos=0.3
"c" at pos=0.7
"b" insert between → pos=0.5
```

장점: tombstone 없음 (delete 시 그냥 제거). 단점: position id 가 점점 길어짐 (interleaving anomaly 시 폭증).

### 5.3 Treedoc

Tree 위에 각 원소 배치. 두 원소 사이 삽입 = 자식 노드 추가. position = root → leaf path.

장점: 깔끔한 수학 구조. 단점: balanced 유지 어려움, tree 깊이 폭증.

### 5.4 WOOT / YATA / Fugue

- **WOOT** (2006): 첫 sequence CRDT, complexity O(n²)
- **YATA** (2016): Yjs 의 algorithm, RGA + 효율 개선
- **Fugue** (2023): RGA 의 *interleaving anomaly* 해결 — concurrent 한 두 사용자가 같은 위치에 단어를 넣을 때 문자가 섞이는 문제 해결

### 5.5 실전 라이브러리

| 라이브러리 | 알고리즘 | 언어 |
|---|---|---|
| Yjs | YATA | TypeScript / Rust port (yrs) |
| Automerge | RGA-like | TypeScript / Rust |
| Loro | Fugue + custom | Rust |

---

## 6. Map 계열

key → CRDT value 매핑. 문제는 *concurrent put/delete + nested CRDT* 의 시맨틱.

### 6.1 OR-Map (Observed-Remove Map)

OR-Set 으로 key 관리 + 각 key 의 value 가 CRDT (recursive). put 은 add, delete 는 remove.

```kotlin
data class ORMap<K, V : Any>(
    val keys: ORSet<K> = ORSet(),
    val values: Map<K, V> = emptyMap()  // V 는 CRDT 여야
) {
    fun put(k: K, v: V, replicaId: String, seq: Long): ORMap<K, V> = ...
    fun remove(k: K): ORMap<K, V> = ...
    fun merge(o: ORMap<K, V>): ORMap<K, V> = ...
}
```

### 6.2 LWW-Map

각 key 에 LWW-Register. 단순하지만 lost update 위험.

### 6.3 Map 의 함정: concurrent add + nested update

```
A: put("user1", Counter(5))
B: put("user1.counter", increment +3)  → counter += 3
A: remove("user1")
B: counter += 2

merge → user1 살아있나? counter 값?
```

OR-Map 의 default: **Add-Wins** — remove 후의 update 도 살아남음. **Reset-Remove** 변형은 remove 후 update 무시 (causal context 사용).

→ [10-causal-context.md](10-causal-context.md), [13-mrdt.md](13-mrdt.md).

---

## 7. Graph 계열

vertex Set + edge Set. edge 는 vertex 의 존재에 의존 → ordering 문제.

### 7.1 2P2P-Graph (Two-Phase Two-Phase Graph)

vertex 도 2P-Set, edge 도 2P-Set. 한 번 삭제하면 영원히 죽음.

```
addVertex(v) requires v ∉ removedVertices
addEdge(u,v) requires u,v ∈ vertices
removeVertex(v) requires no edge references v  ← 이 검사가 어려움 (분산)
```

### 7.2 Add-Only Monotonic DAG

DAG (Directed Acyclic Graph) + 추가만. cycle 회피 — 새 edge 가 기존 path 의 reverse 만 안 만들면 됨.

### 7.3 분산 graph 의 어려움

vertex 와 edge 의 *referential integrity* 가 분산 환경에선 깨지기 쉽다.

```
A: removeVertex("v1")
B: addEdge("v1", "v2")     ← v1 was just removed
merge → ?
```

→ **dangling edge** 허용 (edge 가 unknown vertex 가리킴 OK, GC 책임은 application) 또는 **causal ordering 강제** (Op-based).

소셜 그래프 / 권한 graph / 의존성 graph 등에서 실전 사용은 *드물다* — 대부분 단일 마스터 + replicate.

---

## 8. JSON CRDT (Nested Document)

Automerge 의 핵심: JSON 전체를 CRDT 화. 객체 = OR-Map of CRDT, 배열 = RGA, 원시값 = LWW-Register, 문자열 = sequence CRDT.

```json
{
  "title": "Hello",            ← LWW-Register<String>
  "tags": ["a", "b"],          ← RGA<String>
  "counter": 5,                ← Counter
  "settings": {                ← OR-Map
    "theme": "dark"            ← LWW-Register<String>
  }
}
```

### 8.1 Move operation 함정

```
{"a": {"x": 1}}
A: move "a" to root → {"x": 1}
B: update "a.x" to 2 → {"a": {"x": 2}}
merge → ?
```

Kleppmann (2020) 의 *"A highly-available move operation for replicated trees"* 에서 해결책 제시 — undo log + linearization 으로 최종 결과 결정.

### 8.2 Automerge 구조

- 모든 변경은 *change* (op + dependencies)
- change graph = causal DAG
- snapshot 은 change 들의 fold

→ git 의 commit graph 와 유사한 mental model.

---

## 8.3 Tree CRDT — Move operation

```
초기:
  /a/b/c
A: move /a/b → /x/b      (b 를 /x 아래로)
B: move /a → /a/b        (a 를 b 의 자식으로)  ← cycle!

merge → tree 가 깨짐 (a 와 b 가 서로 부모-자식)
```

Kleppmann (2020) 의 해결책 — *event sourcing + reverse-on-conflict*:

1. 모든 op 를 timestamped log 로 보관
2. merge 시 timestamp order 로 재적용
3. cycle 만드는 op 는 *skip* (다른 op 들과 호환 안 되면 무효)

→ **결과론적 결정** (deterministic eventual consistency).

## 8.4 Automerge change graph

```
change₁ ←─ change₂ ─── change₃
            ↖_______ change₄
```

각 change = `(opId, parents[], op)`. parents 가 *causal dependencies*. snapshot = topological sort + apply.

특징:
- **time travel** — 임의 시점의 snapshot 재현 가능
- **branching / merging** — git 의 branch 모델
- **byte-level diff** — Automerge 2.0 부터 binary 인코딩

---

## 9. 수렴 조건 — 수학적 정리

### 9.1 Semilattice 3 조건

CvRDT 의 merge `⊔` 가 다음을 만족하면 수렴:

| 조건 | 의미 | 증명 |
|---|---|---|
| Associative | `(a⊔b)⊔c = a⊔(b⊔c)` | 어떤 순서로 merge 해도 동일 |
| Commutative | `a⊔b = b⊔a` | 두 replica 어느 쪽 먼저 merge 해도 동일 |
| Idempotent | `a⊔a = a` | 같은 message 중복 받아도 안전 |

### 9.2 CmRDT 의 commutativity 조건

두 op `op₁, op₂` 가 concurrent 일 때:
```
effect(op₂)(effect(op₁)(s)) = effect(op₁)(effect(op₂)(s))
```

순서 무관. *causally related* (one happened-before the other) op 는 채널이 순서 보장 → 단순 적용.

### 9.3 SEC (Strong Eventual Consistency, 강한 최종 일관성)

- Eventual Delivery: 모든 update 가 결국 모든 replica 에 도달
- Convergence: 같은 update 집합을 본 replica 는 같은 state

**기존 EC (Eventual Consistency)** 는 convergence 가 *결국* 보장이지만 conflict resolution 이 application 책임. **SEC** 는 *수학적으로* 보장.

---

## 9.4 Causal Context — OR-Set 의 메타데이터 압축

OR-Set 의 tag set 은 *원소 추가마다 폭증*. **Dot Store** 으로 압축:

```
Tag = (replicaId, sequenceNumber)

dots = {(A,1), (A,2), (A,3), (B,1), (B,2)}
   ↓ 압축
dotContext = {A → 3, B → 2}   ← vector clock 같은 형태
```

연속된 sequence 는 max 만 저장. *gap* 이 있을 때만 explicit set 으로:

```
{(A,1), (A,2), (A,4)}
   ↓
{A → 2 (compact prefix)} + {A,4 (gap)}
```

→ tombstone storage 에서 O(N) → O(log N) 또는 O(replica 수).

→ [10-causal-context.md](10-causal-context.md) 에서 깊이.

## 9.5 δ-CRDT (delta-state CRDT)

CvRDT 의 단점: state 전체 송신 = 큰 payload. CmRDT 의 단점: causal broadcast 채널 필수.

**δ-CRDT** = *증분 (delta)* 만 송신 + CvRDT 의 merge 사용.

```
S_old = ORSet({apple, banana})
op: add("cherry")
δ = ORSet({cherry})        ← 변경분만
S_new = S_old.merge(δ)
broadcast(δ) instead of broadcast(S_new)
```

receiver 는 자기 state 에 δ merge → 수렴. CvRDT 의 안전성 + CmRDT 의 효율 결합.

Akka Distributed Data, Riak, Antidote 등이 채택.

→ [11-delta-crdt.md](11-delta-crdt.md).

---

## 10. 비교 — CRDT vs OT vs Lock-based

| 모델 | 동기화 | 충돌 해결 | 사용처 |
|---|---|---|---|
| CRDT | merge / op-broadcast | 자동 (수학 보장) | local-first, 협업 도구, multi-master DB |
| OT (Operational Transform) | central server transforms ops | server 가 transform | Google Docs (전통) |
| Lock-based | 전역 lock / leader | 직렬화 | 강한 일관성 필요 (금전 등) |
| LWW only | timestamp | 후자 승 | 단순하지만 lost update |

OT 는 server-mediated 가 필수, CRDT 는 *peer-to-peer* 가능. → local-first software ([Ink & Switch](https://www.inkandswitch.com/local-first/)) 의 표준.

---

## 11. msa 적용 — wishlist · gifticon · cart

### 11.1 wishlist — 다중 디바이스 동기화

**현재 msa 구조** (`wishlist/domain/.../WishlistItem.kt`):
```
WishlistItem(memberId, productId, addedAt)
PK: (memberId, productId)
```
single-master MySQL → 충돌 자체가 없음.

**오프라인 모드 도입 시 시나리오**:
```
mobile (offline): add(p1)
web   (online):  add(p1) → remove(p1)
mobile online 복귀
```

→ **OR-Set<ProductId>** 가 자연.
- 각 add 에 `(deviceId, seq)` tag
- mobile 의 add 가 web 의 remove 가 *모르는* tag → 살아남음
- 의도와 일치: "mobile 에서 다시 추가했는데 sync 후 사라지면 이상함"

**구현 변경 포인트**:
- domain entity: `WishlistOpLog(memberId, op, productId, tag)` 추가
- adapter: 로컬 SQLite + 서버 sync API
- merge 시점: 백그라운드 동기화 worker

### 11.2 gifticon — offline-first

기프티콘은 *카메라로 찍어 등록* → 종종 오프라인 환경 (지하철, 외부 매장). 동일 기프티콘을 두 디바이스에서 등록할 가능성.

**자료 구조 후보**:
- gifticon list = OR-Set<GifticonId>
- 각 gifticon 의 *사용 상태* = LWW-Register<UsageState>
- *사용 그룹 (sharing group)* = OR-Set<MemberId>

**dedup 함정**: 같은 바코드/이미지를 두 번 등록 → 같은 productId 로 식별되면 OR-Set 이 자동 dedup. **이미지 → productId 매핑이 deterministic** 이면 OR-Set 의 element key 역할.

### 11.3 shopping cart

**전통 모델**: server 가 단일 진실 (single source of truth) → cart line 추가/삭제 모두 API 호출.

**CRDT 모델**: cart = OR-Map<ProductId, Counter (수량)>. add 는 counter increment, remove 는 counter decrement (또는 OR-Set 에서 element 제거).

```kotlin
// CRDT cart
data class Cart(val items: Map<ProductId, PNCounter> = emptyMap()) {
    fun addItem(p: ProductId, q: Int, replicaId: String) =
        copy(items = items + (p to (items[p] ?: PNCounter()).increment(replicaId, q.toLong())))
    fun removeItem(p: ProductId, q: Int, replicaId: String) =
        copy(items = items + (p to (items[p] ?: PNCounter()).decrement(replicaId, q.toLong())))
    fun merge(o: Cart) = Cart(
        (items.keys + o.items.keys).associateWith {
            (items[it] ?: PNCounter()).merge(o.items[it] ?: PNCounter())
        }
    )
}
```

**한계**:
- PN-Counter 는 음수 허용 → 수량 < 0 가능 → application validation 필요
- **재고 (inventory) 는 CRDT 부적합** — 강한 일관성 필요. cart 는 OK, 결제 시점에 재고 확인.

### 11.4 적용 가이드

| 도메인 | CRDT 적합? | 이유 |
|---|---|---|
| wishlist (다중 디바이스) | ✓ | 충돌 적고, 자동 merge OK |
| shopping cart (offline-first) | ✓ | 음수 검증만 application |
| gifticon | ✓ | offline-first 자연 |
| 재고 (inventory) | ✗ | 음수 절대 금지, 강한 일관성 |
| 결제 / 주문 | ✗ | ACID 필수, 직렬화 |
| 좋아요 카운트 | ✓ (G-Counter) | 누적만, 정확도 OK |
| 페이지 뷰 | ✓ (G-Counter) | 누적만 |
| 협업 메모 (있다면) | ✓ (RGA / Yjs) | 협업 에디터 |

→ ADR 후보: *"wishlist offline-first 도입 시 OR-Set 적용 검토"* — `00-ADR-CANDIDATES.md` 에 통합.

### 11.5 Tombstone GC 전략

OR-Set / RGA 같은 CRDT 는 **tombstone 누적** → storage 폭증.

GC 시점:
- **Causal Stability** — 모든 replica 가 op X 를 *본 후* X 보다 옛 tombstone 안전 GC
- **Periodic compaction** — 24h 마다 합의 + tombstone 제거
- **Snapshot + replay** — 신규 replica 는 snapshot 받음, 그 이전 tombstone 무시

→ [12-garbage-collection.md](12-garbage-collection.md) 에서 깊이. 운영 관점에서는 *append-only event log + periodic snapshot* 이 흔함.

### 11.6 실전 라이브러리 / 시스템

| 시스템 | 종류 | 사용처 |
|---|---|---|
| **Yjs** | RGA + sequence | 협업 에디터 (Notion, Tldraw, JupyterHub) |
| **Automerge** | JSON CRDT | local-first apps (Ink&Switch) |
| **Riak** | Map / Set / Counter / Register | distributed KV (Bet365) |
| **Redis Active-Active CRDB** | LWW + CRDT | Redis Enterprise multi-region |
| **AntidoteDB** | bounded counter, OR-Set | research-oriented |
| **Roshi (SoundCloud)** | LWW-Set | timeline / activity |
| **ElectricSQL** | ORM + CRDT sync | Postgres ↔ SQLite local-first |
| **Loro** | Fugue + custom (Rust) | high-perf 협업 |

### 11.7 msa 코드 grounding

현재 `wishlist/domain/src/main/kotlin/com/kgd/wishlist/domain/model/WishlistItem.kt` 는 단순 entity. CRDT 도입 시 추가될 컴포넌트:

```
wishlist/
  domain/
    model/
      WishlistItem.kt          (existing)
      WishlistOpLog.kt         (new — op log + tag)
      ORSetMerger.kt           (new — domain service)
  app/
    application/
      service/
        WishlistSyncService.kt (new — multi-device sync)
    infrastructure/
      adapter/out/persistence/
        WishlistOpLogJpa.kt    (new — op log persistence)
```

→ **점진적 도입** 전략: 기존 단순 모드 + offline 모드 옵트인 기능. 일반 사용자는 single-master 그대로.

### 11.8 면접 질문 대비

**Q1. CvRDT 와 CmRDT 중 어느 게 더 나은가?**

> 등가 — 어느 한쪽이 절대 우월하진 않음. trade-off:
> - **CvRDT** — anti-entropy gossip 친화 (Riak), unreliable network OK, 단 state payload 큼
> - **CmRDT** — op 만 broadcast (작음), 단 causal broadcast 채널 필수
> - **δ-CRDT** — 둘의 절충 (변경분만 송신 + CvRDT 의 merge)

**Q2. OR-Set 의 tag 가 왜 필요한가?**

> 2P-Set 의 *재추가 불가* 한계 해결. 각 add 에 unique tag 부여 → remove 는 *관찰한* tag 만 죽임. 새 add 는 새 tag → 살아남음. tag 폭증 문제는 causal context (dot store) 로 압축.

**Q3. Add-Wins vs Remove-Wins?**

> default 는 Add-Wins (협업 도구 / wishlist / cart). 근거: 사용자가 *모르는* add 를 죽이는 게 부자연스러움. 보안 (ACL revoke) / 권한 시스템에선 Remove-Wins.

**Q4. CRDT 와 OT (Operational Transform) 의 차이?**

> OT 는 *server-mediated* (Google Docs) — server 가 concurrent op 를 transform. CRDT 는 *peer-to-peer* 가능 — 수학적으로 commutative 한 op 설계. CRDT 가 local-first / offline-first 친화.

**Q5. wishlist 같은 도메인에 CRDT 가 정말 필요한가?**

> 단일 마스터 + last-write-wins 면 충분한 경우가 많음. CRDT 는 **offline-first / multi-device sync / collaborative editing** 같이 *동시 변경 가능성이 자연* 한 경우. 일반 e-commerce 의 단발 wishlist 는 CRDT 까지 필요 없음.

---

## 12. 학습 체크포인트

- [ ] G-Counter / PN-Counter 의 merge 함수 직접 작성
- [ ] OR-Set 의 add-wins 정책이 왜 사용자 경험에 자연스러운지 설명
- [ ] LWW-Register 의 lost update 시나리오 예시
- [ ] RGA 의 tombstone GC 가 왜 어려운지
- [ ] OR-Map 의 nested update + concurrent remove 결과
- [ ] semilattice 의 ACI 3 조건 — 각 의미와 증명
- [ ] CRDT vs OT vs Lock 의 trade-off
- [ ] wishlist 에 OR-Set 도입 시 변경 포인트 (domain / app / sync)

## 13. 다음 학습

- [03-cvrdt-vs-cmrdt.md](03-cvrdt-vs-cmrdt.md) — 두 모델의 등가성 증명
- [10-causal-context.md](10-causal-context.md) — OR-Set tag 의 dot store 압축
- [11-delta-crdt.md](11-delta-crdt.md) — state vs op 의 절충
- [13-mrdt.md](13-mrdt.md) — Riak 의 MRDT (Mergeable Replicated Data Type)
- [17-msa-application.md](17-msa-application.md) — msa 도메인 매핑
