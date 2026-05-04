---
parent: 6-kafka-internals
type: preview
created: 2026-05-01
---

# Kafka 내부 동작 — Preview

> 학습자 수준: 시니어 (10년차 백엔드, 한국 대기업 면접 대비) · 전체 예상 시간: 20h · 목표: 면접 + msa 운영 + EOS / KRaft 도입 검토
> 계획서: [00-plan.md](00-plan.md) · 깊이 패키지: P3 풀팩 · 학습 순서: Bottom-up (Broker → Producer → Consumer → Streams → 운영)

---

## 멘탈 모델: "분산 커밋 로그 사다리"

Kafka 는 표면적으로는 메시지 큐로 보이지만 본질은 **append-only 파티션 로그 + 컨슈머 그룹 오프셋**이다. 5개 층으로 나눠 기억한다.

```
  ┌────────────────────────────────────────┐
  │  L5: 운영 / 장애 대응
  │  - URP, lag 폭증, unclean election
  │  - Cross-AZ 비용, rack-awareness
  │  - DLQ + 재처리 전략
  └────────────────────┬───────────────────┘
                       │ "정확히 한 번을 만든다"
  ┌────────────────────┴───────────────────┐
  │  L4: 시맨틱 (EOS / Idempotency / DLQ)
  │  - Producer 멱등 + Transaction
  │  - Consumer read_committed
  │  - processed_event 테이블 (ADR-0012)
  └────────────────────┬───────────────────┘
                       │ "그룹/오프셋 어떻게 관리하나"
  ┌────────────────────┴───────────────────┐
  │  L3: Consumer Group / Rebalance
  │  - Group Coordinator
  │  - Eager vs Cooperative-Sticky
  │  - poll loop / max.poll.interval.ms
  └────────────────────┬───────────────────┘
                       │ "쓰기/저장 어떻게 보장하나"
  ┌────────────────────┴───────────────────┐
  │  L2: Producer / Broker 내부
  │  - acks / linger / batch / compression
  │  - log segment, page cache, sendfile
  │  - ISR, HW, leader election, KRaft
  └────────────────────┬───────────────────┘
                       │ "구성 요소 자체"
  ┌────────────────────┴───────────────────┐
  │  L1: Kafka 아키텍처 기본
  │  - Broker / Topic / Partition / Replica
  │  - Offset / Retention / Log Compaction
  └────────────────────────────────────────┘
```

**핵심 7문장만 외운다**:
1. **파티션은 병렬화 단위이자 순서 보장 단위** — 한 파티션은 한 컨슈머에만 할당된다.
2. **acks=all + min.insync.replicas=2 + enable.idempotence=true** 가 데이터 손실 없는 표준 조합. ISR (In-Sync Replicas) 보장.
3. **HW (High Watermark) 까지만 컨슈머에 노출** 된다 — ISR 모두에 복제된 오프셋.
4. **EOS는 Producer 트랜잭션 + Consumer read_committed + Consume-Transform-Produce** 한정으로만 성립한다 (외부 DB commit 시 깨짐).
5. **Consumer 멱등성은 외부에서 챙긴다** — Kafka 가 만들어주지 않는다 (msa는 `processed_event` 테이블).
6. **Rebalance 는 STW 가 아니다** — Cooperative-Sticky 로 점진적 재할당이 가능.
7. **Kafka 가 빠른 이유는 sequential I/O + page cache + zero-copy (sendfile)** — 메시지 브로커가 아니라 파일시스템에 가깝다.

---

## 소주제 지도

> 14개 파일로 분할 (00-preview 제외 13개 deep + 산출물 3개). 각 파일 평균 ~1.5h.

### Phase 1: Kafka 아키텍처 기본 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | Broker / Topic / Partition / Replica | [01-broker-topic-partition.md](01-broker-topic-partition.md) | 파티션 = 병렬화 + 순서 단위, leader/follower |
| 02 | Offset / Retention / Log Compaction | [02-offset-retention-compaction.md](02-offset-retention-compaction.md) | __consumer_offsets, retention.ms vs compact |
| 03 | KRaft vs ZooKeeper / Controller | [03-controller-kraft.md](03-controller-kraft.md) | 메타데이터 관리, KRaft 마이그레이션, msa는 KRaft 사용 중 |

### Phase 2: 심화 — Producer / Broker 내부 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 04 | Producer 튜닝 (acks / idempotence / batch) | [04-producer-tuning.md](04-producer-tuning.md) | acks=all + idempotence, linger.ms / batch.size, compression |
| 05 | Broker 내부 (log segment / page cache / sendfile) | [05-broker-internals.md](05-broker-internals.md) | Kafka 가 빠른 이유, segment / index, zero-copy |
| 06 | 복제 (ISR / HW / Leader Election) | [06-replication-isr.md](06-replication-isr.md) | min.insync.replicas, unclean.leader.election, rack-awareness |

### Phase 3: 심화 — Consumer / Rebalance / EOS (4개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 07 | Consumer 그룹 / Rebalance 프로토콜 | [07-consumer-rebalance.md](07-consumer-rebalance.md) | Group Coordinator, Eager vs Cooperative-Sticky |
| 08 | Offset Commit / Poll Loop 함정 | [08-offset-commit-poll.md](08-offset-commit-poll.md) | auto vs manual, max.poll.records / interval.ms |
| 09 | Exactly-Once Semantics (EOS v2) | [09-exactly-once.md](09-exactly-once.md) | transactional.id, read_committed, 한계 |
| 10 | 멱등 Consumer + DLQ + 장애 대응 | [10-idempotency-dlq-failure.md](10-idempotency-dlq-failure.md) | processed_event, DLT, URP, lag 폭증 |

### Phase 4: msa 실전 적용 (1개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 11 | msa Kafka 코드 grep 전수조사 | [11-msa-codebase-grep.md](11-msa-codebase-grep.md) | KafkaConfig, OutboxRelay, Streams, kafka-convention 일치 검증 |

### 산출물 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 12 | 면접 Q&A 카드 | [12-interview-qa.md](12-interview-qa.md) | 5 Phase × 8문항 = 40 카드 |
| 13 | msa 코드베이스 적용 제안 | [13-improvements.md](13-improvements.md) | EOS / KRaft / 파티션 재설계 / Schema Registry / Tiered Storage |

---

## 개념 관계도

```
                   ┌──────────────────────────────┐
                   │  L1: Topic / Partition       │
                   │  - replication-factor        │
                   │  - retention / compaction    │
                   └──────────────┬───────────────┘
                                  │ "쓰기 보장"
                                  ▼
            ┌─────────────────────┴─────────────────────┐
            │                                           │
            ▼                                           ▼
 ┌────────────────────┐                    ┌────────────────────────┐
 │ L2: Producer        │                    │  L2: Broker             │
 │ - acks / idempotence│                    │  - log segment / index  │
 │ - linger / batch    │   ack=all          │  - page cache + sendfile│
 │ - compression       │ ◄────────────────► │  - ISR / HW / Election  │
 │ - transactional.id  │                    │  - KRaft Controller     │
 └─────────┬──────────┘                    └────────┬───────────────┘
           │                                        │
           │  records                               │  log replicate
           ▼                                        │
 ┌────────────────────────────────────────────────┐ │
 │  L3: Consumer Group / Coordinator              │◄┘
 │  - assignor: Range/RR/Sticky/Cooperative       │
 │  - heartbeat / session.timeout                 │
 │  - max.poll.interval.ms                        │
 │  - offset commit (auto / sync / async)         │
 └────────────────────┬───────────────────────────┘
                      │ "한 번만 처리"
                      ▼
 ┌────────────────────────────────────────────────┐
 │  L4: EOS / Idempotency / DLQ                   │
 │  - Producer Tx + Consumer read_committed       │
 │  - processed_event 테이블 (ADR-0012)            │
 │  - DLT + 재시도 (ADR-0015)                      │
 └────────────────────┬───────────────────────────┘
                      │ "운영 시 본다"
                      ▼
 ┌────────────────────────────────────────────────┐
 │  L5: 운영                                       │
 │  - URP / lag / unclean election                │
 │  - rack-awareness / cross-AZ 비용              │
 │  - Tiered Storage / KRaft 마이그레이션          │
 └────────────────────────────────────────────────┘
```

---

## Phase 0 치트시트 (학습 시작 전 한 장)

### 권장 Producer 설정 (2026 기준)

| 항목 | 권장값 | 비고 |
|---|---|---|
| `acks` | **`all`** (= -1) | 손실 0 보장, ISR 전체 ack |
| `enable.idempotence` | **`true`** | PID + sequence, 자동 `acks=all` 강제 |
| `max.in.flight.requests.per.connection` | 5 (idempotent 시) | idempotent 면 5 까지 안전 (KIP-679) |
| `retries` | `Int.MAX_VALUE` | delivery.timeout.ms 가 실 한도 |
| `delivery.timeout.ms` | 120_000 | 총 전송 만료 (msa 적용값) |
| `linger.ms` | 5–20 | throughput vs latency 트레이드오프 |
| `batch.size` | 32–128 KB | linger 와 함께 |
| `compression.type` | `lz4` 또는 `zstd` | zstd 가 압축률 우위 (3.4+) |

### 권장 Consumer 설정

| 항목 | 권장값 | 비고 |
|---|---|---|
| `enable.auto.commit` | **`false`** | 비즈니스 처리 후 명시 커밋 |
| `auto.offset.reset` | `earliest` (이벤트) / `latest` (실시간) | 신규 그룹 시작 위치 |
| `isolation.level` | `read_committed` | EOS 시 필수 |
| `partition.assignment.strategy` | **CooperativeStickyAssignor** | 점진적 재할당 |
| `max.poll.records` | 100–500 | 처리시간 기반 조정 |
| `max.poll.interval.ms` | 5_000–300_000 | poll 사이 최대 간격, 초과 시 리밸런스 |
| `session.timeout.ms` | 10_000–45_000 | 하트비트 누락 허용 윈도우 |

### 절대 하지 말 것

- `acks=0` 운영 (fire-and-forget, 분실 가능)
- `enable.auto.commit=true` + 비동기 처리 (메시지 누락 위험)
- `unclean.leader.election.enable=true` (데이터 손실 허용)
- `min.insync.replicas=1` + `acks=all` (replication 효과 무력화)
- 메시지 본문에 멱등 키 없이 발행 (Consumer 측 dedup 불가)
- DLQ (Dead Letter Queue, 데드 레터 큐) 만들고 모니터링 안 함 (조용히 쌓임)
- 한 파티션을 두 Consumer 인스턴스에 동시 할당 시도 (Kafka가 막지만 설계 원칙으로도 금지)

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 11** (Bottom-up). 산출물(12-13)은 마지막
- Phase 1 은 의존성 강함 → 순서대로
- Phase 2(04-06) 는 Producer 와 Broker 가 서로를 참조 → 한 번에 봐야 이해됨
- Phase 3(07-10) 는 Phase 2 를 전제로 함 (특히 EOS 는 Producer Transaction + Consumer 양쪽 이해 필요)
- **11-msa-codebase-grep.md** 는 코드/yml 직접 열어보며 진행 권장
- **12-interview-qa.md** 는 회독용 — 학습 종료 후 1주일 간격 2-3회

각 파일 호출:
```
/study:start 6           # 다음 deep file 자동 선택
/study:start 6 04        # 04-producer-tuning.md 직접 지정
```

---

## msa 사용 현황 요약 (Phase 3 사전 정보)

| 서비스 | Producer | Consumer | 멱등 패턴 | DLQ | 비고 |
|---|---|---|---|---|---|
| order | acks=all + idempotence | inventory.reservation.expired | processed_event | DLT | ADR-0012 적용 |
| inventory | 동일 + Outbox polling | order/fulfillment 토픽 | processed_event | DLT | Outbox SSOT |
| fulfillment | Outbox polling | inventory.stock.reserved | processed_event | DLT | Outbox SSOT |
| search | (없음) | product.item.* | ES doc id 멱등 | DLT | 자연 멱등 |
| analytics | Streams output | analytics.event.collected | (없음) | (Streams) | KStream 1h 윈도우 |
| wishlist | (없음) | product.deleted, member.withdrawn | (간단 — DELETE 멱등) | (TBD) | |
| quant | OutboxRelay (Phase 2) | TBD (Phase 3) | IdempotentEventConsumer | DLT | KafkaConsumerErrorHandlerConfiguration |

> 인프라: 로컬 (k3s-lite) 단일 broker KRaft, 프로덕션 (Strimzi) 3 controller + 3 broker KRaft, RF=3, min.ISR=2.
