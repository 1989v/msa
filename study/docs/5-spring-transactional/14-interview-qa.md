---
parent: 5-spring-transactional
seq: 14
title: 면접 Q&A 카드 + 50문항 인덱스
type: deep
created: 2026-05-01
---

# 14. 면접 Q&A 카드

> 이 파일은 회독용. 학습 종료 후 1주일 간격으로 2-3회 회독 권장.

---

## Phase 1: 기본 메커니즘 (8개)

**Q1.1** `@Transactional` 의 동작 원리를 설명해보세요.
> Spring AOP (Aspect-Oriented Programming, 관점 지향 프로그래밍) 의 프록시 기반입니다. 컨테이너가 빈을 만들 때 `@Transactional` 이 붙은 클래스의 프록시 객체를 생성하는데, 인터페이스가 있으면 JDK Dynamic Proxy, 없으면 CGLIB 으로 만들고 Spring Boot 기본은 CGLIB 입니다. 외부에서 메서드 호출이 들어오면 프록시가 가로채서 `TransactionInterceptor` 가 호출됩니다. 이 인터셉터가 `PlatformTransactionManager.getTransaction()` 으로 트랜잭션 시작 → target 의 실제 메서드 실행 → 정상 종료면 commit, RuntimeException 이나 Error 면 rollback 을 수행합니다. 비즈니스 코드 안에 트랜잭션 코드를 한 줄도 안 쓰는 이유는 이 인터셉터가 모두 처리하기 때문입니다.

**Q1.2** CGLIB 와 JDK Dynamic Proxy 의 차이는?
> JDK 는 인터페이스 기반이라 빈이 인터페이스를 구현해야 하고 그 인터페이스의 메서드만 프록시할 수 있습니다. CGLIB 는 바이트코드를 생성해 서브클래스를 만들기 때문에 인터페이스 없이도 동작하지만 final 클래스나 final 메서드는 프록시할 수 없습니다. Kotlin 은 모든 클래스가 기본 final 이라 충돌이 일어나는데 `kotlin-spring` Gradle 플러그인이 `@Component`/`@Service`/`@Transactional` 같은 클래스를 자동으로 open 처리해줍니다. Spring Boot 기본은 `proxy-target-class=true` 로 인터페이스 유무와 무관하게 CGLIB 입니다.

**Q1.3** Checked Exception 에서 롤백이 기본으로 안 되는 이유는?
> EJB CMT 의 application exception / system exception 구분을 그대로 계승했기 때문입니다. RuntimeException 과 Error 는 "예상 못 한 시스템 오류" 로 보고 자동 롤백, Checked 는 "비즈니스가 명시적으로 던지고 호출자가 인지해서 처리하는 application 예외" 로 보고 롤백하지 않습니다. 호출자가 보상 결정을 한다는 철학이죠. Kotlin 은 Checked 가 없어서 이 규칙을 신경 쓸 일이 거의 없지만, Java 라이브러리에서 IOException 같은 게 들어오는 경계에서는 `rollbackFor = [Exception::class]` 로 명시할 필요가 있습니다.

**Q1.4** 클래스 레벨에 `@Transactional` 을 붙이면 어떤 문제가 있나요?
> 모든 public 메서드가 같은 정책으로 묶여서 조회 메서드도 쓰기 트랜잭션으로 동작합니다. readOnly 최적화 — Hibernate FlushMode MANUAL, snapshot 미보관, replica 라우팅 — 을 못 받게 되고, 그 클래스 안의 모든 catch 패턴이 잠재적인 함정이 됩니다. 메서드별로 명시하면 위험이 코드에 드러나지만 클래스 레벨이면 가려집니다. 다만 TransactionalService 분리 패턴처럼 "이 클래스는 DB 트랜잭션만 담당한다" 는 의도가 명확하면 클래스 레벨이 정당하고, 그땐 조회 메서드에 readOnly = true 를 명시해주는 게 우리 msa 의 컨벤션입니다.

**Q1.5** 인터페이스에 `@Transactional` 을 붙이는 건 어떤가요?
> Spring Boot 기본 환경에서는 권장하지 않습니다. CGLIB 프록시는 서브클래스를 만들기 때문에 인터페이스의 애노테이션을 못 봅니다. JDK Dynamic Proxy 환경에서만 동작하는데 Boot 기본이 CGLIB 라서 인터페이스에 붙이면 무시됩니다. Spring 공식 문서도 "구현 클래스에 붙이라" 고 명시합니다. UseCase 같은 인터페이스에는 붙이지 않고, 그것을 구현한 Service 클래스에 메서드 단위로 붙이는 게 정공법입니다.

**Q1.6** `@Transactional` 메서드 안에서 같은 클래스의 다른 `@Transactional` 메서드를 호출하면?
> Self-invocation 함정입니다. 외부 호출은 프록시를 거치지만 같은 인스턴스 안에서 `this.method()` 로 호출하면 프록시가 아닌 target 의 메서드가 직접 호출돼서 `TransactionInterceptor` 가 안 돌아갑니다. 결과적으로 안쪽 메서드의 `@Transactional` 속성이 무시됩니다. 회피 방법은 네 가지인데, self 주입 (`@Lazy @Autowired private lateinit var self: ServiceClass`), `AopContext.currentProxy()`, 클래스 분리, `TransactionTemplate` 입니다. 우리 msa 는 `{Entity}Service` (오케스트레이션) + `{Entity}TransactionalService` (트랜잭션) 로 클래스 분리하는 패턴을 표준으로 씁니다.

**Q1.7** `private` 메서드에 `@Transactional` 이 작동하나요?
> 작동하지 않습니다. CGLIB 는 서브클래스를 만들어 메서드를 오버라이드하는 방식인데 private 은 서브클래스에서 보이지 않아서 오버라이드할 수 없습니다. JDK Dynamic Proxy 도 인터페이스 메서드만 다루니까 private 은 대상이 아닙니다. 프록시 자체가 안 만들어지는 게 아니라 그 메서드만 우회되는데, IDE 가 경고를 안 띄우고 런타임 예외도 안 나서 가장 무서운 함정입니다. public 으로 바꾸거나 클래스 분리로 해결합니다.

**Q1.8** Kotlin 의 suspend 함수에 `@Transactional` 을 붙이면?
> 정상 동작이 보장되지 않습니다. `TransactionSynchronizationManager` 가 ThreadLocal 기반인데 코루틴은 Thread 를 자유롭게 hop 하니까 동기화가 깨집니다. msa 는 이걸 회피하려고 suspend 메서드 자체에는 `@Transactional` 을 안 붙이고, 그 안에서 non-suspend 빈 메서드 — 예를 들면 `OrderTransactionalService.savePendingOrder()` — 를 호출하는 우회 패턴을 씁니다. 이 호출은 정상 프록시 + ThreadLocal 동기화로 동작합니다. Spring Boot 3.0+ 이후로는 `TransactionalOperator` 의 코루틴 확장 (`executeAndAwait`) 으로도 가능하지만 우리는 빈 분리 방식으로 충분히 풀고 있습니다.

---

## Phase 2: 전파 · 격리 · readOnly (12개)

**Q2.1** REQUIRES_NEW 와 NESTED 의 차이는?
> REQUIRES_NEW 는 **별 트랜잭션 + 별 커넥션** 이라 outer 트랜잭션과 완전 독립적입니다. inner 가 commit 되면 outer 가 롤백돼도 inner 는 살아남습니다. NESTED 는 outer 와 같은 트랜잭션 안에 **Savepoint** 를 만드는 방식이라 부분 롤백이 가능하지만, outer 가 롤백되면 inner 도 같이 사라집니다. 그리고 결정적 차이는 NESTED 는 JDBC Savepoint 위에 구현돼서 JpaTransactionManager 가 지원하지 않습니다 — `NestedTransactionNotSupportedException` 던집니다. JPA 환경에서는 사실상 NESTED 가 후보에서 빠지고 REQUIRES_NEW 만 남습니다.

**Q2.2** REQUIRES_NEW 가 self-invocation 환경에서 무력화되는 이유는?
> propagation 속성을 평가하는 게 `TransactionInterceptor` 인데, self-invocation 이면 그 인터셉터를 안 거쳐서 평가 자체가 안 일어납니다. 결과적으로 안쪽 메서드의 propagation 이 무엇이든 outer 와 같은 트랜잭션으로 동작합니다. REQUIRES_NEW 가 의미를 가지려면 다른 빈으로 분리하거나 self 주입을 해야 합니다.

**Q2.3** REQUIRES_NEW 를 남발하면 어떤 문제가 생기나요?
> 커넥션 풀 데드락 위험입니다. outer 가 자기 커넥션을 잡고 있는 상태에서 REQUIRES_NEW 가 새 커넥션을 풀에서 빌리려고 하는데, 풀이 소진되면 outer 가 끝나기를 기다리고 outer 는 inner 가 끝나기를 기다리는 self-deadlock 이 발생합니다. 한 요청에서 REQUIRES_NEW 호출이 N 회 반복되면 N 개의 커넥션이 동시에 필요해지는 셈이죠. 회피 방법은 호출 빈도를 줄이거나, outer 의 트랜잭션을 잘게 쪼개서 끝낸 뒤 inner 를 별도 호출하거나, 풀 사이즈를 늘리는 겁니다.

**Q2.4** MySQL InnoDB 의 REPEATABLE READ 가 표준 정의보다 강한 이유는?
> ANSI 표준 정의로는 REPEATABLE READ 가 phantom read 를 허용하는데 InnoDB 는 phantom 까지 차단합니다. 두 메커니즘이 같이 작용하는데, 첫째는 MVCC 기반 consistent read — 일반 SELECT 는 트랜잭션 시작 시점의 스냅샷을 보니까 다른 트랜잭션의 commit 이 보이지 않습니다. 둘째는 gap lock + next-key lock — `SELECT ... FOR UPDATE` 같은 locking read 는 인덱스 범위에 gap lock 을 걸어 INSERT 까지 차단합니다. 따라서 MySQL 에서 REPEATABLE READ 면 phantom 이 거의 발생하지 않고, 코드를 PostgreSQL 로 옮길 때는 PostgreSQL default 가 READ COMMITTED 라서 격리가 약해지는 방향으로 변하니까 동시성 버그가 새로 드러날 수 있습니다.

**Q2.5** PostgreSQL 의 REPEATABLE READ 와 SERIALIZABLE 의 차이는?
> PostgreSQL 의 REPEATABLE READ 는 SI (Snapshot Isolation) 로 구현돼서 phantom 은 차단하지만 write skew 는 발생할 수 있습니다. write skew 는 두 트랜잭션이 서로 다른 row 를 보고 변경 결정을 했는데 결과적으로 제약 조건이 깨지는 케이스 — 예를 들면 "최소 한 명은 on-call 이어야" 같은 제약. SERIALIZABLE 은 SSI (Serializable Snapshot Isolation) 로 구현돼서 write skew 까지 막아줍니다. lock 없이 직렬화 가능성을 검사하는 방식이라 비용이 상대적으로 적습니다. 우리 msa 는 MySQL 이라 이 구분은 직접 마주칠 일이 적지만 PostgreSQL 마이그레이션이 검토되면 핵심 쟁점이 됩니다.

**Q2.6** `Isolation.DEFAULT` 는 어떤 의미인가요?
> DB 의 기본 격리 수준을 그대로 쓴다는 의미입니다. MySQL 은 REPEATABLE READ, PostgreSQL 과 Oracle 은 READ COMMITTED, SQL Server 도 READ COMMITTED 입니다. 같은 코드라도 DB 가 다르면 격리 동작이 다르다는 뜻이라서, 격리에 의존하는 비즈니스라면 `Isolation.READ_COMMITTED` 처럼 명시하는 게 안전합니다. msa 는 모든 서비스가 MySQL InnoDB 라 default 그대로 쓰고, isolation 명시가 거의 없습니다.

**Q2.7** `readOnly = true` 의 실제 효과는 무엇인가요?
> 네 가지가 직렬로 작동합니다. 첫째, Hibernate FlushMode 가 MANUAL 로 바뀌어 자동 flush 와 dirty check 를 안 합니다. 둘째, persistence context 가 entity snapshot 을 안 보관해서 메모리/CPU 를 절약합니다. 셋째, JDBC `Connection.setReadOnly(true)` 가 호출되는데 MySQL Connector/J 는 이걸 `SET SESSION TRANSACTION READ ONLY` 로 보내고, Aurora 같은 환경에서는 read replica 자동 라우팅 신호로 쓰입니다. 넷째, `TransactionSynchronizationManager` 에 readOnly 플래그가 ThreadLocal 로 노출돼서 application 레벨 라우팅에서 활용할 수 있습니다. 우리 msa 는 11개 JVM (Java Virtual Machine, 자바 가상 머신) 서비스가 이 4번째 효과로 `RoutingDataSource` 가 master/replica 를 분기하고 있습니다.

**Q2.8** `readOnly = true` 트랜잭션 안에서 entity 를 수정하면 어떻게 되나요?
> Silent failure 가 발생합니다. FlushMode 가 MANUAL 이라 dirty check 가 안 일어나고 JPA 가 SQL 자체를 발행하지 않아서 driver 의 readOnly 검사도 안 걸립니다. 메서드는 예외 없이 정상 리턴하고 in-memory 에서는 변경된 것처럼 보이지만 DB 에는 반영되지 않습니다. 가장 무서운 종류의 버그라서 msa convention 에서는 단순 조회는 `@Transactional` 자체를 빼고, readOnly 가 정말 필요한 경우 — multi-query 일관성, Lazy loading, replica 라우팅 — 에만 명시적으로 사용하도록 규정하고 있습니다.

**Q2.9** Master/Replica 라우팅을 어떻게 구현했나요? `LazyConnectionDataSourceProxy` 가 왜 필요한가요?
> Spring 의 `AbstractRoutingDataSource` 를 상속해서 `RoutingDataSource` 를 만들고, `determineCurrentLookupKey` 안에서 `TransactionSynchronizationManager.isCurrentTransactionReadOnly()` 를 봐서 readOnly 면 REPLICA, 아니면 MASTER 를 반환합니다. 그 위에 `LazyConnectionDataSourceProxy` 를 한 번 더 감싸는 게 핵심인데, 이유는 `AbstractRoutingDataSource` 만 쓰면 트랜잭션 시작 시점에 커넥션을 잡아버려서 readOnly 메타가 ThreadLocal 에 들어가기 전에 라우팅 결정이 잘못 일어날 수 있습니다. `LazyConnectionDataSourceProxy` 는 첫 SQL 실행 시점까지 커넥션 획득을 미루기 때문에 트랜잭션 메타가 확정된 후에 라우팅이 결정돼서 정확합니다. msa 11개 JVM 서비스 모두 이 패턴을 표준으로 적용하고 있습니다.

**Q2.10** Replica routing 의 한계는?
> Replica lag 으로 인한 read-after-write 비일관성이 가장 큰 약점입니다. 사용자가 글을 쓰자마자 새로고침하면 replica 에 아직 안 와서 안 보일 수 있습니다. 우리 msa 는 현재 stickiness 정책이 없어서 향후 ADR (Architecture Decision Record, 아키텍처 결정 기록) 로 정리할 후보입니다. 옵션은 Redis 에 "최근 N 초 동안 이 사용자는 master 로" 같은 마커를 두는 방식, 또는 read-after-write 가 중요한 endpoint 에 `@WithMaster` 같은 hint 를 다는 방식입니다. 또 다른 한계는 같은 트랜잭션 안에서 master/replica 를 동적으로 바꿀 수 없다는 점인데, 이건 명시적 트랜잭션 분리로 해결합니다.

**Q2.11** UnexpectedRollbackException 이 왜 발생하나요?
> 중첩된 `@Transactional` 호출에서 안쪽 메서드가 RuntimeException 을 던지면 Spring 이 그 트랜잭션을 rollback-only 로 마킹합니다. 바깥 메서드가 그 예외를 catch 해서 정상 리턴하려고 하면, Spring 이 commit 을 시도하면서 rollback-only 마킹을 발견하고 `UnexpectedRollbackException` 을 던집니다. catch 한다고 마킹이 풀리는 게 아닙니다. 회피 방법은 네 가지: 안쪽 메서드를 REQUIRES_NEW 로 분리해서 별 트랜잭션으로 만들거나, 예외 대신 nullable 을 리턴하는 OrNull 메서드를 따로 두거나, 가장 안전하게는 외부 메서드의 `@Transactional` 자체를 제거하고 오케스트레이션만 하게 만드는 것. msa 의 `OrderService.execute()` 가 그렇게 설계됐습니다.

**Q2.12** msa 의 `OrderService.execute()` 가 catch 함정을 어떻게 회피하나요?
> 메서드 자체에 `@Transactional` 이 없는 게 핵심입니다. 즉 catch 와 트랜잭션 경계가 분리됩니다. `OrderTransactionalService.savePendingOrder()` 호출이 TX1, `paymentPort.requestPayment()` 호출은 트랜잭션 밖, `OrderTransactionalService.completeOrder()` 또는 `cancelOrder()` 호출이 TX2 인 식으로 분리됩니다. 결제 실패 시 catch 안에서 cancelOrder 를 호출하는데 그게 별 빈의 별 트랜잭션이라 outer 의 rollback-only 마킹이 옮겨오지 않습니다. catch 마지막에 `throw BusinessException` 으로 호출자에게 명시적으로 전파해서 의도가 명확합니다.

---

## Phase 3: 외부 IO 분리 + 프로그래밍 방식 (8개)

**Q3.1** Kafka 발행과 DB 트랜잭션을 어떻게 결합하나요?
> 네 가지 옵션을 알지만 msa 는 Outbox 패턴을 표준으로 씁니다. 비즈니스 트랜잭션 안에서 `outbox_event` 테이블에 이벤트 row 를 같이 INSERT 하면 DB commit 시 entity 변경 + 이벤트 row 가 atomic 해집니다. 그 후 별도 `OutboxPollingPublisher` 가 1초 간격으로 PENDING 상태 row 를 Kafka 로 발행하고 성공하면 PUBLISHED 로 마킹합니다. 이 패턴이 at-least-once 시맨틱을 보장하기 때문에 consumer 측에서는 ADR-0012 의 idempotent consumer 패턴 — eventId + processed_event 테이블 — 으로 멱등성을 보장합니다. 외부 HTTP 같은 케이스는 다른 패턴 — `TransactionalService` 분리 — 를 쓰는데 OrderService 가 트랜잭션 없이 OrderTransactionalService 의 짧은 TX 를 단계별로 호출하고 그 사이에 결제 API 를 트랜잭션 밖에서 호출합니다.

**Q3.2** `@TransactionalEventListener` 와 Outbox 의 차이는?
> 견고성에서 차이가 큽니다. `@TransactionalEventListener AFTER_COMMIT` 은 commit 직후 in-memory 이벤트 리스너를 호출하는데, 그 안에서 Kafka 발행하다가 JVM 이 죽으면 이벤트가 손실됩니다. Outbox 는 DB 가 SSOT 라 발행이 보장되고, polling latency 만큼 지연되는 대신 견고합니다. 단순 내부 hook 이나 즉시성이 중요한 케이스는 `@TransactionalEventListener` 가 가볍고 좋은데, 외부 시스템과의 데이터 동기화 같은 견고성이 중요한 케이스는 Outbox 가 정답입니다. msa 는 outbox 만 쓰고 있고 `@TransactionalEventListener` 는 캐시 무효화 같은 가벼운 hook 으로 도입을 검토 중입니다.

**Q3.3** Saga 패턴이 분산 트랜잭션 (XA / 2PC) 과 어떻게 다른가요?
> XA / 2PC 는 모든 참여자가 commit 가능 여부를 미리 보고하고 coordinator 가 일괄 commit 하는 방식인데, 모든 참여자가 lock 을 잡은 채로 prepared 상태로 대기하니까 throughput 이 매우 낮고 coordinator 장애 시 in-doubt transaction 이 생기는 문제가 있습니다. Saga 는 그 정반대 — 각 참여자가 자기 로컬 트랜잭션을 즉시 commit 하고, 실패 시 보상 트랜잭션으로 원복합니다. 강한 isolation 을 포기하는 대신 가용성과 성능을 얻고 eventual consistency 를 받아들이는 trade-off 입니다. 단점은 보상 트랜잭션을 항상 만들 수 있는 게 아니라는 점 — 이메일 발송 보상이 사과 메일이 되는 식이죠. msa 는 choreography Saga 로 order → inventory → fulfillment 흐름을 구성하고 있습니다.

**Q3.4** Outbox 의 단점은?
> 네 가지 알고 있습니다. 첫째, polling interval 만큼 latency — 1초 미만 즉시성이 필요하면 CDC (Change Data Capture, 변경 데이터 캡처) (Debezium) 같은 대안이 더 적합합니다. 둘째, 테이블 무한 증가 — 별도 retention 정책 (7일 후 DELETE) 이 필요한데 msa 는 아직 미구현 입니다. 셋째, Kafka partition key 를 적절히 안 잡으면 같은 aggregate 의 이벤트 순서가 흔들립니다. 넷째, multi-replica 배포 시 두 인스턴스가 같이 폴링하면 중복 발행이 일어나서 SchedulerLock 같은 분산 락이 필요합니다. msa 는 1, 2번이 미해결 — 폴링 1초 latency 는 비즈니스적으로 허용 범위라서 그대로 두고 retention 스케줄러는 ADR 후보로 정리할 예정입니다.

**Q3.5** TransactionTemplate 은 언제 쓰나요?
> 거의 안 씁니다. `@Transactional` 이 선언적이라 코드가 깔끔하고, 함정도 클래스 분리로 거의 다 풀리니까요. 그래도 알고 있는 케이스는 두 가지: 첫째, 동적으로 timeout 이나 propagation 을 바꿔야 할 때. 둘째, suspend 함수처럼 ThreadLocal 기반 트랜잭션 동기화가 어색한 곳에서 명시적으로 트랜잭션 경계를 정해야 할 때입니다. 다만 msa 는 suspend 인 OrderService 도 non-suspend 인 OrderTransactionalService 빈을 호출하는 우회로 풀어서 TransactionTemplate 없이 모든 케이스를 처리하고 있습니다.

**Q3.6** 외부 API 호출 (e.g. 결제) 을 트랜잭션 안에서 하면 어떤 문제가 생기나요?
> 세 가지 문제가 있습니다. 첫째, 커넥션 점유 — HTTP 호출이 수 초 걸리는 동안 DB 커넥션을 잡고 있어서 풀 사이즈에 압력이 가고 latency budget 을 깨뜨립니다. 둘째, phantom 이벤트 또는 이중 발행 — 트랜잭션 안에서 Kafka 발행하면 commit 전에 발행돼서 트랜잭션 롤백 시 이벤트만 broker 에 남거나, after_commit 보장 없이 발행되니 consumer 가 존재하지 않는 entity 의 이벤트를 받을 수 있습니다. 셋째, 부분 실패 회복 불가 — 외부 API timeout 시 실제로 처리됐는지 모르는 상태에서 롤백하면 외부는 commit 됐는데 우리는 롤백된 상태가 됩니다. 그래서 msa 는 TransactionalService 분리 + Outbox 로 외부 IO (Input/Output, 입출력) 를 트랜잭션 밖으로 빼냅니다.

**Q3.7** ADR-0012 idempotent consumer 의 핵심 메커니즘은?
> 모든 Kafka 이벤트에 UUID `eventId` 필드를 추가하고, consumer 측에서 `processed_event` 테이블 — `event_id PRIMARY KEY` — 로 중복 체크합니다. 메시지를 받으면 eventId 추출 → processed_event 조회 → 존재하면 ACK 후 skip, 없으면 비즈니스 로직 실행 + processed_event INSERT 를 같은 트랜잭션 안에서 처리. eventId INSERT 가 PK 충돌하면 자동으로 롤백돼서 동시성 안전합니다. Outbox 의 at-least-once 와 결합해서 effectively-once 시맨틱을 만듭니다. 보관 정책은 7일이고 `processed_event` retention 스케줄러도 운영 중입니다.

**Q3.8** Reactive 환경 (WebFlux + R2DBC) 에서 트랜잭션은 어떻게 다른가요?
> `TransactionSynchronizationManager` 가 ThreadLocal 기반이라 Reactor / WebFlux 환경에서는 그대로 안 통합니다. Thread 가 자유롭게 hop 하니까요. 대안은 `ReactiveTransactionManager` + `TransactionalOperator` 인데 R2DBC 같은 reactive driver 가 필요합니다. Spring 5+ 의 `@Transactional` 은 reactive return type (Mono/Flux) 도 인식해서 `TransactionalOperator` 와 결합하면 선언적으로도 가능합니다. 우리 msa 는 JPA + JDBC 환경이라 reactive 트랜잭션은 미사용이고, suspend 함수는 빈 분리 패턴으로 처리합니다.

---

## Phase 4: msa 코드베이스 (8개)

**Q4.1** msa 의 트랜잭션 정책은 어떻게 되나요?
> 11개 JVM 서비스가 ADR-0020 (transactional usage) + ADR-0022 (entity mutation) + ADR-0012 (idempotent consumer) 의 3개 ADR 을 표준으로 따릅니다. 외부 HTTP 가 있는 서비스 (order) 는 OrderService (오케스트레이션, TX 없음) + OrderTransactionalService (DB 트랜잭션) 로 분리해서 PENDING → 결제 → COMPLETED 의 짧은 트랜잭션 두 개로 쪼갭니다. Kafka 발행이 있는 서비스 (inventory, fulfillment, quant) 는 Outbox 패턴으로 DB commit 과 이벤트가 atomic 하게 보장되고 별도 polling publisher 가 1초 간격으로 발행합니다. Replica 라우팅은 `AbstractRoutingDataSource + LazyConnectionDataSourceProxy` 가 11개 서비스 표준이고 readOnly 트랜잭션을 자동으로 replica 로 보냅니다.

**Q4.2** `OrderTransactionalService` 와 `OrderService` 를 분리한 이유는?
> 외부 HTTP 호출 (PaymentPort) 이 트랜잭션 안에 있으면 안 되기 때문입니다. OrderService 는 오케스트레이션 — TX 없는 흐름 — 만 담당하고, savePendingOrder / completeOrder / cancelOrder 같은 짧은 DB 트랜잭션만 OrderTransactionalService 에 위임합니다. 외부 HTTP 는 두 짧은 트랜잭션 사이에서 트랜잭션 밖에서 실행됩니다. 이렇게 분리하면 self-invocation 문제도 자동으로 풀리고 — 다른 빈을 거치니까 — , catch 함정도 회피됩니다 — outer 메서드에 `@Transactional` 이 없으니 rollback-only 마킹 우려 없음. ADR-0020 의 4가지 규칙을 한꺼번에 만족하는 패턴입니다.

**Q4.3** msa 의 모든 서비스가 RoutingDataSource 를 쓰는데 효과가 있나요?
> 효과는 정량적으로 측정해야 정확하지만 패턴 자체는 정확합니다. `@Transactional(readOnly = true)` 가 명시된 메서드만 replica 로 가고 나머지는 master 로 갑니다. 단, 단순 조회에 `@Transactional` 을 안 붙이는 게 컨벤션이라 그런 케이스는 master 로 라우팅됩니다 — Spring Data JPA 의 자동 트랜잭션이 readOnly=false 라서. 의도한 건지 미흡한 건지 정책으로 통일할 필요가 있는데, replica lag 로 인한 read-after-write 비일관성을 회피하려면 단순 조회를 master 로 보내는 게 안전 — read-your-write 보장 — 하기도 합니다. 향후 stickiness ADR 로 정책을 명확히 할 예정입니다.

**Q4.4** Inventory 의 `@Transactional` 안에서 Redis 캐시를 호출하는데 ADR-0020 위반 아닌가요?
> 약한 충돌이 있지만 의도적 트레이드오프입니다. Redis 호출이 sub-millisecond 라 커넥션 점유 영향이 미미하고, fast-path 검증과 캐시 동기화가 한 트랜잭션 안에서 일관성 있게 처리되는 게 비즈니스적으로 더 중요합니다. 캐시 동기화는 try-catch 로 감싸서 Redis 실패가 비즈니스 흐름을 막지 않게 흡수하고 있습니다. ADR-0020 의 규칙은 절대 규칙이 아니라 case-by-case 판단입니다 — 외부 HTTP (수 초) 는 절대 안 되지만 Redis (1ms 미만) 는 허용 가능. 향후 `@TransactionalEventListener AFTER_COMMIT` 로 캐시 동기화를 분리하는 개선도 검토 중입니다.

**Q4.5** msa 의 동시성 충돌 시나리오는?
> 가장 위험한 곳은 Inventory 의 reserve 입니다. 두 요청이 동시에 같은 productId/warehouseId 에 reserve 를 시도하면 lost update 가 가능합니다. 현재 코드는 일반 SELECT + 도메인 검증 + UPDATE 라서 동시성 보장이 없고, Redis fast-path 도 단순 캐시일 뿐 동시성 메커니즘이 아닙니다. 개선 후보로 `@Version` (optimistic) 또는 `SELECT FOR UPDATE` (pessimistic) 도입을 검토 중인데 충돌 빈도가 낮으면 optimistic 이 throughput 좋고, 높으면 pessimistic 이 정확하니까 트래픽 패턴 보고 결정합니다. 보조적으로 ReservationExpiryService 가 30분 TTL 만료된 reservation 을 자동 정리하는 안전망 역할을 합니다.

**Q4.6** msa 의 Saga 보상 흐름은 완전한가요?
> 부분적으로만 완성돼 있습니다. 정상 흐름은 order → inventory → fulfillment 의 choreography 로 잘 흐르지만, 재고 부족 같은 보상 케이스는 InventoryService 의 ReleaseStockByOrderUseCase 와 ReservationExpiryService 가 일부 처리합니다. 단, 결제까지 완료된 후 fulfillment 가 실패하는 케이스의 환불 흐름은 manual intervention 가능성이 있습니다 — 자동화하려면 PaymentPort 에 환불 메서드 + 재시도 정책 + 보상 chain 명시가 필요합니다. 이 부분은 별도 ADR 로 정리할 후보입니다.

**Q4.7** Outbox 가 multi-replica 배포에서 중복 발행을 어떻게 막나요?
> 현재 msa 코드만 보면 안 막고 있습니다. `@Scheduled` 가 모든 인스턴스에서 동시에 도는 구조라 두 인스턴스가 같이 폴링하면 같은 row 를 두 번 발행할 수 있습니다. 해결 후보는 SchedulerLock (ShedLock 라이브러리) 으로 leader election 하는 거고, backend 는 Redis 또는 JDBC 가 가능합니다. 또는 폴링 쿼리를 `SELECT ... FOR UPDATE SKIP LOCKED` 로 바꿔서 row 단위로 leader 가 정해지게 하는 방식도 있습니다. ADR 후보로 정리해서 multi-replica 안전화를 진행할 예정입니다.

**Q4.8** Read-After-Write 비일관성을 어떻게 해결할 계획인가요?
> 옵션 세 개 알고 있고 신규 ADR 로 정리할 예정입니다. 옵션 A 는 Redis 에 "최근 N 초 동안 이 사용자는 master 로" 마커를 두는 session stickiness — 사용자별로 정확하지만 Redis 의존성이 추가됩니다. 옵션 B 는 `@WithMaster` 같은 hint annotation 으로 특정 endpoint 를 강제 master 라우팅하는 방식 — 코드 의도가 명확하지만 endpoint 별 결정 부담. 옵션 C 는 service 가 직접 master repository 를 호출하는 명시적 분리 — 가장 단순하지만 라우팅 책임이 service 로 분산. 트래픽 특성과 운영 복잡도 봐서 선택할 예정인데 옵션 A 가 가장 균형 좋다고 봅니다.

---

## 50문항 인덱스 (간략 키워드)

### 기본 메커니즘
1. AOP 프록시 동작 ↦ Q1.1
2. CGLIB vs JDK ↦ Q1.2
3. Checked 미롤백 이유 ↦ Q1.3
4. 클래스 레벨 위험 ↦ Q1.4
5. 인터페이스 위치 ↦ Q1.5
6. self-invocation ↦ Q1.6
7. private 메서드 ↦ Q1.7
8. suspend 함수 ↦ Q1.8

### 전파 / 격리 / readOnly
9. REQUIRES_NEW vs NESTED ↦ Q2.1
10. self-invocation + propagation ↦ Q2.2
11. REQUIRES_NEW 데드락 ↦ Q2.3
12. InnoDB REPEATABLE READ phantom 차단 ↦ Q2.4
13. PostgreSQL SI vs SSI ↦ Q2.5
14. Isolation.DEFAULT ↦ Q2.6
15. readOnly 4효과 ↦ Q2.7
16. readOnly silent failure ↦ Q2.8
17. Routing + LazyConnection 이유 ↦ Q2.9
18. Replica routing 한계 ↦ Q2.10
19. UnexpectedRollbackException ↦ Q2.11
20. msa OrderService catch 회피 ↦ Q2.12
21. rollbackFor / noRollbackFor 사용 시점
22. write skew 와 SERIALIZABLE
23. JPA NESTED 미지원
24. Hibernate FlushMode AUTO/MANUAL/COMMIT
25. Optimistic vs Pessimistic Lock
26. dirty check 비용
27. PersistenceContext snapshot
28. SELECT FOR UPDATE / LOCK IN SHARE MODE

### 외부 IO 분리
29. Outbox 시맨틱 ↦ Q3.1
30. @TransactionalEventListener vs Outbox ↦ Q3.2
31. Saga vs XA/2PC ↦ Q3.3
32. Outbox 단점 ↦ Q3.4
33. TransactionTemplate 사용 시점 ↦ Q3.5
34. 외부 HTTP in TX 문제 ↦ Q3.6
35. ADR-0012 idempotent consumer ↦ Q3.7
36. Reactive 트랜잭션 ↦ Q3.8
37. AFTER_COMMIT vs BEFORE_COMMIT
38. choreography vs orchestration Saga
39. CDC (Debezium) vs Outbox
40. SchedulerLock 의 필요

### msa 코드베이스
41. msa 트랜잭션 정책 종합 ↦ Q4.1
42. OrderService/Transactional 분리 ↦ Q4.2
43. RoutingDataSource 효과 ↦ Q4.3
44. Inventory + Redis in TX ↦ Q4.4
45. msa 동시성 충돌 ↦ Q4.5
46. Saga 보상 ↦ Q4.6
47. multi-replica 중복 발행 ↦ Q4.7
48. Read-After-Write stickiness ↦ Q4.8
49. ProductTransactionalService vs OrderTransactionalService 차이
50. ReservationExpiryService 의 역할

---

## 자가 평가 — 학습 후 즉시 답할 수 있어야 할 5개

이 5개를 막힘없이 답할 수 있으면 본 학습이 충분히 정착된 것:

1. `@Transactional` 이 동작하지 않는 5대 원인 즉답
2. REQUIRES_NEW vs NESTED 의 4가지 차이 (TX 개수 / 격리 / 부분 commit / JPA 지원)
3. `readOnly = true` 의 4가지 효과 (FlushMode / snapshot / setReadOnly / TxSync)
4. msa 의 RoutingDataSource + LazyConnectionDataSourceProxy 가 함께 쓰이는 이유
5. UnexpectedRollbackException 의 메커니즘 + 4가지 회피 방법

---

## 회독 가이드

- **회독 1 (학습 직후)**: 모든 Q&A 한 번 정독, 답이 안 나오는 곳 표시
- **회독 2 (1주 후)**: 표시한 곳만 다시
- **회독 3 (1개월 후)**: 50문항 인덱스 키워드만 보고 즉답 연습 (실제 면접 모드)
