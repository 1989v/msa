---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 4
---

# 15 — Pipeline / Lua / Function / Pub-Sub

## 한줄 요약

Redis 의 RTT 가 µs 라도 명령 1개당 RTT 1번이면 N개 명령은 N RTT. **Pipeline 이 RTT 를 1번으로 절감**한다. **Lua / Function** 은 단일 스레드 위 atomic 실행 단위 — race condition 차단의 핵심 도구. **Pub/Sub** 은 휘발성 broadcast — 메시지 큐로 쓰지 말 것.

## 1. Pipelining

### 1.1 RTT 문제

```
N=10000 명령, RTT=200µs
- 순차: 10000 × 200µs = 2초
- pipelined: 1 RTT = 200µs (서버에서 명령 처리 시간 추가)
```

### 1.2 Lettuce 예

```kotlin
// 자동 pipelining: async API 사용
val futures = (1..10000).map { redis.async().set("key:$it", "v$it") }
LettuceFutures.awaitAll(Duration.ofSeconds(5), *futures.toTypedArray())

// 명시적 pipelining
val template = StringRedisTemplate(factory)
template.executePipelined { conn ->
    repeat(10000) { conn.set("key:$it".toByteArray(), "v$it".toByteArray()) }
    null
}
```

### 1.3 한계

- 모든 응답을 buffer 에 모았다 한꺼번에 받음 → 메모리 사용 늘어남
- 한 명령 결과를 다음 명령에 사용 불가 → 그건 Lua / Function 영역
- pipeline 내 한 명령 에러는 다른 명령 실행에 영향 X

## 2. Lua Script

### 2.1 핵심 보장

- **atomicity**: 단일 스레드라 Lua 실행 동안 다른 명령 끼어들지 않음
- **server-side compute**: client → server RTT 없이 read-modify-write 가능

### 2.2 EVAL / EVALSHA

```
EVAL "redis.call('SET', KEYS[1], ARGV[1]); return 'OK'" 1 mykey myvalue

# 첫 호출 후 SHA1 캐시 → EVALSHA 로 전송 트래픽 절감
EVALSHA <sha1> 1 mykey myvalue
```

Lettuce / Spring Data Redis 의 `DefaultRedisScript` 가 EVALSHA 자동 fallback.

### 2.3 실 사용 예 (msa 의 Token Bucket)

```lua
-- quant/app/src/main/resources/lua/token_bucket.lua
local key = KEYS[1]
local now = tonumber(ARGV[1])
local size = tonumber(ARGV[2])
local rate = tonumber(ARGV[3])
local consume = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then tokens = size end
if last_refill == nil then last_refill = now end

local elapsed_sec = (now - last_refill) / 1000
local refill = elapsed_sec * rate
tokens = math.min(size, tokens + refill)
last_refill = now

local result = 0
if tokens >= consume then
    tokens = tokens - consume
    result = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
redis.call('EXPIRE', key, 3600)

return { result, math.floor(tokens) }
```

**여러 인스턴스가 동시에 호출해도 Lua 안 모든 명령이 atomic** → token 합산 한도가 깨지지 않음. 분산 락 없이 mutual exclusion 효과.

### 2.4 Lua 의 함정

- Lua 안에서 **blocking 명령 금지** (`BLPOP` 등). Lua 도 서버 단일 스레드 위에서 실행되므로 block 하면 전체 정지.
- 시간을 알려면 `redis.call('TIME')` 또는 ARGV 로 client 가 전달 (Lua 내 random / time 은 결정성 없어 replication 위험).
- 5초 이상 걸리는 Lua 는 `BUSY` 에러 → `SCRIPT KILL` 또는 `SHUTDOWN NOSAVE` 강제 종료. 짧게 유지할 것.
- cluster 모드에서 KEYS 는 모두 같은 슬롯 (hash tag 활용).

### 2.5 결정성과 replication

Lua 는 **결정적이어야** master → replica replication 시 같은 결과. 그래서 Redis 는 Lua 안의 random / time 결과를 캐시해 replica 에 전달 (Redis 5+ 에선 effects replication 으로 변경 — 결과만 전파).

## 3. Function (Redis 7+)

Lua script 의 단점:
- 매번 SHA1 hash 로 캐시 (서버 재시작 시 재로드 필요)
- 운영자 입장에서 어떤 script 가 등록돼있는지 관리 어려움

Redis 7 의 `Function` 이 이걸 보완:

```
FUNCTION LOAD "#!lua name=mylib
redis.register_function('myfunc', function(keys, args)
    return redis.call('SET', keys[1], args[1])
end)
"

FCALL myfunc 1 mykey myvalue
```

- `FUNCTION DUMP / RESTORE / LIST / DELETE` 로 명시적 관리
- replication 시 함수 라이브러리 통째로 전파
- Redis 7.4+ 에선 Lua 외 다른 언어도 (실험적)

운영 면에서 Lua 보다 Function 이 더 깔끔. 단 Lua 가 Spring Data Redis 와 결합도가 높아 (예: `DefaultRedisScript`) 전환에 코드 변경 필요.

## 4. Transaction (MULTI / EXEC / WATCH)

### 4.1 MULTI/EXEC

```
MULTI
SET a 1
SET b 2
INCR c
EXEC          # 한꺼번에 실행, atomic
```

특징:
- 명령들을 큐에 모았다가 EXEC 시 atomic 실행
- 명령 실패해도 rollback 없음 (errors 정보만 반환). RDB transaction 과 다름.
- Lua 보다 약함 (read 결과 기반 분기 불가, 그래서 Lua 가 사실상 표준)

### 4.2 WATCH (Optimistic Concurrency Control)

```
WATCH key
val = GET key
val_new = compute(val)
MULTI
SET key val_new
EXEC          # WATCH 한 키가 EXEC 전에 변경되었으면 EXEC 가 nil 반환 (실패)
```

- CAS (compare-and-swap) 같은 효과
- 실패 시 client 가 재시도

→ Lua 가 더 단순하고 atomic 강함. WATCH/MULTI 는 비즈니스 로직이 client 에 있어야 할 때만.

## 5. Pub/Sub

### 5.1 명령

```
SUBSCRIBE channel1
PUBLISH channel1 "hello"
PSUBSCRIBE pattern.*           # 패턴 구독
UNSUBSCRIBE
```

### 5.2 한계

| 한계 | 영향 |
|---|---|
| 영속성 없음 | 구독자 다운 = 메시지 영구 유실 |
| ack 없음 | 처리 실패 재처리 불가 |
| backpressure 없음 | slow consumer 가 broker 메모리 폭증 (`client-output-buffer-limit`) |
| cluster 에서 broadcast | 모든 master 에 publish — 트래픽 비효율 |

→ **메시지 큐로 쓰면 안 된다**. 휘발성 broadcast 가 OK 인 경우만 (실시간 알림, presence, log tail).

### 5.3 Cluster 의 sharded Pub/Sub (Redis 7+)

```
SSUBSCRIBE channel
SPUBLISH channel msg
```

- 채널을 **슬롯 단위로** 분산. cluster 의 broadcast 비효율 해결.
- subscriber 가 동일 슬롯의 master 에만 연결.

### 5.4 그래도 Pub/Sub 가 좋을 때

- WebSocket / SSE 의 in-memory fanout (휘발 OK)
- 클러스터 내 cache invalidation 신호 (실패해도 TTL 로 회복)
- presence (사용자 online 여부)

msa 적용 후보: 없음. 모든 cross-service messaging 은 Kafka.

## 6. 명령 실행 도구 비교

| 도구 | RTT | atomic | replication | 사용처 |
|---|---|---|---|---|
| Pipeline | 1 RTT | ✗ (각 명령 독립) | OK | bulk read/write |
| MULTI/EXEC | 1 RTT | ✓ (전체 atomic) | OK | 단순 transaction |
| WATCH+MULTI | 2+ RTT | optimistic | OK | client-side conditional |
| Lua EVAL | 1 RTT | ✓ | effects replication | 복잡한 atomic 로직 |
| Function | 1 RTT | ✓ | full replication | Lua 보다 운영 편의 |

대부분의 atomic 로직은 **Lua / Function** 을 쓴다. msa 의 token bucket / inventory reserve 가 모두 Lua.

## 7. 실전 운영 함정

- **Lua 안 무한 루프** → `BUSY` 에러. `SCRIPT KILL` 로 종료 (명령 read-only 면 OK, write 후면 SHUTDOWN NOSAVE 필요).
- **Pub/Sub backpressure** — slow subscriber 가 client-output-buffer 가득 채우면 connection close. `CLIENT NO-EVICT ON` 으로 보호 가능 (하지만 메모리 폭증).
- **Pipeline 너무 큼** — 10만 개씩 묶으면 응답 buffer 메모리. 적당히 1000-5000 단위 chunk.
- **EVAL 마다 script 보내면 트래픽 낭비** — `DefaultRedisScript` + EVALSHA 로 캐시.

## 8. msa 코드 매핑

| 도구 | msa 사용처 |
|---|---|
| Lua | quant rate limit (`token_bucket.lua`), inventory (`reserve-stock.lua`, `release/confirm/receive-stock.lua`) |
| Pipeline | 명시 사용 없음 (Spring Data Redis 가 자동 batching 일부 수행) |
| MULTI/EXEC | 미사용 |
| Function | 미사용 (Redis 7+ 도입 후보) |
| Pub/Sub | 미사용 (Kafka 가 메시지 인프라) |

## 9. 면접 포인트

- "Pipelining 의 효과?" → N RTT → 1 RTT. 단순 batch 의 latency 절감. atomic 보장은 안 함.
- "Lua 가 atomic 인 이유?" → Redis 단일 스레드라 Lua 실행 동안 다른 명령 끼어들지 못함.
- "Lua 와 MULTI/EXEC 차이?" → Lua 는 read 결과 기반 분기 가능, MULTI 는 단순 batch + rollback 없음.
- "Function 이 Lua 와 다른 점?" → 명시적 lib 관리, replication 안전, 운영 편의.
- "Pub/Sub 메시지 큐로 못 쓰는 이유?" → 영속성 / ack / backpressure 부재.
- "cluster Pub/Sub 의 비효율?" → 모든 master 에 broadcast. Redis 7 의 sharded Pub/Sub 으로 슬롯 단위 분산.

## 10. 다음 파일 연결

명령 도구가 끝났다. 운영 함정 (big key / hot key / KEYS 금지 / fragmentation) + 메모리 관리는 16 에서.
