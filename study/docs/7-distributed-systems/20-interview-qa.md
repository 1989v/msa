---
parent: 7-distributed-systems
type: deep
order: 20
created: 2026-05-01
---

# 20. 면접 Q&A 카드 — 분산 시스템 이론 + 패턴 40문항

> 5 영역 × 8개 = 40 카드. 회독용. 각 카드는 1-2 문장 핵심 + 후속 질문 대비.
> 권장: 첫 학습 직후 1회, 1주 후 1회, 1달 후 1회 — 총 3회독.

---

## 영역 1: 이론 (CAP/PACELC/FLP/일관성)

### Q1.1. CAP 에서 무엇을 선택하시나요?

**핵심**: CAP (Consistency / Availability / Partition tolerance, 일관성·가용성·분할 내성) 는 **분할 시점만** 적용. 도메인별로 다름.
- 재고 / 결제 / 인증: **CP** (강일관성 우선)
- 검색 / 추천 / 카탈로그: **AP** (가용성 우선)

**후속**: "그럼 평시엔?" → PACELC (Partition → Availability/Consistency, Else → Latency/Consistency) 로 EL/EC 추가 설명.

### Q1.2. CAP 의 C 가 정확히 뭔가요?

**핵심**: **Linearizability**. 모든 노드가 같은 시점에 같은 데이터를 보고, 그 순서가 wall-clock 과 일치. ACID (Atomicity / Consistency / Isolation / Durability, 원자성·일관성·격리성·내구성) 의 C (constraint) 와는 다름.

### Q1.3. PACELC 가 CAP 보다 정확한 이유?

**핵심**: CAP 는 분할 시점만, PACELC 는 **평시 + 분할** 양쪽. 평시에도 strong consistency 는 quorum 비용 발생 → latency vs consistency 트레이드오프.

### Q1.4. FLP Impossibility 가 뭔가요?

**핵심**: 비동기 + 1개 노드 장애만으로 **결정론적 합의 알고리즘 불가능**. 실제 시스템은 partially-sync + 무작위 timeout 으로 우회.

**후속**: "그럼 Raft 는 어떻게?" → randomized timeout, partially-sync 가정.

### Q1.5. Eventual Consistency 를 실무에서 어떻게 다루나요?

**핵심**:
- 도메인 분리 (돈 strong, 검색 eventual)
- Read-your-writes 로 사용자 본인 write 는 master read
- Reconciliation 배치로 divergence 수렴
- UI 에 "처리 중" 표시

### Q1.6. Linearizable, Sequential, Causal 차이?

**핵심**:
- **Linearizable**: 모든 연산이 wall-clock 순서대로 보임
- **Sequential**: 모든 노드가 같은 순서로 보지만 wall-clock 은 무관
- **Causal**: 인과관계 (happens-before) 만 보장, 무관계는 자유

### Q1.7. Read-your-writes 를 어떻게 보장?

**핵심**: 본인 write 후 일정 시간 (5-10s) sticky session → master 에서 read. 또는 client 가 write 의 version/timestamp 기억 후 read 시 그 이상 버전 강제.

### Q1.8. 분산 시스템에서 wall-clock 비교가 위험한 이유?

**핵심**: NTP drift, GC (Garbage Collection, 가비지 컬렉션) pause, VM migration 으로 노드 간 시계가 ms~s 단위 어긋남. 인과 판단은 **logical clock (Lamport/Vector/HLC)** 또는 **Kafka offset** 같은 sequence.

---

## 영역 2: 합의 (Paxos/Raft/Clocks)

### Q2.1. Raft 의 leader election 절차?

**핵심**: Follower → election timeout (150-300ms 무작위) → Candidate → term+1 + 자기 vote → RequestVote RPC → majority vote 받으면 Leader → heartbeat 시작.

### Q2.2. Raft 가 split-brain 을 어떻게 방지?

**핵심**:
1. **Majority quorum** — 두 leader 가 동시에 majority 받기 불가능
2. **Term 단조 증가** — 옛 leader 가 부활해도 큰 term 보면 step-down

### Q2.3. Raft vs Paxos 차이?

**핵심**: Raft 는 **강한 leader + 명시적 분리** (election / log / safety). Paxos 는 일반화 (Multi-Paxos 의 leader 도 암묵적). 안전성 동등, 이해도/구현은 Raft 가 압승.

### Q2.4. Raft 에서 commit 된 entry 가 보존되는 이유?

**핵심**: **Election Restriction** + **Log Matching**. 후보가 leader 되려면 자기 log 가 majority 보다 같이 최신 + commit 된 entry 는 majority 에 있음 → 두 majority 는 적어도 1노드 겹침 → 그 노드가 commit entry 보유.

### Q2.5. Lamport Clock 과 Vector Clock 차이?

**핵심**:
- **Lamport**: 단일 카운터, partial order, total order 는 (L, nodeId) tiebreak
- **Vector**: 노드별 카운터 N개, **concurrent** 정확히 감지 가능

### Q2.6. Vector Clock 으로 concurrent 감지?

**핵심**: V1 ≤ V2 도 V2 ≤ V1 도 아니면 concurrent. 두 write 의 vector 가 어느 한쪽도 아니면 사용자에게 sibling 보여주거나 CRDT 로 자동 merge.

### Q2.7. msa 에서 합의 알고리즘 직접 사용?

**핵심**: 직접은 X. 그러나 인프라가 사용 — Kafka (ZAB/KRaft), etcd (Raft), Redis Sentinel (Raft 변형). Kafka partition + offset 이 사실상 logical clock.

### Q2.8. Hybrid Logical Clock 이 왜 필요한가?

**핵심**: Vector Clock 은 노드 수에 비례한 메타데이터. HLC 는 (physical_time, logical_counter) 로 고정 크기 + wall-clock 친화. CockroachDB/MongoDB 사용.

---

## 영역 3: 분산 트랜잭션 (2PC/Saga/Idempotency)

### Q3.1. 2PC 가 MSA 에서 안 쓰이는 이유?

**핵심**: 2PC (Two-Phase Commit, 2단계 커밋) 가 MSA (Microservices Architecture, 마이크로서비스 아키텍처) 에서 안 쓰이는 이유는 **Blocking** (coordinator 장애 시 잠금 무한 보유) + **성능** (잠금 시간 길어 throughput ↓) + **매니지드 DB XA 미지원** + **운영 복잡도**.

### Q3.2. Saga Choreography vs Orchestration?

**핵심**:
- **Choreography**: 이벤트 기반 decoupling, 단계 ≤ 4
- **Orchestration**: 중앙 조정자, 단계 ≥ 5 또는 추적/감사 요구

msa 는 inventory ↔ fulfillment 가 Choreography (3-4 단계).

### Q3.3. 보상 트랜잭션의 어려움?

**핵심**:
1. 시간상 되돌릴 수 없으니 의미적 역연산 (refund)
2. 멱등 + commutative 필요
3. Pivot transaction (이메일) 은 보상 불가 → 다른 도메인 이벤트로 처리

### Q3.4. Saga 에서 isolation 부재로 발생하는 문제?

**핵심**: Lost update, dirty read, fuzzy read. 해법은 (1) Optimistic Lock, (2) UI 의 pending 표시, (3) read model 격리.

### Q3.5. 멱등성이 왜 그렇게 중요?

**핵심**: 분산 메시징/동기 호출은 **at-least-once 가 기본** → 중복은 막을 수 없음 → 멱등이 없으면 timeout = 이중 결제 / 이중 예약 사고.

### Q3.6. 멱등성을 어떻게 보장?

**핵심**: 4가지 패턴 조합:
1. 자연 멱등 (PUT, set 절대값)
2. DB UNIQUE (비즈니스 키)
3. Idempotency-Key (외부 API)
4. processed_event/Inbox (Kafka consumer)

### Q3.7. Idempotency-Key 의 표준 보관 기간?

**핵심**: Stripe 는 24시간. msa 의 processed_event 는 7일 (ADR (Architecture Decision Record, 아키텍처 결정 기록)-0012). Body hash 같이 저장 → 같은 key 다른 body 는 422 reject.

### Q3.8. Outbox 패턴이 뭔가요?

**핵심**: DB tx 안에서 outbox 테이블에 이벤트 row INSERT → 같은 tx 로 commit → 별도 publisher 가 polling/CDC (Change Data Capture, 변경 데이터 캡처) 로 Kafka 발행. **Dual write 문제 해결**.

---

## 영역 4: 운영 패턴 (CB/Bulkhead/Retry/Lock)

### Q4.1. Circuit Breaker 의 3가지 상태?

**핵심**: CLOSED (정상 통과 + 실패율 측정) → 임계 초과 → OPEN (즉시 실패) → waitDuration 후 → HALF_OPEN (제한된 시험 호출) → 성공이면 CLOSED, 실패면 OPEN.

### Q4.2. CB 의 sliding window 종류?

**핵심**:
- **Count-based**: 최근 N건 기준 (msa: 10건)
- **Time-based**: 최근 N초 기준

QPS (Queries Per Second, 초당 쿼리 수) 낮으면 time-based 가 정확. 일정하면 count-based 가 가벼움.

### Q4.3. CB 의 fallback 어떻게 설계?

**핵심**: 도메인 critical 도에 따라:
- 추천/검색: 빈 결과 (graceful degradation)
- 가격: 캐시
- 결제: 즉시 실패 + 사용자 안내 (재시도 유도)

### Q4.4. Retry 의 3원칙?

**핵심**:
1. **멱등 보장된 endpoint 만**
2. **retryable 에러만** (5xx, timeout, 429, connection)
3. **Exponential Backoff + Full Jitter** (thundering herd 방지)

### Q4.5. Bulkhead vs Rate Limiter 차이?

**핵심**:
- **Bulkhead**: 동시 호출 수 격리 (자원 풀 보호)
- **Rate Limiter**: 시간당 호출 수 제한 (처리량 제어)

함께 사용 가능 + 보완.

### Q4.6. Token Bucket vs Leaky Bucket?

**핵심**:
- **Token Bucket**: burst 허용, 평소 안 쓴 만큼 단기 폭주 OK
- **Leaky Bucket**: 항상 일정 출력, 사용자 친화 X

msa 의 Gateway 는 Token Bucket (Spring Cloud Gateway 표준).

### Q4.7. Redis 분산 락의 한계?

**핵심**:
1. GC pause 로 holder 멈췄다 깨면 TTL 만료 후 다른 holder 와 동시 critical section
2. 단일 Redis failover 시 비동기 복제로 락 사라질 수 있음
- 해법: **fencing token** + 자원 측 검사 / ZooKeeper

### Q4.8. RedLock 의 Kleppmann 비판은?

**핵심**: Clock drift / GC pause / network partition 으로 lease 만으론 안전 보장 X → fencing token 없이는 어떤 lease-based 락도 안전 X.

---

## 영역 5: 거버넌스 + msa 적용

### Q5.1. Outbox 와 Inbox 의 차이?

**핵심**:
- **Outbox**: 발행 측 (DB tx + Kafka 원자성)
- **Inbox**: 소비 측 (영속 dedup + 처리 상태 추적)

msa 의 processed_event 는 Inbox 의 단순화 버전.

### Q5.2. Event Sourcing 의 본질?

**핵심**: 상태를 이벤트 시퀀스로 저장. 현재 상태 = 이벤트 replay. 완전한 audit + 시간 여행 + 새 read model 추가 용이.

### Q5.3. CQRS 와 ES 의 관계?

**핵심**: 별개 패턴. CQRS (Command Query Responsibility Segregation, 명령-조회 책임 분리) = read/write 모델 분리, ES (Event Sourcing, 이벤트 소싱) = 상태 = 이벤트. 자주 함께 쓰이지만 따로도 가능. msa 는 CQRS 만 (ES 미적용).

### Q5.4. Exactly-Once Semantics 가 가능한가?

**핵심**: 엄밀한 EOS 는 분산에서 불가능. 실용적으론 **at-least-once + 멱등 = effectively-once**. msa 는 Outbox + enable.idempotence + processed_event 로 사실상 EOS 동등.

### Q5.5. msa 의 Saga 흐름을 한 문장으로?

**핵심**: order → outbox `order.completed` → inventory reserve + `inventory.stock.reserved` → fulfillment 생성 → fulfillment shipped/cancelled → inventory confirm/release. Choreography + Outbox + 멱등 Consumer + Reservation TTL 30분.

### Q5.6. msa 의 멱등성 표준?

**핵심** (ADR-0012):
1. 모든 Kafka 이벤트에 UUID eventId
2. Outbox publisher 가 payload 에 주입
3. Consumer 는 processed_event PK = eventId 로 dedup
4. 비즈니스 키 자연 멱등도 추가 방어

### Q5.7. msa 의 Resilience 전략 한 문장으로?

**핵심** (ADR-0015): order 외부 호출엔 Resilience4j CB, Kafka Consumer 엔 FixedBackOff + DLT, Gateway 엔 Redis Token Bucket, Inventory reserve 엔 Redis 카운터 Admission Control, 모든 stateful 호출은 suspend + WebClient.

### Q5.8. msa 에 Event Sourcing 도입한다면?

**핵심**: quant (자동매매) 1순위. 거래 내역 = stream, 회계 audit, 시간 여행 query 가치. order/payment 는 ledger 도메인 분리해서 점진 도입. product/search 는 비추.

---

## 영역별 종합 카드

### Card A: "분산 시스템의 본질을 한 문장으로?"

> 부분 장애 (partial failure) + 네트워크 비결정성 (timeout = unknown) 위에서 **협력하는 모델**을 짜는 일. CAP/PACELC/FLP 가 그 한계, Saga/멱등성/CB 가 답.

### Card B: "MSA 분산 트랜잭션의 표준 패키지?"

> Saga + Outbox + 멱등 Consumer (eventId/processed_event) + Optimistic Lock + Reservation TTL. 5 종 세트가 하나라도 빠지면 위험.

### Card C: "Resilience 4종 세트?"

> Circuit Breaker (외부 호출) + DLQ (Dead Letter Queue, 데드 레터 큐) (Kafka consumer) + Bulkhead (자원 격리) + Rate Limiting (처리량). 하나만 적용하면 나머지가 발목 잡음.

### Card D: "일관성 모델 결정 트리?"

> 돈/재고/락 → Linearizable. 사용자 즉시 보임 → Read-your-writes. 댓글/wishlist → Causal+. 검색/추천/통계 → Eventual.

---

## 자주 틀리는 트랩 정리

| 트랩 | 정답 |
|---|---|
| "AP 시스템입니다" | "분할 시 A 우선, 평시엔 EL — PACELC" |
| "Strong = 빠름" | "Strong = 항상 더 느림 (quorum 비용)" |
| "Eventual = 결국 일치" | "결국엔 맞지만 **언제** 보장 X — divergence 수렴 메커니즘 필요" |
| "2PC 가 표준" | "MSA 는 Saga, 2PC 는 분산 DB 내부에만" |
| "Idempotency-Key 만 있으면 됨" | "body hash 같이 저장 + in-progress lock 도 필요" |
| "Kafka enable.idempotence 가 EOS" | "producer 한정. consumer 측 dedup (processed_event) 도 필요" |
| "Redis SETNX 분산 락 안전" | "fencing token 없으면 GC pause + failover 로 위험" |
| "CB 만 있으면 안전" | "fallback + ignoreExceptions + Bulkhead 같이" |

---

## 모의 면접 시나리오 (10분 시뮬레이션)

**면접관**: "주문 시스템에서 결제 + 재고 + 주문 생성을 어떻게 한 트랜잭션처럼 보장하시나요?"

**답변** (90초):
> "MSA 환경이라 2PC 는 사용하지 않습니다. **Saga Choreography + Outbox + 멱등 Consumer** 의 조합으로 처리:
>
> 1. **Order** 생성 시 Outbox 에 `order.order.completed` 이벤트 같은 tx 로 INSERT
> 2. Outbox Polling/CDC publisher 가 Kafka 로 발행 (eventId 주입)
> 3. **Inventory** consumer 가 processed_event 로 중복 체크 후 `Inventory.reserve()` + Reservation 생성 (30분 TTL) + `inventory.stock.reserved` 발행 (Optimistic Lock 으로 동시성)
> 4. **Fulfillment** consumer 가 같은 패턴으로 `FulfillmentOrder.create(PENDING)` + 발행
> 5. **결제는 동기** WebClient 호출 + Resilience4j CB. 실패 시 보상 이벤트 발행하거나 30분 TTL 만료로 자동 release.
> 6. 모든 consumer 는 멱등 (processed_event), 모든 producer 는 enable.idempotence + acks=all → effectively-once.
>
> 한계는 (1) Choreography 라 흐름 추적 어려움 → OpenTelemetry trace_id 도입 검토, (2) 결제 실패 시 명시적 보상 보강 필요, 가 개선 후보입니다."

**면접관**: "Saga 가 영원히 멈춰있는 시나리오를 어떻게 막죠?"

**답변** (60초):
> "(1) 각 단계 timeout. (2) Reservation 의 TTL 30분 — fulfillment 가 응답 안 와도 ReservationExpiry 스케줄러가 자동 release. (3) ID-aware 한 saga state 추적 테이블 또는 OpenTelemetry trace 로 'pending too long' 알림. (4) DLQ 모니터링 + 재처리 API."

---

## 한 줄 정리

> 40카드 = 분산 시스템 면접 대비 1차 방어선.
> 핵심 5문장만 들고 들어가도 차별화: **(1) CAP=분할만, PACELC=평시도, (2) FLP→timeout 휴리스틱, (3) Saga+Outbox+멱등=MSA 표준, (4) CB+DLQ+Bulkhead+RL=4종 세트, (5) ES 는 audit critical 도메인부터**.
