---
parent: 15-connection-pool
seq: 12
title: Redis 풀 튜닝 — commons-pool2 파라미터와 Lettuce 옵션
type: deep
created: 2026-05-01
---

# 12. Redis 풀 튜닝

Lettuce/Jedis 모두 풀 사용 시 commons-pool2 의 `GenericObjectPoolConfig` 를 따른다. JDBC 풀과 다른 파라미터, 다른 trade-off.

---

## commons-pool2 의 핵심 파라미터

| 파라미터 | default | 의미 |
|---|---|---|
| maxTotal | 8 | 풀 전체 객체 최대 |
| maxIdle | 8 | idle 상태로 유지할 최대 |
| minIdle | 0 | 최소 유지 idle |
| blockWhenExhausted | true | maxTotal 도달 시 borrow 가 block |
| maxWaitMillis | -1 | block 시 대기 상한 (-1 = 무한) |
| testOnBorrow | false | borrow 시 검증 |
| testOnReturn | false | return 시 검증 |
| testWhileIdle | false | idle 검증 (eviction thread) |
| timeBetweenEvictionRunsMillis | -1 | eviction thread 주기 |
| minEvictableIdleTimeMillis | 1800000 (30min) | idle 객체 expire 시간 |
| numTestsPerEvictionRun | 3 | eviction 한 번에 검사할 수 |
| jmxEnabled | true | JMX 노출 |

---

## maxTotal — Redis 풀 사이즈

JDBC 풀의 maximumPoolSize 와 같은 개념. 단, Redis 의 산정 방식은 다름.

### Lettuce single multiplex 일 때

풀 *불필요*. 1 connection 으로 충분. maxTotal = 1 ~ 4 정도면 OK.

### Lettuce + pool 활성화

```yaml
spring:
  data:
    redis:
      lettuce:
        pool:
          max-active: 16
          max-idle: 8
          min-idle: 2
```

산정: high-throughput (10K+ ops/sec) + 큰 payload 가 자주 → connection 1 개의 send buffer 가 막힐 수 있어 풀로 분산. 보통 8~32.

### Jedis pool

```yaml
spring:
  data:
    redis:
      jedis:
        pool:
          max-active: 50
          max-idle: 20
          min-idle: 5
```

산정: thread pool 의 active worker 수와 비례. WebMVC + Tomcat thread pool 200 일 때 보통 50~100.

---

## minIdle — pre-warming

```yaml
min-idle: 2
```

- 풀이 비어있을 때 적어도 N 개는 미리 유지
- 첫 borrow 의 latency 회피
- Redis 는 connect 비용이 작아 (1 RTT) JDBC 만큼 critical 하지는 않음
- 0 으로 두면 첫 트래픽이 오기 전까지 connection 0

---

## blockWhenExhausted vs maxWaitMillis

```yaml
block-when-exhausted: true
max-wait: 1000ms
```

| 조합 | 동작 |
|---|---|
| true + -1 (default) | 무한 대기 |
| **true + 양수 (권장)** | maxWait 까지 대기 후 NoSuchElementException |
| false | 즉시 throw |

`maxWait: -1` 은 위험 — 풀이 막히면 caller 가 영원히 block. Hikari 의 connectionTimeout 처럼 *반드시* 양수 권장.

---

## test* 옵션 — 검증 정책

### testOnBorrow

borrow 시 마다 ping 검증 → connection 살아있는지 확인. cost 는 1 RTT 추가.

```yaml
test-on-borrow: true
```

### testWhileIdle (권장)

eviction thread 가 주기적으로 idle connection 을 검증.

```yaml
test-while-idle: true
time-between-eviction-runs: 30s     # 30초마다
num-tests-per-eviction-run: -1       # 모두 검사 (-1 = 전체)
min-evictable-idle-time: 60s
```

`testWhileIdle = true + timeBetween... = 30s` 이면 *30초마다* 모든 idle connection 에 PING 보내 dead 검출. silent drop 회피의 1번 도구.

### testOnReturn (보통 false)

return 시 검증 — 비용이 자주 들어 보통 사용 안 함.

---

## eviction 정책

```yaml
time-between-eviction-runs: 30s         # 검사 주기
min-evictable-idle-time: 600s            # 10분 이상 idle 시 evict
soft-min-evictable-idle-time: 600s       # minIdle 초과분은 같은 룰
num-tests-per-eviction-run: -1           # -1 = 전체, 양수면 그 수만큼만
```

- minIdle 이하로는 evict 안 함
- 너무 자주 검사하면 CPU 낭비
- Hikari 의 idleTimeout + maxLifetime 합쳐진 개념

---

## 권장 설정 (Lettuce + pool, msa 기준)

```yaml
spring:
  data:
    redis:
      cluster:
        nodes: ${REDIS_NODES}
        max-redirects: 3
      lettuce:
        pool:
          enabled: false    # default — single multiplex
          # 만약 활성화 시:
          # max-active: 16
          # max-idle: 8
          # min-idle: 2
          # max-wait: 1000ms
          # time-between-eviction-runs: 30s
          # test-while-idle: true
        cluster:
          refresh:
            period: 10m            # CommonRedisAutoConfiguration 에서 코드로 설정
            adaptive: true         # 동일
        shutdown-timeout: 100ms
```

msa 의 CommonRedisAutoConfiguration.kt (`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`) 는 pool 미사용 (single multiplex) + adaptive topology refresh + commandTimeout 2s. 일반 서비스에 충분.

---

## Lettuce 의 추가 옵션 (풀 외)

### commandTimeout

```kotlin
LettuceClientConfiguration.builder()
    .commandTimeout(Duration.ofSeconds(2))     // 단일 명령 timeout
```

- ms 단위로 timeout 설정 가능
- 명령마다 override 가능 (`Lettuce 6.x` 부터 `RedisCommand.timeout`)

### autoReconnect

```kotlin
ClientOptions.builder()
    .autoReconnect(true)               // default true
```

connection 끊김 시 자동 재연결. msa 는 default 사용.

### disconnectedBehavior

```kotlin
ClientOptions.builder()
    .disconnectedBehavior(DisconnectedBehavior.REJECT_COMMANDS)
```

| 값 | 의미 |
|---|---|
| `DEFAULT` | 재연결 중 명령 *대기* |
| `REJECT_COMMANDS` | 재연결 중 즉시 fail |
| `ACCEPT_COMMANDS` | 재연결 중에도 큐잉 |

운영 환경 권장: `REJECT_COMMANDS` (fail-fast) 또는 `DEFAULT`. `ACCEPT_COMMANDS` 는 메모리 폭증 위험.

### requestQueueSize

```kotlin
ClientOptions.builder()
    .requestQueueSize(2147483647)      // default Integer.MAX_VALUE
```

각 connection 의 outbound queue 크기. 너무 작으면 명령 reject, 너무 크면 메모리. default 무한 — 보통 그대로 사용.

---

## 분산 락 / pub-sub 의 풀 격리

multiplex 모델이라도 다음은 *전용 connection* 으로 격리.

### 분산 락 (Redisson 등)

Redisson 은 자체 풀 / dedicated connection 사용. Spring Data Redis 의 RedisTemplate 와 별도 풀.

```kotlin
// Redisson 풀 옵션 (예시)
val config = Config().apply {
    useClusterServers().apply {
        connectionPoolSize = 50
        connectionMinimumIdleSize = 5
        subscriptionConnectionPoolSize = 10
        subscriptionConnectionMinimumIdleSize = 2
    }
}
```

- `connectionPoolSize`: 일반 명령 풀
- `subscriptionConnectionPoolSize`: pub/sub 전용 풀

분산 락의 `tryLock(timeout)` 이 blocking 이라 dedicated 필수.

### pub/sub

Spring Data Redis 의 `RedisMessageListenerContainer` 는 자동 dedicated connection.

```kotlin
@Bean
fun listenerContainer(factory: LettuceConnectionFactory): RedisMessageListenerContainer {
    return RedisMessageListenerContainer().apply {
        connectionFactory = factory
        // 내부적으로 dedicated connection 사용
    }
}
```

---

## 모니터링

### Lettuce metrics (Micrometer 통합)

```kotlin
ClientResources.builder()
    .commandLatencyRecorder(CommandLatencyRecorder.builder()
        .targetUnit(TimeUnit.MICROSECONDS)
        .build())
```

Prometheus metric:
- `lettuce_command_completion_count` — 완료된 명령 수
- `lettuce_command_latency_seconds` — latency histogram
- `lettuce_command_firstresponse_seconds` — 첫 응답 latency
- `lettuce_connection_count` — 연결 수

### commons-pool2 JMX

```
org.apache.commons.pool2:type=GenericObjectPool,name=*

  - NumActive
  - NumIdle
  - NumWaiters
  - BorrowedCount
  - ReturnedCount
  - DestroyedCount
  - DestroyedByEvictorCount
  - DestroyedByBorrowValidationCount
```

JMX exporter 를 Prometheus 로 수집해서 대시보드.

---

## 흔한 함정

### 1. Cluster 환경에서 maxRedirects 부족

```yaml
cluster:
  nodes: [...]
  max-redirects: 3      # default 5
```

slot 이 이동 중일 때 MOVED/ASK redirect 가 연쇄. 너무 작으면 정상 명령도 fail. default 5 권장.

### 2. commandTimeout < network RTT

cross-region Redis 사용 시 RTT 50ms 이상. commandTimeout 1s 면 빈번 timeout. 환경에 맞게 설정.

### 3. testOnBorrow 의 cost

매 borrow 마다 PING → 1 RTT 추가. 트래픽 100K ops/sec 이면 1ms × 100K = 100s 가 PING 에 소비. 권장: testWhileIdle = true 만 유지.

### 4. minIdle 너무 크면

100 인스턴스 × minIdle 10 = 1000 idle connection 이 항상 Redis 에 떠 있음. Redis maxclients 한계 (default 10000) 와 비교.

```bash
# Redis 측 client 확인
redis-cli -c CLIENT LIST | wc -l
redis-cli -c CONFIG GET maxclients
```

### 5. Cluster failover 시 stale connection

Lettuce 는 adaptive refresh trigger 로 회복. 단, refresh 주기 사이 (수 초) 는 stale 명령이 fail 가능. 재시도 / circuit breaker 조합 권장 (ADR (Architecture Decision Record, 아키텍처 결정 기록)-0015, `docs/adr/ADR-0015-resilience-strategy.md`).

---

## msa 의 Redis 풀 적용 평가

| 서비스 | Redis 사용 | pool 설정 | 평가 |
|---|---|---|---|
| gateway | rate limiting | single multiplex | ✅ — Reactive 환경 |
| product | 캐싱 | single multiplex | ✅ — 일반 cache 용도 |
| gifticon | session, lock | single multiplex | ⚠ — 분산 락 사용 시 Redisson dedicated 검토 |
| analytics | counter, ranking | single multiplex | ✅ |
| experiment | bucketing | single multiplex | ✅ |

대부분 문제 없음. gifticon 만 분산 락 사용 패턴 확인 필요 ([15-codebase-audit.md](15-codebase-audit.md) 에서 점검).

---

## 핵심 포인트

- Lettuce single multiplex 면 풀 불필요, 일반 서비스 default 그대로 OK
- 풀 사용 시 commons-pool2 의 maxTotal/blockWhenExhausted/maxWait/testWhileIdle 가 핵심
- maxWaitMillis -1 은 위험 — 반드시 양수 (1~3s)
- testWhileIdle = true + 30s eviction 이 silent drop 1차 방어
- 분산 락 / pub-sub 은 multiplex 와 별개 풀로 격리 (Redisson, listenerContainer)

## 다음 학습

- [11-redis-lettuce-vs-jedis.md](11-redis-lettuce-vs-jedis.md) — driver 차이의 근원
- [13-reactive-r2dbc.md](13-reactive-r2dbc.md) — reactive 환경의 풀
- [14-observability.md](14-observability.md) — Lettuce/풀 메트릭 종합
