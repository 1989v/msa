---
parent: 16-async-nonblocking-io
seq: 07
title: Direct Buffer & Zero-copy IO
type: deep
created: 2026-05-01
---

# 07. Direct Buffer & Zero-copy IO

## TL;DR

- **Direct Buffer** = JVM (Java Virtual Machine, 자바 가상 머신) heap 밖의 native memory 에 잡힌 ByteBuffer → syscall 인자로 직접 전달 가능
- 일반 read 는 *4 번* 컨텍스트 스위치 + *4 번* 데이터 복사
- **sendfile** = kernel-only 복사로 컨텍스트 스위치 2 번, 복사 2 번 (혹은 더 적음)
- Java 의 `FileChannel.transferTo()` 가 sendfile 매핑
- **mmap** = 파일을 프로세스 주소 공간에 매핑 → page fault 로 lazy load, write 도 자동 sync
- Kafka, Netty, Tomcat 모두 적극 사용 — 우리 msa 도 Lettuce 가 direct buffer 사용

---

## 1. 일반 read 의 진실 — 4 번 복사

`socket → file` 로 데이터를 전송하는 일반 코드:

```kotlin
val buf = ByteArray(8192)
val n = socketIn.read(buf)
fileOut.write(buf, 0, n)
```

내부적으로 일어나는 일 (간략화):

```
┌──────────┐                     ┌──────────┐
│ NIC (DMA)│ ──(1) DMA copy────► │ Kernel   │
└──────────┘                     │ socket   │
                                 │ buffer   │
                                 └────┬─────┘
                                      │ (2) kernel→user copy (read syscall)
                                      ▼
                                 ┌──────────┐
                                 │ User     │
                                 │ buffer   │
                                 └────┬─────┘
                                      │ (3) user→kernel copy (write syscall)
                                      ▼
                                 ┌──────────┐
                                 │ Kernel   │
                                 │ file     │
                                 │ buffer   │
                                 └────┬─────┘
                                      │ (4) DMA copy
                                      ▼
                                 ┌──────────┐
                                 │ Disk     │
                                 └──────────┘
```

- **4 번 데이터 복사** (DMA 2 회 + memcpy 2 회)
- **4 번 컨텍스트 스위치** (user→kernel for read, kernel→user 리턴, user→kernel for write, kernel→user 리턴)

데이터를 그냥 *지나가게 하는* 작업인데도 비용이 크다. 작은 패킷이면 무시할 수 있지만, 대용량 (정적 파일 서빙, Kafka 로그 전송) 에선 치명적.

---

## 2. Zero-copy 의 발상

> "유저 버퍼를 거치지 않고 *커널 안에서만* 복사하면 안 되나?"

이 발상이 **sendfile** syscall.

```c
ssize_t sendfile(int out_fd, int in_fd, off_t *offset, size_t count);
```

- `in_fd` 의 데이터를 `out_fd` 로 직접 전송
- 커널이 알아서 처리, 유저 버퍼 안 거침
- 컨텍스트 스위치 = **2 번** (sendfile 호출 + 리턴)
- 데이터 복사 = **3 번** (DMA → kernel page cache → kernel socket buffer → DMA)

```
┌──────────┐                                 ┌──────────┐
│ NIC      │ ◄──DMA──┐               ┌──DMA──┤ Disk     │
└──────────┘         │               │       └──────────┘
                     ▼               ▲
                ┌────────────────────┴────┐
                │ Kernel                  │
                │  socket buf ◄── page    │
                │              cache      │
                └─────────────────────────┘
```

**진정한 zero-copy** 는 SG-DMA (Scatter/Gather DMA) 지원 하드웨어에서 한 단계 더:
- page cache 의 메모리 주소만 socket buffer 에 *기술자 (descriptor)* 로 전달
- 실제 복사 없이 NIC 가 page cache 에서 직접 읽음
- 리눅스 2.4+ 에서 hardware 지원 시 자동

Linux 의 `splice(2)` / `tee(2)` 는 일반화된 zero-copy 메커니즘. pipe 를 거치는 형태.

---

## 3. Java 에서의 sendfile — FileChannel.transferTo

```kotlin
val fileChannel = FileChannel.open(Path.of("/var/log/big.log"), READ)
val socketChannel = SocketChannel.open(InetSocketAddress("client", 8080))

fileChannel.transferTo(0, fileChannel.size(), socketChannel)
//                  ↑                       ↑
//             source 시작 offset      destination Channel
```

- Linux 에선 `sendfile(2)` syscall 매핑
- macOS/BSD 에선 `sendfile(2)` (FreeBSD 변형) 또는 `fcopyfile`
- 2GB 한계 있음 — `transferTo` 한 번에 2GB 까지 (Integer.MAX_VALUE)
- 큰 파일은 loop 으로

```kotlin
var pos = 0L
val total = fileChannel.size()
while (pos < total) {
    val n = fileChannel.transferTo(pos, total - pos, socketChannel)
    if (n <= 0) break
    pos += n
}
```

> **Apache Tomcat / Spring static resource serving 이 자동으로 transferTo 사용.** 우리가 정적 파일 핸들러를 안 만들어도 "왜 이렇게 빠르지?" 의 답은 sendfile.

---

## 4. Direct Buffer 의 위치

[06 글](06-java-nio-channel-buffer-selector.md) 의 두 종류 Buffer:

```
ByteBuffer.allocate(N):
  ┌─── JVM heap (managed by GC) ───┐
  │  byte[]                        │
  │  + Buffer 메타데이터              │
  └────────────────────────────────┘

ByteBuffer.allocateDirect(N):
  ┌─── JVM heap ───┐
  │  Buffer 객체    │ ── 참조 ──►
  │  (마ker)       │
  └────────────────┘             ┌─── Native memory (off-heap) ───┐
                                 │  실제 데이터                    │
                                 └────────────────────────────────┘
```

### Channel IO 시 동작 차이

```kotlin
// Heap Buffer
val heap = ByteBuffer.allocate(8192)
channel.read(heap)
// 내부: 임시 direct buffer 할당 → syscall → heap 으로 복사 → 임시 direct 해제

// Direct Buffer
val direct = ByteBuffer.allocateDirect(8192)
channel.read(direct)
// 내부: direct buffer 주소를 syscall 인자로 직접 전달 (1 번 복사 절약)
```

JDK 내부 코드 `IOUtil.read()` 에 명시:
- heap buffer 면 임시 direct buffer (BufferCache) 를 잡아 쓰고 다시 복사
- direct buffer 면 바로 syscall

### 비용 트레이드오프

| | Heap Buffer | Direct Buffer |
|---|---|---|
| 할당 비용 | 빠름 (Eden 공간) | 느림 (native malloc) |
| GC 압력 | 큼 (자주 만들면) | 거의 없음 (Cleaner) |
| Channel IO | 한 번 더 복사 | 직접 전달 |
| 회수 | 즉시 (GC) | Cleaner 가 비동기 — 즉시 회수 어려움 |
| 누수 위험 | 낮음 | **높음** (off-heap 폭증) |

### 권장
- **장기 사용 + 빈번한 IO** → Direct Buffer (Netty 의 ByteBuf 가 그것)
- **단발적 사용** → Heap Buffer (할당이 빠름)

> Netty 의 PooledByteBufAllocator 가 direct buffer 를 풀로 관리 — *할당 비용*과 *누수 위험* 둘 다 해결.

---

## 5. Direct Buffer 누수 — 흔한 운영 사고

```kotlin
// 위험 패턴
fun handleRequest(): ByteBuffer {
    return ByteBuffer.allocateDirect(1024 * 1024)  // 매 요청마다 1MB direct
    // GC 가 reachable 하다고 판단하면 Cleaner 가 해제 안 함
    // Cleaner 가 도는 시점이 GC 와 묶여 있어 즉시 회수 안 됨
}
```

증상:
- JVM heap 사용량은 정상
- 그런데 RSS (Resident Set Size) 가 계속 증가
- 결국 OOM Killer 에 의해 컨테이너 죽음

진단:
```bash
# direct buffer 사용량 모니터링
jcmd <pid> VM.native_memory summary
# 또는
-XX:NativeMemoryTracking=summary -XX:+UnlockDiagnosticVMOptions
```

대책:
- `-XX:MaxDirectMemorySize=512m` 로 상한 설정
- Buffer pool 사용 (직접 만들거나 Netty 의 PooledByteBufAllocator)
- `((sun.nio.ch.DirectBuffer) buf).cleaner()?.clean()` 명시적 해제 (JDK 내부 API, 권장 안 함)

---

## 6. mmap (Memory-Mapped File)

또 다른 zero-copy 형태. 파일을 프로세스 주소 공간에 매핑.

```kotlin
val raf = RandomAccessFile("/data/big.log", "r")
val ch = raf.channel
val mbb = ch.map(FileChannel.MapMode.READ_ONLY, 0, ch.size())
// mbb 는 파일을 통째로 메모리에서 보는 듯한 ByteBuffer

while (mbb.hasRemaining()) {
    val b = mbb.get()
    // ...
}
```

- 파일 내용을 일반 메모리처럼 읽기/쓰기 가능
- read/write syscall 없이 page fault 가 발생할 때만 OS 가 lazy 로 disk 에서 로드
- **랜덤 액세스** 가 빠름 (포인터 점프와 동일)
- **순차 read** 는 sendfile 이 더 빠를 수 있음 (mmap 은 page fault 비용)

### Kafka 의 mmap 사용

Kafka 의 *index 파일* 은 mmap. log 파일은 sendfile (consumer 에 보낼 때).

```
Kafka log:    sendfile (consumer 가 읽을 때)
Kafka index:  mmap (offset 검색 시)
```

이 두 가지 zero-copy 가 Kafka 의 throughput 을 만든다.

### mmap 의 함정

- **파일 truncate 시 SIGBUS** — 매핑된 페이지를 access 하다 파일이 잘리면 SIGBUS 시그널
- **64-bit 만** (32-bit 는 4GB 가상 주소 한계로 큰 파일 mmap 불가)
- **Direct Buffer 처럼 Cleaner 로 해제** — 즉시 회수 어려움

---

## 7. 실측 비교 (대략)

`/dev/zero` → socket 1GB 전송, single thread, 로컬 loopback.

| 방식 | 시간 | 컨텍스트 스위치 | 복사 횟수 |
|---|---|---|---|
| read+write (heap buffer) | ~1.0x (기준) | 4 회/iter | 4 회 |
| read+write (direct buffer) | ~0.85x | 4 회 | 3 회 |
| FileChannel.transferTo (sendfile) | ~0.4x | 2 회 | 2~3 회 |
| sendfile + SG-DMA | ~0.3x | 2 회 | 2 회 |

> 실측은 환경에 따라 ±50% 변동. 위는 *상대적 순서* 만 보여주는 의미.

---

## 8. msa 에서 zero-copy 가 자동 적용되는 곳

| 구간 | 메커니즘 |
|---|---|
| Tomcat 정적 리소스 서빙 (`server.servlet.static-locations`) | `transferTo` (sendfile) |
| Spring Boot 의 `ResourceHttpRequestHandler` | `transferTo` |
| Kafka producer/consumer (브로커 ↔ 디스크) | sendfile + mmap |
| Netty `DefaultFileRegion` / `ChunkedFile` | `transferTo` |
| Lettuce 의 ByteBuf | direct buffer (PooledByteBufAllocator) |

직접 코드를 쓸 일은 거의 없지만, **"왜 큰 파일 다운로드가 빠른가?" 의 답은 거의 sendfile** 이라는 점을 알아야 한다.

---

## 9. 면접 답변 템플릿

**Q. Direct Buffer 와 Heap Buffer 의 차이는?**

> "Direct Buffer 는 JVM heap 밖의 native memory 에 잡히는 ByteBuffer 입니다.
> 1. 위치 차이: heap 은 GC 가 관리, direct 는 native malloc + Cleaner 가 회수
> 2. IO 비용 차이: Channel.read 는 native 호출이므로 heap buffer 면 *임시 direct staging buffer* 를 통해 복사 후 native 호출 → 한 번 더 복사. direct 면 그대로 syscall 인자로 전달 — IO 가 잦으면 의미 있는 차이.
> 3. 트레이드오프: direct 는 할당 비용이 비싸고 누수 위험이 있음. 그래서 Netty 는 PooledByteBufAllocator 로 풀링.
>
> Zero-copy 는 한 단계 더 — `FileChannel.transferTo` 가 Linux sendfile 로 매핑되어 *유저 버퍼를 거치지 않고 커널 안에서만* 복사. Kafka 가 이 두 가지(direct buffer + sendfile + mmap) 를 적극 활용해서 throughput 을 만듭니다."

---

## 10. 핵심 포인트

- 일반 read+write = 4 번 복사 + 4 번 컨텍스트 스위치
- sendfile = 2 번 컨텍스트 스위치 (커널 안에서만 복사)
- Direct Buffer = off-heap 으로 syscall 인자 직접 전달, staging 복사 절약
- Netty/Lettuce = direct buffer pool, Tomcat/Spring = sendfile 자동
- Direct Buffer 누수는 RSS 만 늘고 heap 은 정상 — 진단 어려움

## 다음 학습

- [08-reactor-vs-proactor.md](08-reactor-vs-proactor.md) — Reactor 패턴 vs Proactor 패턴
