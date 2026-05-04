---
parent: 15-connection-pool
seq: 03
title: Spring Boot 의 기본값 + Hikari/Tomcat JDBC/DBCP2 비교
type: deep
created: 2026-05-01
---

# 03. Spring Boot 의 기본값 + 풀 라이브러리 비교

## Spring Boot 가 풀을 고르는 순서

`DataSourceAutoConfiguration` 의 implementation 은 다음 순서로 classpath 를 검사한다 (Spring Boot 3.x 기준).

1. `com.zaxxer.hikari.HikariDataSource` 가 있으면 → **HikariCP**
2. 없고 `org.apache.tomcat.jdbc.pool.DataSource` 가 있으면 → Tomcat JDBC
3. 없고 `org.apache.commons.dbcp2.BasicDataSource` 가 있으면 → DBCP2
4. 없고 `oracle.ucp.jdbc.PoolDataSource` 가 있으면 → Oracle UCP
5. 그래도 없으면 → 단순 `SimpleDriverDataSource` (풀 없음, 매번 신규)

`spring-boot-starter-jdbc` / `spring-boot-starter-data-jpa` 는 *HikariCP 를 transitively 의존* 하므로 사실상 모든 신규 프로젝트는 1번에서 결정된다.

명시 override:

```yaml
spring:
  datasource:
    type: com.zaxxer.hikari.HikariDataSource    # 기본
    # type: org.apache.commons.dbcp2.BasicDataSource  # DBCP2 강제
```

---

## Spring Boot 3.x 의 Hikari 기본값

| 파라미터 | Spring Boot 기본 | Hikari 자체 default |
|---|---|---|
| maximumPoolSize | 10 | 10 |
| minimumIdle | -1 (= maxPool) | -1 |
| maxLifetime | 1,800,000 ms (30 min) | 1,800,000 ms |
| idleTimeout | 600,000 ms (10 min) | 600,000 ms |
| connectionTimeout | 30,000 ms | 30,000 ms |
| validationTimeout | 5,000 ms | 5,000 ms |
| keepaliveTime | 0 (off) | 0 |
| leakDetectionThreshold | 0 (off) | 0 |
| autoCommit | true | true |

즉 Boot 가 별도로 *Hikari 기본값을 덮어쓰는 게 거의 없다*. 단, `spring.datasource.hikari.*` prefix 로 덮어쓸 수 있다는 점이 다른 풀과 차별화된 부분.

### "default 그대로 쓰면 위험한 4가지"

| default | 위험 | 권장 |
|---|---|---|
| connectionTimeout = 30s | gateway timeout 5s 와 어긋남 → thread leak | 3~10s |
| keepaliveTime = 0 | LB silent drop 시 첫 borrow 실패 | 30s |
| leakDetectionThreshold = 0 | leak 추적 불가 | 10s |
| maxPoolSize = 10 | 트래픽 쌓이면 즉시 wait | 워크로드별 산정 |

---

## HikariCP vs Tomcat JDBC vs DBCP2 — 왜 Hikari 가 default 가 됐나

Spring Boot 1.4 (2016) 까지는 Tomcat JDBC 가 default 였다. 1.4 부터 Hikari 로 변경. 그 배경.

### 벤치마크 (Brett Wooldridge, HikariCP 공식)

같은 워크로드 (1000 thread, 50 maxPool, prepareStatement → execute → close) 기준:

| 풀 | 처리 시간 | OPS |
|---|---|---|
| **HikariCP** | 86 ms | ~ 1억/min |
| Tomcat JDBC | 1,231 ms | ~ 7천만/min |
| DBCP2 | 1,560 ms | ~ 5천만/min |
| Vibur | 320 ms | ~ 9천만/min |

`getConnection()` 자체 호출 cost 만 비교하면 Hikari 가 다른 풀 대비 5~50배 빠름. 차이의 원인 = Hikari 의 3대 자료구조 ([04-hikari-concurrent-bag.md](04-hikari-concurrent-bag.md), [05-hikari-fastlist-proxy.md](05-hikari-fastlist-proxy.md)).

### 기능 비교

| 항목 | HikariCP | Tomcat JDBC | DBCP2 |
|---|---|---|---|
| concurrency | ConcurrentBag (lock-free) | ConcurrentLinkedQueue | synchronized |
| validation | isValid (default) | testOnBorrow (validationQuery) | testOnBorrow |
| Statement caching | DB-side 권장 (제거) | 자체 캐시 | 자체 캐시 |
| JDBC interceptor | 미지원 | 지원 (slowQueryReport 등) | 미지원 |
| JMX/MicroMeter | 1급 시민 | JMX | JMX |
| 코드 베이스 LOC | ~ 6k | ~ 30k | ~ 50k |
| zero-overhead | 목표 | 부분 | 아님 |

### Hikari 의 설계 철학 (이게 면접 단골)

- **"No frills"** — 불필요한 기능 (Statement caching, query interceptor) 은 일부러 *안* 만든다. JDBC 드라이버나 DB 측에서 더 잘 한다는 입장
- **Bytecode-level 최적화** — 메서드 길이 < 35 bytes (JIT (Just-In-Time compilation, 즉시 컴파일) inline 한도), HotSpot 최적화에 의존
- **microbenchmark 검증** — HdrHistogram 으로 P99 측정
- **defensive programming 거부** — 인자 검증 최소화, 예외 처리 단순

이 철학 때문에 풀 자체가 *느려지지 않는다*. 대신 Tomcat JDBC 처럼 풍부한 interceptor 체인 같은 건 없다.

---

## DBCP2 / Tomcat JDBC 가 아직 쓰이는 경우

| 케이스 | 이유 |
|---|---|
| WAS-만 환경 (Tomcat embedded 없음) | Tomcat JDBC 가 deploy 단순 |
| JDBC interceptor 가 *필수* (slow query 자동 분석 등) | Tomcat JDBC 만 지원 |
| 사내 표준이 DBCP2 | 레거시 |

새 프로젝트라면 사실상 HikariCP 외에 고를 이유가 없다.

---

## Spring Boot 의 양대 통합 지점

### 1. AutoConfiguration

`spring-boot-autoconfigure` 의 `DataSourceAutoConfiguration` + `JdbcTemplateAutoConfiguration` 이 자동으로 `HikariDataSource` 를 빈으로 등록.

```kotlin
// 사용자는 application.yml 에 url/username/password 만 쓰면 됨
@Service
class FooService(
    private val ds: DataSource         // ← HikariDataSource 주입됨
)
```

### 2. ConfigurationProperties 매핑

`spring.datasource.hikari.*` 는 Spring Boot 가 ConfigurationPropertiesBean 으로 매핑한다. yml 의 kebab-case (`maximum-pool-size`) 가 자바의 camelCase (`maximumPoolSize`) 와 자동 매칭.

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20             # → setMaximumPoolSize(20)
      data-source-properties:
        cachePrepStmts: true            # JDBC URL property 로 전달
        prepStmtCacheSize: 250
        useServerPrepStmts: true
```

### 3. 다중 DataSource 시 Auto-config 우회

R/W 분리처럼 master/replica 두 DataSource 가 필요하면 자동 설정이 더 이상 알맞지 않다. msa 프로젝트는 DataSourceConfig.kt (`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`) 처럼 직접 선언.

```kotlin
@Bean
@ConfigurationProperties(prefix = "spring.datasource.master")
fun masterDataSource(): DataSource = DataSourceBuilder.create().build()

@Bean
@ConfigurationProperties(prefix = "spring.datasource.replica")
fun replicaDataSource(): DataSource = DataSourceBuilder.create().build()
```

이 경우 `spring.datasource.master.hikari.*` 형태로 풀 옵션을 따로 줘야 한다. msa 코드베이스가 이렇게 짜여 있다.

---

## DBCP2 시절의 흔한 안티패턴

레거시 코드 / 옛날 책에서 흔히 보이는 패턴 — Hikari 에서는 *이렇게 하면 안 됨*.

```yaml
# DBCP2 스타일 (레거시)
testOnBorrow: true
validationQuery: SELECT 1
testWhileIdle: true
removeAbandonedOnBorrow: true
removeAbandonedTimeout: 60
```

Hikari 등가:

| DBCP2 | Hikari |
|---|---|
| testOnBorrow + validationQuery | (자동) `Connection.isValid()` 사용. validationQuery 미설정 시 default |
| testWhileIdle | keepaliveTime |
| removeAbandoned | leakDetectionThreshold (단, 추적만, 강제 회수 안 함) |
| maxWait | connectionTimeout |
| initialSize | minimumIdle |

`validationQuery: SELECT 1` 을 Hikari 에 그대로 넣으면 isValid() 보다 *느린* 길로 빠진다. JDBC 4 driver (MySQL Connector/J 5.1+) 면 isValid 가 자체 PING 패킷을 사용하므로 더 빠름.

---

## "왜 Spring Boot default 가 그래도 위험할 수 있는가" 면접 답안

> Spring Boot 가 Hikari 를 default 로 쓰는 건 합리적이지만, default *값* 자체는 *개발 환경* 기준이다. 운영 환경에서는:
> 1. connectionTimeout 30s 가 너무 길어 timeout 계층의 책임 분배가 깨진다 (gateway 5s vs hikari 30s)
> 2. keepaliveTime 0 은 cloud LB / NAT 의 idle drop 정책에 무방비
> 3. leakDetectionThreshold 0 은 prod 디버깅 도구가 통째로 없는 상태
> 4. maximumPoolSize 10 은 워크로드 산정 없이 둔 placeholder
>
> 이 4개를 환경별 override 하지 않으면 "Spring Boot 기본값 그대로" = "운영 사고 트랩" 이 된다.

---

## 핵심 포인트

- Spring Boot 3.x 는 HikariCP 를 starter 가 transitively 의존, default 라이브러리
- Hikari 자체 default 값은 *개발용* — 운영은 4개 (connectionTimeout, keepaliveTime, leakDetection, maxPoolSize) 를 반드시 override
- Hikari 가 빠른 이유는 자료구조 + bytecode 최적화 (다음 4-5번 파일)
- DBCP2 의 testOnBorrow / validationQuery 패턴을 Hikari 에 그대로 옮기지 말 것

## 다음 학습

- [04-hikari-concurrent-bag.md](04-hikari-concurrent-bag.md) — Hikari 의 핵심 자료구조 ConcurrentBag
- [05-hikari-fastlist-proxy.md](05-hikari-fastlist-proxy.md) — FastList + ProxyConnection
- [02-pool-parameters.md](02-pool-parameters.md) — 8 파라미터 상세
