---
id: 15
title: 커넥션 풀 심화 — DB HikariCP · Reader/Writer 분리 · Redis Pool
status: completed
created: 2026-05-01
updated: 2026-05-02
tags: [connection-pool, hikari, jdbc, redis, lettuce, jedis, replica-routing, performance]
difficulty: intermediate
estimated-hours: 12
codebase-relevant: true
---

# 커넥션 풀 심화

## 1. 개요

Connection Pool 은 DB/Redis 등 stateful 서버 리소스를 재사용하기 위한 핵심 컴포넌트지만 잘못 튜닝하면 thread 고갈, leak, deadlock, latency spike 의 원인이 된다. HikariCP (DB), Lettuce/Jedis (Redis) 의 내부 동작과 운영 튜닝, reader/writer 분리, Spring Boot 자동 설정 한계를 학습한다.

#3(동시성) thread pool 과는 다른 *외부 리소스 풀* 관점이며, #5(Transactional) replica routing 과 직접 연결.

## 2. 학습 목표

- HikariCP 가 어떻게 "fastest" JDBC pool 인지 내부 구조 (ConcurrentBag, FastList, ProxyConnection) 설명
- pool 사이즈 산정 공식 (`((cpu_count * 2) + spindle)`, Little's Law) 근거 있게 설명
- pool 고갈 (Connection is not available) 진단 워크플로
- Reader/Writer 분리 패턴 (AbstractRoutingDataSource + LazyConnectionDataSourceProxy + readOnly 힌트)
- Lettuce vs Jedis 선택 근거 (single connection multiplex vs pool, async, cluster topology refresh)
- Redis 풀 튜닝 포인트 (maxTotal, maxIdle, minIdle, maxWait, evictionPolicy)
- Reactive(WebFlux) 환경 connection model 차이 (R2DBC, Lettuce reactive)
- DB failover 시 stale connection 처리 (validationQuery, testOnBorrow)

## 3. 선수 지식

- JDBC 기본
- Spring Boot DataSource 자동 설정
- TCP 커넥션 lifecycle, TLS handshake 비용

## 4. 학습 로드맵

### Phase 1: 기본 개념
- pool 이 필요한 이유: TCP/TLS handshake 비용, MySQL 인증/세션 setup 비용
- pool 핵심 파라미터: maxPoolSize, minimumIdle, idleTimeout, maxLifetime, connectionTimeout
- HikariCP, Tomcat JDBC, DBCP2 의 등장 배경
- Spring Boot 의 기본값 (HikariCP, default 10)

### Phase 2: 심화
- **HikariCP 내부**
  - ConcurrentBag: thread-local 캐시 + shared queue 의 lock-free hand-off
  - FastList: ArrayList 대체 (synchronized 없음, range check 없음)
  - ProxyConnection / ProxyStatement: javassist 코드 생성
  - HouseKeeper: maxLifetime 도래 connection 폐기 (DB-side timeout 회피)
  - leakDetectionThreshold: 미반납 connection 추적
- **사이즈 산정**
  - PostgreSQL 공식: `pool_size = ((cpu_count * 2) + effective_spindle_count)`
  - Little's Law: `pool = arrival_rate × service_time`
  - DB 측 max_connections 한계 (서비스 인스턴스 수 × pool size 합)
  - 컨테이너 환경: HPA 스케일 시 DB connection 폭증 위험 → ProxySQL/PgBouncer 필요성
- **장애 패턴**
  - "HikariPool-1 - Connection is not available, request timed out" 4가지 원인 (느린 쿼리 / 트랜잭션 길이 / pool size 부족 / DB 측 거부)
  - long-running transaction 이 pool 점유 → 다른 요청 starvation (#5 외부 IO 분리와 직결)
  - DB failover 시 stale connection (testOnBorrow, validationQuery, ConnectionTestQuery)
  - prepared statement cache 와 DB-side server-side prepared statements
- **Reader/Writer 분리**
  - `AbstractRoutingDataSource` + lookup key resolver
  - `TransactionSynchronizationManager.isCurrentTransactionReadOnly()` 키로 분기
  - `LazyConnectionDataSourceProxy`: 트랜잭션 시작 후 첫 SQL 시점 분기 결정
  - 두 풀 분리 운영 (writer 풀 / reader 풀)
  - replica lag 고려: read-after-write 일관성 (단발 요청 동안 stickiness)
- **Redis pool**
  - **Lettuce**: Netty 기반, single connection multiplex (block/transaction 시 dedicated connection), thread-safe
  - **Jedis**: connection per command, pool 필요 (commons-pool2 기반)
  - Cluster topology refresh, dynamicRefreshSources
  - pool 파라미터 (commons-pool2): maxTotal, maxIdle, minIdle, blockWhenExhausted, maxWaitMillis
  - 분산 락 / pub-sub 시 dedicated connection 격리
- **Reactive 환경**
  - R2DBC pool (`r2dbc-pool`): event-loop 친화적
  - Lettuce reactive (Project Reactor 기반)
  - WebFlux + Hikari 같이 쓰면 안 되는 이유 (event loop blocking)
- **관측**: HikariCP MicroMeter (`hikaricp.connections.*`), Prometheus 시각화

### Phase 3: 실전 적용
- msa 각 서비스 application.yml 의 hikari 설정 점검 (default 인지 명시인지)
- DB 인스턴스 max_connections vs (서비스 수 × pool size × replica 수) 산정
- gateway 의 Lettuce 설정 (cluster 모드)
- product/order 의 read-heavy 서비스에 reader 분리 적용 검토
- HikariCP MicroMeter 메트릭을 Prometheus 대시보드에 추가
- pool 고갈 시뮬레이션 (`SLEEP(10)` 쿼리 + 부하) 및 진단 실습

### Phase 4: 면접 대비
- "HikariCP 의 pool size 를 어떻게 정하나요?"
- "HikariCP 가 왜 빠른가요?"
- "Connection is not available 에러 어떻게 진단하나요?"
- "Reader/Writer 분리 어떻게 구현하나요? `@Transactional(readOnly=true)` 와 어떻게 결합?"
- "Lettuce 와 Jedis 의 차이는?"
- "WebFlux 에서 일반 JDBC pool 을 쓰면 안 되는 이유는?"
- "DB failover 시 connection 이 어떻게 동작해야 하나요?"

## 5. 코드베이스 연관성

- **모든 JVM (Java Virtual Machine, 자바 가상 머신) 서비스의 DataSource**: `{service}/app/src/main/resources/application.yml`
- **gateway Redis 설정**: `gateway/app/src/main/resources/application.yml` (cluster, Lettuce)
- **standalone Redis 5개 서비스**: gateway, product, gifticon, analytics, experiment
- **#5 Spring Transactional plan**: replica routing 패턴 → 본 plan 의 실 구현체
- **ADR 후보**: reader/writer 분리 도입 시 ADR 작성

## 6. 참고 자료

- HikariCP wiki "About Pool Sizing"
- Brett Wooldridge 의 HikariCP 설계 글
- "PostgreSQL Connection Pool Sizing" — pgBouncer 문서
- Lettuce 공식 (advanced topics)
- Spring Boot Reference (Data Access)

## 7. 미결 사항

> **회고 (2026-05-02)**: 본 섹션은 plan 작성 시점의 미결 항목이며, 현재 deep study 완료 상태에서 각 항목별로 마킹됨.

- R2DBC 깊이 (msa 가 WebFlux 미사용)
  - 🔄 부분 결정: `13-reactive-r2dbc.md` 에서 r2dbc-pool + event-loop blocking 회피까지 개념 정리. msa 가 gateway 외 WebFlux 미사용이라 도입 검토 깊이는 얕게.
- Reader/Writer 분리 실제 구현 실습 vs 이론
  - ✅ 결정: `09-reader-writer-routing.md` (AbstractRoutingDataSource + LazyConnectionDataSourceProxy + readOnly 결합) + `10-replica-lag-consistency.md` (stickiness, GTID 대기) + `15-codebase-audit.md` 에서 11개 서비스 hikari/Lettuce 설정 점검. improvements §17 에서 ADR-XXXX 초안 작성 권장.
- pool 고갈 재현 실습 깊이
  - ✅ 결정: `16-pool-exhaustion-drill.md` 에서 SLEEP(N) 시뮬레이션 + thread dump + Hikari MBean 진단 워크플로 정리.

## 8. 원본 메모

```
15. 커넥션 풀, 히카리CP, reader/writer CP 분리, 레디스 풀
```
