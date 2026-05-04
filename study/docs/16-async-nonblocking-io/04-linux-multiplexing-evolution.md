---
parent: 16-async-nonblocking-io
seq: 04
title: Linux IO multiplexing 발전 — select / poll / epoll
type: deep
created: 2026-05-01
---

# 04. Linux IO multiplexing 발전 — select / poll / epoll

## TL;DR

- **select** (1983) — fd_set 비트맵, 1024 한계, 호출 시마다 모든 fd 를 커널로 복사 → O(N)
- **poll** (1986) — fd_set 한계 제거, 여전히 호출마다 fd 배열 복사 → O(N)
- **epoll** (Linux 2.6, 2002) — fd 를 한 번 등록(`epoll_ctl`)하면 커널이 ready list 유지 → O(1)
- **kqueue** (BSD/macOS) — 비슷한 디자인, 더 일반적 (file/socket 외 process/signal/timer 도 감시)
- **IOCP** (Windows) — 분류상 (4) async, completion port 큐로 결과 통보
- 현대 백엔드 = epoll (Linux) / kqueue (Mac) / IOCP (Windows). Java NIO (Non-blocking I/O, 비차단 입출력) Selector 는 이들 위에 자동 매핑.

---

## 1. 왜 다중화가 필요한가

[01 글](01-c10k-problem.md) 에서 다룬 그대로, 한 thread 가 여러 fd 를 처리하려면 OS 에 "이 fd 들 중 누구든 ready 되면 알려줘" 라고 부탁해야 한다. 이 부탁의 syscall 이 select / poll / epoll 이다.

```
[fd1, fd2, ..., fdN]  ──multiplex syscall──►  [fd3, fd17] ready
```

---

## 2. select (1983, BSD)

가장 오래된 multiplexing syscall.

```c
int select(int nfds,
           fd_set *readfds,
           fd_set *writefds,
           fd_set *exceptfds,
           struct timeval *timeout);
```

- `fd_set` = 비트맵 (각 fd 에 1 bit)
- 보통 `FD_SETSIZE = 1024` (커널 컴파일 시 결정, 그래서 못 늘림)
- 호출 시마다 비트맵을 커널로 복사 + 커널이 모든 fd 검사 + 비트맵 다시 유저로 복사
- 리턴 후 어느 fd 가 ready 인지 알려면 비트맵을 다시 스캔 → **O(N) 두 번**

```c
fd_set rfds;
FD_ZERO(&rfds);
FD_SET(sock1, &rfds);
FD_SET(sock2, &rfds);
struct timeval tv = {5, 0};

int ret = select(maxfd + 1, &rfds, NULL, NULL, &tv);
if (ret > 0) {
    if (FD_ISSET(sock1, &rfds)) { /* sock1 ready */ }
    if (FD_ISSET(sock2, &rfds)) { /* sock2 ready */ }
}
```

### 한계
1. fd 1024 한계 (사용자 프로세스 1만 connection 시 즉사)
2. 호출 시마다 비트맵 전체 복사 → fd 많을수록 syscall 비용 증가
3. ready 판별을 위한 추가 스캔
4. timeout 이 호출 후 갱신됨 (`tv` 가 mutable, portability 문제)

---

## 3. poll (System V)

select 의 **fd 1024 한계**를 풀기 위해 만든 변형.

```c
struct pollfd {
    int fd;
    short events;
    short revents;
};

int poll(struct pollfd *fds, nfds_t nfds, int timeout);
```

- 비트맵 대신 배열 — fd 수 제한 없음
- 그래도 호출 시마다 배열 전체를 커널로 복사 → 여전히 O(N)
- `revents` 로 결과 받음 → 별도 스캔 필요 (O(N))
- timeout 이 ms 단위 (select 의 timeval 보다 깔끔)

### 그래도 한계
- 1만 fd 면 1만 entry 배열을 *매 호출마다 복사*. ready 가 한 개여도 전체 검사.
- "유효한 fd 만 패킹" 같은 최적화도 결국 O(N)

select/poll 의 본질적 문제: **호출자가 매번 "관심 fd 전체 목록" 을 OS 에 전달** 한다는 것. 이걸 어떻게 한 번만 등록하게 할까? 가 epoll 의 출발점.

---

## 4. epoll (Linux 2.6, 2002)

Linux 에 등장. select/poll 의 두 가지 비효율을 모두 해결.

```c
int epoll_create1(int flags);
int epoll_ctl(int epfd, int op, int fd, struct epoll_event *event);
int epoll_wait(int epfd, struct epoll_event *events, int maxevents, int timeout);
```

- `epoll_create1` — epoll instance 를 만든다 (fd 한 개 리턴)
- `epoll_ctl` — fd 를 *등록/수정/삭제* — 한 번 등록하면 커널이 기억
- `epoll_wait` — ready 된 *이벤트만* 받는다 (전체 fd 안 검사)

### 핵심 차이

```
select/poll:
  매 호출 ──► [fd1..fdN 전부 전달] ──► 커널 스캔 ──► [ready 표시]

epoll:
  최초:    [fd1..fdN 등록]       (한 번만)
  매 호출 ──► epoll_wait ──► [ready 인 N' 개만 리턴]   (N' << N)
```

커널 내부 자료구조:
- **interest list** (rb-tree) — 등록된 fd 모음
- **ready list** (linked list) — 이벤트 발생한 fd 만 모임
- 인터럽트가 도착해서 socket buffer 에 데이터가 들어오면 커널이 해당 fd 를 ready list 에 추가
- `epoll_wait` 는 ready list 만 가져옴 → **O(1)** (정확히는 "이벤트 수에 비례", 전체 fd 와 무관)

### Edge-Triggered (ET) vs Level-Triggered (LT)

epoll 만의 옵션. **면접 단골 주제**.

| 모드 | 동작 |
|---|---|
| **Level-Triggered (LT)** | fd 가 ready 상태인 *동안 계속* 알림. 기본값. select/poll 과 동일 |
| **Edge-Triggered (ET)** | fd 상태가 *바뀐 순간만* 알림. 한 번 알림 받으면 전부 다 읽어야 함 |

```c
struct epoll_event ev;
ev.events = EPOLLIN | EPOLLET;  // ET 모드
ev.data.fd = sock;
epoll_ctl(epfd, EPOLL_CTL_ADD, sock, &ev);

// ET 모드에선 read 가 EAGAIN 리턴할 때까지 *계속* 읽어야 함
while (true) {
    ssize_t n = read(sock, buf, sizeof(buf));
    if (n < 0 && errno == EAGAIN) break;  // 다 읽음
    if (n <= 0) break;
    // process buf
}
```

ET 의 장점:
- syscall 수 감소 (한 이벤트에 대해 한 번만 알림)
- 고성능 서버 (Nginx 등) 가 ET 사용

ET 의 위험:
- 한 번 알림 후 데이터 일부만 읽고 끝내면 *나머지 데이터를 영영 못 받음* (다음 이벤트가 와야 알림이 다시 옴)
- 따라서 *EAGAIN 까지 반복 read 필수*

> Netty 는 LT 모드를 기본으로 쓴다. 코드 안전성과 디버깅 편의가 더 중요한 판단.

---

## 5. select vs poll vs epoll 정량 비교

| 항목 | select | poll | epoll |
|---|---|---|---|
| fd 수 한계 | 1024 (FD_SETSIZE) | 시스템 한계 | 시스템 한계 |
| 호출당 복사 | 비트맵 전체 | 배열 전체 | ready event 만 |
| 시간 복잡도 | O(N) | O(N) | O(1) (이벤트 수 기준) |
| 트리거 모드 | LT | LT | LT / **ET** |
| 사용처 | 레거시 | POSIX 호환 | Linux 표준 |
| 멀티스레드 안전 | △ | △ | ○ (epoll fd 공유 가능) |

### 1만 fd 시 대략 비용

가정: 1만 fd 등록, 그 중 100 개가 ready.

- select: 비트맵 8KB 복사(1만 fd) × 매 호출, 1만 fd 스캔, 또 8KB 복사
- poll: 80KB 배열(1만 × pollfd) × 매 호출, 스캔 1만 fd
- epoll: 100 개 event 만 복사, 스캔 안 함

성능 차이가 한 자릿수 µs 라도, 초당 수만 호출이면 누적 차이가 의미 있다.

---

## 6. kqueue (BSD/macOS)

epoll 과 유사한 design. 1999 년 FreeBSD, 이후 macOS 에 채택.

```c
int kqueue(void);
int kevent(int kq, const struct kevent *changelist, int nchanges,
           struct kevent *eventlist, int nevents,
           const struct timespec *timeout);
```

- 한 syscall(`kevent`) 이 ctl/wait 모두 처리
- file/socket 뿐 아니라 **process exit, signal, timer, vnode 변경** 등도 감시 가능 (epoll 보다 더 일반적)
- macOS Java NIO Selector 의 백엔드

> 면접에서 "macOS 에선 epoll 안 됩니다" 라고 답하는 사람이 많은데 정확히는 **kqueue 가 그 자리를 차지**한다. Java NIO Selector 는 OS 별로 자동 선택 (`KQueueSelectorProvider` / `EPollSelectorProvider`).

---

## 7. IOCP (Windows)

Windows 의 IO multiplexing… 인데 분류상 분면 (4) async.

- I/O Completion Port = 커널이 IO 완료 후 결과를 *큐* 에 넣고 worker thread 가 큐에서 꺼내 처리
- 즉 epoll 처럼 "ready 알림" 이 아니라 "complete 알림"
- 이게 진짜 async 의 차이

| | Linux epoll | Windows IOCP |
|---|---|---|
| 커널이 알리는 시점 | "ready" (데이터 도착했음) | "complete" (복사 완료) |
| 복사 책임 | 호출자 read | OS |
| 분면 | (3) sync non-blocking | (4) async non-blocking |

> "왜 .NET 의 async/await 가 Java 보다 일찍 자리잡았나?" 의 일부 이유는 IOCP 가 1990년대부터 production-ready 였기 때문.

---

## 8. Java NIO Selector 와의 매핑

Java 의 `java.nio.channels.Selector` 는 운영체제별로 자동 매핑.

| OS | 백엔드 |
|---|---|
| Linux 2.6+ | `EPollSelectorProvider` (epoll) |
| macOS / BSD | `KQueueSelectorProvider` (kqueue) |
| Windows | `WindowsSelectorProvider` (select 기반, IOCP 아님) |
| Solaris (옛날) | `DevPollSelectorProvider` (`/dev/poll`) |

> Windows 의 Java Selector 가 IOCP 가 아니라 select 기반이라는 점은 흥미롭다. Java NIO 가 (3) 분면 모델로 추상화돼 있어 (4) 분면인 IOCP 와 의미적으로 안 맞음. 그래서 Netty 도 Windows 에서 native epoll 대신 NIO Selector 를 쓴다 (linux 에선 native epoll transport 가 더 빠름).

---

## 9. epoll 사용 패턴 (C)

```c
int epfd = epoll_create1(0);

// 등록
struct epoll_event ev;
ev.events = EPOLLIN | EPOLLET;
ev.data.fd = listen_fd;
epoll_ctl(epfd, EPOLL_CTL_ADD, listen_fd, &ev);

struct epoll_event events[64];
while (1) {
    int n = epoll_wait(epfd, events, 64, -1);
    for (int i = 0; i < n; i++) {
        int fd = events[i].data.fd;
        if (fd == listen_fd) {
            // 새 연결 accept
            int client = accept4(listen_fd, NULL, NULL, SOCK_NONBLOCK);
            ev.events = EPOLLIN | EPOLLET;
            ev.data.fd = client;
            epoll_ctl(epfd, EPOLL_CTL_ADD, client, &ev);
        } else {
            // ET 모드: EAGAIN 까지 read
            while (1) {
                ssize_t r = read(fd, buf, sizeof(buf));
                if (r < 0 && errno == EAGAIN) break;
                if (r <= 0) {
                    epoll_ctl(epfd, EPOLL_CTL_DEL, fd, NULL);
                    close(fd);
                    break;
                }
                // process buf
            }
        }
    }
}
```

이 코드 패턴이 Nginx, Redis, libuv, Netty 모두의 뿌리.

---

## 10. epoll 의 함정 (interview oneliner)

- **Thundering herd** — 여러 thread 가 같은 epoll fd 를 wait 하면 한 이벤트에 모두 깨어남. `EPOLLEXCLUSIVE` (Linux 4.5+) 로 한 thread 만 깨움.
- **fd 재사용** — close 후 같은 번호가 새 fd 에 할당될 수 있음. epoll_wait 와 close 가 race 하면 새 fd 에 잘못된 이벤트가 갈 수 있음 → `epoll_data` 에 fd 외 식별자도 넣는 패턴
- **listening socket 의 LT vs ET** — LT 면 accept 한 번 호출, ET 면 EAGAIN 까지 accept 반복
- **EPOLLONESHOT** — 한 번 알림 후 자동 비활성화. 이벤트 처리 중 다른 thread 가 동일 fd 처리하지 않게 보장

---

## 11. 면접 답변 템플릿

**Q. epoll 이 select 보다 빠른 이유는?**

> "두 지점에서 빨라집니다.
> 1. select 는 호출 시마다 *관심 fd 전체 목록* 을 커널로 복사하지만, epoll 은 `epoll_ctl` 로 *한 번만 등록* 하고 커널이 기억합니다.
> 2. select 는 ready 판별을 위해 커널/유저 모두 *전체 fd 를 스캔* 하지만, epoll 은 *이벤트 발생한 fd 만 ready list* 에 따로 모아 두기 때문에 wait 호출이 O(이벤트 수) 입니다.
>
> 그리고 select 는 fd 1024 한계가 있는데, 이건 fd_set 비트맵 크기가 컴파일 타임 상수라서 그렇습니다. 부수적으로 epoll 의 edge-triggered 모드는 syscall 수도 줄여줍니다."

---

## 12. 핵심 포인트

- select → poll → epoll 의 진화는 *fd 등록을 매번 vs 한 번* 의 차이
- epoll 의 핵심은 ready list 를 커널이 유지 → O(1)
- ET 는 한 번 알림, 끝까지 read 필수 / LT 는 매번 알림
- macOS = kqueue, Windows = IOCP (분면 4)
- Java NIO Selector 는 OS 별로 자동 매핑

## 다음 학습

- [05-io-uring.md](05-io-uring.md) — io_uring 의 진짜 async IO 모델
