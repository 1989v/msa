---
parent: 16-async-nonblocking-io
seq: 02
title: IO 의 두 단계 + 4 가지 IO 모델
type: deep
created: 2026-05-01
---

# 02. IO 의 두 단계 + 4 가지 IO 모델

## TL;DR

- **모든 read syscall 은 두 단계** — `(1) 데이터가 도착할 때까지 대기` + `(2) 커널 버퍼 → 유저 버퍼 복사`
- "blocking", "non-blocking", "multiplexing", "async" 는 이 두 단계를 *누가 처리하는가* 의 차이일 뿐이다
- IO (Input/Output, 입출력) multiplexing(epoll) 도 단계 (2) 는 호출자가 직접 한다 → 그래서 sync non-blocking
- "진짜 async" 는 단계 (1) + (2) 모두 커널에 위임 (io_uring / IOCP / POSIX AIO)

이 모델을 머릿속에 그리지 않으면 면접에서 90% 가 흔들린다.

---

## 1. 왜 두 단계인가

socket read 의 실제 흐름을 따라가보자.

```
┌─────────┐   recv()   ┌──────────────────────┐   data    ┌────────┐
│  User   │ ─────────► │  Kernel              │ ◄──────── │  NIC   │
│  Buffer │            │  ┌────────────────┐  │           └────────┘
│         │            │  │  Socket Buffer │  │
│         │ ◄────────  │  │  (recv buffer) │  │
└─────────┘  (2) copy  │  └────────────────┘  │
              kernel→user                      │
                       └──────────────────────┘
                          (1) wait until data lands
```

- **단계 (1)** — NIC 가 패킷을 받아 커널의 socket recv buffer 에 쌓일 때까지 대기. *대부분의 시간이 여기서 흐른다.*
- **단계 (2)** — 커널 버퍼 → 유저 버퍼로 메모리 복사 (memcpy). 데이터가 작으면 µs 단위.

**왜 이게 중요한가?** "비동기" 라고 부르는 것들이 실은 단계 (1) 만 비동기이고 (2) 는 sync 인 경우가 많기 때문이다. 정확한 모델 분류는 이 구분 위에서만 가능하다.

---

## 2. 모델 1: Blocking IO

가장 단순한 모델. `read()` 호출하면 두 단계 모두 끝날 때까지 thread 가 sleep.

```
Time ─────────────────────────────────────────►
User: ──recv()──[ block ]──[ block ]──return──►
                  (wait)     (copy)
Kernel: ──────────[ data 도착 ]──[ copy 시작 ]──►
```

- 장점: 코드 직관적
- 단점: 한 thread = 한 connection. C10K 에서 무너짐
- 예: Java `InputStream.read()`, `Socket.getInputStream().read()`

```kotlin
// 전형적 blocking IO
val socket = Socket("api.example.com", 80)
val input = socket.getInputStream()
val buf = ByteArray(1024)
val n = input.read(buf)  // ← 데이터 올 때까지 thread 멈춤
```

---

## 3. 모델 2: Non-blocking IO (busy-wait)

socket 을 non-blocking 으로 설정하고 `read()` 호출. 데이터가 없으면 즉시 `EAGAIN` / `EWOULDBLOCK` 리턴.

```
Time ─────────────────────────────────────────►
User: read()→EAGAIN, read()→EAGAIN, read()→EAGAIN, ..., read()→OK
Kernel: ──────────────[ data 도착 ]──[ copy ]──►
```

- 장점: thread 가 안 멈춤
- 단점: **busy-wait 으로 CPU 100%**. 단독으로는 절대 안 씀
- 의미: multiplexing 의 빌딩 블록

```c
int flags = fcntl(fd, F_GETFL, 0);
fcntl(fd, F_SETFL, flags | O_NONBLOCK);

while (true) {
    ssize_t n = read(fd, buf, sizeof(buf));
    if (n < 0 && errno == EAGAIN) {
        // 데이터 없음, 다른 일 하기 (또는 polling)
    } else if (n > 0) {
        break;
    }
}
```

이 모델 자체는 실용성이 없지만, **non-blocking fd 가 multiplexing 과 async 의 전제**이므로 개념상 분리해서 이해해야 한다.

---

## 4. 모델 3: IO Multiplexing (select / poll / epoll)

> 면접에서 가장 자주 묻는 모델. 우리가 일상적으로 쓰는 거의 모든 비동기 라이브러리(Netty, libuv, Nginx, Lettuce ...) 의 기반.

한 thread 가 여러 fd 를 *non-blocking* 으로 등록해 두고, **OS 에 "이 중 누구든 ready 되면 알려줘"** 라고 위임하는 모델.

```
                       │
                       ▼
           ┌──────────────────────┐
User:      │  select / epoll_wait │ ◄─ block 되긴 하지만 "여러 fd 를 한꺼번에"
           │  (block until ready) │
           └──────────┬───────────┘
                      │ ready fd 리스트 받음
                      ▼
           ┌──────────────────────┐
User:      │  read() (단계 2 실행) │ ◄─ 복사는 호출자가
           └──────────────────────┘
```

핵심:
- 단계 (1) 의 대기를 *여러 fd 에 대해 한 번에* 한다 → 한 thread 가 여러 connection 처리
- 단계 (2) 는 여전히 호출자(read) 가 직접 → **sync non-blocking**

### 왜 "sync 인가?"

`epoll_wait` 이 ready 를 알려준 시점엔 데이터가 socket 버퍼에 도착해 있을 뿐, 유저 버퍼엔 아직 없다. read 호출이 추가로 필요. 즉 **"호출자가 데이터 처리를 직접 한다"** = sync.

- 장점: thread 1개로 수만 fd 처리
- 단점: read/write 시점에 (단계 2) 의 복사 비용이 있음, edge-triggered 에선 모든 데이터 다 읽기 까다로움
- 예: Netty, libuv, nginx, Java NIO Selector

---

## 5. 모델 4: Async IO (POSIX AIO / IOCP / io_uring)

진짜 async. **두 단계 모두 커널이 처리하고, 호출자에게 결과만 통보.**

```
User:    aio_read(fd, buf, ...) ──► (즉시 return)
              ┃
              ┃ 이 사이 호출자는 다른 일 한다
              ▼
Kernel:  data 도착 → kernel→user 복사 완료 → 시그널/콜백/큐로 통지
                                                     │
                                                     ▼
User:    ┌──────────────────────────────────────┐
         │  콜백 / 큐 polling / signal handler   │
         └──────────────────────────────────────┘
```

- POSIX AIO (`aio_read`) — 리눅스 구현 빈약, 거의 안 씀
- Windows IOCP (Completion Port) — 1990년대부터 production-ready, .NET async/await 의 기반
- Linux **io_uring** (5.1+) — 진짜 게임 체인저, 자세히는 [05-io-uring.md](05-io-uring.md)

Java 에는 NIO.2 의 `AsynchronousSocketChannel` 이 있지만 Linux 백엔드가 epoll + thread pool 시뮬레이션이라 진짜 async 가 아니고 잘 안 쓰인다.

---

## 6. 4 모델 한 장 비교

```
                         단계1 (대기)        단계2 (복사)         특징
─────────────────────────────────────────────────────────────────────────
Blocking IO              호출자가 block      호출자가          가장 단순
                                            (이때도 sleep)

Non-blocking IO          호출자 polling      호출자가          busy-wait
                         (EAGAIN 반복)

IO Multiplexing          OS 가 일괄 대기     호출자가          대표 모델
(select/epoll)           (여러 fd 한번에)                       sync non-blocking

Async IO                 OS 가 처리          OS 가 처리        진짜 async
(io_uring/IOCP)          (호출자 위임)       (호출자 위임)
```

---

## 7. Java 와의 매핑

| Java API | 모델 |
|---|---|
| `InputStream.read()` / `Socket` | Blocking IO |
| `SocketChannel` (configureBlocking(false)) + `Selector.select()` | IO Multiplexing |
| `AsynchronousSocketChannel` (NIO.2) | Async IO (Linux 에선 시뮬레이션) |
| `Files.readString()` | Blocking IO |
| `FileChannel.transferTo()` | Blocking + zero-copy (sendfile syscall) |

Java 에서 진짜 async 는 사실상 **JNI 로 io_uring** 을 부르는 라이브러리(예: netty-incubator-transport-io_uring)뿐. 일반적으론 Selector + epoll 조합 (multiplexing) 이 95%.

---

## 8. Kotlin 으로 본 4 모델

```kotlin
// 1) Blocking
fun readBlocking(): String {
    val socket = Socket("example.com", 80)
    return socket.getInputStream().bufferedReader().readText()  // thread 멈춤
}

// 2) Non-blocking (개념)
fun readNonBlocking(channel: SocketChannel) {
    channel.configureBlocking(false)
    val buf = ByteBuffer.allocate(1024)
    while (true) {
        val n = channel.read(buf)
        if (n == 0) {
            // 데이터 없음 — 실무에선 절대 busy-wait 하지 않고 multiplex 로 감
        } else if (n > 0) break
    }
}

// 3) Multiplexing (Java NIO Selector)
fun readMultiplexed(selector: Selector) {
    while (true) {
        selector.select()  // ← 여기서 여러 fd 동시 대기
        for (key in selector.selectedKeys()) {
            if (key.isReadable) {
                val ch = key.channel() as SocketChannel
                val buf = ByteBuffer.allocate(1024)
                ch.read(buf)  // 단계 (2) 는 여기서
            }
        }
    }
}

// 4) Async (NIO.2)
fun readAsync(channel: AsynchronousSocketChannel) {
    val buf = ByteBuffer.allocate(1024)
    channel.read(buf, null, object : CompletionHandler<Int, Void?> {
        override fun completed(result: Int, attachment: Void?) {
            // 커널이 buf 까지 채워서 콜백
        }
        override fun failed(exc: Throwable, attachment: Void?) { /* ... */ }
    })
}
```

---

## 9. 면접 답변 템플릿

**Q. Non-blocking 과 Async 는 같은 건가요?**

> "다릅니다. IO 를 두 단계 — 데이터 도착 대기와 커널-유저 복사 — 로 나눠 보면 명확합니다. Non-blocking 은 **단계 1 에서 안 막힌다** 는 뜻이고, Async 는 **두 단계 모두 OS 에 위임** 한다는 뜻입니다. 우리가 흔히 쓰는 epoll/Netty/WebFlux 는 비동기로 보이지만 분류상 sync non-blocking 입니다 — read 호출 자체는 호출자가 직접 하니까요. 진짜 async 는 io_uring 이나 Windows IOCP 정도입니다."

이 답변이 가능하면 면접관은 IO 모델에 대해 더 안 묻는다.

---

## 10. 핵심 포인트

- 모든 IO 는 **대기 + 복사** 두 단계
- 4 모델 분류는 이 두 단계를 누가 처리하는가의 차이
- IO multiplexing(epoll) 은 *sync* non-blocking — 면접에서 자주 헷갈림
- 진짜 async 는 io_uring / IOCP — Java 는 거의 안 씀
- Java 에서 99% 는 Selector + epoll = multiplexing

## 다음 학습

- [03-sync-async-quadrants.md](03-sync-async-quadrants.md) — Sync/Async × Blocking/Non-blocking 4 분면 정리
