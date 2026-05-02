---
parent: 9-redis-deep-dive
type: preview
created: 2026-05-01
---

# Redis 심화 — Preview

> 학습자 수준: 중급 (10년차 한국 백엔드 면접 대비) · 전체 예상 시간: 15h · 목표: 면접 + msa 코드 적용
> 계획서: [00-plan.md](00-plan.md) · 직전 #15 Connection Pool 학습 노트와 cross-ref (Lettuce vs Jedis 모델)

---

## 멘탈 모델: "한 줄 머신 위에 쌓인 5개 층"

Redis 는 결국 **단일 스레드 명령 루프** 위에 자료구조 / 영속화 / 복제 / 운영 / 패턴이 얹힌 시스템이다. 5개 층으로 본다.

```
  ┌─────────────────────────────────────────────┐
  │  L5: 운영 패턴 (Cache 전략 / 분산락 / 스트림)
  │  - Cache-Aside / Stampede 방어
  │  - SETNX / RedLock / 펜싱 토큰
  │  - Stream + Consumer Group
  └─────────────────┬───────────────────────────┘
                    │ "여러 노드를 어떻게 묶나"
  ┌─────────────────┴───────────────────────────┐
  │  L4: HA / 분산 (Replication / Sentinel / Cluster)
  │  - 16384 hash slot, gossip
  │  - MOVED/ASK redirect
  │  - failover 자동화
  └─────────────────┬───────────────────────────┘
                    │ "프로세스 죽으면 데이터는?"
  ┌─────────────────┴───────────────────────────┐
  │  L3: 영속화 (RDB / AOF / Mixed)
  │  - fork + Copy-on-Write
  │  - appendfsync 3옵션
  │  - AOF rewrite
  └─────────────────┬───────────────────────────┘
                    │ "메모리 안에서는 어떻게 저장되나"
  ┌─────────────────┴───────────────────────────┐
  │  L2: 자료구조 내부 (SDS / Listpack / SkipList…)
  │  - encoding 자동 변환 임계값
  │  - 시간 복잡도 보증
  └─────────────────┬───────────────────────────┘
                    │ "왜 빠른가"
  ┌─────────────────┴───────────────────────────┐
  │  L1: 실행 모델 (single-thread + epoll)
  │  - I/O multiplexing
  │  - O(1) 명령 우선
  │  - 메모리 상주
  └─────────────────────────────────────────────┘
```

**핵심 5문장만 외운다**:
1. **Redis 가 빠른 이유는 메모리 + 단일 스레드 + epoll**, "단일 스레드라 느릴 것" 이라는 직관이 틀린 이유는 컨텍스트 스위치/락이 없기 때문.
2. **자료구조는 데이터가 작을 때 listpack/intset 으로 메모리 효율 우선, 커지면 hashtable/skiplist 로 시간 복잡도 우선** 자동 변환.
3. **AOF everysec 가 표준** — fsync always 는 디스크가 병목, no 는 OS 캐시 의존이라 위험.
4. **Cluster 는 16384 슬롯 + gossip + MOVED/ASK redirect**, multi-key 트랜잭션은 hash tag `{...}` 로 동일 슬롯 강제해야 가능.
5. **분산 락은 RedLock 보다 단일 마스터 + 펜싱 토큰**이 안전하다 (Kleppmann 비판), Stop-the-world GC + clock drift 로 RedLock 도 불완전.

---

## 소주제 지도

> 19개 deep 파일 + plan/preview. 각 파일 250-400줄.

### Phase 1: 기본 모델 + 자료구조 (5개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | 단일 스레드 + I/O 멀티플렉싱 | [01-single-thread-and-io.md](01-single-thread-and-io.md) | 왜 빠른가, blocking 명령 위험성, Redis 6+ I/O thread |
| 02 | 자료구조 8종 개요 | [02-data-structures-overview.md](02-data-structures-overview.md) | String/List/Hash/Set/ZSet/Bitmap/HLL/Stream 사용처 |
| 03 | 자료구조 내부 1: SDS / Listpack / Intset | [03-internal-encodings-1.md](03-internal-encodings-1.md) | SDS 헤더, Listpack 가변 길이, intset 정렬 + binary search |
| 04 | 자료구조 내부 2: Hashtable / SkipList / QuickList | [04-internal-encodings-2.md](04-internal-encodings-2.md) | rehashing incremental, skiplist O(log N), quicklist linked-listpack |
| 05 | TTL / Expiration / 메모리 정책 | [05-ttl-and-eviction.md](05-ttl-and-eviction.md) | active+lazy expiration, maxmemory-policy 6종, LFU 우위 |

### Phase 2: 영속화 + HA + 분산 (4개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 06 | RDB 스냅샷 (fork + CoW) | [06-rdb-persistence.md](06-rdb-persistence.md) | BGSAVE fork latency, CoW 메모리 폭증 위험 |
| 07 | AOF + Mixed (RDB-AOF) | [07-aof-persistence.md](07-aof-persistence.md) | appendfsync 3종, rewrite, Redis 7 multi-part AOF |
| 08 | Replication + Sentinel | [08-replication-sentinel.md](08-replication-sentinel.md) | async/PSYNC, repl_backlog, Sentinel quorum, split-brain |
| 09 | Cluster: 16384 슬롯 + redirect | [09-cluster-slots.md](09-cluster-slots.md) | gossip, MOVED/ASK, hash tag, resharding, multi-key 한계 |

### Phase 3: 패턴 + 안전성 (5개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 10 | Cache 전략 4종 | [10-cache-patterns.md](10-cache-patterns.md) | Aside / Through / Behind / Refresh-Ahead, write 일관성 |
| 11 | Cache Stampede 방어 | [11-cache-stampede.md](11-cache-stampede.md) | XFetch (probabilistic early), 분산락, TTL jitter, SingleFlight |
| 12 | 분산 락 1: SETNX 한계 | [12-distributed-lock-setnx.md](12-distributed-lock-setnx.md) | NX EX, owner token, Lua unlock, GC pause 위험 |
| 13 | 분산 락 2: RedLock + 펜싱 토큰 | [13-distributed-lock-redlock.md](13-distributed-lock-redlock.md) | RedLock 알고리즘, Kleppmann 비판, Redisson, fencing token |
| 14 | Stream + Consumer Group | [14-stream-consumer-group.md](14-stream-consumer-group.md) | XADD/XREADGROUP/XACK, PEL, Kafka 와 비교 |

### Phase 4: 실행 / 운영 / 코드 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 15 | Pipeline / Lua / Function / Pub/Sub | [15-pipeline-lua-pubsub.md](15-pipeline-lua-pubsub.md) | RTT 절감, Lua 원자성, Function 7+, Pub/Sub 한계 |
| 16 | 메모리 관리 + 운영 함정 | [16-memory-and-pitfalls.md](16-memory-and-pitfalls.md) | jemalloc, defrag, big key, hot key, KEYS 금지 |
| 17 | msa 코드베이스 적용 점검 | [17-msa-application.md](17-msa-application.md) | gateway Token Bucket, common auto-config, 5서비스 standalone, inventory Lua |

### 산출물 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 18 | 코드 개선 제안 | [18-improvements.md](18-improvements.md) | Stampede 방어, RedLock vs Redisson 결정, Stream 도입 검토, big key 모니터링 |
| 19 | 면접 Q&A 카드 | [19-interview-qa.md](19-interview-qa.md) | 50문항 + 오답 체크 + 한국 대기업 빈출 |

---

## 개념 관계도

```
                ┌─────────────────────────────┐
                │ L1: 단일 스레드 + epoll      │
                │ (blocking 명령 = 전체 정지) │
                └──────────────┬──────────────┘
                               │ "데이터를 어떻게 저장하나"
                               ▼
                ┌─────────────────────────────┐
                │ L2: 8가지 자료구조           │
                │ + 내부 encoding 자동 변환   │
                │ (listpack ↔ hashtable 등)   │
                └──────┬──────────┬───────────┘
                       │          │
        "프로세스 죽으면"│          │"여러 노드로 어떻게 늘리나"
                       ▼          ▼
        ┌──────────────────┐  ┌──────────────────┐
        │ L3: RDB / AOF    │  │ L4: Replication  │
        │ Mixed            │  │ Sentinel         │
        │                  │  │ Cluster (16384)  │
        └────────┬─────────┘  └────────┬─────────┘
                 │                     │
                 └──────────┬──────────┘
                            │ "이걸로 무얼 만드나"
                            ▼
                ┌─────────────────────────────┐
                │ L5: 운영 패턴                │
                │ Cache / Stampede 방어        │
                │ 분산 락 / Stream             │
                │ Pipeline / Lua / Pub-Sub    │
                └─────────────────────────────┘
```

---

## Phase 1 치트시트 (학습 시작 전 한 장)

### 자료구조와 시간 복잡도

| 자료구조 | 대표 명령 | 복잡도 | 작은 인코딩 | 큰 인코딩 |
|---|---|---|---|---|
| String | GET/SET/INCR | O(1) | embstr (≤44B) | raw / int |
| List | LPUSH/RPUSH/LRANGE | O(1) push, O(N) range | listpack | quicklist |
| Hash | HGET/HSET | O(1) avg | listpack | hashtable |
| Set | SADD/SISMEMBER | O(1) | intset / listpack | hashtable |
| ZSet | ZADD/ZRANGE | O(log N) | listpack | skiplist + hashtable |
| Bitmap | SETBIT/GETBIT | O(1) | (String 위 비트 연산) | — |
| HLL | PFADD/PFCOUNT | O(1) | (12 KB 고정) | — |
| Stream | XADD/XREADGROUP | O(log N) | radix tree + listpack | — |

### 절대 하지 말 것

- 운영 Redis 에 `KEYS *` (O(N), 단일 스레드 점거) → `SCAN` 사용
- 단일 키에 GB 단위 데이터 (big key, fork CoW 폭증)
- `FLUSHALL` / `DEBUG SLEEP` 운영 권한 노출
- AOF `always` 를 무조건 적용 (TPS 1/10 이하로 떨어짐)
- multi-key 트랜잭션을 cluster 에서 hash tag 없이 시도 (CROSSSLOT)
- 분산 락에서 owner token 없이 `DEL` (다른 owner 락 풀어버림)
- Pub/Sub 을 메시지 큐로 (구독자 다운 = 메시지 영구 유실)

### 권장 운영값 (2026 기준)

| 영역 | 1순위 | 비고 |
|---|---|---|
| Eviction | `allkeys-lfu` | TTL 없는 키 섞여 있으면 lfu, TTL 명확하면 volatile-ttl |
| AOF | `appendfsync everysec` | 1초 손실 허용 |
| Mixed | `aof-use-rdb-preamble yes` | Redis 4+ 기본, restart 빠름 |
| Cluster | masters 3 + replicas 3 | 6노드 최소 (project prod 동일) |
| Topology refresh | adaptive + 10분 주기 | Lettuce default off, 명시 권장 |
| Lock | Redisson `RLock` (단일 마스터) + 펜싱 | RedLock 은 운영 부담 대비 이득 작음 |

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → … → 17 → 18 → 19**
- 01-05 (Phase 1) 는 의존성 있음 → 순서대로
- 06-07 RDB/AOF 는 짝, 한 번에 학습
- 09 Cluster 학습 시 msa `k8s/infra/prod/redis/values.yaml` 한 번 열어보면 결합도 높음
- 11 Stampede + 12-13 분산락은 면접 고빈도 → 정독
- 17 은 msa 실 코드 grep 기반이라 IDE 옆에 두고 같이 보기
- 19 면접 Q&A 는 1주일 간격 2-3회 회독

각 파일 호출:
```
/study:start 9            # 다음 deep file 자동 선택
/study:start 9 11         # 11-cache-stampede.md 직접 지정
```
