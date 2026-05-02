---
parent: 3-java-kotlin-concurrency
seq: 15
title: Flow + Channel + StateFlow / SharedFlow
type: deep
created: 2026-05-01
---

# 15. Flow + Channel

## 핵심 한 줄

`Flow` 는 **cold reactive stream** (collect 시점에 실행), `Channel` 은 **hot blocking-queue 스타일 conduit**, `StateFlow`/`SharedFlow` 는 **hot Flow 변형 (LiveData/RxJava Subject 대응)**. 셋의 차이를 구분 못 하면 cancellation 누수, backpressure 폭주, late subscriber 누락 같은 버그가 줄줄.

## 분류

```
Cold (collect 시 실행)            Hot (생산자 독립)
├── Flow                          ├── Channel
│                                 ├── SharedFlow
│                                 └── StateFlow (SharedFlow + 1 항목 캐시)
```

## Flow — cold stream

```kotlin
import kotlinx.coroutines.flow.*

// 생성
val numbers: Flow<Int> = flow {
    for (i in 1..3) {
        emit(i)
        delay(100)
    }
}

// 소비 — terminal operator (collect, toList, first, etc.)
runBlocking {
    numbers.collect { println(it) }
}
```

핵심:
- `flow { }` 빌더는 *suspend block* — emit 도 suspend
- `collect` 호출할 때마다 *처음부터* 다시 실행 (cold)
- collect 의 호출자 coroutine context 에서 실행 (호출자 스레드)
- collector 가 cancel 되면 producer 도 cancel

### Operator

```kotlin
flowOf(1, 2, 3, 4)
    .map { it * 2 }
    .filter { it > 4 }
    .collect { println(it) }   // 6, 8

flow {
    repeat(10) { emit(it) }
}
    .buffer(capacity = 4)             // upstream/downstream 분리 + 버퍼
    .conflate()                        // 가장 최근 값만 (skip)
    .debounce(100)                     // 100ms 안정 시 emit
    .flatMapMerge { fetchAsync(it) }  // 동시 N개 inner flow merge
    .flowOn(Dispatchers.IO)            // upstream context 변경
    .catch { e -> emit(-1) }           // 예외 처리
    .onCompletion { e -> log("done") } // 완료 시 hook
    .collect { ... }
```

### `flowOn` — upstream dispatcher 변경

```kotlin
flow {
    val data = readFile()        // IO
    emit(data)
}
.map { parse(it) }               // CPU
.flowOn(Dispatchers.IO)          // ← 이 위까지 IO dispatcher
.map { transform(it) }           // collect 호출자 스레드
.collect { use(it) }
```

- `flowOn` 은 *그 위* 의 stage 들을 명시한 dispatcher 에서 실행
- collect 자체는 *호출자* 의 dispatcher

## Channel — hot conduit

```kotlin
val channel = Channel<Int>(capacity = 10)

// Producer
launch {
    for (i in 1..100) {
        channel.send(i)        // suspend if full
    }
    channel.close()
}

// Consumer
launch {
    for (item in channel) {     // suspend if empty
        println(item)
    }
}
```

| Channel 종류 | capacity | 동작 |
|---|---|---|
| `RENDEZVOUS` (default, 0) | 0 | sender 와 receiver 가 같이 있어야 send 성공 (synchronous handoff) |
| `Channel(N)` | N | buffered, full 이면 send suspend |
| `UNLIMITED` | Int.MAX | 메모리 무제한 (위험) |
| `CONFLATED` | 1 | 새 값이 옛 값 덮어씀 (이전 값 잃어버림) |
| `BUFFERED` | default 64 | 일반적 |

### Channel vs BlockingQueue

| 측면 | `BlockingQueue` | `Channel` |
|---|---|---|
| send/receive | block (스레드 점유) | suspend (스레드 풀려남) |
| close | shutdown 일반화 안 됨 | `close()` 로 명시적 종료 + 이후 send → exception |
| cancellation | 별도 처리 필요 | coroutine cancel 자연 전파 |

→ coroutine 환경이면 거의 항상 Channel 우선.

## SharedFlow — hot, multi-collector broadcast

```kotlin
val events = MutableSharedFlow<Event>(
    replay = 0,                                    // 늦게 collect 한 사람에게 직전 N개 재전송
    extraBufferCapacity = 64,                      // 버퍼 (suspend 회피)
    onBufferOverflow = BufferOverflow.SUSPEND       // SUSPEND / DROP_OLDEST / DROP_LATEST
)

// 생산자
events.emit(Event(...))         // suspend 가능

// 소비자 (여러 명)
launch {
    events.collect { event -> ... }
}
launch {
    events.collect { event -> ... }   // 다른 소비자
}
```

특징:
- collect 가 여러 개 가능 — 모든 collector 가 같은 emit 받음 (broadcast)
- replay > 0 → 늦게 join 한 collector 가 직전 N개 받음
- buffer overflow 정책 선택

### `BufferOverflow` 종류

| 정책 | 동작 | 사용처 |
|---|---|---|
| `SUSPEND` | producer 가 suspend (backpressure) | 모든 데이터 보존 필요 |
| `DROP_OLDEST` | 가장 오래된 항목 버림 | 최신성 우선 |
| `DROP_LATEST` | 새 항목 버림 | 옛 항목 보존 우선 |

## StateFlow — SharedFlow + 1 캐시

```kotlin
val state = MutableStateFlow(0)   // 초기값 필수

// 갱신
state.value = 1
state.update { it + 1 }            // atomic

// 구독
launch {
    state.collect { value -> println("state: $value") }
    // 즉시 현재 값 1회 받고, 이후 변경마다 수신
}

// snapshot
val current = state.value
```

특징:
- 항상 *현재 값* 1개 보유 → late subscriber 가 즉시 받음
- **distinctUntilChanged 자동** — 같은 값 재set 해도 emit 안 함
- LiveData / Rx BehaviorSubject 와 유사
- ViewModel state, UI state holder 의 표준

## Flow vs Reactor (Mono/Flux)

| 측면 | Flow | Reactor |
|---|---|---|
| Cold | 기본 | Mono/Flux 도 기본 cold |
| Hot | SharedFlow / StateFlow | Sinks |
| Backpressure | suspend 자연 | request(n) / drop / buffer |
| 구문 | suspend 직선 코드 | `flatMap` 체인 |
| context | CoroutineContext | Reactor Context |
| 학습 곡선 | 낮음 | 높음 (operator 100+ 개) |

## Channel 패턴 — fan-out / fan-in

### Fan-out (1 producer → N consumer)

```kotlin
val channel = Channel<Job>()

// 1 producer
launch {
    repeat(100) { channel.send(Job(it)) }
    channel.close()
}

// N consumer
repeat(8) { workerId ->
    launch {
        for (job in channel) {
            process(workerId, job)
        }
    }
}
```

- 같은 Channel 에서 receive 는 *경합* — 1개의 job 은 1명의 consumer 만 받음
- worker pool 패턴 — 분산 처리

### Fan-in (N producer → 1 consumer)

```kotlin
val channel = Channel<Result>()

// N producer
listOf(api1, api2, api3).forEach { api ->
    launch {
        val r = api.call()
        channel.send(r)
    }
}

// 1 consumer
launch {
    repeat(3) {
        val r = channel.receive()
        log.info { "got: $r" }
    }
    channel.close()
}
```

## msa 코드 사례

```kotlin
// quant/MarketDataHub.kt — SharedFlow 로 시세 fan-out
class MarketDataHub {
    private val _ticks = MutableSharedFlow<Tick>(
        replay = 0,
        extraBufferCapacity = 256,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val ticks: SharedFlow<Tick> = _ticks.asSharedFlow()

    private val latestTicks = ConcurrentHashMap<Symbol, Tick>()

    suspend fun emit(tick: Tick) {
        latestTicks[tick.symbol] = tick
        _ticks.emit(tick)
    }

    fun latest(symbol: Symbol): Tick? = latestTicks[symbol]
}
```

좋은 패턴:
- `SharedFlow` — 여러 strategy evaluator 가 동시 구독 (broadcast)
- `DROP_OLDEST` — 시세는 최신성 우선, 옛 tick 은 버려도 됨
- `latestTicks` (ConcurrentHashMap) — replay=0 이라 latest 별도 캐시 필요
- `extraBufferCapacity = 256` — short burst 흡수, 평소엔 SUSPEND 비용 회피

```kotlin
// quant/MarketTickKafkaCollector.kt — SharedFlow consume
launch {
    hub.ticks.collect { tick ->
        kafkaTemplate.send("quant.market.tick", tick.symbol, tick)
    }
}
```

`MarketDataHub.ticks` 를 collect 해서 Kafka 로 fan-out — Channel 보다 SharedFlow 가 적합 (다른 collector 와 공존).

## 흔한 실수

### 1. Flow 를 hot 처럼 쓰기

```kotlin
val flow = flow { while (true) emit(fetch()) }   // cold!

launch { flow.collect { use(it) } }
launch { flow.collect { use(it) } }   // 두 collector 가 별개로 fetch 실행 — race
```

→ `shareIn(scope, SharingStarted.Eagerly)` 또는 `stateIn(...)` 으로 hot 변환.

```kotlin
val hot = flow.shareIn(scope, SharingStarted.WhileSubscribed(), replay = 0)
```

### 2. Channel close 안 함

producer 가 끝나도 close 안 하면 consumer 의 `for` 루프가 영원히 대기. 반드시 명시 close.

### 3. SharedFlow `tryEmit` 의 함정

```kotlin
val flow = MutableSharedFlow<Int>()      // buffer 0
flow.tryEmit(1)                          // false (subscriber 없거나 buffer 없음)
```

`tryEmit` 은 *non-blocking* 이라 buffer 안 차고 subscriber 없으면 그냥 false. emit 누락. `extraBufferCapacity` 또는 `replay` 에 의존.

### 4. StateFlow distinct 함정

```kotlin
val state = MutableStateFlow(0)
state.value = 0    // emit 안 됨 (같은 값)
```

같은 값 재set 의 emit 이 필요하면 SharedFlow 사용.

## 면접 단골

**Q. Flow 와 Channel 의 차이?**

Flow 는 *cold* — collect 시점에 producer 시작, collect 마다 별도 실행. Channel 은 *hot* — producer 가 독립적으로 실행되고 receive 가 큐에서 가져옴. 1:1 단순 stream 이면 Flow, 여러 producer/consumer 가 있는 conduit 이면 Channel. 다중 broadcast 면 SharedFlow.

**Q. SharedFlow 와 StateFlow 차이?**

StateFlow 는 SharedFlow 의 특수 케이스 — `replay=1` + `BufferOverflow.DROP_OLDEST` + initial value 필수 + distinctUntilChanged 자동. 항상 *현재 값* 1개를 들고 있어서 late subscriber 가 즉시 받음. UI state 같은 "현재 값" 이 의미 있는 경우 StateFlow, 일반 이벤트 broadcast 는 SharedFlow.

**Q. Channel 의 capacity 가 0 (RENDEZVOUS) 의 의미?**

producer 의 send 가 *consumer 의 receive 와 짝지어 져야* 성공. send 가 receive 를 만나기 전엔 suspend. 즉 매번 1:1 hand-off. 동기적 유사 패턴 — back-pressure 가 자연스럽게 producer 까지 전달. 일반적으론 capacity 양수가 throughput 좋음.

**Q. backpressure 를 Flow 가 어떻게 다루나?**

`emit` 자체가 suspend 함수라, downstream 이 처리 못 하면 *upstream 이 자동 suspend*. 별도 request(n) 같은 신호 없이 자연스러운 backpressure. `buffer()` operator 로 분리 가능 (큐 끼우기), `conflate()` 로 가장 최근만 유지, `collectLatest` 로 옛 collect 취소. Reactor 의 명시적 backpressure 와 다른 접근.

**Q. `flowOn` 과 `withContext` 차이?**

`withContext` 는 *suspend block 의 dispatcher 변경* — 단발성 / non-stream. `flowOn` 은 *Flow chain 의 upstream stage 의 dispatcher 변경* — stream 안의 emit/operator 가 영향. collect 자체는 호출자 context 라는 점은 동일.

## 다음 학습

- [16-structured-concurrency.md](16-structured-concurrency.md) — scope, Job
- [18-reactor-vs-coroutine.md](18-reactor-vs-coroutine.md) — Reactor 비교
