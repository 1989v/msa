---
parent: 3-java-kotlin-concurrency
seq: 20
title: 스레드 덤프 (Thread Dump) 수집 + 분석
type: deep
created: 2026-05-01
---

# 20. 스레드 덤프 — 수집 + 분석

## 핵심 한 줄

스레드 덤프는 *순간 사진* 이라 **단발 1장으론 거짓말한다**. 진단 정공법은 **5초 간격으로 3-5장** 떠서 *추세* 를 본다 — 같은 스레드가 같은 위치에서 BLOCKED/WAITING 이면 stuck, 다른 위치이면 transient. 락 ID 매칭, 풀 고갈 패턴, 데드락 자동 검출이 분석의 3대 축.

## 왜 thread dump 인가

운영에서 만나는 동시성 사고:
- 응답이 안 옴 (hang)
- thread pool 고갈 → 5xx 폭증
- 데드락
- CPU 100% 타지만 throughput 0

원인 추적의 1차 진단 도구가 *thread dump*. 해당 시점에 모든 스레드가 *어디서 무엇을 하고 있는지* 로깅된 표준 덤프.

## 수집 방법 (4가지)

### 1. `jstack <pid>` — 가장 흔함

```bash
# pid 찾기
jps -l
# 또는
ps -ef | grep java

# dump
jstack 12345 > /tmp/threaddump-1.txt
```

- 거의 모든 JDK 에 포함
- text 출력
- live thread + monitor lock 정보

### 2. `jcmd <pid> Thread.print` — 권장 (현대)

```bash
jcmd 12345 Thread.print > /tmp/threaddump-1.txt
jcmd 12345 Thread.print -l    # locked synchronizers (ReentrantLock 등) 포함
```

- jcmd 가 jstack 의 superset
- `-l` 옵션이 **`ReentrantLock`/AQS (AbstractQueuedSynchronizer) lock 까지 표시** — synchronized 만 잡는 jstack 의 한계 보완
- 더 가볍고 안정적

### 3. `kill -3 <pid>` — 컨테이너에서 jcmd 못 쓸 때

```bash
kill -3 12345    # SIGQUIT
```

- 프로세스의 **stdout** 으로 dump 출력 (kubernetes 면 pod log)
- JVM 안 죽음 — `kill` 이라는 이름은 오해
- jcmd 가 안 되는 minimal 컨테이너에서 유용

```bash
# kubernetes 환경
kubectl exec -it <pod> -- kill -3 1     # 컨테이너 안 PID 1
kubectl logs <pod> --tail=10000 > dump.txt
```

### 4. `kubectl exec` 로 jcmd

```bash
kubectl exec -it <pod> -- jcmd 1 Thread.print -l > /tmp/dump-1.txt
sleep 5
kubectl exec -it <pod> -- jcmd 1 Thread.print -l > /tmp/dump-2.txt
sleep 5
kubectl exec -it <pod> -- jcmd 1 Thread.print -l > /tmp/dump-3.txt
```

- 컨테이너에 JDK tools 가 있어야 함 (jib 의 `eclipse-temurin:25-jdk` 베이스에 포함)
- 없으면 sidecar 로 JDK 컨테이너 attach 또는 `kill -3` fallback

## ⚠️ 단발 dump 의 한계

```
[14:30:00] dump 1
"http-nio-8080-exec-3"  java.lang.Thread.State: BLOCKED
        at com.kgd.foo.Service.method(Service.java:30)
        - waiting to lock <0x000000076a3b9c80>
```

이게 진짜 *stuck* 인가, 아니면 *그 순간만* BLOCKED 인가? 모름.

→ **5초 간격으로 3-5회** 떠서 비교:

```
[14:30:00] dump 1
[14:30:05] dump 2
[14:30:10] dump 3
```

같은 스레드가 같은 위치에서 같은 lock id 를 기다리고 있으면 → **stuck 확정**.
다른 위치 / 다른 상태로 변하면 → transient (정상 동작).

### 자동화 스크립트

```bash
#!/bin/bash
# capture-dumps.sh
for i in 1 2 3 4 5; do
    jcmd $1 Thread.print -l > /tmp/dump-$i.txt
    echo "captured dump $i"
    sleep 5
done
```

## thread dump 형식 — 핵심 필드 읽기

```
"http-nio-8080-exec-3" #42 daemon prio=5 os_prio=0 cpu=1234.56ms
        elapsed=987.65s tid=0x00007f8b40123456 nid=0x1234 waiting for monitor entry
        [0x00007f8b3c5f6000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.kgd.order.service.OrderService.processOrder(OrderService.kt:42)
        - waiting to lock <0x000000076a3b9c80> (a com.kgd.order.service.OrderService)
        at com.kgd.order.controller.OrderController.create(OrderController.kt:25)
        - locked <0x000000076a3b9c70> (a com.kgd.order.controller.OrderController)
        at jdk.internal.reflect.GeneratedMethodAccessor42.invoke(Unknown Source)
        ...

   Locked ownable synchronizers:
        - None
```

| 필드 | 의미 |
|---|---|
| `"http-nio-8080-exec-3"` | thread 이름 — Tomcat HTTP worker #3 |
| `#42` | JVM 내부 thread ID |
| `daemon` | daemon flag |
| `prio=5` | priority (거의 무시) |
| `cpu=1234.56ms` | 누적 CPU 사용 시간 |
| `elapsed=987.65s` | thread 살아있는 시간 |
| `tid=0x...` | OS thread ID (hex) |
| `nid=0x1234` | OS thread ID (decimal 변환 가능) |
| **`Thread.State: BLOCKED`** | thread 상태 (가장 중요!) |
| `(on object monitor)` | 어떤 메커니즘으로 BLOCKED |
| `- waiting to lock <0x...>` | 기다리는 monitor 의 객체 ID |
| `- locked <0x...>` | 보유 중인 monitor 의 객체 ID |
| `Locked ownable synchronizers` | ReentrantLock 등 (jcmd `-l` 필요) |

## 상태별 의미

### `RUNNABLE`

```
java.lang.Thread.State: RUNNABLE
        at sun.nio.ch.Net.poll(Native Method)
        at sun.nio.ch.NioSocketImpl.park(NioSocketImpl.java:181)
        ...
```

JVM 입장에서 실행 가능. **OS 입장에선 IO (Input/Output, 입출력) 대기** 중일 수도 있음 (`Net.poll`, `socketRead0`, `epoll_wait`).

→ RUNNABLE 이라고 해서 무조건 CPU 쓰는 건 아님. CPU bound vs IO bound 구분은 **stack 의 native call** 로 판별.

### `BLOCKED (on object monitor)`

```
java.lang.Thread.State: BLOCKED (on object monitor)
        at com.kgd.foo.Service.method(Service.java:30)
        - waiting to lock <0x000000076a3b9c80> (a com.kgd.foo.Service)
```

`synchronized` 진입 대기. **누군가 같은 monitor 를 들고 있음** — 그 누구를 찾기 위해 다른 스레드의 `- locked <0x000000076a3b9c80>` 을 grep.

### `WAITING (parking)` / `WAITING (on object monitor)`

```
java.lang.Thread.State: WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076a3b9d00> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:341)
```

명시적 `LockSupport.park()` 또는 `Object.wait()` 또는 `Thread.join()` 으로 무한 대기 중. 누가 `signal/notify/unpark` 해줘야 깨어남.

### `TIMED_WAITING (sleeping)` / `TIMED_WAITING (parking)`

```
java.lang.Thread.State: TIMED_WAITING (sleeping)
        at java.lang.Thread.sleep0(Native Method)
        at java.lang.Thread.sleep(Thread.java:509)
```

시간 제한 대기. `sleep`, `wait(ms)`, `parkNanos`, `Future.get(timeout)` 등.

## 데드락 자동 검출

JVM 이 dump 떠줄 때 **자동으로 데드락 분석** 해서 출력.

```
Found one Java-level deadlock:
=============================
"Thread-A":
  waiting to lock monitor 0x00007f8b40000000 (object 0x000000076a3b9c80, a com.kgd.foo.LockX),
  which is held by "Thread-B"
"Thread-B":
  waiting to lock monitor 0x00007f8b40000010 (object 0x000000076a3b9c90, a com.kgd.foo.LockY),
  which is held by "Thread-A"

Java stack information for the threads listed above:
===================================================
"Thread-A":
        at com.kgd.foo.Worker.work(Worker.java:42)
        - waiting to lock <0x000000076a3b9c80> (a com.kgd.foo.LockX)
        - locked <0x000000076a3b9c90> (a com.kgd.foo.LockY)
        ...
"Thread-B":
        at com.kgd.foo.Worker.process(Worker.java:30)
        - waiting to lock <0x000000076a3b9c90> (a com.kgd.foo.LockY)
        - locked <0x000000076a3b9c80> (a com.kgd.foo.LockX)
        ...

Found 1 deadlock.
```

→ "Found N deadlock" 키워드만 검색하면 즉시 발견. 단 ReentrantLock 데드락은 jcmd `-l` 옵션 필요.

## 락 ID 매칭 — "누가 누굴 막고 있나"

```
"http-nio-8080-exec-3"  BLOCKED
   - waiting to lock <0x000000076a3b9c80>      ← A 가 기다림

"http-nio-8080-exec-12"  RUNNABLE
   - locked <0x000000076a3b9c80>               ← B 가 들고 있음
   at com.kgd.foo.SlowService.heavyDb(...)     ← B 는 DB 호출 중
```

→ B 가 DB 에서 안 돌아오는 게 원인. DB 쿼리 plan, slow query log 분석. 락 안에서 외부 IO 호출 = 안티패턴 ([02-synchronized-monitor.md](02-synchronized-monitor.md)).

### 검색 명령

```bash
LOCK_ID="0x000000076a3b9c80"

# 누가 들고 있나 (locked)
grep -B2 "locked <$LOCK_ID>" dump.txt | grep "^\""

# 누가 기다리나 (waiting)
grep -B2 "waiting to lock <$LOCK_ID>" dump.txt | grep "^\""
```

## 스레드 풀 고갈 진단 패턴

### 1. HTTP worker pool 고갈 (Tomcat)

```
"http-nio-8080-exec-1"  BLOCKED  - waiting to lock <0x...>
"http-nio-8080-exec-2"  BLOCKED  - waiting to lock <0x...>
"http-nio-8080-exec-3"  BLOCKED  - waiting to lock <0x...>
... 200개 모두 BLOCKED
```

→ Tomcat default 200개 worker 가 *모두* 같은 lock 또는 외부 호출 대기. **동시성 사고 1순위**.

원인:
- 외부 API timeout 안 걸어서 무한 대기
- DB connection 풀 부족 (HikariPool 대기)
- synchronized 안에서 외부 IO

### 2. HikariPool connection 대기

```
"http-nio-8080-exec-N"
   java.lang.Thread.State: TIMED_WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x...> (a java.util.concurrent.SynchronousQueue$TransferStack)
        at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:179)
```

→ HikariPool 의 connection 풀 고갈. `connection-timeout` 도달 후 SQLException.

### 3. Kafka Consumer 막힘

```
"kafka-consumer-network-thread"
   java.lang.Thread.State: RUNNABLE
        at sun.nio.ch.Net.poll(Native Method)

"kafka-consumer-thread-1"
   java.lang.Thread.State: WAITING
        at com.kgd.foo.HeavyHandler.process(...)
```

→ poll 은 도는데 user code 가 늦게 처리. consumer lag 폭증의 신호.

### 4. ForkJoinPool commonPool 점유

```
"ForkJoinPool.commonPool-worker-1"  TIMED_WAITING
"ForkJoinPool.commonPool-worker-2"  TIMED_WAITING
... 모든 worker 가 같은 외부 IO 대기
```

→ `parallelStream` / `CompletableFuture` 가 commonPool 에서 blocking IO 호출 중. ([07-executor-threadpool.md](07-executor-threadpool.md))

## RUNNABLE 인데 hang — 무한 루프 확인

```
"worker-3"  RUNNABLE
        at com.kgd.foo.parser.parse(Parser.java:42)

(5초 후 dump)

"worker-3"  RUNNABLE
        at com.kgd.foo.parser.parse(Parser.java:42)   ← 같은 위치!
```

→ 같은 위치에서 5초 동안 RUNNABLE = **무한 루프 또는 매우 느린 알고리즘**. CPU profile 추가 (async-profiler) 로 확인.

## 분석 도구

### 1. fastthread.io — 시각화 무료 SaaS

- dump 파일 업로드 → 시각화
- BLOCKED hot spot, deadlock, thread group breakdown
- 회사 dump 라면 **반드시 외부 업로드 정책 확인** (보안)

### 2. IBM TDA (Thread Dump Analyzer)

- Eclipse 기반 desktop 도구
- 오프라인, 보안 이슈 없음
- thread group, monitor, hot lock 분석

### 3. Spotify thread-dump-analyzer

- CLI 도구
- 패턴 매칭 + JSON 출력 → 자동화

### 4. 직접 분석 — grep + awk 콤보

```bash
# 상태별 카운트
grep "java.lang.Thread.State" dump.txt | sort | uniq -c

# BLOCKED 만 추출
awk '/^"/{name=$0} /BLOCKED/{print name; print}' dump.txt

# 가장 많이 잡힌 lock ID
grep "waiting to lock" dump.txt | awk '{print $4}' | sort | uniq -c | sort -rn | head
```

## 실전 시나리오 워크플로우

### 상황: 응답 시간 폭증 알림

1. **알림 수신** → pod 식별
2. **3-5장 dump** (5초 간격)
   ```bash
   for i in 1 2 3; do
     kubectl exec <pod> -- jcmd 1 Thread.print -l > dump-$i.txt
     sleep 5
   done
   ```
3. **상태 분포 비교**
   ```bash
   for i in 1 2 3; do
     echo "=== dump $i ==="
     grep "Thread.State" dump-$i.txt | sort | uniq -c
   done
   ```
4. **공통 BLOCKED 스레드 식별**
   - 같은 thread name 이 여러 dump 에서 같은 위치 BLOCKED → stuck
5. **lock ID 매칭** — 누가 들고 있나
6. **들고 있는 스레드의 stack** — 무엇을 하고 있나 (DB? HTTP? sleep?)
7. **원인 가설** + **재현 가능한 테스트 작성** + **수정**

### 상황: 데드락 의심

1. dump 1장
2. "Found N deadlock" 검색
3. 발견되면 즉시 분석 (lock 순서 위반 확인)
4. 못 찾았으면 ReentrantLock 데드락 가능성 → `jcmd -l` 추가
5. 수정: 락 획득 순서 통일, `tryLock(timeout)` 도입

### 상황: thread 풀 고갈 (HikariCP, Tomcat)

1. 풀 크기 메트릭 확인 (Micrometer)
2. dump 떠서 풀의 worker 들이 *어디서 대기* 중인지 확인
3. 외부 IO timeout 점검
4. 락 contention 점검

## msa 환경에서

```bash
# k3d 로컬 클러스터
kubectl get pods -n msa
kubectl exec -it order-app-xxx -- jcmd 1 Thread.print -l > dump.txt

# fastthread 또는 직접 분석
grep "Thread.State" dump.txt | sort | uniq -c
```

기본 점검 대상:
- `http-nio-8080-exec-*` — Tomcat worker
- `HikariPool-1 connection adder` — DB pool
- `kafka-consumer-network-thread` — Kafka network
- `kafka-listener-N` — `@KafkaListener` worker
- coroutine 인 경우 `DefaultDispatcher-worker-*`

## 면접 단골

**Q. 스레드 덤프 어떻게 수집하나?**

`jstack <pid>` 또는 `jcmd <pid> Thread.print -l` (ReentrantLock 까지 보려면 -l 필수). 컨테이너면 `kubectl exec ... -- jcmd 1 Thread.print -l`. JDK tools 없는 minimal 컨테이너면 `kill -3 <pid>` 로 stdout 에 dump (= pod log). 단발 dump 만으론 부족 — 5초 간격 3-5회 떠서 추세 비교.

**Q. 단발 dump 만으론 안 되는 이유?**

스레드 상태는 *순간 사진*. 그 시점에 BLOCKED 였다고 stuck 인지, 0.1초 후 풀리는지 모름. 5초 간격 3-5회 떠서 *같은 스레드가 같은 위치에서* BLOCKED 인지 확인해야 진짜 stuck 판단 가능. 다른 위치로 변하면 transient.

**Q. BLOCKED 상태 스레드가 많이 보일 때 어떻게 추적?**

(1) BLOCKED 스레드의 `- waiting to lock <0x...>` 에서 lock ID 추출, (2) 같은 lock ID 를 `- locked <0x...>` 로 들고 있는 스레드 grep, (3) 들고 있는 스레드의 stack 분석 — DB? HTTP? sleep? 외부 IO 위에서 lock 잡고 있으면 안티패턴, 해당 코드 수정. ReentrantLock 의 경우 `jcmd -l` 의 "Locked ownable synchronizers" 섹션 확인.

**Q. RUNNABLE 인데 응답이 느리다?**

(1) JVM 의 RUNNABLE 은 native IO 대기도 포함 — `at sun.nio.ch.Net.poll` 같은 stack 이면 진짜 IO 대기. (2) 같은 위치에서 여러 dump 모두 RUNNABLE 이면 무한 루프 또는 비효율 알고리즘. (3) async-profiler 로 CPU profile 추가 떠서 실제 hot 메서드 확인. dump 만으론 RUNNABLE 의 진짜 원인 한정 — 보조 도구 결합.

**Q. 데드락 자동 검출은 어떻게 동작하나?**

JVM 이 모든 스레드의 monitor wait queue + held monitor 그래프를 만들고 사이클을 검색. 사이클 있으면 "Found N deadlock" 으로 명시 출력. `synchronized` 데드락은 jstack 으로 바로, ReentrantLock / AQS 데드락은 `jcmd -l` 의 "Locked ownable synchronizers" 정보 필요. Livelock (서로 양보해서 진행 안 되는) 은 자동 검출 안 됨 — 직접 패턴 분석.

## 다음 학습

- [21-profiling-tools.md](21-profiling-tools.md) — async-profiler / JFR
- [22-msa-concurrency-patterns.md](22-msa-concurrency-patterns.md) — msa 적용 점검
- [24-interview-qa.md](24-interview-qa.md) — thread dump 면접 질문
