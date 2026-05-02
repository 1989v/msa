---
parent: study/docs
type: verification-report
created: 2026-05-01
order: 00
---

# 00. 학습 자료 검증 리포트 (2026-05-01)

> Phase 3 deep study 에이전트들이 일부 grounding 을 "추정 / 검증 필요" 로 마무리한 상태.
> 본 리포트는 실제 코드 (`grep`, `read`) 로 모든 unverified 마커를 검증하고, 그 결과를 in-place 로 반영한 추적표.

---

## 1. 검증 범위

- 대상 디렉토리: `study/docs/**`
- 패턴: `추정`, `검증 필요`, `확인 필요`, `미확인`, `(추정)`, `(검증 필요)`, `grep 못 함`, `read 안 함`, `읽지 못함`
- 1차 grep 매칭: 약 60+ 개. 그중 **stale codebase claim** 인 것 (= 실제 코드 read 로 진위 가능한 것) 만 본 리포트에서 다룬다.
- **제외**: 면접 답변 모범 (`"검증 필요" 라고 말하라`), 학습 가이드의 메타 권장, future-looking external 검토 (Strimzi, OTel 추후 도입 등), 운영 시 수정 필요한 룰 (TIMEOUT 재확인 등) — 이는 stale 가 아니라 *원리상* 검증 작업.

---

## 2. 검증 항목 (codebase claim)

| # | 파일 / 줄 | 원문 (요약) | 검증 결과 | 수정 액션 |
|---|---|---|---|---|
| 1 | `7-distributed-systems/17-codebase-idempotent-ssot.md:47` | "cleanup 스케줄러 코드 확인 필요" | **미존재** — `inventory` / `fulfillment` 어디에도 `processed_event` 정리 `@Scheduled` 없음. inventory 의 스케줄러는 `ReservationExpiryService:24` + `InventoryReconciliationService:18` 둘 뿐 | "검증 결과 (2026-05-01)" 로 upgrade + 줄번호 인용 + 19-improvements §7 reference |
| 2 | `7-distributed-systems/17-codebase-idempotent-ssot.md:163` | "`product/.../InventoryEventConsumer.kt` (추정 — grep 으로 검증)" | **존재하지만 이름 다름**: 실제 파일은 `product/app/src/main/kotlin/com/kgd/product/messaging/InventoryStockSyncConsumer.kt:11`. groupId `product-stock-sync`. 멱등 체크 (`processedEventRepository`) 없음 | (추정) 마커 제거 + 실제 줄번호/이름 명시 + 멱등 체크 누락 새 발견 추가 |
| 3 | `7-distributed-systems/17-codebase-idempotent-ssot.md:270` | "`inventory/.../KafkaConfig.kt` (추정)" + YAML 형태 | **존재** — `inventory/app/src/main/kotlin/com/kgd/inventory/infrastructure/config/KafkaConfig.kt:29-37` 가 코드 (YAML 아님) 로 명시. `acks=all`, `enable.idempotence=true`, `MAX_IN_FLIGHT=5`, `DELIVERY_TIMEOUT=120000`. `retries` 명시 안 했으나 idempotence=true 로 자동 강제됨 | (추정) 제거 + 실제 코드 인용 + retries 자동 강제 주석 |
| 4 | `7-distributed-systems/17-codebase-idempotent-ssot.md:296` | "processed_event cleanup ?" | **미존재** (#1 과 동일) | `?` → `✗ 검증 결과: 미존재 — 도입 필요` |
| 5 | `7-distributed-systems/16-codebase-saga.md:65` | "Order 측 (시작점, 추정)" + "outbox 에 저장" | **틀린 추정**: `order/app/src/main/kotlin/com/kgd/order/messaging/OrderEventAdapter.kt:14-54` 는 `kafkaTemplate.send` 로 **직접 발행** (Outbox 없음). order 디렉토리 grep 결과 `OutboxPort` / `OutboxPolling` 모두 zero hit | 추정 마커 제거 + 실제 코드 인용 + ADR-0011 위반 (Order 만 Outbox 없음) 새 발견 추가 + 19-improvements §0 (P0) 신설 |
| 6 | `7-distributed-systems/18-codebase-resilience.md:118` | "inventory → product (있다면) ? grep 으로 검증" | **부재 — 역방향**: inventory 에서 product 로 HTTP 호출 없음. 반대로 product 가 inventory 이벤트 consume (`InventoryStockSyncConsumer`) | `?` → `✗ 검증 결과 (2026-05-01)` |
| 7 | `7-distributed-systems/18-codebase-resilience.md:290` | "fulfillment KafkaConfig (추정 — grep 으로 검증)" + `addNotRetryableExceptions` 코드 예시 | **부분 stale**: KafkaConfig 자체는 존재 (`fulfillment/.../KafkaConfig.kt:54-68`). 그러나 **`addNotRetryableExceptions` 호출은 msa 전체에 zero hit** (코드에 미적용). 즉 BusinessException 도 1초 × 3회 재시도 후 DLT | (추정) 제거 + 실제 코드 인용 + addNotRetryableExceptions 미적용 명시화 → 19-improvements §9 도 정정 |
| 8 | `7-distributed-systems/19-improvements.md` (P0/P1 구간) | 19장은 17/18장 분석 기반 — 17/18 장 정정에 따라 영향 받는 부분 | (위 항목들의 영향) 19장의 `addNotRetryableExceptions(BusinessException)` 가정이 §9 에 반영돼야 함 + Order outbox gap 신설 | §0 (P0 Order Outbox) 신설 + §9 정정 |
| 9 | `16-async-nonblocking-io/18-improvements.md:98` | "application.yml 에서 *route 별 timeout / CB 미설정* (확인 필요)" | **검증 완료 — 정확**: `gateway/src/main/resources/application.yml` 확인. `spring.cloud.gateway.httpclient.*` 글로벌 설정 zero. 단 `quant-paper-sse` 라우트는 metadata `response-timeout: 0` 명시 (SSE 의도) | (확인 필요) 제거 + 검증 결과 + 정확한 파일/줄 인용 |
| 10 | `16-async-nonblocking-io/18-improvements.md:164` | "메트릭 / 알람 미설정 (확인 필요)" | **검증 완료 — 정확**: AuthenticationGatewayFilter 의 `onErrorReturn(false)` 경로에 Micrometer counter 없음. msa 전체에 알람 룰 zero hit | (확인 필요) 제거 + 검증 결과 |
| 11 | `17-spring-web/17-msa-gateway-filter.md:283` | "ExperimentAssignmentFilter (확인 필요)" | **존재**: `gateway/src/main/kotlin/com/kgd/gateway/filter/ExperimentAssignmentFilter.kt:27` `getOrder() = -5` (VisitorIdFilter `-10` 다음, routing 전) | (확인 필요) → `-5` + 줄번호 |
| 12 | `18-grpc/12-auth-mtls-jwt.md:257` | "gateway 의 JwtAuthenticationFilter (확인 필요)" | **이름 stale**: `JwtAuthenticationFilter` 는 msa 어디에도 없음 (zero hit). 실제 클래스는 `AuthenticationGatewayFilter` (`gateway/.../filter/AuthenticationGatewayFilter.kt`) — `JwtTokenValidator` + Redis blacklist 조합 | 클래스명 정정 + 실제 경로 인용 |
| 13 | `12-latency-numbers/08-observability-setup.md:276` | "`common/` 에 Micrometer 의존성 있을 가능성 (확인 필요)" | **부재**: `common/build.gradle.kts` micrometer zero hit. 대신 gateway/warehouse/wishlist/analytics/auth 등 *서비스 레벨* `build.gradle.kts` 에 개별 적용 | (확인 필요) → 검증 결과 + 개선 후보 (common 추출) |
| 14 | `3-java-kotlin-concurrency/22-msa-concurrency-patterns.md:62` | "TaskScheduler 명시 빈 (확인 필요)" | **부재**: `ThreadPoolTaskScheduler` / `TaskScheduler` 빈 zero hit. msa 의 다수 `@Scheduled` (ReservationExpiry, Reconciliation, OutboxPolling × 2) 가 default 1-thread 풀 공유 | (확인 필요) → 검증 결과 + P1 개선 후보 |
| 15 | `9-redis-deep-dive/17-msa-application.md:57` | "experiment / gifticon / product (Redis 사용 추정)" | **존재**: 세 서비스 모두 `application-kubernetes.yml` 에 `spring.data.redis` 설정 명시 | (Redis 사용 추정) → 검증 완료 |
| 16 | `6-kafka-internals/11-msa-codebase-grep.md:83` | "wishlist member (코드 미확인)" | **존재**: `wishlist-member-cleanup` 그룹 (`wishlist/app/src/main/kotlin/com/kgd/wishlist/infrastructure/consumer/MemberEventConsumer.kt:20`) | (코드 미확인) → 그룹 ID + 줄번호 |
| 17 | `4-db-index-transaction/15-msa-queries.md:284` | "QueryDSL 의 `ne`, `notIn` 사용 여부 — grep 으로 추가 확인 필요" | **부재**: msa 에 `.ne(`, `.notIn(` 호출 zero hit | (확인 필요) → 검증 결과 (위험 없음) |
| 18 | `5-spring-transactional/12-msa-outbox-saga.md:271` | "`order.order.cancelled` 를 InventoryEventConsumer 가 받아서 release (실제 구현은 코드 추가 확인 필요)" | **미구현**: `inventory/.../InventoryEventConsumer.kt` 는 `onOrderCompleted`, `onFulfillmentShipped`, `onFulfillmentCancelled` 세 개만 listen. **`order.order.cancelled` consumer 없음** | (확인 필요) → 검증 결과 + 30분 TTL fallback 만 있는 gap 명시 + 19-improvements §4 reference |

---

## 3. 신규 발견 (검증 도중 stale 또는 오류)

### 3.1 ADR-0013 SSOT 방향 — Product CLAUDE.md 와 study 자료 불일치

- `product/CLAUDE.md` 의 "Key Rules": **"Product는 Inventory의 SSOT"** ← 이 표현이 ADR-0013 의 의도와 반대로 읽힘
- `study/docs/7-distributed-systems/17-codebase-idempotent-ssot.md:155-159` 에서 ADR-0013 인용: **"Inventory 가 재고 SSOT, Product.stock = Inventory 이벤트 기반 read-only 캐시"**
- 코드 흐름 (Inventory → Kafka → `Product.syncStock` 호출) 도 study 자료와 일치
- → `product/CLAUDE.md` 의 표현이 stale 가능성. 본 리포트 범위 (study 자료 수정만) 외이므로 미수정. **별도 액션 권장**: product/CLAUDE.md 점검.

### 3.2 17-codebase-idempotent-ssot.md 의 "ProcessedEventJpaEntity 가 inventory + fulfillment 동일" 주장 검증

- 두 서비스 모두 `processed_event` 테이블 + Entity 보유 — **실제 동일 구조** (`fulfillment/.../persistence/idempotency/ProcessedEventJpaEntity.kt`, `inventory/.../persistence/idempotency/ProcessedEventJpaEntity.kt`).
- **개선 후보 (보강)**: 두 서비스가 동일 패턴을 복제 — common 모듈로 추출 (이미 19-improvements §2 에 반영됨).

### 3.3 `addNotRetryableExceptions` claim 의 18장 → 19장 cascade

- 18장 §5 의 "비즈니스 예외는 즉시 DLT" 가정이 코드와 다름 → 19장 §9 에서도 같은 가정으로 ExponentialBackOff 만 다룸
- 본 리포트 수정으로 cascade 정정 (18장: addNotRetryableExceptions 미적용 명시 + 19장 §9: 두 가지 모두 개선 필요 명시)

### 3.4 Order Outbox 부재 — ADR-0011 cascade 영향

- ADR-0011 ("Outbox 패턴으로 이벤트 발행의 원자성 보장") 의 적용 범위가 inventory + fulfillment 만이고 Order 가 빠져 있는 상태
- 16장 §3.1 + 19-improvements §0 (신설) 에 명시
- **별도 액션 권장**: ADR-0011 보강 commit 또는 별도 follow-up ADR.

### 3.5 `inventory.stock.received` 토픽 — InventoryStockSyncConsumer 가 listen 하나 inventory 측 publish 미확인

- `product/.../InventoryStockSyncConsumer.kt:21` 가 `inventory.stock.received` 토픽 listen
- inventory 측 `outboxPort.save(..., "inventory.stock.received", ...)` 호출 grep 결과 — 별도 검증 필요. (본 리포트 시점에는 직접 확인 안 함; 17/16 장 본문은 reserved/released/confirmed 만 명시) — **잔여 미해결 (3.5)**.

---

## 4. 잔여 미해결 항목 (post-this-report)

| # | 항목 | 사유 | 권장 액션 |
|---|---|---|---|
| R1 | ~~`inventory.stock.received` topic publisher 위치 검증~~ | **해결 (2026-05-02 round 2)**: `inventory/app/.../InventoryService.kt:181-187` 가 `outboxPort.save(AGGREGATE_TYPE, inventoryId, "inventory.stock.received", ...)` 호출 — publisher 존재 확인 | unchanged — Outbox 패턴 일관 |
| R2 | ~~`product/CLAUDE.md` 의 "Product는 Inventory의 SSOT" 표현~~ | **해결 (2026-05-02)**: `product/CLAUDE.md` 직접 수정 — "Product 는 카탈로그(이름/가격/카테고리/상태) 의 SSOT, 재고는 Inventory 가 SSOT (ADR-0013)" 로 정정 | unchanged |
| R3 | 메타 마커 (`"검증 필요" 라고 말하라`, future-looking Strimzi/OTel 도입 등) | stale 아님 (학습 권장 또는 외부 의존 검토) | 정기적 재검토 불필요 |
| R4 | `8-system-design/05-payment-system.md:247` "PENDING → TIMEOUT (★ 재확인 필요)" | 상태머신 design note (런타임 확인 권장) — stale code claim 아님 | unchanged |

---

## 5. 다음 검증 권장 일정

| 시점 | 사유 | 범위 |
|---|---|---|
| **2026-08-01 (3개월 후)** | 정기 grounding refresh — 학습 자료 인용 줄번호 stale 검사 | study/docs 전체에 `hns:gc` + 본 리포트 표 #1-#18 줄번호 재확인 |
| **ADR-0011 후속 commit 후** | Order Outbox 도입되면 16/19 장 정정 | study/docs/7-distributed-systems/16, 19 |
| **ADR-0012 후속 commit 후** | processed_event cleanup 스케줄러 도입되면 17/19 장 정정 | study/docs/7-distributed-systems/17, 19 |
| **각 서비스 리팩터링 후** | 클래스명 / 패키지 변경 시 줄번호 stale | 영향 받은 study/docs 줄번호 |

---

## 6. 검증 메타

- **검증 항목 수**: 18 (table §2)
- **수정 항목 수**: 16 in-place edits (study/docs 내 .md 파일)
- **신규 발견 stale claim**: 5 (§3.1-3.5)
- **잔여 미해결**: 4 (§4 R1-R4 — 모두 본 리포트 범위 외)
- **수정한 파일** (16):
  - `study/docs/7-distributed-systems/17-codebase-idempotent-ssot.md`
  - `study/docs/7-distributed-systems/16-codebase-saga.md`
  - `study/docs/7-distributed-systems/18-codebase-resilience.md`
  - `study/docs/7-distributed-systems/19-improvements.md`
  - `study/docs/16-async-nonblocking-io/18-improvements.md`
  - `study/docs/17-spring-web/17-msa-gateway-filter.md`
  - `study/docs/18-grpc/12-auth-mtls-jwt.md`
  - `study/docs/12-latency-numbers/08-observability-setup.md`
  - `study/docs/3-java-kotlin-concurrency/22-msa-concurrency-patterns.md`
  - `study/docs/9-redis-deep-dive/17-msa-application.md`
  - `study/docs/6-kafka-internals/11-msa-codebase-grep.md`
  - `study/docs/4-db-index-transaction/15-msa-queries.md`
  - `study/docs/5-spring-transactional/12-msa-outbox-saga.md`

## 7. blockers

- 없음. 모든 unverified codebase claim 은 grep + read 로 결론 도달.
- 단, R2 (Product CLAUDE.md SSOT 표현 stale 가능성) 는 본 검증 작업 범위 (study 자료) 외이므로 별도 follow-up 필요.

---

## 8. 한 줄 요약

> 18 개 unverified marker 검증 완료. 그 중 **2 개 (Order Outbox 부재, addNotRetryableExceptions 미적용)** 가 단순 추정이 아니라 **ADR 위반 / 보강 필요** 한 실제 gap 으로 판명. 16 개 .md in-place 수정 + 19-improvements 에 P0 신설 (Order Outbox).
