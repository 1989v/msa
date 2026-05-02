---
id: 3
title: Java/Kotlin 동시성 심화
status: completed
created: 2026-04-16
updated: 2026-05-02
tags: [concurrency, threads, synchronized, volatile, coroutine, virtual-threads, loom]
difficulty: advanced
estimated-hours: 25
codebase-relevant: true
---

# Java/Kotlin 동시성 심화

## 1. 개요

Java 의 동시성 프리미티브 (synchronized, volatile, Atomic, Lock, Concurrent Collections) 의 내부 동작 원리부터, Kotlin 의 coroutine/Flow, 최신 Virtual Threads (Project Loom) 까지 10년차가 면접에서 방어해야 할 동시성 전반을 학습한다.

Memory Model (JMM) 이해, false sharing, happens-before, lock contention 등 실무 디버깅 포인트도 다룬다.

## 2. 학습 목표

- JMM (Java Memory Model) 의 happens-before 관계를 설명할 수 있다
- `synchronized`, `volatile`, `Atomic*` 의 내부 원리와 적절한 사용처를 구분할 수 있다
- `ConcurrentHashMap` 의 내부 구조 (Segment → Bin + CAS) 를 설명할 수 있다
- `ReentrantLock`, `ReadWriteLock`, `StampedLock` 의 차이를 이해한다
- Kotlin coroutine 의 suspend/resume, structured concurrency, Flow/Channel 동작을 이해한다
- Virtual Threads 와 플랫폼 스레드의 차이, 사용처, pinning 문제를 설명한다
- 동시성 버그 (race condition, deadlock, livelock, starvation) 진단 방법
- 면접에서 "ConcurrentHashMap 어떻게 구현되어 있나요?" "CompletableFuture vs Coroutine?" 같은 질문 답변

## 3. 선수 지식

- 스레드/프로세스 기본 개념
- OS 스케줄링 기본
- Java/Kotlin 기본 문법

## 4. 학습 로드맵

### Phase 1: 기본 개념
- Thread 생명주기, Runnable/Callable
- synchronized 블록/메서드, monitor 개념
- volatile 의 메모리 가시성
- Atomic 클래스 (CAS 기반)
- ReentrantLock, Condition, ReadWriteLock
- ThreadLocal
- Executor Framework, ThreadPool, Fork/Join Pool
- 기본 자료구조 thread-safety (Collections.synchronizedXxx, CopyOnWriteArrayList)

### Phase 2: 심화
- JMM (Java Memory Model) — happens-before, synchronizes-with
- synchronized 내부: biased lock → lightweight lock → heavyweight lock (JDK 15+ 에서 biased 제거)
- ConcurrentHashMap 내부: Java 7 (Segment) vs Java 8 (CAS + synchronized bin)
- StampedLock: optimistic read
- CompletableFuture 체이닝, 에러 처리, 조합
- Kotlin coroutine 내부: Continuation, suspend 함수 컴파일 변환
- Kotlin Flow: cold vs hot, SharedFlow, StateFlow, operator 내부
- Kotlin Channel: buffered, unbuffered, fan-out/fan-in
- Structured concurrency: CoroutineScope, Job 계층
- Virtual Threads (Project Loom): carrier thread, pinning, synchronized/native call 문제
- Reactor (Spring WebFlux) 와 coroutine 의 차이
- false sharing, cache line, @Contended
- **스레드 덤프(Thread Dump) 수집 및 분석**
  - 수집 방법: `jstack <pid>`, `jcmd <pid> Thread.print`, `kill -3 <pid>` (stdout 으로 dump), 컨테이너에서는 `kubectl exec ... -- jcmd ...`
  - **단발 dump 한계** → 5초 간격 3-5회 떠서 추세 비교 (stuck vs transient 판별 / 같은 위치에서 BLOCKED 인 스레드 = 진짜 막힘)
  - 스레드 상태 의미: RUNNABLE (CPU 또는 IO) / BLOCKED (monitor 대기) / WAITING / TIMED_WAITING / NEW / TERMINATED — 각 상태별 진단 포인트
  - 데드락 자동 탐지: "Found one Java-level deadlock" 출력 + 수동 lock graph 분석
  - 락 식별자 해석: `- waiting to lock <0x000000076a3b9c80>` ↔ `- locked <0x000000076a3b9c80>` 매칭으로 누가 누굴 막고 있는지 추적
  - 스레드 풀 고갈 진단: HTTP worker (tomcat-http-N), HikariPool connection adder, kafka-consumer-network-thread 패턴 인식
  - 분석 도구: fastthread.io (시각화), IBM TDA, Spotify thread-dump-analyzer
- 동시성 프로파일링 도구: async-profiler (lock contention), IntelliJ Concurrency Profiler, JFR Lock Inflation 이벤트

### Phase 3: 실전 적용
- msa 프로젝트에서 `@Async`, `CompletableFuture`, `suspend` 함수 사용 패턴 점검
- Spring `@Scheduled` + 동시성 고려사항
- Kafka Consumer 의 concurrency 설정 (`concurrency: N`)
- Redis 분산 락 구현 패턴 (Redisson, Lettuce)
- JPA + 동시성: Optimistic Lock (`@Version`) vs Pessimistic Lock
- Virtual Threads 적용 가능 영역 탐색 (Spring Boot 3.2+, JDK 25)

### Phase 4: 면접 대비
- "volatile 과 synchronized 의 차이는?"
- "ConcurrentHashMap 과 Hashtable 의 차이는?"
- "CompletableFuture 와 Kotlin Coroutine 의 차이는?"
- "Virtual Threads 가 뭐고 언제 쓰나요?"
- "Deadlock 과 Livelock 의 차이는? 진단 방법은?"
- "스레드 덤프를 어떻게 수집하나요? 단발 dump 만으로 충분한가요?"
- "BLOCKED 상태 스레드가 많이 보일 때 어떻게 원인을 추적하나요? lock id 매칭은?"
- "ReadWriteLock 이 유리한 경우와 불리한 경우?"

## 5. 코드베이스 연관성

- **msa 전 서비스의 비동기 처리 코드**
- **Kafka Consumer 설정**: `{service}/app/src/main/resources/application.yml` (concurrency)
- **Spring 비동기**: `@Async`, `@Scheduled`
- **JPA 락**: `@Lock`, `@Version` 어노테이션 사용 여부
- **Redis 분산 락**: gateway 의 Rate Limiting 구현

## 6. 참고 자료

- "Java Concurrency in Practice" - Brian Goetz
- Kotlin Coroutine 공식 가이드
- JEP 425 (Virtual Threads)
- Martin Thompson 의 Mechanical Sympathy 블로그

## 7. 미결 사항

> **회고 (2026-05-02)**: 본 섹션은 plan 작성 시점의 미결 항목이며, 현재 deep study 완료 상태에서 각 항목별로 마킹됨.

- Java 와 Kotlin 둘 다 같은 비중 vs Kotlin 위주?
  - ✅ 결정: Java 기본기(01-13, 17, 19) + Kotlin 고수준(14-16) 균형 분담. `18-reactor-vs-coroutine.md` 에서 두 패러다임 명시 대조.
- Reactor (Spring WebFlux) 포함 여부
  - ✅ 결정: 포함. `18-reactor-vs-coroutine.md` 에서 gateway WebFlux 선택 근거까지 다룸 (상세 deep dive 는 #16/#17 으로 분담).
- Virtual Threads 실습 포함 여부
  - 🔄 부분 결정: 이론 + JEP 491 pinning 해소 + 적용 가능 영역까지 (`17-virtual-threads.md`) / 추가 검토 필요: 별도 실측 lab 파일 미작성 (improvements 의 도입 검토 후보로 이관).
- Deadlock 재현 + 진단 실습 포함 여부
  - ✅ 결정: 진단 dedicated 섹션(Phase 2.5: `20-thread-dump-analysis.md` + `21-profiling-tools.md`)에서 BLOCKED/WAITING + lock id 매칭 + 풀 고갈 패턴까지 정리. 명시적 재현 lab 은 분석 절차 안에 통합.

## 8. 원본 메모

Java/Kotlin 동시성 심화 (synchronized, volatile, AtomicXxx, ConcurrentHashMap 내부, Kotlin coroutine, Virtual Threads/Loom)
