---
parent: 16-async-nonblocking-io
seq: 99
title: 비동기 · 논블로킹 IO 개념 카탈로그 — NIO · Reactor · Netty · 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://docs.oracle.com/en/java/javase/21/core/java-nio.html
  - https://projectreactor.io/docs/core/release/reference/
  - https://netty.io/wiki/
  - https://man7.org/linux/man-pages/man7/epoll.7.html
  - https://kernel.dk/io_uring.pdf
  - https://www.reactive-streams.org/
---

# 99. 비동기 · 논블로킹 IO 개념 카탈로그

> **목적** — 16-async-nonblocking-io 의 19+ deep file + JDK NIO / Project Reactor / Netty / Linux man pages 기준 빠진 영역 발굴 (io_uring, AIO, JDK Loom 과의 비교, Reactor Context, Sinks, MultiReactor pattern, Netty FastThreadLocal, ByteBuf pooling 등).

---

## 1. 기존 커버 매트릭스

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| IO 모델 | blocking / non-blocking / async / event-driven | ✅ |
| epoll / kqueue / select / poll | OS 레벨 | ✅ |
| JDK NIO Selector | Channel + Selector + ByteBuffer | ✅ |
| Netty | EventLoop, ChannelPipeline, Bootstrap | ✅ |
| Reactor | Mono / Flux / Schedulers / Backpressure | ✅ |
| Coroutine | Kotlin Flow vs Reactor (cross #3) | ✅ |
| WebFlux | Reactor 위 Spring 5+ | ✅ |
| Backpressure | Pull / Push / Reactive Streams 표준 | ✅ |
| **Reactor + Netty 파이프라인 통합** (Mono/Flux ↔ ChannelHandler ↔ EventLoopGroup ↔ ByteBuf, WebFlux 내부) | reactive 풀스택 분해 | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| msa 적용 | gateway WebFlux, charting Python async | ✅ |

### 1-A. 갭 진단

1. **Linux io_uring** — 5.1+ 새 async IO interface (epoll 후속 가능성)
2. **POSIX AIO (libaio)** — 한정 사용 (DB direct IO)
3. **JDK Virtual Threads (#3 cross) vs Reactive** — Loom 이 reactive 를 일부 대체
4. **Netty 의 EventLoop pinning + JDK 21 Virtual Threads 호환성**
5. **Netty ByteBuf** — direct vs heap, pooled vs unpooled, ref counting
6. **Netty FastThreadLocal** vs ThreadLocal
7. **Netty Pipeline 의 inbound/outbound handler 순서**
8. **Netty Bootstrap (server/client)** + Channel options (SO_BACKLOG / TCP_NODELAY / SO_KEEPALIVE / SO_LINGER)
9. **Reactor Context** — ThreadLocal 대체
10. **Reactor Sinks** — Many / One / Empty + Sinks.unsafe / Sinks.tryEmit
11. **Reactor Schedulers** (parallel / boundedElastic / single / immediate / fromExecutorService)
12. **Reactor 의 publishOn vs subscribeOn**
13. **Reactor 의 hot vs cold publishers + share/replay/multicast**
14. **Project Reactor 의 Reactor Netty (server/client)** internals
15. **WebFlux 의 functional routing** vs annotation
16. **WebFlux Filter 체인** vs Spring MVC Filter
17. **R2DBC + WebFlux** end-to-end reactive
18. **Reactor Test** — StepVerifier
19. **TCP buffer / Nagle / TCP_NODELAY / QUICKACK**
20. **HTTP/2 multiplexing on Netty + h2c (cleartext)**
21. **HTTP/3 (QUIC) + Netty (incubator) + JDK HttpClient 미지원 현황**
22. **WebSocket on Netty + STOMP frames**
23. **gRPC on Netty (#18 cross)**
24. **Reactive Streams 표준 (Java 9 Flow API)** — TCK
25. **Reactive Streams 의 specification — onSubscribe/onNext/onError/onComplete + request(n)**
26. **Backpressure 전략 (BUFFER/DROP/LATEST/ERROR)** + Bound vs Unbounded
27. **Mutiny / RxJava 3 / Reactor 비교**
28. **Akka Streams** (실험) — alternate
29. **DataBuffer** (Spring) vs ByteBuf (Netty) vs ByteBuffer (NIO)
30. **JDK 11+ HttpClient (sync+async)** — non-blocking 표준
31. **Loom + structured concurrency 와 reactive 차이**
32. **Server-Sent Events (SSE)** — Reactor / Spring WebFlux 지원
33. **Backoff + Retry (Reactor.retry / Reactor Resilience4j)**

---

## 2. 카테고리별 개념 트리

### A. IO 모델

| 모델 | 정의 | 상태 |
|---|---|---|
| Blocking IO | thread-per-connection | ✅ |
| Non-blocking IO (select/poll/epoll/kqueue) | event-driven | ✅ |
| Async IO (POSIX AIO / Windows IOCP) | callback | 🟡 |
| **io_uring** (Linux 5.1+) | submission + completion ring | ★ 신규 |
| Reactor pattern | event demultiplexer + handlers | ✅ |
| Proactor pattern | OS 가 IO 완료 후 handler 호출 | 🟡 |

### B. JDK NIO

| 개념 | 정의 | 상태 |
|---|---|---|
| Channel / Selector / SelectionKey | 핵심 3 추상 | ✅ |
| ByteBuffer (direct / heap) | 메모리 | ✅ |
| FileChannel + transferTo (zero-copy) | sendfile | 🟡 |
| Path / Files (NIO.2) | filesystem | 🟡 |
| AsynchronousChannel (NIO.2) | callback / Future | ★ 신규 |
| MemoryMapped IO | mmap | 🟡 |

### C. Netty

| 개념 | 정의 | 상태 |
|---|---|---|
| EventLoop / EventLoopGroup | Netty 의 thread model | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| ChannelPipeline + Inbound/Outbound Handler | event 흐름 | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| Bootstrap / ServerBootstrap | client / server 시작 | ✅ |
| **ByteBuf** — direct/heap/composite + pooled/unpooled | 메모리 | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| **Reference counting (ref count)** + leak detector | release 의무 | ★ 신규 |
| **FastThreadLocal** | ThreadLocal 보다 빠른 lookup | ★ 신규 |
| Channel options (SO_BACKLOG / TCP_NODELAY / SO_KEEPALIVE / SO_LINGER) | 표준 옵션 | ★ 신규 |
| HTTP codec (HTTP/1, HTTP/2, HTTP/3 incubator) | 코덱 | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| Netty + Virtual Threads 호환성 | Loom 영향 | ★ 신규 |

### D. Project Reactor

| 개념 | 정의 | 상태 |
|---|---|---|
| Mono / Flux | 0-1 / 0-N | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| Operator (map / flatMap / concatMap / switchMap / merge / zip) | 변환 | ✅ |
| **publishOn vs subscribeOn** | scheduler 변경 | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| **Schedulers** (parallel / boundedElastic / single / immediate) | thread pool | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| **Backpressure (BUFFER/DROP/LATEST/ERROR)** | overflow strategy | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| **Reactor Context** | ThreadLocal 대체 — coroutine context 와 유사 | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| **Sinks** (Many.unicast/multicast/replay, One, Empty) | hot publisher | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| Hot vs Cold | share / replay / multicast / autoConnect | ✅ |
| Retry / repeat / backoff (Reactor.retry / Resilience4j) | 회복성 | 🟡 |
| **StepVerifier** (Reactor Test) | reactive test | ★ 신규 |

### E. Reactive Streams 표준

| 개념 | 정의 | 상태 |
|---|---|---|
| Publisher / Subscriber / Subscription / Processor | 4 추상 | ★ 신규 |
| onSubscribe / onNext / onError / onComplete | signal 4개 | ★ 신규 |
| request(n) — pull-based backpressure | spec | ★ 신규 |
| **Java 9 Flow API** | 표준 위치 | ★ 신규 |
| TCK (Technology Compatibility Kit) | 적합성 | ★ 신규 |
| Reactor / RxJava 3 / Mutiny / Akka Streams 비교 | 구현 | 🟡 |

### F. Spring WebFlux

| 개념 | 정의 | 상태 |
|---|---|---|
| WebFlux 의 두 모델 (annotation / functional routing) | 2 | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| WebFilter | non-blocking filter | ✅ |
| WebClient | non-blocking HTTP client (RestTemplate 후속) | ✅ |
| R2DBC integration | reactive DB | ★ 신규 |
| **Reactor Netty** (server / client) | 기본 server | ✅ 커버 ([20](20-reactor-netty-pipeline-deep.md)) |
| Server-Sent Events (SSE) | text/event-stream | ★ 신규 |
| WebSocket on WebFlux | reactive ws | 🟡 |

### G. Coroutine 비교 (#3 cross)

| 개념 | Reactor | Coroutine |
|---|---|---|
| 0-N stream | Flux | Flow |
| 0-1 | Mono | suspend fun (or Deferred) |
| context | Reactor Context | CoroutineContext |
| backpressure | request(n) | buffer/conflate/sample |
| cold | default | default |
| hot | share / replay | StateFlow / SharedFlow |

### H. JDK 표준 (Loom 후 영향)

| 개념 | 정의 | 상태 |
|---|---|---|
| Virtual Threads (JEP 444, #3 cross) | M:N, blocking 친화 | ✅ |
| Structured Concurrency (#3) | scope-based 자식 task | ★ 신규 |
| Loom 이 reactive 를 일부 대체? | "blocking 안전 + 단순" — 단순 워크로드는 Loom 권장 | ★ 신규 |
| **JDK 11+ HttpClient** (sync + async) | non-blocking 표준 | 🟡 |

### I. OS / kernel

| 개념 | 정의 | 상태 |
|---|---|---|
| epoll / kqueue / select / poll | 다중 IO 다중화 | ✅ |
| **io_uring** | submission/completion ring | ★ 신규 |
| sendfile / splice / vmsplice | zero-copy | 🟡 |
| TCP_NODELAY / Nagle / QUICKACK | small write latency | ★ 신규 |
| SO_REUSEPORT / SO_REUSEADDR | listener pooling | 🟡 |
| TCP fast open (TFO) | 0-RTT TCP | ★ 신규 |

### J. msa 적용

| 위치 | 사용 | 상태 |
|---|---|---|
| gateway | WebFlux + Reactor Netty | ✅ |
| charting (Python) | FastAPI + asyncio | ✅ |
| 일반 서비스 (Spring MVC) | blocking + Tomcat | ✅ (Loom 도입 후보) |
| Kafka consumer | blocking | ✅ |
| Reactor 적용 후보 | gateway 외부 호출 (외부 PG 등) | 🟡 |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **Loom (Virtual Threads) vs Reactive — 결정 가이드** | 새 코드 작성 표준 |
| 2 | **Reactor Context + 분산 trace propagation** (#10 cross) | reactive 환경 trace 표준 |
| 3 | **Netty ByteBuf + ref counting + leak detector** | 운영 사고 단골 |
| 4 | **publishOn vs subscribeOn 정확히 이해** | reactive 코드의 흔한 오해 |
| 5 | **io_uring** | 차세대 async IO |
| 6 | **R2DBC + WebFlux end-to-end reactive** | reactive 도입 시 |
| 7 | **Reactive Streams 표준 + Java 9 Flow API** | spec 토대 |
| 8 | **Reactor Sinks (hot publisher)** | event hub 패턴 |
| 9 | **WebFlux Filter / WebClient 표준** | gateway 표준 |
| 10 | **JDK 11+ HttpClient (async)** | RestTemplate / Apache HC 후속 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. Async 특화:
- §3 → "Pull vs Push 다이어그램" + "scheduler 매핑" 표
- §6 → "Reactor vs Coroutine vs Loom" 비교
- §7 → "leak detector / scheduler saturation / blocking call 회피" 표

---

## 5. 참고 자료

- JDK NIO: https://docs.oracle.com/en/java/javase/21/core/java-nio.html
- Project Reactor: https://projectreactor.io/docs/core/release/reference/
- Netty wiki: https://netty.io/wiki/
- Reactive Streams: https://www.reactive-streams.org/
- io_uring whitepaper: https://kernel.dk/io_uring.pdf
- "Netty in Action" (Norman Maurer)
- "Reactive Spring" (Josh Long)
- "Hands-on Reactive Programming with Reactor"
