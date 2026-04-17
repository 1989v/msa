---
id: 3
title: Java/Kotlin 동시성 심화
status: draft
created: 2026-04-16
updated: 2026-04-16
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
- 동시성 버그 디버깅: jstack, async-profiler, IntelliJ Concurrency Profiler

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

- Java 와 Kotlin 둘 다 같은 비중 vs Kotlin 위주?
- Reactor (Spring WebFlux) 포함 여부
- Virtual Threads 실습 포함 여부
- Deadlock 재현 + 진단 실습 포함 여부

## 8. 원본 메모

Java/Kotlin 동시성 심화 (synchronized, volatile, AtomicXxx, ConcurrentHashMap 내부, Kotlin coroutine, Virtual Threads/Loom)
