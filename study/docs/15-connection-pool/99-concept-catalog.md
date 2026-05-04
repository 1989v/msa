---
parent: 15-connection-pool
seq: 99
title: 커넥션 풀 개념 카탈로그 — HikariCP · R/W 분리 · Lettuce · 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://github.com/brettwooldridge/HikariCP/wiki
  - https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
  - https://lettuce.io/core/release/reference/index.html
  - https://github.com/redis/jedis
  - https://r2dbc.io/
  - https://docs.spring.io/spring-data/jpa/reference/
---

# 99. 커넥션 풀 개념 카탈로그

> **목적** — 15-connection-pool 의 18+ deep file + HikariCP / Lettuce / R2DBC / Spring Data 공식 기준 빠진 영역 발굴 (Hikari 의 SuspendResumeLock, ConnectionCustomizer, R2DBC pool, Lettuce ClusterClientOptions, dynamic pool resize, prepared statement cache 등).

---

## 1. 기존 커버 매트릭스

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| HikariCP | 핵심 옵션 (max/min/timeout/leakDetection) | ✅ |
| Pool sizing | 공식 (Little's Law, threads × ops) | ✅ |
| R/W 분리 | LazyConnection + RoutingDataSource | ✅ |
| Lettuce | netty + reactive | ✅ |
| Jedis | thread-blocking | ✅ |
| Redis pool | LettucePoolingClientConfiguration | ✅ |
| 트러블슈팅 | TX leak, idle timeout, connection storm | ✅ |
| msa 적용 | 5 서비스 R/W 분리 + Redis | ✅ |

### 1-A. 갭 진단

1. **HikariCP SuspendResumeLock** — pause/resume API
2. **ConnectionCustomizer** — 신규 connection 초기화
3. **HikariConfig 의 prepared statement cache** (DB driver 별)
4. **MySQL Connector/J 의 cachePrepStmts / useServerPrepStmts / rewriteBatchedStatements**
5. **PostgreSQL JDBC prepareThreshold / preparedStatementCacheQueries**
6. **Connection validation** — `connectionTestQuery` (legacy) vs JDBC4 `isValid()`
7. **leakDetectionThreshold + Tx leak 분석**
8. **autoCommit 정책** — Spring TX 와 충돌
9. **read-only connection (`setReadOnly(true)`)** 의 driver-specific 동작
10. **Tomcat JDBC vs HikariCP vs Apache DBCP2** 비교 (현재 HikariCP 가 사실상 표준)
11. **Dynamic pool resize / sizing 변경 운영**
12. **Pool warmup / preheat**
13. **JPA `hibernate.connection.handling_mode` (DELAYED_ACQUISITION_AND_RELEASE_AFTER_TRANSACTION)** — connection 점유 단축
14. **AbstractRoutingDataSource 패턴 + LazyConnectionDataSourceProxy** 결합
15. **Multi-tenant pool** — DB per tenant vs single pool routing
16. **Reactive pool — R2DBC pool** options (initialSize / maxSize / maxIdleTime / acquireRetry)
17. **R2DBC ConnectionFactory + Connection borrow lifecycle**
18. **RDBC + Coroutine + Spring 6**
19. **Lettuce ClientOptions** — auto-reconnect, disconnectedBehavior, requestQueueSize
20. **Lettuce ClusterClientOptions** — topologyRefresh / dynamic refresh
21. **Lettuce ReadFrom** (MASTER / REPLICA / NEAREST / ANY) — read 분배
22. **Lettuce 의 connection sharing vs pool**
23. **Jedis JedisPool / JedisPooled / JedisCluster** 차이
24. **Pool metrics** — HikariCP MeterRegistry binding (Micrometer)
25. **Pool exhaustion 진단** — `getConnection()` timeout, active threads dump
26. **Idle eviction** vs **maxLifetime** (Hikari 권장: `maxLifetime` < DB `wait_timeout`)
27. **DB side: MySQL `wait_timeout` / `interactive_timeout`** vs Hikari maxLifetime
28. **TLS connection cost** (handshake 1RTT) + `useServerPrepStmts` 와의 결합
29. **AWS RDS Proxy / GCP SQL Auth Proxy / PgBouncer** — 외부 pooler
30. **PgBouncer pool mode (session/transaction/statement)** + Spring TX 호환성

---

## 2. 카테고리별 개념 트리

### A. HikariCP 핵심

| 옵션 | 의미 | 권장 | 상태 |
|---|---|---|---|
| `maximumPoolSize` | 최대 풀 | "core × 2 + spindle" 또는 측정 | ✅ |
| `minimumIdle` | 유지 idle | maximumPoolSize 와 동일 권장 (유연성보다 예측성) | ✅ |
| `connectionTimeout` | borrow 대기 timeout | 30s default | ✅ |
| `idleTimeout` | idle eviction | maximumPoolSize > minimumIdle 일 때만 | ✅ |
| `maxLifetime` | connection 최대 수명 | DB wait_timeout 보다 짧게 (보통 30분) | ✅ |
| `keepaliveTime` | idle keepalive ping | maxLifetime 보다 짧게 | 🟡 |
| `leakDetectionThreshold` | leak 감지 | dev 5s, prod 60s | ✅ |
| `validationTimeout` | isValid timeout | 5s | 🟡 |
| `connectionInitSql` | 신규 connection init | 트레이싱 / session var | 🟡 |
| **`SuspendResumeLock`** | 동적 pause/resume | failover 시 | ★ 신규 |
| **`ConnectionCustomizer`** | hook | tracing / app session var | ★ 신규 |
| `dataSource.cachePrepStmts` (MySQL) | PreparedStatement 캐시 | true | ★ 신규 |
| `dataSource.useServerPrepStmts` (MySQL) | server-side prepared | true (Aurora 주의) | ★ 신규 |
| `dataSource.rewriteBatchedStatements` (MySQL) | batch rewrite | true | ★ 신규 |
| `prepareThreshold` (PG) | server-side prepare 임계 | 5 default | ★ 신규 |

### B. Pool Sizing

| 모델 | 공식 | 상태 |
|---|---|---|
| HikariCP wiki 권장 | `pool_size = ((core_count × 2) + effective_spindle_count)` | ✅ |
| **Little's Law** | `concurrent = throughput × latency` (#12 cross) | 🟡 |
| **Brett Wooldridge** 의 small-pool 철학 | "큰 풀이 더 빠를 거라는 직관은 틀림" | ✅ |
| Saturation 측정 | active threads + queue 시간 | 🟡 |

### C. Spring DataSource 통합

| 개념 | 정의 | 상태 |
|---|---|---|
| **AbstractRoutingDataSource** | readOnly → reader 라우팅 | ✅ |
| **LazyConnectionDataSourceProxy** | TX 시작 전엔 connection 미획득 | ✅ |
| **TransactionAwareDataSourceProxy** | Spring TX 외부에서 동작 | ★ 신규 |
| `hibernate.connection.handling_mode=DELAYED_ACQUISITION_AND_RELEASE_AFTER_TRANSACTION` | 점유 시간 ↓ | ★ 신규 |
| Multi-tenant routing | tenant id → DataSource | ★ 신규 |

### D. 외부 Pooler

| 도구 | 정의 | 상태 |
|---|---|---|
| **PgBouncer** | session / transaction / statement mode | ★ 신규 |
| **RDS Proxy** | AWS managed pooler (MySQL/PG) | ★ 신규 |
| **GCP Cloud SQL Auth Proxy** | + IAM auth | ★ 신규 |
| ProxySQL (MySQL) | router + pool + sharding | ★ 신규 |
| HAProxy | TCP-level pool/route | 🟡 |

### E. Reactive — R2DBC

| 개념 | 정의 | 상태 |
|---|---|---|
| R2DBC ConnectionFactory | non-blocking driver | ★ 신규 |
| R2DBC pool (initialSize/maxSize/maxIdleTime/acquireRetry) | reactive pool | ★ 신규 |
| TransactionalOperator | reactive TX | ★ 신규 |
| Coroutine + R2DBC + Spring 6 | suspend integration | ★ 신규 |

### F. Redis (Lettuce / Jedis)

| 개념 | 정의 | 상태 |
|---|---|---|
| **Lettuce** (netty, reactive) | non-blocking, multiplexed | ✅ |
| **Jedis** (blocking) | per-thread connection | ✅ |
| Lettuce single connection sharing | many ops per connection | ✅ |
| Lettuce pool (LettucePoolingClientConfiguration) | blocking ops 시에만 | 🟡 |
| **Lettuce ClientOptions** (autoReconnect, disconnectedBehavior, requestQueueSize) | 안정 운영 | ★ 신규 |
| **Lettuce ClusterClientOptions** (topologyRefresh) | cluster 토폴로지 변경 추적 | ★ 신규 |
| **Lettuce ReadFrom** (MASTER/REPLICA/NEAREST/ANY) | read 분배 | ★ 신규 |
| Jedis JedisPool / JedisPooled / JedisCluster | 3종 | ★ 신규 |
| Cache stampede 방어 (#9 cross) | refresh-ahead / mutex | ✅ |

### G. 트러블슈팅

| 시나리오 | 원인 | 진단 |
|---|---|---|
| Pool exhaustion | TX leak / long-running TX (#5 cross) / external IO 안에 connection 점유 | thread dump + leakDetection + slow log |
| Connection storm (DB 측) | maxLifetime 와 wait_timeout 불일치 / autoReconnect 무한 재시도 | DB error log + Hikari pool metrics |
| Driver 호환 | server-side prepared 와 Aurora reader 호환 | 옵션 조정 |
| TLS handshake 비용 | new connection 마다 1-RTT | minimumIdle 유지 + maxLifetime 길게 |

### H. 운영 메트릭

| 메트릭 | 정의 | 상태 |
|---|---|---|
| Hikari MeterRegistry (Micrometer) | active / idle / pending / total | ✅ |
| `hikaricp.connections.active` / `.idle` / `.pending` / `.acquire` | 표준 metric | ✅ |
| Pool saturation (active / max) | utilization | 🟡 |
| Connection wait time P99 | borrow latency | 🟡 |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **PgBouncer / RDS Proxy** | 외부 pooler 도입 시 표준 |
| 2 | **R2DBC pool + Reactive TX** | reactive 진입 시 |
| 3 | **MySQL Connector/J 의 cachePrepStmts / useServerPrepStmts / rewriteBatchedStatements** | throughput 가속 |
| 4 | **AbstractRoutingDataSource + LazyConnection 결합** | R/W 분리 표준 |
| 5 | **Hibernate handling_mode=DELAYED_*** | connection 점유 단축 |
| 6 | **Lettuce ClientOptions / ClusterClientOptions / ReadFrom** | Redis 운영 안정화 |
| 7 | **Pool metric + saturation 알람 표준** | Observability (#10 cross) |
| 8 | **maxLifetime vs DB wait_timeout 정합** | connection storm 회피 |
| 9 | **Multi-tenant pool routing** | SaaS 진입 시 |
| 10 | **TLS handshake 비용 + idle 유지 전략** | latency 절감 (#12 cross) |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. Pool 특화:
- §3 → "옵션 매트릭스" 1개 (defaults + 권장)
- §6 → "HikariCP vs Tomcat JDBC vs DBCP2" / "Lettuce vs Jedis"
- §7 → 운영 메트릭 + 임계 알람 표준

---

## 5. 참고 자료

- HikariCP wiki: https://github.com/brettwooldridge/HikariCP/wiki
- About Pool Sizing: https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
- Lettuce: https://lettuce.io/core/release/reference/index.html
- Jedis: https://github.com/redis/jedis
- R2DBC: https://r2dbc.io/
- PgBouncer: https://www.pgbouncer.org/
- AWS RDS Proxy: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html
- "High Performance MySQL" (Connector/J chapter)
