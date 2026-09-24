# 메시징 · 스트리밍 — 커버리지 체크리스트

원천:
- `study/docs/6-kafka-internals/` — 99-concept-catalog.md 전 행 + 본문 01~17 (study/6)
- `docs/architecture/kafka-convention.md` — 토픽 명명 · DLQ · AckMode
- `docs/conventions/idempotent-consumer.md` — 헬퍼 · 자연 멱등 · eventId 봉투
- `study/docs/7-distributed-systems/` 카탈로그 I (스트림 · 분석 패턴)
- 레포 Kafka 코드 — `*KafkaConfig.kt` · `common/messaging/outbox` · `analytics/.../streaming` · `k8s/infra/local/kafka` · `k8s/infra/prod/strimzi`
- 분야 표준 — Apache Kafka 공식 문서(Design · Implementation · Operations · Streams), 「Kafka: The Definitive Guide」, Hohpe 「Enterprise Integration Patterns」 메시징 채널 장

표는 온톨로지 파일의 개념 순서(루트 → 단계 → 장치 → 문제·지표 → 용어)를 따른다. 「기존 행」은 이번 라운드 전부터 파일에 있던 개념이다.

## 배치

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| messaging-streaming | 메시징 · 스트리밍 (messaging) | study/6 | placed |
| msg-messaging-model | 메시징 모델 선택 | 분야 표준(EIP · DDIA) | placed |
| msg-point-to-point-queue | 점대점 큐 (point-to-point) | 분야 표준(EIP) | placed |
| msg-publish-subscribe | 발행 · 구독 (pub/sub) | 분야 표준(EIP) | placed |
| msg-log-based-broker | 로그 기반 브로커 (log-based message broker) | study/6 §01 · 분야 표준(DDIA) | placed |
| msg-competing-consumers | 경쟁 소비자 (competing consumers) | study/6 §07 §11 · 분야 표준(EIP) | placed |
| msg-request-reply | 요청 · 응답 메시징 (request-reply) | 분야 표준(EIP) · 레포 사가 명령 토픽 | placed |
| msg-event-notification | 이벤트 알림 (event notification) | study/7 카탈로그 I | placed |
| msg-event-carried-state-transfer | 상태 전달 이벤트 (event-carried state transfer) | study/7 카탈로그 I | placed |
| msg-topic-naming-convention | 토픽 명명 규약 (topic naming) | docs/architecture/kafka-convention.md | placed |
| msg-log-storage | 로그 저장 구조 | study/6 §05 | placed |
| msg-topic-partition | 토픽 파티션 (partition) | study/6 §01 | placed |
| msg-log-segment | 로그 세그먼트 (log segment) | study/6 §05 §2 | placed |
| msg-offset-index | 오프셋 · 시간 인덱스 (.index) | study/6 §05 §3 | placed |
| msg-sequential-append | 순차 추가 쓰기 · 페이지 캐시 (append-only) | study/6 §05 §4 · §5 | placed |
| msg-zero-copy | 제로 카피 전송 (zero-copy) | study/6 §05 §6 | placed |
| msg-retention-policy | 보관 기간 삭제 (retention) | study/6 §02 §4 · 카탈로그 E | placed |
| msg-log-compaction | 로그 압축 (log compaction) | study/6 §16 · 카탈로그 E | placed |
| msg-tiered-storage | 계층형 저장 (tiered storage) | study/6 §14 §5 | placed |
| msg-disk-exhaustion | 브로커 디스크 고갈 (disk full) | 분야 표준(Kafka 공식 문서) | placed |
| msg-cluster-replication | 클러스터 · 복제 | study/6 §06 | placed |
| msg-partition-replication | 파티션 복제 (replication factor) | study/6 §06 | placed |
| msg-isr-management | ISR 관리 (ISR shrink/expand) | study/6 §06 §4 | placed |
| msg-partition-leader-election | 파티션 리더 선출 (clean leader election) | study/6 §06 §5 | placed |
| msg-unclean-leader-election | 비정상 리더 선출 (unclean.leader.election.enable) | study/6 §06 §5 · 카탈로그 A | placed |
| msg-rack-awareness | 랙 인식 배치 (rack awareness) | study/6 §06 §8 | placed |
| msg-kraft | KRaft | study/6 §03 · §14 | placed |
| msg-zookeeper-coordination | ZooKeeper 모드 (ZooKeeper mode) | study/6 §03 §2 | placed |
| msg-partition-reassignment | 파티션 재배치 (partition reassignment) | study/6 카탈로그 A (Cruise Control) | placed |
| msg-cross-cluster-mirroring | 클러스터 간 미러링 (MirrorMaker 2) | study/6 카탈로그 I (MirrorMaker 2) | placed |
| msg-isr-shrink | ISR 축소 (ISR shrink) | study/6 §10 §7 | placed |
| msg-unclean-data-loss | 비정상 선출 유실 (committed data loss) | study/6 §06 §5 | placed |
| msg-under-replicated-partitions | 복제 부족 파티션 수 (URP) | study/6 §10 §7 · 카탈로그 K | placed |
| msg-producing | 생산(프로듀서) | study/6 §04 | placed |
| msg-partitioner | 파티셔너 (partitioner) | study/6 §01 §4 · 카탈로그 B | placed |
| msg-key-hash-partitioning | 키 해시 파티셔닝 (key-based partitioning) | study/6 §01 §4 | placed |
| msg-sticky-partitioner | 스티키 파티셔너 (sticky partitioner) | study/6 카탈로그 B | placed |
| msg-acks | acks (acks=0) | study/6 §04 §2 | placed |
| msg-min-isr-durability | min.insync.replicas | study/6 §06 §6 | placed |
| msg-idempotent-producer | 멱등 프로듀서 (enable.idempotence) | study/6 §04 §3 · §09 | placed |
| msg-batching-linger | 배치 · linger (batch.size) | study/6 §04 §5 | placed |
| msg-producer-compression | 프로듀서 압축 (compression.type) | study/6 §04 §6 | placed |
| msg-in-flight-ordering | 동시 전송 요청과 순서 (max.in.flight.requests.per.connection) | study/6 카탈로그 B · §04 사고 2 | placed |
| msg-delivery-timeout | 전송 기한 (delivery.timeout.ms) | study/6 §04 §4 | placed |
| msg-message-loss | 메시지 유실 (message loss) | 분야 표준(Kafka 공식 문서) | placed |
| msg-reordering-on-retry | 재시도 역순 (out-of-order delivery) | study/6 §04 사고 2 | placed |
| msg-producer-buffer-exhaustion | 프로듀서 버퍼 고갈 (buffer.memory) | study/6 §04 사고 1 | placed |
| msg-throughput | 메시지 처리량 (throughput) | study/6 카탈로그 K | placed |
| msg-end-to-end-latency | 종단 지연 (end-to-end latency) | 분야 표준(Kafka 공식 문서) | placed |
| msg-consuming | 소비(컨슈머) | study/6 §07 · §08 | placed |
| msg-group-coordination | 그룹 멤버십 관리 (session.timeout.ms) | study/6 §07 §2 · §9 | placed |
| msg-rebalance | 리밸런스 (consumer rebalance) | study/6 §07 · §15 | placed |
| msg-eager-rebalance | eager 리밸런스 (eager rebalance) | study/6 §15 3-1 | placed |
| msg-cooperative-rebalance | cooperative 리밸런스 (incremental cooperative rebalance) | study/6 §15 3-2 (KIP-429) | placed |
| msg-static-membership | 정적 멤버십 (group.instance.id) | study/6 §15 3-3 (KIP-345) | placed |
| msg-server-side-rebalance | 차세대 그룹 프로토콜 (KIP-848) | study/6 §15 3-4 (KIP-848) | placed |
| msg-assignment-strategy | 파티션 할당 전략 (RangeAssignor) | study/6 §07 §7 | placed |
| msg-poll-loop | 폴링 루프 (poll loop) | study/6 §08 §5 | placed |
| msg-offset-commit | 오프셋 커밋 (offset commit) | study/6 §08 §1 | placed |
| msg-auto-commit | 자동 커밋 (enable.auto.commit=true) | study/6 §08 §2 | placed |
| msg-manual-commit | 수동 커밋 (enable.auto.commit=false) | study/6 §08 §3 · docs/architecture/kafka-convention.md (AckMode) | placed |
| msg-offset-reset-policy | 오프셋 초기화 정책 (auto.offset.reset) | study/6 §02 §7 | placed |
| msg-offset-replay | 오프셋 되감기 재처리 (seek) | study/6 §02 §8 | placed |
| msg-consumer-concurrency | 소비 병렬도 (listener concurrency) | study/6 §07 §11 | placed |
| msg-rebalance-storm | 리밸런스 폭주 (rebalance storm) | study/6 §15 5-5 | placed |
| msg-poll-interval-eviction | poll 간격 초과 퇴출 (CommitFailedException) | study/6 §08 §5 · §15 5-1 | placed |
| msg-delivery-guarantee | 전달 보장 | study/6 §09 §1 | placed |
| msg-at-most-once | 최대 한 번 전달 (at-most-once) | study/6 §09 §1 | placed |
| msg-at-least-once | 최소 한 번 전달 (at-least-once) | study/6 §09 §1 | placed |
| msg-exactly-once-semantics | Exactly-once (EOS) (EOS) | study/6 §09 | placed |
| msg-kafka-transactions | Kafka 트랜잭션 (transactional producer) | study/6 §04 §7 · §09 §4 | placed |
| msg-read-committed | read_committed 격리 (isolation.level=read_committed) | study/6 §09 §3 · 카탈로그 C | placed |
| msg-transactional-offset-commit | 트랜잭션 안 오프셋 커밋 (sendOffsetsToTransaction) | study/6 §09 §2 (B) | placed |
| msg-effectively-once | 사실상 한 번 처리 (effectively-once) | study/7 §15 6.2 · docs/conventions/idempotent-consumer.md | placed |
| msg-zombie-producer | 좀비 프로듀서 (zombie instance) | study/6 §09 §4 | placed |
| msg-hanging-transaction | 끝나지 않은 트랜잭션 (hanging transaction) | study/6 §04 사고 3 | placed |
| msg-failure-handling | 소비 실패 처리 | study/6 §10 | placed |
| msg-blocking-retry | 블로킹 재시도 (DefaultErrorHandler) | docs/architecture/kafka-convention.md (DLQ) · study/6 §10 §3 | placed |
| msg-retry-topic | 재시도 토픽 (non-blocking retry) | study/6 §10 §5 | placed |
| msg-error-classification | 재시도 대상 분류 (not retryable exceptions) | study/7 §10 §4 · study/6 §11 §4 | placed |
| msg-deserialization-error-handling | 역직렬화 오류 처리 (ErrorHandlingDeserializer) | 분야 표준(Kafka 공식 문서) | placed |
| msg-dlq-reprocessing | DLQ 재처리 (DLQ replay) | study/6 §10 §4 · §6 (Parking Topic) | placed |
| msg-head-of-line-blocking | 파티션 선두 정체 (head-of-line blocking) | 분야 표준(Kafka 공식 문서) | placed |
| msg-schema-management | 스키마 · 직렬화 | study/6 카탈로그 H | placed |
| msg-serialization-format | 직렬화 형식 (serde) | study/6 카탈로그 H | placed |
| msg-json-serde | JSON 직렬화 (JsonSerializer) | 레포 Kafka 설정 | placed |
| msg-avro-serde | Avro 직렬화 (Avro) | study/6 카탈로그 H | placed |
| msg-schema-registry | 스키마 레지스트리 (Schema Registry) | study/6 카탈로그 H | placed |
| msg-compatibility-mode | 호환성 모드 (BACKWARD) | study/6 카탈로그 H | placed |
| msg-schema-evolution | 스키마 진화 (schema evolution) | study/6 카탈로그 H | placed |
| msg-type-mapping | 타입 헤더 매핑 (__TypeId__) | 레포 Kafka 설정(search consumer) | placed |
| msg-breaking-schema-change | 호환 깨는 스키마 변경 (breaking change) | study/6 카탈로그 H | placed |
| msg-stream-processing | 스트림 처리 | study/6 §17 | placed |
| msg-stateless-transform | 무상태 변환 (map) | study/6 §17 4-1 | placed |
| msg-stateful-aggregation | 상태 집계 (groupByKey) | study/6 §17 4-2 | placed |
| msg-windowing | 윈도잉 (windowing) | study/6 §17 4-3 · study/7 카탈로그 I | placed |
| msg-tumbling-window | 텀블링 윈도 (tumbling window) | study/6 §17 4-3 | placed |
| msg-hopping-window | 호핑 윈도 (hopping window) | study/6 §17 4-3 | placed |
| msg-sliding-window | 슬라이딩 윈도 (sliding window) | study/6 §17 4-3 | placed |
| msg-session-window | 세션 윈도 (session window) | study/6 §17 4-3 | placed |
| msg-late-event-handling | 늦은 이벤트 처리 (watermark) | study/7 카탈로그 I (Watermark) | placed |
| msg-suppress-emit | 결과 방출 억제 (suppress) | study/6 §17 4-6 | placed |
| msg-state-store | 상태 저장소 (state store) | study/6 §17 3-7 · §6 | placed |
| msg-changelog-topic | 체인지로그 토픽 (changelog topic) | study/6 §17 3-7 | placed |
| msg-standby-replica | 스탠바이 복제본 (standby replica) | 분야 표준(Kafka 공식 문서) | placed |
| msg-stream-join | 스트림 조인 (join) | study/6 §17 4-4 | placed |
| msg-stream-stream-join | 스트림-스트림 조인 (KStream-KStream join) | study/6 §17 4-4 | placed |
| msg-stream-table-join | 스트림-테이블 조인 (KStream-KTable join) | study/6 §17 4-4 | placed |
| msg-table-table-join | 테이블-테이블 조인 (KTable-KTable join) | study/6 §17 4-4 | placed |
| msg-global-table-join | 글로벌 테이블 조인 (GlobalKTable join) | study/6 §17 4-4 | placed |
| msg-repartition | 재파티션 (repartition topic) | 분야 표준(Kafka 공식 문서) | placed |
| msg-interactive-queries | 인터랙티브 쿼리 (interactive queries) | study/6 카탈로그 F | placed |
| msg-streams-eos | 스트림 EOS (exactly_once_v2) | study/6 §17 §5 | placed |
| msg-processor-api | Processor API | study/6 카탈로그 F | placed |
| msg-connector-integration | 커넥터 통합 (Kafka Connect) | study/6 카탈로그 G | placed |
| msg-lambda-architecture | 람다 아키텍처 (Lambda architecture) | study/7 카탈로그 I | placed |
| msg-kappa-architecture | 카파 아키텍처 (Kappa architecture) | study/7 카탈로그 I | placed |
| msg-late-event-drop | 늦은 이벤트 누락 (late arrival) | study/7 카탈로그 §1-A 32 | placed |
| msg-state-restore-delay | 상태 복원 지연 (state restoration) | study/6 §15 6-3 · 분야 표준(Kafka 공식 문서) | placed |
| msg-operations | 운영 · 관측 | study/6 카탈로그 K | placed |
| msg-topic-provisioning | 선언적 토픽 관리 (KafkaTopic) | study/6 §01 §3 (Strimzi) | placed |
| msg-topic-auto-creation | 토픽 자동 생성 (auto.create.topics.enable) | 레포 k8s 로컬 브로커 | placed |
| msg-partition-count-sizing | 파티션 수 결정 (partition count) | study/6 §01 §5 | placed |
| msg-client-quota | 클라이언트 쿼터 (quota) | study/6 카탈로그 J | placed |
| msg-access-control | 브로커 인증 · 인가 (SASL) | study/6 카탈로그 J | placed |
| msg-lag-monitoring | 랙 모니터링 (lag exporter) | study/6 §10 §7 · 카탈로그 K | placed |
| kafka | Kafka (Apache Kafka) | 기존 행(distributed 에서 이동) | placed |
| kafka-streams | Kafka Streams | 기존 행(distributed 에서 이동) | placed |
| spring-kafka | Spring for Apache Kafka (spring-kafka) | 레포 build.gradle.kts · docs/architecture/kafka-convention.md | placed |
| msg-glossary | 메시징 · 스트리밍 용어 사전 (glossary) | 구조 노드 | placed |
| msg-glossary-log | 로그 · 복제 용어 | 구조 노드 | placed |
| msg-record | 레코드 (record) | study/6 카탈로그 §1-A 34 | placed |
| msg-message-key | 메시지 키 (message key) | study/6 §01 §4 | placed |
| msg-offset | 오프셋 (offset) | study/6 §02 §1 | placed |
| msg-log-end-offset | LEO (Log End Offset) | study/6 §06 §2 | placed |
| msg-high-watermark | 하이 워터마크 (HW) | study/6 §06 §2 | placed |
| msg-last-stable-offset | LSO (Last Stable Offset) | study/6 §09 §3 | placed |
| msg-isr | ISR (In-Sync Replicas) | study/6 §06 §4 | placed |
| msg-leader-epoch | 리더 에포크 (leader epoch) | study/6 §06 §10 | placed |
| msg-tombstone | 툼스톤 (tombstone) | study/6 §16 3-4 | placed |
| msg-consumer-offsets-topic | __consumer_offsets | study/6 §02 §3 | placed |
| msg-glossary-client | 클라이언트 · 메시지 용어 | 구조 노드 | placed |
| msg-consumer-group | 컨슈머 그룹 (consumer group) | study/6 §07 §1 | placed |
| msg-group-coordinator | 그룹 코디네이터 (group coordinator) | study/6 §07 §2 | placed |
| msg-producer-id | 프로듀서 ID · 순번 (PID) | study/6 카탈로그 D | placed |
| msg-transactional-id | 트랜잭션 ID (transactional.id) | study/6 §09 §4 | placed |
| msg-event-envelope | 이벤트 봉투 (envelope) | docs/conventions/idempotent-consumer.md §3 | placed |
| msg-event-message | 이벤트 메시지 (event) | 분야 표준(EIP) | placed |
| msg-command-message | 명령 메시지 (command) | 분야 표준(EIP) | placed |
| msg-glossary-stream | 스트림 처리 용어 | 구조 노드 | placed |
| msg-kstream | KStream (event stream) | study/6 §17 3-2 | placed |
| msg-ktable | KTable (changelog stream) | study/6 §17 3-3 | placed |
| msg-global-ktable | GlobalKTable (global table) | study/6 §17 3-4 | placed |
| msg-stream-table-duality | 스트림-테이블 이중성 (stream-table duality) | study/6 §17 4-5 | placed |
| msg-topology | 토폴로지 (topology) | study/6 §17 3-6 | placed |
| msg-time-semantics | 시간 의미론 (time semantics) | 분야 표준(Kafka 공식 문서) | placed |
| msg-event-time | 이벤트 시간 (event time) | 분야 표준(Kafka 공식 문서) | placed |
| msg-processing-time | 처리 시간 (processing time) | 분야 표준(Kafka 공식 문서) | placed |

## 제외 · 다른 도메인 소유

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| fan-out | 팬아웃 | study/6 §01 | excluded — owned by distributed (msg-publish-subscribe 가 USES 로 잇는다) |
| idempotency | 멱등 처리 (consumer 멱등) | study/6 §10 §1 · docs/conventions/idempotent-consumer.md | excluded — owned by distributed (msg-effectively-once 가 USES 로 잇는다) |
| dist-inbox-pattern | Inbox / processed_event | study/6 §10 패턴 C·D | excluded — owned by distributed |
| dist-dead-letter-queue | DLQ | study/6 §10 §3 · docs/architecture/kafka-convention.md | excluded — owned by distributed (msg-failure-handling 이 USES 로 잇는다) |
| dist-delivery-semantics | 전달 보장 3종 (용어) | study/6 §09 §1 | excluded — owned by distributed (msg-delivery-guarantee 가 USES 로 잇는다) |
| dist-duplicate-delivery | 중복 배달 | study/6 §08 §9 | excluded — owned by distributed (CAUSES · MITIGATES 로 잇는다) |
| dist-poison-message | 포이즌 메시지 | study/6 §10 §8 | excluded — owned by distributed |
| dist-consumer-lag | Consumer lag | study/6 카탈로그 K | excluded — owned by distributed (MEASURED_BY 로 잇는다) |
| dist-stream-processing | 스트림 처리(일반) | study/6 §17 | excluded — owned by distributed (msg-stream-processing 이 USES 로 잇는다) |
| dist-cdc | CDC / Debezium | study/6 카탈로그 G · §16 4-5 | excluded — owned by distributed (msg-connector-integration 이 USES 로 잇는다) |
| outbox-pattern | Outbox 패턴 | study/6 §09 §6 | excluded — owned by distributed |
| backpressure | 백프레셔 | study/6 §08 §5 | excluded — owned by distributed (msg-poll-loop 이 USES 로 잇는다) |
| dist-raft | Raft (KRaft 의 합의) | study/6 §14 3-2 | excluded — owned by distributed (msg-kraft 가 USES 로 잇는다) |
| protobuf | Protobuf 직렬화 | study/6 카탈로그 H | excluded — owned by network (Avro 와 같은 스키마 기반 이진 형식은 msg-avro-serde 동의어로 둔다) |
| kafka-jmx-metrics | JMX metrics + kafka_exporter | study/6 카탈로그 K | excluded — owned by observability |
| kafka-oauth | OAuth (KIP-768) | study/6 카탈로그 J | excluded — owned by security |
| kafka-encryption-at-rest | Encryption at rest | study/6 카탈로그 §1-A 14 | excluded — owned by security |
| strimzi | Strimzi Operator | study/6 §14 · 카탈로그 K | excluded — owned by infrastructure (오퍼레이터; 토픽 선언은 msg-topic-provisioning) |
| ksqldb | ksqlDB | study/6 카탈로그 §1-A 4 | excluded — 레포에 없는 벤더 제품이다 |
| confluent-vs-msk | Confluent Cloud / MSK 차이 | study/6 카탈로그 §1-A 36 | excluded — 벤더 한정 비교라 개념이 아니다 |
| cluster-linking | Cluster Linking (Confluent) | study/6 카탈로그 I | excluded — 벤더 한정 기능이다(개념은 msg-cross-cluster-mirroring) |
| kafka-lag-tools | Burrow / CMAK / AKHQ | study/6 카탈로그 K | excluded — 벤더 도구 이름이다(개념은 msg-lag-monitoring) |
| connect-worker-modes | Connect standalone vs distributed mode · worker rebalance · Connect DLQ 설정 | study/6 카탈로그 G | excluded — 벤더 한정 설정값이다 |
| max-partition-fetch-bytes | Consumer fetcher (max.partition.fetch.bytes) | study/6 카탈로그 C | excluded — 벤더 한정 설정값이다 |
| dist-epoch | Group generation | study/6 카탈로그 C | excluded — owned by distributed (세대 번호 일반 개념) |
