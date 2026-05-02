---
parent: 3-java-kotlin-concurrency
seq: 24
title: 면접 Q&A 카드 + 자가 평가
type: deep
created: 2026-05-01
---

# 24. 면접 Q&A 카드

> 회독용. 학습 종료 후 1주일 간격 2-3회 회독 권장.

---

## Phase 1: 기본 프리미티브 (10개)

**Q1.1** `Thread.sleep()` 과 `Object.wait()` 차이?

> `sleep` 은 monitor 를 안 놓는다. `wait` 은 monitor 를 놓고 wait queue 에 들어감 → `synchronized` 안에서만 호출 가능. 깨우는 방식도 다름 — `sleep` 은 시간 만료/interrupt, `wait` 은 `notify`/`notifyAll`/timeout/interrupt.

**Q1.2** `synchronized` 와 `volatile` 의 차이?

> `synchronized` = 원자성 + 가시성 + 재진입. `volatile` = 가시성과 reordering 방지만, 원자성 없음. 단일 read/write 는 volatile 충분, 복합 연산 (`count++`) 은 synchronized 또는 Atomic.

**Q1.3** `volatile` 만으로 thread-safe 카운터 가능한가?

> 불가. `count++` 는 read-modify-write 3단계라 volatile 의 가시성만으론 부족. `AtomicInteger.incrementAndGet()` 또는 `synchronized` 필수. 매우 높은 contention 의 카운터는 `LongAdder` 가 정답 (striped).

**Q1.4** CAS 와 `synchronized` 중 뭘 쓰나?

> 단일 변수 swap + contention 낮음 → CAS (Atomic). 복합 연산 또는 critical section 길음 → `synchronized`. 매우 높은 contention 카운터는 `LongAdder`. 락 안에서 외부 IO 는 절대 안 됨.

**Q1.5** ABA 문제가 무엇이고 어떻게 막나?

> CAS 가 "값이 같으면 진행" 인데, 값이 같지만 *그 사이에 다른 값으로 바뀌었다 돌아온* 경우 구분 못 함. lock-free 자료구조에서 노드 재활용 시 위험. 해결은 `AtomicStampedReference` 로 stamp 같이 비교 → 같은 값이라도 stamp 다르면 CAS 실패.

**Q1.6** `ReentrantLock` 을 `synchronized` 대신 쓰는 이유?

> 셋 — `tryLock(timeout)`, `lockInterruptibly`, 다중 `Condition`. 그 외 fairness 옵션, hold count query. 단순 동기화엔 `synchronized` 가 JIT 최적화 측면에서 동등하거나 빠르니 일부러 ReentrantLock 으로 가지 말 것.

**Q1.7** ReadWriteLock 이 항상 빠른가?

> 아니다. critical section 짧고 read 비율 압도적이면 일반 락 + JIT 가 더 빠를 수도. RWLock 의 reader counter 자체 오버헤드 있어서 critical section 이 충분히 길어야 이득. 일반적으로 *수 µs 이상의 read-heavy critical section* 에서 가치.

**Q1.8** `ThreadLocal` 을 풀 환경에서 안전하게 쓰는 방법?

> `try-finally` + `remove()`. WeakReference 키이지만 value 는 strong 라 stale entry 누수. Spring Security Context, MDC 등은 framework 가 자동 cleanup. 직접 ThreadLocal 만들면 매 요청 끝에 명시적 remove. cross-request leak (다른 사용자 정보 노출) 은 보안 사고.

**Q1.9** `Executors.newCachedThreadPool` 의 위험?

> `max = Integer.MAX_VALUE`. 짧은 task 가 매우 많이 들어오면 스레드 무제한 생성하다 시스템 다운. `SynchronousQueue` 라 queue 에 쌓이지도 않으니 매번 신규. production 에선 `ThreadPoolExecutor` 직접 구성 + bounded queue + `CallerRunsPolicy`.

**Q1.10** `Hashtable`, `synchronizedMap`, `ConcurrentHashMap` 차이?

> `Hashtable` 은 모든 메서드에 `synchronized(this)` — 글로벌 락, 레거시. `synchronizedMap` 은 wrapper 로 같은 글로벌 락. `ConcurrentHashMap` 은 Java 7 까지 segment 단위, Java 8 부터 bin 단위 + 트리화 — contention 분산 + read 거의 lock-free. 신규 코드는 무조건 CHM.

---

## Phase 2: JVM 내부 + 고수준 추상 (12개)

**Q2.1** happens-before 가 무엇인가?

> JMM 의 가시성/순서 보장 형식 명세. A happens-before B 면 A 의 모든 메모리 효과가 B 에서 반드시 보임. transitive (A→B, B→C ⇒ A→C). 8가지 규칙 — program order, monitor lock, volatile variable, thread start/join, interruption, finalizer, transitivity. 멀티스레드 코드의 모든 정합성 보장의 기반.

**Q2.2** Double-Checked Locking 에 volatile 빠지면?

> JMM 위반. `instance = new Foo()` 가 (a) 메모리 할당 → (c) 참조 대입 → (b) 생성자 실행 으로 재배열 가능. 다른 스레드가 1차 read 에서 *생성자 안 끝난* 객체 참조를 받아 method 호출 시 부분 초기화 상태 사용. volatile 로 reordering 차단. Kotlin 은 `lazy { }` / `object` 사용이 안전.

**Q2.3** synchronized 의 락 진화 단계?

> 비편향 → 편향 락 (한 스레드 재획득에 최적화) → 경량 락 (CAS + stack 의 Lock Record) → 중량 락 (OS mutex + ObjectMonitor). contention 늘면 단계 올라감. JDK 15+ 에서 편향 락 deprecate, JDK 18+ default off (JEP 374) 로 lightweight 부터 시작.

**Q2.4** ConcurrentHashMap Java 7 vs 8?

> Java 7 은 segment (보통 16개) 단위 락 — segment 수가 동시 write 한도. Java 8 부턴 segment 사라지고 bin 단위 `synchronized` (head node) + 빈 bin 은 CAS. list 길이 8 이상 + table 64 이상이면 Red-Black Tree 로 트리화 → worst-case O(log N) + hash collision DoS 방어.

**Q2.5** ConcurrentHashMap 의 `size()` 가 정확한가?

> 약하게 정확. striped counter (`baseCount + CounterCell[]`) 합산. O(1) 에 가깝지만 호출 도중 다른 스레드의 put/remove 가 반영될 수도 안 될 수도. *순간 추정치*. 정확한 snapshot 이 필요하면 `toMap()` 후 size 또는 외부 동기화.

**Q2.6** `StampedLock` vs `ReadWriteLock`?

> StampedLock 은 *optimistic read* 를 지원 — 락 안 잡고 stamp 만 받아 read 한 뒤 validate 로 일관성 검증. read contention 매우 심하고 critical section 짧으면 우위. 단 재진입 불가 + Condition 없음 + interrupt 안 받음. 일반 read-write 분리는 RWLock, 매우 좁은 use case 만 StampedLock.

**Q2.7** `thenApply` 와 `thenApplyAsync` 차이?

> `thenApply` 는 직전 stage 가 이미 끝났으면 *호출자 스레드*, 아니면 *직전을 끝낸 스레드* — 비결정적. `thenApplyAsync` 는 항상 (default `commonPool` 또는 명시) executor 에서 실행. production 코드는 *항상 Async + 명시 executor* 가 정공법, blocking IO 가 호출자를 막지 않게.

**Q2.8** CompletableFuture 와 Kotlin Coroutine 차이?

> CF 는 thenXxx 체인 → 함수 콜백으로 코드가 변형되어 가독성 떨어짐. coroutine 은 `suspend` 로 비동기 코드를 *직선* 으로 작성, structured concurrency 로 cancellation/scope 표준화. Kotlin 프로젝트면 coroutine 1순위. CF 는 (1) Java 호환, (2) 단순 비동기 wrapping 정도.

**Q2.9** Kotlin coroutine 이 어떻게 스레드를 점유 안 하나?

> 컴파일러가 suspend 함수를 state machine 으로 변환. 각 suspension point 에서 함수가 `COROUTINE_SUSPENDED` 반환 → 호출 chain 전체 즉시 return → 스레드 풀려남. 나중 `Continuation.resumeWith()` 호출 시 같은 함수에 재진입해서 저장된 label 부터 다시 실행. 그래서 한 스레드가 수천 coroutine 처리.

**Q2.10** Structured Concurrency 가 뭔가?

> 비동기 작업의 lifetime 을 코드 구조 (scope) 에 묶는 패러다임. `coroutineScope { }` 안의 모든 자식 coroutine 이 *블록 종료 전* 완료/취소되도록 보장. 자식 실패 시 형제 자동 cancel, 부모 cancel 시 cascade. callback 지옥 + lifecycle leak 동시에 해결.

**Q2.11** Virtual Thread 가 뭔가, 언제 쓰나?

> JDK 21 stable 의 새 thread 모델. carrier thread (ForkJoinPool worker) 위에 mount/unmount 되는 가벼운 스레드. blocking IO 호출 시 자동 unmount → carrier 풀려남. 1개 비용 수백 B 라 수백만 동시 가능. blocking IO 많은 일반 MVC 서비스에 1순위 적용 (Spring Boot 3.2+ `spring.threads.virtual.enabled=true` 한 줄).

**Q2.12** Virtual Thread 의 pinning 문제는?

> VT 가 carrier 에 mount 된 채 unmount 못 하는 상황. JDK 21 에선 `synchronized` + native frame 에서 발생. 해결은 `ReentrantLock` 으로 교체 또는 IO 를 락 밖으로. JDK 24 의 JEP 491 으로 `synchronized` pinning 거의 해소되어 JDK 25 에선 무관 — 이게 VT 채택의 큰 trigger.

---

## Phase 2.5: 운영 진단 (8개)

**Q3.1** 스레드 덤프를 어떻게 수집하나?

> `jstack <pid>` 또는 `jcmd <pid> Thread.print -l` (ReentrantLock 까지 보려면 `-l` 필수). 컨테이너면 `kubectl exec -- jcmd 1 Thread.print -l`. JDK tools 없는 minimal 컨테이너면 `kill -3 <pid>` 로 stdout 에 dump (= pod log). 단발론 부족 — 5초 간격 3-5회 떠서 추세 비교.

**Q3.2** 단발 dump 만으로 충분한가?

> 부족하다. 스레드 상태는 *순간 사진*. 그 시점에 BLOCKED 였다고 stuck 인지, 0.1초 후 풀리는지 모름. 5초 간격 3-5회 떠서 *같은 스레드가 같은 위치에서* 같은 lock 을 기다리는지 확인해야 진짜 stuck 판단. 다른 위치로 변하면 transient.

**Q3.3** BLOCKED 상태 스레드가 많이 보일 때 어떻게 추적?

> (1) BLOCKED 스레드의 `- waiting to lock <0x...>` 에서 lock ID 추출. (2) 같은 lock ID 를 `- locked <0x...>` 로 들고 있는 스레드 grep — 한 명. (3) 들고 있는 스레드의 stack 분석 — DB? HTTP? sleep? 외부 IO 위에서 lock 잡고 있으면 안티패턴, 코드 수정. ReentrantLock 데드락은 `jcmd -l` 로 "Locked ownable synchronizers" 추가 확인.

**Q3.4** 데드락 자동 검출은 어떻게 동작?

> JVM 이 모든 스레드의 monitor wait queue + held monitor 그래프를 만들고 사이클 검색. 사이클 있으면 thread dump 하단에 "Found N Java-level deadlock" 명시 출력. `synchronized` 데드락은 `jstack` 으로 즉시 보이지만, ReentrantLock/AQS 데드락은 `jcmd -l` 의 lockable synchronizers 정보 필요. Livelock 은 자동 검출 안 됨 — 수동 패턴 분석.

**Q3.5** RUNNABLE 인데 hang 같다?

> JVM 의 RUNNABLE 은 native IO 대기도 포함 — `at sun.nio.ch.Net.poll`, `socketRead0` 같은 stack 이면 IO 대기. 같은 위치에서 여러 dump 모두 RUNNABLE 이면 무한 루프 또는 비효율 알고리즘. async-profiler 의 CPU profile 로 실제 hot 메서드 확인.

**Q3.6** Thread Pool 고갈을 어떻게 진단?

> dump 에서 `http-nio-8080-exec-*` 200개 모두 BLOCKED 또는 같은 외부 IO 대기 → Tomcat worker 고갈. `HikariPool ... TIMED_WAITING parking` 이 많으면 DB connection 풀 고갈. `kafka-consumer-thread-N` 이 user code 에서 멈춰 있으면 Kafka consumer 처리 지연. 메트릭 (`tomcat.threads.busy`, `hikaricp.connections.pending`) 과 결합.

**Q3.7** Thread Dump 와 Profiler 의 역할 차이?

> dump 는 *순간 사진* — 어떤 스레드가 어디서 BLOCKED/WAITING 인지 1차 가설. profiler 는 *시간 누적의 정량* — 어떤 lock 에서 얼마나 시간을 쓰는지, 어떤 메서드가 CPU 얼마나 쓰는지. dump 로 가설 → profiler 로 검증 + 정량화. async-profiler 의 lock 모드와 JFR 의 `JavaMonitorEnter`/`JavaMonitorInflate` 이벤트가 동시성 hot spot 탐지의 표준.

**Q3.8** lock inflation 을 어떻게 정량화?

> JFR 의 `jdk.JavaMonitorInflate` 이벤트. lightweight (사용자 공간 CAS) → heavyweight (OS mutex + ObjectMonitor) escalate 시점 기록. 빈번하면 그 락은 contention 심해서 spin 으로 처리 못 했다는 신호 — 1순위 최적화 후보. async-profiler `-e lock` 으로 flame graph 시각화도 동등 효과.

---

## Phase 3: msa 적용 (8개)

**Q4.1** msa 가 `@Async` 안 쓰는 이유?

> ADR-0002 결정 — Spring MVC + JPA blocking + Kotlin coroutine (외부 IO) + Tomcat 가상 스레드. coroutine 이 비동기를 직선 코드로 처리 + structured concurrency 로 lifecycle 관리 → `@Async` 의 함정 (default `SimpleAsyncTaskExecutor` = 풀 없음, ThreadLocal 안 따라감, 예외 처리 모호) 자연 회피. coroutine 이 가독성·디버깅·취소 측면에서 우위.

**Q4.2** Kafka consumer concurrency 의 영향?

> default 1. partition N 개여도 단일 listener 가 직렬 처리. 처리 시간 긴 토픽은 lag 폭증 위험. `concurrency: N` (≤ partition 수) 으로 늘리면 throughput 회복. partition 보다 큰 concurrency 는 idle, 작으면 partition 분할로 병렬. partition 단위 순서 보장은 어차피 partition 별 1개 listener 라 안 깨짐.

**Q4.3** Optimistic Lock vs Pessimistic Lock — msa 선택?

> 거의 Optimistic (`@Version` 또는 비즈니스 컬럼 versioning + `WHERE expected_version`). retry 로 충돌 처리 → throughput 좋음, 락 대기 없음. Pessimistic (`SELECT FOR UPDATE`) 은 충돌 매우 빈번해 retry 누적 시 또는 phantom read 방지 필요 시. msa 는 inventory `@Version`, quant kek_version 으로 모두 Optimistic.

**Q4.4** Redis 분산 락은 언제 도입?

> Phase 3 multi-replica 시점. 현재 (Phase 2) 는 replicas=1 가정으로 in-process Mutex / ConcurrentHashMap 충분. multi-replica 되면 (1) `@Scheduled` 잡 leader election (중복 처리 방지), (2) audit chain prev_hash cross-replica 직렬화, (3) inventory reconcile cross-instance 직렬화. Redisson `RLock` 또는 `@Scheduled` 만이면 ShedLock.

**Q4.5** msa 의 coroutine 사용 패턴?

> quant 가 메인 — `CoroutineScope(Dispatchers.IO + SupervisorJob())` + `launch` worker + `while (isActive) { try ... catch (ce: CancellationException) { throw ce } catch (e: Exception) { /* log */ } }` + `@PreDestroy` 에서 `cancelAndJoin`. structured concurrency, SupervisorJob 으로 자식 격리, CancellationException rethrow 가 정공법. tenant 단위 직렬화는 `ConcurrentHashMap<String, Mutex>` + `mutex.withLock`.

**Q4.6** Virtual Threads 를 msa 어디에 적용?

> 1순위: 일반 MVC 서비스 (order, product, member, gifticon, wishlist, inventory, fulfillment, auth) — `spring.threads.virtual.enabled=true` 한 줄로 Tomcat worker 자동 VT 화. 제외: gateway (WebFlux/Netty 라 무관), quant (coroutine 이 메인). 점검: ThreadLocal 동작, MDC, 외부 native 라이브러리, thread dump 형식 변경.

**Q4.7** msa 가 분산 환경에서 단일 인스턴스 가정을 어떻게 깨나?

> `auth/refreshTokenStore` ConcurrentHashMap 을 Redis 로 이전 (TTL = refresh token 만료). quant 의 audit chain in-process Mutex 를 leader election 또는 sequence 서비스로 교체. `@Scheduled` outbox poller 를 ShedLock 또는 Redisson 분산 락으로. Phase 3 spec 에 명시 + ADR 신설.

**Q4.8** msa 운영에서 동시성 사고 진단 워크플로우?

> 알림 → pod 식별 → `jcmd Thread.print -l` 5초 간격 3회 → 상태 분포 비교 → 공통 BLOCKED 스레드 식별 → lock ID 매칭 → 들고 있는 스레드의 stack 분석 → DB/HTTP/sleep 원인 가설 → async-profiler `-e lock` 으로 정량 확인 → 재현 테스트 작성 → 수정. JFR continuous recording 켜뒀으면 사고 직전 2시간 데이터도 즉시 확보.

---

## 자가 평가 — 학습 종료 후 반드시 셀프 체크

다음 질문들을 **막힘없이 30초 안에** 답할 수 있는지:

### 기본 (Phase 1)
- [ ] Thread 의 6개 상태와 각 상태 의미
- [ ] synchronized 와 volatile 의 차이
- [ ] CAS 의 ABA 문제와 해결
- [ ] ReentrantLock 이 synchronized 보다 나은 점 3가지
- [ ] ThreadLocal 메모리 누수 시나리오 + 해결
- [ ] `Executors.newCachedThreadPool` 위험성
- [ ] ConcurrentHashMap vs Hashtable

### JVM 내부 (Phase 2)
- [ ] happens-before 의 의미와 8가지 규칙
- [ ] DCL 에 volatile 필요한 이유
- [ ] synchronized 의 lock 진화 4단계
- [ ] CHM Java 7 vs 8 구조
- [ ] CompletableFuture 의 thenApply vs thenApplyAsync
- [ ] coroutine 이 스레드를 점유 안 하는 메커니즘 (state machine)
- [ ] Flow vs Channel vs SharedFlow vs StateFlow
- [ ] Structured Concurrency 의 가치
- [ ] Virtual Thread 의 동작 + JEP 491

### 운영 진단 (Phase 2.5)
- [ ] thread dump 4가지 수집 방법
- [ ] 단발 dump 한계 + 5초 간격 3-5회 패턴
- [ ] BLOCKED/WAITING/RUNNABLE 의 의미 차이
- [ ] lock id 매칭으로 owner 추적
- [ ] thread pool 고갈 진단 패턴
- [ ] 데드락 자동 검출 출력 형식
- [ ] async-profiler 와 JFR 의 역할

### msa 적용 (Phase 3)
- [ ] ADR-0002 의 런타임 결정 (MVC + JPA + coroutine)
- [ ] msa 의 Kafka concurrency 문제
- [ ] Optimistic Lock 의 적용 사례 (inventory, quant)
- [ ] 분산 락 도입 시점과 옵션
- [ ] VT 적용 후보 서비스
- [ ] 동시성 사고 진단 워크플로우

---

## 참고 자료

- "Java Concurrency in Practice" — Brian Goetz (전체 동시성의 바이블)
- "The Art of Multiprocessor Programming" — Herlihy & Shavit (CAS, lock-free)
- Kotlin Coroutine 공식 가이드 — kotlinlang.org
- JEP 425, 444, 480, 491 — Virtual Threads 진화
- Martin Thompson 의 Mechanical Sympathy 블로그
- Aleksey Shipilëv 의 JMM 강의 (가장 정확)
- async-profiler 공식 README
- Oracle JFR User Guide
- Brendan Gregg 의 perf / profiling 자료

## 참조 파일

- [00-preview.md](00-preview.md) — 학습 지도
- [01-08](.) — Phase 1 기본
- [09-19](.) — Phase 2 심화
- [20-21](.) — 운영 진단
- [22-msa-concurrency-patterns.md](22-msa-concurrency-patterns.md) — msa 점검
- [23-improvements.md](23-improvements.md) — 개선 후보
