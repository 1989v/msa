---
id: 16
title: 비동기 · 논블러킹 IO — NIO · Reactor · Netty
status: completed
created: 2026-05-01
updated: 2026-05-02
tags: [async, non-blocking, nio, reactor, netty, webflux, epoll, io-multiplexing]
difficulty: advanced
estimated-hours: 18
codebase-relevant: true
---

# 비동기 · 논블러킹 IO

## 1. 개요

"비동기"와 "논블로킹"은 자주 혼용되지만 서로 다른 축이다. OS 단의 IO 모델(blocking/non-blocking, sync/async, IO multiplexing) 부터 Java NIO/NIO.2, Reactor 패턴, Netty 내부, Spring WebFlux/Reactor Project 까지 *IO 계층의 비동기*를 학습한다.

#3(동시성)은 *thread/memory model*, 본 주제는 *IO model* — 면접에서 명확히 구분되는 주제.

## 2. 학습 목표

- Blocking/Non-blocking 과 Sync/Async 4분면 구분 (특히 Linux IO 의 의미)
- Linux IO multiplexing (select / poll / epoll / kqueue / io_uring) 의 발전과 차이
- Java NIO 의 Channel/Buffer/Selector 모델 + Direct Buffer (zero-copy)
- Reactor 패턴 (Reactor / Proactor)
- Netty 의 EventLoop / Pipeline / Handler / ByteBuf 내부
- Project Reactor (Mono/Flux) 의 backpressure
- Spring WebFlux 와 Spring MVC 의 throughput/latency 트레이드오프
- Virtual Threads (JDK 21+) 도입으로 WebFlux 의 가치 재평가
- C10K, C10M 문제 컨텍스트

## 3. 선수 지식

- TCP/IP 기본
- Linux file descriptor / system call
- #3 동시성 (thread, scheduler) 기본

## 4. 학습 로드맵

### Phase 1: 기본 개념
- C10K problem: 10,000 동접에서 thread-per-connection 한계
- IO 의 두 단계: 데이터 도착 대기 / 커널-유저 버퍼 복사
- 4가지 IO 모델
  - Blocking IO (read 가 데이터 올 때까지 막힘)
  - Non-blocking IO (즉시 EAGAIN 리턴, busy-wait)
  - IO Multiplexing (select/poll/epoll, 한 thread 가 여러 fd 감시)
  - Async IO (POSIX AIO, Windows IOCP, Linux io_uring — 커널이 buffer 까지 채움)
- Sync vs Async, Blocking vs Non-blocking 4분면 (multiplexing = sync non-blocking)
- "비동기"라는 단어의 다층적 의미 (callback / future / coroutine / event loop)

### Phase 2: 심화
- **Linux IO multiplexing 발전**
  - select: fd_set 1024 한계, O(N) 스캔
  - poll: 한계 제거, 여전히 O(N)
  - **epoll**: O(1), edge-triggered (ET) vs level-triggered (LT), epoll_create/ctl/wait
  - kqueue (BSD/macOS), IOCP (Windows)
  - **io_uring (Linux 5.1+)**: ring buffer 기반 진정한 async IO, syscall 횟수 격감
- **Java NIO**
  - Channel (FileChannel, SocketChannel, ServerSocketChannel)
  - Buffer (position, limit, capacity, mark)
  - Selector (epoll wrapper)
  - Direct Buffer vs Heap Buffer (zero-copy, DMA, off-heap)
  - FileChannel.transferTo (sendfile)
  - NIO.2 (AIO): AsynchronousChannel — 잘 안 쓰임
- **Reactor 패턴**
  - Reactor (Demultiplexer + Synchronous Event Handler)
  - Proactor (커널이 IO 완료 후 callback)
  - Doug Lea "Scalable IO in Java"
- **Netty 내부**
  - EventLoopGroup (boss + worker), 각 EventLoop = single thread + selector
  - Channel - ChannelPipeline - ChannelHandler 체인
  - ByteBuf (pooled / unpooled / direct / heap), reference counting
  - Encoder/Decoder, FrameDecoder
  - HashedWheelTimer
  - Backpressure (Channel.isWritable, watermark)
- **Project Reactor (Mono/Flux)**
  - Cold vs Hot publisher
  - Operator chain (assembly time → subscription time)
  - Schedulers (parallel / boundedElastic / single)
  - **Backpressure**: request(n), buffer/drop/latest 전략
  - Context propagation
- **Spring WebFlux**
  - WebFlux vs MVC: thread model 차이
  - 언제 더 빠른가 (IO-bound 고동시) vs 언제 손해 (CPU-bound, blocking 라이브러리 강제 사용)
  - **Virtual Threads (JDK 21+) 등장** → WebFlux 의 가치 재평가 (대부분은 MVC + VT 가 더 단순)
  - R2DBC 와의 결합
- **Coroutine 과의 관계** (#3 cross-ref)
  - Kotlin coroutine 의 suspend = continuation passing → reactive operator chain 의 동등물
  - Reactive 보다 결과 코드가 훨씬 imperative

### Phase 3: 실전 적용
- msa **gateway** (Spring Cloud Gateway) — WebFlux 기반 점검
- 일반 서비스 (product, order 등) MVC + (향후) Virtual Threads 단순성 평가
- Netty 직접 사용처 (Lettuce 가 내부적으로 Netty 사용) — Lettuce reactive vs sync API latency 비교
- Kafka producer/consumer 의 IO 모델 (NIO 기반 selector loop)
- HTTP client 선택: WebClient (Reactor) vs RestClient (blocking) vs OkHttp — 서비스 별 적합도

### Phase 4: 면접 대비
- "Sync/Async 와 Blocking/Non-blocking 의 차이는?"
- "epoll 이 select 보다 빠른 이유는?"
- "Reactor 와 Proactor 의 차이?"
- "WebFlux 가 항상 MVC 보다 빠른가요?"
- "Virtual Threads 가 나오면서 WebFlux 의 의미는?"
- "Backpressure 가 뭔가요? Reactor 는 어떻게 처리하나요?"
- "Netty 의 EventLoop 가 1 thread 인 이유는?"
- "Direct Buffer 와 Heap Buffer 의 차이는?"

## 5. 코드베이스 연관성

- **gateway**: Spring Cloud Gateway (WebFlux 기반)
- **Lettuce (Redis client)**: Netty 기반 — 모든 서비스가 사용
- **Kafka client**: NIO selector
- **잠재 적용**: SSE/WebSocket 서비스, 외부 API 다중 호출 fan-out

## 6. 참고 자료

- Doug Lea "Scalable IO in Java"
- "The Linux Programming Interface" — IO 챕터
- Netty In Action
- Project Reactor 공식 reference
- Eric Brewer / von Behren C10K page
- "Efficient IO with io_uring" — Jens Axboe

## 7. 미결 사항

> **회고 (2026-05-02)**: 본 섹션은 plan 작성 시점의 미결 항목이며, 현재 deep study 완료 상태에서 각 항목별로 마킹됨.

- io_uring 깊이 (Java 가 직접 안 씀)
  - ✅ 결정: `05-io-uring.md` 에서 SQ/CQ ring buffer + syscall amortization + 보안 우려/disable 추세까지 개념 정리. Java 직접 사용 안 함을 명시 (POSIX AIO/IOCP 와 함께 비교).
- Netty 내부 코드 reading 깊이
  - ✅ 결정: `09-netty-internals.md` 에서 boss/worker EventLoop + ChannelHandler 체인 + ByteBuf 참조 카운팅까지 (Phase 2 우선순위 최상). 코드 파일 단위 reading 보다는 구조/계약 중심.
- WebFlux 실습 vs 이론
  - 🔄 부분 결정: `12-webflux-vs-mvc.md` (이론) + `15-msa-gateway-webflux.md` (gateway 실 코드 분석: AuthenticationGatewayFilter, ReactiveRedisTemplate, Mono 체인). 추가 검토 필요: 별도 마이그레이션 lab 미작성 (improvements 의 결정 가이드로 통합).
- Virtual Threads 와의 비교 깊이 (#3 과 어디까지 분담)
  - ✅ 결정: `13-virtual-threads-impact.md` 에서 JDK 21+ VT + pinning + MVC+VT 가 일반적 우위 결론. #3 은 동시성 프리미티브로서의 VT (JDK 25, JEP 491) / #16 은 IO 모델 비교 관점에서 분담.

## 8. 원본 메모

```
16. 비동기, 논블러킹
```
