# Idempotent Consumer 사용 규칙

> **출처**: ADR-0012 (원안) + ADR-0029 (헬퍼 추출 + PK 표준화 + Policy A + 7일 retention) 의 운영 가이드.
> **연계**: ADR-0020 (`@Transactional` 사용 규칙), ADR-0015 (Resilience), `docs/conventions/transactional-usage.md`.

본 문서는 Kafka consumer 의 멱등 처리를 작성/리뷰할 때 참조하는 단일 표준이다. 결정의 배경/근거는
ADR-0012 / ADR-0029 본문을 참조하고, 본 문서는 "어떻게 쓰느냐" 와 "안 지키면 어떻게 깨지느냐" 만 다룬다.

---

## 1. 헬퍼 사용 의무

모든 consumer 멱등 처리는 common 의 [`IdempotentEventHandler`](../../common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventHandler.kt) 를 통해 위임한다.

- 신규 in-place dedup (직접 `existsBy / save` / 자체 헬퍼 작성) 은 금지한다 — ADR-0029 §3 Policy A 의
  race 흡수 / 메트릭 / cleanup 표준이 깨진다.
- 서비스별 자체 헬퍼는 모두 제거됐다 (quant 의 자체 `IdempotentEventConsumer` 는 ADR-0029 PR-10
  에서 삭제). 신규 서비스가 같은 패턴을 다시 짜는 일이 없도록 본 헬퍼만 사용한다.

```kotlin
@KafkaListener(
    topics = ["..."],
    groupId = CONSUMER_GROUP,
    containerFactory = "kafkaListenerContainerFactory",
)
fun onSomeEvent(record: ConsumerRecord<String, String>) {
    val event = objectMapper.readValue(record.value(), SomeEvent::class.java)
    val eventUuid = parseEventId(event.eventId)
    if (eventUuid == null) {
        log.warn("missing eventId topic={} — graceful degrade, executing without dedup", record.topic())
        idempotentMetrics.missingId(CONSUMER_GROUP)
        handle(event)
        return
    }
    idempotentEventHandler.process(eventUuid, CONSUMER_GROUP) {
        handle(event)
    }
}
```

### 1.1 헬퍼가 책임지는 것

- `(eventId, consumerGroup)` 단위 lookup → 이미 처리된 메시지면 [`Outcome.SKIPPED`](../../common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventHandler.kt) 반환.
- 마킹 INSERT 단독 트랜잭션 (`TransactionTemplate`) — 비즈니스 처리(`block`)와 분리된 짧은 TX.
- PK 충돌 (`DataIntegrityViolationException`) 흡수 → [`Outcome.RACE`](../../common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventHandler.kt) 반환. 멀티 인스턴스 동시 INSERT 시 한 인스턴스만 마킹.
- `kgd_idempotent_processed_total{consumer_group, result}` 메트릭 노출.

### 1.2 헬퍼가 책임지지 않는 것

다음 4가지는 **호출자 책임** 이다.

1. `block()` 의 자연 멱등 — §2 참고.
2. `eventId` 누락 / 형식 오류 — §3 참고.
3. consumer_group 명명 — §4 참고.
4. retention 활성화 — §5 참고.

---

## 2. 자연 멱등 보장 의무 (Policy A)

ADR-0029 §3 Policy A: 비즈니스 처리(`block`)와 마킹 INSERT 는 **별도 트랜잭션** 이다. 따라서 같은
이벤트가 두 인스턴스에 동시에 도달하면 둘 다 `existsBy=false` → `block()` 1회씩 (총 2회) 실행될 수 있다.
이때 데이터 안전성을 책임지는 것은 헬퍼가 아니라 `block()` 의 자연 멱등성이다.

### 2.1 자연 멱등 패턴 (권장 순)

| 패턴 | 적용 사례 | 비고 |
|---|---|---|
| 상태 전이 필터 | `ConfirmStockByOrderUseCase` / `ReleaseStockByOrderUseCase` (ACTIVE → CONFIRMED/RELEASED) | 두 번째 호출은 `findByStatus(ACTIVE)` 가 빈 결과 → no-op |
| pre-check 재사용 | inventory `ReserveStockUseCase` (ADR-0029 PR-8a — `findActiveByOrderIdAndProductId` 발견 시 기존 결과 반환) | 같은 (orderId, productId) 의 ACTIVE Reservation 이 있으면 새 차감 없이 idempotent return |
| Idempotent assignment | product `SyncProductStockUseCase` (`availableQty` 절대값 set) | 몇 번 호출해도 결과 동일 |
| DB UNIQUE 제약 | (현재 미사용) | 도메인 의도가 같은 (key) 단일 row 강제 가능할 때 |

### 2.2 자연 멱등 실패 사례 — 안 지키면 어떻게 깨지나

ADR-0029 PR-8 직후 `onOrderCompleted` 는 임시로 in-place dedup 을 유지했다 (`InventoryEventConsumer`).
이유: `ReserveStockUseCase` 가 같은 `(orderId, productId)` 로 두 번 호출되면 매번 새 `Reservation` 을
생성하고 `inventory.reserve(qty)` 를 두 번 deduct → 이중 차감 risk. 헬퍼의 race 흡수와 별개 문제.

PR-8a 에서 [`ReservationRepositoryPort.findActiveByOrderIdAndProductId`](../../inventory/app/src/main/kotlin/com/kgd/inventory/application/inventory/port/ReservationRepositoryPort.kt) 추가 →
[`InventoryService.execute(ReserveStockUseCase.Command)`](../../inventory/app/src/main/kotlin/com/kgd/inventory/application/inventory/service/InventoryService.kt) 가 ACTIVE Reservation 발견 시 신규 차감 없이 기존 결과 반환하도록 보강했고,
그 후 PR-10 에서 헬퍼 이관을 완료했다.

**규칙**: helper 적용 전, 항상 "block 이 두 번 호출되면 어떻게 되나?" 를 PR 본문에 명시한다.
자연 멱등이 보장 안 되면 **helper 이관 보류 + 보강 PR 분리** 가 원칙이다.

### 2.3 호출자 트랜잭션 경계 (ADR-0020)

- `block()` 안의 비즈니스 처리는 호출자가 트랜잭션 경계를 결정한다 (`@Transactional` 또는 `TransactionTemplate`).
- 헬퍼는 클래스 레벨 `@Transactional` 을 선언하지 않는다 — 외부 IO 가 들어와도 호출자 트랜잭션이 길어지지 않도록.
- 여러 외부 IO 가 섞인 흐름은 `{Entity}TransactionalService` 분리 패턴을 따른다 (`docs/conventions/code-convention.md` §6).

---

## 3. eventId 누락 정책 — graceful degrade

ADR-0029 §4: 정상 publisher 는 모든 메시지에 `eventId: String (UUID)` 를 부여한다. 그러나 외부 시스템 /
테스트 픽스처 / 레거시 publisher 가 누락한 메시지가 도착할 가능성이 있어, consumer 는 즉시 reject 하지
않고 다음 fallback 을 따른다.

### 3.1 표준 흐름

```kotlin
val eventUuid = parseEventId(rawEventId)
if (eventUuid == null) {
    log.warn("missing eventId topic={} — graceful degrade, executing without dedup", record.topic())
    idempotentMetrics.missingId(CONSUMER_GROUP)
    handle(event)   // dedup 없이 비즈니스 로직 1회 수행 — 자연 멱등으로 안전
    return
}
idempotentEventHandler.process(eventUuid, CONSUMER_GROUP) { handle(event) }
```

- WARN 로그: `topic=` + `raw=` (raw 값은 PII 없음 보장 시) 만 남긴다. payload 전체는 절대 로그하지 않는다.
- 메트릭: [`IdempotentMetrics.missingId(consumerGroup)`](../../common/src/main/kotlin/com/kgd/common/messaging/IdempotentMetrics.kt) — 비율을 dashboard 에서 추적.
- dedup 없이 `block()` 1회 실행. **§2 의 자연 멱등 보장이 전제** 다.

### 3.2 `parseEventId` 표준 형태

```kotlin
private fun parseEventId(raw: String?): UUID? = try {
    raw?.takeIf { it.isNotBlank() }?.let(UUID::fromString)
} catch (e: IllegalArgumentException) {
    log.warn("Invalid eventId format, falling back to graceful degrade: raw={}", raw)
    null
}
```

각 consumer 가 동일한 형태를 private 함수로 가진다. 향후 누락 빈도가 0 으로 안정되면 별도 PR 에서
helper util 로 통합하거나 fail-fast (`error("eventId required")`) 로 전환한다 — ADR-0029 §Rollout
PR-10 후속 후보.

### 3.3 알람 정책

- `kgd_idempotent_event_missing_id_total` 비율 > 1% 5분 연속 → WARN (publisher 누락 의심).
- 0 이 1개월 이상 유지되면 graceful degrade 분기 제거 PR 검토 (ADR-0029 §Rollout PR-10 잔존 작업).

---

## 4. consumer_group 명명 규약

ADR-0029 §6.2: 모든 consumer 는 `{service}-service` 형태의 group id 를 명시한다.

| 서비스 | group id | 컨슈머 |
|---|---|---|
| inventory | `inventory-service` | `InventoryEventConsumer` (4 핸들러) |
| order | `order-service` | `OrderEventConsumer.onReservationExpired` |
| fulfillment | `fulfillment-service` | `FulfillmentEventConsumer.onStockReserved` |
| product (stock cache) | `product-stock-sync` | `InventoryStockSyncConsumer` |
| quant | `quant-{purpose}` (e.g. `quant-notification`) | (Phase 3 외부 통합 시 본격 도입) |

### 4.1 규칙

- group id 는 `@KafkaListener.groupId` 와 `idempotentHandler.process(_, consumerGroup)` 의 인자가
  **반드시 일치** 해야 한다. 불일치 시 fan-out 시 dedup 이 의도와 다르게 깨진다.
- 한 서비스 안에서 여러 fan-out 그룹이 필요한 경우 `{service}-{purpose}` 형태로 한다 (`product-stock-sync` 처럼).
  단순 `{service}-service` 단일 그룹이 가능하면 그쪽을 우선한다.
- group id 는 `companion object` 의 `private const val CONSUMER_GROUP` 으로 단일화한다 — 매직 스트링 금지.

### 4.2 group id 변경

운영 중 group id 를 변경하면 Kafka offset 이 초기화돼 모든 메시지가 재처리된다. processed_event 는
group id 단위로 dedup 하므로 새 group id 에서는 **다 새로** 처리된다. 변경 시:

1. 사전에 새 group id 의 dedup 부담을 견딜 수 있는지 확인 (자연 멱등 보장).
2. Kafka rebalance 영향 (lag spike) 을 운영 윈도우에 맞춤.
3. 가급적 변경하지 말 것 — 변경 자체가 큰 운영 risk.

---

## 5. 메트릭 표준 + retention 활성화

### 5.1 노출되는 메트릭

| 메트릭 | 라벨 | 의미 |
|---|---|---|
| `kgd_idempotent_processed_total` | `consumer_group`, `result` (`processed`/`skipped`/`race`/`error`) | 헬퍼 호출 결과 분포 |
| `kgd_idempotent_event_missing_id_total` | `consumer_group` | eventId 누락 (graceful degrade) 빈도 |
| `kgd_idempotent_cleanup_*` | `consumer_group` (PR-11 옵션) | retention cleanup 결과 |

### 5.2 retention 활성화 (`kgd.common.messaging.idempotent.cleanup.*`)

- 7일 retention 스케줄러는 default 비활성. 서비스가 명시적으로 opt-in 한다.
- 활성 위치: `application-kubernetes.yml` (또는 active profile).

```yaml
kgd:
  common:
    messaging:
      idempotent:
        cleanup:
          enabled: true
          retention: P7D       # ISO-8601 Duration. default 7d
          # cron 시간을 서비스별로 분산하여 DB 부하 spike 회피
          cron: "0 30 3 * * *" # 03:30 KST (default)
```

서비스별 cron 권장 분산:
- inventory: `0 30 3 * * *`
- order: `0 0 3 * * *`
- fulfillment: `0 15 3 * * *`
- product: `0 45 3 * * *`
- quant: `0 0 4 * * *`

### 5.3 retention 안 걸면 어떻게 되나

`processed_event` 행 수가 무한 증가 → PK index 비대 → existsBy / mark 의 latency 증가 →
컨슈머 lag. 운영 환경은 반드시 활성화한다. 로컬 / 단위 테스트는 불필요.

---

## 6. 구현 체크리스트

신규 consumer 작성 시:

- [ ] `@KafkaListener.groupId` = `companion object CONSUMER_GROUP` = `idempotentHandler.process(_, CONSUMER_GROUP)` 가 일치.
- [ ] `block()` 의 자연 멱등 시나리오를 PR 본문에 명시 ("block 이 두 번 실행되면 ___ 가 보장한다").
- [ ] eventId 누락 graceful degrade 분기 (`parseEventId` + `IdempotentMetrics.missingId`).
- [ ] 단위 테스트: 신규 처리 / 멱등 skip / eventId 누락 graceful degrade — 최소 3 케이스.
- [ ] 통합 테스트 (Testcontainers): 같은 eventId 메시지 중복 발행 → 비즈니스 결과 1회.
- [ ] application yml 에 retention 활성화 (운영 profile 한정).
- [ ] Grafana dashboard 의 consumer_group 라벨에 신규 컨슈머 추가됐는지 확인.

리뷰 시 거부 사유:

- 자체 dedup 코드 (helper 우회) → 거부.
- group id 매직 스트링 (companion object 미사용) → 거부.
- block 자연 멱등 미명시 → PR 본문 보강 요청.
- eventId 누락 시 비즈니스 로직 미실행 (조용한 message drop) → 거부 — 메시지가 사라진다.

---

## 7. 관련 문서

- ADR-0012 — 멱등 컨슈머 패턴 원안 (Refinement 참조).
- [ADR-0029 — Idempotent Consumer Helper](../adr/ADR-0029-idempotent-consumer-helper.md) — 본 가이드의 결정 source.
- [ADR-0015 — Resilience Strategy](../adr/ADR-0015-resilience-strategy.md) — DLQ / ErrorHandler 전략. eventId 누락 fail-fast 전환 시 영향.
- [ADR-0020 → docs/conventions/transactional-usage.md](transactional-usage.md) — `@Transactional` 사용 규칙.
- [ADR-0024 — Quant Service](../adr/ADR-0024-quant-service.md) — 자체 헬퍼 → common 이전 사례.
- [ADR-0032 — Order Outbox Cancellation](../adr/ADR-0032-order-outbox-cancellation.md) — `onOrderCancelled` consumer 의 helper 이관 사례.
- `common/src/main/kotlin/com/kgd/common/messaging/` — 헬퍼 / Port / Cleanup / Metrics 구현.
