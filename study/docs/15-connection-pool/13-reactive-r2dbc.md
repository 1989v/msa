---
parent: 15-connection-pool
seq: 13
title: Reactive 환경 — R2DBC / Lettuce reactive / WebFlux 와 풀
type: deep
created: 2026-05-01
---

# 13. Reactive 환경의 connection 모델

WebFlux + 일반 JDBC + Hikari 조합이 *왜 안 되는가* 가 핵심. msa 는 gateway 만 WebFlux, 나머지는 WebMVC. 하지만 면접에서 이 차이는 단골.

---

## reactive 의 근본 가정

WebFlux / Project Reactor / Netty 는 *non-blocking I/O* + *event-loop* 모델.

```
[Event Loop Thread (4~8개)]
       │
       ├─→ accept connection
       ├─→ read bytes (NIO)
       ├─→ parse HTTP
       ├─→ dispatch handler
       │     └→ business logic (비동기)
       └─→ write response
```

핵심 원칙:

1. **Event loop thread 를 절대 block 하지 않는다**
2. blocking 이 필요한 일은 별도 *worker pool* 로 offload (Schedulers.boundedElastic)
3. 모든 I/O 는 future / Mono / Flux 로 chain

---

## 일반 JDBC 의 문제: blocking I/O

```kotlin
// JDBC 의 executeQuery 는 socket read 를 block
val rs = ps.executeQuery()   // ← thread 가 응답 올 때까지 sleep
```

JDBC API 자체가 *동기 blocking*. socket read 가 끝날 때까지 thread 가 park.

### WebFlux + JDBC + Hikari 의 재앙

```kotlin
@RestController
class BadController(private val repo: ProductRepository) {
    
    @GetMapping("/products/{id}")
    fun get(@PathVariable id: Long): Mono<Product?> {
        return Mono.fromCallable {
            repo.findById(id)   // ⚠ blocking JDBC
        }
        // 어느 scheduler? default = parallel = event loop thread!
    }
}
```

문제:

1. event loop thread 4~8 개 — JDBC borrow + query 가 blocking
2. Hikari 풀 10 일 때 동시 요청 10 개면 *모든 event loop thread 가 park*
3. 다른 endpoint (Redis 만 쓰는, JDBC 없는) 도 동시에 *완전히 멈춤*
4. K8s (Kubernetes) liveness probe 도 fail → pod 재시작

해결: blocking 을 *반드시* 별도 scheduler 로.

```kotlin
return Mono.fromCallable { repo.findById(id) }
    .subscribeOn(Schedulers.boundedElastic())   // 별도 thread pool
```

`boundedElastic` = CPU 코어 × 10 thread, max 100K queue. blocking 작업 전용.

### 결론

**WebFlux + JDBC 는 사실상 사용 불가**. 설령 boundedElastic 로 offload 해도 reactive 의 이점 (non-blocking, 적은 thread) 이 사라짐 → "그냥 WebMVC 쓰는 게 낫다".

---

## R2DBC — Reactive Relational DB

R2DBC = "Reactive Relational Database Connectivity". JDBC 의 reactive 대체.

### 특성

- non-blocking driver — Netty 위에서 동작
- Mono / Flux 로 결과 stream
- backpressure 지원
- transaction 지원 (단, Spring 의 `@Transactional` 와 다름)

### 지원 driver

- `r2dbc-postgresql` — PostgreSQL (성숙)
- `r2dbc-mysql` (community) — MySQL
- `r2dbc-mariadb`
- `r2dbc-mssql` — SQL Server
- `r2dbc-h2`, `r2dbc-spi` — 테스트용

---

## R2DBC 풀 — r2dbc-pool

JDBC 와 같은 *풀이 필요* — connection 생성 비용 자체는 reactive 라도 없어지지 않음.

```yaml
spring:
  r2dbc:
    url: r2dbc:postgresql://localhost:5432/db
    pool:
      enabled: true
      initial-size: 5
      max-size: 20
      max-idle-time: 30m
      max-life-time: 60m
      max-acquire-time: 3s
      max-create-connection-time: 5s
      validation-query: SELECT 1
      validation-depth: REMOTE   # LOCAL or REMOTE
```

### 파라미터 비교

| Hikari | r2dbc-pool | 의미 |
|---|---|---|
| maximumPoolSize | maxSize | 풀 최대 |
| minimumIdle | (initialSize) | 초기 |
| maxLifetime | maxLifeTime | 수명 |
| idleTimeout | maxIdleTime | idle expire |
| connectionTimeout | maxAcquireTime | borrow 대기 |
| keepaliveTime | (없음 — validation 으로 대체) | - |
| leakDetectionThreshold | (없음) | - |

### 사용 예

```kotlin
@Repository
class ProductRepository(private val client: DatabaseClient) {
    
    fun findById(id: Long): Mono<Product> = client.sql("SELECT * FROM products WHERE id = :id")
        .bind("id", id)
        .map { row -> Product(row["id"] as Long, row["name"] as String) }
        .one()
    
    fun findAll(): Flux<Product> = client.sql("SELECT * FROM products")
        .map { row -> Product(row["id"] as Long, row["name"] as String) }
        .all()
}
```

WebFlux 와 자연스럽게 결합 — controller 까지 Mono/Flux 로 propagate.

---

## R2DBC 의 한계

### 1. JPA / Hibernate 미지원

JPA 의 EntityManager 는 *동기* API. R2DBC 와 호환 안 됨. 대안:

- Spring Data R2DBC (단순 mapping)
- jOOQ (with reactive driver)
- 직접 DatabaseClient + DTO mapping

### 2. transaction 의 차이

```kotlin
@Transactional   // ← JPA 의 @Transactional
fun foo() { ... }

// R2DBC 는 별도
@Transactional("transactionManager")    // 명시
fun fooReactive(): Mono<Unit> = ...
```

R2DBC 는 `R2dbcTransactionManager` 사용. JPA 의 `JpaTransactionManager` 와 분리. 같은 서비스에서 mix 시 dual transaction manager 필요 — 복잡.

### 3. 도구 생태계

JDBC 는 30년 누적된 도구가 많음. R2DBC 는 아직 mature 하지 않은 영역 (analytics, BI 도구 미지원).

### 4. throughput 가정

reactive 가 빠른 게 아님. *throughput-bound* 가 아닌 *connection-bound* 환경에서 효율적. 평범한 웹 서비스 (RPS < 1000) 는 WebMVC + Hikari 가 유리.

---

## Lettuce reactive — Redis 의 reactive 모드

```kotlin
// ReactiveRedisTemplate 사용
@Bean
fun reactiveRedisTemplate(factory: ReactiveRedisConnectionFactory): ReactiveRedisTemplate<String, String> {
    return ReactiveRedisTemplate(factory, RedisSerializationContext.string())
}

@Service
class CacheService(private val template: ReactiveRedisTemplate<String, String>) {
    
    fun get(key: String): Mono<String> = template.opsForValue().get(key)
    
    fun set(key: String, value: String): Mono<Boolean> = 
        template.opsForValue().set(key, value, Duration.ofMinutes(5))
}
```

Lettuce 의 multiplex 모델은 reactive 와 *완벽히 호환* — single connection 위에서 backpressure 도 적용.

### gateway 서비스의 모델 (msa)

`gateway/src/main/resources/application.yml` 를 보면:

```yaml
spring:
  main:
    web-application-type: reactive       # WebFlux
  data:
    redis:
      cluster:
        nodes: [...]
        max-redirects: 3
```

→ WebFlux + Lettuce reactive (Cluster). DB 는 사용하지 않음 (gateway 는 라우팅만).

### gateway 가 DB 를 쓴다면?

쓸 일이 거의 없음. 만약 인증 정보 cache 가 필요하면 Redis 로 처리. JDBC 도입은 *금기* — event loop block 위험.

---

## msa 가 R2DBC 를 도입할 수 있을까

quant (`quant/CLAUDE.md`) 같은 *high-throughput stream* 서비스에서 검토 가치는 있음. 하지만:

- JPA 가 익숙한 팀 → 학습 곡선
- transaction 패턴 변경 (R2dbcTransactionManager)
- 도구 생태계 (querydsl, jdbc-template) 불호환
- *현재 RPS* 가 R2DBC 도입을 정당화하는가? 보통 NO

**msa 의 결론** (CLAUDE.md): 모든 일반 서비스는 WebMVC + Hikari, gateway 만 WebFlux + Lettuce reactive. 적정.

---

## 면접 단골 질문

### Q: WebFlux 에서 JDBC 풀 쓰면 안 되나요?

A: 쓸 수는 있지만 *반드시 boundedElastic scheduler 로 offload* 해야 함. 그래도 reactive 의 이점 (적은 thread, backpressure) 이 사라져 사실상 의미 없음. 차라리 WebMVC 사용. 진짜 reactive 가 필요하면 R2DBC.

### Q: R2DBC 가 빠른가요?

A: throughput 자체는 비슷. *connection 수가 적게 든다* 는 게 reactive 의 이점. 10000 동시 사용자를 thread 200 으로 처리 가능. 하지만 일반 서비스 (RPS < 1000) 는 차이 거의 없음. WebFlux 의 진짜 가치는 SSE / WebSocket / IoT / streaming 같은 *long-lived connection* 패턴.

### Q: gateway 가 SSE 를 어떻게 처리하나?

A: msa 의 gateway 는 quant paper SSE 라우트 (`gateway/src/main/resources/application.yml`) 를 별도 metadata `response-timeout: 0` 로 설정 — Reactor Netty 가 long-lived connection 을 끊지 않게. WebFlux 라서 가능. WebMVC + Tomcat 이면 thread 한 개가 영원히 점유.

---

## reactive 가 *진짜* 빛나는 케이스

1. **IoT / sensor data** — 수만 동시 connection
2. **SSE / WebSocket / long-polling** — long-lived
3. **streaming aggregation** — Flux + transform
4. **API gateway** — fan-out / fan-in
5. **batch processing of streams** — Kafka consumer with backpressure

일반 CRUD 서비스는 WebMVC 가 더 단순하고 안정적.

---

## 핵심 포인트

- WebFlux + JDBC 는 사실상 금기 — boundedElastic offload 해도 이점 사라짐
- R2DBC 는 reactive native, 단 JPA / 도구 생태계 미지원
- Lettuce 는 reactive 호환 — single multiplex 모델이 자연스러움
- gateway 는 WebFlux + Lettuce reactive (DB 안 씀), 일반 서비스는 WebMVC + Hikari + Lettuce sync
- reactive 의 가치는 throughput 이 아니라 *connection 효율* — 일반 RPS 환경은 차이 없음

## 다음 학습

- [11-redis-lettuce-vs-jedis.md](11-redis-lettuce-vs-jedis.md) — Lettuce 의 multiplex 모델
- [14-observability.md](14-observability.md) — reactive 환경의 메트릭 차이
