---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 1
---

# 01 — 단일 스레드 모델 + I/O 멀티플렉싱

## 한줄 요약

Redis 가 빠른 본질은 "메모리 + 단일 스레드 명령 루프 + epoll 기반 I/O 멀티플렉싱" 이다. 락/컨텍스트 스위치가 없으니 cache miss 가 적고, O(1) 명령이 대부분이니 한 명령이 µs 단위로 끝난다. 단점은 명백하다 — **한 명령이 느려지면 모든 클라이언트가 같이 느려진다**.

## 1. 왜 단일 스레드인데 빠른가

### 직관 깨기

"단일 스레드 = 느림" 이라는 일반화가 작동하지 않는 이유는 Redis 의 작업 단위가 **네트워크 + 메모리 접근**이지 CPU-bound 가 아니기 때문이다. CPU 가 놀고 있고 네트워크/메모리 대기가 병목인 워크로드에서는, 멀티스레드의 락/캐시 라인 충돌 비용이 단일 스레드보다 더 비쌀 수 있다.

| 항목 | 단일 스레드 | 멀티스레드 |
|---|---|---|
| 락 | 불필요 | 자료구조 락 필요 |
| 컨텍스트 스위치 | 없음 | 빈번 |
| CPU 캐시 | hot | invalidation 빈번 |
| 디버깅 | 단순 | race condition 위험 |
| 멀티 코어 활용 | 1코어만 | N코어 |

Redis 는 **"코어 1개로도 충분히 100k QPS 가 나오니, 더 필요하면 sharding 으로 노드를 늘려라"** 라는 철학을 택했다. 6개 노드면 600k QPS, 운영 cluster 에서 흔한 수치.

### 실제 명령 처리 단계

```
1. 클라이언트 요청 도착 (TCP)
2. epoll_wait 가 readable fd 깨움
3. 읽기 → RESP 프로토콜 파싱
4. 명령 dispatch (lookup table)
5. 자료구조 변경 (메모리)
6. 결과 RESP 인코딩
7. 쓰기 버퍼에 적재
8. epoll 다음 사이클에 클라이언트로 flush
```

3-6 단계가 전부 메모리/CPU 작업이고 µs 단위. 1-2, 7-8 이 epoll 멀티플렉싱이 책임지는 부분.

## 2. I/O 멀티플렉싱 (epoll / kqueue)

`select(2)` 는 fd 수 1024 한계 + O(N) 스캔이라 OS 가 발전시킨 게 Linux `epoll`, BSD/macOS `kqueue`. Redis 는 빌드 타임에 자동 선택한다 (`ae_epoll.c`, `ae_kqueue.c`).

```
┌────────────────────────────────────────────┐
│              ae (event loop)               │
│  ┌──────────────────────────────────────┐  │
│  │  epoll_wait(fd_set, timeout)         │  │
│  └──────┬───────────────────────────────┘  │
│         │ fd 깨어남                         │
│         ▼                                   │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │ readQueryFromClient (read fd)        │  │
│  └───────┬──────┘    └────────────┬─────┘  │
│          ▼                        │        │
│  ┌──────────────┐                 │        │
│  │ processCommand (단일 스레드)  │        │
│  └───────┬──────┘                 │        │
│          ▼                        │        │
│  ┌──────────────┐         ┌──────▼─────┐  │
│  │ addReply  ───────────► │ outBuf      │  │
│  └──────────────┘         └─────────────┘  │
└────────────────────────────────────────────┘
            │                      │
            ▼                      ▼
        client A               client B
```

핵심: **fd 가 여러 개여도 한 번의 epoll_wait 로 ready set 받아 순차 처리**. 따라서 한 클라이언트의 큰 명령이 다른 클라이언트를 막는다.

## 3. Redis 6+ 의 I/O 스레드

여전히 "명령 실행" 은 단일 스레드지만, **read/write 시스템콜과 RESP 파싱은 멀티 스레드**로 분리할 수 있다 (`io-threads N`, `io-threads-do-reads yes`).

```
                    main thread
                         │
                         │ ① batch 가 모이면
                         ▼
        ┌────────────┬──────┬────────────┐
        │ io-thread1 │  …   │ io-threadN │   ← read/parse 병렬
        └────────────┴──────┴────────────┘
                         │
                         │ ② 파싱된 명령
                         ▼
                    main thread (실행, 단일)
                         │
                         │ ③ 응답 인코딩 후 batch
                         ▼
        ┌────────────┬──────┬────────────┐
        │ io-thread1 │  …   │ io-threadN │   ← write 병렬
        └────────────┴──────┴────────────┘
```

대규모 페이로드 (큰 GET, MGET) 시 30-50% TPS 개선이 보고되지만, 작은 명령 위주면 차이가 거의 없다. 4-8 스레드를 넘기면 main thread 가 병목이라 의미 없음.

> Redis 7.4+ 에선 `io-threads-do-reads` 를 default-on 으로 가는 흐름이지만, 기본값은 환경마다 다르므로 운영 시 `CONFIG GET io-threads*` 확인 필요.

## 4. blocking 명령의 위험

다음은 **명령 자체가 O(N) 또는 O(N·M)** 이라 단일 스레드를 점거한다.

| 명령 | 복잡도 | 위험 |
|---|---|---|
| `KEYS pattern` | O(N) 전체 키 | 운영 절대 금지 |
| `SMEMBERS bigset` | O(N) | 100만 멤버 → ms 단위 정지 |
| `LRANGE 0 -1 biglist` | O(N) | 동상 |
| `HGETALL bighash` | O(N) | 동상 |
| `DEL bigkey` | 자료구조에 따라 O(N) | DEL 도 막힘 → `UNLINK` 사용 |
| `FLUSHDB` | O(N) | `FLUSHDB ASYNC` |

운영 룰:

- 키 패턴 탐색은 항상 `SCAN cursor MATCH ...`
- 큰 컬렉션 삭제는 `UNLINK` (lazy free, 백그라운드 스레드)
- `FLUSHDB ASYNC` / `FLUSHALL ASYNC`
- `LATENCY MONITOR` + `SLOWLOG GET 10` 으로 지연 명령 추적

## 5. RESP 프로토콜 (간단)

Redis 는 자체 텍스트/바이너리 혼용 프로토콜을 쓴다. RESP2 / RESP3 (Redis 6+).

```
SET foo bar  →  "*3\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n"
                 │
                 ├─ *3 = 배열 길이
                 ├─ $3 = 다음 bulk string 길이
                 └─ \r\n = 종료
```

- 단순한 형식 → 파싱 빠름
- pipelining 지원 (한 TCP 에 여러 요청)
- RESP3 에선 Map / Set / Push 타입 추가 (Pub/Sub 와 일반 응답 분리 용이)

> Lettuce 는 RESP3 지원, Jedis 는 5.x 부터 부분 지원.

## 6. 명령 처리 latency 분포 예시

| 명령 | p50 | p99 | 비고 |
|---|---|---|---|
| `SET key 100B` | 30µs | 150µs | 평범 |
| `GET key` | 25µs | 120µs | 메모리 hit |
| `INCR counter` | 25µs | 120µs | atomic |
| `LPUSH 1 element` | 35µs | 180µs | quicklist insert |
| `ZADD 1 member` | 50µs | 250µs | skiplist O(log N) |
| 1MB GET | 1ms | 5ms | 네트워크 + RESP serialize |
| EVAL Lua 50 cmd | 200µs-2ms | … | atomic block |

→ **Redis 단일 노드 P99 가 ms 를 넘기 시작하면 90% 확률로 big key / blocking 명령**.

## 7. CPU / 네트워크 한계 추정

| 항목 | 값 |
|---|---|
| 단일 노드 GET QPS | 100k-200k (작은 키, pipelining 시 1M+) |
| 메모리 BW | 50GB/s 수준 (DRAM) — 거의 닿지 않음 |
| 네트워크 BW | 10GbE = 1.25GB/s — big value 시 병목 |
| RTT | LAN 100µs, 같은 K8s 노드 50µs |

**RTT 가 단일 명령보다 길다** 는 점이 pipelining/Lua 가 강력한 이유.

## 8. 코드베이스 연결: msa 의 단일 스레드 가정

- `gateway/RedisRateLimiter` 의 Token Bucket 은 **단일 스레드 + Lua atomicity** 를 가정한다. 클러스터에서도 한 슬롯 안에서 atomic.
- `inventory/InventoryCacheAdapter` 의 `reserve-stock.lua` 도 동일 전제.
- 단일 스레드라 **`SCAN` + `UNLINK`** 정도만 유의하면 운영 위험 낮음.

## 9. 면접 포인트

- "왜 빠른가?" → 메모리 + 단일 스레드 + epoll. 락/컨텍스트 스위치/캐시 invalidation 비용 없음.
- "단일 스레드인데 멀티 코어 어떻게 활용?" → I/O 스레드 (read/write/parse only), 또는 cluster sharding.
- "위험은?" → 한 명령이 느려지면 전체 정지, big key + KEYS + DEL 금지, `UNLINK` / `SCAN` 사용.
- "Redis 6 의 I/O 스레드 이후 단일 스레드 모델 깨졌나?" → 명령 실행은 여전히 단일, syscall 만 병렬.
- "RESP 와 HTTP 차이?" → RESP 는 단순 길이-프리픽스 + pipelining, HTTP/1.1 도 가능하지만 헤더 오버헤드 큼.

## 10. 다음 파일 연결

자료구조가 메모리 위에서 실제로 어떻게 표현되는지 (encoding 자동 변환) 는 02 / 03 / 04 에서 본다. 단일 스레드 위에서 자료구조 선택이 latency 를 어떻게 결정하는지 직관 잡기.
