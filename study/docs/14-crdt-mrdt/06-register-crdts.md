---
parent: 14-crdt-mrdt
seq: 06
title: Register CRDT — LWW-Register · MV-Register
type: deep
created: 2026-05-01
---

# 06. Register CRDT

Register = **single value 를 저장**하는 CRDT. 읽기 시 한 값을 반환해야 함. concurrent write 시 어떤 값을 고를지가 핵심.

두 패러다임:
- **LWW-Register** — timestamp 큰 쪽 채택 (충돌 시 한 값 선택)
- **MV-Register** — fork 보존 (충돌 시 양쪽 모두 보관, 앱이 결정)

## LWW-Register (Last-Write-Wins Register)

가장 단순. 단일 값 + timestamp.

### 정의

```
state: (value, timestamp)
write(v, t): if t > self.timestamp, replace
merge(a, b): a.timestamp > b.timestamp ? a : b   (tie-break: replicaId)
```

### Kotlin 구현

```kotlin
data class LWWRegister<T>(
    val value: T?,
    val timestamp: Long,
    val replicaId: String  // tie-breaker
) {
    fun write(v: T, t: Long, self: String): LWWRegister<T> {
        return if (t > timestamp || (t == timestamp && self > replicaId))
            LWWRegister(v, t, self)
        else this
    }

    fun merge(other: LWWRegister<T>): LWWRegister<T> {
        return when {
            timestamp > other.timestamp -> this
            other.timestamp > timestamp -> other
            replicaId > other.replicaId -> this  // tie-break
            else -> other
        }
    }
}
```

### 시나리오

```
A: write("Alice", t=100, A)  → ("Alice", 100, A)
B: write("Bob", t=99, B)     → ("Bob", 99, B)

merge → 100 > 99 → ("Alice", 100, A)
```

### Semilattice 검증

```
merge 가 ACI?
  - associative: max 의 일반화. 같은 timestamp 일 때 replicaId 로 tie-break → total order → ACI.
  - commutative: 정의상 ✓
  - idempotent: merge(a, a) = a ✓
```

`(timestamp, replicaId)` 의 lexicographic order 위에서 max 를 취하는 셈.

### 치명적 한계: clock skew

[01-distributed-conflict.md](01-distributed-conflict.md) 에서 본 LWW 의 본질적 문제 그대로.

```
Replica A clock: t=100 (실제 시각)
Replica B clock: t=99  (1ms 느림)

A: write("결제 진행 중", t=100)
B: write("결제 완료", t=101)   ← B 시각, 실제론 A 보다 2ms 늦음

→ B 의 timestamp 가 큼 → "결제 완료" 가 이김 (정상)

만약 B 가 더 느려서:
B: write("결제 완료", t=98)   ← 실제론 A 보다 늦지만 timestamp 작음
→ A 가 이김 → "결제 진행 중" 으로 lost update ✗
```

### 보완: Hybrid Logical Clock

```
HLC = (physical time, logical counter)

merge(a, b):
  if a.physical > b.physical: a
  elif a.physical < b.physical: b
  elif a.logical > b.logical: a
  else: b
```

CockroachDB / Riak 에서 사용. 완전한 해결은 아니지만 clock skew 영향 완화.

### Vector Clock 기반 LWW

```
write 시 vector clock 증가, merge 시 *concurrent* 만 LWW
  - happens-before 관계는 의도 그대로 보존
  - concurrent 일 때만 timestamp tie-break
```

이걸 더 발전시키면 **MV-Register**.

## MV-Register (Multi-Value Register)

LWW 가 한 값을 잃는 문제 해결: **concurrent 한 값 모두 보관**.

### 핵심: vector clock

```
state: Set<(value, vector_clock)>

write(v, vc): 새 vector clock 으로 entry 추가, 이전보다 작은 vc entry 모두 제거
merge(a, b):
    union(a, b) 후 happens-before 관계로 dominated entry 제거

read(): Set<value>  (concurrent 면 여러 값 반환)
```

### Kotlin 의사코드

```kotlin
data class VClock(val map: Map<String, Long> = emptyMap()) {
    fun increment(self: String): VClock =
        VClock(map + (self to (map[self] ?: 0) + 1))

    /** this happens-before other ? */
    fun happensBefore(other: VClock): Boolean {
        val ids = map.keys + other.map.keys
        var anyLess = false
        for (id in ids) {
            val a = map[id] ?: 0L
            val b = other.map[id] ?: 0L
            if (a > b) return false
            if (a < b) anyLess = true
        }
        return anyLess
    }
}

data class MVRegister<T>(
    val entries: Set<Pair<T, VClock>> = emptySet()
) {
    fun write(v: T, self: String): MVRegister<T> {
        // 모든 entry 의 vc 합쳐 하나 증가
        val newVc = entries.map { it.second }.fold(VClock()) { a, b ->
            VClock((a.map.keys + b.map.keys).associateWith {
                maxOf(a.map[it] ?: 0L, b.map[it] ?: 0L)
            })
        }.increment(self)
        return MVRegister(setOf(v to newVc))  // 새 write 가 이전 모두 dominate
    }

    fun merge(other: MVRegister<T>): MVRegister<T> {
        val combined = entries + other.entries
        // dominated entry 제거: 어떤 다른 entry 의 vc 가 자기 vc 를 dominate 하면 제거
        val survived = combined.filter { (_, vc) ->
            combined.none { (_, otherVc) -> vc.happensBefore(otherVc) }
        }.toSet()
        return MVRegister(survived)
    }

    fun read(): Set<T> = entries.map { it.first }.toSet()
}
```

### 시나리오: concurrent write

```
초기: {}

A: write("Alice")
  → entries = {("Alice", {A:1})}

B: write("Bob")  (A 의 write 못 봄)
  → entries = {("Bob", {B:1})}

merge:
  combined = {("Alice", {A:1}), ("Bob", {B:1})}
  Alice 의 vc {A:1} 와 Bob 의 vc {B:1} 는 concurrent (서로 happens-before 관계 없음)
  → 둘 다 살아남음

read() = {"Alice", "Bob"}   ← 앱이 sibling 처리
```

### 시나리오: causal write (overwrite)

```
A: write("Alice")  → ("Alice", {A:1})

A 와 B sync → B 도 ("Alice", {A:1})

B: write("Bob")
  → 새 vc = max({A:1}) increment B = {A:1, B:1}
  → entries = {("Bob", {A:1, B:1})}

  ("Alice", {A:1}) 는 dominated by {A:1, B:1} (이전 sync 로 알고 있음) → 제거
```

read() = {"Bob"} — Alice 가 깔끔하게 overwrite.

## LWW vs MV 선택

```
LWW-Register
  ✓ 단순, state 작음
  ✓ 항상 단일 값 반환
  ✗ clock skew → lost update
  ✗ concurrent intent 잃음

MV-Register
  ✓ concurrent intent 보존
  ✓ clock skew 영향 적음 (vc 비교)
  ✗ state 크기 증가
  ✗ read 가 set 반환 → 앱이 sibling 처리 필요
```

## 트레이드오프 박스

| 측면 | LWW-Register | MV-Register |
|---|---|---|
| 데이터 손실 | 가능 (clock skew) | 없음 (sibling 보존) |
| 메타데이터 | timestamp | vector clock |
| read 결과 | 단일 값 | 여러 값 가능 |
| 구현 복잡도 | 매우 낮음 | 중간 |
| 사용 예 | 캐시 마지막 갱신, presence | shopping cart 일부 필드 |

## 실제 시스템

### Cassandra
- 모든 column 이 LWW-Register
- timestamp 는 client 또는 server 가 부여
- clock skew 가 lost update 의 일반적 원인

### Riak
- 초기 — sibling 노출 (MV-Register 와 유사)
- Riak DT 도입 후 — register 도 CRDT 로 노출

### Redis CRDB (Enterprise)
- 모든 key 가 CRDT — set/add/del 등
- 단순 string key 는 LWW-Register

## msa 적용 검토

현 msa 에 register CRDT 가 직접 필요한 곳은 없다. 단, *이런 경우* 후보:

```
사용자 상태 (presence) — 마지막 로그인 시간, 디바이스
  → LWW-Register 충분 (작은 손실 허용)

사용자 프로필 — 닉네임, 프로필 이미지
  → MV-Register 가 더 안전 (multi-device 동시 수정 시 sibling)

상품 가격 — 단일 가격 필드
  → 단일 master (현 msa 모델) 가 가장 안전 — CRDT 부적합
```

## 면접 포인트

- **"LWW-Register 의 핵심 단점은?"** — clock skew. 두 노드 시계가 다르면 *나중* 쓰기가 *먼저* 쓰기에게 짐. NTP 가 흔히 100ms 어긋나면 100ms 차이로 들어온 두 쓰기 중 하나는 잃는다.
- **"MV-Register 가 LWW 의 대안인 이유?"** — vector clock 비교로 happens-before 와 concurrent 를 구분. concurrent 일 때만 둘 다 보존. clock skew 영향 거의 없음.
- **"MV-Register 의 read 가 여러 값?"** — 그렇다. 앱이 sibling 처리 필요. shopping cart 의 일부 필드 같은 경우 자연 (set union 으로 merge).
- **"HLC 가 clock skew 를 얼마나 해결?"** — physical+logical 결합. logical 부분이 ordering 을 보강. 그래도 *causal* 보장은 vector clock 만큼 강하지 않음.

## 다음 학습

- [07-map-crdts.md](07-map-crdts.md) — Map = key → register 의 합성
- [10-causal-context.md](10-causal-context.md) — vector clock 의 한계와 dot context
