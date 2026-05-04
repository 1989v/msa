---
parent: 7-distributed-systems
type: deep
order: 13
created: 2026-05-01
---

# 13. 분산 락 — Redis SETNX / Redisson RedLock / ZooKeeper / Fencing Token

> "Redis SETNX 로 분산 락" 은 90% 의 경우 충분하지만, **Martin Kleppmann vs Antirez 의 RedLock 논쟁** 이 보여주듯 **fencing token 없이는 안전하지 않다**.

## 1. 분산 락이 필요한 시나리오

| 시나리오 | 설명 |
|---|---|
| 분산 cron / leader election | 같은 작업이 여러 인스턴스에서 동시 실행되면 안 됨 |
| Critical section over distributed resource | 같은 자원에 대한 변경 직렬화 |
| 중복 요청 차단 (Idempotency 보조) | 같은 사용자의 동시 결제 차단 |
| Cache stampede 방어 | 캐시 만료 시 한 인스턴스만 갱신, 나머지는 대기 |

## 2. Redis SETNX 분산 락

### 2.1 단순 구현

```kotlin
fun acquireLock(key: String, ttl: Duration): String? {
    val token = UUID.randomUUID().toString()
    val ok = redis.opsForValue().setIfAbsent(key, token, ttl)
    return if (ok == true) token else null
}

fun releaseLock(key: String, token: String) {
    // 단순 DEL 은 위험 — 다른 holder 의 락을 풀 수 있음
    val script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    """.trimIndent()
    redis.execute(DefaultRedisScript(script, Long::class.java), listOf(key), token)
}
```

### 2.2 핵심 규칙

1. **TTL 필수** — holder 가 죽어도 락은 풀려야 함
2. **token 기반 release** — 자기 락만 풀 수 있게
3. **Lua 로 atomic release** — GET → 비교 → DEL 사이에 다른 holder 가 끼어들지 못하게

### 2.3 한계

- TTL 동안에 holder 가 GC (Garbage Collection, 가비지 컬렉션) pause / 네트워크 단절로 멈췄다가 재개하면, **이미 락이 만료** 됐는데 holder 는 자기가 가졌다고 착각 → critical section 이 두 holder 에서 동시 실행 (lost lock!)

## 3. Redisson RedLock (Antirez 제안)

여러 Redis master (홀수, 보통 5) 에 동시 락 시도, **majority** 가 성공하면 락 획득.

```
client → SET on redis1 ✓
client → SET on redis2 ✓
client → SET on redis3 ✓
client → SET on redis4 ✗ (timeout)
client → SET on redis5 ✓
→ majority (3 이상) 성공 → 락 획득
```

### 의도

- 단일 Redis 장애 (failover 중 데이터 손실 등) 에 강건
- master-replica 비동기 복제 시점에 락이 사라지는 문제 방어

### Martin Kleppmann 의 비판 (2016)

> "RedLock 은 안전하지 않다 — fencing token 없이는 어떤 lease-based 락도 안전할 수 없다"

요지:
1. **Clock drift** — Redis 노드 간 시계 어긋나면 TTL 계산이 부정확
2. **GC pause** — holder 가 lock 획득 후 GC 로 멈췄다가 깨면 이미 다른 holder 가 락 가짐. holder 는 이걸 모름
3. **Network partition** — partition 한쪽이 락 가졌는데 다른 쪽 majority 도 받을 수 있음 (시간차)

→ **결론**: RedLock 으로도 부족. **Fencing Token** 으로 자원 측에서 중복 락 거부 필요.

### Antirez 의 반박 (2016)

요지:
- Kleppmann 의 비판은 "어떤 시스템도 절대 안전 아님" 의 일반론
- 실용적으론 RedLock 이 단일 Redis 보다 안전
- fencing token 은 자원이 지원해야만 가능 (모든 자원이 지원하진 않음)

→ **현실**: 강한 정합성이 필요한 락은 **ZooKeeper / etcd** (Raft 기반), 아니면 RedLock + 자원 측 fencing.

## 4. Fencing Token

```
client A: lock acquire → token = 33 (단조 증가)
client A: GC pause 로 멈춤
TTL 만료
client B: lock acquire → token = 34
client A: 깨어나서 자원에 write(value, token=33) 시도
자원: "이미 token=34 봤음. 33은 stale → 거부"
```

자원이 **마지막 token 을 기억** + write 시 token 비교 → 안전.

### 자원 측 구현 예시

```kotlin
// 자원 (e.g., 파일 시스템, DB)
class FencedStorage {
    private var lastSeenToken = AtomicLong(0)

    fun write(value: String, token: Long): Boolean {
        while (true) {
            val current = lastSeenToken.get()
            if (token < current) return false  // stale lock
            if (lastSeenToken.compareAndSet(current, token)) {
                actuallyWrite(value)
                return true
            }
        }
    }
}
```

## 5. ZooKeeper / etcd 기반 분산 락

### 5.1 ZooKeeper Recipe

```
1. /locks/myresource 아래에 ephemeral sequential znode 생성: /locks/myresource/lock-00000007
2. /locks/myresource 의 자식들 중 자기보다 작은 sequence 가 있는지 확인
3. 없으면 락 획득
4. 있으면 그 노드에 watch 걸고 대기 (event 받으면 다시 검사)
5. 작업 끝나면 자기 znode 삭제 (또는 세션 종료 시 자동 삭제)
```

특징:
- **Sequence number 가 fencing token** 으로 사용 가능
- ZK 가 Raft 변형 (ZAB) 기반이라 강한 정합성
- 단점: ZK 운영 부담

### 5.2 etcd Lease + Compare-And-Swap

```
1. Lease 생성 (TTL 30s)
2. PUT /lock with lease, if-not-exists
3. KeepAlive 로 lease 갱신
4. CompareAndSwap 으로 변경 시 revision 비교 (사실상 fencing)
```

→ K8s leader election 의 표준 패턴.

## 6. msa 프로젝트의 분산 락 현황

### 6.1 명시적 분산 락 사용처 — 거의 없음

msa 는 분산 락을 **거의 사용하지 않음**. 대신:

| 패턴 | 사용처 |
|---|---|
| Optimistic Lock (`@Version`) | inventory.InventoryJpaEntity (재고 동시 변경) |
| DB UNIQUE | reservation, processed_event |
| Outbox + idempotent consumer | 이벤트 처리 직렬화 |
| Kafka partition + key | 같은 aggregate 의 이벤트 순서 보장 |

→ **분산 락을 피하는 설계** 가 대부분. 정확한 선택.

### 6.2 분산 락이 필요할 만한 곳

| 상황 | 현재 처리 | 분산 락 도입 시 |
|---|---|---|
| Outbox polling 다중 인스턴스 | DB row-level lock + status 업데이트 | Redis lock 으로 1 인스턴스만 publish |
| ReservationExpiry 스케줄러 다중 | 모든 인스턴스가 돌고 DB tx 로 race | leader election + 1개만 실행 |
| Reconciliation 배치 다중 | 위와 동일 | 위와 동일 |

→ K8s Deployment 의 replica 가 1 이면 자연 해결. replica > 1 이면 분산 락 또는 leader election 필요.

## 7. Redisson 사용 예시 (가상 도입)

```kotlin
implementation("org.redisson:redisson-spring-boot-starter:3.27.x")
```

```yaml
spring:
  redis:
    redisson:
      file: classpath:redisson.yml
```

```kotlin
@Component
class OutboxPublishingScheduler(
    private val redisson: RedissonClient,
    private val outboxRepository: OutboxRepository,
    private val kafkaTemplate: KafkaTemplate<String, String>,
) {
    @Scheduled(fixedDelay = 1000)
    fun publish() {
        val lock = redisson.getLock("outbox-publisher-lock")
        if (!lock.tryLock(0, 30, TimeUnit.SECONDS)) return  // 다른 인스턴스가 가짐

        try {
            outboxRepository.findPending().forEach { event ->
                kafkaTemplate.send(...)
                outboxRepository.markPublished(event.id)
            }
        } finally {
            if (lock.isHeldByCurrentThread) lock.unlock()
        }
    }
}
```

`tryLock(0, 30, ...)`: 0초만 대기 (즉시 양보), TTL 30초.

## 8. Spring Integration LockRegistry

`spring-integration-redis` 가 `LockRegistry` 추상화 제공:

```kotlin
@Bean
fun redisLockRegistry(redisConnectionFactory: RedisConnectionFactory): LockRegistry =
    RedisLockRegistry(redisConnectionFactory, "msa-locks")

// 사용
val lock = lockRegistry.obtain("inventory-reconcile")
if (lock.tryLock()) {
    try { reconcile() } finally { lock.unlock() }
}
```

장점: 표준 `java.util.concurrent.locks.Lock` 인터페이스 → 코드 친화.
단점: 단일 Redis 의존, RedLock 같은 다중 master 미지원.

## 9. 분산 락 설계 원칙

1. **TTL 필수** — holder 죽어도 풀림
2. **토큰 기반** — 자기 락만 풀기
3. **자원이 fencing 지원하면** 사용
4. **짧게 잡고 빨리 풀기** — long-running 작업엔 부적합
5. **try-with-resource** 로 누수 방지
6. **장애 대비** — 락 획득 실패가 정상 흐름의 일부

## 10. 안티패턴

### 10.1 락 안에서 외부 호출

```kotlin
lock.tryLock()
try {
    externalApi.call()  // ← 5초 걸리면 TTL 만료 위험
} finally {
    lock.unlock()
}
```

→ 락 획득 / 해제는 짧게, 외부 호출은 락 밖으로.

### 10.2 단일 Redis + critical 자원

```kotlin
// 결제 처리 같은 critical 한 곳에 단일 Redis 락만으로 보호
lock.tryLock("payment:$userId", ...)
charge(userId, amount)  // ← Redis 장애 / failover 시 두 번 결제 위험
```

→ critical 한 곳은 **DB UNIQUE constraint** + Idempotency-Key 로 자연 멱등 보장.

### 10.3 락 획득 후 영원히 보유

```kotlin
val lock = redisson.getLock("X")
lock.lock()  // ← TTL 무한, holder 죽으면 영원히 멈춤
```

→ 항상 `tryLock(timeout, leaseTime)` 형태로.

## 11. 면접 5문답

### Q1. "Redis SETNX 분산 락의 한계는?"

> "(1) GC pause 로 holder 가 멈췄다 깨면 이미 TTL 만료 → 다른 holder 가 락 잡고 동시에 critical section 진입 가능. (2) 단일 Redis failover 시 비동기 복제로 락이 사라질 수 있음. → fencing token 또는 자원 측 멱등 보장 필요."

### Q2. "RedLock 의 장단점?"

> "여러 Redis master majority 로 단일 Redis 장애에 강건. 단점: clock drift / GC pause 로 여전히 안전 보장 못 함 (Kleppmann 의 비판). 강한 정합성 필요한 곳은 ZooKeeper/etcd."

### Q3. "Fencing Token 이 뭔가요?"

> "락 획득 시 단조 증가 token 발급 → 자원에 write 시 token 같이 보내고, 자원이 마지막 token 보다 작으면 거부. holder 가 stale 락으로 자원 변경 못 하게."

### Q4. "msa 는 분산 락을 어떻게 쓰나요?"

> "거의 안 씁니다. (1) 동시 재고 변경은 Optimistic Lock (`@Version`), (2) 중복 메시지는 processed_event UNIQUE, (3) 같은 aggregate 순서는 Kafka partition key. 분산 락 대신 멱등 + 자연키 unique 로 설계."

### Q5. "분산 cron 을 1개만 돌리려면?"

> "옵션 (1) K8s Deployment replica = 1, (2) Redisson lock + tryLock(0, TTL), (3) ZooKeeper leader election (Curator). msa 는 (1) 이 단순. 다중 인스턴스 필요 시 (2)."

## 12. 한 줄 요약

> 분산 락은 **마지막 수단**. 가능하면 **Optimistic Lock + 자연키 unique + Kafka partition key + 멱등성** 으로 회피.
> 꼭 써야 하면 **fencing token + 자원 측 검사** 까지 가야 안전.
