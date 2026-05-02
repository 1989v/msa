---
parent: 14-crdt-mrdt
seq: 07
title: Map CRDT — OR-Map · Riak DT Map · 재귀 합성
type: deep
created: 2026-05-01
---

# 07. Map CRDT

Key → CRDT 의 매핑. **재귀 합성** 의 시작점이며, 실 시스템에서 가장 자주 쓰이는 CRDT (왜냐하면 JSON document 가 본질적으로 Map).

## 단순 Map의 문제

```kotlin
// Naive: Map<K, V> + 키별 LWW
data class NaiveMap<K, V>(val entries: Map<K, Pair<V, Long>>) {
    fun put(k: K, v: V, t: Long) = ...
    fun merge(other) = each key 에 대해 LWW
}
```

문제 — **value 가 CRDT 면?**

```
A: map["counter"] += 1   (Counter CRDT)
B: map["counter"] += 1   (Counter CRDT)

LWW 로 merge → 한 쪽 +1 만 살아남음 ✗
```

value 가 CRDT 라면 merge 도 *재귀적으로* CRDT merge 여야 한다.

## OR-Map (Observed-Remove Map)

[OR-Set](05-set-crdts.md) 의 일반화. key 의 add/remove 를 OR-Set 처럼, value 는 *embedded CRDT*.

### 자료구조 (의사코드)

```
state:
  entries: Map<key, Map<tag, value>>   — 각 key 가 여러 tag 로 add 됨
  tombstones: Set<tag>

put(k, v):
  새 unique tag t
  entries[k][t] = v

remove(k):
  observed_tags = entries[k].keys
  tombstones += observed_tags
  (entries[k] 에서 observed_tags 제거)

read(k):
  alive_values = entries[k].filter { tag !in tombstones }.values
  if alive_values is empty: ⊥
  else: merge_all(alive_values)   ← value 가 CRDT 라 merge 가능

merge:
  entries 합집합 (tag 별로 — Map<key, Map<tag, value>> 의 두 단계 union)
  tombstones 합집합
```

### 시나리오: concurrent put + remove

```
A: put("counter", G-Counter{A:5})  with tag tA1
A 와 B sync
B: remove("counter") → tombstones = {tA1}
B: put("counter", G-Counter{B:3}) with tag tB1

merge 결과:
  entries["counter"] = {tA1: G-Counter{A:5}, tB1: G-Counter{B:3}}
  tombstones = {tA1}

  alive: {tB1: G-Counter{B:3}}
  read("counter") → G-Counter{B:3} → value=3
```

A 의 G-Counter{A:5} 는 죽음 (tA1 이 tombstone). B 의 새 add 만 살아남음.

### Embedded CRDT 의 reset 문제

가장 까다로운 부분. `remove(k)` 후 다시 `put(k, ...)` 했을 때, *새 인스턴스* 인가 *기존 의 reset* 인가?

```
remove("counter") 의 의미:
  옵션 1: counter 를 0 으로 reset
  옵션 2: counter 를 *지움* — 다음 put 은 새 instance
```

Riak DT 는 옵션 2 — observed-remove 시맨틱. tombstone 으로 죽은 tag 의 value 는 무시되고, 새 put 은 새 tag 로 새 인스턴스.

## Riak DT Map

Riak 의 production-grade Map CRDT. 재귀 합성 가능.

### 지원 타입

```
Riak DT Map 의 value 는 다음 CRDT 중 하나:
  - Counter (PN-Counter)
  - Set (OR-Set)
  - Register (LWW)
  - Flag (enable/disable)
  - Map (재귀!)
```

### 사용 예

```
{
  "user-123": {
    "profile": Map {
      "name": Register "Alice",
      "age": Register 30
    },
    "tags": Set {"vip", "early-adopter"},
    "loginCount": Counter 42,
    "premium": Flag true
  }
}
```

JSON document 를 그대로 표현. 각 필드의 의미가 자료구조에 박혀 있어 자동 merge.

### update 구문

```
// Riak DT Map 의 update 는 path + sub-update
update(path=["user-123", "loginCount"], op=Increment(1))
update(path=["user-123", "tags"], op=Add("vip"))
update(path=["user-123", "premium"], op=Enable)
```

## Embedded Counter Reset 의 트릭

OR-Map 에서 embedded Counter 를 지웠다 다시 쓰는 것이 문제.

```
A: map["c"] = Counter, increment 5 times → 5
A 와 B sync
B: map["c"] increment 1 time            → 6
A: remove("c")                          → tombstone 처리
B: increment 1 more time                → 7

merge:
  - A 의 remove 는 본 적 있는 tag 만 죽임
  - B 의 increment 1 more time 은 *기존 tag 의 value* 를 변경
  - 결과: 죽은 거? 살아있는 거?
```

해결: **dot store** ([10-causal-context.md](10-causal-context.md)) — 각 op 가 dot 으로 표시되어 정확한 reset 의미가 정의됨.

세부 시맨틱은 시스템마다 다르며, Riak DT Map 의 답은 "concurrent inc + remove 시 inc 가 이김" (Add-Wins 일관성).

## JSON CRDT 와의 관계

OR-Map 의 재귀 합성이 곧 [Automerge / Yjs](09-json-crdts.md) 의 데이터 모델 본체.

```
Document
  = Map (top level)
    fields: Map<String, Map | List | Register | Counter>

List (RGA / Yata)
  items: Sequence CRDT
  each item: Map | Register | ...

Register
  value: any (LWW)
```

따라서 협업 도구의 document 는 곧 **재귀 OR-Map**.

## 트레이드오프 박스

| 측면 | OR-Map (단순) | Riak DT Map (production) |
|---|---|---|
| reset 시맨틱 | 정의 필요 | observed-remove (정의됨) |
| 재귀 합성 | 가능하지만 손수 | 지원 (Counter/Set/Reg/Flag/Map) |
| 메타데이터 | 큼 (tag) | 큼 + causal context |
| 사용처 | 학습용 | Riak, 일부 KV 스토어 |

## msa 적용 검토

```
JSON document 같은 협업 데이터?  → 현 msa 에 없음.
사용자 프로필 (multi-device)?     → 단일 master 라 불필요.
quant 의 Strategy state?    → 단일 master + tenant scoped → CRDT 불필요.
```

만약 *오프라인 우선 모바일 앱* 을 추가한다면 OR-Map 검토 가치 있음. 자세한 결론은 [17](17-msa-application.md).

## 면접 포인트

- **"Map CRDT 가 왜 까다로운가?"** — value 가 CRDT 면 merge 도 재귀. key 의 add/remove 와 value 의 update 가 concurrent 일 때 reset 의미가 모호.
- **"OR-Map 의 reset 정책?"** — observed-remove. 본 적 있는 tag 만 죽음. concurrent put 은 새 tag 라 살아남음. embedded counter 도 새 인스턴스로 시작.
- **"Riak DT Map 의 가치?"** — 재귀 합성 + production-grade reset 시맨틱. JSON 비슷한 데이터를 자동 merge 가능. Riak 의 분산 KV 가 아닌 *분산 document store* 로 격상.
- **"Yjs/Automerge 와의 관계?"** — 두 시스템의 document 모델이 본질적으로 OR-Map + RGA(List) + LWW-Reg 의 재귀 합성.

## 다음 학습

- [08-sequence-crdts.md](08-sequence-crdts.md) — List 자료구조, RGA / Yata
- [09-json-crdts.md](09-json-crdts.md) — Yjs / Automerge 가 어떻게 합성하는가
- [10-causal-context.md](10-causal-context.md) — embedded reset 의 정확한 시맨틱
