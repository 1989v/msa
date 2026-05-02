---
parent: 6-kafka-internals
seq: 13
title: msa 코드베이스 적용 제안 종합
type: deep
created: 2026-05-01
---

# 13. msa 코드베이스 적용 제안

> Phase 3 ([11-msa-codebase-grep.md](11-msa-codebase-grep.md)) 의 발견 사항을 우선순위 + ADR 필요 여부로 정리.

## 코드 / 설정 개선 제안 종합

| # | 제안 | 대상 | 영향도 | 우선순위 | ADR 필요 |
|---|---|---|---|---|---|
| 1 | DLQ ErrorHandler 클래스 분리 + 상수화 | inventory/order/fulfillment | 낮음 | **높음** | N |
| 2 | `partition.assignment.strategy=CooperativeStickyAssignor` | 모든 컨슈머 | 낮음 | **높음** | N |
| 3 | `group.instance.id` 도입 (K8s pod name) | 모든 컨슈머 | 낮음 | **높음** | N |
| 4 | inventory IdempotentEventConsumer 헬퍼 도입 (atomic INSERT) | common + inventory/order | 중간 | **높음** | Y (ADR-0012 보강) |
| 5 | `compression.type=lz4` 적용 | 모든 producer | 낮음 | 중간 | N |
| 6 | Producer linger.ms / batch.size 튜닝 | 트래픽 큰 토픽 | 낮음 | 중간 | N |
| 7 | DLT 토픽 KafkaTopic CRD 명시 선언 | k8s/infra/prod | 낮음 | 중간 | N |
| 8 | quant OutboxRelay 정밀 토픽 매핑 + aggregateId key | quant | 중간 | 중간 | N (Phase 2 단순화 명시 사항) |
| 9 | analytics Streams `processing.guarantee=exactly_once_v2` | analytics | 중간 | 중간 | Y (ADR 마이너) |
| 10 | Schema Registry 도입 (Avro) | 전 서비스 | **높음** | 낮음 | **Y (L3)** |
| 11 | rack-awareness (KIP-392/881) | k8s/infra/prod | 중간 | 낮음 | Y |
| 12 | Tiered Storage (Kafka 3.6+) | analytics 토픽 | 중간 | 낮음 | Y |
| 13 | KIP-848 차세대 Rebalance 검토 | 전 컨슈머 | 낮음 | 낮음 (Kafka 4.x 채택 후) | N |

## 우선순위 TOP 4 (즉시 추진 가치)

### 1. DLQ ErrorHandler 클래스 분리 + 상수화

**현재** — inventory/order/fulfillment 의 KafkaConfig 안에 인라인:
```kotlin
setCommonErrorHandler(
    DefaultErrorHandler(
        DeadLetterPublishingRecoverer(kafkaTemplate),
        FixedBackOff(1000L, 3L),
    )
)
```

**개선** — quant 의 `KafkaConsumerErrorHandlerConfiguration` 패턴으로 통일:
```kotlin
@Configuration
@ConditionalOnProperty(
    name = ["spring.kafka.bootstrap-servers"],
    matchIfMissing = false,
)
class KafkaConsumerErrorHandlerConfiguration {
    @Bean
    fun defaultErrorHandler(kafkaTemplate: KafkaTemplate<String, Any>): DefaultErrorHandler {
        val recoverer = DeadLetterPublishingRecoverer(kafkaTemplate) { record, _ ->
            TopicPartition(record.topic() + DLT_SUFFIX, record.partition())
        }
        return DefaultErrorHandler(recoverer, FixedBackOff(BACKOFF_INTERVAL_MS, MAX_RETRIES))
    }
    companion object {
        const val DLT_SUFFIX: String = ".DLT"
        const val BACKOFF_INTERVAL_MS: Long = 1_000L
        const val MAX_RETRIES: Long = 3L
    }
}
```

**왜 1순위**:
- 응집도 ↑ (KafkaConfig 가 producer/consumer factory 만, error handler 분리)
- 4개 서비스 중복 제거 → common 모듈 이전 가능 (`kgd.common.kafka`)
- 변경 시 한 곳만 수정
- ADR 불필요 (스타일 정합)

**영향**: 4개 서비스 Bean 위치 이동. 기능 변경 없음 → 빌드/테스트만 검증.

---

### 2. CooperativeStickyAssignor 도입

**현재** — 명시 없음 → 기본 `RangeAssignor`.

**개선**:
```kotlin
ConsumerConfig.PARTITION_ASSIGNMENT_STRATEGY_CONFIG to
    "org.apache.kafka.clients.consumer.CooperativeStickyAssignor"
```

**왜 2순위**:
- Rebalance 시 STW 최소화 → K8s rolling restart 또는 scale-out 시 메시지 처리 끊김 ↓
- Range 의 첫 컨슈머 부하 집중 문제 해결
- 코드 변경 1줄, 위험 거의 없음

**주의**: 같은 그룹 내 모든 컨슈머가 cooperative 지원해야 — mixed 환경에선 단계적 마이그레이션 필요. msa 는 모든 컨슈머가 같은 spring-kafka 버전 → 안전.

---

### 3. group.instance.id 도입 (Static Membership)

**현재** — 미설정. K8s pod 재시작 시마다 rebalance.

**개선** — K8s downward API 로 pod 이름 주입 + 컨슈머 설정:
```yaml
# Deployment env
env:
  - name: HOSTNAME
    valueFrom:
      fieldRef:
        fieldPath: metadata.name
  - name: KAFKA_GROUP_INSTANCE_ID
    valueFrom:
      fieldRef:
        fieldPath: metadata.name
```

```kotlin
// KafkaConfig
val instanceId = System.getenv("KAFKA_GROUP_INSTANCE_ID")
if (instanceId != null) {
    props[ConsumerConfig.GROUP_INSTANCE_ID_CONFIG] = instanceId
}
```

**왜 3순위**:
- rolling restart 부담 ↓ (session.timeout.ms 안에 같은 pod 재합류 → rebalance 안 트리거)
- Cooperative-Sticky 와 시너지 (이동 진짜 필요한 경우만 발생)
- 코드 변경 작음

**전제**: StatefulSet 또는 stable pod name. 일반 Deployment 도 가능 (pod name 이 매번 다르지만 짧은 시간엔 같은 ID).

---

### 4. IdempotentEventConsumer 헬퍼 통일 (atomic INSERT)

**현재** — inventory/order 의 멱등 패턴이 비즈니스 트랜잭션과 분리:
```kotlin
fun onOrderCompleted(record) {
    if (processedEventRepository.existsById(eventId)) return  // [1]
    reserveStockUseCase.execute(...)                          // [2] DB TX 1
    processedEventRepository.save(...)                        // [3] DB TX 2
}
```

[2] 성공 + [3] 실패 시 컨슈머 재처리 → [1] false → [2] 재실행 → 중복.

**개선** — quant 의 `IdempotentEventConsumer` 패턴 + common 모듈 이전:
```kotlin
// common/kafka/IdempotentEventHandler.kt
@Component
class IdempotentEventHandler(
    private val processedEventRepo: ProcessedEventRepositoryPort,
    private val transactionTemplate: TransactionTemplate,
) {
    fun process(eventId: String, consumerGroup: String, block: () -> Unit): Boolean {
        if (processedEventRepo.existsById(eventId, consumerGroup)) return false
        transactionTemplate.execute {
            block()                                // [2] 비즈니스
            processedEventRepo.save(eventId, consumerGroup)  // [3] 마킹
        }   // [2] + [3] atomic
        return true
    }
}
```

```kotlin
// inventory consumer 사용
@KafkaListener(...)
fun onOrderCompleted(record: ConsumerRecord<String, String>) {
    val event = parse(record.value())
    idempotentHandler.process(event.eventId, "inventory-service") {
        for (item in event.items) reserveStockUseCase.execute(...)
    }
}
```

**왜 4순위**:
- 진정한 atomic 멱등성 (현재 구조의 race 제거)
- 4 서비스 코드 중복 제거
- ADR-0012 의 4번 항목 (common 모듈 IdempotentEventHandler 유틸리티) 의 실현
- quant 패턴 검증된 형태

**ADR 필요** — ADR-0012 보강 (common 모듈 인터페이스 + processed_event 복합키 표준화).

**영향**: 4개 서비스 consumer + common 모듈. 기존 processed_event 테이블 스키마 변경 가능 (consumer_group 추가).

## 중기 (ADR 필요)

### 9. analytics Streams EOS 도입

**현재** — `processing.guarantee` 미설정 (default at_least_once).

**개선**:
```kotlin
StreamsConfig.PROCESSING_GUARANTEE_CONFIG to "exactly_once_v2"
```

**효과**:
- analytics.score.updated 토픽 출력이 정확히 1회
- input → state store → output 트랜잭션 자동
- changelog 도 트랜잭션

**주의**:
- Streams 의 외부 write (Redis cacheProductScore, ClickHouse productScoreRepository.save) 는 **여전히 외부 IO** → EOS 보장 외. 멱등 설계 별도 필요 (현재는 windowedKey 기반 자연 멱등 — OK).
- transactional broker 설정 필요 (msa 프로덕션은 이미 RF=3, min.ISR=2 갖춤).
- throughput 약간 ↓ (트랜잭션 오버헤드, 보통 10-30%).

**ADR**: 마이너 (운영 모드 명시).

### 11. rack-awareness 도입

**전제**: msa 프로덕션이 multi-AZ 배포.

**개선**:
```yaml
# Strimzi Kafka spec
spec:
  kafka:
    rack:
      topologyKey: topology.kubernetes.io/zone
```

```kotlin
// Consumer
ConsumerConfig.CLIENT_RACK_CONFIG to System.getenv("AWS_REGION") + "-" +
    System.getenv("AVAILABILITY_ZONE")
```

**효과**:
- replica 가 AZ 분산 (AZ 1 장애 시 partition 잃지 않음)
- KIP-881: consumer 가 같은 AZ follower 에서 fetch → cross-AZ 트래픽 비용 ↓

**ADR**: AZ 토폴로지 + 비용 분석 + 안정성 트레이드오프.

## 장기 (L3 변경)

### 10. Schema Registry 도입

**현재** — JSON 페이로드, 호환성 직접 관리. 스키마 변경 시 producer/consumer 양쪽 동시 배포 필요. 변경 실수 시 deserialize 폭주.

**개선** — Confluent Schema Registry / Apicurio + Avro:
- Producer: `register schema → schema id` → record 에 id 만 포함
- Consumer: id 로 fetch → cache → deserialize
- `BACKWARD` / `FORWARD` / `FULL` 호환성 모드 강제

**효과**:
- 스키마 변경 안정성 ↑
- 메시지 크기 ↓ (Avro binary, 보통 2-5x)
- consumer-driven contract 관점 자연스러움

**비용**:
- 인프라 추가 (Schema Registry HA 운영)
- Avro 학습 / 코드 생성 도구 (gradle plugin)
- 마이그레이션 (기존 JSON 토픽들과 병존 기간)
- common 모듈에 Avro 도구 추가

**ADR (L3)** — 도입 결정 + 마이그레이션 전략 + 호환성 정책.

### 12. Tiered Storage

**Kafka 3.6+** 부터 GA. analytics 토픽 (30d retention) 같은 long-retention 토픽 후보.

**효과**:
- 로컬 디스크 비용 ↓ (S3 가 GB 당 훨씬 저렴)
- retention 무한대로 늘릴 수 있음 (영구 보관)
- 평소 hot 데이터만 로컬, 옛 데이터는 외부 — 컨슈머 투명

**비용**:
- S3 / GCS 인프라 + IAM
- broker plugin 설정 (Strimzi 지원 검증 필요)
- 옛 데이터 fetch 시 latency ↑ (S3 access)

**ADR** — Tiered Storage 도입 시점 + 토픽 선정 + 비용 모델.

## 우선순위 매트릭스

```
영향도 ↑
  │
  │  [10] Schema Registry              [11] rack-awareness
  │      (L3, 장기)                       (ADR, 비용 분석)
  │
  │  [4] IdempotentHandler              [9] analytics EOS
  │      (ADR-0012 보강, 즉시)             (마이너 ADR, 중기)
  │
  │  [12] Tiered Storage
  │      (ADR, 장기)
  │
  │  [1] DLQ 클래스 분리                 [2] CooperativeSticky
  │      (즉시, ADR 불필요)                (즉시, ADR 불필요)
  │
  │  [3] group.instance.id              [5] compression.type=lz4
  │      (즉시)                           (즉시)
  │
  │  [6] linger.ms 튜닝                 [7] DLT KafkaTopic CRD
  │      (관찰 후)                        (편의)
  │
  └────────────────────────────────────────────►  우선순위
```

## 관련 다음 학습 제안

- **8번 (분산 트랜잭션 + 사가 패턴)** — Outbox / 멱등 컨슈머 / processed_event 와 자연스럽게 연결.
- **9번 (Observability 심화)** — Kafka 메트릭 / Burrow / Cruise Control 등 운영 도구.
- 또는 신규 주제: **Kafka Streams 심화 + Iceberg 통합** — analytics 의 발전 경로.

## 체크리스트 (학습 후 즉시 가능한 것)

- [ ] common 모듈에 `KafkaConsumerErrorHandlerConfiguration` 이전 → inventory/order/fulfillment 가 import 만
- [ ] 모든 KafkaConfig 에 `partition.assignment.strategy=CooperativeStickyAssignor` 추가
- [ ] Deployment yml 에 `KAFKA_GROUP_INSTANCE_ID` 환경변수 + KafkaConfig 에서 읽기
- [ ] 모든 Producer 설정에 `compression.type=lz4` 추가
- [ ] inventory/order 의 KafkaListener 를 `IdempotentEventHandler` 헬퍼로 리팩터링 (ADR-0012 보강 후)
- [ ] DLT 토픽 13개를 `kafka-topics.yaml` 에 명시적 KafkaTopic CRD 로 추가
- [ ] analytics KafkaStreamsConfig 에 `processing.guarantee=exactly_once_v2` 추가 + 테스트

## 결론

msa 의 Kafka 사용은 **표준이 잘 잡혀있고 일관성도 좋다**. ADR-0012 (멱등 컨슈머) + ADR-0015 (DLQ + Resilience) 가 코드와 부합한다. 개선 후보는 대부분 **운영 안정성** (rebalance 부담 ↓, atomic 멱등) 또는 **비용 최적화** (rack-aware, compression) 영역. 즉시 가치 있는 것 (1, 2, 3) 은 코드 변경 작고 ADR 불필요 — 다음 sprint 후보.
