---
parent: 15-connection-pool
seq: 11
title: Lettuce vs Jedis — 클라이언트 모델 차이와 풀 의미
type: deep
created: 2026-05-01
---

# 11. Lettuce vs Jedis 내부 차이

Spring Data Redis 의 두 driver. 풀 관점에서 *완전히 다른 모델* 을 따른다. msa 는 common Redis 자동 설정 (`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`) 에서 Lettuce 사용.

---

## 한 줄 요약

| 항목 | Jedis | Lettuce |
|---|---|---|
| connection 모델 | one-per-thread | single multiplex |
| pool 필요? | YES (commons-pool2) | 사실상 NO (특수 케이스만) |
| 비동기 | 아님 (3.x 부터 부분적) | native |
| 기반 | java.net Socket | Netty NIO |
| thread-safe | 아님 (connection 자체) | YES (shared connection) |
| reactive 지원 | 아님 | Project Reactor |
| Cluster topology | manual refresh | adaptive refresh |

이 차이가 풀 설계의 *근본* 을 바꾼다.

---

## Jedis: connection-per-thread 모델

### 모델

```
Thread A ─→ Connection 1 ─→ Redis
Thread B ─→ Connection 2 ─→ Redis
Thread C ─→ Connection 3 ─→ Redis
```

각 thread 는 독립 connection 을 가져야 함. Jedis 객체 자체가 *non-thread-safe*.

```java
// Jedis 직접 사용
try (Jedis jedis = pool.getResource()) {
    jedis.set("key", "value");
    jedis.get("key");
}   // pool 로 반납
```

### 풀 의존

→ Jedis 는 commons-pool2 기반 풀이 *필수*. 풀 사이즈 산정이 thread pool 과 1:1 비례.

```yaml
spring:
  data:
    redis:
      jedis:
        pool:
          max-active: 50    # thread pool 과 비슷한 수준
          max-idle: 10
          min-idle: 2
```

### 장점 / 단점

| 장점 | 단점 |
|---|---|
| 단순한 mental model | thread 수 ↑ → connection 수 ↑ |
| 동기 API 직관적 | reactive 환경 불가 |
| 디버깅 쉬움 (1 cmd = 1 conn) | Cluster 환경 복잡 (slot 별 conn) |
| 작은 라이브러리 | Netty 기반 latency 이점 없음 |

---

## Lettuce: multiplex 모델

### 모델

```
Thread A ─┐
Thread B ─┼─→ ★ Single Connection ★ ─→ Redis
Thread C ─┘            (Netty)
```

*하나의 connection* 위에서 모든 thread 가 명령을 send. Netty 의 EventLoop 가 send queue 를 직렬화.

```kotlin
// Spring Data Redis - LettuceConnectionFactory
val factory = LettuceConnectionFactory(...)
factory.afterPropertiesSet()
// thread A
factory.connection.use { it.set("a".toByteArray(), "1".toByteArray()) }
// thread B 동시에
factory.connection.use { it.set("b".toByteArray(), "2".toByteArray()) }
// 동일 connection 사용 — 충돌 없음
```

### 왜 가능한가

- Redis 프로토콜 (RESP) 은 *순서가 있는* request/response stream
- Netty 가 내부 ChannelOutboundQueue 로 명령을 직렬화
- response 는 도착 순서대로 promise 를 resolve
- *thread 간 lock 없음* — channel 자체가 single writer (EventLoop)

### 장점 / 단점

| 장점 | 단점 |
|---|---|
| connection 1개로 수천 thread cover | head-of-line blocking 가능 (큰 명령) |
| reactive native | mental model 복잡 |
| Cluster topology 자동 관리 | 일부 명령은 dedicated 필요 |
| Netty 기반 — 다른 NIO 와 통합 | 학습곡선 |

---

## 단, dedicated connection 이 필요한 케이스

multiplex 는 *모든 명령이 stateless 일 때만* 안전. 다음은 dedicated connection 강제.

### 1. blocking commands

```
BLPOP, BRPOP, BLMOVE, XREAD BLOCK, SUBSCRIBE
```

이 명령은 응답이 *언제 올지 모름* — 다른 thread 의 명령이 뒤에 큐잉되어 *영원히* 대기.

Lettuce 는 자동으로 dedicated connection 사용:

```java
// Lettuce 내부
StatefulRedisConnection<...> sharedConn = ...;     // multiplex
StatefulRedisConnection<...> blockingConn = ...;   // blocking 전용
```

### 2. transaction (MULTI/EXEC)

```
MULTI
SET a 1
SET b 2
EXEC
```

같은 connection 에서 MULTI 시작 후 다른 thread 의 SET 이 끼면 atomicity 깨짐. dedicated 필요.

Spring Data Redis 의 `@Transactional` (Redis transaction) 활성화 시 자동 dedicated.

### 3. pub/sub

`SUBSCRIBE` 는 stream-mode 로 전환 — 그 connection 에서 다른 명령 send 불가.

```kotlin
@Bean
fun messageListenerContainer(factory: LettuceConnectionFactory): RedisMessageListenerContainer {
    return RedisMessageListenerContainer().apply {
        connectionFactory = factory   // 자동 dedicated
        addMessageListener(MessageListenerAdapter(...), PatternTopic("orders.*"))
    }
}
```

---

## Lettuce 의 connection pool 옵션

기본은 *single connection* 이지만, pool 도 사용 가능 (`commons-pool2` 의존성 추가).

```yaml
spring:
  data:
    redis:
      lettuce:
        pool:
          enabled: true
          max-active: 16
          max-idle: 8
          min-idle: 2
```

언제 사용?

- 매우 high-throughput (10만+ ops/sec) 환경에서 single connection 이 head-of-line block
- 큰 GET/SET (수 MB) 이 자주 일어나 다른 명령 지연
- 일반 서비스는 *single connection 으로 충분*

---

## Cluster topology refresh

Redis Cluster 는 16384 hash slot 을 노드들에 분산. failover / resharding 시 slot ownership 이 변경.

### Jedis Cluster

```java
JedisCluster cluster = new JedisCluster(nodes);
// 내부적으로 각 노드별 풀 유지
// MOVED redirect 시 manual refresh 필요
```

### Lettuce Cluster (msa 의 common 설정)

```kotlin
// CommonRedisAutoConfiguration.kt 발췌
val topologyRefreshOptions = ClusterTopologyRefreshOptions.builder()
    .enablePeriodicRefresh(Duration.ofMinutes(10))            // 정기 refresh
    .enableAllAdaptiveRefreshTriggers()                       // adaptive
    .build()

val clientOptions = ClusterClientOptions.builder()
    .topologyRefreshOptions(topologyRefreshOptions)
    .build()
```

### adaptive refresh trigger

| Trigger | 의미 |
|---|---|
| `MOVED_REDIRECT` | MOVED 응답 받으면 즉시 refresh |
| `ASK_REDIRECT` | ASK 응답 받으면 즉시 refresh |
| `PERSISTENT_RECONNECTS` | 같은 노드에 재연결 실패 반복 시 |
| `UNCOVERED_SLOT` | slot mapping 빈 곳 발견 시 |
| `UNKNOWN_NODE` | 모르는 노드의 응답 받을 때 |

`enableAllAdaptiveRefreshTriggers()` 가 위 모두 활성. failover 시 거의 자동 회복.

### dynamicRefreshSources

```kotlin
ClusterTopologyRefreshOptions.builder()
    .dynamicRefreshSources(true)   // default true
    ...
```

- `true`: cluster nodes 의 응답을 *추가 정보원* 으로 사용 — 새 노드 발견 가능
- `false`: 초기 seed nodes 만 사용 — 노드 추가/제거 시 stale

---

## 동기 / 비동기 / reactive API

### Lettuce 의 3-API

```java
RedisClient client = RedisClient.create(uri);
StatefulRedisConnection<String, String> conn = client.connect();

// 1. Sync
RedisCommands<String, String> sync = conn.sync();
String val = sync.get("key");

// 2. Async (CompletableFuture)
RedisAsyncCommands<String, String> async = conn.async();
CompletableFuture<String> future = async.get("key");

// 3. Reactive (Project Reactor)
RedisReactiveCommands<String, String> reactive = conn.reactive();
Mono<String> mono = reactive.get("key");
```

같은 connection 에서 3 모드 중 어떤 것이든 사용 가능. *동시 사용도 가능* (multiplex 덕).

### Spring Data Redis 통합

```kotlin
// Sync (RedisTemplate)
val template: RedisTemplate<String, Any>
template.opsForValue().get("key")

// Reactive (ReactiveRedisTemplate)
val reactiveTemplate: ReactiveRedisTemplate<String, Any>
reactiveTemplate.opsForValue().get("key")    // Mono<Any>
```

WebFlux 환경 (msa 의 gateway) 은 Reactive template 사용.

---

## 선택 기준 — 어느 걸 쓰나

| 환경 | 권장 |
|---|---|
| 일반 Spring Boot (WebMVC) | Lettuce (default) |
| WebFlux | Lettuce reactive 강제 |
| Redis Cluster | Lettuce (topology auto-refresh) |
| 매우 high TPS + 큰 payload | Lettuce + pool |
| legacy code 호환 | Jedis |
| 단일 명령 위주 + thread 적음 | Jedis 도 OK |

Spring Boot 2.x 부터 *Lettuce 가 default*. 새 프로젝트는 사실상 Lettuce.

---

## msa 의 Lettuce 설정 분석

`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt` 의 핵심:

```kotlin
val topologyRefreshOptions = ClusterTopologyRefreshOptions.builder()
    .enablePeriodicRefresh(Duration.ofMinutes(10))
    .enableAllAdaptiveRefreshTriggers()
    .build()

val clientOptions = ClusterClientOptions.builder()
    .topologyRefreshOptions(topologyRefreshOptions)
    .build()

val lettuceClientConfig = LettuceClientConfiguration.builder()
    .clientOptions(clientOptions)
    .commandTimeout(Duration.ofSeconds(2))    // ← 명령 timeout
    .build()

return LettuceConnectionFactory(clusterConfiguration, lettuceClientConfig)
```

평가:

- ✅ adaptive refresh — failover 자동 회복
- ✅ commandTimeout 2s — fail-fast
- ⚠ pool 설정 없음 — single connection 모드 (대부분 OK, but high TPS (Transactions Per Second, 초당 트랜잭션 수) 환경 검토)
- ⚠ `disconnectedBehavior` 미설정 — default `DEFAULT` (재연결 시도 동안 명령 reject), 환경에 따라 `ACCEPT_COMMANDS` 도 고려
- ⚠ `autoReconnect` default true (OK)
- ⚠ K3s-lite overlay 에서는 Cluster → standalone 으로 override (SPRING_APPLICATION_JSON)

---

## 흔한 함정

### 1. Lettuce 에서 풀 설정 없이 large payload

```
SET key <10MB value>   ← single connection 점유 시간 ↑
GET other_key          ← block 됨 (HOL blocking)
```

→ pool 도입 또는 큰 payload 분할.

### 2. Jedis Cluster 에서 풀 사이즈 미스

JedisCluster 는 *각 노드마다 별도 풀*. 6 노드 × pool 50 = 300 connection. 운영 측 max_clients 한계 주의.

### 3. blocking command + multiplex

```kotlin
redisTemplate.opsForList().leftPop("queue", Duration.ofSeconds(60))
```

내부적으로 dedicated connection 사용 — 정상. 다만 *long timeout* 의 connection 이 풀 안에 점유되는 건 인지.

### 4. pub/sub listener 가 연결 lost 시

`RedisMessageListenerContainer` 는 reconnect 자동 시도. 하지만 *놓친 메시지* 는 못 받음 (Redis pub/sub 은 store-and-forward 아님). 손실 허용 안 되면 Streams 나 Kafka 로 전환.

---

## 면접 모의 답변

> "Lettuce 와 Jedis 의 가장 큰 차이는 connection 모델이다. Jedis 는 connection-per-thread 라서 각 thread 가 풀에서 connection 을 빌려야 한다. thread 수가 늘면 connection 수도 비례. 반면 Lettuce 는 Netty EventLoop 위에서 *single connection multiplex* 다 — 하나의 connection 으로 수천 thread 의 명령을 직렬화해서 보낸다. RESP 프로토콜이 순서 있는 stream 이라 가능한 패턴이다. 단 BLPOP 같은 blocking 명령, MULTI/EXEC 트랜잭션, SUBSCRIBE pub/sub 은 dedicated connection 을 자동으로 따로 둔다. Cluster 환경에서 Lettuce 는 topology 를 adaptive refresh 한다 — MOVED redirect, persistent reconnect 같은 trigger 로 자동 갱신. 이게 Spring Boot 가 default 를 Lettuce 로 둔 이유다."

---

## 핵심 포인트

- Jedis: connection-per-thread + 풀 필수
- Lettuce: single connection multiplex + 풀 선택사항
- Lettuce 가 dedicated connection 쓰는 3가지: blocking command / transaction / pub-sub
- Cluster 환경에서는 topology adaptive refresh — MOVED/ASK/UNCOVERED_SLOT 등 trigger
- WebFlux / reactive 는 Lettuce 강제, 일반 환경은 Spring Boot default 따라가면 됨

## 다음 학습

- [12-redis-pool-tuning.md](12-redis-pool-tuning.md) — Lettuce/Jedis 풀 파라미터
- [13-reactive-r2dbc.md](13-reactive-r2dbc.md) — reactive 환경의 connection 모델
- [15-codebase-audit.md](15-codebase-audit.md) — msa Lettuce 설정 점검
