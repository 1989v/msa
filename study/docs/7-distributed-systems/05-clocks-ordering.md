---
parent: 7-distributed-systems
type: deep
order: 05
created: 2026-05-01
---

# 05. 시계와 순서 — Lamport, Vector, Hybrid Logical Clock

> "이벤트 순서를 알기 위해 wall clock 을 비교하는" 모든 코드는 **잠재적 버그**다.

## 1. 분산 시스템에서 시간이 어려운 이유

### 1.1 Wall clock 의 한계

| 문제 | 영향 |
|---|---|
| NTP drift | 노드 간 ±수십 ms ~ 수 s 어긋남 |
| Leap second | 시계가 거꾸로 갈 수도 (NTP slewing 으로 흡수) |
| VM live migration | 시계가 갑자기 점프 (수 초~분) |
| GC pause (수 초) | 그동안의 시간은 "잃어버림" |
| 시계 조정 (`ntpdate`) | 시계가 점프 |

### 1.2 timestamp 비교의 위험

```kotlin
// 안티패턴
@RestController
class CommentController {
    @PostMapping
    fun create(req: CommentRequest): Comment {
        return Comment(
            content = req.content,
            createdAt = System.currentTimeMillis()  // ← 노드마다 다름
        )
    }
}

// 다른 노드에서 비교
if (commentA.createdAt > commentB.createdAt) {
    // 정말 A 가 나중인가? — 노드 시계가 어긋났을 수 있음
}
```

**해법**: 인과관계 (happens-before) 기반의 **논리 시계** 사용.

## 2. Happens-Before 관계 (Lamport, 1978)

이벤트 a → b 의 **happens-before** 관계는 다음 중 하나:

1. **같은 노드** 에서 a 가 b 보다 먼저 실행됨 (program order)
2. a 는 **메시지 send**, b 는 그 메시지의 **receive**
3. **transitive**: a → b 이고 b → c 이면 a → c

a → b 가 아니고 b → a 도 아니면 → **concurrent (a || b)** = 인과 관계 없음.

**핵심 통찰**: wall clock 없이도 인과 순서를 정의할 수 있다. 모든 분산 시계 알고리즘이 이걸 기반으로 작동.

## 3. Lamport Clock

### 3.1 알고리즘

각 노드는 logical counter `L` 을 가짐.

```
1. 로컬 이벤트 발생 시: L = L + 1
2. 메시지 보낼 때: L = L + 1, 메시지에 L 첨부
3. 메시지 받을 때: L = max(L, msg.L) + 1
```

### 3.2 예시

```
Node A: L=1 (event a)
Node A: L=2 (send msg → B, msg.L=2)
Node B: L=0 → max(0,2)+1 = 3 (recv msg)
Node B: L=4 (event b on B)
```

### 3.3 보장과 한계

- **보장**: a → b 이면 L(a) < L(b)
- **한계**: L(a) < L(b) 라고 해서 a → b 라고 단정 못 함 (concurrent 일 수도)

→ 즉 Lamport 는 **partial order** 만 줌. **total order** 가 필요하면 노드 ID 로 tiebreak: `(L, nodeId)`.

### 3.4 Total Order Broadcast 응용

Lamport Clock + 노드 ID + queue 로 **total order multicast** 구현 가능. ZooKeeper Atomic Broadcast (ZAB) 의 기초.

## 4. Vector Clock

### 4.1 알고리즘

각 노드는 모든 노드의 카운터를 가지는 **벡터** `V[1..N]` 보유.

```
Node i:
1. 로컬 이벤트: V[i] += 1
2. 메시지 보낼 때: V[i] += 1, 메시지에 V 첨부
3. 메시지 받을 때: V[j] = max(V[j], msg.V[j]) for all j; then V[i] += 1
```

### 4.2 비교 연산

두 vector clock V1, V2:
- V1 ≤ V2 ⟺ 모든 j 에 대해 V1[j] ≤ V2[j]
- V1 < V2 ⟺ V1 ≤ V2 이고 V1 ≠ V2 → **V1 happens-before V2**
- V1 ≮ V2 이고 V2 ≮ V1 → **CONCURRENT**

### 4.3 예시

```
A: [1,0,0] (event)
A: [2,0,0] (send → B)
B: [0,0,0] → [2,1,0] (recv from A)
C: [0,0,1] (independent event)

A vs B: [2,0,0] < [2,1,0] → A happens-before B
A vs C: [2,0,0] vs [0,0,1] → CONCURRENT (서로 not ≤)
```

### 4.4 응용

- DynamoDB (구버전), Riak: 충돌 감지 → 사용자에게 sibling 보여주거나 CRDT 로 자동 merge
- 14번 CRDT/MRDT 의 토대
- 분산 디버깅 (인과 추적)

### 4.5 한계

- 메타데이터 크기가 **노드 수에 비례** → 수천 노드면 비현실적
- 노드 추가/삭제 시 크기 관리 어려움
- → 대규모 시스템은 **Hybrid Logical Clock (HLC)** 으로 절충

## 5. Hybrid Logical Clock (HLC)

CockroachDB, MongoDB ChangeStream 이 사용.

```
HLC = (physical_time, logical_counter)

알고리즘:
1. 로컬: pt = max(pt, wallclock); lc += 1
2. send: 메시지에 (pt, lc) 첨부
3. recv: 새 pt = max(local.pt, recv.pt, wallclock)
        if new pt == local.pt == recv.pt: lc = max(local.lc, recv.lc) + 1
        elif new pt == local.pt: lc += 1
        elif new pt == recv.pt: lc = recv.lc + 1
        else: lc = 0
```

### 장점
- wall clock 에 가까운 값 (사람이 읽기 쉬움)
- 인과 순서 보장 (Lamport 의 monotonic 성질)
- 크기가 고정 (vector 처럼 안 커짐)
- NTP drift 가 작으면 wall clock 과 거의 일치

### 단점
- vector 처럼 concurrent 정확히 감지 못 함

## 6. Spanner 의 TrueTime — 또 다른 답

Google Spanner 의 핵심: GPS + 원자 시계로 **시간 불확실성 (uncertainty interval)** 을 ε ≤ 7ms 로 제한.

```
TT.now() = [earliest, latest]
write commit 후: latest 가 지날 때까지 wait (commit-wait)
→ 글로벌 외부 일관성 (linearizable across regions)
```

**의의**: 하드웨어 시계로 분산 합의 latency 를 줄이는 첫 시도. 일반 기업은 못 흉내. 하지만 "왜 시간이 비싼가" 의 답.

## 7. msa 프로젝트 적용

### 7.1 현재 — wall clock 의존

```kotlin
// fulfillment 의 OutboxJpaEntity (단순화)
class OutboxJpaEntity(
    var createdAt: LocalDateTime = LocalDateTime.now(),  // ← wall clock
    var publishedAt: LocalDateTime? = null,
)
```

- Outbox polling 은 같은 노드의 wall clock 기준이라 OK (같은 노드 내 비교)
- **Kafka offset / partition** 이 사실상 logical clock 역할

### 7.2 Kafka 의 logical clock = offset

```
partition 안에서 offset 0 → 1 → 2 → ... 는 total order
서로 다른 partition 간엔 순서 없음 (parallel = concurrent)
→ key 로 같은 partition 으로 보내면 그 key 의 이벤트들은 total order
```

msa 의 `outbox.aggregateId` 를 Kafka key 로 사용 → 같은 aggregate 의 이벤트는 순서 보장.

### 7.3 면접 답변 템플릿

> "msa 에서 이벤트 순서가 중요한 곳은 같은 aggregate (예: 같은 inventory 의 reserved/released/confirmed) 입니다. Kafka 의 partition 안에서 offset 이 logical clock 역할을 하므로, **aggregate ID 를 partition key 로** 보내서 순서를 보장합니다.
> 다른 aggregate 끼리는 concurrent 라고 보고, 멱등 consumer + processed_event 로 안전하게 처리합니다."

## 8. 코드 예시: Lamport Clock in Kotlin

```kotlin
class LamportClock(initial: Long = 0) {
    private val counter = AtomicLong(initial)

    fun localEvent(): Long = counter.incrementAndGet()

    fun beforeSend(): Long = counter.incrementAndGet()

    fun afterReceive(received: Long): Long {
        while (true) {
            val current = counter.get()
            val next = max(current, received) + 1
            if (counter.compareAndSet(current, next)) return next
        }
    }
}
```

## 9. 코드 예시: Vector Clock 비교

```kotlin
data class VectorClock(val nodeId: String, val map: Map<String, Long> = emptyMap()) {
    fun increment(): VectorClock =
        copy(map = map + (nodeId to (map[nodeId] ?: 0) + 1))

    fun merge(other: VectorClock): VectorClock {
        val keys = map.keys + other.map.keys
        val merged = keys.associateWith { max(map[it] ?: 0, other.map[it] ?: 0) }
        return copy(map = merged + (nodeId to (merged[nodeId] ?: 0) + 1))
    }

    enum class Order { BEFORE, AFTER, EQUAL, CONCURRENT }

    fun compare(other: VectorClock): Order {
        val keys = map.keys + other.map.keys
        var le = true
        var ge = true
        for (k in keys) {
            val a = map[k] ?: 0
            val b = other.map[k] ?: 0
            if (a > b) le = false
            if (a < b) ge = false
        }
        return when {
            le && ge -> Order.EQUAL
            le -> Order.BEFORE
            ge -> Order.AFTER
            else -> Order.CONCURRENT
        }
    }
}
```

## 10. 함정 피하기

- **"DB 의 timestamp 컬럼만 비교하면 되지 않나?"** — 같은 DB 노드 안에서만 OK. cross-node 비교는 위험
- **"NTP 잘 맞추면 ms 단위 정확하지 않나?"** — 평소엔 그렇지만 GC pause / VM migration 등 outlier 가 자주 발생
- **"Kafka producer timestamp 사용해도 되지 않나?"** — broker 가 자기 시계로 덮어쓰기 가능 (`message.timestamp.type=LogAppendTime`). 정확한 인과는 offset 으로
- **"sequence number 만 쓰면 되지 않나?"** — 단일 producer 한정. 분산 producer 는 unique 보장 어려움 (UUID + Lamport 같이)

## 11. 한 줄 요약

> Wall clock 은 사람이 읽는 용도, 인과 판단은 **logical clock** (Lamport / Vector / HLC).
> Kafka 의 partition + offset 이 사실상 logical clock 이므로, **partition key 설계가 곧 순서 보장 설계** 다.

## 12. 더 읽기

- Leslie Lamport, "Time, Clocks, and the Ordering of Events" (1978)
- Mattern, "Virtual Time and Global States of Distributed Systems" (1988) — Vector Clock
- Kulkarni et al., "Logical Physical Clocks" (2014) — HLC
- 14번 CRDT/MRDT 와 cross-ref
