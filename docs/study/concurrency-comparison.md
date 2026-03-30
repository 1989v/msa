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

**JDK 버전별 pinning 상태:**

| JDK | synchronized pinning | 대응 |
|-----|---------------------|------|
| 21~23 | ⚠️ 있음 | ReentrantLock 사용 권장 |
| 24+ (JEP 491) | ✅ 해결됨 | synchronized 사용 가능 |

JDK 24에서 synchronized가 Virtual Thread에서도 정상적으로 unmount되도록 수정되었다.
**JDK 24+ 환경에서는 synchronized와 ReentrantLock 모두 pinning 걱정 없이 사용 가능하다.**

### 현재 프로젝트(JDK 23)에서의 pinning 영향

**JDK 23은 pinning이 존재하는 버전이지만, 현재 코드에서는 영향 없다.** 이유:

1. `j.u.c.Semaphore` — synchronized가 아닌 AQS 기반 → pinning 없음
2. `synchronized(successProducts)` — 내부에서 `list.add()` (nanosecond 메모리 연산) → blocking I/O 없으므로 pinning되더라도 즉시 해제
3. `@Transactional` / JDBC — Spring 트랜잭션 관리는 ReentrantLock 기반

**주의**: 향후 synchronized 블록 안에서 DB 호출, HTTP 호출 등 blocking I/O를 수행하는 코드가 추가되면 pinning 문제가 발생할 수 있다. JDK 24+로 업그레이드하거나 ReentrantLock을 사용해야 한다.

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

---

# 부록: Semaphore 심화 Q&A

## Q1. acquire() 대기 중인 스레드는 어떻게 깨어나는가? (폴링 vs 시그널)

**주기적 폴링이 아니라 이벤트 기반(signal)이다.**

```
VT-6: acquire() → permit 없음 → park() (대기 큐에 등록, OS 스레드 반납)

                   ... VT-6은 아무것도 안 함 (CPU 0%, polling 0%) ...

VT-1: release() → 대기 큐에서 VT-6 발견 → unpark(VT-6) 시그널 전송

VT-6:            → 깨어남 → OS 스레드 할당 → permit 획득 → 작업 시작
```

내부적으로 `Semaphore`는 **AQS(AbstractQueuedSynchronizer)**를 사용한다:

1. `acquire()` 시 permit이 없으면 해당 스레드를 **CLH 대기 큐**에 넣고 `LockSupport.park()` 호출
2. 스레드는 **완전히 멈춤** (polling 없음, CPU 소비 없음, 스핀 없음)
3. 다른 스레드가 `release()` 하면 큐에서 다음 대기자를 꺼내 `LockSupport.unpark()` 호출
4. 대기자가 깨어나서 permit을 획득하고 진행

OS 커널의 `futex(wait/wake)`와 동일한 원리다.

## Q2. 750개 VT가 전부 acquire()를 호출하는가?

**그렇다. 750개 모두 `acquire()`까지 도달한다.**

```
executor.submit → VT 750개 즉시 생성 → 750개 모두 acquire() 호출

VT-1:   acquire() → permit 4개 남음 → 즉시 통과 → 작업 시작
VT-2:   acquire() → permit 3개 남음 → 즉시 통과 → 작업 시작
VT-3:   acquire() → permit 2개 남음 → 즉시 통과 → 작업 시작
VT-4:   acquire() → permit 1개 남음 → 즉시 통과 → 작업 시작
VT-5:   acquire() → permit 0개 남음 → 즉시 통과 → 작업 시작
VT-6:   acquire() → permit 없음 → 대기 큐 등록 (큐 위치: 1번째)
VT-7:   acquire() → permit 없음 → 대기 큐 등록 (큐 위치: 2번째)
...
VT-750: acquire() → permit 없음 → 대기 큐 등록 (큐 위치: 745번째)
```

`Semaphore`는 **게이트키퍼**일 뿐, 스레드 생성을 제어하지 않는다.
`newVirtualThreadPerTaskExecutor()`가 750개 VT를 즉시 만들고,
각 VT가 `acquire()`까지 도달한 뒤 permit 여부에 따라 통과하거나 대기한다.

745개가 대기하지만 Virtual Thread라서:
- OS 스레드 점유 = 0 (unmount 상태)
- 메모리 = 745 × ~수 KB = ~수 MB (무시 가능)

## Q3. 처리 순서가 보장되는가?

**기본적으로 순서 보장 안 된다.**

`Semaphore`에는 공정성(fairness) 옵션이 있다:

```kotlin
// 비공정 (기본값) - 순서 보장 X, 성능 우선
Semaphore(5)

// 공정 - FIFO 순서 보장, 약간의 오버헤드
Semaphore(5, true)
```

| | 비공정 (현재) | 공정 |
|---|---|---|
| 순서 | permit 해제 시 아무 대기자나 획득 가능 | 대기 큐 순서(FIFO) 보장 |
| 성능 | 더 빠름 (컨텍스트 스위칭 최소화) | 약간 느림 (큐 관리 오버헤드) |
| 기아(starvation) | 이론적으로 가능 | 없음 |

현재 프로젝트에서는 750개 상품이 어떤 순서로 처리되든 최종 결과는 동일하므로
비공정(기본값)이 적합하다.

## Q4. 데드락이 발생할 수 있는가?

**현재 구조에서는 불가능하다.**

데드락 발생 조건 4가지:
1. 상호 배제 (Mutual Exclusion)
2. 점유 대기 (Hold and Wait)
3. 비선점 (No Preemption)
4. **순환 대기 (Circular Wait)** ← 이것이 성립하지 않음

데드락은 **2개 이상의 락을 서로 다른 순서로 획득**할 때 발생한다:

```
// 데드락 예시 (락 2개)
Thread-1: lock(A) → lock(B) 대기
Thread-2: lock(B) → lock(A) 대기  ← 순환 대기 = 데드락
```

현재 코드는 **Semaphore 1개만 사용**하고, 각 VT가 동일한 패턴으로 동작한다:

```
VT-N: acquire(semaphore) → 작업 → release(semaphore)
```

- 락이 1개 → 순환 대기 불가
- acquire/release가 try-finally로 보장 → permit 누수 없음
- 각 VT가 서로의 결과를 기다리지 않음 → 상호 의존 없음

## Q5. 기아(starvation) 객체가 될 수 있는가?

**이론적으로는 가능하지만, 현재 구조에서는 사실상 불가능하다.**

기아가 발생하려면:

```
VT-6이 계속 대기
→ release() 될 때마다 VT-7, VT-8, ... 이 먼저 획득
→ VT-6은 영원히 못 들어감
```

이게 발생하려면 **permit이 해제되는 순간 새로운 경쟁자가 계속 들어와야** 한다.
하지만 현재 구조는:

- 총 750개가 **한 번에 전부 제출**되고 끝
- 이후 새로운 VT가 추가로 들어오지 않음
- 745개가 큐에 있고, 하나씩 빠져나갈 뿐

**경쟁자가 유한하고 추가 유입이 없으므로** 모든 VT는 결국 permit을 획득한다.

기아가 실제 문제되는 환경:
- 웹서버처럼 **요청이 끊임없이 들어오는** 경우
- 비공정 모드에서 새 요청이 기존 대기자보다 먼저 permit을 가져가는 경우
- → 이런 환경에서는 `Semaphore(N, true)` (공정 모드)를 사용

## Q6. Semaphore의 생명주기와 스코프는?

**메서드 로컬 변수이다.**

```kotlin
fun syncProvider(providerName: String) {
    val semaphore = Semaphore(CONCURRENCY)  // ← 여기서 생성

    Executors.newVirtualThreadPerTaskExecutor().use { executor ->
        // ... semaphore 사용 ...
        futures.forEach { it.get() }  // 모든 작업 완료 대기
    }
    // ← 메서드 종료 시 GC 대상
}
```

- **생성**: `syncProvider()` 호출 시
- **소멸**: 메서드 종료 후 참조 소멸 → GC 대상
- **스코프**: 해당 메서드 호출 1회에 한정

젠킨스가 `syncProvider("KYOWON_TOUR")`를 2번 동시에 호출하면
각각 독립된 Semaphore가 생성되어, 각 5개씩 총 10개가 병렬로 돌 수 있다.

연동사 간에도 총 동시성을 제한하고 싶다면 인스턴스 필드로 올려야 한다.
현재는 연동사별 독립 실행이 의도이므로 메서드 로컬이 적합하다.
