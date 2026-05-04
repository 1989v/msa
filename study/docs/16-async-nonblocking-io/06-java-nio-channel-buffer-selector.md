---
parent: 16-async-nonblocking-io
seq: 06
title: Java NIO — Channel / Buffer / Selector
type: deep
created: 2026-05-01
---

# 06. Java NIO — Channel / Buffer / Selector

## TL;DR

- **NIO (Non-blocking I/O, 비차단 입출력)** (JDK 1.4, 2002) = "New IO" — Channel + Buffer + Selector 3 축
- Channel = OS fd 추상화 (FileChannel, SocketChannel, ServerSocketChannel)
- Buffer = 메모리 블록 + 4 포인터 (mark / position / limit / capacity)
- Selector = epoll/kqueue 의 Java wrapper
- **NIO.2** (JDK 7) = Path API + AsynchronousChannel — async 부분은 거의 안 쓰임 (분면 4 시뮬레이션이라)
- 거의 모든 비동기 Java 라이브러리는 이 3 축 위에 동작

---

## 1. NIO 가 등장한 이유

JDK 1.0~1.3 의 IO (`java.io`) 는 stream 기반.
- `InputStream.read()` 는 blocking
- 한 thread = 한 connection
- non-blocking 가능성이 API 에 없음

JDK 1.4 NIO 가 추가하면서 비로소 **하나의 thread 가 여러 socket 을 처리** 할 수 있게 되었다 (= [04 글](04-linux-multiplexing-evolution.md) 의 epoll 을 Java 에서 쓸 수 있는 길).

---

## 2. Channel — fd 추상화

OS 의 file descriptor 를 객체로 감싼 것. 종류:

| Channel | 용도 | OS 매핑 |
|---|---|---|
| `FileChannel` | 파일 read/write, mmap, transferTo | regular fd |
| `SocketChannel` | TCP client | socket fd |
| `ServerSocketChannel` | TCP listen | socket fd |
| `DatagramChannel` | UDP | socket fd |
| `Pipe.SourceChannel/SinkChannel` | 프로세스 내 파이프 | pipe fd |

```kotlin
val sc = SocketChannel.open()
sc.configureBlocking(false)
sc.connect(InetSocketAddress("api.example.com", 80))
```

핵심 메서드:
- `configureBlocking(false)` — non-blocking 모드 전환 (Selector 등록 전제)
- `register(selector, ops)` — Selector 에 등록
- `read(ByteBuffer)` / `write(ByteBuffer)` — Buffer 에 데이터 read/write
- `close()` — fd close

> **Channel 은 Buffer 에서/로 데이터를 옮긴다** — 직접 byte[] 를 안 받는다는 점이 java.io 와의 결정적 차이.

---

## 3. Buffer — 4 포인터 모델

Buffer 는 **고정 크기 메모리 블록** + 4 포인터.

```
0                                              capacity
├──────────────────────────────────────────────┤
                ▲                ▲
              position         limit
                ▲
              mark
```

- `capacity` — 전체 크기 (변경 불가)
- `position` — 다음 읽을/쓸 위치
- `limit` — 읽기/쓰기 가능 경계
- `mark` — `reset()` 시 돌아갈 위치 (선택)

### 두 가지 모드 — write 모드 vs read 모드

Buffer 는 모드 플래그가 따로 없다. *position/limit 만으로* 읽기/쓰기를 구분.

```kotlin
val buf = ByteBuffer.allocate(1024)
// 초기 상태 (write mode):
//   position=0, limit=1024, capacity=1024

channel.read(buf)  // socket → buf 로 N 바이트 read
// position=N, limit=1024  (계속 더 쓸 수 있는 상태)

buf.flip()  // 모드 전환 (limit=position, position=0)
// position=0, limit=N

while (buf.hasRemaining()) {
    process(buf.get())  // 한 바이트씩 read
}

buf.clear()  // 다시 write mode (position=0, limit=capacity)
```

### 핵심 메서드

| 메서드 | 효과 |
|---|---|
| `flip()` | write→read: limit=pos, pos=0 |
| `clear()` | read→write: pos=0, limit=cap (데이터 안 지움) |
| `rewind()` | pos=0, limit 유지 (다시 읽기) |
| `compact()` | 안 읽은 데이터를 앞으로 당기고 write 모드 |
| `mark()/reset()` | 책갈피 |

`flip()` 을 자주 까먹는다. **read 했으면 flip, 처리 끝났으면 clear/compact** 가 거의 공식.

### 타입별 Buffer

`ByteBuffer`, `CharBuffer`, `IntBuffer`, `LongBuffer`, `FloatBuffer`, `DoubleBuffer`, `ShortBuffer`. 보통 `ByteBuffer` 만 쓴다.

---

## 4. Direct Buffer vs Heap Buffer

ByteBuffer 는 두 종류.

```kotlin
val heap = ByteBuffer.allocate(1024)         // JVM heap (managed)
val direct = ByteBuffer.allocateDirect(1024) // off-heap (native memory)
```

| | Heap Buffer | Direct Buffer |
|---|---|---|
| 위치 | JVM heap | Native (off-heap) |
| GC 대상 | yes (Cleaner 가 native ref 정리) | yes (Cleaner) |
| Channel IO | 내부적으로 native staging 버퍼로 *복사* 후 syscall | 바로 syscall 가능 (zero-copy 가능) |
| 할당 비용 | 빠름 | 느림 (native malloc) |
| 용도 | 작은 임시 버퍼 | 장기 사용, 큰 IO |

**핵심**: Channel 의 read/write 는 native call 이므로, heap buffer 면 한 번 *staging* 복사가 일어난다. Direct buffer 면 바로 syscall 인자로 전달 가능 → IO 가 자주 일어나는 곳 (Netty, Lettuce) 은 direct buffer 사용.

> 자세히는 [07-direct-buffer-zerocopy.md](07-direct-buffer-zerocopy.md).

---

## 5. Selector — epoll wrapper

OS 의 epoll/kqueue 를 추상화한 멀티플렉서.

```kotlin
val selector = Selector.open()

val server = ServerSocketChannel.open()
server.bind(InetSocketAddress(8080))
server.configureBlocking(false)
server.register(selector, SelectionKey.OP_ACCEPT)

while (true) {
    selector.select()  // ← epoll_wait
    val keys = selector.selectedKeys()
    val it = keys.iterator()
    while (it.hasNext()) {
        val key = it.next()
        it.remove()  // 처리 후 반드시 제거 (Selector 가 같은 key 를 다시 안 줌)

        when {
            key.isAcceptable -> {
                val client = (key.channel() as ServerSocketChannel).accept()
                client.configureBlocking(false)
                client.register(selector, SelectionKey.OP_READ)
            }
            key.isReadable -> {
                val ch = key.channel() as SocketChannel
                val buf = ByteBuffer.allocate(1024)
                val n = ch.read(buf)
                if (n == -1) {
                    key.cancel()
                    ch.close()
                } else {
                    buf.flip()
                    handle(buf)
                }
            }
        }
    }
}
```

### SelectionKey

각 fd 등록의 결과로 받는 토큰.
- `OP_ACCEPT` (16) — listener 가 새 연결 받을 준비
- `OP_CONNECT` (8) — client 연결 완료
- `OP_READ` (1) — read 가능
- `OP_WRITE` (4) — write 가능

interest 와 readyOps 가 분리됨.

### 흔한 함정

- **selectedKeys() 의 it.remove() 빠뜨리면** Selector 가 같은 key 를 무한 반환
- **OP_WRITE 등록을 항상 켜두면** Selector 가 매번 깨어남 (소켓이 거의 항상 writable 이므로) — write 가 EAGAIN 났을 때만 켜고, 다 쓰면 끄는 패턴
- **wakeup()** — 다른 thread 에서 select 중인 thread 를 깨움 (NIO 가 thread-safe 보장하는 몇 안 되는 부분)

---

## 6. Selector 의 OS 별 백엔드

[04 글](04-linux-multiplexing-evolution.md) 에서 다룬 그대로.

```
java.nio.channels.spi.SelectorProvider
 ├── EPollSelectorProvider     (Linux)
 ├── KQueueSelectorProvider    (macOS, BSD)
 ├── WindowsSelectorProvider   (Windows, select 기반)
 └── DevPollSelectorProvider   (Solaris)
```

JVM 이 OS 를 보고 자동 선택. 직접 강제하려면 `-Djava.nio.channels.spi.SelectorProvider=...` 시스템 프로퍼티.

---

## 7. NIO.2 (JDK 7) — Path API + Async

NIO.2 는 두 가지를 추가.

### (a) Path API
- `java.nio.file.Path`, `Files`, `WatchService` (inotify wrapper)
- IO 자체는 sync 지만 Path 추상화가 더 편함
- 실무에서 표준

### (b) AsynchronousChannel — 분면 (4) 시도
- `AsynchronousFileChannel`, `AsynchronousSocketChannel`, `AsynchronousServerSocketChannel`
- API 는 분면 (4) async 모양 (CompletionHandler 콜백)
- **그러나 Linux 구현체는 epoll + thread pool 로 시뮬레이션** — 진짜 (4) 가 아님
- Windows 구현은 IOCP 기반 → 진짜 (4)

```kotlin
val ch = AsynchronousSocketChannel.open()
ch.connect(InetSocketAddress("api.example.com", 80))

val buf = ByteBuffer.allocate(1024)
ch.read(buf, null, object : CompletionHandler<Int, Void?> {
    override fun completed(n: Int, attachment: Void?) {
        // OS (or thread pool) 가 buf 까지 채움
    }
    override fun failed(exc: Throwable, attachment: Void?) {
        // ...
    }
})
```

### 왜 실패했나?

- Linux 가 진짜 (4) 분면 syscall 이 없던 시절(epoll 만 있던) 에 NIO.2 가 나옴
- 시뮬레이션 구현은 epoll + thread pool 이라 *추가 thread overhead*
- Reactor / Netty 는 자체 callback chain 으로 추상화하는 게 더 효율
- 결과: NIO.2 의 async 부분은 거의 deprecated 취급

> 면접에서 "NIO.2 의 AsynchronousChannel 잘 쓰나요?" 라고 물으면 "거의 안 씁니다. Linux 에선 진짜 async 가 아니고 시뮬레이션이라 Netty/Reactor 가 더 낫습니다." 가 정답.

---

## 8. Selector 사용 패턴 — Reactor 의 한 thread 모델

```
┌──────────────────────────────────────────┐
│  Single Thread (event loop)               │
│                                           │
│  while (running) {                        │
│      selector.select()                    │
│      for each readyKey {                  │
│          dispatch handler                 │
│      }                                    │
│  }                                        │
└──────────────────────────────────────────┘
```

이게 Doug Lea 의 [Scalable IO in Java](http://gee.cs.oswego.edu/dl/cpjslides/nio.pdf) 의 Reactor 패턴 (다음 글). Netty/Reactor Netty 모두 이 구조.

---

## 9. NIO 의 흔한 실수

| 실수 | 결과 |
|---|---|
| `flip()` 안 함 | read 한 데이터를 못 읽음 (position=N, 그 뒤를 읽으려 함) |
| `selectedKeys()` 의 it.remove() 빠뜨림 | 같은 key 무한 처리 |
| `OP_WRITE` 항상 켜둠 | CPU 100% (Selector 가 매번 깨어남) |
| heap buffer 로 큰 IO | staging 복사 비용 |
| direct buffer 누수 | off-heap 메모리 폭증 (GC 가 잘 안 회수) |
| Selector close 안 함 | epoll fd 누수 |

---

## 10. msa 에서 NIO 직접 쓰는 곳?

거의 없다. **모두 라이브러리가 감싸준다**.
- Tomcat: NIO connector (`Http11Nio2Protocol` 또는 NIO)
- Netty: 자체 `NioEventLoopGroup` (Selector wrapper)
- Reactor Netty: Netty 위
- Lettuce: Netty 위
- Kafka client: `org.apache.kafka.common.network.Selector` (자체 wrapper)

직접 NIO 를 만질 일은 *튜닝/디버깅* 시에만 있다. 그래서 **Channel/Buffer/Selector 모델 이해는 라이브러리 동작을 *예측* 하기 위해 필요**한 것이지, 직접 코드를 쓰기 위함이 아니다.

---

## 11. 면접 답변 템플릿

**Q. Java NIO 의 핵심 컴포넌트와 흐름은?**

> "세 축입니다.
> 1. **Channel** — OS fd 의 추상화. SocketChannel, FileChannel 등.
> 2. **Buffer** — 메모리 블록 + position/limit/capacity 4 포인터. Channel 은 Buffer 에서/로 데이터를 옮깁니다. write 후 flip, read 후 clear/compact 가 공식.
> 3. **Selector** — Linux 의 epoll, macOS 의 kqueue 를 추상화한 멀티플렉서. Channel 을 non-blocking 으로 등록하고 select() 로 ready 된 fd 만 받습니다.
>
> Direct Buffer 는 off-heap 이라 syscall 인자로 직접 전달 가능 → zero-copy 에 유리합니다. NIO.2 의 AsynchronousChannel 은 진짜 async 를 시도했지만 Linux 에선 시뮬레이션이라 잘 안 쓰입니다.
>
> Netty/Reactor Netty/Lettuce 모두 이 NIO 위에 동작하므로, 우리가 직접 NIO 를 만질 일은 거의 없지만 모델 이해가 라이브러리 동작 예측에 필수입니다."

---

## 12. 핵심 포인트

- NIO 3 축 = Channel + Buffer + Selector
- Buffer 의 4 포인터 (mark/position/limit/capacity) + flip/clear 패턴
- Direct Buffer 는 off-heap, zero-copy 에 유리
- Selector 는 OS 별로 epoll/kqueue/select 자동 매핑
- NIO.2 의 AsynchronousChannel 은 거의 안 씀 (Linux 에서 진짜 async 아님)

## 다음 학습

- [07-direct-buffer-zerocopy.md](07-direct-buffer-zerocopy.md) — Direct Buffer 와 Zero-copy IO
