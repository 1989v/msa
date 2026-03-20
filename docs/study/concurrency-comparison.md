# 병렬 처리 방식 비교: Virtual Threads vs Kotlin Coroutines

## 배경

상품 750개를 동시 5개씩 병렬로 처리해야 하는 상황.
각 상품 처리는 **외부 API 호출(I/O) + DB 저장(blocking)** 으로 구성된다.

---

## 1. Virtual Threads + j.u.c.Semaphore (현재 구현)

```kotlin
fun syncProvider(providerName: String) {
    val productVos = runBlocking { client.fetchProducts() }

    val semaphore = Semaphore(CONCURRENCY) // java.util.concurrent.Semaphore
    val successProducts = mutableListOf<ProductEntity>()
    val failedCount = AtomicInteger(0)

    Executors.newVirtualThreadPerTaskExecutor().use { executor ->
        val futures = productVos.map { productVo ->
            executor.submit {
                semaphore.acquire()
                try {
                    runCatching {
                        val events = runBlocking { client.fetchProductEvents(productVo.externalProductCode) }
                        productPersistService.persistProduct(providerName, productVo, events)
                    }.onSuccess { product ->
                        synchronized(successProducts) { successProducts.add(product) }
                    }.onFailure { e ->
                        failedCount.incrementAndGet()
                        log.error(e) { "[Sync] Failed: ${productVo.externalProductCode}" }
                    }
                } finally {
                    semaphore.release()
                }
            }
        }
        futures.forEach { it.get() } // 모든 작업 완료 대기
    }
}
```

### 동작 원리

```
[Virtual Thread Pool - unlimited]

VT-1: acquire(permit) → API 호출 → DB 저장 → release(permit)
VT-2: acquire(permit) → API 호출 → DB 저장 → release(permit)
VT-3: acquire(permit) → API 호출 → DB 저장 → release(permit)
VT-4: acquire(permit) → API 호출 → DB 저장 → release(permit)
VT-5: acquire(permit) → API 호출 → DB 저장 → release(permit)
VT-6: acquire(permit) → ❌ permit 없음 → 대기 (OS 스레드 반납)
                         ...VT-1 완료, release()...
VT-6:                  → permit 획득 → API 호출 → DB 저장 → release(permit)
```

- 750개 Virtual Thread가 즉시 생성되지만, Semaphore에 의해 동시 5개만 실행
- 대기 중인 VT는 OS 스레드를 점유하지 않음 (unmount)
- 하나가 끝나면 즉시 다음 VT가 permit 획득 → **파이프라인 효율 극대화**

---

## 2. Kotlin Coroutines + Semaphore

```kotlin
fun syncProvider(providerName: String) {
    val productVos = runBlocking { client.fetchProducts() }

    val semaphore = kotlinx.coroutines.sync.Semaphore(CONCURRENCY)
    val results = runBlocking {
        productVos.map { productVo ->
            async {
                semaphore.withPermit {
                    runCatching {
                        val events = client.fetchProductEvents(productVo.externalProductCode)
                        productPersistService.persistProduct(providerName, productVo, events)
                    }.fold(
                        onSuccess = { Result.success(it) },
                        onFailure = { e ->
                            log.error(e) { "[Sync] Failed: ${productVo.externalProductCode}" }
                            Result.failure(e)
                        },
                    )
                }
            }
        }.awaitAll()
    }
    val successProducts = results.mapNotNull { it.getOrNull() }
}
```

### 동작 원리

```
[Coroutine Dispatcher - Dispatchers.Default (CPU 코어 수만큼 스레드)]

runBlocking {
    async(coroutine-1) → semaphore.withPermit → suspend until permit → resume → 실행
    async(coroutine-2) → semaphore.withPermit → suspend until permit → resume → 실행
    ...
    async(coroutine-750) → semaphore.withPermit → suspend → 대기
}
```

- 750개 코루틴이 생성되고, Semaphore가 동시 5개만 permit
- 대기 중인 코루틴은 suspend 상태 (스레드 점유 안 함)
- `fetchProductEvents`는 suspend 함수라 자연스럽게 동작

---

## 3. Kotlin Coroutines + chunked (배치 방식)

```kotlin
fun syncProvider(providerName: String) {
    val productVos = runBlocking { client.fetchProducts() }

    val results = runBlocking {
        productVos.chunked(CONCURRENCY).flatMap { chunk ->
            chunk.map { productVo ->
                async {
                    runCatching {
                        val events = client.fetchProductEvents(productVo.externalProductCode)
                        productPersistService.persistProduct(providerName, productVo, events)
                    }.fold(
                        onSuccess = { Result.success(it) },
                        onFailure = { e ->
                            log.error(e) { "[Sync] Failed: ${productVo.externalProductCode}" }
                            Result.failure(e)
                        },
                    )
                }
            }.awaitAll() // ⚠️ chunk 내 모든 작업 완료까지 대기
        }
    }
    val successProducts = results.mapNotNull { it.getOrNull() }
}
```

### 동작 원리

```
Chunk 1: [상품1, 상품2, 상품3, 상품4, 상품5] → 5개 동시 실행 → 전부 완료 대기
Chunk 2: [상품6, 상품7, 상품8, 상품9, 상품10] → 5개 동시 실행 → 전부 완료 대기
...

⚠️ Chunk 1에서 상품3이 10초 걸리면?
→ 상품1,2,4,5가 1초에 끝나도 9초 동안 idle
→ Chunk 2는 상품3이 끝날 때까지 시작 불가
```

---

## 비교표

| 항목 | Virtual Threads + Semaphore | Coroutines + Semaphore | Coroutines + chunked |
|------|---------------------------|----------------------|---------------------|
| **동시성 제어** | j.u.c.Semaphore (permit) | coroutines Semaphore (permit) | chunk 크기로 제어 |
| **파이프라인 효율** | ✅ 빈 슬롯 즉시 채움 | ✅ 빈 슬롯 즉시 채움 | ❌ chunk 내 최느린 작업에 의존 |
| **blocking 호출 호환** | ✅ VT가 blocking에 최적화 | ⚠️ Dispatchers.Default 스레드 점유 | ⚠️ 동일 |
| **suspend 함수 호환** | ⚠️ runBlocking 필요 | ✅ 자연스러움 | ✅ 자연스러움 |
| **thread-safety** | synchronized/Atomic 필요 | 코루틴 컨텍스트로 해결 가능 | awaitAll() 반환값으로 해결 |
| **코드 복잡도** | 중간 (try-finally) | 낮음 (withPermit) | 낮음 |
| **Spring 트랜잭션 호환** | ✅ ThreadLocal 정상 동작 | ⚠️ 코루틴은 ThreadLocal 전파 주의 | ⚠️ 동일 |
| **Java 버전 요구** | Java 21+ | 제한 없음 | 제한 없음 |
| **대기 중 리소스** | VT 스택 ~수 KB (OS 스레드 반납) | 코루틴 객체 ~수백 B | 동일 |

---

## 핵심 판단 기준

### Virtual Threads를 선택해야 할 때
- **blocking 호출이 주**인 경우 (JDBC, HTTP 동기 호출, `@Transactional`)
- Spring의 `ThreadLocal` 기반 기능 (트랜잭션, 보안 컨텍스트)을 사용하는 경우
- Java 21+ 환경

### Coroutines를 선택해야 할 때
- **suspend 함수가 주**인 경우 (WebClient, R2DBC 등 비동기 I/O)
- blocking 호출이 없거나 적은 경우
- 멀티플랫폼(KMP) 지원이 필요한 경우

### chunked를 선택해야 할 때
- 동시성 제어보다 **배치 단위 처리**가 중요한 경우 (예: 100개씩 벌크 API)
- 각 작업의 처리 시간이 균일한 경우 (파이프라인 비효율이 미미)

---

## 현재 프로젝트에 Virtual Threads가 적합한 이유

1. `persistProduct()`는 `@Transactional` blocking 메서드 → VT가 최적
2. Spring의 `ThreadLocal` 기반 트랜잭션 전파 → VT는 ThreadLocal 정상 지원, 코루틴은 주의 필요
3. `fetchProductEvents()`는 suspend 함수지만 `runBlocking`으로 감싸서 호출 → VT에서 block해도 OS 스레드 반납
4. Java 23 환경 → VT가 표준

---

## 참고: Virtual Thread에서의 Semaphore 대기

```
Platform Thread (기존):
  Thread-6.acquire() → OS 스레드 1개 점유한 채 대기 → 비효율

Virtual Thread:
  VT-6.acquire() → OS 스레드 반납 (unmount) → 대기 → permit 획득 시 재할당 (mount)

  745개가 대기해도 OS 스레드 점유 = 0
  메모리 = 745 × ~수 KB = ~수 MB (무시 가능)
```

이것이 Virtual Thread + Semaphore 조합이 강력한 이유다.
기존 Platform Thread에서는 Semaphore 대기 = OS 스레드 낭비였지만,
Virtual Thread에서는 대기 비용이 거의 0이다.

---

# 부록: Mutex vs Semaphore vs Lock 비교

## 개념 정리

### Mutex (Mutual Exclusion)

**"한 번에 딱 1개만 들어갈 수 있는 방"**

```
Thread-1: lock()   → 진입 → 작업 중...
Thread-2: lock()   → ❌ 대기
Thread-3: lock()   → ❌ 대기
Thread-1: unlock() → 퇴장
Thread-2:          → 진입
```

- permit = 1 (항상 고정)
- **소유권(ownership)** 이 있음: lock을 건 스레드만 unlock 가능
- 용도: 공유 자원의 **상호 배제** (동시 수정 방지)

### Semaphore

**"한 번에 N개까지 들어갈 수 있는 주차장"**

```
Semaphore(3):

Thread-1: acquire() → 진입 (남은 permit: 2)
Thread-2: acquire() → 진입 (남은 permit: 1)
Thread-3: acquire() → 진입 (남은 permit: 0)
Thread-4: acquire() → ❌ 대기
Thread-1: release() → 퇴장 (남은 permit: 1)
Thread-4:           → 진입 (남은 permit: 0)
```

- permit = N (설정 가능)
- **소유권 없음**: acquire한 스레드와 release하는 스레드가 달라도 됨
- 용도: **동시 접근 수 제한** (rate limiting, connection pool)

### Semaphore(1) vs Mutex

겉보기에 같아 보이지만 다르다:

```
Semaphore(1):
  Thread-A: acquire()
  Thread-B: release()  ← ✅ 가능 (소유권 없음)

Mutex:
  Thread-A: lock()
  Thread-B: unlock()   ← ❌ 불가 (소유권 위반)
```

| 항목 | Mutex | Semaphore(1) |
|------|-------|-------------|
| 소유권 | 있음 (lock한 스레드만 unlock) | 없음 (아무나 release 가능) |
| 재진입 | ReentrantLock은 가능 | 불가 (permit 소진) |
| 용도 | 상호 배제 | 동시 접근 1개 제한 |
| 버그 가능성 | 낮음 (소유권 보장) | 높음 (잘못된 release 가능) |

---

## Java/Kotlin 구현체 매핑

### Java (java.util.concurrent)

```java
// Mutex 역할
ReentrantLock lock = new ReentrantLock();
lock.lock();
try {
    // 임계 영역
} finally {
    lock.unlock();
}

// synchronized (가장 단순한 Mutex)
synchronized (sharedResource) {
    // 임계 영역
}

// Semaphore
Semaphore semaphore = new Semaphore(5);
semaphore.acquire();
try {
    // 동시 5개까지 허용
} finally {
    semaphore.release();
}
```

### Kotlin Coroutines

```kotlin
// Mutex (코루틴용, suspend)
val mutex = kotlinx.coroutines.sync.Mutex()
mutex.withLock {
    // 임계 영역 (한 코루틴만)
}

// Semaphore (코루틴용, suspend)
val semaphore = kotlinx.coroutines.sync.Semaphore(5)
semaphore.withPermit {
    // 동시 5개까지 허용
}
```

---

## 비교표

| 항목 | synchronized | ReentrantLock | j.u.c.Semaphore | coroutine Mutex | coroutine Semaphore |
|------|-------------|---------------|-----------------|-----------------|---------------------|
| **동시 진입** | 1 | 1 | N | 1 | N |
| **소유권** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **재진입** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **대기 방식** | block (OS 스레드 점유) | block | block | suspend (스레드 반납) | suspend |
| **타임아웃** | ❌ | ✅ tryLock(timeout) | ✅ tryAcquire(timeout) | ✅ withTimeout | ✅ withTimeout |
| **공정성** | ❌ | 선택 가능 | 선택 가능 | FIFO | FIFO |
| **Virtual Thread 호환** | ⚠️ pinning 발생 | ✅ | ✅ | N/A (코루틴용) | N/A |

---

## 주의: synchronized + Virtual Thread = Pinning

```java
// ⚠️ Virtual Thread에서 synchronized 사용 시
synchronized (lock) {
    // Virtual Thread가 OS 스레드에 고정(pinned)됨
    // → Virtual Thread의 장점(OS 스레드 반납) 상실
    blockingCall();
}

// ✅ 대신 ReentrantLock 사용
val lock = ReentrantLock()
lock.lock()
try {
    blockingCall() // Virtual Thread가 정상적으로 unmount 가능
} finally {
    lock.unlock()
}
```

Java 24+에서는 synchronized의 pinning이 해결될 예정이지만,
Java 21~23에서는 **Virtual Thread + blocking 호출 시 ReentrantLock 권장**.

---

## 실무 선택 가이드

```
Q: 공유 자원을 보호해야 하는가?
├─ Yes → "한 번에 1개만 접근"
│   ├─ 코루틴 환경 → coroutine Mutex
│   ├─ Virtual Thread 환경 → ReentrantLock
│   └─ 일반 스레드 환경 → synchronized 또는 ReentrantLock
│
└─ No → "동시 실행 수를 제한해야 하는가?"
    ├─ Yes → "한 번에 N개까지 허용"
    │   ├─ 코루틴 환경 → coroutine Semaphore
    │   └─ 스레드 환경 → j.u.c.Semaphore
    │
    └─ No → 동기화 불필요
```

### 현재 프로젝트 적용 사례

| 위치 | 사용 | 이유 |
|------|------|------|
| `ProductSyncService` | `j.u.c.Semaphore(5)` | 외부 API + DB 동시 접근 수 제한 |
| `ProductSyncService` | `synchronized(successProducts)` | 결과 리스트 thread-safe 수집 |

> `synchronized`는 여기서 pinning 이슈가 없다.
> `successProducts.add()`는 nanosecond 단위의 메모리 연산이라
> pinning 되더라도 즉시 해제되어 실질적 영향 없음.
> blocking I/O를 synchronized 안에서 호출할 때만 문제가 된다.
