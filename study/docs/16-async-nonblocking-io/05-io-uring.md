---
parent: 16-async-nonblocking-io
seq: 05
title: io_uring — 진짜 async IO 와 ring buffer 모델
type: deep
created: 2026-05-01
---

# 05. io_uring — 진짜 async IO

## TL;DR

- **io_uring** (Linux 5.1+, 2019, Jens Axboe) — 분면 (4) async IO (Input/Output, 입출력) non-blocking
- 핵심 아이디어: **유저↔커널 공유 ring buffer 두 개** (Submission Queue / Completion Queue) → syscall 없이 IO 요청/완료 전달 가능
- read/write 뿐 아니라 accept/connect/openat/sendmsg/splice 등 모든 IO syscall 을 큐에 넣을 수 있음
- 진짜로 (1) 대기 + (2) 복사 모두 커널에 위임됨
- Java 에서는 직접 사용 거의 안 함 (Netty incubator transport 옵션 정도)
- 보안 이슈로 **GKE / Android / 일부 distro 가 기본 비활성**. 학습용 키워드로만 알면 충분

---

## 1. epoll 의 한계

[04 글](04-linux-multiplexing-evolution.md) 에서 본 epoll 도 한계가 있다.

- 매 `epoll_wait` 마다 syscall (수십 ns 컨텍스트 스위치)
- read/write 자체도 syscall — fd N 개 처리하면 N 번 syscall
- C10M 영역에서 syscall 비용이 절대적 비중

목표: **여러 IO 연산을 syscall 한 번에 묶어 보내고, 결과도 batch 로 받자.**

---

## 2. Ring Buffer 디자인

io_uring 의 핵심은 mmap 으로 *유저-커널이 공유하는 두 개의 링 버퍼*.

```
                ┌──────────────────────────────────┐
                │  User space                      │
                │                                  │
                │   ┌────────────┐  ┌────────────┐ │
                │   │  SQ (head) │  │  CQ (tail) │ │
                │   └─────┬──────┘  └─────▲──────┘ │
                │         │ submit         │ poll  │
                └─────────┼────────────────┼───────┘
                          │ shared mmap    │
                ┌─────────┼────────────────┼───────┐
                │         ▼                │       │
                │   ┌────────────┐  ┌──────┴─────┐ │
                │   │  SQ (tail) │  │  CQ (head) │ │
                │   └─────┬──────┘  └─────▲──────┘ │
                │         │ kernel          │      │
                │         ▼                 │      │
                │   ┌────────────────────────┐    │
                │   │  Worker / interrupt    │    │
                │   │  (실제 IO 수행)         │    │
                │   └────────────────────────┘    │
                │  Kernel space                    │
                └──────────────────────────────────┘
```

- **SQ (Submission Queue)** — 유저가 IO 요청을 enqueue, 커널이 dequeue
- **CQ (Completion Queue)** — 커널이 결과를 enqueue, 유저가 dequeue
- 둘 다 lock-free SPSC (single producer single consumer) ring
- mmap 공유라 enqueue/dequeue 자체는 *syscall 없이* 가능

### syscall 은 언제?
1. `io_uring_setup` — 초기화 시 한 번
2. `io_uring_enter` — SQ 에 쌓인 요청을 커널에 *알리기* 위해 (또는 CQ 에 결과 올 때까지 wait)
3. SQPOLL 모드면 `io_uring_enter` 도 생략 가능 — 커널 thread 가 SQ 를 polling

즉 *최선의 경우 IO 가 syscall 0 번* 이다. 이게 epoll 과의 결정적 차이.

---

## 3. SQE / CQE

```c
struct io_uring_sqe {  // Submission Queue Entry
    __u8  opcode;       // IORING_OP_READ, OP_WRITE, OP_ACCEPT...
    __u8  flags;
    __s32 fd;
    __u64 off;
    __u64 addr;         // user buffer
    __u32 len;
    __u64 user_data;    // 결과와 매칭하는 user-side 식별자
    ...
};

struct io_uring_cqe {  // Completion Queue Entry
    __u64 user_data;    // SQE 의 user_data 가 그대로 옴
    __s32 res;          // 결과 (read 한 바이트 수 or 음수 = errno)
    __u32 flags;
};
```

API 패턴:
```c
struct io_uring_sqe *sqe = io_uring_get_sqe(&ring);
io_uring_prep_read(sqe, fd, buf, len, offset);
io_uring_sqe_set_data(sqe, my_request_ptr);
io_uring_submit(&ring);

// ... 다른 일 ...

struct io_uring_cqe *cqe;
io_uring_wait_cqe(&ring, &cqe);
my_request_t *req = io_uring_cqe_get_data(cqe);
int n = cqe->res;
io_uring_cqe_seen(&ring, cqe);
```

---

## 4. Linked SQE — 한 번에 read → write 체이닝

io_uring 의 또 다른 강점: SQE 들을 IOSQE_IO_LINK 로 연결하면 커널이 순차 실행 보장.

```c
// 1) read from socket
sqe1 = io_uring_get_sqe(&ring);
io_uring_prep_read(sqe1, src_fd, buf, len, 0);
sqe1->flags |= IOSQE_IO_LINK;

// 2) write to disk (1 의 결과를 그대로)
sqe2 = io_uring_get_sqe(&ring);
io_uring_prep_write(sqe2, dst_fd, buf, len, 0);

io_uring_submit(&ring);  // 두 개 한꺼번에 제출
```

이런 *체이닝* 이 epoll/select 에선 불가능 (각 단계마다 호출자가 깨어나야 함).

---

## 5. 얼마나 빠른가

Jens Axboe 의 [Efficient IO with io_uring](https://kernel.dk/io_uring.pdf) 벤치마크:

- 4K random read: epoll 대비 ~1.7x throughput
- syscall 수: 대형 워크로드에서 50% 이상 감소
- io_uring + SQPOLL = 거의 syscall 없음

> 실측은 워크로드에 따라 차이가 크고, "epoll 의 1.7배" 가 어플리케이션 throughput 의 1.7배는 아니다 (DB/네트워크가 병목이 더 크면 차이 안 남).

---

## 6. 보안 이슈와 비활성 추세

io_uring 은 **커널 공격 표면이 매우 크다**. 새로운 syscall opcode 가 추가될 때마다 새로운 취약점 가능성.

- 2022~2024 사이 io_uring 관련 CVE 다수
- Google 은 [GKE 와 Android 에서 io_uring 비활성](https://security.googleblog.com/2023/06/learnings-from-kctf-vrps-42-linux.html)
- ChromeOS, Cloudflare 도 비슷한 입장
- 일부 distro 는 기본 disabled

> "io_uring 이 미래" 라는 평가와 "보안 부담이 너무 크다" 는 평가가 공존. *어플리케이션 레이어에서 io_uring 을 직접 의존하면 운영체제 버전에 강하게 결합* 된다는 의미.

---

## 7. Java 에서의 위치

Java 표준 NIO 는 io_uring 을 직접 지원하지 않는다.

| 옵션 | 상태 |
|---|---|
| `java.nio.channels.Selector` | epoll/kqueue 기반 (io_uring 아님) |
| `java.nio.channels.AsynchronousSocketChannel` (NIO.2) | Linux 에선 epoll + thread pool 시뮬레이션 |
| **netty-incubator-transport-io_uring** | 별도 모듈, native binding 필요, 실험적 |
| Project Loom (Virtual Threads) | 내부적으로 io_uring 채택 가능성 거론되지만 미구현 |

즉 우리 msa 의 Spring/Reactor/Netty 스택에서 io_uring 의 직접적 영향은 거의 없다. **면접에서는 "키워드 알고 있음" 정도만 보이면 충분**하다.

---

## 8. epoll vs io_uring 한 장 비교

| 항목 | epoll | io_uring |
|---|---|---|
| 분면 | (3) sync non-blocking | (4) async non-blocking |
| syscall 수 (IO 당) | 2~3 (wait + read + write) | 0~1 (SQPOLL 시 0) |
| 데이터 복사 | 호출자 read | 커널이 user buffer 까지 |
| 시간 복잡도 | O(이벤트 수) | O(이벤트 수) |
| 지원 syscall | read/write/accept 등 fd 기반만 | accept/connect/openat/splice 등 거의 모든 syscall |
| 체이닝 | 불가 | 가능 (LINK) |
| 출시 | 2002 (Linux 2.6) | 2019 (Linux 5.1) |
| 보안 표면 | 작음 | 큼 (CVE 다수) |
| 사용처 | 거의 모든 backend | DB(MariaDB, PostgreSQL 옵션), high-perf 앱 |

---

## 9. SQPOLL — kernel-side polling

io_uring 의 또 한 가지 옵션. 커널이 별도 thread 를 띄워 SQ 를 *polling* 하면, 유저는 SQE 만 enqueue 하면 syscall 없이 IO 가 시작된다.

```c
struct io_uring_params p = { 0 };
p.flags |= IORING_SETUP_SQPOLL;
p.sq_thread_idle = 2000;  // 2 초 idle 후 sleep

io_uring_queue_init_params(64, &ring, &p);
```

장점: throughput 극대화 (syscall 0)
단점: kernel thread 가 CPU 를 일정 비율 점유 → low-latency 워크로드에선 적합, low-traffic 에선 낭비

---

## 10. 면접 답변 템플릿

**Q. io_uring 이 epoll 과 다른 점은?**

> "두 가지가 본질적으로 다릅니다.
> 1. 분면이 다릅니다. epoll 은 분면 (3) sync non-blocking — read 호출은 호출자가 직접 합니다. io_uring 은 분면 (4) async non-blocking — 커널이 유저 버퍼까지 채워서 결과를 큐에 넣어줍니다.
> 2. syscall 모델이 다릅니다. epoll 은 IO 당 wait + read + write 로 syscall 이 여러 번 일어나지만, io_uring 은 유저-커널 공유 ring buffer 두 개로 *syscall 없이* 요청/완료를 주고받을 수 있습니다. SQPOLL 모드면 커널 thread 가 SQ 를 polling 해서 syscall 0 번도 가능합니다.
>
> 다만 보안 공격 표면이 커서 GKE/ChromeOS 등에선 비활성이고, Java 표준 NIO 는 io_uring 을 안 씁니다. Netty incubator transport 정도가 옵션이고, 우리 msa 에서 직접 쓰진 않습니다."

---

## 11. 핵심 포인트

- io_uring = 분면 (4) 진짜 async — SQ/CQ ring buffer 모델
- syscall 횟수를 0~1 로 줄임 (SQPOLL 시 0)
- 모든 IO syscall 을 큐에 넣을 수 있음, 체이닝 가능
- Java 표준 NIO 는 미지원, Netty incubator 옵션
- 보안 이슈로 일부 환경 비활성 — 면접용 키워드

## 다음 학습

- [06-java-nio-channel-buffer-selector.md](06-java-nio-channel-buffer-selector.md) — Java NIO 의 Channel/Buffer/Selector 모델
