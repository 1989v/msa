# 분산 시스템 — 커버리지 체크리스트

원천:
- `study/docs/7-distributed-systems/` — 99-concept-catalog.md 전 행 + 본문 01~22 (study/7)
- `study/docs/14-crdt-mrdt/` — 99-concept-catalog.md 전 행 + 본문 01~20 (study/14)
- `study/docs/8-system-design/` — 시나리오(02~17)와 카탈로그 §4 의사결정 카드에서 분산 개념만 (study/8)
- `study/docs/6-kafka-internals/` — 전달 보장 · DLQ 절(study/6)
- 기존 `distributed.yaml` 개념 전부(기존 행) — id 를 하나도 지우거나 바꾸지 않았다
- 분야 표준 — Kleppmann 「Designing Data-Intensive Applications」 5~9장 목차(복제 · 파티셔닝 · 트랜잭션 · 분산 시스템의 문제 · 일관성과 합의), Richardson 「Microservices Patterns」 사가·메시징 장, 「Release It!」 안정성 패턴

표는 온톨로지 파일의 개념 순서(루트 → 단계 → 장치 → 문제·지표 → 용어)를 따른다. 「기존 행」은 이번 라운드 전부터 파일에 있던 개념이다.

## 배치

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| distributed-system | 분산 시스템 (distributed system) | 기존 행 | placed |
| dist-foundations | 장애 가정 · 장애 감지 | study/7 §01 · 분야 표준(DDIA) | placed |
| dist-failure-detection | 장애 감지 (failure detection) | study/7 §01 · 카탈로그 G | placed |
| dist-heartbeat | 하트비트 (heartbeat) | study/7 §06 · 분야 표준(DDIA) | placed |
| dist-phi-accrual-detector | 파이 누적 장애 감지기 (phi accrual failure detector) | study/7 카탈로그 G | placed |
| dist-gossip-protocol | 가십 프로토콜 (gossip protocol) | study/7 카탈로그 G | placed |
| dist-swim-protocol | SWIM | study/7 카탈로그 G | placed |
| dist-partial-failure | 부분 장애 (partial failure) | study/7 §01 | placed |
| dist-gray-failure | 회색 장애 (gray failure) | study/7 §01 | placed |
| dist-false-failure-suspicion | 장애 오판 (false suspicion) | study/7 §02 Q5 · 분야 표준(DDIA) | placed |
| dist-data-distribution | 데이터 분산 | 기존 행 | placed |
| sharding | 샤딩 (sharding) | 기존 행 · study/7 카탈로그 D | placed |
| dist-range-partitioning | 범위 분할 (range partitioning) | study/7 카탈로그 D | placed |
| dist-hash-partitioning | 해시 분할 (hash partitioning) | study/7 카탈로그 D | placed |
| consistent-hashing | 일관 해싱 (consistent hashing) | 기존 행 · study/7 카탈로그 D | placed |
| dist-virtual-node | 가상 노드 (virtual node) | study/8 §02 · 분야 표준(DDIA) | placed |
| dist-rendezvous-hashing | 랑데부 해싱 (rendezvous hashing) | study/7 카탈로그 D | placed |
| dist-rebalancing | 리밸런싱 (rebalancing) | 분야 표준(DDIA) | placed |
| dist-partitioned-secondary-index | 파티션된 보조 인덱스 (local secondary index) | 분야 표준(DDIA) | placed |
| dist-request-routing | 요청 라우팅 (request routing) | 분야 표준(DDIA) | placed |
| dist-sharded-counter | 샤딩 카운터 (sharded counter) | study/8 §15 | placed |
| replication | 레플리케이션 (replication) | 기존 행 · study/7 §04 | placed |
| dist-single-leader-replication | 단일 리더 복제 (leader-follower) | study/7 §04 | placed |
| dist-multi-leader-replication | 다중 리더 복제 (multi-leader) | study/7 §04 | placed |
| dist-leaderless-replication | 리더 없는 복제 (leaderless replication) | study/7 §04 · 카탈로그 D | placed |
| dist-read-repair | 읽기 복구 (read repair) | study/7 카탈로그 B | placed |
| dist-anti-entropy | 안티 엔트로피 (anti-entropy) | study/7 카탈로그 B · study/14 §11 | placed |
| dist-merkle-tree | 머클 트리 (merkle tree) | 분야 표준(DDIA) | placed |
| dist-hinted-handoff | 힌트 핸드오프 (hinted handoff) | study/7 카탈로그 B | placed |
| dist-sloppy-quorum | 느슨한 쿼럼 (sloppy quorum) | 분야 표준(DDIA) | placed |
| dist-sync-replication | 동기 · 비동기 · 반동기 복제 (synchronous replication) | study/7 카탈로그 D | placed |
| dist-failover | 장애 조치 (failover) | study/7 §04 · 카탈로그 F | placed |
| dist-chain-replication | 체인 복제 (chain replication) | 분야 표준(DDIA) | placed |
| dist-distributed-sql | 분산 SQL (distributed SQL) | study/7 카탈로그 §1-A 17 | placed |
| dist-replication-lag | 복제 지연 (replication lag) | 기존 행 · study/7 §04 | placed |
| dist-network-partition | 네트워크 분할 (network partition) | 기존 행 · study/7 §02 | placed |
| dist-hot-partition | 핫 파티션 (hot partition) | study/8 카탈로그 §4 · 분야 표준(DDIA) | placed |
| dist-failover-data-loss | 장애 조치 데이터 유실 (failover data loss) | study/7 §04 7.2 | placed |
| dist-consistency-control | 일관성 수준 선택 | study/7 §03 | placed |
| dist-tunable-quorum | 쿼럼 조정 (tunable consistency) | study/7 §04 · §06 | placed |
| dist-read-your-writes-routing | 자기 쓰기 읽기 라우팅 (sticky read) | study/7 §03 10.1 | placed |
| dist-conflict-resolution | 충돌 해소 (conflict resolution) | study/7 §04 · 카탈로그 D | placed |
| dist-last-write-wins | 마지막 쓰기 우선 (LWW) | study/7 §04 · study/14 §01 | placed |
| dist-multi-value-siblings | 형제 값 보존 (siblings) | study/14 §01 | placed |
| dist-custom-merge | 업무 규칙 병합 (application-defined merge) | study/7 카탈로그 §1-A 40 | placed |
| dist-stale-read | 낡은 읽기 (stale read) | 분야 표준(DDIA) | placed |
| dist-write-conflict | 쓰기 충돌 (write conflict) | study/14 §01 | placed |
| dist-silent-write-loss | 조용한 쓰기 유실 (lost write) | study/14 §01 · 분야 표준(DDIA) | placed |
| dist-conflict-free-replication | CRDT · 병합 가능한 복제 | study/14 | placed |
| dist-crdt | CRDT (Conflict-free Replicated Data Type) | study/14 §02 · study/7 카탈로그 §1-A 39 | placed |
| dist-state-based-crdt | 상태 기반 CRDT (CvRDT) | study/14 §03 | placed |
| dist-op-based-crdt | 연산 기반 CRDT (CmRDT) | study/14 §03 | placed |
| dist-delta-crdt | 델타 CRDT (δ-CRDT) | study/14 §11 | placed |
| dist-crdt-counter | 카운터 CRDT (counter CRDT) | study/14 §04 | placed |
| dist-g-counter | G-Counter (grow-only counter) | study/14 §04 | placed |
| dist-pn-counter | PN-Counter (positive-negative counter) | study/14 §04 | placed |
| dist-bounded-counter | 상한 카운터 (bounded counter) | study/14 §04 | placed |
| dist-crdt-set | 집합 CRDT (set CRDT) | study/14 §05 | placed |
| dist-g-set | G-Set (grow-only set) | study/14 §05 | placed |
| dist-2p-set | 2P-Set (two-phase set) | study/14 §05 | placed |
| dist-or-set | OR-Set (observed-remove set) | study/14 §05 | placed |
| dist-lww-element-set | LWW-Element-Set (last-write-wins element set) | study/14 §05 | placed |
| dist-crdt-register | 레지스터 CRDT (register CRDT) | study/14 §06 | placed |
| dist-lww-register | LWW-Register (last-write-wins register) | study/14 §06 | placed |
| dist-mv-register | MV-Register (multi-value register) | study/14 §06 | placed |
| dist-crdt-map | 맵 CRDT (map CRDT) | study/14 §07 | placed |
| dist-or-map | OR-Map (observed-remove map) | study/14 §07 | placed |
| dist-sequence-crdt | 시퀀스 CRDT (sequence CRDT) | study/14 §08 | placed |
| dist-rga | RGA (Replicated Growable Array) | study/14 §08 | placed |
| dist-logoot | Logoot (dense identifier) | study/14 §08 | placed |
| dist-treedoc | Treedoc | study/14 §08 | placed |
| dist-woot | WOOT (WithOut Operational Transform) | study/14 §08 | placed |
| dist-yata | YATA (Yet Another Transformation Approach) | study/14 §08 | placed |
| dist-fugue | Fugue | study/14 카탈로그 D | placed |
| dist-json-crdt | JSON CRDT | study/14 §09 | placed |
| dist-tree-crdt | 트리 CRDT (tree CRDT) | study/14 §20 8.3 | placed |
| dist-graph-crdt | 그래프 CRDT (2P2P-Graph) | study/14 §20 §7 | placed |
| dist-crdt-gc | CRDT 가비지 컬렉션 (tombstone GC) | study/14 §12 | placed |
| dist-operational-transform | OT (Operational Transformation) | study/14 §14 | placed |
| dist-mrdt | MRDT (Mergeable Replicated Data Type) | study/14 §13 | placed |
| dist-tombstone-bloat | 툼스톤 누적 (tombstone accumulation) | study/14 §12 | placed |
| dist-metadata-growth | 인과 메타데이터 폭증 (actor explosion) | study/14 카탈로그 §1-A 27 | placed |
| dist-time-ordering | 시간 · 순서 추적 | study/7 §05 | placed |
| dist-physical-clock-sync | 물리 시계 동기화 (NTP) | study/7 §05 · 카탈로그 C | placed |
| dist-lamport-clock | Lamport 시계 (Lamport timestamp) | study/7 §05 | placed |
| dist-vector-clock | 벡터 시계 (vector clock) | study/7 §05 | placed |
| dist-hybrid-logical-clock | 하이브리드 논리 시계 (HLC) | study/7 §05 | placed |
| dist-truetime | TrueTime | study/7 §05 §6 | placed |
| dist-total-order-broadcast | 전순서 브로드캐스트 (total order broadcast) | study/7 §05 3.4 | placed |
| dist-causal-broadcast | 인과 브로드캐스트 (causal broadcast) | study/14 §10 | placed |
| dist-clock-skew | 시계 어긋남 (clock skew) | study/7 §05 · §01 | placed |
| dist-id-generation | 전역 ID 생성 | study/8 카탈로그 §4 | placed |
| dist-snowflake-id | Snowflake ID (Snowflake) | study/7 카탈로그 §1 · study/8 §02 | placed |
| dist-uuid-v4 | UUIDv4 (random UUID) | study/7 카탈로그 §1 | placed |
| dist-uuid-v7 | UUIDv7 (UUID version 7) | study/8 카탈로그 §4 | placed |
| dist-ulid | ULID (Universally Unique Lexicographically Sortable Identifier) | study/7 카탈로그 §1 · study/8 카탈로그 §4 | placed |
| dist-segment-allocation | 번호 구간 할당 (hi/lo) | study/8 §02 · 분야 표준(DDIA) | placed |
| dist-id-collision | ID 충돌 (id collision) | 분야 표준(DDIA) | placed |
| dist-random-id-write-scatter | 무작위 키 삽입 분산 (random insert) | 분야 표준(DDIA) | placed |
| dist-coordination | 조정 · 합의 | 기존 행 | placed |
| dist-consensus | 합의 (consensus) | study/7 §06 · §21 | placed |
| dist-paxos | Paxos (Basic Paxos) | study/7 §06 · §21 | placed |
| dist-multi-paxos | Multi-Paxos | study/7 §21 2.3 | placed |
| dist-raft | Raft (Raft consensus) | study/7 §06 · §21 | placed |
| dist-raft-log-replication | Raft 로그 복제 (AppendEntries) | study/7 §21 3.5 | placed |
| dist-joint-consensus | 공동 합의 구성 변경 (joint consensus) | study/7 §21 3.7 | placed |
| dist-multi-raft | Multi-Raft | study/7 §21 §5 | placed |
| dist-zab | ZAB (ZooKeeper Atomic Broadcast) | 분야 표준(DDIA) | placed |
| dist-viewstamped-replication | Viewstamped Replication (VR) | study/7 카탈로그 B | placed |
| dist-pbft | PBFT (Practical Byzantine Fault Tolerance) | study/7 카탈로그 A · §21 | placed |
| leader-election | 리더 선출 (leader election) | 기존 행 · study/7 카탈로그 G | placed |
| dist-lease | 리스 (lease) | study/7 카탈로그 G · §13 | placed |
| distributed-lock | 분산락 (distributed lock) | 기존 행 · study/7 §13 | placed |
| dist-fencing-token | 펜싱 토큰 (fencing token) | study/7 §13 §4 | placed |
| dist-redlock | Redlock (RedLock) | study/7 §13 §3 | placed |
| dist-coordination-service | 코디네이션 서비스 (ZooKeeper) | study/7 카탈로그 G · §13 §5 | placed |
| dist-distributed-snapshot | 분산 스냅샷 (Chandy-Lamport) | study/7 카탈로그 §1-A 22 | placed |
| dist-split-brain | 스플릿 브레인 (split brain) | 기존 행 · study/7 §04 7.3 | placed |
| dist-stale-lock-holder | 만료된 락 보유자 쓰기 (zombie lock holder) | study/7 §13 | placed |
| dist-transaction | 분산 트랜잭션 | 기존 행 | placed |
| two-phase-commit | 2PC (two-phase commit) | 기존 행 · study/7 §07 | placed |
| dist-three-phase-commit | 3PC (three-phase commit) | study/7 §07 §5 | placed |
| saga-pattern | 사가 패턴 (saga) | 기존 행 · study/7 §08 · §22 | placed |
| dist-saga-choreography | 코레오그래피 사가 (choreography) | study/7 §08 · §22 §2 | placed |
| dist-saga-orchestration | 오케스트레이션 사가 (orchestration) | study/7 §08 · §22 §2 | placed |
| dist-semantic-lock | 시맨틱 락 (semantic lock) | study/7 §08 §6 · 분야 표준(DDIA) | placed |
| dist-tcc | TCC (Try-Confirm-Cancel) | study/7 §07 §6 · §22 §4 | placed |
| outbox-pattern | 아웃박스 패턴 (transactional outbox) | 기존 행 · study/7 §14 | placed |
| dist-outbox-polling-relay | 폴링 릴레이 (polling publisher) | study/7 §14 2.3 | placed |
| dist-cdc | CDC (Change Data Capture) | study/7 §14 §5 | placed |
| dist-deterministic-transaction | 결정적 트랜잭션 (Calvin) | study/7 카탈로그 B (Calvin) | placed |
| dist-dual-write | 이중 쓰기 불일치 (dual write) | 기존 행 · study/7 §14 §1 | placed |
| dist-coordinator-blocking | 조정자 블로킹 (in-doubt transaction) | study/7 §07 2.1 | placed |
| dist-saga-isolation-anomaly | 사가 격리 이상 (lack of isolation) | study/7 §08 §6 | placed |
| dist-compensation-failure | 보상 실패 (compensation failure) | study/7 §22 §6 | placed |
| dist-messaging | 비동기 메시징 | 기존 행 | placed |
| fan-out | 팬아웃 (fan-out) | 기존 행 · study/8 §04 | placed |
| dist-fanout-on-write | 쓰기 시 팬아웃 (push model) | study/8 §04 · 카탈로그 §4 | placed |
| dist-fanout-on-read | 읽기 시 팬아웃 (pull model) | study/8 §04 · 카탈로그 §4 | placed |
| idempotency | 멱등 처리 (idempotency) | 기존 행 · study/7 §09 | placed |
| dist-idempotency-key | 멱등 키 (Idempotency-Key) | study/7 §09 3.2 · study/8 §16 | placed |
| dist-natural-idempotency | 자연 멱등 (natural idempotency) | study/7 §09 3.1 | placed |
| dist-inbox-pattern | 인박스 패턴 (inbox) | study/7 §14 §4 | placed |
| backpressure | 백프레셔 (backpressure) | 기존 행 · study/7 카탈로그 §1-A 33 | placed |
| dist-dead-letter-queue | DLQ (dead letter queue) | 기존 행 · study/6 §10 | placed |
| dist-stream-processing | 스트림 처리 (stream processing) | 기존 행 | placed |
| dist-duplicate-delivery | 중복 배달 (duplicate delivery) | 기존 행 · study/7 §09 2.1 | placed |
| dist-poison-message | 포이즌 메시지 (poison pill) | 기존 행 | placed |
| dist-consumer-lag-growth | 소비 정체 (consumer stall) | 기존 행 | placed |
| dist-consumer-lag | 컨슈머 랙 (consumer lag) | 기존 행 · study/6 카탈로그 K | placed |
| dist-state-modeling | 상태 모델링 | 기존 행 | placed |
| cqrs | CQRS (Command Query Responsibility Segregation) | 기존 행 · study/7 §15 | placed |
| event-sourcing | 이벤트 소싱 (event sourcing) | 기존 행 · study/7 §15 | placed |
| dist-event-snapshot | 이벤트 스냅샷 (snapshot) | study/7 §15 1.4 | placed |
| dist-event-versioning | 이벤트 버전 관리 (event versioning) | study/7 §15 §5 | placed |
| dist-long-event-replay | 재생 비용 증가 (long replay) | study/7 §15 8.2 | placed |
| dist-fault-isolation | 장애 격리 | 기존 행 | placed |
| dist-timeout | 타임아웃 (timeout) | study/7 카탈로그 F | placed |
| dist-deadline-propagation | 데드라인 전파 (deadline propagation) | 분야 표준(DDIA) | placed |
| circuit-breaker | 서킷 브레이커 (circuit breaker) | 기존 행 · study/7 §11 | placed |
| bulkhead-pattern | 벌크헤드 패턴 (bulkhead) | 기존 행 · study/7 §12 | placed |
| dist-thread-pool-bulkhead | 스레드 풀 격벽 (thread pool bulkhead) | study/7 §12 1.1 | placed |
| dist-semaphore-bulkhead | 세마포어 격벽 (semaphore bulkhead) | study/7 §12 1.1 | placed |
| retry-pattern | 재시도 패턴 (retry) | 기존 행 · study/7 §10 | placed |
| dist-exponential-backoff | 지수 백오프 (exponential backoff) | 기존 행 · study/7 §10 §2 | placed |
| dist-jitter | 지터 (jitter) | study/7 §10 2.3 (기존 행 동의어에서 분리) | placed |
| dist-retry-budget | 재시도 예산 (retry budget) | study/7 §10 §10 | placed |
| dist-hedged-request | 헤지 요청 (hedged request) | study/7 카탈로그 F | placed |
| dist-graceful-degradation | 우아한 기능 저하 (graceful degradation) | study/7 카탈로그 F · §11 §6 | placed |
| dist-load-shedding | 부하 차단 (load shedding) | study/7 §12 §5 (Admission Control) | placed |
| service-mesh | 서비스 메시 (service mesh) | 기존 행 · study/7 카탈로그 H | placed |
| dist-cascading-failure | 연쇄 장애 (cascading failure) | 기존 행 | placed |
| dist-retry-storm | 재시도 폭주 (retry storm) | 기존 행 · study/7 §10 1.2 | placed |
| dist-thundering-herd | 썬더링 허드 (thundering herd) | study/7 §10 1.1 (기존 행 동의어에서 분리) | placed |
| dist-tail-latency-amplification | 꼬리 지연 증폭 (tail latency amplification) | study/7 카탈로그 §3 10 | placed |
| dist-metastable-failure | 준안정 장애 (metastable failure) | 분야 표준(DDIA) | placed |
| dist-failure-rate | 실패율 (failure rate) | 기존 행 | placed |
| resilience4j | Resilience4j | 기존 행 · study/7 §11 | placed |
| dist-verification | 분산 시스템 검증 | study/7 카탈로그 J | placed |
| dist-fault-injection | 장애 주입 (fault injection) | study/7 카탈로그 J (Game Day) | placed |
| dist-chaos-engineering | 카오스 엔지니어링 (chaos engineering) | study/7 카탈로그 J | placed |
| dist-jepsen-testing | Jepsen 방식 검증 (Jepsen) | study/7 카탈로그 J | placed |
| dist-formal-specification | 형식 명세 (TLA+) | study/7 카탈로그 J (TLA+) | placed |
| distributed-glossary | 분산 시스템 용어 사전 (glossary) | 기존 행 | placed |
| dist-glossary-theory | 정리 · 장애 모델 | study/7 §01 · §02 | placed |
| dist-fallacies | 분산 컴퓨팅의 8가지 오류 (fallacies of distributed computing) | study/7 §01 §2 | placed |
| dist-system-model | 시스템 모델 (synchronous model) | study/7 §01 §4 | placed |
| dist-failure-model | 장애 모델 (failure model) | study/7 §01 §5 | placed |
| dist-crash-stop | 크래시 스톱 (crash-stop) | study/7 §01 §5 | placed |
| dist-crash-recovery | 크래시 리커버리 (crash-recovery) | study/7 §01 §5 | placed |
| dist-omission-fault | 누락 장애 (omission failure) | study/7 §01 §5 | placed |
| dist-byzantine-fault | 비잔틴 장애 (Byzantine fault) | study/7 카탈로그 A · study/14 §15 | placed |
| cap-theorem | CAP 정리 (CAP theorem) | 기존 행 · study/7 §02 | placed |
| dist-pacelc | PACELC (PACELC theorem) | study/7 §02 (기존 행 동의어에서 분리) | placed |
| dist-flp-impossibility | FLP 불가능성 (FLP) | study/7 §02 §3 · §21 | placed |
| dist-two-generals | 두 장군 문제 (Two Generals' Problem) | study/7 카탈로그 A | placed |
| base | BASE (Basically Available, Soft state, Eventually consistent) | 기존 행 | placed |
| dist-glossary-consistency | 일관성 모델 (consistency models) | study/7 §03 | placed |
| dist-linearizability | 선형성 (linearizability) | study/7 §03 §2 | placed |
| dist-sequential-consistency | 순차 일관성 (sequential consistency) | study/7 §03 §3 | placed |
| dist-causal-consistency | 인과 일관성 (causal consistency) | study/7 §03 §4 | placed |
| dist-causal-plus-consistency | 인과+ 일관성 (causal+ consistency) | study/7 카탈로그 C · study/14 카탈로그 A | placed |
| dist-session-guarantees | 세션 보장 (session guarantees) | study/7 §03 §5 | placed |
| dist-read-your-writes | 자기 쓰기 읽기 (read-your-writes) | study/7 §03 §5 | placed |
| dist-monotonic-reads | 단조 읽기 (monotonic reads) | study/7 §03 §5 | placed |
| dist-monotonic-writes | 단조 쓰기 (monotonic writes) | study/7 §03 §5 | placed |
| dist-writes-follow-reads | 읽은 뒤 쓰기 (writes-follow-reads) | study/7 §03 §5 | placed |
| dist-consistent-prefix-reads | 일관된 접두사 읽기 (consistent prefix reads) | 분야 표준(DDIA) | placed |
| eventual-consistency | 최종 일관성 (eventual consistency) | 기존 행 · study/7 §03 §6 | placed |
| dist-strong-eventual-consistency | 강한 최종 일관성 (SEC) | study/14 §02 | placed |
| dist-glossary-time | 시간 · 순서 용어 | study/7 §05 | placed |
| dist-happens-before | 선후 관계 (happens-before) | study/7 §05 §2 | placed |
| dist-epoch | 에포크 · 임기 (epoch) | study/7 §06 3.5 · §21 3.3 | placed |
| dist-glossary-crdt | CRDT 용어 | study/14 | placed |
| dist-semilattice | 조인 반격자 (join-semilattice) | study/14 §02 | placed |
| dist-convergence-laws | 수렴 조건 (교환 · 결합 · 멱등) (ACI) | study/14 §02 · 카탈로그 A | placed |
| dist-add-wins-remove-wins | 추가 우선 · 삭제 우선 (add-wins) | study/14 §05 | placed |
| dist-dot-context | dot · 인과 문맥 (dot) | study/14 §10 | placed |
| dist-causal-stability | 인과적 안정 (causal stability) | study/14 §10 · §12 | placed |
| dist-local-first | 로컬 우선 소프트웨어 (local-first) | study/14 §09 · 카탈로그 §1-A 13 | placed |
| dist-glossary-transaction | 분산 트랜잭션 용어 | study/7 §22 | placed |
| dist-compensating-transaction | 보상 트랜잭션 (compensating transaction) | 기존 행 · study/7 §08 §5 | placed |
| dist-pivot-transaction | 피벗 트랜잭션 (pivot transaction) | study/7 §22 3.3 | placed |
| dist-retriable-transaction | 재시도 가능 단계 (retriable transaction) | study/7 §22 3.5 | placed |
| dist-quorum | 쿼럼 (quorum) | 기존 행 · study/7 §04 §3 | placed |
| dist-delivery-semantics | 전달 보장 수준 (delivery semantics) | 기존 행 · study/6 §09 §1 | placed |

## 제외 · 다른 도메인 소유

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| kafka | Kafka | study/6 · 기존 행 | excluded — owned by messaging (이번에 messaging.yaml 로 옮겼다) |
| kafka-streams | Kafka Streams | 기존 행 | excluded — owned by messaging (이번에 messaging.yaml 로 옮겼다) |
| msg-event-notification | Event Notification | study/7 카탈로그 I | excluded — owned by messaging |
| msg-event-carried-state-transfer | Event-Carried State Transfer | study/7 카탈로그 I | excluded — owned by messaging |
| msg-lambda-architecture | Lambda architecture | study/7 카탈로그 I | excluded — owned by messaging |
| msg-kappa-architecture | Kappa architecture | study/7 카탈로그 I | excluded — owned by messaging |
| msg-windowing | Windowing (tumbling/sliding/session) | study/7 카탈로그 I | excluded — owned by messaging |
| msg-late-event-handling | Watermark / late-arriving data | study/7 카탈로그 I | excluded — owned by messaging |
| msg-exactly-once-semantics | Kafka EOS | study/7 §15 §6 | excluded — owned by messaging |
| service-discovery | Service Discovery | study/7 카탈로그 G | excluded — owned by infrastructure (dist-request-routing 이 USES 로 잇는다) |
| api-gateway | API Gateway 패턴 | study/7 카탈로그 H | excluded — owned by infrastructure |
| health-check | Health check (liveness/readiness) | study/7 카탈로그 F | excluded — owned by infrastructure |
| backends-for-frontends | BFF | study/7 카탈로그 H | excluded — owned by architecture |
| strangler-fig | Strangler Fig | study/7 카탈로그 H | excluded — owned by architecture |
| anti-corruption-layer | Anti-corruption layer | study/7 카탈로그 H | excluded — owned by architecture |
| database-per-service | Database per Service / Shared DB 안티패턴 | study/7 카탈로그 H | excluded — owned by architecture |
| multi-tenancy | Multi-tenancy 패턴 | study/7 카탈로그 §1-A 37 | excluded — owned by architecture |
| distributed-tracing | Distributed Tracing | study/7 카탈로그 §1-A 21 | excluded — owned by observability |
| rate-limiting | Rate Limiting (token/leaky bucket · fixed/sliding window) | study/7 §12 · study/8 §06 | excluded — owned by security (dist-load-shedding 이 ALTERNATIVE_TO 로 잇는다) |
| distributed-rate-limiter | Distributed Rate Limiter (Redis + Lua) | study/7 카탈로그 F | excluded — owned by security |
| multi-region-active-active | Multi-region active-active vs active-passive | study/8 카탈로그 §4 | excluded — owned by cloud |
| caching | 캐시 무효화 전략 (write-through/back/around) | study/8 카탈로그 §4 | excluded — owned by data |
| hyperloglog | HyperLogLog | study/8 §15 | excluded — owned by cs-fundamentals |
| geo-index | GeoIndex (geohash/S2/H3/quadtree) | study/8 카탈로그 §4 | excluded — owned by search |
| polling-webhook-websocket | Polling vs Webhook vs WebSocket | study/8 카탈로그 §4 | excluded — owned by network |
| reconciliation | Reconciliation (대사) | study/7 §17 §9 · study/8 §05 | excluded — owned by commerce-order |
| auto-increment-id | auto-increment ID | study/8 카탈로그 §4 | excluded — owned by data (DB 시퀀스는 dist-segment-allocation 이 대신 구간 할당으로 다룬다) |
| gdpr-erasure | GDPR 삭제와 최종 일관성 충돌 | study/7 카탈로그 §1-A 38 | excluded — owned by security (개인정보 삭제 의무) |
| crdt-e2ee | Encryption (E2EE) + CRDT | study/14 카탈로그 H | excluded — owned by security |
| replication-topology | Replication topology (star/mesh/ring) | study/7 카탈로그 D | excluded — 다중 리더 복제의 배치 형태라 dist-multi-leader-replication 설명 범위다 |
| pure-op-based-crdt | Pure op-based CRDT | study/14 카탈로그 B | excluded — dist-op-based-crdt 의 학술 변형이라 개념 노드를 따로 두지 않는다 |
| bloom-clock | Bloom clocks (vector clock 압축) | study/14 카탈로그 I | excluded — 연구 단계 기법, 압축은 dist-dot-context 로 대표한다 |
| block-wise-crdt | Block-wise CRDT | study/14 카탈로그 E | excluded — YATA 의 블록 인코딩 최적화라 개념이 아니다 |
| bft-crdt | BFT-CRDT | study/14 §15 | excluded — 비잔틴 가정(dist-byzantine-fault)의 CRDT 적용 사례라 개념 노드를 따로 두지 않는다 |
| awareness-protocol | Awareness protocol (Yjs) | study/14 카탈로그 H | excluded — Yjs 한정 기능이다 |
| yjs | Yjs / Y-CRDT | study/14 카탈로그 F | excluded — 레포에 없는 제품이다 |
| automerge | Automerge | study/14 카탈로그 F | excluded — 레포에 없는 제품이다(개념은 dist-json-crdt) |
| loro | Loro | study/14 카탈로그 F | excluded — 레포에 없는 제품이다 |
| riak | Riak DT / AntidoteDB / Redis CRDB / Electric SQL / Roshi | study/14 카탈로그 F · §16 | excluded — 레포에 없는 제품이다 |
| zookeeper | ZooKeeper / etcd / Consul | study/7 카탈로그 G | excluded — 레포에 없는 제품이다(개념은 dist-coordination-service) |
