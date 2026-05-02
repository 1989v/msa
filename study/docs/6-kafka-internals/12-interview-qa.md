---
parent: 6-kafka-internals
seq: 12
title: 면접 Q&A 카드 (40문항)
type: deep
created: 2026-05-01
---

# 12. 면접 Q&A 카드 (40문항)

> 회독용. 학습 종료 후 1주일 간격으로 2-3회 회독 권장. 답변은 30초~1분 분량으로 정리.

---

## Phase 1: 아키텍처 기본 (8개)

**Q1.1** Kafka 의 토픽과 파티션의 관계?
> 토픽은 논리적 카테고리, 파티션은 물리적 로그 파일. 토픽이 N 개 파티션으로 쪼개지고 broker 들에 분산 배치된다. **파티션은 병렬화 단위 + 순서 보장 단위 + 장애 복구 단위**의 세 역할을 동시에 한다. 한 파티션 내부에서만 순서 보장된다.

**Q1.2** 파티션 수를 사후에 늘리면 어떤 문제?
> Producer 의 partitioner 가 `hash(key) % partitions` 식이라, partitions 가 6→12 로 바뀌면 같은 key 가 다른 파티션으로 간다. 즉 같은 aggregate 의 메시지 순서가 깨진다. 보통 토픽을 새로 만들고 마이그레이션하거나, 처음부터 여유 있게 잡는다.

**Q1.3** Replication Factor 와 min.insync.replicas 의 관계?
> RF 는 복제본 총 개수, min.ISR 은 acks=all write 가 성공하려면 동기화 상태여야 하는 최소 replica 수. RF=3 + min.ISR=2 → 1대 장애까지 안전하게 쓰기 가능. RF=3 + min.ISR=1 이면 acks=all 의 의미가 사실상 acks=1 로 격하된다.

**Q1.4** Consumer 가 offset 을 어떻게 관리하나?
> __consumer_offsets 라는 내부 토픽 (compact 정책) 에 (group.id, topic, partition) → (offset, metadata) 를 commit 한다. group coordinator 가 그 그룹의 commit 을 받아 토픽에 기록한다. 컨슈머 재시작/리밸런스 시 마지막 commit offset 부터 이어서 처리.

**Q1.5** Log Compaction 과 Time-based Retention 의 차이?
> retention.ms 는 시간 기반 — 오래된 segment 통째 삭제. compaction 은 key 기반 — 같은 key 의 최신값만 유지하고 나머지는 정리. 둘 섞을 수 있다 (`compact,delete`). compaction 토픽은 changelog 나 최신 상태 유지가 목적 (예: __consumer_offsets, Streams state store).

**Q1.6** KRaft 가 ZooKeeper 보다 좋은 이유?
> 1) 외부 시스템 의존 제거, 2) 메타데이터를 토픽으로 관리해 broker 합류 catch-up 빠름 (수만 파티션에서 controller failover 가 분 → 초), 3) 합의 시스템 통일 (Raft 하나만 운영). Kafka 4.0 부터 ZK 모드 완전 제거.

**Q1.7** auto.offset.reset 의 값과 의미?
> `earliest` — 신규 그룹이 토픽 처음부터 읽음. `latest` — 새로 들어오는 것만. `none` — 옛 offset 없으면 예외. msa 는 모두 earliest — retention 기간 안의 모든 메시지를 재처리할 수 있어야 안전.

**Q1.8** Under-Replicated Partition (URP) 가 위험한 이유?
> ISR 이 줄면 가용한 replica 수 감소 → leader 장애 시 데이터 손실 위험 ↑. RF=3 인데 ISR=1 까지 떨어지면, unclean.leader.election=false 시 가용성도 잃는다. 운영 알람 임계는 보통 URP > 0 즉시 조사.

---

## Phase 2: Producer / Broker 내부 (8개)

**Q2.1** acks=0/1/all 의 차이?
> 0: leader 응답 안 기다림 (분실 가능). 1: leader 가 자기 디스크에 쓴 후 ack (replication 전 leader 죽으면 분실). all: ISR 전체에 복제된 후 ack (min.ISR 까지 안전). msa 는 all + min.ISR=2 강제.

**Q2.2** enable.idempotence 가 정확히 뭘 막아주나?
> 단일 producer 인스턴스 + 단일 세션 안에서, 네트워크 재시도로 인한 중복 발행을 막는다. (PID, sequence) 로 broker 가 dedup. 컨슈머 측 중복 처리는 별개 — 그건 컨슈머가 막아야 한다.

**Q2.3** max.in.flight.requests.per.connection 이 5 까지 안전한 이유?
> KIP-679 (Kafka 2.5+) 부터 idempotent producer 는 broker 가 sequence 검증으로 out-of-order batch 를 reject 하고 재정렬한다. 그 이전엔 max.in.flight=1 만 안전했음. 신규 시스템에서 5 가 권장값.

**Q2.4** Kafka 가 빠른 이유 3가지?
> 1) **Sequential I/O** — append-only 로그라 random write 없음 (HDD 도 100MB/s). 2) **OS Page Cache** — fsync 강제 안 하고 page cache 에 의존, replication 으로 손실 방지. 3) **Zero-copy (sendfile)** — file → socket 직접 전송, user/kernel context switch 최소.

**Q2.5** Kafka broker 의 JVM heap 을 작게 잡는 이유?
> Kafka 는 Java 객체 캐싱을 거의 안 한다. heap 크면 GC pause ↑. 메모리 64GB 라면 heap 4-6GB + 나머지 OS page cache → 최근 데이터가 in-memory 효과. heap 큰 게 오히려 throughput 떨어진다.

**Q2.6** ISR 과 HW (High Watermark) 의 관계?
> HW = ISR 모두에 복제된 마지막 offset = ISR LEO 들의 최솟값. 컨슈머는 HW 까지만 읽을 수 있다 (그 위는 invisible). 그래서 한번 컨슈머에 보였던 메시지는 절대 사라지지 않는다 — leader 죽어도 ISR 안의 다른 replica 가 같은 데이터 보유.

**Q2.7** unclean.leader.election.enable=true 의 의미?
> ISR 이 모두 죽었을 때, ISR 외 replica (out-of-sync) 를 leader 로 선출해 가용성 확보. 단 그 replica 의 LEO 가 HW 보다 작으면 그 차이만큼 데이터 손실. 도메인 이벤트는 false (안전성 우선), 메트릭/로그는 true (가용성 우선) 가 흔한 선택.

**Q2.8** TLS 활성화 시 throughput 떨어지는 이유?
> zero-copy (sendfile) 가 깨진다. 평문 file → 암호화는 user 공간에서 해야 하므로 sendfile 사용 불가. CPU 부하도 ↑. AES-NI 같은 hw 가속 + 충분한 코어 필요. 보통 throughput 30-50% 감소.

---

## Phase 3: Consumer / Rebalance / EOS (8개)

**Q3.1** Consumer Group Rebalance 의 주요 트리거 5가지?
> 1) 멤버 추가, 2) 멤버 graceful shutdown, 3) heartbeat 누락 (session.timeout.ms), 4) poll 누락 (max.poll.interval.ms), 5) 토픽 partition 수 증가. 추가로 regex 구독 시 새 토픽 매칭도 트리거.

**Q3.2** Eager Rebalance 와 Cooperative-Sticky 의 차이?
> Eager: 모든 멤버가 partition revoke → STW → 재할당. 큰 그룹에서 수십 초 정지. Cooperative-Sticky: 변경 없는 partition 은 그대로 유지, 이동할 partition 만 2-round 로 재할당. STW 최소화. 신규 시스템 권장.

**Q3.3** max.poll.interval.ms 타임아웃 되면?
> Coordinator 가 그 컨슈머를 그룹에서 제거 → rebalance. 처리 중 메시지의 offset 은 commit 못 됨 → 새 owner 가 이전 위치부터 재처리 → 재처리 시간이 또 길면 무한 루프. 처리 시간 길면 비동기 worker dispatch 패턴.

**Q3.4** at-least-once + 멱등성 vs Exactly-Once Semantics ?
> 결과적 (effectively-once) 으로 같음. EOS 는 Kafka 클러스터 내부에서만 정확히 1회 (Producer Tx + read_committed + Consume-Transform-Produce). 외부 DB / API 가 끼면 깨짐. 그래서 실무에선 at-least-once + 컨슈머 멱등성 (DB UNIQUE / Outbox / processed_event) 으로 보강.

**Q3.5** Kafka EOS 가 외부 DB write 에서 깨지는 이유?
> Kafka 트랜잭션과 DB 트랜잭션을 묶을 수 없음 (XA 안 쓰면). DB write 후 Kafka commit 직전 죽으면 → 재시작 시 컨슈머가 같은 메시지 다시 받음 → DB write 또 발생. 이걸 막으려면 컨슈머 측 멱등 (DB UNIQUE / processed_event) 필요.

**Q3.6** transactional.id 가 안정적이어야 하는 이유?
> 좀비 fencing. 같은 ID 로 producer 가 재시작하면 epoch 증가 → 옛 producer 가 fenced (ProducerFencedException) → 옛 트랜잭션이 commit 못 함. 매번 랜덤 ID 면 fencing 안 돼서 좀비 producer 의 commit 이 진행될 수 있음. K8s 면 pod 이름 추천.

**Q3.7** read_committed isolation 시 lag 이 폭증하는 시나리오?
> 미완료 트랜잭션이 있으면 LSO (Last Stable Offset) 가 그 위치에서 멈춤. 컨슈머는 LSO 까지만 봄 → 트랜잭션 commit 안 되면 그 이후 메시지를 영원히 못 봄. transaction.timeout.ms (60s 기본) 후 broker 가 자동 abort. timeout 잘못 잡으면 사고.

**Q3.8** AckMode.RECORD 와 BATCH 의 트레이드오프?
> RECORD: 메시지 1건 처리 후 sync commit → 안전, 느림. BATCH: poll 1회 후 commit → 빠름, batch 중 부분 실패 처리 복잡. msa 는 RECORD (도메인 이벤트는 안전 우선). 트래픽 큰 로그 토픽은 BATCH 검토.

---

## Phase 4: 멱등성 / DLQ / 운영 (8개)

**Q4.1** 멱등 컨슈머 패턴 4가지?
> 1) DB UNIQUE/PRIMARY KEY (자연 멱등), 2) Redis SETNX (빠르나 Redis 장애 시 결정 필요), 3) processed_event 테이블 (msa 표준, ADR-0012), 4) Inbox Pattern (수신/처리 분리). 도메인에 따라 선택.

**Q4.2** DLQ 메시지를 어떻게 재처리하나?
> DLQ 토픽 (.DLT) 을 구독하는 별도 consumer + 관리자 API 로 원본 토픽에 재발행. DefaultErrorHandler 가 자동으로 추가한 헤더 (`kafka_dlt-original-topic`, `kafka_dlt-exception-message` 등) 로 컨텍스트 파악. 재처리 시 컨슈머 멱등성으로 중복 방어.

**Q4.3** processed_event 테이블이 무한정 커지는 문제?
> ADR-0012 에 따라 7일 보관 후 스케줄러로 정리. 보관 기간은 retention.ms × 안전 배수 (msa 토픽 7d → processed_event 7d). 같은 메시지가 retention 보다 늦게 도착하는 경우는 없으므로 안전.

**Q4.4** msa 가 EOS 안 쓰고 Outbox 쓴 이유?
> DB 트랜잭션과 Kafka 트랜잭션을 묶을 수 없음. Outbox 패턴은 DB 트랜잭션 안에 이벤트도 INSERT → 도메인 변경과 이벤트 발행이 atomic. 별도 polling worker 가 Kafka 발행. 단순하고 안정적. 컨슈머 멱등성으로 중복 처리만 막으면 effectively-once.

**Q4.5** DefaultErrorHandler 의 backoff 가 FixedBackOff 인데 ExponentialBackOff 가 더 좋지 않나?
> Exponential 이 일시적 장애 (DB peak / 외부 API 일시 장애) 에 더 잘 견딘다. msa 는 단순화로 Fixed 1s × 3 사용. 트래픽 큰 토픽이나 외부 의존 많은 컨슈머는 Exponential (1s, 5s, 25s) 검토 가치.

**Q4.6** Consumer lag 폭증 진단 순서?
> 1) `kafka-consumer-groups --describe` — 어느 partition 이 lag, 2) 컨슈머 로그 — rebalance 빈도 / 처리 시간, 3) APM trace — 처리 단계 어디서 느림, 4) 임시 조치 (consumer scale-out / max.poll.records 줄이기), 5) 근본 원인 (외부 API / DB 튜닝).

**Q4.7** Static Membership (group.instance.id) 의 효과?
> rolling restart / 짧은 GC pause 같은 일시적 부재에 rebalance 트리거 안 함. session.timeout.ms 안에 같은 instance ID 로 재합류하면 그대로 진행. K8s StatefulSet 의 pod 이름을 instance.id 로 쓰는 패턴이 흔함. msa 는 미설정 — 개선 후보.

**Q4.8** Schema Registry 의 역할?
> 메시지의 스키마 (Avro/Protobuf/JSON Schema) 를 중앙에서 관리. Producer 는 register 후 ID 만 메시지에 포함, Consumer 는 ID 로 fetch 해서 deserialize. forward/backward 호환성 검증, 호환 안 되는 스키마 변경 거부. msa 는 미사용 — JSON 페이로드 + 직접 호환성 관리. 도입 시 안전성 ↑, 운영 복잡도 ↑.

---

## Phase 5: 시스템 비교 / 운영 / 트렌드 (8개)

**Q5.1** Kafka vs RabbitMQ?
> Kafka 는 partition 기반 분산 로그, throughput 우위, 메시지 보관 기간, replay 가능. RabbitMQ 는 AMQP 기반 큐, 라우팅 유연 (exchange + binding), priority queue, push 모델. 이벤트 소싱 / 스트리밍 / 대규모 → Kafka. 작업 큐 / 라우팅 복잡 / 작은 규모 → RabbitMQ.

**Q5.2** Kafka vs Pulsar?
> Pulsar 는 broker 와 storage 분리 (BookKeeper). Kafka 는 broker 가 storage 도 담당. Pulsar 는 multi-tenancy / geo-replication 강점, Kafka 는 ecosystem (Streams, Connect) 성숙. 신규 채택 시 Kafka 가 무난, 멀티테넌트 큰 환경은 Pulsar 검토.

**Q5.3** Kafka Streams 와 Consumer API 의 선택 기준?
> Streams: stateful 처리 (window, aggregate, join), state store 자동 관리, EOS 자동, **외부 시스템 안 끼는 변환 파이프라인**. Consumer API: 단순 메시지 소비 + 외부 시스템 연동, 비즈니스 로직 자유. msa 는 analytics 만 Streams (1h window 집계), 나머지 모두 Consumer API.

**Q5.4** Kafka Connect 와 자체 producer/consumer 의 차이?
> Connect 는 source/sink connector 표준. JDBC, ES, S3 등 connector 가 미리 있어 코드 없이 데이터 이동. cluster 모드로 운영. 자체 producer/consumer 는 비즈니스 로직과 결합. 단순 ETL 은 Connect, 비즈니스 로직 끼면 자체.

**Q5.5** Rack-aware fetch (KIP-881) 가 비용 절감하는 이유?
> AWS / GCP cross-AZ 트래픽은 GB 당 과금. 같은 AZ 의 follower replica 에서 fetch 하면 zone 내 트래픽으로 처리되어 무료/저렴. 트래픽 큰 클러스터에서 월 수천 달러 절감 가능. 단 follower fetch 는 약간 stale (HW 까지) → strong consistency 필요시 leader fetch.

**Q5.6** Tiered Storage (Kafka 3.6+) 의 의미?
> 옛날 segment 를 S3 같은 외부 스토리지로 offload. 로컬 디스크는 hot 데이터만 유지 → 디스크 비용 ↓, retention 무한대로 늘릴 수 있음. 컨슈머는 투명하게 외부 storage 도 읽음 (broker 가 중계). msa 는 미도입 — retention 30d analytics 토픽이 후보.

**Q5.7** Avro / Protobuf / JSON 의 트레이드오프?
> Avro: schema-aware binary, Schema Registry 통합, forward/backward 호환 표준. Protobuf: schema-aware binary, gRPC 친화. JSON: human-readable, 호환성 직접 관리, 압축 효율 낮음. Kafka 메시지는 보통 Avro 가 정공법, JSON 은 prototype/단순 시스템.

**Q5.8** Kafka 의 향후 트렌드 / KIP?
> KRaft (3.3 GA, 4.0 ZK 완전 제거), Tiered Storage (3.6+), Queues for Kafka (4.0 +, KIP-932 — 여러 컨슈머가 같은 partition 메시지를 분산 처리), Apache Iceberg 통합 (Kafka 토픽을 Iceberg 테이블처럼 SQL 쿼리), KIP-848 (Consumer Rebalance 차세대 — broker 가 assignment 결정).

---

## Phase 6: msa 특화 (보너스, 8개)

**Q6.1** msa 의 producer 표준 설정은?
> acks=all + enable.idempotence=true + max.in.flight=5 + delivery.timeout.ms=120s. 3개 서비스 (order, inventory, fulfillment) 가 동일 설정. linger.ms / batch.size / compression.type 은 기본값 (튜닝 후보).

**Q6.2** msa 의 컨슈머 멱등 패턴은?
> ADR-0012 의 processed_event 테이블 + eventId UUID. inventory, order, fulfillment, quant 적용. quant 은 `(eventId, consumerGroup)` 복합키로 멀티 그룹 안전. 보관 7일.

**Q6.3** msa 가 Outbox 패턴을 쓰는 서비스는?
> inventory, fulfillment, quant. 모두 도메인 변경 + 이벤트 INSERT 를 한 트랜잭션으로 묶어 atomic 보장. 별도 polling worker 가 Kafka 로 발행. order 는 직접 발행 (Outbox 미적용 — 결제 흐름이 외부 API 와 강결합이라 단순화 선택, 추후 도입 후보).

**Q6.4** msa 의 토픽 설정 규칙?
> 도메인 이벤트: partitions=6, replicas=3, retention=7d, min.ISR=2. analytics.event.collected: partitions=12, retention=30d (트래픽 + 재처리 윈도우). 이름은 `{domain}.{entity}.{event}` (예: order.order.completed). DLQ 는 `.DLT` 접미사.

**Q6.5** msa 의 KafkaListener 처리 흐름은?
> @KafkaListener (containerFactory 명시) → ConsumerRecord 받음 → eventId 로 processed_event 조회 → 비즈니스 처리 → processed_event INSERT → 메서드 종료 → Spring AckMode.RECORD 가 sync commit. 예외 발생 시 DefaultErrorHandler 가 1s × 3 재시도 → DLT 송부.

**Q6.6** msa 의 KafkaConsumerErrorHandlerConfiguration (quant) 이 다른 서비스보다 좋은 점은?
> 1) 별도 @Configuration 클래스로 분리 (응집도 ↑), 2) 상수화 (DLT_SUFFIX, BACKOFF_INTERVAL_MS, MAX_RETRIES), 3) `@ConditionalOnProperty` 로 Phase 1 backtest-only 환경에서 자동 비활성화. 다른 서비스 (inventory, order, fulfillment) 는 KafkaConfig 안에 인라인 — quant 패턴으로 통일 가능.

**Q6.7** msa 의 analytics Kafka Streams 설정 특징?
> APPLICATION_ID=analytics-streams, COMMIT_INTERVAL=1s (default 30s 보다 짧음), LogAndContinueExceptionHandler (deserialize 실패 skip + log). processing.guarantee 미설정 (기본 at_least_once). Window=1h tumbling. Output: Redis + ClickHouse + analytics.score.updated 토픽.

**Q6.8** msa 의 partition key 선택 패턴?
> 도메인 이벤트: aggregate ID 기반 (예: orderId) — 같은 aggregate 의 이벤트가 같은 partition → 순서 보장. 예외: quant 의 OutboxRelay 는 eventId (UUID) 사용 → Phase 2 단순화로 도메인 순서 보장 안 됨, 후속 PR 에서 정밀 매핑 + aggregateId key 로 변경 예정.

---

## 자가 평가

학습 후 이 문서를 보지 않고 위 40문항 중 30개 이상 30초 안에 답할 수 있어야 면접 대비 완료. 부족한 영역은 해당 Phase 의 deep file 재학습.

| Phase | 영역 | 통과 기준 |
|---|---|---|
| Phase 1 | 아키텍처 기본 | 6/8 |
| Phase 2 | Producer / Broker | 6/8 |
| Phase 3 | Consumer / EOS | 5/8 (난이도 ↑) |
| Phase 4 | 멱등 / DLQ / 운영 | 6/8 |
| Phase 5 | 비교 / 트렌드 | 4/8 (선택형) |
| Phase 6 | msa 특화 | 5/8 (실무용) |

총합 30/40 이상 = 면접 통과 + 운영 자신감.
