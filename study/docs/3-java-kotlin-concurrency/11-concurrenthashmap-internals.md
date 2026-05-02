---
parent: 3-java-kotlin-concurrency
seq: 11
title: ConcurrentHashMap 내부 (Java 7 vs 8)
type: deep
created: 2026-05-01
---

# 11. ConcurrentHashMap 내부

## 핵심 한 줄

ConcurrentHashMap 은 **Java 7 까진 segment 단위 락 (16개 정도)**, **Java 8 부턴 bin 단위 `synchronized` + CAS + 트리화** 로 구조가 바뀌었다. Java 8 버전이 contention 분산이 더 fine-grained 하고, hash collision 공격에도 트리 변환으로 방어한다.

## Java 7 — Segmented Locking

```
ConcurrentHashMap
├── Segment[0]   ── HashEntry[]  (작은 HashMap + ReentrantLock)
├── Segment[1]   ── HashEntry[]
├── Segment[2]   ── HashEntry[]
├── ...
└── Segment[15]  ── HashEntry[]
```

- 기본 segment 수 = 16 (`concurrencyLevel` 기본값)
- 각 segment 는 자체 `ReentrantLock` + 자체 hash table
- key 의 hash → 상위 비트로 segment 결정 → 하위 비트로 bucket
- segment *별* 로 락 → 동시 16개 write 가능

### 한계
- segment 수 *고정* — 동적 resize 안 됨
- segment 단위 락 → 같은 segment 의 다른 key 끼리도 직렬화
- segment 자체 메모리 오버헤드
- size() 가 모든 segment 동시 잠그거나 두 번 read 비교 — 비쌈

## Java 8 — bin-level synchronized + CAS

```
ConcurrentHashMap
└── Node[]   (= bins, 보통 16에서 시작 → resize 가능)
    [0] ──> Node ──> Node ──> Node                  (linked list, 충돌 적음)
    [1] ──> null
    [2] ──> TreeBin ──> TreeNode (Red-Black Tree)   (충돌 많음, 트리화)
    ...
```

- 단일 `Node[]` 배열 — segment 없음
- 빈 bin (head=null) 에 put → **CAS 만** 으로 head 설치 (락 없음)
- 비어있지 않은 bin → bin 의 *head node 객체* 에 `synchronized` (bin 단위 lock)
- bin 의 list 길이 ≥ 8 + table 크기 ≥ 64 → **TreeBin 으로 변환** (Red-Black Tree)
- list 길이 < 6 으로 줄면 다시 list 로

### 흐름 — `put`

```
put(key, value):
    1. hash = spread(key.hashCode())
    2. tab = table   // volatile read
    3. i = (tab.length - 1) & hash
    4. f = tab[i]    // volatile read

    5. if f == null:
           CAS 로 새 Node 를 tab[i] 에 set
           성공 → 끝
           실패 → retry (다른 스레드가 먼저 넣음)

    6. if f.hash == MOVED:    // resize 중
           helpTransfer()      // 다른 스레드의 resize 도움
           retry

    7. else:
           synchronized (f) {  // bin 의 head 노드에 락
              if f 가 list:
                  list 순회, 같은 key 면 update, 없으면 끝에 추가
              if f 가 TreeBin:
                  Red-Black Tree 에 insert
           }

    8. binCount >= TREEIFY_THRESHOLD(8) && tab.length >= MIN_TREEIFY_CAPACITY(64):
           treeifyBin(tab, i)   // list → tree 변환

    9. addCount(1, binCount)    // size 증가, 필요 시 resize 트리거
```

### 흐름 — `get`

```
get(key):
    1. hash = spread(key.hashCode())
    2. tab = table
    3. e = tab[(tab.length - 1) & hash]  // volatile read

    4. while e != null:
          if e.hash == hash && e.key == key:
              return e.val
          e = e.next

    5. return null
```

→ **read 는 락 없음**. linked list 의 next 가 volatile, value 도 volatile 이라 happens-before 보장. 매우 빠름.

## TreeBin — Red-Black Tree 변환

### 왜 트리화하나
- linked list 의 worst-case lookup = O(N)
- hash collision 공격 (모든 key 가 같은 bucket) → DoS
- Java 8 부터 **bin 안에서 list 길이 8 이상이면 RB 트리** → O(log N) 으로 격하

### 임계값
- `TREEIFY_THRESHOLD = 8` — list → tree
- `UNTREEIFY_THRESHOLD = 6` — tree → list (트리화 자체 비용 회수)
- `MIN_TREEIFY_CAPACITY = 64` — table 이 64 미만이면 트리화 대신 resize

### 차이점
- TreeBin 은 list 와 tree *둘 다 유지* — read 시 `find()` 가 tree 와 list 양쪽 검색 (write 중간 상태 견고)
- TreeBin 자체에 `lockState` 필드로 reader-writer 제어

## 동적 resize — Cooperative Transfer

table 크기가 부족하면 새 table (2배) 로 transfer.

### 협력적 (multi-thread) resize
- 한 스레드가 transfer 시작 → `nextTable` 에 새 table 할당
- 각 bin 을 옮길 때 원래 bin 에 `ForwardingNode` (hash=MOVED) 설치
- 다른 스레드의 put/get 이 ForwardingNode 만나면 → **자기도 transfer 도움**
- 모든 bin 이 옮겨지면 `table = nextTable` 교체

→ **resize 가 single-thread bottleneck 안 됨**. 매우 영리한 설계.

## CAS 의 역할

- **빈 bin 에 head 설치** — 가장 흔한 경우, 락 없이 CAS
- **size 카운트** — `LongAdder` 와 유사한 striped 구조 (`baseCount` + `CounterCell[]`)
- **resize 도움 요청** — `sizeCtl` 필드로 transfer 진행 상태 + 협력 카운트

## 메모리 일관성 (happens-before)

- `Node.val` 과 `Node.next` 는 `volatile`
- `table` 자체도 `volatile`
- `synchronized (f)` 에서 unlock → 후속 read 에 happens-before

→ **putAll → get** 사이에 명시적 동기화 없어도 가시성 보장. CHM 의 큰 가치 중 하나.

## `size()` 의 약속

- O(1) 또는 그에 근접 — `baseCount + sum(CounterCell[])`
- 단 *snapshot 이 아님* — 호출 도중 다른 스레드의 put/remove 가 반영될 수도 안 될 수도
- 정확한 size 가 필요한 곳엔 부적절. `mappingCount()` 도 동일 (return long)

## Java 7 vs 8 비교

| 측면 | Java 7 | Java 8 |
|---|---|---|
| 락 단위 | segment (~16개) | bin (table.length 개) |
| 동시 write 한도 | concurrencyLevel | table.length |
| Worst-case lookup | O(N/segment) | O(log N) (트리) |
| read 락 | 가끔 (재시도) | 거의 없음 (volatile) |
| size() | 약하게 정확 | 약하게 정확, 더 빠름 |
| resize | per-segment | 협력적 multi-thread |
| 메모리 오버헤드 | segment 객체 16개 + entries | Node[] + counter cells |
| 코드 라인 수 | ~1500 | ~6300 (복잡함) |

## 사용 시 주의

### 1. `null` key/value 금지

```kotlin
val map = ConcurrentHashMap<String, String?>()
map.put("a", null)   // ❌ NullPointerException
map.put(null, "v")   // ❌ NullPointerException
```

이유: `get(key)` 가 null 반환할 때 "key 없음" vs "값이 null" 을 구분 못 함. 동시 환경에서 putIfAbsent 등 의미 모호. 명시적 sentinel 객체 또는 `Optional` wrapping 권장.

### 2. `compute*` 의 람다는 락 안에서 실행

```kotlin
map.computeIfAbsent("a") { computeExpensive() }  // bin 의 락 안에서!
```

람다가 **수 ms+ 걸리거나 외부 IO** 면 같은 bin 의 다른 스레드 대기 → contention. 짧고 순수한 연산만 람다에 넣고, 무거운 건 미리 계산:

```kotlin
val v = computeExpensive()
map.putIfAbsent("a", v)
```

### 3. iteration 은 weakly consistent

```kotlin
for ((k, v) in map) { ... }
```

- iterator 는 ConcurrentModificationException 안 던짐
- 단 iteration 도중에 put 된 entry 가 보일 수도 안 보일 수도
- 정확한 snapshot 필요하면 `map.toMap()` 으로 복사

### 4. atomic 복합 연산은 `compute` 패밀리

```kotlin
// ❌
if (!map.containsKey(k)) map.put(k, v())

// ✅
map.putIfAbsent(k, v())          // 또는
map.computeIfAbsent(k) { v() }
```

`containsKey` + `put` 사이에 다른 스레드가 끼어들 수 있다.

## msa 코드 사용 패턴

```kotlin
// QuantMetrics.kt — 메트릭 캐시
private val ingestCounters = ConcurrentHashMap<String, Counter>()

fun ingestRows(symbol: String, count: Long) {
    ingestCounters.computeIfAbsent(symbol) {
        Counter.builder("quant_ingest_bithumb_rows_total")
            .tag("symbol", it).register(registry)
    }.increment(count.toDouble())
}
```

- counter 는 한 번 생성 후 재사용 → `computeIfAbsent` 가 정석
- 람다는 빠른 builder 호출 → bin 락 시간 짧음

```kotlin
// ClickHouseAuditLogPublisher.kt — tenant 별 Mutex
private val tenantLocks = ConcurrentHashMap<String, Mutex>()

override suspend fun publish(event: AuditEvent) {
    val mutex = tenantLocks.computeIfAbsent(event.tenantId) { Mutex() }
    mutex.withLock { /* ... */ }
}
```

- tenant 단위 직렬화 — global mutex 보다 분산
- `Mutex()` 생성 비용 무시할 만함

## 면접 단골

**Q. ConcurrentHashMap 의 Java 7 → 8 변경?**

Java 7 은 segment 단위 (보통 16개) 락 — segment 수가 contention 한도. Java 8 부턴 segment 사라지고 bin 단위 `synchronized` (head node 에) + 빈 bin 은 CAS. 추가로 list 길이 8 이상 + table 64 이상이면 Red-Black Tree 로 트리화 → worst-case O(log N) + hash collision DoS 방어.

**Q. ConcurrentHashMap 이 Hashtable 보다 빠른 이유?**

Hashtable 은 모든 메서드에 `synchronized(this)` — 글로벌 락이라 동시 1개 write/read. CHM 은 bin 단위라 table.length 만큼 동시 write 가능, read 는 거의 lock-free. 또 Hashtable 은 일반 메서드 호출이라 JIT 최적화 받기 어렵고, CHM 은 CAS + volatile 조합으로 hot path 가 inline 되기 좋다.

**Q. CHM 의 `size()` 가 정확한가?**

약하게 정확. O(1) 에 가까운 striped counter 를 합산하는데, 호출 도중 다른 스레드의 put/remove 가 반영될 수도 안 될 수도. snapshot 이 아니라 *순간 추정치*. 정확성이 중요하면 별도 동기화 (e.g., 모든 write 를 직렬화) 또는 `toMap()` 후 `size`.

**Q. CHM 에 null key/value 가 안 되는 이유?**

`get(k)` 의 null 반환이 "key 없음" 인지 "값이 null" 인지 모호. 동시 환경에선 follow-up 으로 `containsKey` 를 호출해도 race 상 의미 변함. 그래서 null 자체를 금지하고 명확한 시맨틱 유지. HashMap 은 단일 스레드 가정이라 null 허용.

**Q. CHM resize 가 어떻게 single-thread bottleneck 을 피하나?**

협력적 (cooperative) resize. transfer 시작한 스레드가 새 table 할당하고 bin 별로 옮기면서 원본 bin 에 ForwardingNode (hash=MOVED) 설치. 다른 스레드의 put/get 이 ForwardingNode 만나면 자기도 transfer 의 일부를 도와줌. 결과적으로 transfer 비용이 모든 활성 스레드에 분산.

## 다음 학습

- [12-stampedlock.md](12-stampedlock.md) — read 우세 + optimistic
- [08-concurrent-collections.md](08-concurrent-collections.md) — 다른 concurrent 컬렉션
