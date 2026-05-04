---
parent: 15-connection-pool
seq: 18
title: 면접 Q&A — 7대 정면 질문 + 꼬리질문 3-layer
type: deep
created: 2026-05-01
---

# 18. 면접 Q&A 카드

대기업 백엔드 면접 단골 7개 질문 + 각 3-layer 꼬리질문. 정면 답변은 30초 안에, 꼬리질문은 layer 별 약 1분.

---

## Q1. HikariCP 의 풀 사이즈를 어떻게 정하나요?

### 정면 답변

> Little's Law 와 PostgreSQL 공식 두 축으로 잡습니다. Little's Law 로는 *L = λ × W* — 초당 도착 요청 × 평균 connection 점유 시간 = 동시 사용 connection 수. 여기에 P99/평균 비율로 1.5~2배 margin 을 더해 *서비스 측* 풀 사이즈로 잡습니다. 그 다음 *DB 측* 검증으로 (인스턴스 수 × 풀 사이즈) ≤ DB max_connections × 0.8 를 확인합니다. PostgreSQL 의 (core×2 + spindle) 공식은 DB 측 총합의 출발점이고, *작은 풀이 빠르다* 는 게 핵심 직관입니다 — context switch / cache miss / lock contention 모두 풀 수에 비례하므로.

### 꼬리 1: "RPS 가 갑자기 두 배 됐을 때는?"

> Little's Law 의 λ 가 두 배 됐으니 L 도 두 배. 풀이 부족해 pending 이 발생하면 풀 ↑ 가 답이지만, *DB 측 한계* 부터 검증합니다. (인스턴스 × 풀) 가 max_connections 의 80% 안인지, DB CPU 가 받을 수 있는지. 단순히 풀만 늘리면 DB 부하가 폭증해 더 큰 사고가 됩니다. 보통은 HPA (Horizontal Pod Autoscaler, 수평 파드 오토스케일러) 가 인스턴스를 늘리고 풀은 그대로 두는 게 안전합니다.

### 꼬리 2: "DB max_connections 가 한계에 닿으면?"

> 서비스 측 풀 ↑ 는 *역효과* 입니다. 옵션은 세 가지: (1) ProxySQL 또는 PgBouncer 같은 connection multiplexer 도입 — transaction-pool 모드로 backend connection 재사용. 단 server-side prepared statement / session 변수와 충돌. (2) DB instance class 업그레이드 — max_connections 자동 ↑. (3) Aurora 의 connection muxing 사용. 단기 처치는 인스턴스 수 cap 또는 풀 ↓ 입니다.

### 꼬리 3: "pgBouncer 의 transaction pool 모드의 함정은?"

> backend connection 이 *transaction 단위* 로 바뀌니 session-level 상태 사용 불가. 구체적으로 prepared statement (server-side), temporary table, session variable, LISTEN/NOTIFY (PostgreSQL). Hibernate 의 server-side prepared statement (`useServerPrepStmts=true`) 는 transaction-pool 과 *충돌* — 풀 모드를 session 으로 변경하거나, prepared statement 를 client-side 로 전환해야 합니다.

---

## Q2. HikariCP 가 왜 빠른가요?

### 정면 답변

> 세 가지가 결정적입니다. 첫째 ConcurrentBag — ThreadLocal 캐시 + CopyOnWriteArrayList sharedList + SynchronousQueue handoffQueue 의 3계층 lock-free 구조. 모든 상태 전이가 CAS 라 synchronized 가 없습니다. 둘째 FastList — connection 이 자기 Statement 추적용으로 쓰는 list 인데, ArrayList 의 range check 와 equals 호출을 제거하고 == 비교 + 역방향 스캔으로 close 시 LIFO 패턴을 빠르게 처리합니다. 셋째 ProxyConnection — JDBC interface 의 모든 메서드에 대해 *빌드 시점* 에 javassist 로 컴파일된 .class 가 jar 에 들어 있어 reflection 비용이 0 입니다. 그리고 모든 메서드가 < 35 bytes 로 JIT inline 한도 내에 들어가게 설계됐습니다.

### 꼬리 1: "ConcurrentBag 의 ThreadLocal 캐시는 왜 WeakReference 로 들고 있나요?"

> thread 가 죽거나 ThreadLocal 이 정리될 때 메모리 누수를 피하기 위해서입니다. 진짜 connection 객체는 sharedList (master list) 가 들고 있으므로 WeakReference 로도 충분합니다. 또 다른 thread 가 이 ThreadLocal entry 의 connection 을 *steal* 할 수 있는데 (sharedList 스캔에서), 그때 CAS 로 NOT_IN_USE → IN_USE 전이가 성공해야 borrow 됩니다. 즉 reference 자체는 약하게, 소유권은 CAS 로 결정.

### 꼬리 2: "직접 java.lang.reflect.Proxy 를 쓰면 왜 안 되나요?"

> Method.invoke 가 reflection 호출이라 native 대비 5~20배 느립니다. 또 args 가 Object[] 로 boxing 되고, exception 도 InvocationTargetException 으로 wrap 되어 unwrap 비용이 있습니다. JIT 가 inline 하기도 어렵습니다. 1ms 짜리 query 에 reflection overhead 5~10 µs 가 추가되면 트래픽 많은 환경에서 무시 못 할 수준입니다. HikariCP 는 *빌드 시점* 에 .class 를 generate 해 jar 에 포함시키므로 런타임은 일반 메서드 호출과 같습니다.

### 꼬리 3: "그럼 FastList 의 == 비교는 안전한가요?"

> 안전합니다. FastList 가 추적하는 건 *해당 connection 이 만든* Statement 인데, JDBC 의 Statement 인스턴스는 *유일* 합니다. PreparedStatement 도 같은 인스턴스를 reuse 하지 않고 매번 새로 만듭니다. 따라서 reference equality 가 충분하고, equals 의 다형성 비용을 피할 수 있습니다.

---

## Q3. "Connection is not available" 에러를 어떻게 진단하나요?

### 정면 답변

> 4가지 원인을 *메트릭 조합* 으로 분류합니다. (1) 느린 쿼리 — usage P99 가 폭증, DB CPU 가 평소보다 ↑, slow query log 에 기록. (2) 트랜잭션 내 외부 IO — usage 폭증인데 DB 측은 Sleep 다수, thread dump 가 webClient/kafka 에 park. (3) 진짜 풀 부족 — usage 는 정상인데 acquire 가 길고 RPS 가 실제로 ↑. (4) DB max_connections 도달 — connect 자체가 fail, 'Too many connections' 에러. 풀 사이즈 ↑ 가 답인 건 (3) 뿐이고, 나머지는 다른 처치가 필요합니다.

### 꼬리 1: "(2) 트랜잭션 내 외부 IO 의 결정적 증거는?"

> 두 가지를 보면 됩니다. 첫째 hikaricp.connections.usage 의 P99 와 외부 서비스 (예: payment) 의 http_client_requests P99 가 *거의 같음*. 두 값이 함께 폭증하고 비슷한 그래프 모양이면 외부 IO 가 connection 을 잡고 있다는 결정적 증거입니다. 둘째 DB 측 PROCESSLIST 가 *Sleep 상태*. 풀은 active=max 인데 DB 는 idle 이면 풀 외부 (애플리케이션) 가 점유 중이라는 뜻입니다. 처치는 ADR-0020 (`docs/adr/ADR-0020-transactional-usage.md`) 의 외부 IO 분리 — TransactionalService 패턴.

### 꼬리 2: "leak detection 은 어떻게 동작하나요?"

> borrow 시점에 ScheduledFuture 를 등록하고, threshold 시간 안에 close 가 안 되면 borrow 시점의 stack trace 와 함께 WARN 로그를 출력합니다. 비용은 Exception 객체 한 개 + ScheduledFuture 한 개 — 사실상 무비용. 운영 환경에서 leak 추적의 *유일한* 도구라 prod 는 무조건 활성 (10000ms 권장) 합니다. 너무 짧으면 정상 long query 도 false positive 로 잡힙니다.

### 꼬리 3: "DB failover 시 stale connection 은 어떻게 처리하나요?"

> 세 layer 의 방어가 필요합니다. (1) maxLifetime 을 DB wait_timeout - 30s 로 설정 — 풀이 *자발적* 으로 connection 을 교체. (2) keepaliveTime 30s 로 idle connection 을 주기 ping — silent drop 검출. (3) 적극 처치는 HikariCP 의 softEvictConnections() — RDS event subscription 으로 failover 알림을 받아 풀 전체를 mark 후 다음 borrow 시 폐기. 일반적으로 (1)+(2) 조합으로 30초 이내에 회복됩니다.

---

## Q4. Reader/Writer 분리는 어떻게 구현하나요? `@Transactional(readOnly=true)` 와 어떻게 결합?

### 정면 답변

> 세 컴포넌트 조합입니다. (1) AbstractRoutingDataSource — Spring 이 제공하는 dispatcher 로 determineCurrentLookupKey() 가 매번 호출되어 master/replica 키를 반환. (2) TransactionSynchronizationManager.isCurrentTransactionReadOnly() — `@Transactional(readOnly=true)` 가 설정한 ThreadLocal 값을 읽어 dispatcher 가 분기. (3) LazyConnectionDataSourceProxy — 가장 자주 빠뜨리는 부분. 이게 없으면 DataSourceTransactionManager.doBegin() 이 transaction 시작 시점에 connection 을 borrow 하는데, 그때는 readOnly 정보가 *아직 binding 안 됨* 이라 항상 master 로 빠집니다. LazyConnectionDataSourceProxy 가 첫 *실제 SQL 실행* 시점까지 connection 획득을 미뤄야 readOnly 정보를 보고 라우팅합니다.

### 꼬리 1: "LazyConnectionDataSourceProxy 가 빠지면 어떻게 보이나요?"

> 풀 메트릭에서 master 풀만 active 가 채워지고 replica 풀은 항상 idle. `@Transactional(readOnly=true)` 가 잘 적용된 줄 알지만 실제로는 *모두 master 로 라우팅*. 코드 리뷰만으로는 발견 어렵고 메트릭으로만 보임. msa 의 DataSourceConfig.kt (`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`) 는 정상적으로 `@Primary fun dataSource(...)` 에서 LazyConnectionDataSourceProxy 로 wrap 합니다.

### 꼬리 2: "readOnly=true 트랜잭션 안에서 write 하면?"

> MySQL replica 는 read-only mode 이므로 *reject* 합니다. 단 일부 환경 (Hibernate flush 모드 NEVER, MyISAM) 에서는 *silent fail* 가능 — 데이터 손실. ADR-0020 (`docs/adr/ADR-0020-transactional-usage.md`) 에서 readOnly 트랜잭션 안 write 금지를 명시합니다. 또 클래스 레벨 `@Transactional(readOnly=true)` 도 금지 — 메서드별 명시 패턴이라 의도치 않은 mix 회피.

### 꼬리 3: "self-invocation 으로 readOnly 메서드를 호출하면?"

> AOP proxy 가 우회되어 *새 트랜잭션이 안 만들어짐*. outer 트랜잭션의 readOnly 가 그대로 적용. outer 가 readOnly=false 면 inner 도 master 로 라우팅됩니다. self-invocation 자체가 의도된 게 아니면 보통 같은 클래스의 다른 메서드는 *분리하거나* `self` reference (SpEL `@self`) 를 통해 명시 호출하는 게 권장됩니다.

---

## Q5. Lettuce 와 Jedis 의 차이는?

### 정면 답변

> connection 모델이 근본적으로 다릅니다. Jedis 는 *connection-per-thread* — 각 thread 가 풀에서 connection 을 빌립니다. Jedis 객체 자체가 non-thread-safe. 따라서 thread 수 ↑ → connection 수 비례. 반면 Lettuce 는 Netty EventLoop 위에서 *single connection multiplex* — 하나의 connection 으로 수천 thread 의 명령을 직렬화해서 보냅니다. RESP 프로토콜이 순서 있는 stream 이라 가능합니다. 단 BLPOP 같은 blocking 명령, MULTI/EXEC 트랜잭션, SUBSCRIBE pub/sub 은 Lettuce 가 *자동으로 dedicated connection* 을 따로 둡니다. Cluster 환경에서 Lettuce 는 topology 를 adaptive refresh 합니다 — MOVED redirect 같은 trigger 로 자동 갱신. Spring Boot 가 default 를 Lettuce 로 둔 이유입니다.

### 꼬리 1: "Lettuce 의 multiplex 가 head-of-line blocking 을 일으키지 않나요?"

> 네, 가능합니다. 큰 payload (수 MB GET/SET) 가 send queue 앞에 있으면 뒤의 빠른 명령이 그 동안 wait. 일반 워크로드에서는 거의 문제 안 되지만, *high-throughput + 큰 payload* 환경에서는 Lettuce 도 pool 을 활성화하는 게 답입니다 (`spring.data.redis.lettuce.pool.enabled=true`). 보통 8~16 connection. msa 는 일반 cache 용도라 single multiplex 로 충분합니다.

### 꼬리 2: "Cluster topology refresh 의 adaptive trigger 는 어떤 게 있나요?"

> 다섯 가지입니다. MOVED_REDIRECT (slot 이동 응답 받음), ASK_REDIRECT (resharding 중), PERSISTENT_RECONNECTS (같은 노드 재연결 실패 반복), UNCOVERED_SLOT (slot mapping 빈 곳), UNKNOWN_NODE (모르는 노드 응답). common 자동설정 (`common/src/main/kotlin/com/kgd/common/redis/CommonRedisAutoConfiguration.kt`) 의 `enableAllAdaptiveRefreshTriggers()` 가 이 다섯 모두 활성화. periodic refresh (10분) 와 함께면 failover 후 거의 자동 회복.

### 꼬리 3: "분산 락은 Lettuce 의 multiplex 를 그대로 써도 되나요?"

> 안 됩니다. Redisson 같은 분산 락 라이브러리는 자체 풀 / dedicated connection 을 사용해야 합니다. tryLock 의 timeout 동안 connection 을 잡고 있어야 하는데, multiplex 위에서 다른 명령이 끼면 락 의미가 깨집니다. Redisson 의 `connectionPoolSize`, `subscriptionConnectionPoolSize` 가 별도 풀 — Spring Data Redis 의 Lettuce 와 분리.

---

## Q6. WebFlux 에서 일반 JDBC 풀을 쓰면 안 되는 이유는?

### 정면 답변

> WebFlux 의 event loop thread 는 보통 4~8 개. JDBC 의 executeQuery 는 *blocking I/O* 라 socket read 가 끝날 때까지 thread 가 park 됩니다. event loop 4 개 중 한 개가 park 되면 *전체 처리량의 25%* 가 멈춥니다. 더 큰 문제는 Hikari 풀 압박 시 acquire 도 blocking 이라 모든 event loop thread 가 park → JDBC 안 쓰는 다른 endpoint 까지 *완전히 멈춤*. 해결은 `subscribeOn(Schedulers.boundedElastic())` 으로 별도 thread pool 로 offload 하는 건데, 이러면 reactive 의 이점 (적은 thread, backpressure) 이 사라져 사실상 WebMVC 가 더 단순합니다. 진짜 reactive 가 필요하면 R2DBC 사용.

### 꼬리 1: "R2DBC 는 어떤 환경에서 쓰는 게 좋나요?"

> connection-bound 환경입니다. IoT / sensor data 처럼 수만 동시 connection, SSE / WebSocket 같은 long-lived, streaming aggregation. 일반 CRUD 서비스 (RPS < 1000) 는 throughput 차이가 거의 없고 *오히려* JPA 와 도구 생태계 (querydsl, jdbcTemplate) 가 안 맞아 손해. msa 는 gateway 만 WebFlux + Lettuce reactive 이고 다른 서비스는 모두 WebMVC + Hikari 입니다.

### 꼬리 2: "msa 의 gateway 가 SSE 를 어떻게 처리하나요?"

> gateway/application.yml (`gateway/src/main/resources/application.yml`) 의 quant-paper-sse 라우트에 `metadata.response-timeout: 0` 을 명시 — Reactor Netty 의 default response timeout 을 disable. WebFlux 라서 single thread 가 N 개의 SSE connection 을 동시에 처리 가능. WebMVC + Tomcat 이면 thread 한 개가 SSE 한 개에 영원히 묶입니다.

### 꼬리 3: "boundedElastic scheduler 의 한계는?"

> CPU 코어 × 10 thread, max 100K queue. blocking 작업 전용. 단, scheduler 로 옮겨도 *blocking 시간이 길어지면* (예: JDBC 풀 acquire 5s) thread 가 여전히 park. boundedElastic 풀이 가득 차면 queue 에 쌓이고 latency 폭증. 즉 blocking 자체를 줄이는 게 답이지 scheduler 가 만능 해결책이 아닙니다.

---

## Q7. DB failover 시 connection 이 어떻게 동작해야 하나요?

### 정면 답변

> 세 layer 방어가 필요합니다. (1) maxLifetime 을 DB wait_timeout - 30s 로 — 풀이 *자발적* 교체로 stale 연결 누적 회피. (2) keepaliveTime 30s — idle connection 에 isValid() 핑, silent drop 검출. (3) 적극 처치는 RDS event subscription → SNS → 서비스 hook → HikariPool MBean 의 softEvictConnections() — 모든 connection 을 mark 해서 다음 borrow 때 폐기. (1)+(2) 조합으로 보통 failover 후 30초 안에 회복합니다. failover 자체는 RDS 가 60~120초 걸리고, 그 동안은 fail-fast (connectionTimeout 5s) 로 caller 가 retry 정책 또는 circuit breaker 로 처리.

### 꼬리 1: "Aurora 의 connection muxing 과 일반 RDS 의 차이는?"

> Aurora Serverless v2 / RDS Proxy 는 *서버 측* 에서 connection 을 muxing — 클라이언트 connection 1000 개를 backend 50 개로 share. transaction 단위로 backend 가 바뀌니 transaction-pool 모드와 같은 한계 (session state). 장점은 클라이언트 측 풀 사이즈 산정이 단순해지고 max_connections 한계가 사실상 사라짐. 단점은 prepared statement / temp table 못 씀. 일반 RDS 는 connection 이 *전용* 이라 session state 보장.

### 꼬리 2: "validationQuery 는 어떻게 설정하나요?"

> 현대 JDBC 4 driver 면 *설정 안 함*. HikariCP 는 default 로 `Connection.isValid(timeout)` 을 사용하는데, MySQL Connector/J 는 자체 PING packet (COM_PING) 으로 처리하므로 `SELECT 1` 보다 빠릅니다. validationQuery `SELECT 1` 을 명시하면 *오히려 느린 길* 로 빠집니다. JDBC 3 driver legacy 환경에서만 필요.

### 꼬리 3: "DB failover 와 idempotency 의 관계는?"

> failover 직전에 *commit 직전* 의 트랜잭션이 있을 수 있습니다. 클라이언트는 timeout 으로 인지하고 retry 하는데, 서버는 이미 commit 된 상태 → *중복 처리*. 해결은 ADR-0012 (`docs/adr/ADR-0012-idempotent-consumer.md`) 의 idempotent consumer 패턴 — 클라이언트가 idempotency key 를 보내고, 서버가 이를 unique 로 저장. retry 가 같은 key 면 기존 결과 반환. failover 안전성은 풀 설정만으로는 부족하고 *애플리케이션 layer* 에서 함께 설계해야 합니다.

---

## 50문항 인덱스

회독 시 자가 점검용. 각 문항은 30초 안에 답할 수 있어야.

### 풀 기본 (1-10)

1. connection 생성 비용은 무엇으로 구성되나? (TCP / TLS / 인증 / 세션 setup)
2. 풀의 5대 책임은? (창고 / 회수 / 검진 / 퇴역 / 누수 추적)
3. HikariCP 의 8개 핵심 파라미터는?
4. maxLifetime 은 DB wait_timeout 와 어떤 관계?
5. minIdle = maxPool 권장의 근거는?
6. connectionTimeout 의 default 30s 가 위험한 이유는?
7. keepaliveTime 이 추가된 배경은?
8. leakDetectionThreshold 는 prod 에서 왜 필수?
9. Spring Boot 가 default 풀을 고르는 순서는?
10. DBCP2 의 testOnBorrow 를 Hikari 에 그대로 옮기면 왜 안 되나?

### Hikari 내부 (11-20)

11. ConcurrentBag 의 3계층 구조는?
12. ThreadLocal 캐시가 왜 WeakReference 인가?
13. SynchronousQueue 의 역할은?
14. PoolEntry 의 4 상태와 전이는?
15. FastList 의 ArrayList 와의 3가지 차이는?
16. ProxyConnection 은 javassist 를 언제 사용하나?
17. checkException 의 역할은?
18. ProxyConnection.close() 가 진짜로 닫지 않는 이유는?
19. HouseKeeper 가 30s 주기로 하는 일은?
20. maxLifetime 에 jitter 를 주는 이유는?

### 사이즈와 장애 (21-30)

21. PostgreSQL 의 풀 사이즈 공식은?
22. Little's Law 를 풀 사이즈 산정에 어떻게 적용하나?
23. 작은 풀이 빠른 이유 3가지는?
24. (인스턴스 × 풀) > max_connections 시 처치 옵션은?
25. ProxySQL/PgBouncer 의 transaction-pool 모드 한계는?
26. "Connection is not available" 의 4가지 원인은?
27. 트랜잭션 내 외부 IO 의 결정적 진단 증거는?
28. DB max_connections 도달 시 풀 ↑ 가 역효과인 이유는?
29. connection leak 추적의 유일한 도구는?
30. DB failover 시 3 layer 방어는?

### R/W 분리 (31-40)

31. AbstractRoutingDataSource 의 역할은?
32. TransactionSynchronizationManager 가 어떻게 readOnly 정보를 전달?
33. LazyConnectionDataSourceProxy 가 없으면 어떤 버그?
34. msa 의 DataSourceConfig.kt 의 3-컴포넌트 조합은?
35. readOnly=true 트랜잭션 안 write 시 동작은?
36. self-invocation 시 readOnly 라우팅은?
37. replica lag 의 측정 방법은?
38. read-after-write 일관성 보장 4가지 패턴은?
39. session stickiness 의 TTL 산정 근거는?
40. GTID wait 가 필요한 케이스는?

### Redis / Reactive (41-50)

41. Lettuce 와 Jedis 의 connection 모델 차이는?
42. Lettuce 가 dedicated connection 쓰는 3가지 케이스는?
43. Lettuce Cluster 의 adaptive refresh trigger 5가지는?
44. commons-pool2 의 maxWaitMillis -1 이 위험한 이유는?
45. Lettuce 의 single multiplex 가 head-of-line blocking 일으키는 케이스는?
46. WebFlux + JDBC 가 사실상 금기인 이유는?
47. R2DBC 가 빛나는 환경은?
48. boundedElastic scheduler 의 한계는?
49. msa gateway 의 SSE 라우트 설정 의도는?
50. HikariCP MicroMeter 의 6 핵심 메트릭은?

---

## 회독 가이드

- 학습 종료 후 **1주 간격으로 2회** 회독
- 1회차: Q1~Q7 의 정면 답변만 — 30초 내 정리 가능?
- 2회차: 꼬리 질문까지 — layer 별 1분
- 50문항 인덱스는 *모든 답을 즉시* 가능해야

면접 직전 (30분 전) 에 50문항 인덱스만 빠르게 훑는 것 추천.

---

## 핵심 포인트

- 7대 정면 질문은 *내부 메커니즘 + 운영 트레이드오프* 둘 다 묻음
- 꼬리 질문 layer 1: 같은 주제 깊이 / layer 2: 인접 주제 / layer 3: 응용/실무
- "풀 사이즈 늘려" 류 단순 답이 아닌 *원인 분류 → 처치 매핑* 으로 답
- msa 코드베이스 사례 (DataSourceConfig.kt, gateway SSE, common Redis) 를 답에 함께 짜 넣으면 신뢰성 ↑

## 다음 학습

- [00-preview.md](00-preview.md) — 학습 전체 회상
- [17-improvements.md](17-improvements.md) — ADR 초안 작성 후 docs/adr/ 에 실제 적용
