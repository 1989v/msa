---
parent: 14-crdt-mrdt
seq: 08
title: Sequence CRDT — Logoot · Treedoc · RGA · WOOT · Yata
type: deep
created: 2026-05-01
---

# 08. Sequence CRDT — 협업 편집의 핵심

협업 에디터(Notion / Figma / Google Docs / VS Code Live Share)의 본체. **순서가 있는 list** 를 분산 동시 편집할 때 충돌 없이 수렴.

## 문제 정의

```
A: "Hello"
A: insert ", world" at position 5  → "Hello, world"
B: insert "!" at position 5        → "Hello!"

A 와 B 가 동시에 같은 position 5 에 insert 하면?
  - LWW: 한 쪽 잃음 ✗
  - position 보정 (OT): 트랜스폼 매트릭스 복잡 ✗
  - CRDT: position 자체를 *globally unique identifier* 로 ✓
```

## 핵심 아이디어: position → globally unique ID

전통적 List 는 *index* 로 위치를 가리킨다 → 동시 insert 시 index 충돌. CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입) 의 답: **각 element 에 globally unique 한 dense identifier** 부여.

```
"Hello"
  H — id_1
  e — id_2
  l — id_3
  l — id_4
  o — id_5

새 글자 ',' 를 e 와 l (id_2 와 id_3 사이) 에 삽입 → 새 id 생성:
  ',' — id_2.5    (id_2 < id_2.5 < id_3 인 dense order)
```

각 element 의 id 는 다음 조건 만족:
- **globally unique** (replica 마다 다른 id)
- **densely ordered** (어떤 두 id 사이에도 새 id 생성 가능)

## Logoot — dense identifier list

Weiss et al. 2009. 가장 단순한 sequence CRDT.

### Position 표현

```
Position = List<Identifier>
Identifier = (digit, replicaId, clock)

비교: lexicographic
  [(5, A, 1)] < [(5, A, 1), (3, B, 1)] < [(5, A, 1), (7, B, 1)] < [(6, A, 1)]
```

### Insert 로직

```
e1 와 e3 사이에 삽입:
  e1.position = [3, A, 1]
  e3.position = [5, A, 1]

  새 position 생성:
    e2.position = [4, B, 1]   (3 < 4 < 5)
    또는 [3, A, 1, 5, B, 1]   (공간 없으면 깊이 증가)
```

### 한계: tree depth 폭증

연속 insert at same position → identifier 길이 무한 증가.

```
"a"          → [5]
insert b at 0: [4]   → "ba"
insert c at 0: [3]   → "cba"
...
insert z at 0: 결국 [1, A, 1, 1, B, 1, ...] 깊이 폭증
```

## Treedoc — tree 기반

Treedoc 은 binary tree 구조로 dense identifier 를 자연스럽게 만든다.

```
       root
      /    \
     L      R
    / \    / \
   LL LR  RL RR

각 노드의 path 가 identifier (L, R 의 sequence)
inorder traversal 이 sequence 의 순서

새 노드 삽입: 두 인접 노드 사이의 *empty 자식 위치* 또는 새 leaf
```

장점: tree 구조라 identifier 가 짧음. 단점: balancing — 한쪽으로 자라면 imbalanced.

## RGA (Replicated Growable Array)

Roh et al. 2011. 협업 에디터의 *de facto* sequence CRDT.

### 자료구조

```
각 element:
  id: (replicaId, clock)
  value: char
  prev: id of insert anchor (어느 element 다음에 삽입됐나)
  removed: tombstone flag

state: 모든 element 의 set + prev 관계로 정의된 tree
```

### Insert 로직

```
"Hello" 의 e 다음에 ',' 삽입:
  new_element = ('B', 1)
  new_element.prev = e.id     (어느 위치에 삽입했나 명시)
  new_element.value = ','

state.add(new_element)
```

### Concurrent Insert 처리

같은 prev 에 두 replica 가 동시 insert?

```
A: insert 'x' after e.id, with id (A, 5)
B: insert 'y' after e.id, with id (B, 3)

같은 prev 에 두 children → tie-break by id
  (A, 5) > (B, 3) → A 의 'x' 가 *왼쪽*에 (또는 오른쪽, 정책에 따라)

결과: "He x y llo" 또는 "He y x llo"
```

순서는 결정되지만 *interleaving* 문제가 있다 — A 가 "Hello" 입력 중 B 가 "World" 입력 → 결과가 "HWeolrlold" 같이 섞일 수 있음. 이것이 RGA 의 약점이며 [Yata](#yata) 가 해결.

### Delete 로직

```
remove element with id (X, 5):
  state[(X, 5)].removed = true   (tombstone)

read 시 removed=true 는 skip
```

tombstone 은 영원히 누적 → GC 가 [12](12-garbage-collection.md) 에서 다룸.

## WOOT (WithOut Operational Transform)

Oster et al. 2006. RGA 의 선조.

```
각 char:
  id, value, prev, next, visible (tombstone)

insert 시 prev 와 next 명시
  → 두 char 사이에 들어갈 때 left.id 와 right.id 에 의해 위치 고정
```

WOOT 의 단점: 메타데이터 풍부 → 메모리 큼. RGA 가 더 가벼워 더 채택됨.

## Yata — Yjs 의 sequence CRDT

[Nicolaescu et al. 2016](https://www.researchgate.net/publication/310212186_Near_Real-Time_Peer-to-Peer_Shared_Editing_on_Extensible_Data_Types). RGA 의 진화. **interleaving 방지** 가 핵심.

### Origin Left / Origin Right

```
각 item:
  id: (clientId, clock)
  value: any
  originLeft: 삽입 시점의 *왼쪽 이웃* id
  originRight: 삽입 시점의 *오른쪽 이웃* id (RGA 의 prev 만으로 부족)
```

같은 origin 에 동시 insert 시 정렬 규칙:

```
같은 originLeft + originRight 인 두 item:
  → clientId 기준 정렬

다른 originLeft 또는 originRight:
  → 글로벌 일관성 위해 더 복잡한 규칙
```

### Interleaving 방지

```
A: 입력 "Hello"  (모두 같은 client)
B: 입력 "World"  (모두 같은 client, A 와 동시)

RGA: 결과가 "HWeolrlold" 같이 섞일 가능성
Yata: A 의 모든 글자가 originLeft/Right 가 같은 client 의 인접 char 라
     서로 *연속해서* 정렬됨 → "HelloWorld" 또는 "WorldHello" (block 으로)
```

### 시간 복잡도

```
RGA: 각 op O(log n) 평균
Yata: 같음. Y-CRDT (Yjs 의 Rust 재작성) 가 SOTA 성능
```

## 비교 표

| Sequence CRDT | identifier 형식 | concurrent 정렬 | interleaving | 메타데이터 |
|---|---|---|---|---|
| Logoot | dense list | id 비교 | 발생 가능 | identifier 깊이 폭증 |
| Treedoc | tree path | tree 위치 | 발생 가능 | tree balance 필요 |
| WOOT | (id, prev, next) | id tie-break | 발생 가능 | 큼 (prev/next 모두) |
| RGA | (replicaId, clock) + prev | id tie-break | 발생 가능 | 중간 |
| Yata | + originLeft + originRight | block 단위 정렬 | **방지** | RGA + originRight |

## 시뮬레이션 (간단 RGA)

```kotlin
data class RgaItem(
    val id: Pair<String, Long>,    // (replicaId, clock)
    val value: Char,
    val prev: Pair<String, Long>?, // 앞 item 의 id (null = head)
    val removed: Boolean = false
)

class RGA(val replicaId: String) {
    private val items = mutableListOf<RgaItem>()  // 정렬된 list
    private var clock = 0L

    fun insert(index: Int, value: Char): RgaItem {
        val prev = items.getOrNull(index - 1)?.id
        val item = RgaItem((replicaId, ++clock), value, prev)
        applyInsert(item)
        return item
    }

    fun applyInsert(item: RgaItem) {
        // prev 다음 위치 찾기, 같은 prev 에 다른 children 있으면 id 비교
        val prevIdx = if (item.prev == null) -1
                      else items.indexOfFirst { it.id == item.prev }
        var insertIdx = prevIdx + 1
        // tie-break: 같은 prev 의 다른 child 와 id 비교
        while (insertIdx < items.size &&
               items[insertIdx].prev == item.prev &&
               compareIds(items[insertIdx].id, item.id) > 0) {
            insertIdx++
        }
        items.add(insertIdx, item)
    }

    fun remove(index: Int) {
        val visibleIdx = visibleIndex(index)
        items[visibleIdx] = items[visibleIdx].copy(removed = true)
    }

    fun read(): String =
        items.filter { !it.removed }.map { it.value }.joinToString("")

    private fun compareIds(a: Pair<String, Long>, b: Pair<String, Long>): Int {
        val byClock = a.second.compareTo(b.second)
        return if (byClock != 0) byClock else a.first.compareTo(b.first)
    }

    private fun visibleIndex(visibleIdx: Int): Int {
        var count = -1
        items.forEachIndexed { idx, item ->
            if (!item.removed && ++count == visibleIdx) return idx
        }
        error("out of bounds")
    }
}
```

## 트레이드오프 박스

| 측면 | RGA | Yata | OT |
|---|---|---|---|
| concurrent insert 정렬 | id tie-break | block 단위 | transformation matrix |
| interleaving 방지 | ✗ | ✓ | ✓ |
| 구현 복잡도 | 중간 | 중간 | 매우 높음 |
| 메모리 | tombstone 누적 | 같음 | 적음 (op 만) |
| 채택 | 학술 + 일부 | Yjs (production) | Google Docs (legacy) |

## 면접 포인트

- **"협업 에디터(Notion/Figma)는 어떻게 동시 편집을 처리하나?"** — sequence CRDT (RGA / Yata 계열). 각 char 가 globally unique id 를 가지며, insert 는 id-anchored. 충돌은 id tie-break 으로 결정론적 정렬.
- **"왜 단순 index 가 안 되나?"** — concurrent insert 시 index 가 어긋남. A 가 idx 5 에 삽입, B 가 idx 5 에 삽입 → 어느 게 5 가 되나? globally unique id 로 해결.
- **"Yata 가 RGA 대비 진보한 점?"** — interleaving 방지. RGA 는 두 사용자가 동시에 다른 단어 입력 시 글자가 섞일 수 있음. Yata 는 originLeft + originRight 로 block 단위 정렬.
- **"tombstone 이 왜 문제?"** — 삭제 후에도 id 가 살아남음. 1MB 문서를 모두 삭제하면 1MB 만큼 tombstone. Yjs 는 *압축 가능한 tombstone* 으로 부담 줄임.

## 다음 학습

- [09-json-crdts.md](09-json-crdts.md) — Yjs / Automerge 가 sequence + map 을 어떻게 합성
- [12-garbage-collection.md](12-garbage-collection.md) — tombstone GC 의 어려움
- [14-crdt-vs-ot.md](14-crdt-vs-ot.md) — OT 와 본격 비교
