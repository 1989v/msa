---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 4
---

# 18 — msa Redis 개선 제안 종합

## 한줄 요약

10가지 개선 제안 (P0-P2). P0 5가지: **maxmemory 명시 / TTL jitter / Cache Stampede 방어 / hash tag 정책 / lazyfree 활성화**. P1 3가지: **분산 락 ADR / Stream 도입 검토 / Connection 모니터링**. P2 2가지: **read-from REPLICA_PREFERRED / Function 마이그레이션**.

## 1. 우선순위 매트릭스

| # | 제안 | 영향 | 노력 | 우선순위 | ADR 필요 |
|---|---|---|---|---|---|
| 1 | maxmemory + maxmemory-policy 명시 | 중 (OOM 방지) | 작음 | P0 | ✗ |
| 2 | analytics TTL ±10% jitter | 중 (expire spike 방지) | 작음 | P0 | ✗ |
| 3 | Cache Stampede 방어 (XFetch / lock) | 큼 (DB 부하 절감) | 중 | P0 | ✓ |
| 4 | Hash tag 컨벤션 (cluster multi-key) | 중 (CROSSSLOT 방지) | 중 | P0 | ✓ |
| 5 | lazyfree 옵션 활성화 | 작음 (latency 안정) | 작음 | P0 | ✗ |
| 6 | 분산 락 정책 ADR (Redisson + 펜싱) | 큼 (장차 도입 위해) | 중 | P1 | ✓ |
| 7 | Stream 도입 검토 (Notification fanout) | 작음 | 큼 | P1 | △ |
| 8 | Connection / latency 모니터링 강화 | 중 | 중 | P1 | ✗ |
| 9 | ReadFrom.REPLICA_PREFERRED | 작음 | 작음 | P2 | ✗ |
| 10 | Lua → Function 마이그레이션 | 작음 | 큼 | P2 | △ |

## 2. P0-1: maxmemory + policy 명시

### 현황

```yaml
# k8s/infra/local/redis/statefulset.yaml
args:
  - redis-server
  - --appendonly
  - "yes"
  - --save
  - "60 1"
resources:
  limits:
    memory: 256Mi
```

`maxmemory` 미설정 → Redis 가 256Mi 까지 무한 사용 → OOM-killed 가능.
`maxmemory-policy` 미설정 → default `noeviction` → write 거부.

### 개선

```yaml
args:
  - redis-server
  - --appendonly
  - "yes"
  - --save
  - "60 1"
  - --maxmemory
  - "200mb"            # limit 보다 작게 (jemalloc 오버헤드 + CoW 여유)
  - --maxmemory-policy
  - "allkeys-lfu"
  - --lazyfree-lazy-eviction
  - "yes"
  - --lazyfree-lazy-expire
  - "yes"
  - --lazyfree-lazy-server-del
  - "yes"
  - --lazyfree-lazy-user-del
  - "yes"
```

prod (Bitnami chart) 도 `commonConfiguration` 에 동일 명시:

```yaml
# k8s/infra/prod/redis/values.yaml
commonConfiguration: |-
  maxmemory 800mb
  maxmemory-policy allkeys-lfu
  lazyfree-lazy-eviction yes
  lazyfree-lazy-expire yes
  lazyfree-lazy-server-del yes
  lazyfree-lazy-user-del yes
  appendfsync everysec
  aof-use-rdb-preamble yes
```

## 3. P0-2: analytics TTL Jitter

### 현황

```kotlin
// analytics/app/.../ScoreCacheAdapter.kt
override fun cacheProductScore(score: ProductScore) {
    redis.opsForValue().set(
        "score:product:${score.productId}",
        objectMapper.writeValueAsString(score),
        Duration.ofSeconds(productTtl)            // 7200초 정확히
    )
}
```

대량 batch (Kafka Streams 윈도우) 으로 한꺼번에 적재 → 7200초 후 동시 만료 가능.

### 개선

```kotlin
private fun jittered(baseSec: Long, ratio: Double = 0.1): Duration {
    val jitter = (baseSec * ratio).toLong()
    val randomized = baseSec + Random.nextLong(-jitter, jitter)
    return Duration.ofSeconds(randomized)
}

override fun cacheProductScore(score: ProductScore) {
    redis.opsForValue().set(
        "score:product:${score.productId}",
        objectMapper.writeValueAsString(score),
        jittered(productTtl)            // 7200 ± 720초
    )
}
```

inventory / quant / gateway 도 동일 패턴 점검 필요.

## 4. P0-3: Cache Stampede 방어

### 적용 대상

- analytics `score:product:*` 의 hot product
- (예정) product 캐시 (도입 시)

### 권장 패턴 (분산 락 + 짧은 polling)

```kotlin
class StampedeGuardedCache(
    private val redis: StringRedisTemplate,
    private val mapper: ObjectMapper,
) {
    fun <T> getOrLoad(
        key: String,
        ttl: Duration,
        type: Class<T>,
        loader: () -> T,
    ): T {
        val cached = redis.opsForValue().get(key)
        if (cached != null) return mapper.readValue(cached, type)

        val lockKey = "lock:$key"
        val token = UUID.randomUUID().toString()
        val acquired = redis.opsForValue()
            .setIfAbsent(lockKey, token, Duration.ofSeconds(5)) ?: false

        return if (acquired) {
            try {
                redis.opsForValue().get(key)?.let { return mapper.readValue(it, type) }
                val value = loader()
                redis.opsForValue().set(key, mapper.writeValueAsString(value), ttl)
                value
            } finally {
                unlockSafely(lockKey, token)
            }
        } else {
            // poll
            repeat(20) {
                Thread.sleep(50)
                redis.opsForValue().get(key)?.let { return mapper.readValue(it, type) }
            }
            // fallback: 직접 조회 (DB 부하 일부 발생)
            loader()
        }
    }

    private fun unlockSafely(key: String, token: String) {
        val script = """
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('DEL', KEYS[1])
            else
                return 0
            end
        """.trimIndent()
        redis.execute(DefaultRedisScript(script, Long::class.java), listOf(key), token)
    }
}
```

### XFetch 옵션

`getWithMeta` 가 cache value + expires_at + compute_ms 를 hash 로 저장하면 더 우아 (11 파일 의사코드 참고). 코드 변경 폭 크니 P1 으로 분리.

### ADR

`docs/adr/ADR-NEW-cache-stampede-policy.md` 신설:
- 모든 read-heavy 캐시에 TTL jitter 의무
- hot key 정의 (top N, QPS 임계) 후 stampede 방어 적용
- single-flight 우선, XFetch 는 P1

## 5. P0-4: Hash tag 컨벤션 (Cluster multi-key)

### 현황

```kotlin
// analytics/ScoreCacheAdapter.kt
override fun getProductScores(productIds: List<Long>): List<ProductScore> {
    if (productIds.isEmpty()) return emptyList()
    val keys = productIds.map { "score:product:$it" }
    return redis.opsForValue().multiGet(keys) ?: emptyList()
}
```

cluster 환경에서 productId 가 다른 슬롯이면 `multiGet` 이 CROSSSLOT 에러. Spring Data Redis 는 자동 분리 해주지만 round trip 비용.

### 개선 (Hash tag)

```kotlin
private fun productScoreKey(id: Long) = "{score:product}:$id"
//                                       ^^^^^^^^^^^^^^^ hash tag → 모두 같은 슬롯

override fun cacheProductScore(score: ProductScore) {
    redis.opsForValue().set(productScoreKey(score.productId), ...)
}

override fun getProductScores(productIds: List<Long>): List<ProductScore> {
    val keys = productIds.map { productScoreKey(it) }
    return redis.opsForValue().multiGet(keys) ?: emptyList()
}
```

### 함정

- 같은 hash tag 의 모든 데이터가 한 master 에 몰림 (hot shard 위험).
- product 가 1억 개면 한 master 에 1억 키. 메모리 분산이 아예 안 됨.

→ 트레이드오프 결정 필요:
- multi-key 비도가 높음 + 키 수 적음 → hash tag OK
- 키 수 많음 → multi-key 안 쓰고 개별 GET (network RTT 추가) 또는 service-side 묶음 캐시

### ADR

`docs/adr/ADR-NEW-redis-hash-tag-convention.md`:
- Hash tag 사용 정책 (서비스별 결정)
- multi-key 명령 검토 list
- hot shard 모니터링 룰 (master 별 메모리 / QPS)

## 6. P0-5: Lazy free 옵션 활성화

(P0-1 에 포함)

big key 운영을 직접 안 해도 `lazyfree-lazy-*` 옵션은 거의 항상 yes 가 정답. CPU 약간 (background thread) + latency 안정성 ↑.

## 7. P1-1: 분산 락 정책 ADR

### 현황

분산 락 미사용. 향후 도입 가능성 (결제 idempotent, batch single-execution).

### 결정 트리 (ADR 초안)

```
1. mutual exclusion 이 correctness 인가?
   YES → ZooKeeper / Etcd 또는 DB SELECT FOR UPDATE
   NO  → Redisson RLock (단일 master, watchdog)
2. 외부 storage (S3, 외부 DB) 에 write 하는 락인가?
   YES → 펜싱 token 추가 (storage 가 단조 검증)
3. RedLock 사용?
   기본 NO. 운영 부담 대비 이득 작음.
```

### 라이브러리

- 추가: `redisson-spring-boot-starter`
- 결정: 단일 master 의 `getLock`, RedLock 미사용

### 코드 템플릿

```kotlin
@Component
class DistributedLock(private val redisson: RedissonClient) {
    fun <T> withLock(
        name: String,
        ttl: Duration = Duration.ofSeconds(10),
        wait: Duration = Duration.ofSeconds(2),
        block: () -> T,
    ): T? {
        val lock = redisson.getLock(name)
        return if (lock.tryLock(wait.toMillis(), ttl.toMillis(), TimeUnit.MILLISECONDS)) {
            try {
                block()
            } finally {
                if (lock.isHeldByCurrentThread) lock.unlock()
            }
        } else null
    }
}
```

## 8. P1-2: Stream 도입 검토

### 적용 후보

- WebSocket / SSE fanout (현재 미구현) — Stream 의 영속성 + ack 가 Pub/Sub 보다 안전
- Cache invalidation 신호 (cross-service) — Kafka 가 무겁다면 Stream 가벼움

### 비추천 후보

- 도메인 이벤트 발행 — Kafka 가 표준 (msa 컨벤션)
- Saga / DLQ — Kafka 가 더 안정

### 결정

P1 — 실제 use case 발생 시 ADR 작성 후 도입. **무리하게 미리 도입 X**.

## 9. P1-3: Connection / Latency 모니터링 강화

### 현황

prod 의 Bitnami chart 가 Prometheus exporter + ServiceMonitor enable. 그러나 다음 메트릭이 noisy 또는 missing:

- `mem_fragmentation_ratio` 추세
- `latest_fork_usec` (BGSAVE 시점)
- `evicted_keys` 증가율
- `slowlog` 카운트 / latency

### 개선

```yaml
# Grafana dashboard 권장 패널
- Used memory vs RSS (fragmentation)
- evicted_keys per minute
- Total commands processed
- Cluster topology stability (master_link_status)
- Latest fork µs (BGSAVE)
- Slow command count
- p99 latency (slowlog 기반)
```

알람 룰:
- mem_fragmentation_ratio > 1.5 (10분 sustained)
- evicted_keys 증가율 > 100/s
- master_link_status != "up" (cluster)
- latest_fork_usec > 100000 (100ms)

## 10. P2-1: ReadFrom.REPLICA_PREFERRED

### 현황

```kotlin
val lettuceClientConfig = LettuceClientConfiguration.builder()
    .clientOptions(clientOptions)
    .commandTimeout(Duration.ofSeconds(2))
    .build()
```

`readFrom` 미설정 → default `MASTER`. cluster 에서 master 만 read.

### 개선

```kotlin
.readFrom(ReadFrom.REPLICA_PREFERRED)        // 또는 ANY_REPLICA
```

장점:
- master read 부하 분산
- replica 의 자원 활용

함정:
- replication lag 만큼 stale read (eventual consistency)
- write-after-read 패턴에선 사용자가 자기 write 를 못 봄 (sticky 필요)

→ msa 의 캐시 use case 는 대부분 lag OK → 적용 가능. session/stateful read 는 master.

## 11. P2-2: Lua → Function 마이그레이션

### 현황

- `quant/lua/token_bucket.lua` (DefaultRedisScript)
- `inventory/scripts/*.lua` (DefaultRedisScript)

EVAL/EVALSHA 기반. Redis 7+ 의 `Function` 으로 가면:
- 명시적 라이브러리 등록 (`FUNCTION LOAD`)
- replication 시 함수 통째로 전파 (Lua effects replication 보다 안전)
- `FUNCTION LIST` 등 운영 가시성

### 비용

- Spring Data Redis 가 `FCALL` 직접 지원 안 함 (Lettuce 직접 호출 필요)
- 마이그레이션 코드 중간 abstraction 필요

→ P2. 현재 Lua 로 잘 동작 중이라 ROI 낮음.

## 12. 적용 순서 권장

### Sprint 1 (P0)

1. P0-1: maxmemory + lazyfree 명시 (StatefulSet args 수정 + Bitnami values)
2. P0-2: TTL jitter 헬퍼 함수 + analytics 적용
3. P0-5: lazyfree (P0-1 에 포함)

### Sprint 2 (P0)

4. P0-3: StampedeGuardedCache 클래스 추가 + ADR
5. P0-4: hash tag 컨벤션 ADR + analytics 적용

### Sprint 3 (P1)

6. P1-1: 분산 락 ADR (Redisson 도입 결정 / 미도입 결정 명시)
7. P1-3: 모니터링 dashboard + 알람 룰

### Backlog (P2)

8. P1-2: Stream — use case 발생 시
9. P2-1: ReadFrom.REPLICA_PREFERRED — 결정 후 옵션 추가
10. P2-2: Function — 후속 메이저 업그레이드 시

## 13. 신규 ADR 후보

| ADR | 제목 | 트리거 | 우선 |
|---|---|---|---|
| ADR-NEW-cache-stampede-policy | Cache Stampede 방어 정책 | P0-3 | P0 |
| ADR-NEW-redis-hash-tag-convention | Cluster Hash Tag 컨벤션 | P0-4 | P0 |
| ADR-NEW-distributed-lock-policy | 분산 락 정책 (Redisson + 펜싱) | P1-1 | P1 |

기존 ADR 보강:
- ADR-0015 (Resilience): Cache Stampede / 분산 락 절차 추가
- ADR-0019 (K8s migration): Redis 운영 옵션 (maxmemory, lazyfree) 명시

## 14. 측정 지표

각 개선이 잘 됐는지 KPI:

| 개선 | KPI |
|---|---|
| maxmemory 명시 | OOMKilled 0건 / 30일 |
| TTL jitter | "expire spike" latency p99 ms 단위 spike 0건 |
| Stampede 방어 | DB connection pool exhaustion alert 0건 |
| Hash tag | CROSSSLOT 에러 0건 (prod cluster) |
| lazyfree | DEL latency p99 < 1ms |
| 분산 락 ADR | (적용 시) deadlock / lost update 0건 |
| 모니터링 | mem_fragmentation_ratio < 1.5 평균 |

## 15. 요약 표

| 카테고리 | 즉시 적용 (코드/설정) | ADR 신설 |
|---|---|---|
| 인프라 | maxmemory, lazyfree | — |
| 캐시 패턴 | TTL jitter | Stampede policy |
| Cluster 호환 | hash tag (analytics) | Hash tag convention |
| 분산 락 | (도입 시) Redisson 라이브러리 | Distributed lock policy |
| 모니터링 | dashboard, 알람 | — |
| 미래 | Stream / Function | (use case 발생 시) |

## 16. 다음 파일 연결

19 면접 Q&A 카드 — 이 학습 노트 전체를 면접 시점에 1주일 단위로 회독할 수 있도록 50문항 + 오답 체크 정리.
