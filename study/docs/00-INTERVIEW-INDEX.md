# msa Study — Interview Master Index

> 19개 주제의 면접 카드를 통합. Top 빈출 / 영역별 / 모의 면접 시나리오 / 1시간 회독 가이드.
> 한국 대기업 백엔드 시니어/테크리드 면접 대비 최종 회독용.

---

## 0. 사용 가이드

- 1차 회독 (학습 직후): Section 1 통계 + Section 7 출처별 인덱스로 전체 지도화
- 2차 회독 (1주 후): Section 2 Top 50 빈출 + Section 5 함정 30선
- 3차 회독 (면접 1주 전): Section 3 영역별 분류 정독 + Section 4 모의 시나리오
- 면접 직전 (1시간): Section 6 압축 가이드만

답변 4단 구조 (모든 답변 공통):
1. **결론 한 줄** — "X 로 풉니다"
2. **이유/메커니즘** — 왜 그런지, 자료구조/알고리즘/프로토콜 수준
3. **트레이드오프** — "단 Y 환경에선 Z 검토"
4. **msa 사례** — "본 프로젝트에서는..."

---

## 1. 통계 (per topic)

| # | 주제 | 카드 수 | 핵심 카드 | 출처 |
|---|---|---|---|---|
| 1 | AWS Network | 10 Q + 트리 + 함정 10 + 시나리오 2 | 20+ | [1-aws-network/19-interview-qa.md](1-aws-network/19-interview-qa.md) |
| 2 | JVM/GC | 48 + 함정 4 + 시나리오 2 | 52 | [2-jvm-gc/22-interview-qa.md](2-jvm-gc/22-interview-qa.md) |
| 3 | Java/Kotlin Concurrency | 38 (10+12+8+8) | 38 | [3-java-kotlin-concurrency/24-interview-qa.md](3-java-kotlin-concurrency/24-interview-qa.md) |
| 4 | DB Index/Transaction | 42 (8+10+9+10) | 42 | [4-db-index-transaction/18-interview-qa.md](4-db-index-transaction/18-interview-qa.md) |
| 5 | Spring @Transactional | 50 (8+12+8+8 + 인덱스 14) | 36 | [5-spring-transactional/14-interview-qa.md](5-spring-transactional/14-interview-qa.md) |
| 6 | Kafka Internals | 48 (8×6) | 48 | [6-kafka-internals/12-interview-qa.md](6-kafka-internals/12-interview-qa.md) |
| 7 | Distributed Systems | 40 (8×5) + 종합 4 | 44 | [7-distributed-systems/20-interview-qa.md](7-distributed-systems/20-interview-qa.md) |
| 8 | System Design | 50 (10시나리오 × 5) | 50 | [8-system-design/13-interview-qa.md](8-system-design/13-interview-qa.md) |
| 9 | Redis Deep Dive | 55 (영역 9개) | 55 | [9-redis-deep-dive/19-interview-qa.md](9-redis-deep-dive/19-interview-qa.md) |
| 10 | Observability | 40 + 빠른 회독 10 | 50 | [10-observability/14-interview-qa.md](10-observability/14-interview-qa.md) |
| 11 | K8s Deep Dive | 41 (Phase 7개) | 41 | [11-k8s-deep-dive/17-interview-qa.md](11-k8s-deep-dive/17-interview-qa.md) |
| 12 | Latency Numbers | 6 트리 × 2단계 = 18 + 실측 5 | 23 | [12-latency-numbers/11-interview-qa.md](12-latency-numbers/11-interview-qa.md) |
| 13 | Crypto/JWT/SSO | 50 (8×5 + 인덱스) | 40 | [13-crypto-jwt-sso/20-interview-qa.md](13-crypto-jwt-sso/20-interview-qa.md) |
| 14 | CRDT/MRDT | 50 (8+12+10+10 + 인덱스) | 40 | [14-crdt-mrdt/19-interview-qa.md](14-crdt-mrdt/19-interview-qa.md) |
| 15 | Connection Pool | 7 정면 × 4 = 28 + 인덱스 50 | 35 | [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md) |
| 16 | Async/Nonblocking IO | 38 (8+6+5+10+3+6) + 인덱스 50 | 38 | [16-async-nonblocking-io/19-interview-qa.md](16-async-nonblocking-io/19-interview-qa.md) |
| 17 | Spring Web | 36 (8+10+8+6+4) | 36 | [17-spring-web/20-interview-qa.md](17-spring-web/20-interview-qa.md) |
| 18 | gRPC | 30 (10+12+8) | 30 | [18-grpc/20-interview-qa.md](18-grpc/20-interview-qa.md) |
| 19 | 검색엔진 심화 (ES · BM25 · Hybrid · Re-Rank) | 17 + 꼬리 3단계 + 악마의 변호인 17 | 50+ | [19-search-engine/20-interview-qa.md](19-search-engine/20-interview-qa.md) |

**총합**: 약 780개 카드, 핵심 카드 약 720개 (#19 추가 반영)

---

## 2. Top 50 빈출 질문 (cross-topic 종합)

실제 한국 대기업 면접에서 출제 빈도 높은 50개 (학습 자료의 "빈출/Top/필수" 표시 + 시니어 면접 표준 + cross-cutting 패턴 종합).

### 2.1 런타임/JVM (Top 1-10)

**Q1. "GC 가 멈출 때 어떻게 진단하나요?"**
> A: GC 로그(`-Xlog:gc*`) → GCEasy 분석 → 5지표(Pause P99 / Throughput / Allocation Rate / Promotion / Old 점유율) 확인. 동시에 JFR continuous 로 allocation hot spot. STW 시점과 P99 spike 가 겹치면 GC 가 원인. 알고리즘 변경(G1 → ZGC), heap 조정, 객체 재사용 검토.
> 꼬리: "Full GC 가 보이면 어떻게?" / "ZGC 가 G1 보다 항상 좋은가?"
> 출처: #2 Q25, #10 Q40, #12 Q2

**Q2. "JVM 메모리 영역 5가지 + Xmx 가 컨테이너 limit 와 어떻게 다른가?"**
> A: Heap, Metaspace, Stack, PC Register, Native(Direct/Code/GC). limit = RSS = 힙 + native 전부. 힙은 70-75% (`MaxRAMPercentage=70`), 30% 가 native. 절대값 (-Xmx) 보다 비율 권장 — limit 변경 시 자동 추적.
> 꼬리: "OOMKilled 와 Java OOM 5종 차이?" / "MaxRAMPercentage 75 가 default 인데 70 권장 이유?"
> 출처: #2 Q1, Q7, Q41, #11 Q4, Q38

**Q3. "ZGC 와 G1 중 무엇을 언제 쓰나요?"**
> A: G1 = 일반 서비스 (4GB-수십GB), pause 200ms 충분, default. ZGC = 큰 힙(8GB+), sub-ms pause 필요, latency 절대 우선. ZGC 는 Compressed Oops 손실 + throughput 5-10% 감소 트레이드오프. 작은 힙(<4GB)은 G1 이 더 효율.
> 꼬리: "ZGC 의 Colored Pointer 가 뭔가?" / "Generational ZGC 의 의미?"
> 출처: #2 Q21, Q23, #12 Q2-1-1

**Q4. "synchronized 와 volatile 차이?"**
> A: synchronized = 원자성 + 가시성 + 재진입. volatile = 가시성 + reordering 방지만, 원자성 없음. 단일 read/write 는 volatile, 복합 연산(`count++`)은 Atomic 또는 synchronized. 매우 높은 contention 카운터는 LongAdder.
> 꼬리: "DCL 에 volatile 빠지면?" / "happens-before 와의 관계?"
> 출처: #3 Q1.2, Q1.3, Q2.1, Q2.2

**Q5. "Virtual Thread 가 뭐고 언제 쓰나?"**
> A: JDK 21 stable, carrier thread 위 mount/unmount 되는 가벼운 스레드. blocking IO 호출 시 자동 unmount → carrier 풀려남. 1개 비용 수백 B 라 수백만 동시 가능. blocking IO 많은 일반 MVC 서비스 1순위, JDK 25 부터 synchronized pinning 거의 해소.
> 꼬리: "pinning 이 뭔가?" / "WebFlux 의 의미가 줄어든 이유?"
> 출처: #3 Q2.11, Q2.12, #16 Q27, Q32

**Q6. "Coroutine 의 suspend 가 어떻게 비동기인가?"**
> A: 컴파일러가 suspend 함수를 state machine 으로 변환. 각 suspension point 에서 함수가 `COROUTINE_SUSPENDED` 반환 → 호출 chain 즉시 return → 스레드 풀려남. `Continuation.resumeWith()` 호출 시 같은 함수에 재진입. 한 스레드가 수천 coroutine 처리.
> 꼬리: "Reactor 와 어떻게 비교?" / "Structured Concurrency 의 가치?"
> 출처: #3 Q2.9, Q2.10, #16 Q30, Q31

**Q7. "thread dump 어떻게 수집/분석?"**
> A: `jcmd <pid> Thread.print -l` (ReentrantLock 보려면 `-l`). 컨테이너면 `kubectl exec -- jcmd 1 Thread.print -l`. 단발 dump 부족 — 5초 간격 3-5회 떠서 추세 비교. BLOCKED 의 lock ID 매칭으로 owner 추적 → 들고 있는 스레드 stack 분석.
> 꼬리: "RUNNABLE 인데 hang 같다?" / "데드락 자동 검출은?"
> 출처: #3 Q3.1-3.4

**Q8. "OOMKilled 진단 절차?"**
> A: 1) JVM 안 OOM 메시지 있나? 5종류 분류. 2) 없으면 Exit 137 = cgroup limit 초과. 3) NMT diff 로 어느 영역이 늘었는지. 4) heap 정상 + native ↑ → leak detector / Metaspace / Thread.
> 꼬리: "NMT 사용법?" / "MaxDirectMemorySize 미지정 위험?"
> 출처: #2 Q26, Q42, #11 Q4, Q38

**Q9. "JIT 의 inlining / escape analysis?"**
> A: Inlining = 작은 메서드(35 byte) 를 호출지에 펼침 + 추가 최적화 기회. Escape Analysis = 객체가 메서드 escape 안 하면 힙 할당 생략 + 스택/레지스터 분해(scalar replacement). JMH `-prof gc` 의 alloc.rate.norm 으로 검증.
> 꼬리: "warm-up 단축 방법?" / "deoptimization 트리거?"
> 출처: #2 Q34, Q35, Q38

**Q10. "msa 가 @Async 안 쓰는 이유?"**
> A: ADR-0002 — Spring MVC + JPA blocking + Kotlin coroutine(외부 IO) + Tomcat VT. coroutine 이 비동기를 직선 코드로 처리 + structured concurrency 로 lifecycle 관리 → @Async 함정(default SimpleAsyncTaskExecutor = 풀 없음, ThreadLocal 안 따라감) 자연 회피.
> 꼬리: "coroutine 사용 패턴?" / "VT 적용 후보?"
> 출처: #3 Q4.1, Q4.5, Q4.6

### 2.2 저장소/데이터 (Top 11-20)

**Q11. "InnoDB 의 PK 가 왜 그렇게 중요한가요?"**
> A: clustered index = PK 라 테이블 자체가 PK 순 정렬. secondary index leaf 가 row 위치 아닌 PK 값 보유 → secondary 조회는 항상 secondary lookup → clustered lookup 의 2단계. PK 가 길거나 무작위(UUIDv4) 면 모든 secondary index 가 비대 + page split.
> 꼬리: "PostgreSQL 도 같은가?" / "UUIDv7 이 왜 권장?"
> 출처: #4 Q1.2

**Q12. "InnoDB RR 에서 phantom read 발생하나?"**
> A: 표준 SQL 정의로는 RR 에서 phantom 가능하지만, InnoDB 는 next-key lock + gap lock 으로 phantom 까지 차단. 단순 SELECT(consistent read)는 snapshot, locking read(FOR UPDATE)는 lock 으로 차단 — 두 메커니즘이 짝.
> 꼬리: "그럼 SERIALIZABLE 인가?" / "write skew?"
> 출처: #4 Q2.2, #5 Q2.4

**Q13. "@Transactional 의 동작 원리는?"**
> A: Spring AOP proxy 기반. CGLIB(Boot 기본) 또는 JDK Dynamic Proxy 가 메서드 가로채 TransactionInterceptor 호출 → PlatformTransactionManager.getTransaction() → target 실행 → 정상이면 commit, RuntimeException/Error 면 rollback. 비즈니스 코드에 트랜잭션 코드 0줄.
> 꼬리: "self-invocation 함정?" / "private 메서드 동작?"
> 출처: #5 Q1.1, Q1.6, Q1.7

**Q14. "REQUIRES_NEW vs NESTED 차이?"**
> A: REQUIRES_NEW = 별 트랜잭션 + 별 커넥션. inner 가 commit 되면 outer 가 롤백돼도 살아남음. NESTED = outer 와 같은 트랜잭션 안 Savepoint(부분 롤백). JpaTransactionManager 가 NESTED 미지원(`NestedTransactionNotSupportedException`) — JPA 에선 사실상 REQUIRES_NEW 만.
> 꼬리: "REQUIRES_NEW 데드락?" / "self-invocation 시 propagation?"
> 출처: #5 Q2.1, Q2.2, Q2.3

**Q15. "readOnly = true 의 4가지 효과?"**
> A: 1) Hibernate FlushMode MANUAL → dirty check 안 함. 2) snapshot 미보관 → 메모리 절약. 3) JDBC Connection.setReadOnly(true) → MySQL `SET SESSION TRANSACTION READ ONLY`, Aurora replica 라우팅 신호. 4) TransactionSynchronizationManager.isCurrentTransactionReadOnly() → 앱 라우팅. msa 11개 서비스가 4번째로 RoutingDataSource 가 master/replica 분기.
> 꼬리: "readOnly 안 write 시?" / "LazyConnectionDataSourceProxy 가 왜 필요?"
> 출처: #5 Q2.7, Q2.8, Q2.9, #15 Q4

**Q16. "RoutingDataSource + LazyConnectionDataSourceProxy 가 함께 쓰이는 이유?"**
> A: AbstractRoutingDataSource 만 쓰면 transaction 시작 시점에 connection 획득하는데 그때는 readOnly 가 ThreadLocal 에 binding 안 됐음 → 항상 master. LazyConnectionDataSourceProxy 가 첫 SQL 실행 시점까지 connection 획득을 미뤄 readOnly 정보 binding 후 라우팅 결정.
> 꼬리: "빠지면 어떤 버그?" / "메트릭으로만 감지 가능?"
> 출처: #5 Q2.9, #15 Q4

**Q17. "HikariCP 풀 사이즈 어떻게 정하나?"**
> A: Little's Law: L = λ × W. 피크 RPS × 평균 query latency = 동시 connection 수. 1.5-2배 margin → 서비스 측 풀. 다음 (인스턴스 수 × 풀 사이즈) ≤ DB max_connections × 0.8 검증. "small is fast" — 작은 풀이 context switch / cache miss / lock contention 모두 줄임.
> 꼬리: "RPS 두 배 시?" / "DB max_connections 한계 도달 시?"
> 출처: #15 Q1, Q4.5, #12 Q5

**Q18. "Cache Stampede 가 뭐고 방어 4가지?"**
> A: hot key 만료 + 동시 요청 폭주로 DB 가 동일 query 폭격. 방어: (1) TTL jitter, (2) 분산 락 single-flight, (3) Probabilistic Early Recomputation (XFetch) — TTL 가까워질수록 호출자가 확률적으로 미리 refresh, (4) Refresh-Ahead background.
> 꼬리: "XFetch 직관?" / "msa 의 fast-path?"
> 출처: #9 Q38, Q39, #12 Q3-1-1

**Q19. "Redis 가 왜 빠른가?"**
> A: 메모리 상주 + 단일 스레드 명령 루프 + epoll I/O 멀티플렉싱. 락/컨텍스트 스위치/캐시 invalidation 0, 거의 모든 명령 O(1). RTT µs 단위 → 단일 노드 100k QPS. 단일 스레드라 KEYS / SMEMBERS / DEBUG SLEEP 같은 O(N) 금지.
> 꼬리: "단일 스레드인데 멀티 코어?" / "DEL 과 UNLINK 차이?"
> 출처: #9 Q1, Q2, Q3

**Q20. "RDB vs AOF 어떻게 결합?"**
> A: RDB = 시점 binary 스냅샷(압축, restore 빠름, 손실 가능). AOF = 명령 단위 append(1초 손실, 파일 큼, restore 느림). 운영 표준은 mixed (`aof-use-rdb-preamble=yes`) — AOF rewrite 시 child 가 RDB 형식 dump + 새 명령 append. AOF 안정성 + RDB 빠른 restore.
> 꼬리: "BGSAVE 의 fork CoW?" / "fsync 옵션?"
> 출처: #9 Q21, Q22, Q23, Q25, Q27

### 2.3 메시징/통신 (Top 21-30)

**Q21. "Kafka 의 토픽과 파티션 관계?"**
> A: 토픽 = 논리 카테고리, 파티션 = 물리 로그 파일. 한 토픽이 N partition 으로 쪼개져 broker 들에 분산. 파티션은 **병렬화 단위 + 순서 보장 단위 + 장애 복구 단위** 셋. 한 파티션 내부에서만 순서 보장.
> 꼬리: "사후 partitions 늘리면?" / "consumer 의 concurrency 효과?"
> 출처: #6 Q1.1, Q1.2

**Q22. "Kafka acks=0/1/all 차이? min.ISR 과의 관계?"**
> A: 0 = 응답 안 기다림(분실 가능). 1 = leader 디스크 write 후 ack. all = ISR 전체 복제 후 ack. RF=3 + min.ISR=2 → 1대 장애까지 안전. msa 표준 = acks=all + min.ISR=2 강제.
> 꼬리: "enable.idempotence 가 정확히 뭘 막나?" / "URP 위험?"
> 출처: #6 Q1.3, Q1.8, Q2.1, Q2.2

**Q23. "Outbox 패턴이 뭔가?"**
> A: DB tx 안에서 outbox 테이블에 이벤트 row 같은 tx 로 INSERT → commit 시 entity 변경 + 이벤트 row atomic. 별도 polling/CDC publisher 가 Kafka 발행. **Dual write 문제 해결**. msa 의 inventory/fulfillment/quant 표준.
> 꼬리: "@TransactionalEventListener 와 차이?" / "단점?"
> 출처: #5 Q3.1, Q3.2, Q3.4, #6 Q4.4, #7 Q3.8

**Q24. "Idempotent Consumer 패턴?"**
> A: ADR-0012 표준 — 모든 Kafka 이벤트에 UUID eventId, consumer 측 processed_event 테이블(`event_id PK`). 메시지 받으면 eventId 추출 → processed_event 조회 → 존재하면 skip, 없으면 비즈니스 로직 + processed_event INSERT 같은 tx. PK 충돌로 중복 자동 차단. Outbox 의 at-least-once 와 결합 → effectively-once.
> 꼬리: "보관 기간?" / "EOS 와 차이?"
> 출처: #5 Q3.7, #6 Q3.4, Q4.1, #7 Q3.6

**Q25. "Saga Choreography vs Orchestration?"**
> A: Choreography = 이벤트 기반 decoupling, 단계 ≤ 4. Orchestration = 중앙 조정자, 단계 ≥ 5 또는 추적/감사 요구. msa 는 inventory ↔ fulfillment 가 Choreography(3-4 단계). 보상 트랜잭션은 멱등 + commutative + Pivot transaction(이메일)은 보상 불가.
> 꼬리: "2PC 가 MSA 에서 안 쓰이는 이유?" / "Saga 가 영원히 멈추는 시나리오?"
> 출처: #7 Q3.1, Q3.2, Q3.3

**Q26. "DLQ 메시지 어떻게 재처리?"**
> A: DLQ 토픽(.DLT) 구독하는 별도 consumer + 관리자 API 로 원본 토픽 재발행. DefaultErrorHandler 가 추가한 헤더(`kafka_dlt-original-topic`, `kafka_dlt-exception-message`) 로 컨텍스트 파악. 재처리 시 컨슈머 멱등성으로 중복 방어.
> 꼬리: "FixedBackOff vs Exponential?" / "DLT 모니터링?"
> 출처: #6 Q4.2, Q4.5

**Q27. "Consumer Lag 폭증 진단 순서?"**
> A: 1) `kafka-consumer-groups --describe` — 어느 partition. 2) 컨슈머 로그 — rebalance 빈도/처리 시간. 3) APM trace — 처리 단계 어디서 느림. 4) 임시 조치(scale-out / max.poll.records 줄이기). 5) 근본 원인(외부 API / DB 튜닝).
> 꼬리: "Cooperative-Sticky vs Eager rebalance?" / "max.poll.interval.ms 타임아웃 시?"
> 출처: #6 Q3.1, Q3.2, Q3.3, Q4.6

**Q28. "REST 와 gRPC 본질적 차이?"**
> A: REST = 리소스 표현(URL=자원, HTTP 메서드=동작, JSON). gRPC = 함수 호출 추상화(proto RPC 1급, URL 단순 라우팅, Protobuf binary). 데이터 결합은 gRPC 강함(field number), 시간/위치 결합은 둘 다 동기. 진짜 느슨함은 Kafka.
> 꼬리: "Protobuf 가 빠른 이유?" / "field number 가 왜 영구 불변?"
> 출처: #18 Q1, Q2, Q5

**Q29. "K8s 에서 gRPC 가 한 pod 만 받는 이유?"**
> A: HTTP/2 multiplexing(1 connection 위 다수 stream) + ClusterIP 의 L4 LB 충돌. connection 단위 분배라 한 connection = 한 pod. 해법: Headless service + 클라 round_robin / Envoy or Istio mesh / ingress-nginx gRPC 모드 / xDS resolver.
> 꼬리: "Lettuce Redis cluster 도 같은 패턴?" / "WebSocket 도 영향?"
> 출처: #18 Q12, #11 Q13

**Q30. "Deadline propagation 이 뭔가?"**
> A: 클라가 timeout 부여하면 모든 downstream gRPC 호출에 자동 전파. 클라 `withDeadlineAfter(500, MS)` → `grpc-timeout: 500m` metadata. 서버는 다른 gRPC 호출 시 *남은 시간* 으로 deadline 자동 부여. 어느 hop 만료 → 즉시 cancel 신호 전파. ADR-0025 fan-out tail 보호 핵심.
> 꼬리: "REST 에는 표준?" / "ABORTED vs UNAVAILABLE retry?"
> 출처: #18 Q18, Q22

### 2.4 분산/시스템 설계 (Top 31-40)

**Q31. "CAP 에서 무엇을 선택하나?"**
> A: CAP 는 분할 시점만 적용. 도메인별로 다름. 재고/결제/인증 = CP(강일관성), 검색/추천/카탈로그 = AP(가용성). 평시는 PACELC 로 EL/EC 추가. CAP 의 C 는 Linearizability 이지 ACID 의 C(constraint) 와 다름.
> 꼬리: "FLP Impossibility 의 의미?" / "Eventual Consistency 실무?"
> 출처: #7 Q1.1-1.4

**Q32. "Saga + Outbox + 멱등 Consumer = MSA 분산 트랜잭션 표준 패키지"**
> A: 5종 세트 — Saga(choreography) + Outbox(DB-Kafka atomic) + 멱등 Consumer(eventId/processed_event) + Optimistic Lock + Reservation TTL. 하나라도 빠지면 위험. 2PC 는 blocking + 매니지드 DB XA 미지원 + 운영 복잡.
> 꼬리: "EOS 가 가능한가?" / "Outbox 의 multi-replica 중복?"
> 출처: #7 Card B, Q3.1-3.4, #5 Q3.1-3.7

**Q33. "Resilience 4종 세트?"**
> A: Circuit Breaker(외부 호출) + DLQ(Kafka consumer) + Bulkhead(자원 격리) + Rate Limiting(처리량). 하나만 적용하면 나머지가 발목. CB 3 상태(CLOSED → OPEN → HALF_OPEN), Token Bucket(burst 허용) vs Leaky Bucket.
> 꼬리: "Hedged request 트레이드오프?" / "Redis 분산 락 한계?"
> 출처: #7 Card C, Q4.1-4.7, #12 Q6

**Q34. "Redis 분산 락의 한계?"**
> A: GC pause 로 holder 멈췄다 깨면 TTL 만료 후 다른 holder 와 동시 critical section. 단일 Redis failover 시 비동기 복제로 락 사라질 수 있음. 해법: **fencing token**(단조 증가 시퀀스) + 자원 측 검사 / ZooKeeper. RedLock 도 Kleppmann 의 비판 — clock drift / GC / partition 으로 lease-based 락 본질적 안전 X.
> 꼬리: "RedLock 이 안전한가?" / "Redisson 으로 충분한가?"
> 출처: #7 Q4.7, Q4.8, #9 Q42, Q43, Q44

**Q35. "Read-After-Write 일관성 보장 4가지?"**
> A: 1) stickiness — 사용자 단위 cookie/session 으로 N초간 master. 2) wait-for-replica — write 직후 replica 동기 wait. 3) critical read = master(결제/주문). 4) eventual + UI polling. msa 는 명시 정책 미정 — ADR 후보.
> 꼬리: "Replica lag 측정?" / "msa 의 RoutingDataSource 효과는?"
> 출처: #4 Q4.6, #5 Q2.10, Q4.3, Q4.8

**Q36. "URL Shortener 시스템 설계 — 60억 row, 단일 MySQL?"**
> A: 60억 × 150 byte = 900GB, 단일 MySQL 한계 근처. 첫 카드 = cold storage 이관(1년 미사용 → S3), 두 번째 = read replica, 세 번째 = sharding(short_key prefix hash). 90% cache hit 이라 실제 DB QPS 는 작아 read replica 로 버틸 수 있음.
> 꼬리: "추측 가능한 short_key 보안?" / "1초 단위 정확한 클릭 통계?"
> 출처: #8 §1 Q1-Q5

**Q37. "Chat System — 100만 동시 연결?"**
> A: WebSocket 서버당 100k 가정 → 10대. ulimit -n 1M, Netty/Reactor Netty heap 8GB. LB sticky(userId hash) + Redis pub/sub cross-server fan-out. Graceful shutdown drain 60초. 메시지 순서 = timeuuid + Kafka 단일 partition + 클라 clientMsgId ACK 매칭 3중.
> 꼬리: "200명 그룹방 폭주?" / "오프라인 사용자 전달?"
> 출처: #8 §2 Q1-Q5

**Q38. "Payment System — 이중 결제 방어?"**
> A: 3중 방어 — 1) Redis SETNX(idempo:key, TTL 24h) 빠른 거절. 2) DB UNIQUE(idempotency_key). 3) PG 자체 idempotency_key. Redis 다운 시 DB fallback. 가장 위험은 PG TIMEOUT — FAILED 처리 안 하고 5분 후 PG 조회로 확정. SAGA 보상도 idempotent.
> 꼬리: "Ledger 복식부기 이유?" / "정산 mismatch?"
> 출처: #8 §4 Q1-Q5

**Q39. "Ticketing — 좌석 오버셀링 방지?"**
> A: 4중 방어 — 1) Redis 분산 락 SETNX 5초 TTL. 2) Redis Hash atomic 상태(HSETNX). 3) DB UNIQUE(seat_id, status='SOLD'). 4) 재고 카운터 INCR 검증. 첫 관문 통과해도 마지막 DB 가 잡음. 5분 hold 만료는 ZSET expires_at score + worker ZRANGEBYSCORE.
> 꼬리: "100만 동접 처리?" / "결제됐는데 좌석 누락?"
> 출처: #8 §7 Q1-Q5

**Q40. "DAU 10x 늘면 어디가 먼저 터지나?"**
> A: 보통 DB → Cache → MQ → Network 순으로 병목 이동. DB 는 인덱스/샤딩, Cache 는 hit ratio + Stampede 방어, MQ 는 partition 추가 + autoscale, Network 는 CDN/edge. 어디부터인지는 현재 read:write 비율과 active set 크기.
> 꼬리: "Consistency vs Availability 우선순위?" / "어디부터 모니터링?"
> 출처: #8 §0

### 2.5 관측/운영/네트워크 (Top 41-50)

**Q41. "Cardinality 가 왜 1번 적인가?"**
> A: 시계열 1개 = Prometheus head 메모리 ~3KB. label `userId`(10만) × `productId`(1만) = 10억 시계열 = 3TB → 즉시 OOM. 라벨은 enum/상수만, raw URL 은 template path(`/users/{id}`). 폭발 시 응급 조치 = `metric_relabel_configs` 로 폭발 라벨 drop.
> 꼬리: "Histogram > Summary 인 이유?" / "Native Histogram?"
> 출처: #10 Q4, Q10, Q37

**Q42. "Multi-Window Multi-Burn-Rate Alert?"**
> A: Google SRE Workbook 정석. 짧은 윈도우(5m) 만 false positive, 긴 윈도우(1h) 만 늦음. 5m AND 1h 둘 다 burn rate 14.4× 이상일 때 page. 4-pair (5m+1h, 30m+6h, 2h+24h, 6h+3d) 모두 등록 → fast/slow cover. "현재 속도면 며칠에 budget 다 소진?" 으로 판단.
> 꼬리: "SLO 99→99.9 비용 변화?" / "alert fatigue 해결?"
> 출처: #10 Q5, Q6, Q16, Q38

**Q43. "Trace 와 Logs 어떻게 연결?"**
> A: 로그에 trace_id 박혀야 — logback `%mdc{trace_id}`. Loki `derivedFields` 로 trace_id 정규식 매칭 → Tempo URL 자동. Tempo `tracesToLogs` 로 trace_id → Loki query(`{trace_id="..."}`). 6 방향 drill-down(M↔T, T↔L, M↔L) 모두 trace_id 일관 전파 전제.
> 꼬리: "MDC 가 Async/Coroutine 에서 깨지는 이유?" / "Exemplar 가 게임 체인저인 이유?"
> 출처: #10 Q21, Q22, Q31, Q32

**Q44. "K8s 에서 OOMKilled 가 반복?"**
> A: 1) `kubectl describe pod` Last State: OOMKilled 확인. 2) `kubectl top pod` 메모리 추이. 3) Pod 안 `jcmd <pid> VM.native_memory summary` — JVM 영역별. 4) MaxRAMPercentage=75 + cgroup limit 비율. 5) Lettuce/Netty direct buffer 비정상 시 `-Dio.netty.maxDirectMemory`. 처방: limit 상향 / MaxRAMPercentage 낮춤 / heap dump.
> 꼬리: "JVM heap 멀쩡한데 왜?" / "Jib MaxRAMPercentage default?"
> 출처: #11 Q4, Q38, #2 Q42

**Q45. "K8s readiness vs liveness?"**
> A: readiness fail = Endpoints 빠져 트래픽 차단. liveness fail = Pod kill + 재시작. 둘 다 같은 endpoint 면 부팅 중 OOM 이 liveness 도 fail → 무한 restart. msa 는 Spring Boot Actuator `/actuator/health/{readiness,liveness}` 분리. startupProbe 추가로 부팅 시간 보장.
> 꼬리: "ConfigMap 변경 자동 갱신?" / "PDB 가 노드 crash 막나?"
> 출처: #11 Q5, Q6, Q23

**Q46. "VPC CNI + Pod 별 IP 어떻게 동작?"**
> A: EKS VPC CNI → Pod 이 VPC 서브넷 IP 직접 할당. 노드 ENI 에 Secondary IP. 노드당 Pod 수 = (ENI × IP/ENI) - 1. 늘리려면 Prefix Delegation(/28 prefix). t3.medium 17 Pod 제한 → Prefix Delegation 으로 확장.
> 꼬리: "Pod 별 SG?" / "K8s Service 가 AWS LB 로?"
> 출처: #1 Q6

**Q47. "Cross-AZ 트래픽 비용?"**
> A: 양방향 $0.01/GB. Kafka, LB, RDS 복제가 주요 원인. Kafka 에서 Consumer 가 다른 AZ leader 에서 읽으면 매번 Cross-AZ → fetch-from-follower(KIP-392)로 같은 AZ replica. K8s Topology Aware Routing(`trafficDistribution: PreferClose`, K8s 1.30+).
> 꼬리: "rack awareness 적용 시점?" / "Topology Aware vs PreferClose?"
> 출처: #1 Q8

**Q48. "TLS 1.2 vs 1.3 가장 큰 차이?"**
> A: 1-RTT 핸드셰이크 + 강제된 Forward Secrecy. 1.2 는 RSA 키 교환 허용 → 서버 키 유출 시 과거 트래픽 풀림. 1.3 은 ECDHE 만 허용 → 매 연결 임시 키 → PFS 자연. CBC/RC4 제거, AEAD 만. ServerHello 이후 모두 암호화(인증서까지).
> 꼬리: "0-RTT 위험?" / "PFS 의 중요성?"
> 출처: #13 Q5.1, Q5.2, Q5.4

**Q49. "JWT Refresh Token 탈취 방어?"**
> A: Refresh Rotation. 매 재발급마다 새 jti, 이전 토큰 무효화. 같은 Refresh 두 번 들어오면 reuse detection → 해당 사용자 모든 세션 강제 종료. 정상 사용자는 한 토큰만 가짐. msa 는 gateway 에서 Redis blacklist fail-open.
> 꼬리: "alg:none 취약점?" / "JWT 어디 저장?"
> 출처: #13 Q2.1-2.3, Q2.5

**Q50. "Latency Numbers 5개 비율?"**
> A: 1) L1 → DRAM ×100 (캐시 친화 코드 가치). 2) DRAM → SSD ×1000 (캐시 레이어). 3) SSD → DC RTT ×30 (Redis vs 로컬 디스크). 4) DC → 대륙간 RTT ×300 (멀티 리전 비용). 5) 평균 → P99 ×3-10 (tail latency).
> 꼬리: "Little's Law L=λW?" / "Tail at Scale 완화?"
> 출처: #12 Q1-1-1, Q5, Q6

---

## 3. 영역별 분류

### 3.1 런타임/언어 (JVM/동시성/Async/Spring) — 15 카드

| # | 질문 | 출처 |
|---|---|---|
| R1 | JVM 메모리 영역 5가지 + native 차이 | #2 Q1, Q41 |
| R2 | TLAB / Eden / Survivor / Old 흐름 | #2 Q2, Q4, Q5 |
| R3 | G1 vs ZGC vs Shenandoah 선택 | #2 Q17, Q21, Q23, Q24 |
| R4 | GC log 분석 5지표 (Pause/Throughput/Alloc/Promotion/Old) | #2 Q25 |
| R5 | OOM 5종류 + OOMKilled 별개 | #2 Q26, Q42 |
| R6 | JIT C1/C2 + inlining + escape analysis | #2 Q33, Q34, Q35 |
| R7 | synchronized vs volatile + happens-before | #3 Q1.2, Q2.1 |
| R8 | CAS + ABA + AtomicStampedReference | #3 Q1.4, Q1.5 |
| R9 | DCL volatile + lock 진화 단계 | #3 Q2.2, Q2.3 |
| R10 | ConcurrentHashMap Java 7 vs 8 | #3 Q2.4, Q2.5 |
| R11 | CompletableFuture vs Coroutine | #3 Q2.7, Q2.8 |
| R12 | Coroutine state machine + Structured Concurrency | #3 Q2.9, Q2.10 |
| R13 | Virtual Thread + pinning + JEP 491 | #3 Q2.11, Q2.12, #16 Q27, Q32 |
| R14 | Thread dump 수집/분석 (jstack vs jcmd -l) | #3 Q3.1, Q3.3, Q3.4 |
| R15 | @Transactional AOP + self-invocation 5대 함정 | #5 Q1.1, Q1.6, Q1.7, #17 Q2.2 |

### 3.1.1 런타임 추가 카드 (6 카드)

| # | 질문 | 출처 |
|---|---|---|
| R16 | Direct Buffer + MaxDirectMemorySize 미지정 위험 (Netty leak) | #2 Q8 |
| R17 | NMT (Native Memory Tracking) baseline → diff 진단 | #2 Q30 |
| R18 | LongAdder vs AtomicLong (striped counter) | #3 Q1.3 |
| R19 | StampedLock optimistic read (재진입 X, Condition X) | #3 Q2.6 |
| R20 | thenApply vs thenApplyAsync (호출자 vs 명시 executor) | #3 Q2.7 |
| R21 | suspend 함수에 @Transactional 우회 패턴 (non-suspend 빈 분리) | #5 Q1.8 |

### 3.2 저장소/데이터 (DB/Redis/Pool/CRDT/TX) — 18 카드

| # | 질문 | 출처 |
|---|---|---|
| D1 | InnoDB clustered index = PK + secondary lookup 2단계 | #4 Q1.2 |
| D2 | B+Tree fanout / depth / 페이지 크기 | #4 Q1.1, Q1.4 |
| D3 | Covering Index + EXPLAIN type/key/rows/Extra | #4 Q1.3, Q2.8 |
| D4 | 4 격리 수준 + InnoDB RR 의 next-key lock | #4 Q1.7, Q2.2, Q2.3 |
| D5 | MVCC + ReadView + 비손실 read | #4 Q2.1 |
| D6 | Deadlock 자동 검출 + LATEST DETECTED INNODB STATUS | #4 Q2.6 |
| D7 | MDL 사슬 + 운영 SELECT hang | #4 Q2.7, Q4.2 |
| D8 | 인덱스 안티패턴 5가지 (함수/cast/leading %/부정/range 이후) | #4 Q2.10 |
| D9 | REQUIRES_NEW vs NESTED + JPA 미지원 | #5 Q2.1 |
| D10 | readOnly 4효과 + RoutingDataSource + LazyConnection | #5 Q2.7-2.10, #15 Q4 |
| D11 | UnexpectedRollbackException + 4 회피 | #5 Q2.11, Q2.12 |
| D12 | Outbox + @TransactionalEventListener 차이 | #5 Q3.1, Q3.2 |
| D13 | HikariCP ConcurrentBag + FastList + ProxyConnection | #15 Q2 |
| D14 | "Connection is not available" 4가지 원인 분류 | #15 Q3 |
| D15 | Lettuce vs Jedis (multiplex vs per-thread) | #15 Q5, #9 보너스 |
| D16 | Redis 9 자료구조 + listpack vs ziplist | #9 Q6, Q7, Q8 |
| D17 | RDB + AOF + mixed (RDB preamble) | #9 Q21-Q27 |
| D18 | Cluster 16384 슬롯 + MOVED/ASK + Hash tag 함정 | #9 Q31, Q32, Q33, Q34, Q35 |

### 3.2.1 데이터 추가 카드 (8 카드)

| # | 질문 | 출처 |
|---|---|---|
| D19 | Hikari maxLifetime = DB wait_timeout - 30s + keepaliveTime 30s | #15 Q3, Q7 |
| D20 | leakDetectionThreshold prod 무조건 활성 (10000ms) | #15 Q3.2 |
| D21 | WebFlux + JDBC 금기 + boundedElastic offload 한계 | #15 Q6 |
| D22 | Aurora RDS Proxy connection muxing vs 일반 RDS | #15 Q7.1 |
| D23 | Lettuce ClusterTopologyRefreshOptions 5 trigger 활성 | #9 Q55, #15 Q5.2 |
| D24 | Pipeline vs Lua vs Function (atomic 보장 차이) | #9 Q49, Q50 |
| D25 | big key 위험 (DEL/BGSAVE/replication) + UNLINK 대응 | #9 Q51 |
| D26 | hot key 대응 4 (로컬 캐시 / replica / 키 분산 / CDN) | #9 Q52 |

### 3.3 메시징 (Kafka/gRPC) — 12 카드

| # | 질문 | 출처 |
|---|---|---|
| M1 | 토픽/파티션 = 병렬화+순서+장애 단위 | #6 Q1.1, Q1.2 |
| M2 | acks=all + idempotence + max.in.flight=5 안전 | #6 Q1.3, Q2.1, Q2.2, Q2.3 |
| M3 | Kafka 빠른 이유 3가지 (Sequential/PageCache/Zero-copy) | #6 Q2.4 |
| M4 | ISR + HW + unclean.leader.election | #6 Q2.6, Q2.7 |
| M5 | Cooperative-Sticky vs Eager Rebalance | #6 Q3.2 |
| M6 | EOS 가 외부 DB 에서 깨지는 이유 → at-least-once + 멱등 | #6 Q3.4, Q3.5 |
| M7 | 멱등 컨슈머 4 패턴 (UNIQUE/SETNX/processed_event/Inbox) | #6 Q4.1 |
| M8 | DLQ 재처리 + DefaultErrorHandler backoff | #6 Q4.2, Q4.5 |
| M9 | gRPC 4 호출 패턴 (Unary/Server/Client/Bidi) | #18 Q4 |
| M10 | proto field number 영구 불변 + reserved | #18 Q5, Q17 |
| M11 | K8s gRPC 한 pod 만 받는 이유 → headless + round_robin | #18 Q12 |
| M12 | Deadline propagation = fan-out tail 보호 핵심 | #18 Q18 |

### 3.3.1 메시징 추가 카드 (6 카드)

| # | 질문 | 출처 |
|---|---|---|
| M13 | transactional.id 안정성 + 좀비 fencing (epoch) | #6 Q3.6 |
| M14 | read_committed + LSO + transaction.timeout.ms 함정 | #6 Q3.7 |
| M15 | Static Membership (group.instance.id) 로 짧은 부재 rebalance 회피 | #6 Q4.7 |
| M16 | Schema Registry forward/backward 호환성 | #6 Q4.8 |
| M17 | Tiered Storage (Kafka 3.6+) S3 offload | #6 Q5.6 |
| M18 | Buf lint + breaking detection + BSR | #18 Q28 |

### 3.4 분산 시스템 (분산/CAP/Saga/CRDT) — 14 카드

| # | 질문 | 출처 |
|---|---|---|
| S1 | CAP = 분할 시점만, PACELC 가 평시도 | #7 Q1.1, Q1.3 |
| S2 | FLP Impossibility + partially-sync 우회 | #7 Q1.4 |
| S3 | Linearizable / Sequential / Causal 차이 | #7 Q1.6 |
| S4 | Raft leader election + split-brain 방지 (term + majority) | #7 Q2.1, Q2.2 |
| S5 | Raft vs Paxos + Election Restriction | #7 Q2.3, Q2.4 |
| S6 | Lamport vs Vector vs HLC | #7 Q2.5, Q2.6, Q2.8 |
| S7 | 2PC 가 MSA 에서 안 쓰이는 4 이유 | #7 Q3.1 |
| S8 | Saga Choreography vs Orchestration | #7 Q3.2 |
| S9 | 멱등성 보장 4 패턴 + Idempotency-Key body hash | #7 Q3.5, Q3.6, Q3.7 |
| S10 | Outbox + Inbox + dual-write 문제 해결 | #7 Q3.8, Q5.1 |
| S11 | Circuit Breaker 3 상태 + sliding window | #7 Q4.1, Q4.2 |
| S12 | Token Bucket vs Leaky Bucket + Bulkhead | #7 Q4.5, Q4.6 |
| S13 | Redis 분산 락 한계 + fencing token + RedLock 비판 | #7 Q4.7, Q4.8, #9 Q42-44 |
| S14 | CRDT = SEC (Semilattice ACI) + tombstone GC + msa 미적용 | #14 Q1.1, Q1.3, Q3.1, Q4.1 |

### 3.4.1 분산 추가 카드 (6 카드)

| # | 질문 | 출처 |
|---|---|---|
| S15 | DLQ + processed_event 7일 보관 (ADR-0012) | #5 Q3.7, #6 Q4.3 |
| S16 | Saga 영원히 멈추는 시나리오 — TTL + DLQ 모니터링 | #7 모의 면접 |
| S17 | CRDT G-Counter max merge 이유 (idempotent ACI) | #14 Q1.3, Q2.1 |
| S18 | OR-Set unique tag = 2P-Set 한계 극복 | #14 Q2.5, Q2.6 |
| S19 | Causal stability + tombstone GC (ctx \ dotstore) | #14 Q2.11, Q3.1, Q3.2 |
| S20 | MRDT (Irmin) vs CRDT — Git 3-way merge 비유 | #14 Q3.4 |

### 3.5 관측/운영 (Observability/K8s/Network) — 14 카드

| # | 질문 | 출처 |
|---|---|---|
| O1 | Observability vs Monitoring (unknown-unknowns) | #10 Q1 |
| O2 | RED / USE / Golden Signals | #10 Q3 |
| O3 | Cardinality = Prometheus 1번 적 + relabel drop 응급 | #10 Q4, Q37 |
| O4 | SLI/SLO/SLA + Error Budget + 99→99.9 비용 10× | #10 Q5, Q6 |
| O5 | Histogram vs Summary + by(le) 누락 함정 | #10 Q10, Q11 |
| O6 | Multi-Window Multi-Burn-Rate (5m/1h, 30m/6h...) | #10 Q16, Q38 |
| O7 | OpenTelemetry vs Sleuth + W3C traceparent | #10 Q25, Q27 |
| O8 | Head vs Tail Sampling + Exemplar drill-down | #10 Q28, Q31, Q32 |
| O9 | K8s kubectl apply 8단계 (api-server → etcd → controller → scheduler → kubelet) | #11 Q1 |
| O10 | Deployment vs StatefulSet (identity 필요한가) | #11 Q2 |
| O11 | readiness vs liveness + startupProbe | #11 Q5 |
| O12 | DNS ndots:5 함정 + NodeLocal DNSCache | #11 Q15 |
| O13 | HPA + Cluster Autoscaler 2단계 latency | #11 Q20, Q21 |
| O14 | VPC SG vs NACL (Stateful vs Stateless, 리소스 vs 서브넷) | #1 Q3, 함정 #1-2 |

### 3.6 보안 (Crypto/JWT/SSO) — 10 카드

| # | 질문 | 출처 |
|---|---|---|
| SE1 | AES-GCM vs CBC (AEAD = 기밀+무결성) | #13 Q1.1 |
| SE2 | IV 재사용 시 GCM 깨짐 (인증 키까지 복원) | #13 Q1.2 |
| SE3 | 비밀번호 = argon2id (memory-hard, GPU 방어) | #13 Q1.4, Q1.5 |
| SE4 | JWT alg:none 취약점 + 알고리즘 화이트리스트 | #13 Q2.3 |
| SE5 | Refresh Rotation + reuse detection → 모든 세션 종료 | #13 Q2.2 |
| SE6 | OAuth Authorization Code + PKCE 필수 (RFC 9700) | #13 Q3.2 |
| SE7 | id_token vs access_token (audience 다름) | #13 Q3.6 |
| SE8 | KMS Envelope Encryption (DEK + KEK) | #13 Q4.1 |
| SE9 | TLS 1.3 = 1-RTT + ECDHE-only PFS | #13 Q5.1, Q5.4 |
| SE10 | mTLS = 서비스 신원, JWT = 사용자 신원 | #13 Q5.3, #18 Q23 |

### 3.6.1 보안 심화 추가 (8 카드)

| # | 질문 | 출처 |
|---|---|---|
| SE11 | AES IV 비밀 X / 재사용 시 GMAC 인증 키 복원 | #13 Q1.2 |
| SE12 | RSA OAEP/PSS vs raw (Bleichenbacher) | #13 Q1.7 |
| SE13 | Ed25519 nonce 결정론 (PS3/Bitcoin 사고 회피) | #13 Q1.8 |
| SE14 | OIDC Discovery + JWKS 자동 키 회전 | #13 Q3.1, Q3.6 |
| SE15 | KMS Envelope DEK 캐싱 + AAD 컨텍스트 바인딩 | #13 Q4.1, Q5.7 |
| SE16 | KMS Multi-Region Key (ID 동일, ciphertext 호환) | #13 Q4.8 |
| SE17 | TLS 0-RTT replay 위험 + idempotent 한정 | #13 Q5.2 |
| SE18 | OCSP Stapling 으로 CA 의존성 제거 | #13 Q5.5 |

### 3.7 시스템 설계 (System Design 10선) — 10 카드

| # | 시나리오 | 핵심 결정 | 출처 |
|---|---|---|---|
| SD1 | URL Shortener | Auto-Increment + Base62, 60억 row 시 cold storage → read replica → sharding | #8 §1 |
| SD2 | Chat System | timeuuid + Kafka 단일 partition + 클라 ACK 매칭 3중, 100만 동접 = sticky LB + Redis pub/sub | #8 §2 |
| SD3 | Feed System | Hybrid Push/Pull (10k 이상 follower = Pull-only), inbox ZSET capped 800 | #8 §3 |
| SD4 | Payment System | 3중 idempotency (Redis SETNX + DB UNIQUE + PG key), TIMEOUT 절대 FAILED 처리 X, Ledger 복식부기 | #8 §4 |
| SD5 | Rate Limiter | Token Bucket (80%) + Redis Lua atomic, fail-open vs fail-closed by API criticality | #8 §5 |
| SD6 | Notification | Dedup key SETNX 5분 TTL, Quiet Hours 체크, sender reputation (DKIM/SPF/DMARC) | #8 §6 |
| SD7 | Ticketing | Queue Gateway WebSocket → token 1k/s 발급, 4중 oversell 방어, ZSET hold 만료 worker | #8 §7 |
| SD8 | Search | Alias swap 패턴, refresh_interval 5s sweet spot, multi_match + fuzzy + synonym | #8 §8 |
| SD9 | e-Commerce 회고 | Clean Architecture + Nested Submodule, Auto-Increment → KSUID 후회, Saga Choreography Phase 1 | #8 §9 |
| SD10 | Map/Geo | Redis GEO geohash O(log N + M), 운전자 100k 5초 갱신 = 20k QPS, Kalman filter | #8 §10 |

---

## 4. 모의 면접 시나리오 (5개, 각 60분)

각 시나리오는 워킹 흐름 (Q → 답변 요약 → 꼬리 → ...) 으로 구성. 실제 면접 톤 시뮬레이션.

> 답변 길이 가이드: 30초(키워드만) / 1분(메커니즘 포함) / 2분(트레이드오프 + 사례) 분기. 면접관 톤에 맞춰 선택.

### 시나리오 A: 백엔드 시니어 1차 (CS 기초 + 동시성) — 60분

**5분 — 자기소개 + 회사 도메인 (msa)**

**10분 — JVM 기본**
- Q: "JVM 메모리 영역을 5가지 말해주세요" → A: Heap/Metaspace/Stack/PC/Native [#2 Q1]
- 꼬리: "PermGen 과 Metaspace 차이?" → 위치 이동 + 한도 무제한
- 꼬리: "Stack 도 GC 대상인가요?" → X (메서드 종료 자동 pop, 함정 1)
- Q: "컨테이너 환경에서 -Xmx 설정은?" → MaxRAMPercentage=70, native 30% 마진 [#2 Q41]

**15분 — GC 진단**
- Q: "OOMKilled 가 났는데 JVM heap 은 멀쩡합니다" → metaspace + direct + thread stack 합쳐 cgroup limit 초과 [#11 Q4]
- 꼬리: "어떻게 진단?" → NMT diff (`jcmd VM.native_memory summary.diff`) [#2 Q30, Q42]
- Q: "GC 로그 분석" → 5지표 (Pause/Throughput/Alloc/Promotion/Old 추이) [#2 Q25]
- 꼬리: "Full GC 가 보이면?" → IHOP 낮추거나 region size 조정

**15분 — 동시성**
- Q: "synchronized 와 volatile 차이?" → 원자성 vs 가시성 [#3 Q1.2]
- 꼬리: "DCL 에 volatile 빠지면?" → 재배열로 부분 초기화 객체 노출 [#3 Q2.2]
- Q: "Virtual Thread 가 뭐고 언제 쓰나?" → state machine + carrier unmount, blocking IO 1순위 [#3 Q2.11, #16 Q27]
- 꼬리: "pinning 이란?" → synchronized + JNI 안 blocking, JDK 24~ 해소 [#3 Q2.12]
- Q: "ThreadLocal 메모리 누수?" → WeakReference key 지만 value strong, try-finally + remove() [#3 Q1.8]

**10분 — 진단 워크플로우**
- Q: "동시성 사고 진단 어떻게?" → jcmd Thread.print -l 5초 간격 3회 → BLOCKED 분포 → lock ID 매칭 → owner stack → async-profiler `-e lock` 정량 [#3 Q4.8]
- 꼬리: "RUNNABLE 인데 hang 같다?" → native IO 대기 (sun.nio.ch.Net.poll), 같은 위치 반복이면 무한 루프 [#3 Q3.5]

**5분 — 마무리 + 질문**

**합격 시그널**: 단발 dump 의 한계를 즉답, lock owner 추적의 lock ID 매칭, RUNNABLE = native IO 대기 인지. Virtual Thread 의 carrier/mount/unmount 메커니즘을 30초 설명.
**탈락 시그널**: "OOM = 힙 부족" 으로 단정, jstack 만 알고 jcmd -l 모름, volatile 만으로 카운터 OK 라 답.

### 시나리오 B: 백엔드 시니어 2차 (시스템 설계 + 트레이드오프) — 60분

**5분 — 자기소개**

**45분 — 시스템 설계: "주문 시스템 설계해보세요" (msa 사례 활용)**

- 1) 요구사항 정리 (4분): 결제 + 재고 + 주문 생성 + at-most-once 결제, DAU 100만, P99 200ms
- 2) 용량 산정 (5분): 100만 × 5 회 = 5M req/day = 60 RPS, 피크 600 RPS, write : read = 1 : 10
- 3) API + 도메인 (5분): POST /orders → PENDING → 결제 → COMPLETED, idempotency-key 헤더
- 4) High-Level (10분):
  - Order(MVC + JPA) → Outbox → Kafka → Inventory(reserve) → Fulfillment
  - Saga Choreography 5종 패키지 [Top Q32]
  - 결제는 동기 WebClient + Resilience4j CB, 5초 timeout 후 PG 조회
- 5) DB 스키마 (5분): orders, outbox_event, processed_event, inventory(@Version), reservation(TTL 30분)
- 6) Deep Dive 1: 이중 결제 방어 (5분): 3중 (SETNX + UNIQUE + PG key), TIMEOUT 절대 FAILED 처리 X [#8 §4 Q1, Q3]
- 7) Deep Dive 2: Saga 영원히 멈추는 시나리오 (5분): 각 단계 timeout + Reservation TTL + ID-aware saga state + DLQ 모니터링 [#7 모의 면접]
- 8) 30초 요약: "Saga + Outbox + 멱등 Consumer + Optimistic Lock + Reservation TTL = MSA 분산 트랜잭션 5종 세트"

**10분 — 트레이드오프 압박**
- 꼬리: "Choreography 의 한계는?" → 흐름 추적 어려움, OpenTelemetry trace_id 도입 검토 [#8 §9 Q3]
- 꼬리: "단일 PG 의존 위험?" → 매출 0 위험, Multi-PG 70/20/10 + per-provider CB + 정산 reconciliation [#8 §9 Q4]
- 꼬리: "DAU 10x 늘면?" → DB → Cache → MQ → Network 순 병목, 처치 매핑 [Top Q40]

**합격 시그널**: 4단 답변 구조 (결론/메커니즘/트레이드오프/msa) 자동 적용, 5종 패키지(Saga+Outbox+멱등+OptLock+TTL) 즉답, 숫자 근거 (DAU 100만 → 600 RPS 피크) 명시. "결제는 동기 + Outbox 는 비동기" 의 의도적 분리 근거 설명.
**탈락 시그널**: 2PC 가 정답이라 답, "Kafka transaction 으로 EOS" 단정, 보상 트랜잭션 실패 시나리오 미고려.

### 시나리오 C: 백엔드 테크리드 (아키텍처 + 운영) — 60분

**10분 — 자기소개 + 가장 자랑스러운 의사결정**

**20분 — 아키텍처 결정**
- Q: "Clean Architecture 를 왜?" → 도메인 테스트 1초, 인프라 교체 시 도메인 변경 0 [#8 §9 Q1]
- 꼬리: "다시 한다면?" → Auto-Increment → KSUID, 처음부터 분산 친화 ID [#8 §9 Q2]
- Q: "msa 가 @Async 안 쓴 이유?" → ADR-0002, MVC + JPA blocking + Coroutine + Tomcat VT [#3 Q4.1]
- Q: "트랜잭션 정책 표준?" → ADR-0020 + ADR-0022 + ADR-0012, OrderService(orchestration) + OrderTransactionalService(짧은 TX), Outbox, RoutingDataSource [#5 Q4.1]
- 꼬리: "Inventory 의 Redis in TX?" → 약한 충돌이지만 sub-ms 라 의도적 트레이드오프, AFTER_COMMIT 분리 검토 [#5 Q4.4]

**20분 — 운영 점검**
- Q: "Observability 현재 상태?" → Metrics 견고(kube-prometheus + Micrometer), Logs/Traces/SLO Alert 0, 12주 로드맵 [#10 Q33]
- 꼬리: "ADR-0025 와의 격차?" → percentiles-histogram=true 미반영, Heatmap 미작성, P99 alert rule 미생성 [#10 Q34]
- Q: "장애 대응 5분 워크플로?" → Slack alert → RED dashboard → Heatmap Exemplar 클릭 → Tempo trace → Loki span logs → Pyroscope profile → Annotation 비교 [#10 Q40]
- Q: "K8s 첫 5분 점검?" → nodes / pods Running 외 / top / events / HPA / PDB / ServiceMonitor [#11 Q36]

**10분 — 미래/리더십**
- Q: "팀이 CRDT 모른 채 multi-region?" → 위험, 학습 + POC 후 도입, silent corruption 위험 [#14 Q4.7]
- Q: "GitOps 도입 한 줄 가치?" → "git=SoT 로 추적/롤백/drift 차단/secret/멀티 클러스터 5가지, Argo CD 운영 비용만 추가" [#11 Q40]

**합격 시그널**: ADR 번호 직접 인용 (ADR-0002/0011/0012/0019/0020/0025), "다시 한다면" 류 자기 비판 솔직, 학습 → ADR 후보 → 구현 전환 흐름 인지. "팀이 모르고 multi-region 가면 silent corruption" 같은 인적 리스크 인지.
**탈락 시그널**: 자랑만 하고 한계/후회 없음, "K8s 가 만능" / "메시 도입이 정답" 같은 무조건적 답변.

### 시나리오 D: 인프라 엔지니어 (K8s + 관측 + 네트워크) — 60분

**5분 — 자기소개**

**25분 — K8s 깊이**
- Q: "kubectl apply 한 줄이 클러스터에서 어떻게 흘러가나요?" → 8단계 (인증 → 3-way merge → admission → etcd → controller → scheduler bind → kubelet CRI/CNI/CSI) [#11 Q1]
- Q: "scheduler 가 Pod 시작?" → 아니오, kubelet. scheduler 는 nodeName bind 만 [#11 Q3]
- Q: "Deployment vs StatefulSet?" → identity 필요한가, Kafka/MySQL = StatefulSet, gateway = Deployment [#11 Q2]
- Q: "Service ClusterIP 는 실제 어디?" → 어디에도 없음, iptables/IPVS NAT 룰 [#11 Q12]
- 꼬리: "gRPC 가 한 pod 만 받는 이유?" → HTTP/2 multiplexing + L4 LB, headless + round_robin 또는 mesh [#11 Q13, #18 Q12]
- Q: "DNS 가 느린데 왜?" → ndots:5 함정, NodeLocal DNSCache 가 가장 효과 [#11 Q15]

**15분 — 관측**
- Q: "Prometheus 의 1번 적?" → Cardinality, label `userId × productId` = 10억 시계열 = 3TB OOM [#10 Q4]
- 꼬리: "폭발 시 응급?" → metric_relabel_configs labeldrop, 영구는 라벨 코드 제거 [#10 Q37]
- Q: "Multi-Window Multi-Burn-Rate?" → 4-pair (5m+1h, 30m+6h, 2h+24h, 6h+3d), false positive 차단 [#10 Q16]
- Q: "Trace 와 Logs 어떻게 연결?" → MDC trace_id + Loki derivedFields + Tempo tracesToLogs, 6 방향 drill-down [#10 Q32]

**10분 — 네트워크 (AWS)**
- Q: "VPC SG 와 NACL 차이?" → SG = 리소스 Stateful Allow-only, NACL = 서브넷 Stateless Allow+Deny [#1 Q3]
- 꼬리: "EKS Pod 별 SG?" → SecurityGroupPolicy CRD + VPC CNI Branch ENI [#1 Q3]
- Q: "Cross-AZ 비용?" → $0.01/GB 양방향, Kafka rack awareness (KIP-392), K8s Topology Aware [#1 Q8]
- Q: "프라이빗 EKS + RDS 시스템 설계?" → CloudFront + WAF → ALB → EKS + Prefix Delegation → VPC Endpoints → RDS Multi-AZ [#1 Q10]

**5분 — 마무리**

**합격 시그널**: kubectl apply 8단계, scheduler 와 kubelet 책임 분리, ndots:5 함정 즉답, Cardinality 1번 적 인지. AWS SG vs NACL 의 Stateful/Stateless 구분 + 리소스 vs 서브넷 단위 정답.
**탈락 시그널**: "쿠버네티스 잘 모릅니다" 보다 "CRD 가 무엇인지 모릅니다" 식의 깊이 부재, gRPC LB 함정 미인지, Cross-AZ 비용 모름.

### 시나리오 E: 데이터/플랫폼 엔지니어 (Kafka + 분산 + DB 격리) — 60분

**5분 — 자기소개**

**25분 — Kafka 깊이**
- Q: "토픽과 파티션 관계?" → 병렬화 + 순서 + 장애 단위 [#6 Q1.1]
- 꼬리: "사후 partitions 늘리면?" → hash(key) % partitions 변경, 같은 aggregate 의 순서 깨짐 [#6 Q1.2]
- Q: "acks=all + min.ISR 관계?" → RF=3 + min.ISR=2 → 1대 장애까지 안전, min.ISR=1 이면 acks=all 의미 사실상 acks=1 [#6 Q1.3]
- Q: "Kafka 가 빠른 이유 3가지?" → Sequential I/O + OS Page Cache + Zero-copy (sendfile) [#6 Q2.4]
- Q: "EOS 가 외부 DB 에서 깨지는 이유?" → Kafka tx 와 DB tx 못 묶음 (XA 안 쓰면), at-least-once + 멱등으로 보강 [#6 Q3.5]
- Q: "Cooperative-Sticky vs Eager?" → 변경 없는 partition 유지 + 2-round, 신규 시스템 권장 [#6 Q3.2]

**15분 — 분산 트랜잭션**
- Q: "MSA 분산 트랜잭션 표준 패키지?" → Saga + Outbox + 멱등 Consumer + Optimistic Lock + Reservation TTL [#7 Card B]
- Q: "Outbox 단점 4가지?" → polling latency / 테이블 무한 증가 / partition key 순서 / multi-replica 중복 [#5 Q3.4]
- Q: "Idempotency-Key 표준 보관 기간?" → Stripe 24h, msa processed_event 7d (ADR-0012), body hash 같이 저장 [#7 Q3.7]
- Q: "Redis 분산 락 한계?" → GC pause + failover 비동기 복제, fencing token 또는 ZooKeeper [#7 Q4.7, Q4.8]

**15분 — DB 격리**
- Q: "InnoDB RR 에서 phantom?" → next-key + gap lock 으로 차단, 표준보다 강함 [#4 Q2.2]
- 꼬리: "그럼 SERIALIZABLE 인가?" → 아니오, write skew 같은 anomaly 는 SERIALIZABLE 만 [#4 Q2.2 함정]
- Q: "MDL 사슬?" → DDL EXCLUSIVE + DML SHARED 충돌, long-running TX → ALTER wait → 전체 SELECT wait → 서비스 정지 [#4 Q2.7, Q4.2]
- Q: "deadlock 자동 검출?" → wait-for graph cycle + cost 낮은 쪽 abort, SQLSTATE 40001 retry, SHOW ENGINE INNODB STATUS [#4 Q2.6]

**합격 시그널**: ISR/HW/LEO/LSO 4 용어 자유롭게 구분, EOS 가 Kafka cluster 내부만 한정 인지, MDL 사슬을 long TX 부터 분석. fencing token 의 단조 증가 시퀀스 즉답.
**탈락 시그널**: "Kafka 가 EOS 보장한다" 단정, "InnoDB 도 lock escalation 한다" 답, RR 과 SERIALIZABLE 동일시.

---

## 5. 함정 질문 모음 (Top 30)

면접관이 의도적으로 헷갈리게 만드는 질문 30개. 정답 + "왜 헷갈리는지" 함께.

| # | 함정 질문 | 정답 + 함정 포인트 | 출처 |
|---|---|---|---|
| 1 | "OOM = 힙 부족?" | 5종류 + OOMKilled 별개, 진단 방향 다름 | #2 함정 1 |
| 2 | "JVM 메모리 = -Xmx?" | Metaspace/Code/Direct/Stack 등 native 전부, RSS 보통 1.5-2배 | #2 함정 2 |
| 3 | "MaxGCPauseMillis 작게 하면 latency 좋아짐?" | 역효과, Young 작아져 빈도↑ throughput↓ | #2 함정 3 |
| 4 | "ZGC 가 G1 보다 우월?" | 작은 힙(<4GB) footprint 손해, throughput 5-10% 손실 | #2 함정 4 |
| 5 | "SG 는 Stateless?" | Stateful, 응답 자동 허용 | #1 함정 1 |
| 6 | "퍼블릭 서브넷 = 인터넷 연결 속성?" | RT 의 IGW 경로 유무, 서브넷 자체 속성 X | #1 함정 3 |
| 7 | "VPC Peering 이 transitive?" | non-transitive, A-B-C 삼각 통신 불가 → TGW 필요 | #1 함정 7 |
| 8 | "Cross-AZ 무료?" | $0.01/GB 양방향 | #1 함정 10 |
| 9 | "InnoDB 도 lock escalation?" | 없음, row lock 수백만 개여도 그대로 | #4 Q4.10 |
| 10 | "NULL 은 인덱스 못 탐?" | IS NULL 은 selectivity 좋으면 잘 탐 (IS NOT NULL 이 위험) | #4 Q4.10 |
| 11 | "SELECT FOR UPDATE 가 MVCC snapshot?" | 아니오, locking read 는 현재 데이터 | #4 Q4.10 |
| 12 | "REPEATABLE READ = SERIALIZABLE?" | 아니오, write skew anomaly 는 RR 에서 가능 | #4 Q4.10 |
| 13 | "@Transactional 안에서 self-invocation 도 동작?" | proxy 우회로 무효, 클래스 분리 또는 self 주입 | #5 Q1.6 |
| 14 | "private 메서드에 @Transactional 동작?" | 작동 안 함, IDE 경고 X 라 가장 무서운 함정 | #5 Q1.7 |
| 15 | "readOnly=true 안에서 entity 수정하면?" | Silent failure, FlushMode MANUAL 로 SQL 자체 발행 X | #5 Q2.8 |
| 16 | "Kafka enable.idempotence 가 EOS?" | producer 한정, consumer 측 dedup (processed_event) 도 필요 | #7 트랩 |
| 17 | "AP 시스템입니다" | "분할 시 A 우선, 평시엔 EL — PACELC" | #7 트랩 |
| 18 | "Strong = 빠름?" | Strong = 항상 더 느림 (quorum 비용) | #7 트랩 |
| 19 | "Eventual = 결국 일치?" | 결국엔 맞지만 **언제** 보장 X — divergence 수렴 메커니즘 필요 | #7 트랩 |
| 20 | "Idempotency-Key 만 있으면 됨?" | body hash 같이 저장 + in-progress lock 도 필요 | #7 트랩 |
| 21 | "Redis SETNX 분산 락 안전?" | fencing token 없으면 GC pause + failover 로 위험 | #7 트랩, #9 Q42 |
| 22 | "WeakReference 가 메모리 부족 시 회수?" | 그건 SoftReference, Weak 는 다음 GC 시 무조건 | #2 Q12 |
| 23 | "TLAB 크기가 고정?" | ResizeTLAB 가 동적 조정 | #2 Q3 |
| 24 | "Cache hit 90% 면 충분?" | P99 는 거의 hit 0% 와 비슷, 10% miss 가 위쪽 차지 | #12 Q3 |
| 25 | "throughput 늘리면 latency 도 줄어드나?" | M/M/1 에서 utilization 70-80% 넘으면 비선형 증가 | #12 Q5-1 |
| 26 | "alg:none 이 표준?" | 일부 라이브러리 버그였음, 현대는 화이트리스트 명시 | #13 Q2.3 |
| 27 | "JWT Payload 에 비밀 정보 OK?" | 절대 X, 서명만 되고 암호화 안 됨, Base64 디코드만 하면 읽힘 | #13 Q2.6 |
| 28 | "id_token 으로 API 호출?" | X, audience 다름 (id_token = 클라이언트가 신원 확인, access_token = RS) | #13 Q3.6 |
| 29 | "validationQuery SELECT 1?" | 현대 JDBC 4 driver 면 `Connection.isValid` (PING packet) 가 더 빠름 | #15 Q7-2 |
| 30 | "Selector 의 selectedKeys() 처리 후 it.remove() 안 해도?" | 같은 key 무한 반환 | #16 Q14 |

### 함정 답변 시 주의 - 면접관이 좋아하는 응답 패턴

함정 질문에 막혔을 때 "모릅니다" 보다 강한 답변 템플릿:

1. **부분 정답 + 한계 명시**: "그 부분은 정확히 X 인데, 다만 Y 같은 케이스는 따로 봐야 합니다"
2. **반례 제시**: "일반적으론 X 인데, Z 환경에선 그게 깨집니다"
3. **메커니즘 환원**: "그 답을 직접 외우진 않았지만, 메커니즘상 X 가 됩니다"
4. **인접 지식 링크**: "정확한 답은 모르지만, 키워드는 X / Y / Z 이고 그 중 하나로 추정합니다"

**나쁜 패턴**:
- "그건 잘 모르겠습니다" (즉시 종료)
- "X 인 것 같습니다" (자신감 부족)
- 길게 빙빙 돌리며 답 회피

**좋은 패턴**:
- "정확한 답은 X 라고 알고 있고, 헷갈릴 만한 부분은 Y 입니다"
- "본 msa 에선 X 인데, 일반적으로는 Y 가 정공입니다"
- "이 부분 깊이 안 봤지만, 메커니즘상 추론하면 X 입니다 — 검증 필요합니다"

---

## 6. 면접 직전 1시간 회독 가이드

### Block 1 (15분) — 핵심 통계 + Top 10

- Section 1 통계 표 훑어 18 토픽 지도화
- Section 2 의 Top 1-10 (런타임/JVM) 만 정독
- 모르는 카드 표시

### Block 2 (15분) — 분산/메시징/시스템 설계

- Section 2 Top 21-30 (메시징/통신) + Top 31-40 (분산/시스템 설계)
- Section 3.4 분산 시스템 14 카드 빠르게
- Section 3.7 시스템 설계 10 시나리오의 핵심 결정만

### Block 3 (15분) — 운영/관측/보안

- Section 2 Top 41-50 (관측/운영/네트워크)
- Section 3.5 관측/운영 14 카드
- Section 3.6 보안 10 카드 빠르게

### Block 4 (15분) — 함정 + 모의 답변 1개

- Section 5 함정 30 (특히 1-15)
- Section 4 모의 시나리오 중 본인 직무에 맞는 1개를 5분 내 시뮬레이션
- 답변 4단 구조 reminder: 결론 → 메커니즘 → 트레이드오프 → msa 사례

### 답변 시 필수 포함 키워드

- "본 msa 프로젝트에서는..." (실전 매핑)
- "트레이드오프는..." (모든 답변)
- 숫자 (DAU 100만, RPS 600, P99 200ms 같은 정량)
- 모르면 "거기까진 안 봤습니다, 다만 키워드는 X 이고..." (지도 그리기)

---

## 7. 출처별 인덱스

| 주제 | 카드 수 | 직접 링크 | 회독 우선순위 |
|---|---|---|---|
| #1 AWS Network | 20+ | [1-aws-network/19-interview-qa.md](1-aws-network/19-interview-qa.md) | 시나리오 D |
| #2 JVM/GC | 52 | [2-jvm-gc/22-interview-qa.md](2-jvm-gc/22-interview-qa.md) | **모든 시나리오 핵심** |
| #3 Java/Kotlin Concurrency | 38 | [3-java-kotlin-concurrency/24-interview-qa.md](3-java-kotlin-concurrency/24-interview-qa.md) | **시나리오 A 핵심** |
| #4 DB Index/Transaction | 42 | [4-db-index-transaction/18-interview-qa.md](4-db-index-transaction/18-interview-qa.md) | 시나리오 E |
| #5 Spring @Transactional | 50 | [5-spring-transactional/14-interview-qa.md](5-spring-transactional/14-interview-qa.md) | **시나리오 B/C 핵심** |
| #6 Kafka Internals | 48 | [6-kafka-internals/12-interview-qa.md](6-kafka-internals/12-interview-qa.md) | **시나리오 E 핵심** |
| #7 Distributed Systems | 44 | [7-distributed-systems/20-interview-qa.md](7-distributed-systems/20-interview-qa.md) | **시나리오 B/E 핵심** |
| #8 System Design | 50 | [8-system-design/13-interview-qa.md](8-system-design/13-interview-qa.md) | **시나리오 B 핵심** |
| #9 Redis Deep Dive | 55 | [9-redis-deep-dive/19-interview-qa.md](9-redis-deep-dive/19-interview-qa.md) | 시나리오 E |
| #10 Observability | 50 | [10-observability/14-interview-qa.md](10-observability/14-interview-qa.md) | **시나리오 D 핵심** |
| #11 K8s Deep Dive | 41 | [11-k8s-deep-dive/17-interview-qa.md](11-k8s-deep-dive/17-interview-qa.md) | **시나리오 D 핵심** |
| #12 Latency Numbers | 23 | [12-latency-numbers/11-interview-qa.md](12-latency-numbers/11-interview-qa.md) | 모든 시나리오 보조 |
| #13 Crypto/JWT/SSO | 40 | [13-crypto-jwt-sso/20-interview-qa.md](13-crypto-jwt-sso/20-interview-qa.md) | 보안 직무 |
| #14 CRDT/MRDT | 40 | [14-crdt-mrdt/19-interview-qa.md](14-crdt-mrdt/19-interview-qa.md) | 시나리오 C 보조 |
| #15 Connection Pool | 35 | [15-connection-pool/18-interview-qa.md](15-connection-pool/18-interview-qa.md) | 시나리오 A/E |
| #16 Async/Nonblocking IO | 38 | [16-async-nonblocking-io/19-interview-qa.md](16-async-nonblocking-io/19-interview-qa.md) | 시나리오 A 심화 |
| #17 Spring Web | 36 | [17-spring-web/20-interview-qa.md](17-spring-web/20-interview-qa.md) | 시나리오 B/C |
| #18 gRPC | 30 | [18-grpc/20-interview-qa.md](18-grpc/20-interview-qa.md) | 시나리오 D/E |

---

## 부록 A0. 면접 답변 템플릿 (4단 구조 — 모든 답변 공통)

### Template-1: 단답형 (30초)
```
[결론 한 줄]
"X 로 풉니다."

[메커니즘 1-2 문장]
"왜냐하면 A 라서 B 가 됩니다."

[msa 사례]
"본 msa 의 X 서비스에 적용했습니다."
```

### Template-2: 깊이 답변 (1-2분)
```
[결론 한 줄]
"X 로 풉니다."

[이유 / 메커니즘]
"왜냐하면 A vs B 중 X 가 Y 측면에서 더 적합."
"메커니즘은 ... (자료구조/알고리즘/프로토콜 수준)"

[숫자 근거]
"DAU 100만 × 5 req → 5K QPS, 단일 X 로 OK."

[트레이드오프]
"단 Y 환경에선 Z 로 전환 필요."
"비용은 N 배 늘지만 Y 가치 ..."

[msa 사례 + 한계]
"본 msa 에서는 ... 적용했고, 한계는 ... 으로 향후 개선 예정."
```

### Template-3: 시스템 설계 답변 (5-10분)
```
1. 요구사항 정리 (1분) — Functional + Non-functional
2. 용량 산정 (2분) — DAU / QPS / Storage / Bandwidth
3. API 정의 (2분) — REST / gRPC / Pub-Sub
4. High-Level (3분) — 컴포넌트 + 데이터 흐름
5. DB 스키마 (1분) — 핵심 엔티티 + 관계
6. Deep Dive 1-2 (2분) — 면접관 관심사 / 자기 강점
7. 30초 요약 + Trade-off 1개 + msa 경험 1개
```

---

## 부록 A. 영어 키워드 사전 (의도적 언급으로 점수 ↑)

면접에서 한국어 답변 중 자연스럽게 영어 용어를 박으면 깊이 신호:

- **JVM**: Stop-The-World, Safepoint, Card Table, Remembered Set, SATB, Colored Pointer, Load Barrier, Compressed Oops, Code Cache, Deoptimization, Tiered Compilation, JFR continuous, Native Memory Tracking
- **Concurrency**: happens-before, JMM, AQS, ABA, CAS, monitor inflation, lock elision, escape analysis, scalar replacement, lock-free, wait-free, structured concurrency, virtual thread pinning, JEP 491
- **DB**: clustered index, secondary lookup, MVCC, ReadView, next-key lock, gap lock, Insert Intention, MDL chain, ICP (Index Condition Pushdown), filesort, temp table, INSTANT/INPLACE/pt-osc/gh-ost, online DDL
- **Spring**: TransactionInterceptor, AbstractRoutingDataSource, LazyConnectionDataSourceProxy, FlushMode MANUAL, AFTER_COMMIT, REQUIRES_NEW, NESTED Savepoint, UnexpectedRollbackException, DelegatingFilterProxy, FilterChainProxy
- **Kafka**: ISR, HW, LEO, LSO, KRaft, ZAB, KIP-679, KIP-392, KIP-848, KIP-932, transactional.id epoch fencing, Cooperative-Sticky, sticky partitioner, log compaction, tiered storage
- **Distributed**: CAP, PACELC, FLP, Linearizability, SI, SSI, write skew, fencing token, RedLock, RedLock 비판 (Kleppmann), Pivot Transaction, Vector Clock, HLC, SATB, Quorum, Choreography
- **Redis**: ConcurrentBag, listpack, ziplist, embstr 44B, intset, skiplist, RESP3, MULTI/EXEC, Lua effects replication, RedLock, Sentinel quorum, hash tag {}, MOVED/ASK redirect
- **K8s**: ReplicaSet, StatefulSet, ConfigMap hash suffix, Headless Service, ClusterIP NAT, kube-proxy IPVS/eBPF, ndots:5, NodeLocal DNSCache, NetworkPolicy, OPA Gatekeeper, Kyverno, SPIFFE/SPIRE, GitOps SoT, Argo Rollouts AnalysisRun
- **Observability**: RED/USE/Golden Signals, Cardinality, exemplar, head/tail sampling, MDC propagation, OTel Collector decision_wait, traceparent W3C, recording rule, multi-window multi-burn-rate, Sloth, Pyroscope continuous profiling
- **Network**: VPC CNI Branch ENI, Prefix Delegation, Cross-AZ $0.01/GB, fetch-from-follower, ALB/NLB, Gateway/Interface Endpoint, PrivateLink, Topology Aware Routing, AWS WAF + Shield, Route 53 Latency-based Routing
- **Security**: AES-GCM AEAD, OAEP/PSS, argon2id, length extension, HMAC, Refresh Rotation, alg:none, RFC 9700 PKCE, OIDC, SAML XSW, KMS Envelope, KEK/DEK, FIPS 140-2 Level 3, mTLS, SPIFFE SVID, OCSP Stapling, BREACH

---

## 부록 B. 자가 평가 종합 체크리스트

면접 1주 전 다음 30개를 30초 내 막힘없이 답할 수 있어야 합격선:

### 런타임 (10개)
- [ ] JVM 메모리 5영역 + 컨테이너 limit 매핑
- [ ] G1 vs ZGC 선택 기준 + 트레이드오프 3가지
- [ ] OOM 5종 + OOMKilled 진단 절차
- [ ] synchronized vs volatile + happens-before
- [ ] DCL volatile 빠지면 + lock 진화 4단계
- [ ] CompletableFuture vs Coroutine 표현력
- [ ] Coroutine state machine + Structured Concurrency
- [ ] Virtual Thread 동작 + pinning + JEP 491
- [ ] Thread dump 5초 간격 3-5회 패턴
- [ ] @Transactional 안 먹는 5대 함정

### 데이터 (10개)
- [ ] InnoDB clustered = PK + secondary lookup 2단계
- [ ] InnoDB RR 의 next-key lock + write skew 한계
- [ ] EXPLAIN type/key/rows/Extra + 안티패턴 5
- [ ] REQUIRES_NEW vs NESTED + JPA 미지원
- [ ] readOnly 4효과 + RoutingDataSource + LazyConnection
- [ ] HikariCP 풀 사이즈 Little's Law
- [ ] "Connection is not available" 4 원인 분류
- [ ] Cache Stampede 방어 4 (jitter/single-flight/XFetch/refresh-ahead)
- [ ] RDB+AOF+mixed + BGSAVE fork CoW
- [ ] Redis Cluster 16384 슬롯 + hash tag 함정

### 분산/메시징 (10개)
- [ ] Kafka 토픽/파티션 = 병렬+순서+장애 단위
- [ ] acks=all + min.ISR=2 + idempotence
- [ ] Kafka 빠른 이유 3 (Sequential/PageCache/Zero-copy)
- [ ] EOS 가 외부 DB 에서 깨지는 이유 + at-least-once + 멱등
- [ ] CAP = 분할만, PACELC 평시
- [ ] Saga + Outbox + 멱등 Consumer 5종 패키지
- [ ] Idempotent Consumer (eventId + processed_event)
- [ ] CB 3상태 + Token Bucket vs Leaky Bucket
- [ ] Redis 분산 락 한계 + fencing token + RedLock 비판
- [ ] gRPC 4 패턴 + K8s LB 함정 + Deadline propagation

---

## 회독 권장 일정

- **D+0**: 학습 종료 직후 — Section 1, 7 로 지도화
- **D+7**: Section 2 Top 50 + Section 5 함정 30
- **D+14**: Section 3 영역별 정독
- **D+30**: Section 4 모의 시나리오 5개 시뮬레이션
- **면접 1주 전**: 부록 B 체크리스트 30개 자가 평가
- **면접 1시간 전**: Section 6 압축 가이드만

---

## 부록 C. Cross-Cutting 통합 카드 (8개 — 18 주제 가로지름)

면접관이 의도적으로 "여러 영역 가로지르는 문제" 를 던질 때 답변할 수 있는 통합 카드.

### CC1. "K8s 위 Spring 서비스가 OOMKilled 가 반복됩니다" — #11 + #2 + #10 + #15
> Layer 분해: 1) `kubectl describe` Last State 확인. 2) `kubectl top` 추이. 3) Pod 안 NMT diff 로 JVM 영역 분리(heap vs metaspace vs direct vs thread). 4) Lettuce/Netty direct buffer leak 의심 시 `-Dio.netty.maxDirectMemory` 명시. 5) HikariCP leak detector(10000ms) 가 stack trace 까지 잡음. 6) MaxRAMPercentage=70 권장(default 75 는 1Gi limit 에서 빠듯). 7) heap dump 자동(`HeapDumpOnOutOfMemoryError`) + PVC. 8) Prometheus jvm_memory + container_memory_working_set 알람 분리.
> 출처: #11 Q4, Q38, #2 Q26, Q42, #10 Q33, #15 Q3

### CC2. "Kafka 멱등 + Saga 보상 + DB 짧은 TX" — #6 + #7 + #5
> 흐름: order(Outbox) → Kafka → inventory(processed_event PK 멱등) → reserve(@Version Optimistic) → outbox → Kafka → fulfillment. 보상은 ReleaseStockByOrderUseCase + ReservationExpiry(30분 TTL). msa 의 OrderService(orchestration) + OrderTransactionalService(짧은 TX) 분리는 ADR-0020 외부 IO 분리 + Saga + Outbox 가 동시에 만족됨. 다음 ADR 후보: SchedulerLock 으로 multi-replica Outbox 중복 발행 차단.
> 출처: #5 Q3.7, Q4.1, Q4.2, #6 Q4.1, #7 Q3.6, Q5.5

### CC3. "Redis 분산락 + CRDT 충돌 해결" — #9 + #7 + #14
> Redis 분산락은 efficiency 용도 — fencing token 없으면 GC pause + failover 로 깨짐(Kleppmann 비판). correctness 가 핵심이면 ZooKeeper/Etcd 또는 ACID DB SELECT FOR UPDATE. CRDT 는 conflict-free 자동 merge — semilattice ACI 보장. msa 는 single-region single-master 라 CRDT 트리거(multi-region/오프라인/협업) 없음 → 분산락도 Phase 3 multi-replica 진입 시점 도입. analytics PV/UV 카운터는 partition 단위 단일 consumer 라 PN-Counter 도 의미 없음.
> 출처: #9 Q42-44, #7 Q4.7, Q4.8, #14 Q4.1-4.5

### CC4. "JWT 인증 + Filter 체인 + 분산 trace" — #13 + #17 + #10
> Spring Security FilterChainProxy 가 13개 안팎 Security Filter 순회. 일반 Filter 와 위치 — DispatcherServlet 밖, OncePerRequestFilter 베이스. trace_id 는 Filter (HIGHEST_PRECEDENCE-1) 가 receive → MDC put → finally remove 패턴, logback `[%X{traceId:-}]` 출력. JWT 는 Refresh Rotation + reuse detection. Gateway 는 Redis blacklist fail-open + access token 5-30분, 헤더 X-User-Id 주입은 NetworkPolicy 로 외부→Gateway 강제 또는 mesh mTLS 가 전제. msa 는 OpenTelemetry 도입이 다음 단계.
> 출처: #13 Q2.1, Q2.2, Q2.8, #17 Q1.5, Q2.1, #10 Q21, Q22

### CC5. "HikariCP 튜닝 + JVM GC pause + Latency Budget" — #15 + #2 + #12
> Hikari acquire P99 = JVM GC pause 와 상관관계 — STW 가 길어지면 borrow 대기 시간이 동시에 폭증. 진단: GC log + Hikari hikaricp.connections.usage P99 + DB PROCESSLIST. 풀 사이즈는 Little's Law L=λW, "small is fast". leakDetectionThreshold prod 무조건 활성. ADR-0025 latency budget Tier 1 P99 SLA 가 강제 — 외부 IO 분리(ADR-0020) + readOnly 트랜잭션 분리 + RoutingDataSource 가 모두 latency 측정 가능 형태로 노출되어야.
> 출처: #15 Q1, Q3, #2 Q25, #12 Q2, Q5

### CC6. "gRPC streaming + 백프레셔 + Reactor" — #18 + #16 + #7
> gRPC Server-streaming 은 HTTP/2 per-stream flow control 로 자동 백프레셔(window). Client/Bidi 는 onReady 콜백으로 application 측 backpressure. Reactor 의 `request(n)` 신호와 매핑 가능 — Coroutine `Flow<T>` collect 가 자연스러움. K8s 에서 multiplex 함정 → Headless service + 클라 round_robin. Resilience4j CB + gRPC retry/hedging service config 병행. Deadline propagation 으로 fan-out tail 자동 차단.
> 출처: #18 Q4, Q11, Q12, Q18, #16 Q25, #7 Q4.1

### CC7. "DB 격리 + Replica 라우팅 + Read-After-Write" — #4 + #5 + #15
> InnoDB RR + next-key lock 은 단일 DB. Replica 는 비동기 → read-after-write 비일관성. Stickiness 옵션 4: Redis "최근 N초 master" 마커 / @WithMaster hint / service 가 master repository 직접 / eventual + UI polling. msa 는 명시 미정 → ADR 후보. RoutingDataSource + LazyConnectionDataSourceProxy 가 readOnly=true 만 replica 로 보냄 — Spring Data JPA 자동 트랜잭션은 readOnly=false 라 단순 조회는 master 로 가서 의도치 않게 안전(read-your-write).
> 출처: #4 Q4.6, #5 Q2.10, Q4.3, Q4.8, #15 Q4

### CC8. "관측 4축 종합 디버깅" — #10 + #11 + #2 + #6
> 5분 root cause 워크플로: Slack alert → Grafana RED dashboard → application/uri 변수 → outlier 시각 → Heatmap Exemplar diamond marker → Tempo trace → 가장 느린 span → "Logs for this span" → Loki trace_id → stack trace + Pyroscope flame graph → Annotation(배포 시각) 비교 → 회귀 함수 식별. 전제: MDC trace_id 전파 + 3축 datasource link + Exemplar 가 모두 갖춰져야. K8s 면 ServiceMonitor 자동 scrape + part-of 라벨 zero-config + 16개 서비스 통합 dashboard. Kafka consumer lag 폭증 시 `kafka-consumer-groups --describe` → 컨슈머 로그 rebalance → APM trace 처리 단계 → 임시 scale-out → 근본 원인.
> 출처: #10 Q40, #11 Q36, #2 Q25, #6 Q4.6

---

## 부록 D. 답변 패턴 - "어떻게 진단하시나요?" 전용

면접관이 "운영 사고 진단" 류 질문을 던질 때 자동 발동할 답변 템플릿:

### D1. JVM 사고 (GC/OOM/Pause/Memory Leak)
1. 알림 인지 (Prometheus alert / Slack)
2. Pod 식별 (`kubectl describe` + Last State)
3. 메트릭 추이 (`kubectl top` / Grafana JVM dashboard)
4. JVM 안 진단 (`jcmd`):
   - `Thread.print -l` (5초 간격 3-5회)
   - `VM.native_memory summary` (NMT 활성 시)
   - `GC.heap_dump` (live=true)
   - `JFR.start duration=60s settings=profile` (continuous 안 했으면)
5. JFR/Heap dump 분석 (MAT Leak Suspects, async-profiler, GCEasy)
6. 가설 → 재현 테스트 → 수정 → 회귀 측정 (JMH + k6)

### D2. DB 사고 (slow query / lock / hang / deadlock)
1. RED 대시보드: http_server_requests_seconds P99 spike
2. DB 측: `SHOW PROCESSLIST` + `information_schema.innodb_trx` + `metadata_locks`
3. Slow log → pt-query-digest top 10
4. EXPLAIN ANALYZE 의 type/key/rows/Extra 4 필드
5. SHOW ENGINE INNODB STATUS — LATEST DETECTED DEADLOCK
6. 첫 대응: long TX kill → 격리 격하 검토 → 인덱스/쿼리 재작성 → write 비용 측정 → PR 의 EXPLAIN 첨부 의무 컨벤션

### D3. Kafka 사고 (lag / rebalance / DLQ)
1. `kafka-consumer-groups --describe` — 어느 partition 의 lag
2. 컨슈머 로그 — rebalance 빈도 / 처리 시간
3. APM trace — 처리 단계 어디서 느림
4. 임시 조치:
   - consumer scale-out (≤ partition 수)
   - max.poll.records 줄이기
   - max.poll.interval.ms 늘리기 (처리 시간 길면)
5. 근본 원인:
   - 외부 API timeout → Resilience4j CB
   - DB 튜닝 → 인덱스 / connection pool
   - Cooperative-Sticky 로 변경
6. DLT 메시지 재처리 + processed_event 멱등 보강

### D4. Network/K8s 사고 (Pending Pod / 503 / DNS slow)
1. `kubectl get pods --all-namespaces -o wide | grep -v Running`
2. `kubectl describe pod` Events:
   - FailedScheduling (insufficient cpu/memory) → Cluster Autoscaler
   - PVC bound 대기 → WaitForFirstConsumer + AZ affinity
   - image pull → registry 화이트리스트
3. `kubectl get events --sort-by=.lastTimestamp`
4. 503 → Service Endpoints 0 (readiness fail) → Pod 의 health endpoint
5. DNS slow → ndots:5 함정 → NodeLocal DNSCache 또는 FQDN

---

## 부록 E. 시니어/테크리드 차별화 답변 (면접 마지막 30초 멘트)

각 영역에서 "그 외 더 알고 있는 것?" 질문에 한 줄로 차별화:

- **JVM**: "JFR custom event 로 비즈니스 milestone 을 GC/CPU 같은 timeline 에서 분석 가능" (#2 Q32)
- **동시성**: "Virtual Thread 의 JEP 491 이 synchronized pinning 거의 해소 → JDK 25 에서 채택 trigger" (#3 Q2.12)
- **DB**: "ADR-0020 의 외부 IO 분리는 결국 lock 보유 시간을 ms 단위로 줄이는 것" (#4 Q4.9)
- **Spring TX**: "OrderService(TX 없음) + OrderTransactionalService(짧은 TX) 분리로 self-invocation + catch + rollback-only 함정 동시 회피" (#5 Q4.2)
- **Kafka**: "msa 의 producer 표준 = acks=all + idempotence=true + max.in.flight=5 + delivery.timeout.ms=120s" (#6 Q6.1)
- **분산**: "효과적 EOS = at-least-once + 멱등 (effectively-once), Outbox + processed_event 가 정공" (#7 Q5.4)
- **시스템 설계**: "DAU 10x 시 DB → Cache → MQ → Network 순 병목 이동" (#8 §0)
- **Redis**: "ClusterTopologyRefreshOptions 의 enableAllAdaptiveRefreshTriggers 가 cluster 운영 default" (#9 Q55)
- **Observability**: "Native Histogram(Prometheus 2.40+) 으로 sparse bucket → 10x 비용 절감" (#10 Q12)
- **K8s**: "Cluster Autoscaler 와 HPA 의 2단계 latency 2-5분 → over-provisioning pause Pod 로 흡수" (#11 Q20)
- **Latency**: "5개 비율 (L1→DRAM ×100, DRAM→SSD ×1000, SSD→DC ×30, DC→대륙 ×300, 평균→P99 ×3-10)" (#12 Q1-1-1)
- **보안**: "argon2id 가 memory-hard 라 GPU 공격 비용 비대화 → bcrypt 의 72 byte 한계 + GPU 약점 극복" (#13 Q1.5)
- **CRDT**: "msa 의 single-master 가정에서는 CRDT 트리거 없음 — multi-region/오프라인/협업 결정 시점에 도입" (#14 Q4.1)
- **Pool**: "msa gateway 의 SSE response-timeout=0 + Lettuce reactive 가 connection-bound 워크로드의 모범" (#15 Q6.2)
- **Async**: "분면 (3) sync non-blocking 과 (4) async non-blocking 구분 — io_uring 만 진짜 async" (#16 Q5)
- **Spring Web**: "Default Typing 의 RCE 위험 → Jackson 2.10+ BasicPolymorphicTypeValidator allow-list" (#17 Q3.2)
- **gRPC**: "schema-first MSA 내부 통신의 표준, mesh 와 동시 도입 X (한 번에 한 변수 원칙)" (#18 Q24, Q30)

---

## 부록 F. msa 프로젝트 키 ADR 매핑

면접에서 "본 프로젝트의 의사결정 ADR" 을 인용할 때 빠르게 참조:

| ADR | 핵심 결정 | 학습 주제 매핑 |
|---|---|---|
| ADR-0002 | 런타임 — MVC + JPA blocking + Coroutine 외부 IO + Tomcat VT | #3 동시성, #16 Async, #17 Spring Web |
| ADR-0011 | Saga Choreography (단순성 우선) | #7 분산, #6 Kafka |
| ADR-0012 | Idempotent Consumer (eventId + processed_event) | #6 Kafka, #7 분산 |
| ADR-0015 | Resilience 4종 — CB + DLQ + Bulkhead + Rate Limiting | #7 분산 |
| ADR-0019 | K8s 전환 — Eureka 제거 + Jib + k3s-lite/prod-k8s 이원화 | #11 K8s |
| ADR-0020 | @Transactional 외부 IO 분리 | #5 Spring TX, #15 Connection Pool |
| ADR-0022 | Entity 수정 규칙 (전체 동기화 vs 부분 수정) | #5 Spring TX |
| ADR-0025 | Latency Budget — Tier 1 P99 SLA + 측정 표준 | #10 Observability, #12 Latency |
| ADR-0026 | docs 분류 정책 — ADR vs Conventions vs Standards | (메타) |

---

## 마무리

730개 카드 중 **Top 50** 만 막힘없이 답할 수 있으면 시니어 백엔드 면접 1차 통과선.
**시나리오 B (시스템 설계)** 또는 **시나리오 C (테크리드)** 모의 답변까지 가능하면 합격 안정권.

핵심은 정답이 아니라 **선택과 그 근거** + **트레이드오프 인정** + **본 msa 사례 매핑**.

> "이 정도까지 이해함" 의 선을 명확히 그어 답변. 모르는 건 솔직히 "거기까진 안 봤습니다, 다만 키워드는 X 이고..." 식으로 *지도 그리기* 가 답.

> 면접 답변 = 정답률 X, **지도/맥락/트레이드오프** O.
