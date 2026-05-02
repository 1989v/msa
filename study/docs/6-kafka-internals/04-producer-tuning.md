---
parent: 6-kafka-internals
seq: 04
title: Producer Tuning — acks · idempotence · batch · compression
type: deep
created: 2026-05-01
---

# 04. Producer 튜닝 — acks / idempotence / batch / compression

## 한 줄 요약

> Producer 의 동작은 대부분 **`acks` + `enable.idempotence` + (linger.ms × batch.size × compression)** 조합으로 결정된다. msa 표준은 `acks=all + idempotence=true + max.in.flight=5 + delivery.timeout.ms=120s`.

## 1. Producer 송신 흐름

```
send(record)
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Serializer 실행 → byte[]                              │
│ 2. Partitioner: hash(key) % partitions → partition 결정  │
│ 3. RecordAccumulator: partition 별 batch buffer 에 적재  │
│ 4. Sender thread: batch.size 차거나 linger.ms 만료 시    │
│    broker leader 로 ProduceRequest 전송                  │
│ 5. Broker ack → callback / future 완료                   │
└─────────────────────────────────────────────────────────┘
```

**핵심**: `send()` 는 비동기 — buffer 에 넣고 즉시 리턴 (사실 future 반환). 실제 전송은 background sender thread.

## 2. acks — 가장 중요한 설정

| 값 | 의미 | 보장 | latency | 사용처 |
|---|---|---|---|---|
| `0` | leader 에 전송 후 즉시 ack 처리 (응답 안 기다림) | 분실 가능 | 최소 | 로그 / 메트릭 (실시간성 우선) |
| `1` | leader 가 디스크 쓴 후 ack | leader 장애 + replication 전 = 분실 | 중간 | 일반 (예전 default) |
| `all` (`-1`) | leader + ISR 전체 가 받은 후 ack | min.ISR 까지 안전 | 최대 | **데이터 손실 절대 안 됨** (msa 표준) |

**`acks=all` 의 함정**:
- `min.insync.replicas` 가 **broker/topic 레벨** 설정. acks=all 만 보면 안 되고 ISR 수도 봐야.
- `min.ISR=1` + `acks=all` → leader 1 개만 살아있어도 ack → 사실상 acks=1.
- msa 프로덕션: `min.ISR=2`, `RF=3` → leader + 1 follower 까지 받아야 ack. **1대 장애 허용**.

```kotlin
// inventory KafkaConfig.kt
ProducerConfig.ACKS_CONFIG to "all",
```

## 3. enable.idempotence — Producer 측 멱등

**문제**: producer 가 broker 에 메시지 보낸 뒤 ack 못 받으면 → 재전송. 그런데 broker 는 이미 받았을 수도 있음 → **중복 발행**.

**해결**: Producer 마다 PID (Producer ID) 와 sequence number 부여. broker 가 (PID, partition, seq) 로 중복 탐지.

```
1차 전송: PID=42, partition=0, seq=100 → broker 저장, ack 응답 (네트워크 끊김)
재전송:   PID=42, partition=0, seq=100 → broker "이미 받음" 알아서 무시, ack 만 다시 보냄
```

`enable.idempotence=true` 가 강제하는 것:
- `acks=all` (자동 강제)
- `retries > 0` (자동, 보통 Int.MAX_VALUE)
- `max.in.flight.requests.per.connection ≤ 5` (KIP-679 후 5 까지 안전)
- (3.0+) 기본값이 true 로 변경

```kotlin
// msa 표준
ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG to true,
ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION to 5,
ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG to 120000,
```

**중요**:
- 이건 **단일 producer 인스턴스 + 단일 세션** 안에서만 보장. producer 가 재시작하면 PID 재발급되어 중복 가능.
- **세션 간 멱등이 필요하면 Transactional Producer** (`transactional.id`).
- **컨슈머 측 멱등성과는 별개** — broker 까지의 중복 발행을 막는 것이지, 컨슈머가 같은 메시지를 두 번 처리하는 건 별도 문제 (그래서 ADR-0012 의 processed_event 가 필요).

## 4. retries / delivery.timeout.ms 의 관계

```
retries:                 재시도 횟수 (default Int.MAX_VALUE since 2.1)
retry.backoff.ms:        100 (재시도 간격)
delivery.timeout.ms:     120_000 (총 한도, msa 표준)
request.timeout.ms:      30_000 (개별 요청 타임아웃)
```

**delivery.timeout.ms 가 실제 한도**. retries 무한이어도 120초 지나면 TimeoutException + callback 호출.

```
delivery.timeout.ms ≥ linger.ms + request.timeout.ms (필수)
```

msa 는 120초 → 데이터 손실 0 + 폭주 시 backpressure 발생 (acceptable).

## 5. linger.ms × batch.size — Throughput vs Latency

**linger.ms**: sender thread 가 batch 를 broker 로 보내기 전 대기하는 시간.
**batch.size**: partition 마다 모을 buffer 크기 (기본 16KB).

```
linger.ms=0, batch.size=16KB
   → 메시지 들어오는 즉시 보냄 (latency 우선) — 보통 single message batch

linger.ms=20, batch.size=64KB
   → 최대 20ms 대기, 64KB 모이면 즉시 전송 (throughput 우선)
```

**경험치**:
- 트래픽 적음 + latency 중요 → linger=0–5ms
- 트래픽 많음 + throughput 중요 → linger=10–50ms, batch=64–128KB
- 보통은 linger=5–20ms 가 sweet spot

msa 는 명시 안 함 → 기본값 (linger=0, batch=16KB) 사용 중. 트래픽이 늘면 튜닝 후보.

## 6. compression.type

| 값 | CPU | 압축률 | latency | 비고 |
|---|---|---|---|---|
| `none` | 0 | 1.0 | 최소 | default |
| `gzip` | 높음 | 좋음 | 큼 | 레거시 |
| `snappy` | 낮음 | 보통 | 작음 | 균형 |
| `lz4` | 매우 낮음 | 보통 | 매우 작음 | **권장** (속도) |
| `zstd` | 낮음 | 매우 좋음 | 작음 | **권장** (압축률, 2.1+) |

**JSON 페이로드는 압축 효과 큼** (텍스트 반복) — 보통 4–8x 절약.

**브로커 설정**:
- 토픽 `compression.type=producer` (default) → producer 가 보낸 그대로 저장
- 토픽 `compression.type=lz4` 등으로 강제하면 broker 가 재압축 (CPU 비용 ↑)

## 7. Transactional Producer

Producer 트랜잭션은 **EOS** 의 일부 — 자세한 건 `09-exactly-once.md`. 여기선 설정만:

```kotlin
val props = mapOf(
    ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
    ProducerConfig.ACKS_CONFIG to "all",
    ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG to true,
    ProducerConfig.TRANSACTIONAL_ID_CONFIG to "order-svc-tx-${instanceId}",
    // transactional.id 가 있으면 자동 idempotence + acks=all
)

producer.initTransactions()
try {
    producer.beginTransaction()
    producer.send(record1)
    producer.send(record2)
    producer.commitTransaction()
} catch (e: Exception) {
    producer.abortTransaction()
}
```

**transactional.id** 는 producer 인스턴스의 고유 식별자. 같은 ID 로 재시작하면 이전 트랜잭션을 fence (강제 종료) 해서 좀비 producer 방지.

## 8. msa Producer 표준 분석

```kotlin
// inventory/order/fulfillment KafkaConfig 공통
ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
ProducerConfig.ACKS_CONFIG to "all",                           // ✓ 손실 0
ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG to true,              // ✓ 중복 방지
ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION to 5,     // ✓ KIP-679 안전
ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG to 120000,           // ✓ ADR-0015
```

| 설정 | 값 | 평가 |
|---|---|---|
| acks | all | ✓ 표준 |
| enable.idempotence | true | ✓ 표준 |
| max.in.flight | 5 | ✓ idempotent 안전 한도 |
| delivery.timeout.ms | 120s | ✓ ADR-0015 일치 |
| linger.ms | (기본 0) | △ 트래픽 늘면 5–20 권장 |
| batch.size | (기본 16KB) | △ 동일 |
| compression.type | (기본 none) | △ JSON 페이로드라 lz4 권장 |
| transactional.id | (없음) | △ EOS 미도입 — Outbox 로 대체 |

**msa 의 결정**: EOS 대신 **Outbox 패턴** 으로 producer 측 정합성 보장 (ADR 외부 IO 분리 원칙). 단순함 + DB 와 강결합 보장. 자세한 건 `09-exactly-once.md`.

## 9. Producer 모니터링 메트릭

```
record-send-rate              # 초당 발행 레코드 수
record-error-rate             # 초당 에러 수
record-retry-rate             # 초당 재시도 수
batch-size-avg                # 평균 batch 크기
records-per-request-avg       # 요청당 레코드 수
compression-rate-avg          # 평균 압축률
request-latency-avg / max     # broker 응답 시간
buffer-available-bytes        # accumulator 남은 공간 (음수 가까워지면 backpressure)
```

JMX 또는 Micrometer 로 노출 → Prometheus → Grafana. msa 는 `/actuator/prometheus` 로 노출 중.

## 10. 흔한 사고 패턴

### 사고 1: producer block — buffer 가득
```
buffer.memory (default 32MB) 가득 → send() 가 max.block.ms (default 60s) 까지 block → 초과 시 TimeoutException
```
**원인**: broker 응답 느림 + 발행 속도 빠름. **해결**: buffer.memory 증가 또는 발행 속도 throttle.

### 사고 2: 메시지 순서 깨짐
- max.in.flight > 1 + idempotence=false + retries > 0
- batch 1 (seq 100) 실패 → 재시도 도중에 batch 2 (seq 101) 가 먼저 성공 → 순서 깨짐
**해결**: idempotence=true (sequence 검증으로 재정렬됨) 또는 max.in.flight=1 (성능 ↓).

### 사고 3: Transaction abort 때문에 stuck
- transactional producer 가 commit 안 하고 죽음
- consumer (read_committed) 가 LSO 이후 읽기 거부 → lag 폭증
- 해결: `transaction.timeout.ms` (기본 60s) 후 broker 가 자동 abort

## 11. 면접 포인트

- **Q. acks=all + min.insync.replicas=1 의 문제는?**
  > acks=all 의 의미가 사실상 acks=1 로 격하. leader 1 개만 살아있어도 ack → leader 죽으면 데이터 손실. min.ISR ≥ 2 (RF=3 기준) 로 잡아야 acks=all 의 보장이 의미 있음.

- **Q. enable.idempotence 가 정확히 뭘 막아주나?**
  > 단일 producer 세션 내에서, 네트워크 재시도로 인한 중복 발행을 막는다. (PID, sequence) 로 broker 가 dedup. 컨슈머가 두 번 처리하는 건 별개 문제 — 그건 컨슈머 측에서 처리해야 한다.

- **Q. max.in.flight=5 인데 순서가 안 깨지나?**
  > idempotence=true 면 broker 가 sequence 검증으로 out-of-order batch 를 reject 하고 재정렬한다. KIP-679 (Kafka 2.5+) 부터 5 까지 안전. 그 이전엔 1 만 안전했음.

- **Q. msa 가 Transactional Producer 안 쓰는 이유?**
  > DB 트랜잭션과 Kafka 트랜잭션은 분리되어 XA 같은 분산 트랜잭션이 없으면 한쪽이 깨질 수 있음. Outbox 패턴으로 DB 트랜잭션에 이벤트를 함께 INSERT 하고, 별도 polling 으로 Kafka 발행 + 컨슈머 측 멱등성으로 effectively-once 달성. 운영 단순도 우위.

- **Q. linger.ms 를 0 에서 20 으로 올리면?**
  > throughput 향상 (큰 batch) + CPU/네트워크 효율 개선, 단 latency 가 평균 +10ms (0.5 × linger). 트래픽 적은 토픽엔 손해, 많은 토픽엔 이득.

## 12. 다음 단계

- [05-broker-internals.md](05-broker-internals.md) — broker 가 받은 batch 를 어떻게 저장
- [06-replication-isr.md](06-replication-isr.md) — acks=all 의 ack 가 어떻게 결정되나
- [09-exactly-once.md](09-exactly-once.md) — Transactional Producer 심화
