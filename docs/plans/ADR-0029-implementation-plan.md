---
title: ADR-0029 Idempotent Consumer Helper — Implementation Plan
status: draft
created: 2026-05-02
owner: TBD
related-adr: ADR-0029, ADR-0012, ADR-0015, ADR-0019, ADR-0020, ADR-0024
total-prs: 8
total-sprints: 6 (~6 weeks)
critical-path: Phase 0 → Phase 2a (Flyway 도입) → Phase 2b (스키마 변경) → Phase 3
---

# ADR-0029 Implementation Plan — Idempotent Consumer Helper

> ADR-0029 (`docs/adr/ADR-0029-idempotent-consumer-helper.md`) 의 결정을 코드로 실현하기 위한 단계별 작업 분해.
> 본 plan 은 **코드 변경 없음** — 작업 목록과 acceptance criteria 정리.

---

## 1. Goal

### 1.1 Why this plan

ADR-0029 는 다음 4가지를 표준화한다.

1. `common.messaging.IdempotentEventHandler` 헬퍼 추출 (현재 4 서비스 in-place boilerplate 제거).
2. `processed_event` 테이블 PK 를 `(event_id, consumer_group)` 복합 + `BINARY(16)` 로 정규화 (fan-out 안전 + 저장 효율).
3. 비즈니스 처리(`block`)와 마킹 INSERT 의 트랜잭션 분리 정책 강제 (Policy A, ADR-0020 외부 IO 분리 준수).
4. `processed_event` 7일 retention 스케줄러 신설 (ADR-0012 §"Consequences" 보관 정책의 미실현 갭 — Verification Follow-up §1).

### 1.2 Non-Goals

- analytics Kafka Streams 의 `processing.guarantee=exactly_once_v2` 도입 → 별도 ADR (ADR-0029 §Consequences 후속 후보).
- `addNotRetryableExceptions` 의 ErrorHandler 보강 → ADR-0015 (Resilience Strategy) 의 별도 follow-up. ADR-0029 와는 직교(Verification Follow-up §3).
- search/analytics 의 자연 멱등 구간 — ADR-0029 §5 적용 제외 정책 그대로 유지.

### 1.3 Success Metric

- 4개 컨슈머(`InventoryEventConsumer`, `OrderEventConsumer`, `FulfillmentEventConsumer`, `IdempotentEventConsumer` (quant)) 가 `idempotentHandler.process(...)` 한 줄 호출로 통일.
- 추가로 `InventoryStockSyncConsumer` (Verification Follow-up §2 — 멱등 체크 미적용 컨슈머) 도 동일 패턴으로 신규 적용.
- `kgd_idempotent_processed_total{consumer_group, result}` Counter 메트릭 노출.
- `processed_event` 행 수가 7일 이내로 유지되는 retention 동작.

---

## 2. 현재 코드 baseline

> Plan 작성 시점(2026-05-02)의 실제 코드 상태. PR 작성 시 stale 여부 재확인 필요.

### 2.1 quant — 모범 사례 (마이그레이션 대상이지만 검증 후 in-place 교체)

| 항목 | 경로 / 줄 | 비고 |
|---|---|---|
| 헬퍼 | `quant/app/src/main/kotlin/com/kgd/quant/infrastructure/outbox/IdempotentEventConsumer.kt:48-93` | `(eventId, consumerGroup)` 복합 키, `TransactionTemplate` 단독 TX, `DataIntegrityViolationException` 흡수. ADR-0029 §3 Decision 의 모범 |
| 엔티티 | `quant/app/src/main/kotlin/com/kgd/quant/infrastructure/persistence/entity/ProcessedEventEntity.kt` | `@IdClass(ProcessedEventId::class)` + `BINARY(16)` UUID |
| Flyway | `quant/app/src/main/resources/db/migration/V001__init.sql:110-115` | 신규 표준 스키마와 이미 일치. 추가 마이그레이션 불필요 |
| 호출자 | (현재 호출 zero — Phase 2 outbox relay 만 도입됨) | 본 plan 의 Phase 1 에서 common 헬퍼로 교체 |

### 2.2 inventory — `InventoryEventConsumer` (3 핸들러, in-place)

| 항목 | 경로 / 줄 | 현 상태 |
|---|---|---|
| 컨슈머 | `inventory/app/src/main/kotlin/com/kgd/inventory/infrastructure/messaging/InventoryEventConsumer.kt:32-62` | `onOrderCompleted` — existsById 체크 외부, 비즈니스 별도 TX, save 별도 TX (race 노출) |
| 〃 | `:64-97` | `onFulfillmentShipped` — 동일 패턴 |
| 〃 | `:99-132` | `onFulfillmentCancelled` — 동일 패턴 |
| 엔티티 | `inventory/app/.../persistence/idempotency/ProcessedEventJpaEntity.kt:9-21` | `eventId VARCHAR(36) PRIMARY KEY`, `topic VARCHAR(100)`, `processedAt LocalDateTime` (ADR-0012 v0 스키마) |
| Flyway | **부재** — `application.yml:25` `ddl-auto: validate` 만, `db/migration/` 디렉토리 없음 | Phase 2a 에서 Flyway baseline 도입 필요 |

### 2.3 order — `OrderEventConsumer.onReservationExpired` (1 핸들러, in-place)

| 항목 | 경로 / 줄 | 현 상태 |
|---|---|---|
| 컨슈머 | `order/app/src/main/kotlin/com/kgd/order/messaging/OrderEventConsumer.kt:28-49` | `onReservationExpired` — `objectMapper.readTree` 로 eventId 파싱, in-place dedup |
| Flyway | `order/app/src/main/resources/db/migration/V1__create_orders_table.sql` 만 존재 | Flyway 사용 중. **단 `processed_event` 테이블은 Flyway script 에 없음** (ddl-auto 가 생성?) — Phase 2a 에서 명시적 Flyway script 추가 필요 |

### 2.4 fulfillment — `FulfillmentEventConsumer.onStockReserved` (1 핸들러, in-place)

| 항목 | 경로 / 줄 | 현 상태 |
|---|---|---|
| 컨슈머 | `fulfillment/app/src/main/kotlin/com/kgd/fulfillment/infrastructure/messaging/FulfillmentEventConsumer.kt:24-49` | 동일 in-place 패턴, `objectMapper.readTree` |
| 엔티티 | `fulfillment/app/.../persistence/idempotency/ProcessedEventJpaEntity.kt` | inventory 와 동일 ADR-0012 v0 스키마 |
| Flyway | **부재** — `application.yml:25` `ddl-auto: validate` | Phase 2a 에서 Flyway baseline 도입 필요 |

### 2.5 product — `InventoryStockSyncConsumer` (Verification Follow-up §2)

| 항목 | 경로 / 줄 | 현 상태 |
|---|---|---|
| 컨슈머 | `product/app/src/main/kotlin/com/kgd/product/infrastructure/messaging/InventoryStockSyncConsumer.kt:11-44` | groupId `product-stock-sync`, **멱등 체크 zero** — ADR-0012 결정의 예외 노출. ADR-0029 §5 의 적용 범위 표에는 누락돼 있었으나 Verification Follow-up §2 로 명시 추가됨 |
| 엔티티 | (없음) | Phase 2a 에서 product 측에도 `processed_event` 테이블 + 엔티티 신설 필요 |
| Flyway | `product/app/src/main/resources/db/migration/` 존재 — Flyway 사용 중 | 신규 Flyway script 만 추가 |

### 2.6 적용 제외 (변경 없음, ADR-0012 §5 정책 유지)

- `search/.../ProductIndexingConsumer` — ES doc id 자연 멱등.
- `analytics/...` Streams — windowedKey 자연 멱등.

### 2.7 baseline 요약 표

| 서비스 | 컨슈머 메서드 수 | Flyway | 멱등 적용 | 스키마 (현재) | 헬퍼 사용 |
|---|---|---|---|---|---|
| inventory | 3 | 없음 (도입 필요) | in-place | `eventId VARCHAR(36) PK + topic` | 없음 |
| order | 1 | 있음 (스크립트 1개) | in-place | 위와 동일 | 없음 |
| fulfillment | 1 | 없음 (도입 필요) | in-place | 위와 동일 | 없음 |
| product (StockSync) | 1 | 있음 | **미적용** (Verification gap) | 테이블 자체 없음 | 없음 |
| quant | 0 (Phase 2 outbox 만) | 있음 | in-place 헬퍼 (자체) | `(eventId, consumerGroup) BINARY(16) PK` | 자체 헬퍼 |

→ **총 6 컨슈머 메서드** + **3 서비스에 신규 Flyway baseline** + **1 서비스(product)에 신규 테이블** + **1 서비스(quant) 헬퍼 in-place 교체** + **common 헬퍼 신설**.

---

## 3. Phase 0 — common 헬퍼 + Port 출시 (0.5 sprint, ~3-4 days)

> **PR-1**. 코드 변경은 common 모듈 한정. 다른 서비스 영향 없음.

### 3.1 작업 목록 (TDD 순서: 테스트 first)

#### 3.1.1 신규 파일

- [ ] `common/src/test/kotlin/com/kgd/common/messaging/IdempotentEventHandlerSpec.kt` — Kotest BehaviorSpec (먼저 작성, RED)
- [ ] `common/src/main/kotlin/com/kgd/common/messaging/ProcessedEventRecord.kt` — DTO (JPA 의존성 0, plain data class)
- [ ] `common/src/main/kotlin/com/kgd/common/messaging/ProcessedEventRepositoryPort.kt` — Port interface
- [ ] `common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventHandler.kt` — `@Component` 헬퍼
- [ ] `common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventHandlerAutoConfiguration.kt` — `@AutoConfiguration` + `@ConditionalOnBean(ProcessedEventRepositoryPort::class)`
- [ ] `common/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` — 위 AutoConfig 등록 (기존 5개 항목 다음 줄)
- [ ] `common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventCleanupScheduler.kt` — `@Scheduled` cron retention (Verification Follow-up §1, 7일 보관 표준화)
- [ ] `common/src/main/kotlin/com/kgd/common/messaging/IdempotentEventCleanupProperties.kt` — `@ConfigurationProperties("kgd.common.messaging.idempotent.cleanup")`
- [ ] `common/src/main/kotlin/com/kgd/common/messaging/IdempotentMetrics.kt` — Micrometer Counter Bean (`kgd_idempotent_processed_total{consumer_group, result}`, `kgd_idempotent_event_missing_id_total{consumer_group}`)
- [ ] `common/CLAUDE.md` 업데이트 — messaging 패키지 섹션 신설 (idempotent 헬퍼/Port/스케줄러 책임 요약)

#### 3.1.2 build.gradle.kts 의존성 점검

- [ ] `common/build.gradle.kts` — 현재 `libs.spring.kafka` 이미 포함. `spring-boot-starter-data-jpa` 는 **추가 안 함** (Port interface 만 common 보유, JPA 어댑터는 각 서비스에서). `org.springframework.boot:spring-boot-starter-actuator` (Micrometer 메트릭 — 이미 있음).
- [ ] (선택) `org.springframework:spring-tx` — `TransactionTemplate` 위해 필요 (이미 spring-boot-starter-data-redis 의존성으로 transitive 확보 가능, 명시 vs 묵시 결정).

#### 3.1.3 Auto-Configuration 스펙

```
class IdempotentEventHandlerAutoConfiguration {
    @Bean @ConditionalOnMissingBean
    fun idempotentEventHandler(
        port: ProcessedEventRepositoryPort,
        txTemplate: TransactionTemplate,
    ): IdempotentEventHandler = IdempotentEventHandler(port, txTemplate)

    @Bean @ConditionalOnMissingBean
    fun idempotentMetrics(meterRegistry: MeterRegistry): IdempotentMetrics =
        IdempotentMetrics(meterRegistry)

    // Cleanup 스케줄러는 별도 @Configuration + @ConditionalOnProperty
    // (기본 false — 서비스가 명시적으로 "kgd.common.messaging.idempotent.cleanup.enabled=true" 켜야 동작)
}
```

→ `@ConditionalOnBean(ProcessedEventRepositoryPort::class)` 로 Port 등록 안 한 서비스(search, analytics)는 자동 비활성화.

#### 3.1.4 Cleanup 스케줄러 스펙

```
@Scheduled(cron = "0 30 3 * * *", zone = "Asia/Seoul")
fun cleanup() {
    val cutoff = Instant.now().minus(properties.retention)  // default 7d
    val deleted = port.deleteOlderThan(cutoff)
    log.info { "idempotent cleanup deleted=$deleted cutoff=$cutoff" }
}
```

- `ProcessedEventRepositoryPort` 에 `deleteOlderThan(cutoff: Instant): Int` 추가.
- 기본 cron: 03:30 KST (low-traffic window). 서비스별 override 가능.
- `@ConditionalOnProperty("kgd.common.messaging.idempotent.cleanup.enabled", havingValue = "true")` — 서비스가 opt-in. (Phase 4 에서 4개 서비스 application.yml 활성화.)

### 3.2 단위 테스트 시나리오 (Kotest BehaviorSpec + MockK)

- [ ] Given 미처리 eventId, When `process()`, Then `block()` 1회 호출 + `mark()` 1회 호출 + true 반환
- [ ] Given 처리됨 (existsBy=true), When `process()`, Then `block()` 호출 안 됨 + false 반환
- [ ] Given mark 가 `DataIntegrityViolationException` 던짐, When `process()`, Then true 반환 (race 흡수, log.debug)
- [ ] Given mark 가 `RuntimeException` 던짐, When `process()`, Then 예외 전파 (호출자가 Kafka offset commit 안 하도록)
- [ ] Given block 이 예외 던짐, When `process()`, Then mark 호출 안 됨 + 예외 전파 (재배달 시 재시도)
- [ ] cleanup 스케줄러: cutoff 정확히 계산되고 port.deleteOlderThan 호출됨
- [ ] 메트릭: processed result 별 Counter 1 증가

### 3.3 Acceptance Criteria

- [ ] `./gradlew :common:test` 통과 (~6+ 테스트 케이스)
- [ ] `./gradlew :common:build` 통과
- [ ] common 의존하는 다른 서비스 (gateway, product, order 등) 빌드 영향 없음 (`@ConditionalOnBean` 으로 자동 비활성화 검증)
- [ ] Self-review 완료 (`agent-os/standards/agent-behavior/self-review.md`)

### 3.4 PR-1 범위

- 변경 파일: common 신규 9-10개
- 삭제 파일: 0
- LOC 추정: +~400 (헬퍼 ~70 + AutoConfig ~30 + Properties ~20 + Cleanup ~50 + Metrics ~40 + Port/DTO ~30 + 테스트 ~150)
- DB 영향: 0 (스키마 변경 없음)
- Rollback: revert 만으로 충분 (AutoConfig 가 ConditionalOnBean 으로 보호되므로 무영향)

---

## 4. Phase 1 — quant 헬퍼 교체 (0.5 sprint, ~3 days)

> **PR-2**. quant 의 자체 `IdempotentEventConsumer` 를 common 헬퍼로 in-place 교체. 검증 first 전략의 첫 적용.

### 4.1 검증 전제 (시작 전)

- [ ] quant 의 `ProcessedEventEntity` 와 common 의 신규 `ProcessedEventRecord` / Port 시그니처가 동치인지 read 비교.
  - 현재 `ProcessedEventEntity.kt` 는 `BINARY(16)` UUID + `(eventId, consumerGroup)` 복합 PK + `processedAt: Instant` — common 의 `ProcessedEventRecord` 와 1:1 매핑 가능 확인.
- [ ] quant 의 `IdempotentEventConsumer.kt:48-93` 의 동작이 common 헬퍼와 race 흡수까지 동일한지 line-by-line diff.

### 4.2 작업 목록

- [ ] `quant/app/src/main/kotlin/com/kgd/quant/infrastructure/persistence/repository/ProcessedEventAdapter.kt` 신설 — `ProcessedEventRepositoryPort` 구현체. 기존 `ProcessedEventJpaRepository` 를 wrapping.
  - `existsBy(eventId, consumerGroup): Boolean` → `jpaRepo.existsById(ProcessedEventId(eventId, consumerGroup))`
  - `mark(record)` → `jpaRepo.save(...)`
  - `deleteOlderThan(cutoff): Int` → `@Modifying @Query` 또는 derived method (`deleteByProcessedAtBefore(cutoff)`)
- [ ] `quant/app/.../infrastructure/outbox/IdempotentEventConsumer.kt` — `@Deprecated("Use common IdempotentEventHandler", ReplaceWith("idempotentEventHandler.process(eventId, consumerGroup, block)"))` 주석 추가. 클래스 자체는 PR-2 에서 유지(향후 호출부 정리 후 PR-2.5 또는 Phase 4 에서 삭제).
- [ ] 테스트: `ProcessedEventAdapterSpec.kt` 신설 — `@DataJpaTest` 또는 Testcontainers 로 실제 MySQL 동작 검증 (existsBy, mark, deleteOlderThan, race 흡수).

### 4.3 호출부 (현재 zero)

> quant 의 `IdempotentEventConsumer` 는 작성됨 + 호출자 미존재 (Phase 2 outbox relay 는 publisher-only). 따라서 PR-2 는 **adapter 등록 + 자체 헬퍼 deprecate** 만 하며 functional 변경 없음.

### 4.4 Acceptance Criteria

- [ ] `./gradlew :quant:app:build` + `:quant:app:test` 통과
- [ ] `./gradlew :quant:domain:test` 통과
- [ ] common 헬퍼 Bean + adapter Bean 이 컨텍스트에 등록됨 (`@SpringBootTest` smoke test 로 확인)
- [ ] 기존 `IdempotentEventConsumer` 동작 무회귀 (단위 테스트 그대로 통과)
- [ ] Flyway 변경 없음 — `V001__init.sql:110-115` 스키마가 이미 신표준과 일치하므로 마이그레이션 불필요

### 4.5 PR-2 범위

- 변경 파일: quant 신규 2개 (adapter + adapter test) + deprecation annotation 1개
- DB 영향: 0
- Rollback: revert 만으로 무영향 (functional 변경 없음)

---

## 5. Phase 2a — 3개 서비스 Flyway baseline 도입 (1 sprint, ~5 days)

> **PR-3**. inventory/fulfillment 에 Flyway baseline 도입 + order 의 `processed_event` 를 명시 Flyway script 로 등재.
> Phase 2b (스키마 변경) 의 선행 작업. 분리 이유: Flyway 도입 자체가 운영 리스크 (baseline 잘못 잡으면 staging/prod 불일치) → 분리하여 작은 변경으로 검증.

### 5.1 검증 전제

- [ ] `kubectl exec` 로 staging MySQL 접속, 각 서비스 DB 의 현재 테이블 스키마 dump (`SHOW CREATE TABLE processed_event`).
- [ ] inventory/fulfillment/order 의 모든 JPA 엔티티 → 현 DB DDL 매칭표 작성 (Flyway baseline 의 V0 스크립트로 영구화).
- [ ] 기존 데이터 row count 확인 — `processed_event` row 가 매우 많으면 Phase 2b 의 ALTER 가 위험. 현 추정은 작음 (멱등 처리 7일치 스케줄러도 없는 상태).

### 5.2 작업 목록

#### 5.2.1 inventory

- [ ] `inventory/app/build.gradle.kts` — `implementation(libs.flyway.mysql)` 추가 (libs.versions.toml 의 기존 alias 활용).
- [ ] `inventory/app/src/main/resources/application.yml` — `spring.flyway.enabled: true`, `baseline-on-migrate: true`, `baseline-version: 0`.
- [ ] `inventory/app/src/main/resources/db/migration/V1__baseline.sql` — 현 DB 의 모든 테이블 (`stock`, `reservation`, `processed_event` 등) DDL dump. **기존 데이터 무손실**.
- [ ] (이후 PR-4 의 Phase 2b 가 V2 부터 추가)

#### 5.2.2 fulfillment

- [ ] inventory 와 동일 절차 (`V1__baseline.sql` 작성).

#### 5.2.3 order

- [ ] order 는 이미 Flyway 사용 중 (`V1__create_orders_table.sql` 존재). 단 `processed_event` 테이블은 Flyway script 에 없음 → 현 운영 DB 에 ddl-auto 가 만든 테이블 존재 가정.
- [ ] `order/app/src/main/resources/db/migration/V2__add_processed_event.sql` — 기존 ddl-auto 가 만든 테이블과 정확히 동일 DDL (idempotent: `CREATE TABLE IF NOT EXISTS`). Flyway 가 처음 실행 시 이미 존재하면 skip 또는 baseline 처리.
- [ ] application.yml `spring.jpa.hibernate.ddl-auto: validate` 유지 (Flyway 가 단독 책임 명시).

### 5.3 staging 검증 (필수)

- [ ] k3s-lite staging 환경에 `kubectl apply` 후 각 서비스 deploy.
- [ ] Flyway baseline 동작 확인 — `flyway_schema_history` 테이블이 V1 으로 baseline 처리됨.
- [ ] 기존 데이터 무손실 확인 (row count, sample row 비교).
- [ ] 서비스 정상 기동 (헬스체크 + 1개 이벤트 e2e 처리).

### 5.4 Acceptance Criteria

- [ ] 3개 서비스 모두 staging 에서 정상 기동
- [ ] `flyway_schema_history` 가 baseline 으로 등재됨
- [ ] 기존 row 무손실
- [ ] `./gradlew :inventory:app:test`, `:order:app:test`, `:fulfillment:app:test` 통과
- [ ] common 헬퍼는 아직 도입 안 함 (Phase 3 까지 대기)

### 5.5 PR-3 범위

- 변경 파일: 3 서비스 × (build.gradle.kts + application.yml + V1__baseline.sql) ≈ 9 파일
- DB 영향: `flyway_schema_history` 테이블 신설, 기존 비즈니스 테이블 무변경
- Rollback: Flyway 비활성화 + `flyway_schema_history` DROP. 기존 테이블 무변경이므로 안전.
- Risk: **MEDIUM** — Flyway baseline 잘못 잡으면 다음 PR 의 마이그레이션이 깨짐. staging 충분 검증 필수.

---

## 6. Phase 2b — processed_event 스키마 마이그레이션 (1 sprint, ~5 days)

> **PR-4**. ADR-0029 §2 의 신표준 스키마 (`(event_id, consumer_group) BINARY(16) PK`) 로 4개 서비스(inventory/order/fulfillment/product) 마이그레이션.
> 호출부 변경(Phase 3) 직전. Entity 변경 + Flyway script 만, consumer 호출 형태는 그대로.

### 6.1 마이그레이션 전략

ADR-0029 §Rollout Phase 2 의 5-step swap 방식을 채택:

```sql
-- 각 서비스 db/migration/V{n}__processed_event_composite_key.sql
-- (V{n} 는 PR-3 의 V1 다음 — inventory/fulfillment 는 V2, order 는 V3)

-- 1) 백업 (rollback 안전망)
CREATE TABLE processed_event_backup_v0 AS SELECT * FROM processed_event;

-- 2) 신규 테이블
CREATE TABLE processed_event_v1 (
    event_id        BINARY(16)  NOT NULL,
    consumer_group  VARCHAR(64) NOT NULL,
    processed_at    DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id, consumer_group),
    KEY idx_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) 데이터 이전 — 서비스별 consumer_group 명 backfill
INSERT INTO processed_event_v1 (event_id, consumer_group, processed_at)
SELECT
    UNHEX(REPLACE(event_id, '-', '')),     -- VARCHAR(36) UUID → BINARY(16)
    '{service-name}-service',               -- inventory/order/fulfillment
    processed_at
FROM processed_event;

-- 4) 원자적 swap (RENAME TABLE 은 InnoDB metadata lock 만)
RENAME TABLE processed_event TO processed_event_v0,
             processed_event_v1 TO processed_event;

-- 5) (별도 후속 PR-7 에서 1주 관찰 후 DROP)
-- DROP TABLE processed_event_v0;
-- DROP TABLE processed_event_backup_v0;
```

### 6.2 작업 목록

#### 6.2.1 inventory (V2__processed_event_composite_key.sql)

- [ ] Flyway script 작성 (위 5-step). consumer_group default = `inventory-service` (현 `@KafkaListener.groupId` 와 일치, `InventoryEventConsumer.kt:29`).
- [ ] `inventory/app/.../persistence/idempotency/ProcessedEventJpaEntity.kt` 갱신:
  - `eventId: UUID` (was `String`) + `@Column(columnDefinition = "BINARY(16)")`
  - `consumerGroup: String` 필드 추가 + `@Column(length = 64)`
  - `@IdClass(ProcessedEventId::class)` 추가 (별도 `ProcessedEventId.kt` 신설)
  - `processedAt: Instant` (was `LocalDateTime`)
  - `topic` 컬럼 제거 (ADR-0029 §2 — consumer_group 이 충분 식별)
- [ ] `inventory/app/.../persistence/idempotency/ProcessedEventJpaRepository.kt` — `JpaRepository<ProcessedEventJpaEntity, ProcessedEventId>` 로 PK 타입 변경.
- [ ] `InventoryEventConsumer.kt` 의 호출부 `processedEventRepository.existsById(event.eventId)` → 임시 helper 호출로 변환 (이번 PR 에선 string→UUID 파싱만 추가, common 헬퍼 wire-up 은 Phase 3).
  - 또는: 호출부는 그대로 두고 `existsById`/`save` 가 string 인자에서도 동작하도록 어댑터 보강 → 더 깨끗하지만 코드 분기 → **PR-4 는 임시 호환 함수 한 개만 추가** 권장.
- [ ] inventory 의 기존 단위 테스트 (`InventoryEventConsumerTest.kt`) 갱신.

#### 6.2.2 order (V3__processed_event_composite_key.sql)

- [ ] inventory 와 동일 절차 + consumer_group default = `order-service` (`OrderEventConsumer.kt:25`).
- [ ] order 측 `ProcessedEventJpaEntity` 갱신 (현재 inventory 와 동일 v0 스키마라고 가정 — 실제 read 후 확정 필요).

#### 6.2.3 fulfillment (V2__processed_event_composite_key.sql)

- [ ] inventory 와 동일 + consumer_group default = `fulfillment-service` (현재 `FulfillmentEventConsumer.kt:20-23` 의 `@KafkaListener` 에 `groupId` 명시 누락 → 기본 group 사용. **본 PR 에서 같이 수정**: groupId="fulfillment-service" 명시 추가).
- [ ] **추가 발견**: 위 fulfillment 컨슈머의 groupId 누락은 baseline 표(§2.4)에는 표면화 안 됐지만 Phase 3 의 `consumerGroup` 인자에 영향 → PR-4 에서 명시 fix.

#### 6.2.4 product (V{n}__processed_event_table.sql) — 신규 테이블

- [ ] product 는 현재 `processed_event` 테이블 자체가 없음 (Verification Follow-up §2). 신규 표준 스키마로 생성만 함.
- [ ] `product/app/.../infrastructure/persistence/idempotency/ProcessedEventJpaEntity.kt` 신규 작성 (신표준).
- [ ] `ProcessedEventJpaRepository.kt` 신규.
- [ ] **데이터 backfill 불필요** (기존 row 0).

### 6.3 추가 작업: Adapter 4개

각 서비스에 `ProcessedEventRepositoryPort` 어댑터 등록 (quant 의 PR-2 와 동일 패턴):

- [ ] `inventory/app/.../persistence/idempotency/InventoryProcessedEventAdapter.kt`
- [ ] `order/app/.../persistence/idempotency/OrderProcessedEventAdapter.kt`
- [ ] `fulfillment/app/.../persistence/idempotency/FulfillmentProcessedEventAdapter.kt`
- [ ] `product/app/.../persistence/idempotency/ProductProcessedEventAdapter.kt`

→ Phase 3 의 호출부 wire-up 직전에 Bean 준비 완료.

### 6.4 staging 검증

- [ ] k3s-lite 에 deploy → Flyway 가 V2/V3 적용.
- [ ] `processed_event_backup_v0` 테이블이 존재하고 기존 row 보유함 (rollback 안전망).
- [ ] swap 후 `processed_event` 가 신스키마 + backfill row 보유.
- [ ] 서비스 정상 기동 (JPA validate 통과).
- [ ] 기존 in-place dedup 동작 무회귀 — eventId 가 새 UUID 형식이어도 dedup 작동.
- [ ] `EXPLAIN SELECT ... WHERE event_id = ? AND consumer_group = ?` 로 PRIMARY index 사용 확인.

### 6.5 Acceptance Criteria

- [ ] 4 서비스 빌드/테스트 통과
- [ ] staging Flyway 마이그레이션 dry-run 성공
- [ ] 기존 멱등 동작 무회귀
- [ ] backup 테이블 보존 확인
- [ ] (이번 PR 에선 common 헬퍼 호출 안 함 — Phase 3 까지 대기)

### 6.6 PR-4 범위

- 변경 파일: 4 서비스 × (Flyway script + Entity + Repository + Adapter + 테스트 갱신) ≈ 18-20 파일
- DB 영향: `processed_event` 테이블 PK + 컬럼 타입 변경 (5-step swap), `processed_event_backup_v0` 신설 (1주 후 DROP)
- Rollback: 단순 `RENAME TABLE processed_event TO processed_event_v1, processed_event_v0 TO processed_event;` 로 즉시 복구 (backup 보존 덕분)
- Risk: **HIGH** — DB 스키마 변경 + 데이터 이전. PITR 백업 사전 확인 필수 (`docker/backup/scripts/` + `k8s/infra/prod/backup/` Cronjob 정상 동작 검증).

---

## 7. Phase 3 — consumer 호출부 헬퍼 전환 (2 sprints, ~10 days)

> **PR-5 / PR-6 / PR-7 / PR-8**. 4 + 1 컨슈머를 common `idempotentHandler.process(...)` 호출 형태로 리팩터링. 위험도 낮은 순으로 PR 분리.

### 7.1 호출부 표준 형태 (ADR-0029 §6)

```kotlin
@KafkaListener(...)
fun onSomeEvent(record: ConsumerRecord<String, String>) {
    val event = objectMapper.readValue(record.value(), SomeEvent::class.java)
    val eventId = parseEventId(event.eventId)
        ?: return logMissingId("some.topic")  // graceful degrade

    idempotentHandler.process(eventId, "{service}-service") {
        // 비즈니스 처리 (호출자 트랜잭션 경계 결정)
    }
}

private fun parseEventId(raw: String?): UUID? = try {
    raw?.takeIf { it.isNotBlank() }?.let(UUID::fromString)
} catch (e: IllegalArgumentException) { null }

private fun logMissingId(topic: String) {
    log.warn { "missing eventId topic=$topic — graceful degrade, executing without dedup" }
    idempotentMetrics.missingId(consumerGroup = "{service}-service")
}
```

→ ADR-0029 §4 의 graceful degrade 정책 준수. WARN 로그 + 메트릭 + dedup 없이 block 실행.

### 7.2 PR 분리 전략 (위험도 낮은 순)

ADR-0029 §Rollout Phase 3 권고 + Verification Follow-up §2 추가 대상.

| PR | 서비스 / 컨슈머 | 메서드 수 | 도메인 영향 | Risk |
|---|---|---|---|---|
| PR-5 | fulfillment / `FulfillmentEventConsumer` | 1 | 풀필먼트 생성 (재고 변경 없음) | LOW |
| PR-6 | order / `OrderEventConsumer.onReservationExpired` | 1 | 주문 취소 (1개 도메인 객체) | MEDIUM |
| PR-7 | product / `InventoryStockSyncConsumer` (신규 적용) | 1 | 재고 read-only 캐시 동기화 | LOW (역설적) |
| PR-8 | inventory / `InventoryEventConsumer` (3 핸들러) | 3 | 재고 변경 (이중 차감 risk 가장 큼) | HIGH |

→ 4개 PR 로 분리. fulfillment/order 안정화 후 inventory 진행.

### 7.3 PR-5 — fulfillment

#### 7.3.1 작업 목록

- [ ] `FulfillmentEventConsumer.kt:24-49` 를 ADR-0029 §6 표준 형태로 리팩터링.
- [ ] `objectMapper.readTree` 분기 → `objectMapper.readValue(..., StockReservedEvent::class.java)` 로 전환 (PR-5 단계에서 명시 DTO 권장 — 단 기존 readTree 도 허용. 변경 최소화 시 readTree 유지 + eventId 만 UUID 파싱).
- [ ] groupId 명시: `@KafkaListener(topics=[...], groupId = "fulfillment-service", ...)` (현재 명시 누락. PR-4 에서 fix 시 PR-5 로 이관 가능).
- [ ] 기존 `processedEventRepository` 직접 의존 제거 → `idempotentHandler` 의존만 남김.
- [ ] 단위 테스트 갱신 (`FulfillmentEventConsumerTest.kt`):
  - 신규 이벤트 처리 성공 케이스
  - 중복 이벤트 skip 케이스 (idempotentHandler mock = false 반환)
  - eventId 누락 graceful degrade (block 실행 + missing metric)

#### 7.3.2 통합 테스트 (Testcontainers)

- [ ] `FulfillmentEventConsumerIT.kt` 추가 — Testcontainers MySQL + 임베디드 Kafka.
- [ ] 동일 eventId 의 메시지 2회 발행 → 풀필먼트 1개만 생성됨 검증.
- [ ] eventId 다른 메시지 2회 → 풀필먼트 2개 생성 검증.

#### 7.3.3 Acceptance Criteria

- [ ] `:fulfillment:app:test` + IT 통과
- [ ] k3s-lite e2e: 동일 eventId 메시지 중복 발행 시 단일 처리
- [ ] `kgd_idempotent_processed_total{consumer_group="fulfillment-service",result=...}` 메트릭 노출
- [ ] 운영 1일 모니터링 — error 로그 없음

#### 7.3.4 Rollback

- revert PR-5. 멱등 마킹은 Phase 2b 의 신스키마에 그대로 남으므로 데이터 손실 없음.

### 7.4 PR-6 — order

#### 7.4.1 작업 목록

- [ ] `OrderEventConsumer.onReservationExpired` (`order/.../OrderEventConsumer.kt:28-49`) 리팩터링.
- [ ] eventId 파싱 + groupId="order-service" 인자.
- [ ] 단위 + Testcontainers IT.
- [ ] **추가 검증**: `orderTransactionalService.cancelOrder(orderId)` 가 자체 멱등 가능한지 (이미 CANCELLED 상태인 주문 재취소 시 BusinessException → DLT?) — Phase A Policy A 의 호출자 책임. 현재 OrderTransactionalService 의 cancel 동작 확인 필수.
  - 자연 멱등이 안 되면 보강 PR 로 분리 (`status == CANCELLED` 시 no-op 반환).

#### 7.4.2 Acceptance Criteria

- [ ] `:order:app:test` + IT 통과
- [ ] k3s-lite e2e
- [ ] 메트릭 노출

### 7.5 PR-7 — product / `InventoryStockSyncConsumer` (신규 적용)

#### 7.5.1 컨텍스트

`InventoryStockSyncConsumer.kt:11-44` 는 기존 멱등 체크 zero. PR-7 은 신규 적용 — 기존 in-place 패턴 → 표준 헬퍼 직접 도입.

#### 7.5.2 작업 목록

- [ ] PR-4 에서 신설된 `ProcessedEventJpaEntity` + Adapter (product 측) 사용.
- [ ] `InventoryStockSyncConsumer.kt` 의 `onInventoryStockChanged` 를 헬퍼로 wrap. groupId="product-stock-sync".
- [ ] **eventId 누락 케이스 빈도 우려**: 현 inventory outbox publish 가 eventId 를 항상 부여하는지 검증 (`inventory/.../OutboxRelay` grep 필요). 누락 시 graceful degrade 작동.
- [ ] 단위 + IT.

#### 7.5.3 자연 멱등 보강

- `syncProductStockUseCase.execute(...)` 는 `availableQty` 절대값 set → **자연 멱등** (idempotent assignment).
- 따라서 PR-7 의 멱등 체크는 보강 (중복 처리 부하 감소) 목적이며, race scenario 가 발생해도 데이터는 안전.

#### 7.5.4 Acceptance Criteria

- [ ] `:product:app:test` + IT
- [ ] e2e — 동일 eventId 의 stock event 가 중복 처리되지 않음
- [ ] 자연 멱등 보강 효과 (메트릭의 skip 비율 노출)

### 7.6 PR-8 — inventory (3 핸들러)

#### 7.6.1 작업 목록

- [ ] `InventoryEventConsumer.kt:32-62` `onOrderCompleted` 리팩터링.
- [ ] `:64-97` `onFulfillmentShipped` 리팩터링.
- [ ] `:99-132` `onFulfillmentCancelled` 리팩터링.
- [ ] groupId 모두 "inventory-service" 통일 (이미 일치, 검증만).
- [x] **자연 멱등 보강 검증** (Policy A 의 핵심 책임) — **PR-8 실 검증 결과 (2026-05-03)**:
  - `reserveStockUseCase.execute(...)` — **자연 멱등 NOT OK**. 같은 `(orderId, productId)` 두 번 호출 시 매번 새 Reservation + `inventory.reserve(qty)` 두 번 deduct → 이중 차감 risk. 사전 plan 의 "현 `findByOrderIdAndWarehouseId` 로 보강돼 있음 (study 17 §11)" 주장은 **fulfillment 측 보강을 inventory 에 잘못 attribute** 한 것 — wording 정정. → **PR-8a 신설**: `findActiveByOrderIdAndProductId` pre-check 로 idempotent return 보강 (Option A 채택, commit `651017b`).
  - `confirmStockByOrderUseCase.execute(...)` — **자연 멱등 OK**. `InventoryService.kt:209` 의 `.filter { it.getStatus() == ReservationStatus.ACTIVE }` 가 이미 CONFIRMED reservation 을 결과에서 제외 → empty list → no-op.
  - `releaseStockByOrderUseCase.execute(...)` — **자연 멱등 OK**. `InventoryService.kt:247` 동일 ACTIVE filter.
  - 결과: PR-8 가 3/4 listener 만 helper 이관, `onOrderCompleted` 는 PR-8a 에서 보강 후 이관 완료.

#### 7.6.2 통합 테스트

- [ ] `InventoryEventConsumerIT.kt` — 3 핸들러 각각 중복 메시지 시나리오.
- [ ] 동일 orderId + 동일 eventId 의 OrderCompletedEvent 2회 → 재고 1회만 차감.
- [ ] 같은 orderId 의 OrderCompletedEvent + FulfillmentCancelledEvent 가 다른 eventId 로 도착 → 정상 reserve + release.

#### 7.6.3 Acceptance Criteria

- [ ] `:inventory:app:test` + IT 통과
- [ ] k3s-lite e2e — 핵심 시나리오 (재고 차감/확정/해제) 의 중복 발행 회복력
- [ ] 메트릭: 3개 핸들러 모두 노출
- [ ] 운영 staging 1주 관찰 — 재고 정합성 (Inventory `available + reserved == total` 불변식 유지)

### 7.7 Phase 3 종합 — 전후 비교

| 컨슈머 | Before LOC | After LOC | 변화 |
|---|---|---|---|
| FulfillmentEventConsumer.onStockReserved | 26 | ~14 | -12 |
| OrderEventConsumer.onReservationExpired | 22 | ~14 | -8 |
| InventoryStockSyncConsumer.onInventoryStockChanged | 18 | ~16 | +0 (신규 멱등 추가) |
| InventoryEventConsumer.onOrderCompleted | 31 | ~16 | -15 |
| InventoryEventConsumer.onFulfillmentShipped | 34 | ~18 | -16 |
| InventoryEventConsumer.onFulfillmentCancelled | 34 | ~18 | -16 |
| **Total** | **165** | **~96** | **-69 LOC (~42%)** + 1 신규 멱등 컨슈머 |

→ ADR-0029 §Consequences "boilerplate 제거" 정량 효과.

---

## 8. Phase 4 — Cleanup + 모니터링 + 호환성 코드 제거 (1 sprint, ~5 days)

> **PR-9 / PR-10**. 운영 안정화 + ADR-0012 cross-ref 추가.

### 8.1 PR-9 — cleanup 활성화 + 메트릭 dashboard

#### 8.1.1 작업 목록

- [ ] 4개 서비스 (`inventory`, `order`, `fulfillment`, `quant`, `product`) `application-kubernetes.yml` 에 `kgd.common.messaging.idempotent.cleanup.enabled: true` 추가.
- [ ] retention 정책 명시: `kgd.common.messaging.idempotent.cleanup.retention: P7D` (default 그대로 명시 — 명시적 의도).
- [ ] cron 시간 분산 (각 서비스 다른 시각으로 — DB 부하 분산):
  - inventory: `0 30 3 * * *`
  - order: `0 0 3 * * *`
  - fulfillment: `0 15 3 * * *`
  - product: `0 45 3 * * *`
  - quant: `0 0 4 * * *`

#### 8.1.2 메트릭 대시보드 (Grafana)

- [ ] `k8s/infra/prod/monitoring/` 에 dashboard JSON 추가 또는 기존 dashboard 보강:
  - Panel 1: `rate(kgd_idempotent_processed_total[5m])` per consumer_group, stacked by result (processed/skipped/race)
  - Panel 2: `rate(kgd_idempotent_event_missing_id_total[5m])` per consumer_group (이상 시 alert)
  - Panel 3: cleanup 실행 후 row count 변화 (gauge)
  - Panel 4: `processed_event` 테이블 row 수 추이 (PromSQL — `SELECT count(*) FROM processed_event` exporter 또는 JPA bean → Micrometer)

#### 8.1.3 알람 룰

- [ ] `missing_id` 비율 > 0.01 (1%) 5분 연속 → WARN (publisher 측 누락 의심)
- [ ] cleanup job 실패 (last-run > 25h 전) → CRITICAL
- [ ] `processed_event` row count > 1M → WARN (cleanup 비정상 의심)
- [ ] `race` result 비율 > 0.1 (10%) → INFO (멀티 인스턴스 동시 INSERT 빈도 — 정상이지만 모니터링)

#### 8.1.4 Acceptance Criteria

- [ ] 5 서비스 배포 후 cleanup 첫 실행 로그 확인
- [ ] 7일 후 `processed_event` row 수가 안정 (cleanup 동작 검증)
- [ ] Grafana dashboard 에 메트릭 표시
- [ ] 알람 룰 정상 (테스트 시나리오로 트리거)

### 8.2 PR-10 — 호환성 코드 제거 + ADR-0012 cross-ref

#### 8.2.1 사전 조건

- PR-5/6/7/8 배포 후 1주 운영 관찰.
- `kgd_idempotent_event_missing_id_total` 가 모든 consumer_group 에서 0 이어야 함 (publisher 측 eventId 부여 100% 검증).

#### 8.2.2 작업 목록

- [ ] 5 컨슈머의 `parseEventId() ?: return logMissingId(...)` graceful degrade 분기 제거 (또는 `error("eventId required")` 로 강제). 보수적으로 — degrade 분기 유지하되 metric 0 1개월 관찰 후 별도 PR.
- [ ] Phase 2b 의 `processed_event_v0` / `processed_event_backup_v0` DROP (각 서비스 Flyway script).
- [ ] quant 의 `IdempotentEventConsumer.kt` (자체 헬퍼) 삭제 — Phase 1 에서 deprecate 처리한 클래스 + 어디서도 호출 안 함 검증 후 삭제.
- [ ] ADR-0012 본문 끝에 cross-ref 추가:
  ```markdown
  ## Refinement (2026-XX-XX)
  본 결정의 §3 atomicity 시맨틱 + §4 common 모듈 위치 + §2 PK/컬럼 표준은 ADR-0029 (Idempotent Consumer Helper) 로 보강 표준화됨.
  현재 운영 코드는 ADR-0029 의 결정을 따른다.
  ```
- [ ] `docs/conventions/idempotent-consumer.md` 신설 (ADR-0029 §Cross-references 후속) — 호출자 책임, 자연 멱등 패턴, eventId 누락 정책, 메트릭 표준 실천 가이드.

#### 8.2.3 Acceptance Criteria

- [ ] graceful degrade 제거 후 회귀 없음 (1주 staging 검증)
- [ ] backup 테이블 모두 DROP
- [ ] quant 자체 헬퍼 클래스 삭제, 빌드 통과
- [ ] ADR-0012 cross-ref 추가됨
- [ ] 신설 convention 문서 PR review 통과

### 8.3 PR-11 (선택) — common 메트릭 / cleanup polish

- [ ] cleanup 실행 결과를 `kgd_idempotent_cleanup_deleted_total{consumer_group}` Counter 로 노출
- [ ] cleanup 실패 시 `kgd_idempotent_cleanup_errors_total` 증가 + 다음 주기 retry
- [ ] common AutoConfig 의 `IdempotentEventCleanupScheduler` 가 동시 실행 방지 (`@SchedulerLock` shedlock 도입 — 멀티 instance 환경에서 cleanup 중복 방지)

> PR-11 은 옵션. 운영 시 race 빈도 보고 결정.

---

## 9. 통합 Acceptance Criteria

### 9.1 기능

- [ ] 5개 컨슈머 (`InventoryEventConsumer × 3`, `OrderEventConsumer × 1`, `FulfillmentEventConsumer × 1`, `InventoryStockSyncConsumer × 1`, quant adapter) 가 모두 common `idempotentHandler.process(...)` 사용
- [ ] `processed_event` 테이블이 4개 서비스 + quant 모두 표준 스키마 `(event_id BINARY(16), consumer_group VARCHAR(64))` 적용
- [ ] 7일 retention 자동 cleanup 동작
- [ ] eventId 누락 시 graceful degrade (WARN + 메트릭) — Phase 4 PR-10 제거 가능 시점 도래 시 제거

### 9.2 운영

- [ ] `kgd_idempotent_processed_total{consumer_group, result}` 노출
- [ ] `kgd_idempotent_event_missing_id_total{consumer_group}` 노출
- [ ] Grafana dashboard 1개
- [ ] 알람 룰 4종 (위 §8.1.3)

### 9.3 문서

- [ ] ADR-0012 의 §"Refinement" cross-ref 추가
- [ ] `docs/conventions/idempotent-consumer.md` 신설
- [ ] common/CLAUDE.md 의 messaging 패키지 섹션
- [ ] 5 서비스 CLAUDE.md 의 "Key Rules" 에 `idempotentHandler` 사용 1줄 추가

### 9.4 코드 품질

- [ ] LOC 감소 ≥ 60 (consumer boilerplate 제거)
- [ ] common 헬퍼 단위 테스트 ≥ 6 케이스
- [ ] Testcontainers IT — 5 컨슈머 모두 중복 시나리오 검증

---

## 10. Risk + Rollback

### 10.1 PR-1 (common 헬퍼)

- **Risk**: LOW. AutoConfig 가 ConditionalOnBean 으로 보호 → Port Bean 등록 안 한 서비스 무영향.
- **Rollback**: revert. 다른 서비스 영향 없음.

### 10.2 PR-2 (quant)

- **Risk**: LOW. functional 변경 없음 (호출자 zero).
- **Rollback**: revert. quant 자체 헬퍼는 그대로.

### 10.3 PR-3 (Flyway baseline)

- **Risk**: MEDIUM. Flyway baseline 잘못 잡으면 다음 PR 깨짐. 기존 데이터는 무변경이므로 데이터 손실 위험은 LOW.
- **Rollback**: Flyway 비활성화 + `flyway_schema_history` DROP. 비즈니스 테이블 무변경.
- **Pre-check**: staging 에서 baseline 적용 후 `SHOW CREATE TABLE` 비교, 모든 entity 의 `ddl-auto: validate` 통과 확인.

### 10.4 PR-4 (스키마 마이그레이션)

- **Risk**: HIGH. DB schema 변경 + 데이터 이전.
- **Rollback**:
  - 즉시 롤백: `RENAME TABLE processed_event TO processed_event_v1, processed_event_v0 TO processed_event;` (수 초). backup 보존 덕분.
  - 데이터 손실 시: `processed_event_backup_v0` 에서 복구.
  - 최후: PITR (XtraBackup + binlog, `docker/backup/scripts/`) — Phase 2b 시작 전 Full backup 필수.
- **Pre-check**:
  - staging 5-step swap dry-run 성공
  - `SELECT COUNT(*) FROM processed_event` Before/After 일치
  - `EXPLAIN` 으로 PRIMARY index 사용 확인
  - PITR 백업 정상 동작 확인 (`k8s/infra/prod/backup/cronjob-full.yaml` last-run < 24h)

### 10.5 PR-5/6/7/8 (호출부 전환)

- **Risk**: PR-5/7 LOW, PR-6 MEDIUM, PR-8 HIGH (재고 이중 차감 risk).
- **Rollback**: revert. Phase 2b 의 신스키마는 유지되므로 데이터 일관성 OK.
- **Pre-check** (PR-8 inventory):
  - staging 에서 동일 eventId 메시지 100회 발행 → 재고 1회만 차감 검증
  - canary deploy (1/N pods 만 신규 코드) 1시간 → 재고 정합성 검증 → 전체 rollout
  - PITR 백업 사전 확인

### 10.6 PR-9 (cleanup 활성화)

- **Risk**: LOW. cleanup 이 너무 공격적이면 (예: retention 1day 오타) 멱등 데이터 조기 삭제 → 늦게 도착한 중복 이벤트 재처리.
- **Rollback**: `cleanup.enabled: false` 로 즉시 끄기. 데이터 손실은 이미 발생한 row 만.
- **Pre-check**: staging 에서 retention 명시 (P7D) 검증 + 첫 실행 로그 확인.

### 10.7 PR-10 (graceful degrade 제거)

- **Risk**: LOW (사전 조건: `missing_id` metric 0 1주). 단 미래 publisher 가 eventId 누락 시 이벤트 reject → DLT 직행 → consumer lag.
- **Rollback**: revert. graceful degrade 분기 복구.

---

## 11. 일정 / Owner

### 11.1 일정 (가이드 — 1 sprint = 1 week)

| Phase | PR | 기간 | 누적 |
|---|---|---|---|
| 0 | PR-1 | 0.5 week | 0.5w |
| 1 | PR-2 | 0.5 week | 1.0w |
| 2a | PR-3 | 1 week | 2.0w |
| 2b | PR-4 | 1 week | 3.0w |
| 3 | PR-5 (fulfillment) | 0.5 week | 3.5w |
| 3 | PR-6 (order) | 0.5 week | 4.0w |
| 3 | PR-7 (product/StockSync) | 0.5 week | 4.5w |
| 3 | PR-8 (inventory) | 1 week | 5.5w |
| 4 | PR-9 (cleanup + dashboard) | 0.5 week | 6.0w |
| 4 | PR-10 (호환성 제거 + ADR cross-ref) | 0.5 week | 6.5w |

→ **총 6.5 weeks (~6 sprints)**. ADR-0029 §"일정 (가이드)" 의 4w 추정은 Flyway baseline (PR-3) 과 product 신규 적용(PR-7) 누락분 — 본 plan 의 6.5w 가 현실.

### 11.2 Critical Path

```
PR-1 (common) → PR-3 (Flyway baseline) → PR-4 (스키마) → PR-5..8 (호출부) → PR-9..10 (cleanup + cross-ref)
                                          ↘ PR-2 (quant, parallel)
```

PR-2 는 PR-1 만 dependency → 다른 PR 과 병렬 가능. 단 본 plan 은 위험도 분리 우선이라 순차 진행 권장.

### 11.3 Owner

- Plan owner: TBD (백엔드 코어 팀)
- Phase 별 reviewer: 도메인 owner (inventory/order/fulfillment 각자)
- DBA review 필수: PR-3 (Flyway baseline), PR-4 (스키마 swap)
- SRE review 필수: PR-9 (메트릭 + 알람)

---

## 12. Open Questions / Blockers

### 12.1 Plan 작성 시점 (2026-05-02) 의 미해결 항목

- **OQ-1**: order 측 현 운영 DB 의 `processed_event` 테이블이 실제로 존재하는지 (ddl-auto 가 만들었는지) staging/prod 직접 확인 필요. 없다면 PR-3 의 V2 script 가 `CREATE TABLE` (vs `CREATE TABLE IF NOT EXISTS` + baseline) 가 됨.
- **OQ-2**: inventory 의 `confirmStockByOrderUseCase` / `releaseStockByOrderUseCase` 가 자연 멱등 (이미 CONFIRMED/RELEASED 인 reservation 재처리 시 no-op) 인지 검증 필요. PR-8 시작 전 별도 read-only 검증 ticket 으로 분리 권장.
- **OQ-3**: inventory outbox publisher (`OutboxRelay`) 가 모든 이벤트에 eventId 부여하는지 검증. 누락 시 PR-7/PR-8 의 graceful degrade 빈도 증가.
- **OQ-4**: quant 의 `ProcessedEventJpaRepository` 가 `deleteOlderThan` 또는 `deleteByProcessedAtBefore` derived method 를 이미 가지고 있는지 — 없다면 PR-2 에서 추가.
- **OQ-5**: common 모듈에 `spring-boot-starter-data-jpa` 를 추가할지 여부 (Port interface 만 유지 시 불필요. 단 cleanup 스케줄러에서 `@Scheduled` 가 동작하려면 `spring-context` 만 필요 — 추가 의존성 zero 가능).

### 12.2 Verification Follow-up cascade

- **§3 (`addNotRetryableExceptions` 미적용)**: 본 plan 의 직접 범위 외. ADR-0015 보강 ticket 으로 분리 (별도 plan 필요).
- **§5 (R1, `inventory.stock.received` publisher 위치)**: PR-7 (product/StockSync) 시작 전 inventory outbox eventType grep 으로 검증. 누락 시 inventory outbox 측 보강 PR (별도) 선행.

---

## 13. Cross-references

### 13.1 보강 대상

- **ADR-0029** — 본 plan 의 source of truth. 모든 결정 항목은 ADR-0029 §Decision 에서 직접 참조.
- **ADR-0012** — 본 plan 완료 시 PR-10 에서 cross-ref 추가.

### 13.2 관련 ADR

- **ADR-0015** (Resilience Strategy) — DLQ + ErrorHandler. Verification Follow-up §3 의 `addNotRetryableExceptions` 보강은 별도 plan.
- **ADR-0019** (K8s migration) — 멀티 인스턴스 환경에서 동시 INSERT race 흡수가 본 plan 의 핵심 기여.
- **ADR-0020** (`@Transactional` Usage Convention) — Policy A 채택의 근거. block 안 외부 IO 분리 책임 명시.
- **ADR-0024** (Quant Service) — 모범 사례 출처.

### 13.3 학습 노트

- `study/docs/00-VERIFICATION-REPORT.md` — Verification Follow-up §1 (cleanup 미존재), §2 (InventoryStockSyncConsumer), §3 (addNotRetryableExceptions) 의 source.
- `study/docs/6-kafka-internals/13-improvements.md` §4 — 우선순위 높음 ADR 후보 출처.
- `study/docs/7-distributed-systems/17-codebase-idempotent-ssot.md` §12.1 — 현재 코드 race 분석 + 헬퍼 추출 후보.

### 13.4 컨벤션 (Phase 4 신설)

- `docs/conventions/idempotent-consumer.md` — PR-10 신설 후보. 호출자 책임 / 자연 멱등 / eventId 누락 정책 / 메트릭 표준.

---

## 14. 부록 A — PR 단위 요약표

| PR | Phase | 변경 범위 | DB 영향 | Risk | Estimate |
|---|---|---|---|---|---|
| PR-1 | 0 | common 신규 9-10 파일 | 없음 | LOW | 3-4 days |
| PR-2 | 1 | quant adapter + deprecation | 없음 | LOW | 2-3 days |
| PR-3 | 2a | inventory/fulfillment Flyway baseline + order V2 | flyway_schema_history 신설 | MEDIUM | 5 days |
| PR-4 | 2b | 4 서비스 스키마 swap + Adapter 4 | 5-step swap, backup 테이블 | HIGH | 5 days |
| PR-5 | 3 | fulfillment 호출부 전환 | 없음 | LOW | 2-3 days |
| PR-6 | 3 | order 호출부 전환 | 없음 | MEDIUM | 2-3 days |
| PR-7 | 3 | product/StockSync 신규 적용 | 없음 | LOW | 2-3 days |
| PR-8 | 3 | inventory 3 핸들러 전환 | 없음 | HIGH | 5 days |
| PR-9 | 4 | cleanup 활성화 + dashboard + 알람 | cleanup job 동작 | LOW | 3 days |
| PR-10 | 4 | graceful degrade 제거 + backup DROP + ADR cross-ref + convention 문서 | backup 테이블 DROP | LOW | 2-3 days |
| (PR-11) | 4 | (선택) shedlock + cleanup 메트릭 polish | 없음 | LOW | 2 days |

→ **PR 10 + 1(선택) = 11 PR**, 총 ~33 working days (≈ 6.5 weeks).

---

## 15. 부록 B — TDD 순서 체크리스트

각 PR 별 TDD 순서:

1. **테스트 먼저 작성 (RED)** — 기대 동작을 Kotest BehaviorSpec 으로 표현
2. **최소 구현 (GREEN)** — 테스트 통과 코드만
3. **리팩터링** — 중복 제거, 네이밍 정리
4. **자가 검증** — `agent-os/standards/agent-behavior/self-review.md`
5. **PR 작성** — 본 plan 의 PR 단위 따름

PR-4 의 데이터 마이그레이션은 SQL 이라 TDD 적용 어려움 → staging dry-run + Before/After SELECT 비교로 대체.

---

## 16. 부록 C — Phase 별 Definition of Done

### Phase 0 DoD

- [ ] common:test 통과
- [ ] 다른 서비스 빌드 영향 zero
- [ ] CLAUDE.md (common) 업데이트

### Phase 1 DoD

- [ ] quant:app:build + test 통과
- [ ] adapter Bean 등록 검증
- [ ] 자체 헬퍼 deprecate annotation

### Phase 2a DoD

- [ ] 3 서비스 staging 정상 기동
- [ ] flyway_schema_history baseline V1 등재
- [ ] 기존 데이터 무손실

### Phase 2b DoD

- [ ] 4 서비스 staging swap 성공
- [ ] backup 테이블 보존
- [ ] PRIMARY index 사용 검증
- [ ] 기존 멱등 동작 무회귀

### Phase 3 DoD

- [ ] 5 컨슈머 모두 헬퍼 호출
- [ ] 통합 테스트 (Testcontainers) 통과
- [ ] 메트릭 노출
- [ ] staging 1주 운영 무사고

### Phase 4 DoD

- [ ] cleanup 동작 + retention 검증
- [ ] Grafana dashboard
- [ ] 알람 룰 4종
- [ ] ADR-0012 cross-ref
- [ ] convention 문서 신설

---

## 17. 부록 D — Verification Follow-up 흡수 매핑

| Verification Follow-up | 본 plan 의 흡수 위치 |
|---|---|
| §1 cleanup 스케줄러 미존재 | Phase 0 PR-1 (`IdempotentEventCleanupScheduler` 신설) + Phase 4 PR-9 (5 서비스 활성화) |
| §2 `InventoryStockSyncConsumer` 멱등 미적용 | Phase 2b PR-4 (product 측 신규 테이블/엔티티) + Phase 3 PR-7 (호출부 신규 적용) |
| §3 `addNotRetryableExceptions` 미적용 | **본 plan 범위 외** — ADR-0015 보강 별도 plan. §12.2 에 명시. |

---

## 18. 한 줄 요약

> ADR-0029 의 4가지 결정(헬퍼 추출 + PK 표준화 + Policy A + 7일 retention)을 11 PR / 6.5 sprint 로 분해. critical path = PR-1 → PR-3 → PR-4 → PR-8. 가장 큰 리스크는 PR-4 (DB 스키마 swap) + PR-8 (재고 컨슈머) — staging 검증 + PITR 백업 사전 확인 필수.
