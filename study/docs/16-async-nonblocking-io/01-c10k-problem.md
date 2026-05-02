---
parent: 16-async-nonblocking-io
seq: 01
title: C10K 문제 — thread-per-connection 의 한계
type: deep
created: 2026-05-01
---

# 01. C10K 문제

## TL;DR

- **C10K** = "한 서버에서 동시 접속 1만 개를 처리할 수 있는가?" (Dan Kegel, 1999)
- 표면 답: "thread 1만 개 띄우면 되지 않나?" → 메모리, 컨텍스트 스위치, 스케줄러, fd 한계 모두 무너짐
- 진짜 답: **한 thread 가 수많은 fd 를 동시에 감시**해야 함 → IO multiplexing 필요
- 이 한 문장이 select → poll → epoll → kqueue → io_uring 의 모든 기술 진화의 출발점이다

---

## 1. 1999 년의 문제 정의

Dan Kegel 의 [C10K 페이지](http://www.kegel.com/c10k.html) 는 다음과 같이 시작한다.

> "It's time for web servers to handle ten thousand clients simultaneously, don't you think? After all, the web is a big place now."

당시 일반적인 웹 서버 모델:

```
Client 1 ─── socket ─── thread #1 (in apache)
Client 2 ─── socket ─── thread #2
Client 3 ─── socket ─── thread #3
...
Client N ─── socket ─── thread #N
```

이것이 **thread-per-connection** (또는 thread-per-request, prefork) 모델이다. 동작은 명확하지만 N 이 1만을 넘으면 서버가 죽는다.

---

## 2. thread-per-connection 의 4 가지 비용

### (1) 스택 메모리

리눅스 기본 thread 스택 크기 = 8MB (`ulimit -s` 가 8192).

- 1,000 thread → ~8GB 가상 주소
- 10,000 thread → ~80GB 가상 주소

물리 메모리는 lazy alloc 이라 다 안 잡히지만, **가상 주소 공간 + commit charge + `MAX_MAP_COUNT` 한계** 에 부딪힌다. 특히 32-bit 시절엔 즉시 죽었다.

> 참고: Java thread 도 default 1MB (`-Xss1m`). 10K thread = 10GB 가상 메모리.

### (2) 컨텍스트 스위치

각 thread 가 IO 대기 중이면 OS 가 스케줄링 한다.
- 컨텍스트 스위치 비용: 수 µs (CPU 캐시 invalidation 포함하면 수십 µs)
- 1만 thread × 초당 수 회 스위치 = CPU 의 의미 있는 비율을 스케줄링이 잡아먹음

`vmstat 1` 의 `cs` (context switches per second) 가 수십만~수백만이면 위험 신호.

### (3) 커널 자료구조

각 thread 마다 `task_struct` (~수 KB) + 페이지 테이블 + 시그널 마스크 등이 커널에 잡힌다. fd table 도 프로세스마다 따로다.

### (4) Lock contention

여러 thread 가 같은 mutex / 같은 데이터 접근 시 cache line 핑퐁 + 스핀 → CPU 사용률은 100% 인데 throughput 은 안 오른다.

---

## 3. "그럼 thread 를 줄이고 한 thread 가 여러 fd 를 본다"

핵심 통찰: **대부분의 thread 는 IO 를 기다리며 놀고 있다.** CPU 를 안 쓰는 thread 가 1만 개 있을 이유가 없다.

Reactor 패턴의 출발점:

```
                  ┌──────────────────────┐
                  │  Single Thread        │
                  │  ┌──────────────┐    │
                  │  │  Selector     │    │
                  │  │  (epoll)      │◄───┼─── 10000 fd
                  │  └───────┬───────┘    │
                  │          │ ready      │
                  │          ▼            │
                  │  Dispatch handler     │
                  └──────────────────────┘
```

한 thread (혹은 CPU 코어 수만큼의 thread) 가 epoll_wait 으로 *준비된 fd 만* 모아서 처리한다. 메모리/스위치 비용 모두 사라진다.

---

## 4. C10K → C10M

2010 년대 들어 Robert Graham 등이 [C10M problem](http://c10m.robertgraham.com/) 을 제기.

> 2GHz CPU + 10Gbps NIC = 패킷당 200 cycles 예산. 일반 syscall 한 번 = 수천 cycles. 즉 syscall 당 200 패킷 처리해야 함.

C10K 의 답이 "kernel multiplexing" 이라면, C10M 의 답은 다음 두 갈래다.

### (a) Kernel bypass
- DPDK, Netmap, eBPF/XDP — 커널을 거치지 않고 NIC 에서 user-space 로 패킷 직송
- 단점: 일반 어플리케이션엔 과함. CDN/WAF/L4 LB 정도

### (b) Async IO 강화
- Linux **io_uring** — syscall 횟수를 줄여 cycle 절약
- Windows **IOCP** — 1990 년대부터 진짜 async IO

대부분의 백엔드는 C10M 을 만나기 전에 다른 병목 (DB, downstream API) 이 먼저 터지므로, **C10K 수준의 멀티플렉싱이면 충분**하다. 면접에서 C10M 을 언급할 일은 거의 없다.

---

## 5. 숫자로 보는 임계점

다음 표는 대략적 가이드. 정확한 수치는 OS/JVM 튜닝에 따라 달라진다.

| 동시 접속 | thread-per-conn 가능? | 권장 모델 |
|---|---|---|
| ~100 | OK | thread-per-conn (단순 우위) |
| ~1,000 | 가능 (튜닝 필요) | thread pool + queue |
| ~10,000 | 한계 (`-Xss256k` 등 튜닝 필수) | IO multiplexing (Netty / WebFlux) |
| ~100,000 | thread-per-conn 사실상 불가 | IO multiplexing 필수 |
| ~1,000,000 | C10M 영역 | 커널 bypass / io_uring |

> JDK 21 의 **Virtual Threads** 는 OS thread 가 아닌 user-space scheduling 으로 N:M 매핑 → 100K thread 가능. C10K 영역에서 thread-per-conn 의 단순함을 부활시켰다. (자세히는 [13-virtual-threads-impact.md](13-virtual-threads-impact.md))

---

## 6. msa 컨텍스트에서의 의미

현재 msa 는:

- **Gateway** = WebFlux (Netty 기반) — 입구라 동접 부하 가장 큼 → 멀티플렉싱 필수
- **product / order / search 등** = Spring MVC + Tomcat (thread pool)
  - default `server.tomcat.threads.max=200`
  - 한 서비스당 동접 200 미만이면 충분
  - 만약 단일 서비스 동접 1K+ 가 정상이면 → boundedElastic 또는 Virtual Threads 검토 (Phase 3 [18-improvements.md](18-improvements.md))

**우리 동접이 정말 1K 를 넘는가?** 가 의사결정의 출발점이다. 안 넘으면 thread-per-request 가 가장 단순하고 디버깅 쉽고 라이브러리 호환성도 좋다.

---

## 7. 흔한 오해

### "thread 가 많으면 CPU 도 많이 쓴다"
틀림. IO-bound thread 는 대부분 sleep 상태라 CPU 거의 안 쓴다. **메모리와 컨텍스트 스위치가 진짜 비용**.

### "C10K 는 옛날 얘기 아닌가?"
"하드웨어가 좋아져서 thread 1만 띄워도 된다" 는 흔한 반박. 현실:
- 1만 thread × 1MB = 10GB stack VAS 는 컨테이너 메모리 limit 에 곧장 부딪힌다
- Pod 메모리가 2GB 면 1K thread 도 빡빡하다

### "비동기로 짜면 무조건 빠르다"
틀림. CPU-bound 작업은 비동기로 바꿔도 throughput 안 오른다 (오히려 컨텍스트 스위치 늘어남). 비동기는 **IO 대기 시간을 다른 작업에 양보**할 때만 이득.

---

## 8. 핵심 포인트

- C10K = thread-per-connection 의 메모리/스케줄러 한계 노출 사건
- 답: 한 thread 가 epoll 로 여러 fd 감시 (Reactor 패턴)
- C10M = syscall 자체가 비용이 되는 영역 (io_uring, kernel bypass)
- 우리 msa 의 **단일 서비스 동접이 1K 를 넘지 않으면 thread-per-request 가 가장 단순**
- Virtual Threads 는 thread-per-conn 의 단순함을 100K 영역까지 끌어올림

## 다음 학습

- [02-io-stages-and-models.md](02-io-stages-and-models.md) — IO 의 두 단계와 4 가지 IO 모델
