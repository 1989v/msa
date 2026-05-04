---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 4
---

# 17 — msa 코드베이스 적용 점검

## 한줄 요약

msa 의 Redis 사용은 (a) **gateway 의 인증 블랙리스트 + RateLimiter (Spring Cloud Gateway 의 Redis 기반)** + experiment / visitor 캐시, (b) **common 의 cluster auto-config**, (c) **analytics / inventory / quant 의 캐시 + Lua atomic**, (d) **5개 서비스의 cluster ↔ standalone overlay 전환**. 분산 락 / Stream / Sentinel 은 미사용. 직접 Lua atomic 으로 단순한 mutual exclusion 이 충분히 커버된 디자인.

## 1. 전체 사용처 매핑

```
┌─────────────────────────────────────────────────────────────┐
│ gateway (Spring WebFlux, port 8080)                          │
│ ├─ AuthenticationGatewayFilter                               │
│ │  └─ ReactiveRedisTemplate.hasKey("blacklist:$token")       │
│ │     • Fail-Open 정책 (Redis 장애 시 통과)                   │
│ ├─ ExperimentAssignmentFilter (GlobalFilter, order=-5)       │
│ │  └─ ReactiveStringRedisTemplate.get("experiment:active-list") │
│ ├─ VisitorIdFilter                                           │
│ │  └─ visitor 식별 캐시                                       │
│ └─ RedisRateLimiter (Spring Cloud Gateway 내장)              │
│    └─ Token Bucket Lua (replenishRate=100, burst=200)        │
├─────────────────────────────────────────────────────────────┤
│ common (auto-config)                                         │
│ └─ CommonRedisAutoConfiguration                              │
│    ├─ LettuceConnectionFactory (cluster 모드)                 │
│    ├─ ClusterTopologyRefreshOptions                          │
│    │  • enablePeriodicRefresh(10min)                         │
│    │  • enableAllAdaptiveRefreshTriggers()                   │
│    └─ RedisTemplate<String, Any>                             │
│       (Jackson JSON serializer)                              │
├─────────────────────────────────────────────────────────────┤
│ analytics:app                                                 │
│ └─ ScoreCacheAdapter (StringRedisTemplate)                   │
│    ├─ score:product:{id}  (TTL 7200s)                        │
│    ├─ score:keyword:{kw}  (TTL 7200s)                        │
│    └─ score:product:stats / keyword:stats (TTL 3600s)        │
├─────────────────────────────────────────────────────────────┤
│ inventory:app                                                 │
│ ├─ InventoryCacheAdapter (StringRedisTemplate)               │
│ │  ├─ inventory:{productId}:{warehouseId} (Hash)             │
│ │  └─ Lua: reserve / release / confirm / receive             │
│ └─ AdmissionControlFilter (servlet)                          │
│    └─ INCR/DECR inventory:active-reservations (max 1000)     │
├─────────────────────────────────────────────────────────────┤
│ quant:app                                              │
│ └─ RedisTokenBucketRateLimiter (StringRedisTemplate)         │
│    └─ Lua: token_bucket.lua                                  │
│       • ratelimit:{exchange}:{tenantId}:{apiKeyHash}         │
│       • bithumb=90/s, default=100/s                          │
├─────────────────────────────────────────────────────────────┤
│ experiment / gifticon / product (검증 완료: application-      │
│   kubernetes.yml 에 spring.data.redis 설정 명시)              │
│ └─ application-kubernetes.yml 에 cluster.nodes 명시           │
│    → k3s-lite overlay 에서 standalone 으로 전환됨              │
└─────────────────────────────────────────────────────────────┘
```

## 2. CommonRedisAutoConfiguration 분석

```kotlin
// common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt
@AutoConfiguration(afterName = ["...DataRedisAutoConfiguration"])
@ConditionalOnClass(RedisTemplate::class)
@ConditionalOnProperty(prefix = "kgd.common.redis", name = ["enabled"], havingValue = "true")
@ConditionalOnProperty(prefix = "spring.data.redis.cluster", name = ["nodes"])
class CommonRedisAutoConfiguration {
    @Bean
    fun lettuceConnectionFactory(
        clusterConfiguration: RedisClusterConfiguration
    ): LettuceConnectionFactory {
        val topologyRefreshOptions = ClusterTopologyRefreshOptions.builder()
            .enablePeriodicRefresh(Duration.ofMinutes(10))
            .enableAllAdaptiveRefreshTriggers()
            .build()
        val clientOptions = ClusterClientOptions.builder()
            .topologyRefreshOptions(topologyRefreshOptions)
            .build()
        val lettuceClientConfig = LettuceClientConfiguration.builder()
            .clientOptions(clientOptions)
            .commandTimeout(Duration.ofSeconds(2))
            .build()
        return LettuceConnectionFactory(clusterConfiguration, lettuceClientConfig)
    }
    ...
}
```

### 좋은 점

1. **`enableAllAdaptiveRefreshTriggers()`** — MOVED/ASK redirect 시 즉시 토폴로지 갱신. (09 cluster 파일 참고). Lettuce default 는 off 라 명시 필수.
2. **`enablePeriodicRefresh(10min)`** — failover/replica promote 같은 변화를 catch.
3. **`commandTimeout(2s)`** — 무한 대기 방지. 단, 2초는 P99 (99th Percentile, 가장 느린 1%) SLA 를 고려하면 좀 길 수 있음 (외부 IO 의 timeout 으로 자주 박힘).
4. **`@ConditionalOnProperty cluster.nodes`** — cluster 설정이 있을 때만 활성. standalone 환경에서 자동 비활성.

### 개선 여지

1. **read-from 전략 명시 안 됨** — default `MASTER` 라 read 도 master 로. cluster 의 replica 부하 활용을 못 함. `ReadFrom.REPLICA_PREFERRED` 권장 (eventual consistency 허용 시).
2. **연결 풀 설정 없음** — Spring Boot 는 Lettuce 의 GenericObjectPool 옵션을 `spring.data.redis.lettuce.pool.*` 로 노출하지만, Lettuce 의 reactive/async 모델은 connection multiplexing 이라 풀이 거의 의미 없음 (15 Connection Pool 학습 노트 참고).
3. **commandTimeout** 와 별도로 **socket timeout / connect timeout** 명시 권장.

## 3. Cluster ↔ Standalone Overlay 전환 (5 services)

```yaml
# k8s/overlays/k3s-lite/patches/redis-standalone-product.yaml
env:
  - name: SPRING_APPLICATION_JSON
    value: '{"spring":{"data":{"redis":{"cluster":null,"host":"redis","port":6379}}}}'
```

### 동작 원리

- Spring Boot 의 property source 우선순위: `SPRING_APPLICATION_JSON` env > `application-{profile}.yml` > `application.yml`
- 따라서 production 의 `cluster.nodes` 를 null 로 override + standalone host 명시
- **`@ConditionalOnProperty cluster.nodes`** 가 false → CommonRedisAutoConfiguration 비활성 → Spring Boot 기본 standalone 모드로 fallback

### 5 services

| 서비스 | application-kubernetes.yml | k3s-lite overlay |
|---|---|---|
| gateway | cluster.nodes (6노드) | standalone redis:6379 |
| product | cluster.nodes | standalone |
| gifticon | cluster.nodes | standalone |
| analytics | cluster.nodes | standalone |
| experiment | cluster.nodes | standalone |

### 함정

- standalone 모드는 cluster 의 `Lettuce ClusterTopologyRefresh` 가 동작 안 함 → 단순 connection.
- production 가정인 multi-key Lua / hash tag 명령이 작동 (single node 라 슬롯 제약 없음). 따라서 prod 이행 시 cluster 환경에서 multi-key 명령이 깨질 수 있음 — 코드 이행 검증 필요.

## 4. gateway Token Bucket (Spring Cloud Gateway 내장)

```kotlin
// gateway/src/main/kotlin/com/kgd/gateway/config/RateLimiterConfig.kt
@Bean
fun redisRateLimiter(): RedisRateLimiter =
    RedisRateLimiter(100, 200, 1)
//                  rep  burst tok
```

내부 동작:

- Spring Cloud Gateway 의 `RedisRateLimiter` 가 **Lua script 기반 Token Bucket** 사용
- script: `META-INF/scripts/request_rate_limiter.lua` (spring-cloud-gateway-server-mvc / -webflux 의 jar 안)
- key: `request_rate_limiter.{<resolvedKey>}.tokens` / `.timestamp`
- atomic: GET/SET 을 Lua 안에서 한꺼번에

### KeyResolver

```kotlin
@Bean
@Primary
fun userKeyResolver(): KeyResolver = KeyResolver { exchange ->
    Mono.just(
        exchange.request.headers.getFirst("X-User-Id")
            ?: exchange.request.remoteAddress?.address?.hostAddress
            ?: "unknown"
    )
}
```

X-User-Id 가 있으면 사용자 단위, 없으면 IP. Flash Sale 시 limit 변경하려면 환경변수 변경 + 재시작 필요 (현재 코드는 hardcoded).

### 개선 여지

- **headerName 동적 조정** (정상 → flash sale 모드 전환 시 limit 조정)
- IP fallback 은 corporate NAT 같은 경우 한 IP 에 수많은 사용자 = 부정 throttle. user-id 강제 또는 IP+UA 조합.

## 5. quant RedisTokenBucketRateLimiter (직접 구현)

```kotlin
// quant/app/src/main/kotlin/com/kgd/quant/infrastructure/resilience/RedisTokenBucketRateLimiter.kt
class RedisTokenBucketRateLimiter(
    private val redisTemplate: StringRedisTemplate,
    @Value("...") private val bithumbBucketSize: Int,
    ...
) {
    fun tryConsume(...): RateLimitResult {
        val key = "ratelimit:$exchange:$tenantId:$apiKeyHash"
        ...
        val raw = redisTemplate.execute(redisScript, listOf(key), ...)
        return parseResult(raw, fallbackBucketSize = bucketSize)
    }
}
```

### 좋은 점

1. **외부 거래소 API rate limit 보호** — 빗썸 150/s 한도의 60% 만 사용 (90/s) 으로 보수적.
2. **Lua atomic** → multi-instance 합산 한도 보장.
3. **API key 평문 미노출** — SHA-256 hash 만 키에 사용.
4. **`@ConditionalOnProperty enabled=true`** — 백테스트 모드에서 비활성.

### Lua 분석

(15 파일에서 인용)

핵심: HMGET/HMSET 이 atomic 묶음, EXPIRE 3600s 로 idle bucket 회수. **이게 분산 락 없이 mutual exclusion 효과를 내는 모범 사례**.

## 6. analytics ScoreCacheAdapter

```kotlin
override fun cacheProductScore(score: ProductScore) {
    redis.opsForValue().set(
        "score:product:${score.productId}",
        objectMapper.writeValueAsString(score),
        Duration.ofSeconds(productTtl)         // 7200초
    )
}
```

### 문제점 (improvements 후보)

1. **TTL jitter 없음** — 7200초 후 동시 만료 가능.
2. **stampede 방어 없음** — 동시 만료 + 동시 read 폭주 시 ClickHouse / Kafka Streams 에 부하.
3. **개별 키 직렬화** — JSON 한 번 파싱은 µs 단위지만 100k req/s 면 누적.
4. **multiGet 위치** — `getProductScores(productIds: List<Long>)` 는 cluster 에서 모든 productId 가 동일 슬롯이어야 동작. hash tag (`{score:product}:42` 형태) 권장.

## 7. inventory InventoryCacheAdapter (Lua atomic)

```kotlin
override fun reserveStock(productId: Long, warehouseId: Long, qty: Int): Int? {
    val result = redisTemplate.execute(reserveScript, listOf(key(productId, warehouseId)), qty.toString())
    return result?.toLongOrNull()?.takeIf { it >= 0 }?.toInt()
}
```

```lua
-- inventory/app/src/main/resources/scripts/reserve-stock.lua
local key = KEYS[1]
local qty = tonumber(ARGV[1])

local available = tonumber(redis.call('HGET', key, 'availableQty') or 0)
if available < qty then
    return -1
end

redis.call('HINCRBY', key, 'availableQty', -qty)
redis.call('HINCRBY', key, 'reservedQty', qty)
...
```

### 좋은 점

- Lua atomic 으로 **재고 차감의 race condition 차단**. 분산 락 없이 mutual exclusion.
- HINCRBY 가 atomic.

### 함정

- **Redis 가 SSOT 가 아니어야** — 메모리 인스턴스라 영속성이 약함. RDB+AOF 가 있어도 fork 직전 변경분은 손실 가능.
- `availableQty` 가 음수가 되면 안 되는 비즈니스 룰을 Lua 에 넣어 무결성 보장 (잘 됨).
- DB 와의 동기화 정책이 명시 안 됨 — 현재 코드만 보면 Redis 만 갱신 → DB 미반영 위험. (실제 코드는 다른 곳에서 outbox 등으로 DB 까지 처리할 가능성 있음, 별도 학습 토픽).

## 8. AdmissionControlFilter (concurrent reservation cap)

```kotlin
val current = redisTemplate.opsForValue().increment(ACTIVE_RESERVATIONS_KEY) ?: 0
try {
    if (current > maxConcurrentReservations) { ...429 응답... }
    filterChain.doFilter(request, response)
} finally {
    decrementSafely()
}
```

### 좋은 점

- INCR/DECR atomic. cluster 에서도 한 슬롯이라 안전.
- **Fail-Open**: Redis null 이면 통과 (운영 위험 < 가용성 우선).
- 응답 후 finally 에서 DECR.

### 함정

- 인스턴스가 크래시하면 DECR 안 되어 카운터 leak. TTL 없음. → idle 시 INCR 가 max 까지 도달하지 못해야 안전.
- 더 안전한 모델: 시간 윈도우 기반 (Token Bucket / Sliding Window) → 카운터 leak 영향 없음.

## 9. 분산 락 / Stream / Sentinel — 미사용

- 분산 락: 코드 grep 결과 0 (12 파일 참고). 대신 Lua atomic 으로 mutual exclusion 해결. 잘 디자인됨.
- Stream: 0. 메시지 인프라는 Kafka.
- Sentinel: 0. cluster 모드 또는 standalone 단일 노드.

→ 면접 시 "분산 락 안 쓰는 디자인이 좋은가?" 질문에 **Lua atomic + ACID DB 가 본질적 답이고, 분산 락은 efficiency 보조 수단** 이라는 답변 (12, 13 파일).

## 10. K8s 에서의 Redis 운영

| 환경 | 모드 | 노드 | 영속화 |
|---|---|---|---|
| local (k3s-lite) | standalone | 1 (StatefulSet) | AOF + RDB save 60 1 |
| prod (managed K8s) | cluster (Bitnami) | 6 (3 master + 3 replica) | AOF (Bitnami chart 기본) |

### Prod 의 Bitnami chart

```yaml
# k8s/infra/prod/redis/values.yaml
cluster:
  nodes: 6
  replicas: 1
persistence:
  enabled: true
  size: 4Gi
resources:
  requests:
    cpu: 100m
    memory: 512Mi
  limits:
    memory: 1Gi
metrics:
  enabled: true
```

좋은 점: ServiceMonitor + Prometheus exporter. 운영 가시성 OK.

개선 여지: `maxmemory` / `maxmemory-policy` 명시 안 됨 (Bitnami default 에 의존). 명시 권장.

## 11. 현재 디자인의 강약점 종합

| 강점 | 약점 |
|---|---|
| Lua atomic 으로 mutual exclusion 깔끔 처리 | TTL jitter / Stampede 방어 미적용 |
| ClusterTopologyRefresh 명시 (Lettuce) | maxmemory-policy 명시 부재 |
| Fail-Open 정책 (gateway, inventory admission) | 분산 락 미사용은 OK 지만, 향후 도입 시 ADR 필요 |
| cluster ↔ standalone overlay 깨끗하게 분리 | hot key 모니터링 / activedefrag 운영 룰 명시 부재 |
| common auto-config 로 일관 적용 | hash tag 정책 미문서화 (multi-key 명령 cluster 위험) |

## 12. 다음 파일 연결

위 약점을 구체적 ADR / 설정 변경 / 코드 수정 항목으로 묶어 18 improvements 에 정리한다.
