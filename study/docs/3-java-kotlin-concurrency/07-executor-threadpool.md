---
parent: 3-java-kotlin-concurrency
seq: 07
title: Executor / ThreadPool / Fork-Join
type: deep
created: 2026-05-01
---

# 07. Executor / ThreadPool / Fork-Join

## 핵심 한 줄

`Executors.newXxx()` 의 기본값들은 **운영 환경에서 거의 다 함정** (unbounded queue, MAX_VALUE 풀 등). `ThreadPoolExecutor` 를 직접 구성하고, queue 종류 / RejectedExecutionHandler / 이름 부여까지 명시해야 한다.

## ThreadPoolExecutor 의 7요소

```java
new ThreadPoolExecutor(
    int corePoolSize,
    int maximumPoolSize,
    long keepAliveTime,
    TimeUnit unit,
    BlockingQueue<Runnable> workQueue,
    ThreadFactory threadFactory,
    RejectedExecutionHandler handler
)
```

### 작업 도착 시 분기 로직

```
새 task 도착
   │
   ▼
poolSize < corePoolSize ?
   ├ Yes → core thread 생성해서 실행
   │
   ▼ No
queue 에 offer 성공 ?
   ├ Yes → queue 에 적재 (대기)
   │
   ▼ No (queue full)
poolSize < maximumPoolSize ?
   ├ Yes → 추가 스레드 생성해서 실행
   │
   ▼ No
RejectedExecutionHandler 호출
```

**중요**: queue 가 *unbounded* 면 4번째 분기 (max 까지 늘어남) 가 절대 안 일어난다 — `core` 까지만 만들어지고 영원히 queue 에 쌓인다. 이게 `Executors.newFixedThreadPool` 의 함정.

## Executors 의 함정

| 팩토리 | 내부 | 위험 |
|---|---|---|
| `newFixedThreadPool(N)` | core=max=N, **`LinkedBlockingQueue` (unbounded)** | queue 에 무한 적재 → OOM |
| `newCachedThreadPool()` | core=0, **max=Integer.MAX_VALUE**, `SynchronousQueue` | 스레드 무제한 생성 → OOM |
| `newSingleThreadExecutor()` | 1개 스레드, **unbounded queue** | 같은 OOM 위험 |
| `newScheduledThreadPool(N)` | unbounded queue + 시간 우선순위 | OK 한 편 |
| `newWorkStealingPool()` | ForkJoinPool | OK, 단 task 가 IO blocking 이면 비효율 |

→ **Executors 거의 항상 직접 구성**. 다음 같은 안전 패턴.

```kotlin
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicInteger

fun safeExecutor(name: String, core: Int, max: Int, queueCapacity: Int): ExecutorService {
    val counter = AtomicInteger(0)
    return ThreadPoolExecutor(
        core, max,
        60L, TimeUnit.SECONDS,
        LinkedBlockingQueue(queueCapacity),    // bounded!
        ThreadFactory { r ->
            Thread(r, "$name-${counter.incrementAndGet()}").apply {
                isDaemon = false
                uncaughtExceptionHandler = Thread.UncaughtExceptionHandler { _, e ->
                    log.error(e) { "uncaught in $name" }
                }
            }
        },
        ThreadPoolExecutor.CallerRunsPolicy()  // 거부 시 호출자가 실행 = backpressure
    )
}
```

## RejectedExecutionHandler 4종

| 정책 | 행동 | 사용 |
|---|---|---|
| `AbortPolicy` (default) | `RejectedExecutionException` throw | 빠른 실패 |
| `CallerRunsPolicy` | 호출자 스레드가 직접 실행 | 자연스런 backpressure — 추천 |
| `DiscardPolicy` | 조용히 버림 | 절대 권장 안 함 (디버깅 지옥) |
| `DiscardOldestPolicy` | queue head 버리고 새 task 적재 | 최신성 우선 (메트릭 집계 등) |

**`CallerRunsPolicy` 가 보통 정답** — 호출자(주로 HTTP worker) 가 잠깐 직접 task 를 실행하면서 자연스럽게 backpressure 가 걸린다. 무한 queue 보다 훨씬 안전.

## queue 종류

| Queue | 특성 | 사용 |
|---|---|---|
| `LinkedBlockingQueue(N)` | linked list, capacity 지정 | 일반적 |
| `LinkedBlockingQueue()` | unbounded | **거의 안 씀** (OOM 위험) |
| `ArrayBlockingQueue(N)` | 배열, capacity 지정 | 메모리 안정성 우선 |
| `SynchronousQueue` | 0-capacity, 1:1 hand-off | `newCachedThreadPool` 의 패턴 |
| `PriorityBlockingQueue` | 우선순위 정렬 | task priority 필요할 때 |

## sizing — 풀 크기 결정

### CPU bound

`N = 코어 수 또는 코어 수 + 1`

JIT 컴파일/GC 같은 백그라운드 자원 고려. 이 이상은 컨텍스트 스위칭 비용으로 손해.

### IO bound

```
N = 코어 수 × (1 + W/C)
```

- W = wait time (IO 대기)
- C = compute time

예: HTTP 호출 99ms 대기 + 1ms 처리 → W/C = 99 → 8코어면 800 스레드. 이게 **현실적이지 않으니** 고전적으로 50-200 사이 두고, 정 부족하면 **virtual thread 또는 coroutine** 으로 우회.

### 측정 우선

이론보다 측정. JMH 또는 production load test 로 throughput / latency 곡선을 그려 sweet spot 찾기.

## ForkJoinPool — work stealing

Java 7 도입. **재귀적 분할 정복** task 에 최적화.

```java
class SumTask extends RecursiveTask<Long> {
    final long[] arr; final int start, end;
    static final int THRESHOLD = 1000;

    SumTask(long[] arr, int s, int e) { ... }

    @Override
    protected Long compute() {
        if (end - start < THRESHOLD) {
            long sum = 0;
            for (int i = start; i < end; i++) sum += arr[i];
            return sum;
        }
        int mid = (start + end) >>> 1;
        SumTask left = new SumTask(arr, start, mid);
        SumTask right = new SumTask(arr, mid, end);
        left.fork();              // 다른 worker 에 위임 가능
        long r = right.compute(); // 직접 실행
        long l = left.join();     // 결과 합산
        return l + r;
    }
}
```

### work stealing

- 각 worker thread 가 *자기 deque* 를 가짐
- task 처리 후 자기 deque 가 비면 *다른 worker 의 deque 꼬리* 에서 훔쳐옴
- LIFO (자기 stack), FIFO (훔침) → cache locality + 부하 분산

### `ForkJoinPool.commonPool()` — 공유 풀

`parallelStream()`, `CompletableFuture.supplyAsync()` (executor 안 주면) 가 다 이걸 씀.

**위험**:
- core 수 = `Runtime.availableProcessors() - 1` (보통 작음)
- *컨테이너* 환경에선 cgroup 제한 인식 못 해 호스트 코어 다 보고 풀이 너무 큼/작음
- 한 곳에서 long-running task 또는 blocking IO 호출하면 **전 시스템 영향**

→ **production 코드에선 `commonPool` 절대 안 쓰는 게 정공법**. 명시적 executor 주입.

```kotlin
// ❌ commonPool 사용
val cf = CompletableFuture.supplyAsync { fetchHttp() }

// ✅ 전용 executor
val httpExecutor = safeExecutor("http", 8, 32, 100)
val cf = CompletableFuture.supplyAsync({ fetchHttp() }, httpExecutor)
```

## 스레드 풀 모니터링 — 운영의 절반

```kotlin
class MonitoredExecutor(name: String, core: Int, max: Int, qCap: Int) {
    val pool = ThreadPoolExecutor(core, max, 60, TimeUnit.SECONDS, LinkedBlockingQueue(qCap))

    init {
        // Micrometer 메트릭
        Gauge.builder("$name.active") { pool.activeCount.toDouble() }.register(registry)
        Gauge.builder("$name.queue.size") { pool.queue.size.toDouble() }.register(registry)
        Gauge.builder("$name.pool.size") { pool.poolSize.toDouble() }.register(registry)
        Gauge.builder("$name.completed") { pool.completedTaskCount.toDouble() }.register(registry)
    }
}
```

알람:
- `queue.size` 가 capacity 의 80% 이상 지속 → 풀 작아짐
- `active` 가 max 도달 + queue 만석 → reject 임박
- `completed` 증가율 정체 → 워커 hang

## Spring `@Async` + Executor

Spring `@Async` 는 기본 `SimpleAsyncTaskExecutor` (스레드 매번 새로 만듦, 풀 아님!) 을 쓴다. **거의 항상 명시적 executor 빈 등록**.

```kotlin
@Configuration
@EnableAsync
class AsyncConfig : AsyncConfigurer {
    override fun getAsyncExecutor(): Executor {
        return ThreadPoolTaskExecutor().apply {
            corePoolSize = 8
            maxPoolSize = 32
            queueCapacity = 200
            setThreadNamePrefix("async-")
            setRejectedExecutionHandler(ThreadPoolExecutor.CallerRunsPolicy())
            initialize()
        }
    }
}
```

또는 메서드 단위로 executor bean 이름 지정: `@Async("emailExecutor")`.

## msa 코드 사례

```bash
$ grep -rn "@Async" --include="*.kt" msa | grep -v test
# 결과: 거의 비어있음
```

msa 는 `@Async` 보다 **coroutine + `Dispatchers.IO` / 명시적 `CoroutineScope`** 또는 **`@Scheduled`** 패턴이 주류. 예:

- `quant/NotificationDispatcher.kt:55` — `CoroutineScope(Dispatchers.IO + SupervisorJob())`
- `quant/BithumbWebSocketSubscriber.kt:104` — 같은 패턴
- `gifticon/ExpiryCheckScheduler.kt` — `@Scheduled`

`@Scheduled` 는 기본 단일 스레드 executor 사용 → **여러 잡이 동시에 도달하면 큐잉**. 진짜 병렬 필요하면 `TaskScheduler` 빈 명시:

```kotlin
@Bean
fun taskScheduler() = ThreadPoolTaskScheduler().apply {
    poolSize = 4
    setThreadNamePrefix("sched-")
    initialize()
}
```

`@EnableScheduling` 만 켜면 default 1-스레드.

## graceful shutdown

```kotlin
fun shutdown(pool: ExecutorService, timeoutSec: Long = 30) {
    pool.shutdown()  // 신규 task 거부, 진행 중은 완료
    try {
        if (!pool.awaitTermination(timeoutSec, TimeUnit.SECONDS)) {
            pool.shutdownNow()  // interrupt 발사
            if (!pool.awaitTermination(10, TimeUnit.SECONDS)) {
                log.error { "pool did not terminate" }
            }
        }
    } catch (e: InterruptedException) {
        pool.shutdownNow()
        Thread.currentThread().interrupt()
    }
}
```

Spring 의 `ThreadPoolTaskExecutor.setWaitForTasksToCompleteOnShutdown(true)` + `setAwaitTerminationSeconds(30)` 도 같은 효과.

## 면접 단골

**Q. `Executors.newCachedThreadPool` 의 위험?**

`max = Integer.MAX_VALUE`. 짧은 task 가 매우 많이 들어오면 OS 스레드를 무제한 생성하다 시스템이 죽는다. `SynchronousQueue` 라 queue 에 쌓이지도 않으니 매번 신규 스레드. 운영 환경에선 절대 안 쓰는 게 정공법, 직접 `ThreadPoolExecutor` 구성.

**Q. core, max 의 차이?**

core 는 idle 해도 죽지 않는 베이스라인 (단 `allowCoreThreadTimeOut(true)` 면 죽음). max 는 queue 가 차면 그 위로 늘어날 수 있는 한계. queue 가 unbounded 면 max 는 *절대 안 쓰임* — 모든 일이 queue 에 쌓인다. 그래서 max 가 의미 있으려면 queue 가 bounded 여야 한다.

**Q. `ForkJoinPool` 과 `ThreadPoolExecutor` 차이?**

ForkJoinPool 은 work-stealing deque 구조 + RecursiveTask 친화. 분할 정복 알고리즘 (parallel stream, 재귀 sum) 에 최적화. blocking IO 호출이 들어가면 work-stealing 이 도리어 효율 깨짐. 일반 task queue 패턴이라면 `ThreadPoolExecutor` 가 더 단순하고 명시적.

**Q. CallerRunsPolicy 의 의도?**

queue 가 차면 호출자(보통 web worker) 가 직접 실행하게 강제 → 호출자 스레드가 그동안 새 요청 못 받음 → 자연스런 backpressure. 거부하지 않고 자연 감속. 단점은 호출자 응답 시간이 직접 증가. 비동기 처리 전제로 호출하던 코드라면 동기처럼 동작해 surprise 가능.

**Q. `commonPool` 을 쓰면 안 되는 이유?**

크기가 호스트 CPU 기반인데 컨테이너에선 cgroup 인식이 부정확할 수 있고, parallelStream / CompletableFuture / fork-join task 가 모두 공유 → 한 곳의 blocking IO 가 시스템 전체에 영향. 명시적 executor 주입이 production 의 기본.

## 다음 학습

- [08-concurrent-collections.md](08-concurrent-collections.md) — concurrent 자료구조
- [13-completablefuture.md](13-completablefuture.md) — `CompletableFuture` + executor
- [17-virtual-threads.md](17-virtual-threads.md) — 풀의 한계를 어떻게 깨나
