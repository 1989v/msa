---
parent: 16-async-nonblocking-io
type: preview
created: 2026-05-01
---

# 비동기 · 논블로킹 IO — Preview

> 학습자 수준: 중상급 (Spring/Reactor 사용 경험은 있으나 OS 레벨까지 파본 적 없음)
> 전체 예상 시간: 18h · 목표: 면접 대비 + 기존 msa 코드 재해석 + WebFlux 유지/이탈 의사결정 자료
> 계획서: [00-plan.md](00-plan.md) · 깊이 패키지: P3 풀팩 · 학습 순서: Bottom-up (OS → Java → 프레임워크 → 적용)

---

## 멘탈 모델: "IO 스택 4층"

비동기/논블로킹 IO (Input/Output, 입출력) 는 한 덩어리가 아니라 **OS → Java → 라이브러리 → 어플리케이션** 4층의 협업이다. 면접에서 흔들리는 사람의 90% 는 이 층을 섞어서 답한다.

```
  ┌─────────────────────────────────────────────────┐
  │  Layer 4: 어플리케이션                            │
  │  - Coroutine / Reactor / WebFlux / 일반 MVC      │
  │  - HTTP client 선택, 도메인 패턴                  │
  └────────────────────┬────────────────────────────┘
                       │ "프로그래밍 모델"
  ┌────────────────────┴────────────────────────────┐
  │  Layer 3: 라이브러리 / 런타임                     │
  │  - Netty (EventLoop / Pipeline / ByteBuf)        │
  │  - Project Reactor (Mono/Flux/Schedulers)        │
  │  - Lettuce / Spring Cloud Gateway / Kafka client │
  └────────────────────┬────────────────────────────┘
                       │ "Java 추상화 위에 패턴"
  ┌────────────────────┴────────────────────────────┐
  │  Layer 2: Java IO API                            │
  │  - Channel / Buffer / Selector                   │
  │  - Direct Buffer / FileChannel.transferTo        │
  │  - NIO.2 AsynchronousChannel (실패한 모델)        │
  └────────────────────┬────────────────────────────┘
                       │ "syscall 매핑"
  ┌────────────────────┴────────────────────────────┐
  │  Layer 1: OS IO multiplexing                     │
  │  - read/write (blocking)                         │
  │  - select / poll / epoll / kqueue / IOCP         │
  │  - io_uring (Linux 5.1+)                         │
  └─────────────────────────────────────────────────┘
```

**핵심 7문장만 외운다**:
1. **IO 는 두 단계** — `데이터 도착 대기` + `커널→유저 버퍼 복사`. "비동기"란 둘 다 위임한 모델.
2. **Sync/Async 와 Blocking/Non-blocking 은 다른 축** — IO multiplexing 은 sync non-blocking, 진짜 async 는 io_uring/IOCP 뿐이다.
3. **epoll 이 select 보다 빠른 핵심은 O(N) 스캔이 사라진 게 아니라 fd 등록을 한 번만 하기 때문** (커널이 ready list 를 유지).
4. **Java NIO Selector 는 실질적으로 epoll 의 Java wrapper** (Linux 기준).
5. **Netty 의 한 EventLoop = 한 thread + 한 Selector** — Handler 안에서 절대 blocking 금지.
6. **Reactor 의 Backpressure 는 "request(n)" 신호** — buffer/drop/latest 는 그 신호를 무시할 때의 fallback.
7. **WebFlux 는 IO 다중화로 thread 수를 줄여 메모리/컨텍스트 스위치를 줄이는 모델** — Virtual Threads 가 같은 효과를 더 단순하게 내면서 가치 재평가 중.

---

## 소주제 지도

> 19 개 파일로 분할. 각 파일 평균 ~1h.

### Phase 1: 기본 개념 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | C10K 문제와 thread-per-connection 의 한계 | [01-c10k-problem.md](01-c10k-problem.md) | thread 메모리/컨텍스트 스위치, C10K → C10M |
| 02 | IO 의 두 단계 + 4 가지 IO 모델 | [02-io-stages-and-models.md](02-io-stages-and-models.md) | wait + copy, blocking/non-blocking/multiplexing/async |
| 03 | Sync/Async × Blocking/Non-blocking 4 분면 | [03-sync-async-quadrants.md](03-sync-async-quadrants.md) | "비동기"의 다층적 의미, 면접에서 가장 흔들리는 부분 |

### Phase 2: 심화 (11개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 04 | Linux IO multiplexing 발전 (select / poll / epoll) | [04-linux-multiplexing-evolution.md](04-linux-multiplexing-evolution.md) | fd_set 1024 한계, epoll ET vs LT, kqueue/IOCP |
| 05 | io_uring — 진짜 async IO | [05-io-uring.md](05-io-uring.md) | SQ/CQ ring buffer, syscall amortization, 보안 우려와 disable 추세 |
| 06 | Java NIO — Channel / Buffer / Selector | [06-java-nio-channel-buffer-selector.md](06-java-nio-channel-buffer-selector.md) | Buffer 의 4 포인터, Selector 사용 패턴, NIO.2 가 망한 이유 |
| 07 | Direct Buffer & Zero-copy (sendfile / mmap) | [07-direct-buffer-zerocopy.md](07-direct-buffer-zerocopy.md) | 4 → 2 컨텍스트 스위치, FileChannel.transferTo |
| 08 | Reactor 패턴 vs Proactor 패턴 | [08-reactor-vs-proactor.md](08-reactor-vs-proactor.md) | Doug Lea, demultiplexer + handler, Linux=Reactor, Windows=Proactor |
| 09 | Netty 내부 (EventLoop / Pipeline / ByteBuf) | [09-netty-internals.md](09-netty-internals.md) | boss/worker, ChannelHandler 체인, ByteBuf 참조 카운팅 |
| 10 | Project Reactor — Mono/Flux/Schedulers | [10-project-reactor.md](10-project-reactor.md) | assembly vs subscription, Hot/Cold, Schedulers 4 종 |
| 11 | Backpressure 전략 | [11-backpressure.md](11-backpressure.md) | request(n), buffer/drop/latest/error, overflow 전략 |
| 12 | Spring WebFlux vs Spring MVC | [12-webflux-vs-mvc.md](12-webflux-vs-mvc.md) | thread model 비교, 언제 빠르고 언제 손해인가 |
| 13 | Virtual Threads 와 WebFlux 가치 재평가 | [13-virtual-threads-impact.md](13-virtual-threads-impact.md) | JDK 21+ VT, pinning, MVC + VT 가 일반적으로 더 단순 |
| 14 | Kotlin Coroutine vs Reactor 비교 | [14-coroutine-vs-reactor.md](14-coroutine-vs-reactor.md) | suspend = continuation, awaitSingle, structured concurrency |

### Phase 3: 코드베이스 적용 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 15 | msa Gateway 의 WebFlux 사용 분석 | [15-msa-gateway-webflux.md](15-msa-gateway-webflux.md) | AuthenticationGatewayFilter, ReactiveRedisTemplate, Mono 체인 |
| 16 | Lettuce + Kafka client 의 NIO 사용 | [16-lettuce-kafka-nio.md](16-lettuce-kafka-nio.md) | Lettuce = Netty 기반 single-thread, Kafka NIO selector loop |
| 17 | HTTP client 선택 트레이드오프 (WebClient vs RestClient vs OkHttp) | [17-http-client-tradeoffs.md](17-http-client-tradeoffs.md) | order/auth/search/quant 의 선택 점검 |

### 산출물 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 18 | msa 비동기/논블로킹 적용 후보 + WebFlux 마이그레이션 검토 | [18-improvements.md](18-improvements.md) | 9 개 제안 + 우선순위, MVC + Virtual Threads 결정 가이드 |
| 19 | 면접 Q&A 카드 + 50 문항 인덱스 | [19-interview-qa.md](19-interview-qa.md) | 4 Phase × 8개 = 32 카드 + 50 문항 |

---

## 개념 관계도

```
                 ┌─────────────────────────────┐
                 │  C10K — thread-per-conn 한계  │
                 └─────────────┬───────────────┘
                               │ "한 thread 가 여러 fd"
                               ▼
                 ┌─────────────────────────────┐
                 │  IO multiplexing             │
                 │  (select → poll → epoll)     │
                 └─────────────┬───────────────┘
                               │ "Java 추상화"
                               ▼
                 ┌─────────────────────────────┐
                 │  Java NIO Selector           │
                 │  + Direct Buffer / sendfile  │
                 └─────────────┬───────────────┘
                               │ "프레임워크 패턴"
                               ▼
                 ┌─────────────────────────────┐
                 │  Reactor Pattern             │
                 │  (demultiplex + dispatch)    │
                 └─────────────┬───────────────┘
                               │ "산업 구현체"
                               ▼
                 ┌─────────────────────────────┐
                 │  Netty (EventLoop)           │
                 │  └─ Lettuce / SCG / WebFlux  │
                 └─────────────┬───────────────┘
                               │ "프로그래밍 모델"
                               ▼
                 ┌─────────────────────────────┐
                 │  Reactive vs Coroutine vs VT │
                 │  (모두 동일 IO 위에 다른 syntax) │
                 └─────────────────────────────┘
```

---

## Phase 1 치트시트 (학습 시작 전 한 장)

### 4 분면 정의

|  | Blocking | Non-Blocking |
|---|---|---|
| **Sync** | 일반 read/write | non-blocking socket + busy loop |
| **Sync (multiplex)** | — | **select / poll / epoll** ← 가장 흔함 |
| **Async** | (의미 없음) | **POSIX AIO / Windows IOCP / io_uring** |

> "IO multiplexing 은 async 인가?" → **No, sync non-blocking**. 데이터 복사는 여전히 호출자가 한다.

### 면접 빈출 5 단어

- **C10K** — Dan Kegel, 1999 — 10K 동접에서 thread-per-conn 가 무너지는 지점
- **epoll** — Linux 2.6 — fd 를 미리 등록, ready list 를 커널이 유지
- **Reactor 패턴** — Doug Lea "Scalable IO in Java"
- **Backpressure** — 소비자가 생산자를 제어, Reactive Streams `request(n)`
- **Virtual Threads** — JDK 21, JEP 444, MVC 의 thread-per-request 를 사실상 부활시킴

### 절대 하지 말 것

- WebFlux 안에서 `Thread.sleep` / JDBC blocking call (EventLoop 가 멈춘다)
- Reactor 에서 `block()` (테스트 외 금지)
- Netty Handler 안에서 long-running CPU 작업
- Kafka Consumer 의 `poll()` 루프를 별도 thread 로 옮기기
- ByteBuf `release()` 안 부르기 (메모리 누수)
- JDBC + WebFlux 를 직접 호출 (R2DBC 사용 또는 boundedElastic 분리)

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 19** (Bottom-up 직진)
- Phase 1 (01-03) 은 OS 레벨 → 한 번 잡으면 나머지가 쉬워진다
- Phase 2 (04-14) 는 의존성 있음 — 04, 06, 09, 10 은 우선순위 최상
- Phase 3 (15-17) 은 학습 종료 직전에 — 코드 grep 하면서 같이 보면 이해도 급상승
- **18-improvements.md** 는 ADR 작성 직전 단계의 자료
- **19-interview-qa.md** 는 회독용 — 1주일 간격 2~3 회독

각 파일 호출:
```
/study:start 16           # 다음 deep file 자동 선택
/study:start 16 09        # 09-netty-internals.md 직접 지정
```
