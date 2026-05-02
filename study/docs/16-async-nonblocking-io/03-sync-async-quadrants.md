---
parent: 16-async-nonblocking-io
seq: 03
title: Sync/Async × Blocking/Non-blocking 4 분면
type: deep
created: 2026-05-01
---

# 03. Sync/Async × Blocking/Non-blocking 4 분면

## TL;DR

- Sync/Async 와 Blocking/Non-blocking 은 **같은 축이 아니다**
- Sync/Async = "단계 2 (복사) 를 누가 하느냐" — 호출자(sync) vs OS(async)
- Blocking/Non-blocking = "호출이 즉시 리턴하느냐" — block(blocking) vs 즉시(non-blocking)
- 그래서 **4 분면**이 나오는데, 실용적으로는 3 칸만 의미가 있다
- "비동기" 라는 한국어는 callback/future/coroutine/event-loop 모두를 가리켜 모호함 — 면접에서 명확히 정의하고 답해야 한다

---

## 1. 4 분면의 정의

리처드 스티븐스 *UNIX Network Programming* Volume 1 의 분류를 따른다.

|  | **Blocking** | **Non-blocking** |
|---|---|---|
| **Synchronous** | (1) 일반 read/write | (2) non-blocking socket + EAGAIN polling |
| **Synchronous (multiplexed)** | — | (3) **select / poll / epoll** ← 가장 흔함 |
| **Asynchronous** | (의미 없음) | (4) **io_uring / IOCP / POSIX AIO** |

> 실은 stevens 의 원본 분류는 위 표를 약간 단순화한 것. (3) 은 (2) 의 한 형태이지만 별도로 부르는 게 일반적이라 분리.

핵심 규칙:
- **Async 는 항상 Non-blocking** (호출이 즉시 리턴해야 async 가 의미 있음 → "async + blocking" 은 모순)
- 그래서 분면이 "거의 3개" 가 된다

---

## 2. 단계별로 다시 보는 분류

[02 글](02-io-stages-and-models.md) 의 두 단계 모델을 그대로 끌고 와서 분류하면:

```
                  단계 1: 대기              단계 2: 복사
                  ─────────────────────  ──────────────────
(1) Blocking      호출자 block           호출자
(2) Non-blocking  호출자 polling          호출자
(3) Multiplexing  OS 가 한꺼번에 block    호출자       ← sync non-blocking
(4) Async         OS                     OS           ← async non-blocking
```

**"단계 2 를 OS 가 해주는가"** — 이 한 줄이 sync/async 의 정의다.

---

## 3. 실전: 우리가 쓰는 모든 것은 (3) 번이다

실무에서 마주치는 대부분의 비동기 코드는 분면 (3) 이다.

| 라이브러리/프레임워크 | 분면 |
|---|---|
| Java NIO Selector | (3) |
| Netty | (3) |
| Lettuce | (3) (Netty 위) |
| Spring WebFlux | (3) (Reactor Netty 위) |
| Project Reactor | (3) (스케줄러는 thread pool) |
| Kotlin Coroutine + suspend HTTP | (3) (실제 IO 는 Selector) |
| node.js libuv | (3) (epoll/kqueue) |
| Kafka Java client | (3) (NIO Selector) |

**진짜 (4) 분면은**:
- Windows IOCP (.NET async/await 의 진짜 백엔드)
- Linux io_uring (특정 Netty incubator transport)
- Java NIO.2 `AsynchronousChannel` 의 Windows 구현

> 그런데 우리 msa 는 100% 리눅스/맥 기반이고 Netty 도 epoll transport 를 쓴다. 즉 **실질적으로 분면 (3) 만 사용한다.** 면접에서 io_uring 은 키워드만 알면 된다.

---

## 4. "비동기"라는 한국어의 다층 의미

면접에서 "비동기로 짜주세요" 가 나오면 7 가지 중 무엇인지 헷갈린다. 정리:

```
"비동기"
 ├── (a) 호출이 즉시 리턴 (= non-blocking 가까움)
 ├── (b) 결과가 callback 으로 옴 (CompletionHandler)
 ├── (c) 결과가 Future 로 옴 (CompletableFuture)
 ├── (d) 결과가 Promise 로 옴 (JS, Kotlin Deferred)
 ├── (e) Reactive stream 으로 옴 (Mono/Flux)
 ├── (f) suspend 함수 (Coroutine)
 ├── (g) Event loop + handler 모델 (Netty, libuv)
```

이 중 어떤 의미냐에 따라 답이 달라진다. 면접 답변 시:

> "분류 축은 두 개입니다. 하나는 *호출이 즉시 리턴하는가* (block/non-block), 다른 하나는 *결과 처리 단계를 OS 에 위임하는가* (sync/async). 어플리케이션 차원에서 '비동기' 라고 하면 보통 (b)~(g) 중 하나의 *프로그래밍 모델* 을 의미하고, OS 차원에서 '비동기' 라고 하면 분면 (4) 의 io_uring/IOCP 를 의미합니다. 두 가지가 같은 단어로 묶여 있어서 혼동이 생깁니다."

이 답변 한 번이면 면접관은 "이 사람 IO 모델 안다" 고 판단한다.

---

## 5. CompletableFuture / Coroutine 은 어디?

위 표에 없다. 왜냐하면 이들은 **OS 차원이 아니라 어플리케이션 레벨의 *결과 전달* 추상화** 이기 때문이다. 실제 IO 는 여전히 Selector/epoll = (3) 분면.

```
┌──────────────────────────┐
│  App Layer               │
│  - CompletableFuture      │
│  - Coroutine (suspend)    │
│  - Reactor (Mono/Flux)    │
│  - Promise                │
│  ↓ 위 추상화는 결과 전달    │
│  ↓ 만 비동기로 보이게 함    │
└──────────┬───────────────┘
           │
┌──────────┴───────────────┐
│  IO Layer                │
│  - Selector / epoll      │  ← 실제 IO 모델은 여기서 결정됨
│  - 분면 (3) sync nonblock │
└──────────────────────────┘
```

즉 "CompletableFuture 로 짜면 비동기" 라는 말은 *결과 처리* 만 비동기일 뿐, IO 자체는 여전히 (3) 분면이다.

> 다시 말해: **`CompletableFuture.supplyAsync { JdbcCall() }` 은 thread pool 에서 blocking 으로 도는 코드**다. async 라는 이름이 붙어 있을 뿐.

---

## 6. 그림: 추상화 단계별 분면

```
  ┌────────────────────────────────────────────────┐
  │  Programming model                              │
  │  ┌──────────────┐  ┌──────────────┐            │
  │  │ Coroutine    │  │ Reactor      │            │
  │  │ suspend      │  │ Mono/Flux    │            │
  │  └──────┬───────┘  └──────┬───────┘            │
  └─────────┼─────────────────┼─────────────────────┘
            │ "결과 전달 추상화"  │
            ▼                 ▼
  ┌────────────────────────────────────────────────┐
  │  IO model (실제로 OS 에 부탁하는 방식)            │
  │  ┌──────────────┐  ┌──────────────┐            │
  │  │ Selector     │  │ AsyncChannel │            │
  │  │ (분면 3)      │  │ (분면 4)      │            │
  │  └──────────────┘  └──────────────┘            │
  └────────────────────────────────────────────────┘
```

면접 헷갈림의 99% 는 위 두 층을 같은 평면에 두려고 해서 생긴다.

---

## 7. 코드로 본 4 분면 — 같은 일 다른 분면

```kotlin
// (1) Blocking — 가장 단순
fun fetchBlocking(): String {
    val conn = URL("https://api.example.com/x").openConnection()
    return conn.getInputStream().bufferedReader().readText()
}

// (2) Non-blocking polling — 단독으론 안 씀
fun fetchNonBlockingPoll(channel: SocketChannel) {
    channel.configureBlocking(false)
    val buf = ByteBuffer.allocate(1024)
    while (channel.read(buf) == 0) { /* CPU 100% busy-wait */ }
}

// (3) Multiplexing — Selector (실제로는 Netty/Reactor 가 감싸줌)
fun fetchMultiplexed(selector: Selector, ch: SocketChannel) {
    ch.register(selector, SelectionKey.OP_READ)
    while (true) {
        selector.select()
        selector.selectedKeys().forEach { key ->
            if (key.isReadable) (key.channel() as SocketChannel).read(ByteBuffer.allocate(1024))
        }
    }
}

// (3-app) Coroutine — 호출자 입장에선 sync 처럼 보이지만 IO 모델은 (3)
suspend fun fetchSuspend(client: WebClient): String {
    return client.get().uri("/x").retrieve().awaitBody()
    //     ↑ Reactor Netty 의 Selector 위에서 도는 코드
}

// (4) Async — Java NIO.2 (Linux 에선 시뮬레이션)
fun fetchAsync(ch: AsynchronousSocketChannel) {
    val buf = ByteBuffer.allocate(1024)
    ch.read(buf, null, object : CompletionHandler<Int, Void?> {
        override fun completed(n: Int, a: Void?) { /* OS 가 buf 채워서 콜백 */ }
        override fun failed(e: Throwable, a: Void?) {}
    })
}
```

---

## 8. 자주 나오는 헷갈림 5 가지

### "Reactive 는 async 인가?"
프로그래밍 모델 관점에선 async 처럼 보임. **IO 모델 관점에선 분면 (3) sync non-blocking**. Mono 는 결과 전달 컨베이어일 뿐, 실제 IO 는 epoll Selector.

### "WebFlux + R2DBC 면 진짜 async DB?"
"DB 호출이 thread 를 안 막는다" 는 점에서 어플리케이션 비동기는 맞음. OS 레벨에선 여전히 분면 (3). MySQL 프로토콜 자체는 sync 로 응답하므로.

### "CompletableFuture 는 async 라는 이름인데?"
이름만 그렇다. 실제 IO 모델은 그 안에서 무엇을 하느냐에 달림. `CompletableFuture.supplyAsync { jdbc.query() }` = blocking. `WebClient.exchange().toFuture()` = (3) multiplexing.

### "node.js 는 async 한 언어 아닌가?"
node.js 의 IO 도 분면 (3). libuv 가 epoll/kqueue 위에 동작. 진짜 async 가 아니라 *event loop* 라는 표현이 정확.

### "io_uring 쓰는 코드는 다 async 인가?"
io_uring 자체는 (4) 분면. 그러나 Java 에서 io_uring 을 직접 쓰지 않으면 의미 없음. Netty 의 io_uring transport 도 옵션이고, 우리 msa 는 사용하지 않음.

---

## 9. 면접 답변 템플릿

**Q. Sync/Async 와 Blocking/Non-blocking 의 차이는?**

> "두 축은 다릅니다.
> - Blocking/Non-blocking 은 *호출이 즉시 리턴하는가* — read 가 데이터 없을 때 block 되느냐 EAGAIN 으로 즉시 리턴하느냐.
> - Sync/Async 는 *데이터 복사 단계 (커널→유저) 를 OS 에 위임하느냐* — sync 는 호출자가, async 는 OS 가.
>
> 그래서 분면은 4 개지만 실용적으론 3 개입니다.
> - Blocking sync = 일반 read
> - Non-blocking sync (multiplexed) = epoll, Netty, WebFlux — *우리가 쓰는 거의 모든 비동기 코드*
> - Non-blocking async = io_uring, IOCP — Java 는 거의 안 씀
>
> 'CompletableFuture 는 async' 같은 표현은 *프로그래밍 모델* 차원의 이야기고, OS IO 모델 차원에선 multiplexing 입니다."

---

## 10. 핵심 포인트

- Sync/Async 와 Blocking/Non-blocking 은 별개의 축
- 4 분면 중 (3) Multiplexing 이 실무의 95%
- (4) Async 는 io_uring/IOCP — 키워드만 알면 됨
- "비동기" 라는 한국어는 7 가지 의미를 동시에 가짐 — 면접에서 명확히 분리해 답해야 함
- CompletableFuture / Reactor / Coroutine 은 *결과 전달 추상화* 이지 IO 모델이 아님

## 다음 학습

- [04-linux-multiplexing-evolution.md](04-linux-multiplexing-evolution.md) — select → poll → epoll 의 발전
