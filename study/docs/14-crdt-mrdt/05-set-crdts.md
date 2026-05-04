---
parent: 14-crdt-mrdt
seq: 05
title: Set CRDT — G-Set · 2P-Set · OR-Set · Add/Remove-Wins
type: deep
created: 2026-05-01
---

# 05. Set CRDT

분산 Set — 여러 replica 가 동시에 add/remove 하면서 수렴. **Set 은 CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입) 의 가장 풍부한 영역** — Counter 보다 트릭이 많다.

## G-Set (Grow-only Set)

가장 단순. 추가만 가능, 삭제 없음. **merge = 합집합**.

```kotlin
data class GSet<T>(val elements: Set<T> = emptySet()) {
    fun add(elem: T): GSet<T> = GSet(elements + elem)
    fun merge(other: GSet<T>): GSet<T> = GSet(elements + other.elements)
    fun contains(elem: T): Boolean = elements.contains(elem)
}
```

### Semilattice 검증

```
∪ 는 ACI:
  associative ✓ commutative ✓ idempotent (A ∪ A = A) ✓
```

### 한계

삭제 못함. 실 시스템에서 *영원히 자라기만 하는 Set* 이 필요한 경우는 거의 없다 (event log 정도).

## 2P-Set (Two-Phase Set)

G-Set + tombstone Set. 삭제는 tombstone 추가.

```kotlin
data class TwoPSet<T>(
    val added: Set<T> = emptySet(),
    val removed: Set<T> = emptySet()
) {
    fun add(elem: T): TwoPSet<T> = copy(added = added + elem)
    fun remove(elem: T): TwoPSet<T> {
        require(elem in added) { "must add before remove" }
        return copy(removed = removed + elem)
    }
    fun merge(other: TwoPSet<T>) = TwoPSet(
        added = added + other.added,
        removed = removed + other.removed
    )
    fun contains(elem: T): Boolean = elem in added && elem !in removed
}
```

### 치명적 한계

**삭제된 원소를 다시 추가 불가**.

```
add("apple") → added={apple}, removed={}
remove("apple") → added={apple}, removed={apple}  → contains? false ✓
add("apple") → added={apple}, removed={apple}    → contains? false ✗
```

이미 removed 에 들어있어서 `apple` 은 영원히 죽은 원소. 이 한계가 OR-Set 의 동기.

## OR-Set (Observed-Remove Set)

핵심 아이디어: **각 add 에 unique tag 를 달아, 삭제는 *관찰한* tag 만 죽인다**.

### 의도

```
A: add("apple") with tag tA1   → {("apple", tA1)}
A: remove("apple")             → kill {tA1}
B: add("apple") with tag tB1   → {("apple", tB1)}    (A 의 tA1 모름)

merge: add 본 적 없으니 B 의 tA1 kill 안 됨 → {("apple", tB1)} 살아있음
```

**"삭제는 본 적 있는 add 만"** — 이것이 *Observed-Remove* 의 의미.

### 자료구조

```
elements: Set<(value, tag)>   — 살아있는 (value, tag) 쌍
tombstones: Set<tag>          — 죽은 tag

add(v):  새 unique tag t 생성, elements 에 (v, t) 추가
remove(v):
    let toKill = { t | (v, t) ∈ elements }
    tombstones += toKill
    (또는 elements 에서 제거 — 둘 다 가능)

contains(v): ∃ t. (v, t) ∈ elements ∧ t ∉ tombstones
```

### Kotlin 구현 (단순)

```kotlin
data class ORSet<T>(
    val elements: Set<Pair<T, String>> = emptySet(),  // (value, tag)
    val tombstones: Set<String> = emptySet()
) {
    fun add(value: T, tag: String): ORSet<T> {
        // tag 는 caller 가 unique 하게 (UUID 또는 (replicaId, counter))
        return copy(elements = elements + (value to tag))
    }

    fun remove(value: T): ORSet<T> {
        val toKill = elements.filter { it.first == value }.map { it.second }
        return copy(tombstones = tombstones + toKill)
    }

    fun merge(other: ORSet<T>) = ORSet(
        elements + other.elements,
        tombstones + other.tombstones
    )

    fun contains(value: T): Boolean =
        elements.any { it.first == value && it.second !in tombstones }

    fun values(): Set<T> =
        elements
            .filter { it.second !in tombstones }
            .map { it.first }
            .toSet()
}
```

### Add-Wins 시나리오

```
A: add("apple") → elements={("apple", a1)}
A 와 B sync → B 도 elements={("apple", a1)}
A: remove("apple") → tombstones={a1}
B: add("apple") → elements={("apple", a1), ("apple", b1)}   (B 가 새 tag)

merge:
  elements = {("apple", a1), ("apple", b1)}
  tombstones = {a1}

contains("apple")?
  ("apple", a1) — a1 in tombstones → kill
  ("apple", b1) — b1 not in tombstones → alive
  → true (살아있음)
```

**concurrent add + remove** 에서 add 가 이긴다 — 사용자가 *모르는 add* 는 죽이지 않으니까.

## OR-Set 의 메타데이터 폭증

OR-Set 의 단점: tag 누적. 100번 add+remove 한 원소는 100개 tag 가 죽은 채로 남는다.

```
state 가 영원히 자라는 문제 → tombstone GC 필요
```

해결책은 [10-causal-context.md](10-causal-context.md) 에서 다룰 *causal context* 와 *dot store* 로 압축.

## Add-Wins (AW-Set) vs Remove-Wins (RW-Set)

OR-Set 은 기본적으로 **Add-Wins** — concurrent add+remove 시 add 가 이김.

반대 정책: **Remove-Wins** (RW-Set). concurrent 시 remove 가 이김.

```
RW-Set 의 기본 아이디어:
  remove(v) → 시점 vector clock T 에서 *모든 미래 add* 도 kill?
  단순 구현은 어렵고, "remove 시점 본 add 까지만 kill" 같은 약한 정의도 있음
```

### 어느 쪽을 고르나?

```
Add-Wins:
  • 협업 도구 — 한 명이 추가한 걸 다른 명의 삭제가 못 지움 (의도 보존)
  • shopping cart — 추가한 아이템이 사라지면 안 됨

Remove-Wins:
  • 게시판 차단 목록 — 차단(remove)이 add 보다 강함
  • 보안 권한 회수 — 권한 회수가 권한 부여보다 강함
```

대부분 Add-Wins 가 안전한 default.

## LWW-Element-Set

OR-Set 과 비슷하지만 timestamp 기반.

```
state: Map<value, (addTimestamp, removeTimestamp)>

add(v): addTimestamp[v] = now()
remove(v): removeTimestamp[v] = now()
contains(v): addTimestamp[v] > removeTimestamp[v]
merge: 각 timestamp 의 max
```

### 한계

LWW-Register 와 같은 clock skew 문제 ([06-register-crdts.md](06-register-crdts.md) 참고). add 가 정말 늦었는데 remove 보다 timestamp 가 작으면 사라짐.

## 비교 표

| Set 종류 | 삭제 가능 | 재추가 가능 | concurrent add+rm | 메타데이터 |
|---|---|---|---|---|
| G-Set | ✗ | n/a | n/a | 없음 |
| 2P-Set | ✓ (1회) | ✗ | remove wins | tombstone |
| OR-Set | ✓ | ✓ | add wins (default) | unique tag |
| LWW-Element-Set | ✓ | ✓ | timestamp 큰 쪽 | 2× timestamp |
| RW-Set | ✓ | △ | remove wins | 복잡 |

## 시나리오: 멀티 디바이스 wishlist

[17-msa-application.md](17-msa-application.md) 의 시나리오를 미리.

현 msa 의 wishlist:
```
WishlistItem(memberId, productId)
add("user1", "p1")    via mobile
remove("user1", "p1") via web
add("user1", "p1")    via mobile (web 의 remove 못 봄, 오프라인)
```

만약 mobile/web 양쪽이 오프라인 모드 + 후속 sync 로 동작한다면 OR-Set 이 자연스럽다. 현재는 single-master MySQL 이라 시점 충돌 자체가 없음.

## 면접 포인트

- **"왜 OR-Set 이 2P-Set 보다 필요한가?"** — 2P-Set 은 한 번 삭제한 원소 재추가 불가. tombstone 에 영원히 갇힘. OR-Set 은 unique tag 로 *어떤 add 를 죽이는지* 명시 → 새 add 는 새 tag 라 살아남음.
- **"OR-Set 의 tag 는 어떻게 만드나?"** — `(replicaId, sequenceNumber)` 또는 UUID. unique 하면 충분. 메타데이터 폭증이 단점, [causal context](10-causal-context.md) 로 압축.
- **"concurrent add + remove 의 default 정책?"** — Add-Wins. 사용자가 *모르는* add 를 죽이지 않으니까. 협업 도구 / 카트 / wishlist 모두 자연.
- **"LWW-Element-Set 은 OR-Set 의 대체?"** — 아님. clock skew 로 lost update 가능. 단순성은 좋지만 정확성이 약함. 보통 OR-Set 이 더 안전.

## 다음 학습

- [06-register-crdts.md](06-register-crdts.md) — single value 저장 (LWW vs MV)
- [10-causal-context.md](10-causal-context.md) — OR-Set tag 를 dot store 로 압축
