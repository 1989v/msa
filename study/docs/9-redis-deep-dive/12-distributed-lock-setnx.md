---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 3
---

# 12 — 분산 락 ① SETNX 단일 키 + 한계

## 한줄 요약

가장 단순한 분산 락은 `SET lock:key uuid NX EX 5` + Lua DEL (owner 검증). atomic + TTL 자동 회수가 핵심. 그러나 **GC (Garbage Collection, 가비지 컬렉션) pause / clock drift / async replication** 으로 인해 **단일 마스터 SETNX 도 절대 안전하지 않다** — 그래서 펜싱 토큰이 필요 (13 에서).

## 1. SETNX 의 안전한 형태

### 1.1 잘못된 코드 (clobber 위험)

```kotlin
// ❌ 다른 owner 의 락을 풀어버릴 수 있음
fun lock(key: String, ttlSec: Long): Boolean {
    return redis.opsForValue().setIfAbsent(key, "locked", Duration.ofSeconds(ttlSec)) ?: false
}

fun unlock(key: String) {
    redis.delete(key)        // 누가 잡은 건지 모르고 그냥 풀어버림
}
```

위험:

```
T0: A 가 lock(order:42, 5s) → OK, "locked"
T0~T6: A 가 GC pause 로 멈춤
T5: TTL 만료, lock 자동 풀림
T5.1: B 가 lock(order:42, 5s) → OK, "locked"
T6: A 가 깨어나 unlock → DEL → B 의 락이 풀림
T6.1: C 가 lock 획득 → A 와 B 가 동시에 critical section 가능
```

### 1.2 올바른 형태 (owner token)

```kotlin
fun lock(key: String, ttlSec: Long): String? {
    val token = UUID.randomUUID().toString()
    val ok = redis.opsForValue()
        .setIfAbsent(key, token, Duration.ofSeconds(ttlSec)) ?: false
    return if (ok) token else null
}

fun unlock(key: String, token: String): Boolean {
    val script = """
        if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
        else
            return 0
        end
    """.trimIndent()
    val result = redis.execute(
        DefaultRedisScript(script, Long::class.java),
        listOf(key),
        token,
    )
    return result == 1L
}
```

핵심:
- token 으로 **누가 잡았는지** 식별
- DEL 은 **GET ↔ DEL 을 atomic 묶어 Lua** 로
- token 안 맞으면 unlock 거부

## 2. 락 lifecycle 디테일

```
acquire:
  SET lock:order:42 <uuid> NX EX 5

renew (락 시간 연장):
  Lua:
    if GET lock:order:42 == ARGV[1] then PEXPIRE 5000

release:
  Lua:
    if GET lock:order:42 == ARGV[1] then DEL
```

renewal (lock extension) 은 Redisson 에서 자동 (watchdog) 으로 30초마다 갱신. 직접 구현 시 별도 스케줄러 필요.

## 3. Java/Kotlin 의 GC pause 문제

```
T0: A 가 lock(5s) → OK
T0~T6: STW GC 6s pause (아주 큰 heap 에선 가능)
T5: TTL 만료, 락 자동 해제
T5.1: B 가 lock(5s) → OK
T6: A 깨어남 → 자기가 락 가졌다고 믿고 critical section 진입
   → A 와 B 가 동시 진입 (mutual exclusion 깨짐)
```

owner token 검증으로 **release 단계의 clobber** 는 막지만 **A 가 락을 가졌다고 믿고 작업하는 동안 B 도 작업**하는 시간 ε 은 못 막는다.

해결 방법:
1. TTL 을 충분히 크게 (그러나 클수록 deadlock 길어짐)
2. **펜싱 토큰** — DB / 외부 시스템이 token 의 단조 증가를 검증 (13 파일)
3. lock 보유 동안 외부 system 에게 자기가 lock 가졌단 증거를 매번 제출 (e.g. Zookeeper ephemeral node)

## 4. SETNX 단일 키 → cluster mode

cluster 에선 한 키가 한 master. 그 master 가 죽고 replica 가 promote 되는 동안 **async replication 이라 lock 데이터가 전파 안 됐을 수 있다**:

```
T0: A → master M1 에 SET lock NX (M1 이 ack)
T1: M1 죽음, M2 (replica) 가 promote — lock 데이터 미전파
T2: B → 새 master M2 에 SET lock NX → 성공 (M2 엔 lock 없음)
   → A 와 B 동시 hold
```

→ **단일 master SETNX 는 master 장애 + async replication 시 mutual exclusion 깨짐**.

이걸 풀려고 antirez 가 제안한 게 RedLock — 5+ 독립 Redis 마스터에 락 시도 + 과반 성공 시 락 인정 (13 파일).

## 5. Lua atomic 의 중요성

owner token 검증 + DEL 을 별도 명령으로 하면 race:

```
GET lock:key → "my-token"
[ 다른 client 가 TTL 만료로 새 락 획득 ]
DEL lock:key → 새 owner 락 풀림
```

Lua script 안에서 `redis.call('GET') ... redis.call('DEL')` 은 단일 스레드라 atomic. 따라서 위 race 가 closed.

## 6. 락 관련 명령 정리

| 명령 | 목적 |
|---|---|
| `SET key val NX EX sec` | 락 획득 (atomic) |
| `SET key val XX EX sec` | 갱신 only (락 연장 시 — 그러나 owner 검증 안 함) |
| Lua + GET+DEL | release with owner check |
| Lua + GET+PEXPIRE | extend with owner check |
| `PERSIST key` | TTL 제거 (드물게) |

## 7. lock contention 측정

```
INFO commandstats
> cmdstat_set:calls=N,usec=...,usec_per_call=...
SLOWLOG GET 10
```

운영 hot spot 찾을 때 lock 키 prefix (`lock:*`) 별로 명령 호출 수와 평균 latency 모니터링.

## 8. 분산 락 사용처 가이드

| 케이스 | 분산 락 적절? |
|---|---|
| 동일 자원 동시 수정 (재고 차감) | ✓ — but **DB 의 SELECT FOR UPDATE 가 더 안전** (ACID) |
| 비용 큰 작업 dedup (cron, 동시 실행 1개) | ✓ |
| Cache stampede single-flight | ✓ (11 파일) |
| 결제 idempotent (결제 1회만) | △ — idempotency key + DB 가 본질적 답 |
| user account 잠금 / 인증 시도 | ✗ → 그냥 DB transaction |

핵심 원칙: **"분산 락은 mutual exclusion 의 보조 수단이지 정답이 아니다"**. ACID DB 의 transaction + SELECT FOR UPDATE / version 을 우선 고려.

## 9. msa 적용 (현재 분산 락 사용처)

grep 결과 (build/, ai-debugger 제외):

- `setIfAbsent` / `tryLock` / `RLock` / `RedissonClient` 사용 **없음**
- `inventory/InventoryCacheAdapter` 의 reserve-stock.lua 가 atomic 하게 재고 차감 (사실상 분산 락 효과)

→ 현재 msa 는 분산 락 직접 사용 안 함. Lua atomic 으로 대체. 이건 좋은 디자인 — **lock 보다 atomic 명령이 우선**이다.

> 향후 도입이 필요한 시나리오:
> - 동시에 같은 Job 을 여러 인스턴스가 실행하면 안 되는 batch
> - 동일 user 의 결제 동시 시도 dedup (DB idempotency 가 본질이지만 보조)
> - hot product 의 cache stampede 방어 (11 파일)

## 10. 권장 라이브러리 선택

직접 구현보다는 라이브러리 사용 권장:

- **Redisson** — Spring 통합 + RLock + watchdog renewal + RedLock 모두 지원. 추천.
- 직접 구현 — 학습용 또는 단순 케이스. owner token + Lua release 필수.
- Spring Integration `RedisLockRegistry` — 간단한 Spring 통합 lock, 단순 SETNX 기반.

Redisson 예:

```kotlin
val lock = redisson.getLock("order:42")
lock.lock(10, TimeUnit.SECONDS)        // ttl 10s, watchdog 자동
try {
    // critical section
} finally {
    lock.unlock()
}
```

watchdog 이 락 ttl 의 1/3 마다 자동 갱신하므로 critical section 이 길어도 안전.

## 11. 면접 포인트

- "분산 락 어떻게 구현?" → SET key val NX EX + Lua release with owner check.
- "왜 owner token 이 필요?" → 다른 client 의 락을 실수로 풀어버리지 않으려고.
- "왜 Lua?" → GET 후 DEL 사이 race 방지. atomic 보장.
- "단일 master SETNX 의 한계?" → master 장애 + async replication 시 mutual exclusion 깨짐.
- "GC pause 가 분산 락에 미치는 영향?" → STW 가 TTL 보다 길면 자기가 락 가졌다고 믿고 작업 → 다른 client 도 동시 진입 가능. 펜싱 토큰 필요.
- "DB transaction 이 더 안전?" → ACID + SELECT FOR UPDATE 면 mutual exclusion + persistence 보장. 분산 락은 보조.

## 12. 다음 파일 연결

단일 master SETNX 의 한계를 보완하려는 RedLock, 그리고 그 RedLock 도 실패하는 경우를 비판한 Martin Kleppmann 의 글, 그리고 진짜 답인 펜싱 토큰 — 13 에서.
