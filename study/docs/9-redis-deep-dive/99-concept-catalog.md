---
parent: 9-redis-deep-dive
seq: 99
title: Redis 개념 카탈로그 — Full-Coverage + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://redis.io/docs/latest/
  - https://redis.io/docs/latest/commands/
  - https://redis.io/docs/latest/operate/oss_and_stack/
  - https://redis.io/docs/latest/develop/
  - https://github.com/redis/redis
---

# 99. Redis 개념 카탈로그

> **목적** — 9-redis-deep-dive 의 19+ deep file + Redis 공식 docs (8.x 기준) 기준 빠진 영역 발굴 (RESP3, Client Side Caching, Functions, ACL, Stream Consumer Group, RedisJSON / Search / TimeSeries / Bloom 모듈, Active-Active CRDB 등).

---

## 1. 기존 커버 매트릭스 (요약)

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| 자료구조 | String / List / Hash / Set / Sorted Set / Bitmap / HyperLogLog / Geo / Stream | ✅ |
| 자료구조 인코딩 | embstr / raw, ziplist/listpack, intset, skiplist | ✅ |
| Persistence | RDB / AOF / hybrid | ✅ |
| 복제 / Cluster | master-replica, sentinel, cluster slot | ✅ |
| Transaction | MULTI/EXEC, WATCH, optimistic lock | ✅ |
| Pub/Sub / Stream | pub/sub vs stream | ✅ |
| 분산 락 | Redlock, Redisson | ✅ |
| Cache stampede | mutex / probabilistic / refresh-ahead | ✅ |
| 운영 | latency, slowlog, mem usage, expiration | ✅ |
| msa 적용 | gateway / product / gifticon / analytics / experiment standalone vs cluster | ✅ |

### 1-A. 갭 진단

1. **RESP3** (Redis Serialization Protocol v3) — push notification, hello, attributes
2. **Client Side Caching (Tracking)** — invalidations push (RESP3 prerequisite)
3. **Redis Functions** (Redis 7.0+) — Lua scripts 의 후속 — version + load
4. **Stream Consumer Group** + XACK + XPENDING + XCLAIM + XAUTOCLAIM 풀 패턴
5. **Stream + idempotency** — message id 활용
6. **Sentinel** 동작 — quorum, failover trigger
7. **Cluster** 의 hash slot (16384) + key hash tag
8. **Cluster ASK/MOVED redirect**
9. **Cluster resharding (slot 이동)**
10. **Active-Active CRDB** (Redis Enterprise) — CRDT 기반
11. **ACL (Redis 6.0+)** — user / password / commands / key pattern / categories
12. **TLS (Redis 6.0+)** — in-cluster + client
13. **Modules** — RedisJSON / RediSearch / RedisTimeSeries / RedisBloom / RedisGraph (deprecated) / RedisGears
14. **RedisJSON** — JSONPath 부분 update
15. **RediSearch** — secondary index, full-text, vector (#19 alternative)
16. **RedisTimeSeries** — TS sample + downsampling
17. **RedisBloom** — Bloom / Cuckoo / TopK / Count-Min Sketch / TDigest
18. **Lua scripting** vs **Functions** 비교
19. **Pipelining** (round-trip 절감) vs Transaction
20. **Pub/Sub keyspace notifications** — `__keyevent@0__:expired`
21. **Eviction policies (8 종)** — noeviction / allkeys-lru / lfu / random / volatile-* (4 변형)
22. **expiration 알고리즘** — sample + lazy + active
23. **Memory analysis** — `MEMORY STATS`, `MEMORY USAGE`, `redis-cli --bigkeys`
24. **Latency analysis** — `LATENCY` commands, slowlog
25. **Replication topology** — chained replication, replica of replica
26. **WAIT command** — sync replication 흉내
27. **Read from replicas** — `READONLY` (Cluster client)
28. **`CLIENT NO-EVICT` / `CLIENT REPLY OFF`** — 운영 옵션
29. **`OBJECT ENCODING`** — 자료구조 인코딩 확인
30. **MULTI/EXEC + Lua + Functions 의 atomicity 비교**
31. **Stream 의 trim** (`MAXLEN ~ N`, approximate)
32. **Stream 의 length / consumer 모니터**
33. **HEXPIRE / OBJECT 등 신기능** (Redis 7.4+)
34. **RDB 압축 (`rdbcompression`)** + AOF rewrite

---

## 2. 카테고리별 개념 트리

### A. 자료구조 + 인코딩

| 자료구조 | 인코딩 | 핵심 명령 | 상태 |
|---|---|---|---|
| String | int / embstr (≤44B) / raw | SET / GET / INCR / APPEND | ✅ |
| List | listpack (≤128 + ≤64B) / quicklist | LPUSH / RPUSH / LRANGE / BLPOP | ✅ |
| Hash | listpack / hashtable | HSET / HGETALL / HSCAN | ✅ |
| Set | intset (정수 only) / listpack / hashtable | SADD / SISMEMBER / SDIFF / SUNION | ✅ |
| Sorted Set (ZSet) | listpack / skiplist + dict | ZADD / ZRANGEBYSCORE / ZRANGEBYLEX | ✅ |
| Bitmap | String 위 비트 | SETBIT / BITCOUNT / BITOP | ✅ |
| HyperLogLog | String 위 sparse/dense | PFADD / PFCOUNT / PFMERGE | ✅ |
| Geo | Sorted Set 기반 | GEOADD / GEORADIUS / GEOSEARCH | ✅ |
| **Stream** | radix tree | XADD / XREAD / XREADGROUP / XACK / XPENDING / XCLAIM / XAUTOCLAIM / XTRIM | 🟡 부분 |

### B. Persistence

| 개념 | 정의 | 상태 |
|---|---|---|
| RDB (snapshot) | 주기 fork + dump | ✅ |
| AOF (append-only) | always / everysec / no | ✅ |
| Hybrid (aof-use-rdb-preamble) | RDB + AOF | ✅ |
| AOF rewrite | 압축 | ✅ |
| Save semantics | `save` directives | ✅ |

### C. 복제 / HA / Cluster

| 개념 | 정의 | 상태 |
|---|---|---|
| Master-Replica replication | async (default) / WAIT 명령 | ✅ |
| Replication topology | chained, replica-of-replica | ★ 신규 |
| Sentinel | failover, quorum, monitor | ✅ |
| **Cluster** (16384 slot) | hash slot 분할 | ✅ |
| Hash tag (`{tag}key`) | 동일 slot 강제 | ★ 신규 |
| MOVED / ASK redirect | client 재시도 | ★ 신규 |
| Resharding (slot 이동) | 무중단 재분배 | ★ 신규 |
| Read from replicas (`READONLY`) | client 옵션 | ★ 신규 |
| **Active-Active CRDB** (Enterprise) | CRDT 기반 multi-master | ★ 신규 |

### D. 트랜잭션 / Atomicity

| 개념 | 정의 | 상태 |
|---|---|---|
| MULTI/EXEC | 트랜잭션 큐잉 + 일괄 실행 | ✅ |
| WATCH | optimistic lock | ✅ |
| Lua scripting (EVAL) | atomic single-shard script | ✅ |
| **Functions (FCALL)** | Lua 후속 — version, load 분리, replicated | ★ 신규 |
| Pipelining | 비-atomic round-trip 절감 | 🟡 |

### E. Pub/Sub / Stream

| 개념 | 정의 | 상태 |
|---|---|---|
| Pub/Sub | fire-and-forget | ✅ |
| **Pattern subscribe** (`PSUBSCRIBE`) | wildcard | ✅ |
| **Sharded Pub/Sub** (Redis 7.0+) | cluster pub/sub | ★ 신규 |
| Stream + Consumer Group | 영구 + 분산 처리 | ✅ |
| XACK / XPENDING / XCLAIM / XAUTOCLAIM | retry / dead-letter | ★ 신규 |
| Stream id (`<ms>-<seq>`) + idempotency | 멱등 키 | ★ 신규 |
| Stream trim (MAXLEN / MINID) | 보관 정책 | ★ 신규 |

### F. 분산 락 / Cache 패턴

| 개념 | 정의 | 상태 |
|---|---|---|
| Redlock | 다중 master quorum | ✅ |
| Single-node SET NX EX | 단순 lock | ✅ |
| Redisson lock | reentrant + watchdog renewal | ✅ |
| Cache aside / write-through / write-back | 표준 패턴 | ✅ |
| **Cache stampede 방어** | mutex / probabilistic / refresh-ahead | ✅ |
| Negative caching | 미존재 캐시 | 🟡 |
| TTL jitter | thundering herd 회피 | ✅ |

### G. ACL / TLS / 보안

| 개념 | 정의 | 상태 |
|---|---|---|
| **ACL** (user / password / commands / key pattern / categories) | 6.0+ 표준 | ★ 신규 |
| **TLS** (server + client + replication) | 6.0+ | ★ 신규 |
| `AUTH` (legacy) | requirepass | 🟡 |
| Renamed / disabled commands | FLUSHDB 차단 등 | 🟡 |

### H. RESP / Client

| 개념 | 정의 | 상태 |
|---|---|---|
| RESP2 | 기존 | ✅ |
| **RESP3** | push notification + attributes | ★ 신규 |
| **Client Side Caching (Tracking)** | RESP3 push 활용 | ★ 신규 |
| HELLO command | protocol negotiation | ★ 신규 |
| `CLIENT NO-EVICT / REPLY OFF` | 운영 옵션 | ★ 신규 |

### I. 운영 / 진단

| 개념 | 정의 | 상태 |
|---|---|---|
| `LATENCY` commands | latency 추적 | 🟡 |
| `SLOWLOG` | 느린 명령 | ✅ |
| `MEMORY STATS / USAGE / DOCTOR` | 메모리 분석 | ✅ |
| `redis-cli --bigkeys --hotkeys` | 분석 도구 | ✅ |
| Eviction policy 8종 | maxmemory + policy | ✅ |
| Expiration (lazy + active) | 알고리즘 | ✅ |
| Keyspace notifications | TTL/expire 이벤트 push | ★ 신규 |
| `OBJECT ENCODING <key>` | 인코딩 확인 | ✅ |

### J. Modules

| 모듈 | 역할 | 상태 |
|---|---|---|
| **RedisJSON** | JSONPath 부분 update | ★ 신규 |
| **RediSearch** | secondary index + full-text + vector | ★ 신규 (#19 대안) |
| **RedisTimeSeries** | TS sample + downsampling | ★ 신규 |
| **RedisBloom** | Bloom / Cuckoo / Count-Min / TDigest / TopK | ★ 신규 |
| RedisGraph | property graph (deprecated 2024) | skip |
| RedisGears | server-side processing | ★ 신규 |

### K. msa 적용

| 위치 | 사용 | 상태 |
|---|---|---|
| gateway | rate limit + JWT cache | ✅ |
| product | hot product cache | ✅ |
| gifticon | gifticon code reservation | ✅ |
| analytics | counter / hyperloglog | ✅ |
| experiment | bucket assignment | ✅ |
| msa CLAUDE.md | 5 서비스 standalone 전환 | ✅ |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **Stream Consumer Group + XACK/XPENDING/XCLAIM/XAUTOCLAIM** | 영구 큐 + 재처리 패턴 |
| 2 | **Functions (Redis 7.0+)** | Lua 후속 표준 |
| 3 | **Cluster hash tag + MOVED/ASK + resharding** | 운영 진입 시 |
| 4 | **RESP3 + Client Side Caching** | round-trip / cache 비용 절감 |
| 5 | **ACL + TLS** | 보안 기본 |
| 6 | **Active-Active CRDB** (CRDT 기반, #14 cross) | multi-region |
| 7 | **RediSearch** (#19 alternative) | sub-domain 검색의 가벼운 대안 |
| 8 | **RedisJSON** | semi-structured cache |
| 9 | **Sharded Pub/Sub** (Redis 7.0+) | cluster pub/sub |
| 10 | **Latency analysis 표준 (`LATENCY` cmds + slowlog)** | 운영 진단 표준 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. Redis 특화:
- §3 → "내부 자료구조 인코딩 변환 조건" 표
- §6 → "Standalone vs Cluster vs Active-Active 차이" 표
- §7 → `INFO sections` 매핑

---

## 5. 참고 자료

- Redis docs: https://redis.io/docs/latest/
- Commands ref: https://redis.io/docs/latest/commands/
- "Redis in Action" (Josiah Carlson)
- "Redis Cookbook" / "Mastering Redis"
- Antirez blog (legacy): http://antirez.com/
- Redlock 논쟁: https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
