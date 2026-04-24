---
spec: seven-split-crypto-trading
phase: 1 (backtest)
date: 2026-04-24
status: tasks-draft
depends-on:
  - planning/spec.md
  - planning/requirements.md
  - planning/test-quality.md
  - context/open-questions.yml
  - docs/adr/ADR-0024-seven-split-service.md
standards:
  - docs/standards/test-rules.md
  - docs/architecture/00.clean-architecture.md
  - docs/architecture/module-structure.md
  - docs/architecture/kafka-convention.md
  - docs/architecture/api-response.md
  - docs/adr/ADR-0014-code-convention.md
  - docs/adr/ADR-0019-k8s-migration.md
  - docs/adr/ADR-0020-transactional-usage.md
  - docs/adr/ADR-0021-logging-conventions.md
  - docs/adr/ADR-0022-entity-mutation-conventions.md
---

# Task Breakdown — seven-split-crypto-trading (Phase 1: 백테스트)

## Overview

본 문서는 `seven-split` 서비스의 **Phase 1 (백테스트 엔진) MVP** 구현 태스크 리스트이다. Phase 2 (페이퍼 트레이딩)와 Phase 3 (실매매)는 범위 밖이며, 별도 스펙/태스크 사이클로 진행한다. (tasks.md 말미 "Out of scope for Phase 1" 참조)

- **Total Task Groups**: 15 (+ Preflight 1)
- **Execution Order**: Preflight → TG-01 → TG-02/03 → TG-04 → TG-06 → TG-05 → TG-07 → TG-08 → TG-09 → TG-10 → TG-11 → TG-12 → TG-13 → TG-14 → TG-15
- **Complexity labels**: S (≤ half day) / M (~1 day) / L (~2–3 days) / XL (1 week+)
- **Phase**: `1-backtest` (모든 태스크)
- **Required Skills**: Kotlin, Spring Boot, JPA, Kotest, Coroutines, ClickHouse, Kafka, React/Vite, K8s(kustomize)

각 태스크는 "완료 = 한 PR"을 기준으로 쪼개져 있다. 한 태스크에는 구현 + 테스트 + DoD 체크리스트가 포함된다.

---

## Preflight — Phase 1 착수 전 blockers

> Phase 1 구현 착수 **전**에 반드시 closed 상태로 전환되어야 하는 선행 확인.

### P.0 OQ-011 거래소 약관 자동매매 허용 확인
- **Complexity**: S
- **산출물**: `docs/specs/2026-04-24-seven-split-crypto-trading/context/exchange-terms.md` (약관 조항 링크 + 발췌 요약)
- **의존**: 없음
- **DoD**:
  - [ ] 빗썸·업비트 OpenAPI 약관에서 자동매매 허용·금지 조항 캡처
  - [ ] 개인 운용 허용 범위 + 상업적 사용/재판매 제한 명시
  - [ ] `open-questions.yml` OQ-011 `status: closed` 로 갱신
- **Verification**: `grep -n "OQ-011" docs/specs/2026-04-24-seven-split-crypto-trading/context/open-questions.yml` → status closed 확인

### P.1 OQ-008 데이터 적재 파이프라인 설계 문서
- **Complexity**: S
- **산출물**: `docs/specs/2026-04-24-seven-split-crypto-trading/context/data-ingestion.md`
- **의존**: 없음
- **DoD**:
  - [ ] 빗썸 REST 히스토리 API 엔드포인트·파라미터·응답 스키마 정리
  - [ ] `seven_split.market_tick_bithumb` ClickHouse 스키마 제안 (PK/ORDER BY/TTL/partition 포함)
  - [ ] 증분·재수집·재처리 전략, 실패 재시도 규칙 명시
- **Verification**: 문서 존재 + ADR-0024 §12 ClickHouse 결정과 테이블 명명이 일치

---

## Task Groups

### Task Group TG-01: 서비스 부트스트랩 (Gradle + 패키지 + 버전 카탈로그)

**Dependencies**: Preflight P.0 closed
**Phase**: 1-backtest
**Complexity**: M
**Required Skills**: Gradle, Kotlin DSL

모듈·빌드·카탈로그를 먼저 올려 후속 TG가 실제 코드를 커밋할 수 있는 토대를 만든다.

- [x] TG-01.0 **Complete**: seven-split 서브모듈이 `./gradlew projects`에 등록되고 빈 `:seven-split:domain:test`, `:seven-split:app:bootJar` 이 성공한다. (2026-04-24 완료)
  - [x] TG-01.1 `settings.gradle.kts`에 `"seven-split:domain"`, `"seven-split:app"` include 추가
  - [x] TG-01.2 파일시스템 스캐폴드: `seven-split/domain/`, `seven-split/app/` 디렉토리 + 빈 `build.gradle.kts`
  - [x] TG-01.3 `seven-split/domain/build.gradle.kts`: Kotlin JVM only, 의존성 `common` 만 (Spring/JPA 없음) — `product/domain` 패턴 복제
  - [x] TG-01.4 `seven-split/app/build.gradle.kts`: Spring Boot 4.0.4 + Kotlin 2.2.21, `:seven-split:domain` + `common` + JPA/Web/Kafka/Redis starter — `analytics/app` 패턴 참고
  - [x] TG-01.5 `gradle/libs.versions.toml` 신규 라이브러리 카탈로그 편입:
    - `turbine`, `kotest-property`, `testcontainers-core`, `testcontainers-mysql`, `testcontainers-clickhouse`, `testcontainers-kafka`
    - 버전 섹션 추가 (turbine `1.1.0`, kotest-property `5.9.1` kotest와 동일, testcontainers `1.20.4` 계열)
  - [x] TG-01.6 패키지 루트 스캐폴드: `seven-split/app/src/main/kotlin/com/kgd/sevensplit/` + `SevenSplitApplication.kt` (`@SpringBootApplication`), `application.yml`/`application-kubernetes.yml` 빈 템플릿
  - [x] TG-01.7 domain 테스트 1개 더미 BehaviorSpec (`SmokeSpec`) 추가해서 빌드 파이프라인 확인
  - [x] TG-01.8 Jib 설정 (`jibBuildTar`) 추가 — 이미지 name `seven-split`, 기존 서비스 패턴 복제 (루트 `build.gradle.kts`의 `commerce.jib-convention`이 `spring-boot` 플러그인에 자동 적용되므로 별도 설정 불필요)
  - [x] TG-01.9 **Verify**: `./gradlew :seven-split:domain:test :seven-split:app:bootJar` 모두 성공 (2026-04-24 완료, SmokeSpec 1 passed, bootJar 생성 성공, domain 소스 Spring import 0건)

**Acceptance Criteria**:
- `./gradlew projects` 결과에 `:seven-split:domain`, `:seven-split:app` 포함
- domain 모듈에 Spring/JPA 의존이 전이되지 않음 (`./gradlew :seven-split:domain:dependencies --configuration runtimeClasspath` 로 확인)
- `libs.turbine`, `libs.kotest.property`, `libs.testcontainers.*` 참조가 domain/app 빌드에서 해소됨
- `CLAUDE.md` Navigation 서비스 표에 seven-split CLAUDE.md 자리 표기 (실제 CLAUDE.md는 TG-14에서 생성)

---

### Task Group TG-02: 도메인 모델 + 상태머신 (SplitStrategy / StrategyRun / RoundSlot / Order)

**Dependencies**: TG-01
**Phase**: 1-backtest
**Complexity**: L
**Required Skills**: Kotlin, Clean Architecture, DDD

순수 도메인(`:seven-split:domain`)에 Aggregate/Entity/VO + 상태머신을 올린다. Spring/JPA/프레임워크 의존 금지. 부분체결(OQ-020)은 **별도 substate 없이 `RoundSlot`에 `filledQty / targetQty` 필드를 두어 partial fill을 표현**하는 방식으로 인라인 확정한다 (상태는 기존 5단계 유지: `EMPTY → PENDING_BUY → FILLED → PENDING_SELL → CLOSED → EMPTY`, `FILLED`은 `filledQty >= targetQty` 조건).

- [x] TG-02.0 **Complete**: domain 모듈에 Aggregate/Entity/VO + 상태 전이 메서드가 존재하고, domain 단위 테스트(다음 TG-03에서 작성)에서 호출 가능하다.
  - [x] TG-02.1 패키지 생성: `seven-split/domain/src/main/kotlin/com/kgd/sevensplit/domain/{strategy,slot,order,credential,notification}/` + `common/{Price.kt, Quantity.kt, TenantId.kt, ExecutionMode.kt}`
  - [x] TG-02.2 `SplitStrategyConfig` VO — `roundCount: Int`, `entryGapPercent: BigDecimal`, `takeProfitPercentPerRound: List<BigDecimal>`, `initialOrderAmount: BigDecimal`, `targetSymbol: String`, 생성자에서 INV-07 검증 (`roundCount ∈ [1,50]`, `entryGapPercent < 0`, 배열 길이 == roundCount, 모든 요소 > 0), 위반 시 `SplitStrategyConfigInvalidException : BusinessException`
  - [x] TG-02.3 `SplitStrategy` Aggregate Root — `strategyId`, `tenantId`, `SplitStrategyConfig`, `ExecutionMode`, `StrategyStatus`, 메서드: `activate()`, `pause()`, `resume()`, `liquidate(reason)`, `nextRoundEntryCondition(lastFilledRound): PriceCondition`
  - [x] TG-02.4 `StrategyStatus` enum + 전이 테이블(`DRAFT → ACTIVE → PAUSED → LIQUIDATED → ARCHIVED`), 허용되지 않은 전이 시 `IllegalStrategyTransitionException`
  - [x] TG-02.5 `StrategyRun` Entity — `runId`, `strategyId`, `tenantId`, `startedAt`, `endedAt`, `ExecutionMode`, `seed`, `EndReason?`, `status: StrategyRunStatus`. 메서드: `end(reason: EndReason)`(endedAt 세팅), `enterAwaitingExhausted()`, `backToActive()`
  - [x] TG-02.6 `StrategyRunStatus` enum: `INITIALIZED → ACTIVE → (ACTIVE ↔ AWAITING_EXHAUSTED) → LIQUIDATING → CLOSED`
  - [x] TG-02.7 `RoundSlot` Entity — `slotId`, `runId`, `roundIndex`, `state: RoundSlotState`, `entryPrice: Price?`, `targetQty: Quantity`, `filledQty: Quantity`, `takeProfitPercent: BigDecimal`. 메서드: `requestBuy(price)`, `fillBuy(executedPrice, executedQty)` (partial fill 누적, `filledQty >= targetQty`이면 `FILLED` 전이), `requestSell()`, `fillSell(executedPrice)` precondition 검증(INV-02, 위반 시 `StopLossAttemptException`)
  - [x] TG-02.8 `RoundSlotState` enum + 전이 가드 (`EMPTY → PENDING_BUY → FILLED → PENDING_SELL → CLOSED → EMPTY`)
  - [x] TG-02.9 `Order` Entity — `orderId: UUID`(v7 권장), `slotId`, `side: OrderSide`, `orderType: SpotOrderType`(margin/future 컴파일 불가), `quantity`, `price`, `status: OrderStatus`, `exchangeOrderId: String?`. `OrderStatus`: `ACCEPTED → SUBMITTED → PARTIALLY_FILLED → FILLED | REJECTED | CANCELLED`
  - [x] TG-02.10 `ExchangeCredential` Aggregate — `credentialId`, `tenantId`, `exchange`, `apiKeyCipher: ByteArray`, `apiSecretCipher: ByteArray`, `passphraseCipher: ByteArray?`, `ipWhitelist: List<String>`. 평문 필드 노출 금지(`toString()` override로 마스킹)
  - [x] TG-02.11 `NotificationTarget` VO — `tenantId`, `channel: NotificationChannel`, `botTokenCipher: ByteArray`, `chatId: String`
  - [x] TG-02.12 도메인 이벤트 sealed class 계층 `DomainEvent` + 구현(`StrategyActivated`, `StrategyPaused`, `StrategyResumed`, `StrategyLiquidated`, `RoundSlotOpened`, `RoundSlotClosed`, `OrderPlaced`, `OrderFilled`, `OrderPartiallyFilled`, `OrderFailed`, `OrderCancelled`, `RiskLimitBreached`, `EmergencyLiquidationTriggered`, `ExchangeConnectionDegraded`, `ExchangeConnectionRestored`)
  - [x] TG-02.13 `BusinessException` 파생 도메인 예외 정리: `SplitStrategyConfigInvalidException`, `IllegalStrategyTransitionException`, `IllegalSlotTransitionException`, `StopLossAttemptException`, `LeverageAttemptException`
  - [x] TG-02.14 **Verify**: `./gradlew :seven-split:domain:compileKotlin` 성공, domain 모듈이 Spring/JPA 의존성을 포함하지 않음을 `./gradlew :seven-split:domain:dependencies --configuration compileClasspath` 로 재확인

**Acceptance Criteria**:
- 모든 Aggregate/Entity가 프레임워크 애노테이션 없이 순수 Kotlin으로 컴파일됨
- `RoundSlot`의 상태 전이는 `private set` 또는 메서드 호출로만 가능 (ADR-0022 캡슐화)
- `OrderCommand.orderType`은 sealed class로 `SpotOrderType`만 허용 (margin/future 컴파일 시점 차단)
- 모든 도메인 이벤트가 `DomainEvent` sealed 계층에 속함

---

### Task Group TG-03: 도메인 불변식 Property-based 테스트 (INV-01 ~ INV-07)

**Dependencies**: TG-02
**Phase**: 1-backtest
**Complexity**: M
**Required Skills**: Kotest, kotest-property, Property-based testing

`test-quality.md §5` 정합성 불변식을 kotest-property로 강제한다. `:seven-split:domain` 테스트 소스셋에만 위치하며 Spring context를 로드하지 않는다. 테스트는 각 INV당 1개 핵심 property + behavioural Given/When/Then 1~2개로 구성, 과도한 exhaustive 테스트는 지양한다 (2~8 focused tests 원칙).

- [ ] TG-03.0 **Complete**: `./gradlew :seven-split:domain:test` 실행 시 INV-01 ~ INV-07 모두 green.
  - [ ] TG-03.1 `fixtures/SplitFixtures.kt` — `arbSplitStrategyConfig()`, `arbRoundSlot()`, `arbPriceTick()` Kotest Arb 제공, 공유 가변 상태 금지
  - [ ] TG-03.2 `SplitStrategyConfigPropertySpec` — INV-07 검증: 생성 가능한 모든 조합이 `roundCount ∈ [1,50]`, `entryGapPercent < 0`, `takeProfitPercentPerRound` 각 원소 > 0 이고 길이 = roundCount. 경계값 및 위반 입력에 대해 예외 발생
  - [ ] TG-03.3 `NoStopLossInvariantSpec` — INV-01: 임의의 가격 경로(급락 포함)에서 `SplitStrategy` 시뮬 실행 후 수집된 `DomainEvent` 목록에 `StopLoss*`류 이벤트가 0건임을 확인
  - [ ] TG-03.4 `RoundSlotIndependentSellSpec` — INV-02: 슬롯 i의 `fillSell`은 슬롯 i의 `entryPrice`에만 의존. 평균단가를 주입해도 매도 precondition이 참조하지 않음을 확인 (mock Context)
  - [ ] TG-03.5 `EqualOrderAmountSpec` — INV-03: 모든 회차 `Order.quantity * Order.price` 명목이 `initialOrderAmount` 와 일치(부분체결 보정은 별도). 부분체결 반복 케이스도 목표 명목은 동일
  - [ ] TG-03.6 `RoundSlotStateTransitionSpec` — 허용된 전이 path만 성공, 나머지는 `IllegalSlotTransitionException`. BehaviorSpec Given/When/Then 서술
  - [ ] TG-03.7 `IdempotentOrderSpec` — INV-06: 동일 `orderId`를 2회 이상 전송할 때 도메인 수준에서 생성 가능한 `OrderPlaced` 이벤트가 1회만 쌓이는지 확인 (실 거래소 검증은 TG-05/TG-09에서)
  - [ ] TG-03.8 `LeverageForbiddenSpec` — 원칙 2: margin/future 주문 타입 사용 시 컴파일 에러 또는 런타임 `LeverageAttemptException`. Kotlin 시그니처 + sealed class 경로
  - [ ] TG-03.9 **Verify**: `./gradlew :seven-split:domain:test --tests '*PropertySpec' --tests '*InvariantSpec'` 전부 성공

**Acceptance Criteria**:
- 7종 불변식 테스트가 각각 전용 Spec 파일로 존재
- kotest-property Arb 기반 생성 시드 수는 기본값 사용, flaky가 감지되면 시드 고정
- 테스트 전체 실행 시간 < 30초 (도메인 단위)

---

### Task Group TG-04: Port 인터페이스 정의 (Hexagonal)

**Dependencies**: TG-02
**Phase**: 1-backtest
**Complexity**: S
**Required Skills**: Kotlin, Coroutines, Hexagonal Architecture

Application/Infrastructure가 구현할 Port를 먼저 선언하여 후속 TG(엔진/영속/외부 연동)가 병렬 가능한 계약을 확보한다. 모든 Repository port는 `tenantId`를 강제 시그니처에 포함(INV-05).

- [ ] TG-04.0 **Complete**: port 인터페이스만으로 컴파일되고, 각 port에 Kdoc 시그니처/계약/에러 조건이 기술됨.
  - [ ] TG-04.1 `com.kgd.sevensplit.domain.common.Clock` — `fun now(): Instant`, 테스트용 `FakeClock` 구현 domain test 소스셋에 동반
  - [ ] TG-04.2 `com.kgd.sevensplit.application.exchange.ExchangeAdapter` (application layer) — `suspend fun placeOrder(cmd: OrderCommand): OrderAck`, `suspend fun cancelOrder(tenantId, exchangeOrderId)`, `suspend fun fetchBalance(tenantId, exchange): Balance`, `suspend fun fetchExecution(orderId: UUID): ExecutionReport?`
  - [ ] TG-04.3 `MarketDataSubscriber` port — `fun subscribe(symbol: Symbol): Flow<Tick>`, `fun fallbackPoll(symbol: Symbol): Flow<Tick>` (Phase 2 구현, Phase 1은 인터페이스만)
  - [ ] TG-04.4 `HistoricalMarketDataSource` port — `fun stream(symbol: Symbol, from: Instant, to: Instant, interval: BarInterval): Flow<Bar>`. Phase 1 백테스트 엔진의 입력
  - [ ] TG-04.5 `EventPublisher` port — `suspend fun publish(event: DomainEvent)`. Outbox append는 구현체 책임
  - [ ] TG-04.6 `CredentialVault` port — `suspend fun store(tenantId, exchange, plaintext): CredentialId`, `suspend fun load(tenantId, exchange): DecryptedCredential` — **복호 결과는 단명 wrapper, 절대 DTO/로그로 흐르지 않도록 wrapper에 `toString()` 마스킹**
  - [ ] TG-04.7 Repository ports: `StrategyRepositoryPort`, `StrategyRunRepositoryPort`, `RoundSlotRepositoryPort`, `OrderRepositoryPort`, `ExchangeCredentialRepositoryPort`, `OutboxRepositoryPort`, `BacktestRunRepositoryPort` — 모든 조회/저장 시그니처에 `tenantId: TenantId` 필수 파라미터
  - [ ] TG-04.8 `NotificationSender` port — `suspend fun send(tenantId, event: NotificationEvent): SendResult` (Phase 1 skeleton, Phase 2에서 Telegram adapter)
  - [ ] TG-04.9 **Verify**: `./gradlew :seven-split:domain:compileKotlin :seven-split:app:compileKotlin` 성공 + Kdoc missing 경고 0

**Acceptance Criteria**:
- 모든 Repository port 시그니처에 `tenantId` 파라미터 존재 — grep으로 확인 가능
- `ExchangeAdapter`/`MarketDataSubscriber` 메서드가 `suspend` 또는 `Flow` 반환 (blocking 금지)
- Port 인터페이스 위치: domain에 선언해야 하는 것(`Clock`, `EventPublisher`는 domain) vs application에 두는 것(`ExchangeAdapter`, `MarketDataSubscriber`, Repository 등)을 Kdoc에 표기

---

### Task Group TG-05: 백테스트 엔진 + BacktestExchangeAdapter (결정론)

**Dependencies**: TG-04, TG-06(ClickHouse 스키마 — fixture 구조 참조)
**Phase**: 1-backtest
**Complexity**: L
**Required Skills**: Kotlin Coroutines, Flow, 결정론 시뮬레이션

FR-PH-01에 따른 결정론 백테스트 엔진. `BacktestExchangeAdapter`(가상 체결) + `BacktestMarketDataSource`(`HistoricalMarketDataSource` 구현) + `StrategyExecutor`(엔진)로 구성. ClickHouse는 본 TG 테스트에서는 CSV fixture로 대체(`test-quality.md §2.4`).

- [ ] TG-05.0 **Complete**: 고정 시드·고정 fixture CSV 입력에 대해 결정론적으로 동일한 `StrategyRun` 결과(체결 리스트·실현 손익·종료 시각)를 산출한다.
  - [ ] TG-05.1 `StrategyExecutor` — `ExecutionMode`, `ExchangeAdapter`, `HistoricalMarketDataSource`(또는 실시간 Subscriber), `Clock`, `EventPublisher`를 주입받아 실행. Phase 1은 백테스트 전용 경로
  - [ ] TG-05.2 `BacktestExchangeAdapter : ExchangeAdapter` — placeOrder 호출 시 직전 tick 가격으로 즉시 체결(또는 slippage 0 기본), UUID v7 `orderId` idempotent 저장, 가상 잔고 관리
  - [ ] TG-05.3 `CsvHistoricalMarketDataSource : HistoricalMarketDataSource` — `src/test/resources/golden/bithumb/*.csv` 를 `Flow<Bar>`로 변환, timestamp 오름차순 보장
  - [ ] TG-05.4 `StrategyEngineLoop` — 각 Bar마다 (1) 매수 트리거 평가(FR-ENG-03) (2) 매도 트리거 평가(FR-ENG-04) (3) 전 회차 소진 감지(FR-ENG-06, `AWAITING_EXHAUSTED` 전이) (4) 도메인 이벤트 EventPublisher로 발행
  - [ ] TG-05.5 `FakeClock` 주입 경로 — Bar timestamp가 곧 현재시각이 되도록 엔진 내부에서 Clock 래핑. `Random` 시드도 명시 주입(`RandomSource(seed)`)
  - [ ] TG-05.6 **결정론 테스트**: 동일 입력(동일 CSV + 동일 config + 동일 seed)에 대해 2회 실행 후 이벤트 시퀀스·체결가·PnL이 완전히 일치(byte-level). 2개 시나리오(tight/volatile) 최소 커버
  - [ ] TG-05.7 **AWAITING_EXHAUSTED 시나리오 테스트**: 급락으로 모든 회차 소진 후 추가 하락 시 신규 매수 이벤트가 발행되지 않음
  - [ ] TG-05.8 **슬롯 재사용 테스트 (FR-ENG-05)**: 슬롯이 매도 완료 후 `EMPTY`로 복귀하고 추가 하락 시 재매수 트리거가 다시 성립
  - [ ] TG-05.9 **Verify**: `./gradlew :seven-split:app:test --tests '*BacktestEngineSpec*'` 성공, 실행 로그에 시드·입력 해시 기록

**Acceptance Criteria**:
- 두 번 실행 결과 byte-level diff 0
- `:seven-split:domain` 모듈에는 백테스트 구현 코드가 들어가지 않음(도메인은 순수)
- `BacktestExchangeAdapter`는 margin/future API를 호출하지 않음 (원칙 2)
- `AWAITING_EXHAUSTED` → 슬롯 매도 → `ACTIVE` 복귀 경로가 테스트로 보호됨

---

### Task Group TG-06: ClickHouse `seven_split` DB 스키마

**Dependencies**: TG-01
**Phase**: 1-backtest
**Complexity**: M
**Required Skills**: ClickHouse, SQL, Data modeling

ADR-0024 §12에 따라 analytics 인프라 재사용 + 별도 DB `seven_split`에 테이블 신설. Phase 1은 `market_tick_bithumb`(분봉) + `backtest_run` 중심. `execution_result`는 Phase 2/3에서 확장.

- [ ] TG-06.0 **Complete**: `seven-split/app/src/main/resources/clickhouse/seven_split/` 아래 스키마 DDL이 존재하고 Testcontainers에서 create가 성공한다.
  - [ ] TG-06.1 DDL 파일 `V001__create_database.sql` — `CREATE DATABASE IF NOT EXISTS seven_split`
  - [ ] TG-06.2 DDL 파일 `V002__market_tick_bithumb.sql` — 컬럼: `symbol String, ts DateTime64(3, 'UTC'), open Decimal(38,8), high Decimal(38,8), low Decimal(38,8), close Decimal(38,8), volume Decimal(38,8), interval LowCardinality(String), ingestedAt DateTime64(3,'UTC')`, `ENGINE = ReplacingMergeTree(ingestedAt)`, `PARTITION BY toYYYYMM(ts)`, `ORDER BY (symbol, interval, ts)`, TTL 정책(5년) — Phase 1에서는 TTL은 코멘트로만 두고 실제 적용은 OQ-008 해소 이후
  - [ ] TG-06.3 DDL 파일 `V003__backtest_run.sql` — `runId UUID, tenantId String, strategyId UUID, symbol String, configJson String, seed Int64, fromTs DateTime64(3,'UTC'), toTs DateTime64(3,'UTC'), realizedPnl Decimal(38,8), mdd Decimal(10,6), sharpe Decimal(10,6), fillCount UInt64, startedAt DateTime64(3,'UTC'), endedAt DateTime64(3,'UTC')`, `ENGINE = MergeTree`, `ORDER BY (tenantId, strategyId, startedAt)`
  - [ ] TG-06.4 DDL 파일 `V004__execution_result_placeholder.sql` — Phase 1 최소 스키마(체결 시계열 스텁), 실 테이블 확장은 Phase 2. 본 TG에서는 create만 확보
  - [ ] TG-06.5 `ClickHouseConfig` — 애플리케이션에서 사용할 JDBC/HTTP 클라이언트 설정, database = `seven_split` 고정
  - [ ] TG-06.6 Testcontainers `clickhouse/clickhouse-server` 이미지로 스키마 create 스모크 테스트 (`ClickHouseSchemaSmokeSpec`)
  - [ ] TG-06.7 fixture CSV → ClickHouse insert 유틸(나중 TG-07 배치에서 재사용)
  - [ ] TG-06.8 **Verify**: `./gradlew :seven-split:app:test --tests '*ClickHouseSchemaSmokeSpec*'` 성공

**Acceptance Criteria**:
- DB명이 `seven_split`이며 analytics DB를 직접 참조하지 않음 (grep으로 확인)
- `market_tick_bithumb` ORDER BY가 `(symbol, interval, ts)`이며 PK 중복 방지를 위해 ReplacingMergeTree 채택
- Phase 1 범위에서 `market_tick_bithumb`/`backtest_run` 2개 테이블이 필수 생성됨

---

### Task Group TG-07: 빗썸 REST 히스토리 배치 수집기 (BTC/KRW · ETH/KRW · 2023-01~현재 분봉)

**Dependencies**: TG-04, TG-06
**Phase**: 1-backtest
**Complexity**: L
**Required Skills**: Kotlin Coroutines, WebClient, 배치, ClickHouse insert

Q-D 확정 범위 수집 배치. 증분·재수집·재처리 전략은 `context/data-ingestion.md`(Preflight P.1)를 참조. REST 기반이며 Phase 1 외 WS 사용 금지.

- [ ] TG-07.0 **Complete**: `./gradlew :seven-split:app:bootRun --args='--spring.profiles.active=ingest-bithumb'` 또는 `BithumbHistoryIngestCommand` 수동 실행 시 대상 2종 × 2023-01~현재 분봉이 `seven_split.market_tick_bithumb`에 적재된다.
  - [ ] TG-07.1 `BithumbRestClient` — `suspend fun fetchCandles(symbol, interval, from, to): List<CandleResponse>`, WebClient + Coroutine, 공식 rate limit 여유분 내 백오프
  - [ ] TG-07.2 `BithumbHistoryIngestService` — 기간 슬라이싱(월 단위), 각 슬라이스 순차 호출, ClickHouse insert(배치 1k rows), 성공 시 `ingest_checkpoint` 테이블(or 메타 JSON) 갱신. 실패 슬라이스는 DLQ 파일로 기록
  - [ ] TG-07.3 증분 재실행 — checkpoint 이후부터만 호출. 재수집 플래그 옵션(`--force-reingest=symbol,from,to`)
  - [ ] TG-07.4 `CommandLineRunner` or Spring Boot `ApplicationRunner` 로 프로파일(`ingest-bithumb`) 활성화 시에만 기동
  - [ ] TG-07.5 단위 테스트: MockWebServer 로 빗썸 응답 스텁, 페이지네이션·빈 응답·5xx retry 3케이스 커버
  - [ ] TG-07.6 통합 스모크(nightly 태그): Testcontainers ClickHouse + MockWebServer 로 최소 1개월치 적재 → `SELECT count()` 검증
  - [ ] TG-07.7 로깅(ADR-0021): `logger.info { "bithumb ingest progress symbol=$s slice=$from..$to rows=$n" }` 람다 형식, API key/secret 출력 금지 (Phase 1은 public endpoint라 key 없음)
  - [ ] TG-07.8 **Verify**: 단위 테스트 + 통합 스모크 통과 + 수동 실행 후 `SELECT min(ts), max(ts), count() FROM seven_split.market_tick_bithumb WHERE symbol='BTC_KRW'` 로 2023-01 ~ 현재 범위 확인

**Acceptance Criteria**:
- 배치는 멱등 재실행 가능 (중복 insert 0 — ReplacingMergeTree + ORDER BY 키로 보장)
- 실패 슬라이스는 프로세스 재시작 시 이어 받기 가능 (checkpoint)
- 수집된 데이터로 TG-05 엔진이 돌아가 결과가 나옴 (TG-12 골든셋의 입력이 됨)

---

### Task Group TG-08: Persistence (JPA Entity / QueryDSL / Repository / Flyway)

**Dependencies**: TG-02, TG-04
**Phase**: 1-backtest
**Complexity**: L
**Required Skills**: JPA, QueryDSL, Flyway, MySQL

MySQL에 CRUD 상태 저장 + Outbox + 감사 로그. Phase 1은 전략/백테스트 실행 결과 저장이 핵심이며, 크레덴셜/주문 테이블은 스키마만 사전 마련(Phase 2/3에서 채움).

- [ ] TG-08.0 **Complete**: Flyway 마이그레이션 성공 + JPA 엔티티 CRUD 통합 테스트(Testcontainers MySQL) green.
  - [ ] TG-08.1 Flyway `V001__init.sql` — `split_strategy`, `strategy_run`, `round_slot`, `order`, `exchange_credential`, `notification_target`, `outbox`, `processed_event`, `audit_log` 테이블 생성. 모든 테이블에 `tenant_id VARCHAR(64) NOT NULL` + 인덱스 `(tenant_id, ...)`
  - [ ] TG-08.2 JPA Entity 매핑 — `SplitStrategyEntity`, `StrategyRunEntity`, `RoundSlotEntity`, `OrderEntity`, `ExchangeCredentialEntity`, `NotificationTargetEntity`, `OutboxEntity`, `ProcessedEventEntity`, `AuditLogEntity`. 도메인 모델은 Entity와 분리(infrastructure/persistence/mapper)
  - [ ] TG-08.3 JPA Repository 인터페이스 + QueryDSL 커스텀 쿼리. `@TenantAware` AOP 또는 JPA Filter(혹은 Repository 레이어에서 tenantId 필수 파라미터)로 INV-05 강제
  - [ ] TG-08.4 Mapper — `SplitStrategy ↔ SplitStrategyEntity`, `RoundSlot ↔ RoundSlotEntity` 등. 도메인 ↔ 엔티티 단방향 변환만 허용
  - [ ] TG-08.5 Adapter 구현(port → JPA): `JpaStrategyRepository : StrategyRepositoryPort`, `JpaRoundSlotRepository : RoundSlotRepositoryPort`, 등
  - [ ] TG-08.6 Outbox pattern — 상태 전이 트랜잭션 내 `OutboxEntity` insert, 별도 `OutboxPublisher` 스케줄러가 Kafka로 flush(Phase 1은 Kafka 실발행 토글 off, 테이블 append만 확인)
  - [ ] TG-08.7 Testcontainers MySQL 통합 테스트 — 전략 create → run start → slot open → order place → slot close 플로우 1종 + tenantId 격리 케이스 1종
  - [ ] TG-08.8 `@Transactional` 경계(ADR-0020): **외부 IO(거래소 REST 호출)는 트랜잭션 밖**. Repository adapter는 짧은 내부 트랜잭션만 유지. 클래스 레벨 `@Transactional` 금지
  - [ ] TG-08.9 **Verify**: `./gradlew :seven-split:app:test --tests '*JpaRepository*' --tests '*PersistenceIntegrationSpec*'` 성공

**Acceptance Criteria**:
- 모든 테이블에 `tenant_id` 컬럼 + 인덱스 존재
- Repository port 호출 시 tenantId 누락은 컴파일/런타임에서 차단
- Outbox + 상태 전이가 동일 트랜잭션에 포함됨(INV-04)
- `@Transactional` 클래스 레벨 사용 0건 (grep)

---

### Task Group TG-09: Application Service (전략 활성화 / 백테스트 실행 / 결과 집계)

**Dependencies**: TG-05, TG-08
**Phase**: 1-backtest
**Complexity**: M
**Required Skills**: Spring, UseCase, @Transactional(ADR-0020), Kotlin

Phase 1 UseCase: 전략 생성·조회·활성화(백테스트 시작)·백테스트 실행·결과 집계. 실시간/실매매/긴급청산 관련 UseCase는 Phase 2/3로 미룬다.

- [ ] TG-09.0 **Complete**: UseCase 단위 테스트(MockK로 port 대체)가 모두 green이며, 통합 테스트에서 실 백테스트 경로가 DB/ClickHouse에 결과를 남긴다.
  - [ ] TG-09.1 `CreateStrategyUseCase` — input DTO → `SplitStrategyConfig` 검증 → Repository 저장 → `StrategyCreated`(도메인 이벤트 필요 시) 또는 바로 API 응답
  - [ ] TG-09.2 `RunBacktestUseCase` — `tenantId`, `strategyId`, `from`, `to`, `seed?` 받아 `StrategyRun` 생성 → `StrategyExecutor` 실행(TG-05) → 결과 집계(실현 PnL / MDD / sharpe / 체결 수) → `strategy_run` + ClickHouse `backtest_run` 저장 → Outbox에 `StrategyActivated` + `StrategyLiquidated(Completed)` append. 외부 IO(ClickHouse read, Outbox append)는 트랜잭션 경계 분리
  - [ ] TG-09.3 `GetStrategyQuery`, `ListStrategiesQuery`, `GetStrategyDetailQuery` — tenantId 스코프, QueryDSL projection
  - [ ] TG-09.4 `GetBacktestRunsQuery`, `GetBacktestRunDetailQuery` — dashboard용, 정렬/필터
  - [ ] TG-09.5 Leaderboard read-model skeleton — `LeaderboardQuery`(수익률/MDD/fillCount 정렬, tenantId 내부 랭킹), 산식은 OQ-010 해소 전까지 "현재 기본값"으로 명시 (실현 PnL 절대값 기준)
  - [ ] TG-09.6 `ExecuteLiquidationUseCase`(Phase 3 진입 전에는 no-op stub + `NotImplementedInPhase1Exception`)
  - [ ] TG-09.7 단위 테스트: 각 UseCase 성공 경로 1 + 실패 경로 1 (예: 존재하지 않는 strategyId, tenantId mismatch) — 포커스 4~6개
  - [ ] TG-09.8 **Verify**: `./gradlew :seven-split:app:test --tests '*UseCaseSpec*'` 성공

**Acceptance Criteria**:
- UseCase는 port만 주입받고 infrastructure 구현에 직접 의존하지 않음 (Clean Architecture)
- `@Transactional` 은 메서드 레벨만 사용, 거래소/ClickHouse 호출은 txn 밖
- Leaderboard 쿼리는 tenantId 필터가 누락되면 compile 에러가 되도록 DAO 시그니처 강제

---

### Task Group TG-10: REST API (컨트롤러 / ApiResponse / MockMvc 슬라이스)

**Dependencies**: TG-09
**Phase**: 1-backtest
**Complexity**: M
**Required Skills**: Spring MVC, MockMvc, ApiResponse<T>

`spec.md §7` 엔드포인트 중 **Phase 1 최소 셋**만 구현: 전략 CRUD, 백테스트 제출, 조회, 리더보드 기본. 실매매/긴급청산/Credential API/Telegram API는 Phase 2/3로 미룬다.

- [ ] TG-10.0 **Complete**: Phase 1 엔드포인트가 `ApiResponse<T>` 포맷으로 응답하고, MockMvc 슬라이스 테스트가 green.
  - [ ] TG-10.1 `StrategyController` — `POST /api/v1/strategies`, `GET /api/v1/strategies`, `GET /api/v1/strategies/{id}`, `PATCH /api/v1/strategies/{id}` (paramter change, pause/resume)
  - [ ] TG-10.2 `BacktestController` — `POST /api/v1/backtests`, `GET /api/v1/strategies/{id}/runs`
  - [ ] TG-10.3 `DashboardController` — `GET /api/v1/dashboard/overview`, `GET /api/v1/dashboard/executions` (Phase 1은 백테스트 결과만 노출)
  - [ ] TG-10.4 `LeaderboardController` — `GET /api/v1/leaderboard`, `POST /api/v1/leaderboard/compare`
  - [ ] TG-10.5 `GlobalExceptionHandler` 확장 — `SplitStrategyConfigInvalidException`, `IllegalStrategyTransitionException`, `StopLossAttemptException`, `NotImplementedInPhase1Exception` 매핑
  - [ ] TG-10.6 `TenantIdHeaderArgumentResolver` — `X-User-Id` → `TenantId` 주입 (Gateway에서 JWT 검증 이후 헤더만 신뢰)
  - [ ] TG-10.7 MockMvc 슬라이스 테스트 (`@WebMvcTest`) — 컨트롤러별 happy path 1 + 403(다른 tenant) 1 + 400(config invalid) 1 = 3 × 4컨트롤러 ≤ 12 케이스, 포커스 6~8 커버
  - [ ] TG-10.8 **Verify**: `./gradlew :seven-split:app:test --tests '*ControllerSpec*'` 성공

**Acceptance Criteria**:
- 모든 응답이 `ApiResponse<T>` 래퍼 사용 (api-response.md 준수)
- 컨트롤러는 `@RequestHeader("X-User-Id")` 또는 resolver로 tenantId 획득, 서비스 호출 시 명시 전달
- 실매매/긴급청산 엔드포인트는 `501 Not Implemented` 또는 아예 미노출(Phase 1)

---

### Task Group TG-11: FE 스캐폴드 `seven-split/frontend/` (React + Vite)

**Dependencies**: TG-10
**Phase**: 1-backtest
**Complexity**: M
**Required Skills**: React, Vite, TypeScript, Vitest, frontend-design.md

A-06 확정대로 독립 FE 모듈. Phase 1은 백테스트 결과 열람 중심 최소 대시보드 + 전략 리스트/상세 + 리더보드 1페이지. `charting` 서비스 재사용 안 함.

- [ ] TG-11.0 **Complete**: `cd seven-split/frontend && npm install && npm run build` 성공 + `npm run test` (Vitest) green + 로컬 dev 서버에서 백엔드 API 연동 확인.
  - [ ] TG-11.1 Vite + React + TypeScript + React Router + TanStack Query 스캐폴드, 프로젝트 루트 `seven-split/frontend/`
  - [ ] TG-11.2 `src/api/client.ts` — `X-User-Id` 헤더 주입 (dev 환경에서는 고정값, 운영은 Gateway가 주입), `ApiResponse<T>` 언래핑 유틸
  - [ ] TG-11.3 `src/api/endpoints/` — `strategies.ts`, `backtests.ts`, `dashboard.ts`, `leaderboard.ts` TypeScript 타입 + fetch 함수
  - [ ] TG-11.4 라우트: `/strategies`(리스트), `/strategies/:id`(상세), `/backtests/new`(제출 폼), `/runs/:runId`(결과), `/leaderboard`(랭킹)
  - [ ] TG-11.5 최소 대시보드 컴포넌트: 회차 카드 그리드(Phase 1은 빈 상태), 체결 이력 테이블(백테스트 fill list), 수익률 그래프(Recharts 경량)
  - [ ] TG-11.6 `docs/conventions/frontend-design.md` 가드레일 준수: 타이포/색상/레이아웃/모션/접근성. Tailwind 설정 포함
  - [ ] TG-11.7 Vitest + React Testing Library 테스트 4~6개: API 클라이언트 mock, 리스트 렌더, 리더보드 정렬 토글, 에러 핸들링
  - [ ] TG-11.8 Playwright E2E는 본 TG 범위 밖 (Phase 2)
  - [ ] TG-11.9 **Verify**: `cd seven-split/frontend && npm run build && npm run test` 성공

**Acceptance Criteria**:
- FE 모듈이 `charting` 의존성 0 — `package.json` grep으로 확인
- `ApiResponse<T>` 포맷 언래핑이 일괄 처리됨
- 접근성 가드(lint) 통과

---

### Task Group TG-12: 골든셋 리그레션 테스트

**Dependencies**: TG-05, TG-07
**Phase**: 1-backtest
**Complexity**: M
**Required Skills**: Kotest, 결정론, JSON diff

`test-quality.md §4` 골든셋 정책 구현. 3종 시드(`tight`/`normal`/`volatile`) + `expected.json` + Gradle 커스텀 태스크 `goldenTest`.

- [ ] TG-12.0 **Complete**: `./gradlew :seven-split:app:goldenTest` 태스크가 3종 시드 모두 green.
  - [ ] TG-12.1 fixture CSV 3종 준비: `src/test/resources/golden/bithumb/btc-krw-2024-03-tight.csv`(좁은 변동폭), `btc-krw-2024-03-normal.csv`, `btc-krw-2024-03-volatile.csv`(급락 포함) — TG-07 수집 데이터 subset 또는 합성 데이터
  - [ ] TG-12.2 `expected.json` 3종 — 각 시드에 대해 `{totalFills, roundRotations: [..], realizedPnl, mdd, finalBalance}` 초기 생성(첫 실행 결과를 기준점으로 커밋, 이후 diff 비교)
  - [ ] TG-12.3 `GoldenSetSpec` — 각 시드 실행 후 실제 결과 JSON 을 expected.json 과 deep equals 비교, 불일치 시 상세 diff 출력
  - [ ] TG-12.4 Gradle 태스크 `goldenTest` — `:seven-split:app` 하위에 `test` 의 변종 태스크로 등록, 태그(`@Tag("golden")`) 필터링
  - [ ] TG-12.5 expected.json 업데이트 절차 문서화 — `seven-split/docs/golden-set-update.md` (TG-14에서 docs 생성 시 배치)
  - [ ] TG-12.6 CI PR 필수 체크에 goldenTest 포함 (gradle 태스크를 workflow에 추가 — 루트 `.github/workflows` 수정 필요 시 별도 변경)
  - [ ] TG-12.7 **Verify**: 고의로 엔진 상수 하나 변경 → goldenTest 실패 재현 → 원복 → 성공 재현

**Acceptance Criteria**:
- 3개 시드 모두 결정론 성공
- expected.json 변경은 반드시 ADR 또는 커밋 메시지에 근거 기록 (convention)
- goldenTest가 unit test와 분리되어 있음 (기본 test에는 포함되지 않거나 tag로 분리)

---

### Task Group TG-13: K8s k3s-lite overlay

**Dependencies**: TG-01, TG-08, TG-10
**Phase**: 1-backtest
**Complexity**: M
**Required Skills**: Kubernetes, kustomize, Jib

ADR-0019 Phase 2 배포 모드에 맞춰 `k8s/overlays/k3s-lite/seven-split/` overlay 작성. prod-k8s overlay는 Phase 3 직전 별도 TG.

- [ ] TG-13.0 **Complete**: `kubectl apply -k k8s/overlays/k3s-lite` 실행 시 seven-split Deployment/Service가 Ready 상태.
  - [ ] TG-13.1 `k8s/overlays/k3s-lite/seven-split/kustomization.yaml` + `deployment.yaml` + `service.yaml` + `configmap.yaml` + (필요시) `secret.yaml` 템플릿
  - [ ] TG-13.2 Redis standalone 전환: Phase 1은 Redis 사용 최소(HPA용 메트릭/rate limiter는 Phase 2+), 그러나 Spring Cluster 모드 기본 비활성화 — `SPRING_APPLICATION_JSON` 으로 standalone 지정(기존 5개 서비스 패턴 복제)
  - [ ] TG-13.3 ConfigMap — MySQL/Kafka/ClickHouse 엔드포인트, `SPRING_PROFILES_ACTIVE=kubernetes`, `SEVEN_SPLIT_CLICKHOUSE_DATABASE=seven_split`
  - [ ] TG-13.4 Secret stub — 거래소 API KEK/Telegram 토큰은 Phase 1 미사용이므로 빈 값, 구조만 준비
  - [ ] TG-13.5 Jib 이미지 빌드 확인 — `./gradlew :seven-split:app:jibBuildTar` → tar 산출 → `scripts/image-import.sh --all` 에 포함
  - [ ] TG-13.6 `image-import.sh` 가 seven-split 서비스를 인식하는지 확인(기존 스크립트 패턴 확장)
  - [ ] TG-13.7 k3d 로컬 클러스터에서 apply → `kubectl -n seven-split get pods` → Ready. `/actuator/health` GET 200 확인
  - [ ] TG-13.8 **Verify**: `kubectl apply -k k8s/overlays/k3s-lite` + `kubectl rollout status deployment/seven-split-app -n seven-split` 성공

**Acceptance Criteria**:
- overlay 파일 구조가 기존 서비스(product/order/search)와 일관됨
- `SPRING_PROFILES_ACTIVE=kubernetes` 주입됨
- Jib tar 기반 image-import.sh 흐름이 정상 작동
- prod-k8s overlay는 본 TG 범위 밖 (Phase 3)

---

### Task Group TG-14: 로깅·관측 + 서비스 문서(CLAUDE.md / docs/)

**Dependencies**: TG-09, TG-13
**Phase**: 1-backtest
**Complexity**: S
**Required Skills**: kotlin-logging, Micrometer, 문서화

ADR-0021 로깅 규칙 + Phase 1 최소 메트릭 + `seven-split/CLAUDE.md` + `seven-split/docs/` 신설. 루트 `CLAUDE.md` Navigation 표 업데이트.

- [ ] TG-14.0 **Complete**: 서비스 기동 시 `/actuator/prometheus` 에서 Phase 1 메트릭이 노출되며 `seven-split/CLAUDE.md`가 생성됨.
  - [ ] TG-14.1 kotlin-logging 설정 — 모든 로거는 `private val logger = KotlinLogging.logger {}`, 람다 형식만 허용, API key/secret 평문 출력 금지. Phase 1 lint 규칙 1개 (정규식 캡처) 추가 검토
  - [ ] TG-14.2 Micrometer 메트릭 Phase 1 subset:
    - `seven_split_strategy_evaluation_latency_seconds{mode="backtest"}` (p50/p95/p99)
    - `seven_split_backtest_run_total{status}`
    - `seven_split_backtest_run_duration_seconds`
    - `seven_split_ingest_bithumb_rows_total{symbol}`
    - `seven_split_outbox_pending_rows` (gauge)
  - [ ] TG-14.3 Outbox 테이블 모니터링 기본 — `OutboxEntity` 미발행 행 수 gauge 노출, 단순 알람 기준은 문서에만 명시
  - [ ] TG-14.4 `seven-split/CLAUDE.md` 작성 — 서비스 개요, Phase 로드맵, 모듈 구조, 주요 명령어, Navigation(spec/ADR/docs 링크)
  - [ ] TG-14.5 `seven-split/docs/` 초기 구조 — `README.md`(요약), `golden-set-update.md`(TG-12 참조), `ingest-bithumb.md`(TG-07 참조)
  - [ ] TG-14.6 루트 `CLAUDE.md` Navigation 표에 seven-split 항목 `(신규, Phase 1 진행 중)` 으로 업데이트 (기존 "미생성" → 경로 지정)
  - [ ] TG-14.7 **Verify**: `./gradlew :seven-split:app:bootRun --args='--spring.profiles.active=local'` 기동 후 `curl localhost:<port>/actuator/prometheus | grep seven_split` 최소 3개 메트릭 노출

**Acceptance Criteria**:
- `logger.{info,debug,warn}` 호출이 모두 람다 형식 (grep 기반 검사 통과)
- Phase 1 메트릭 5종 이상 노출
- `seven-split/CLAUDE.md` 존재 + 루트 Navigation 갱신
- API key / Bot token 관련 로그 캡처 시 평문 미노출 검증 테스트 1개(`SensitiveDataMaskingSpec`)

---

### Task Group TG-15: Phase 1 통합 E2E + Readiness Checklist

**Dependencies**: TG-07, TG-09, TG-10, TG-11, TG-12, TG-13, TG-14
**Phase**: 1-backtest
**Complexity**: L
**Required Skills**: Testcontainers, E2E, 통합 검증

**3개월분(예: 2024-01 ~ 2024-03) BTC/KRW 분봉 → ClickHouse 적재 → 백테스트 실행 → 결과 API 조회 → FE 렌더** 전체 종단 시나리오를 1개의 통합 스위트로 검증 + Phase 1 완료 체크리스트.

- [ ] TG-15.0 **Complete**: E2E 통합 테스트 green + Readiness Checklist 모두 통과.
  - [ ] TG-15.1 `SevenSplitPhase1E2ESpec` (Testcontainers 기반 MySQL + ClickHouse + Kafka) — 시나리오:
    1. `TestDataSeeder` 가 3개월 분봉 CSV → ClickHouse insert
    2. `POST /api/v1/strategies` 로 전략 생성(roundCount=7, entryGapPercent=-3, takeProfit=+5 균등)
    3. `POST /api/v1/backtests` 실행
    4. `GET /api/v1/strategies/{id}/runs` 로 결과 조회 — fillCount > 0, realizedPnl 계산, MDD 계산
    5. Outbox 테이블에 `StrategyActivated`/`StrategyLiquidated(Completed)` 이벤트 존재
    6. ClickHouse `seven_split.backtest_run` 테이블에 실행 메타 저장 확인
  - [ ] TG-15.2 결정론 재실행 체크 — 동일 전략 + 동일 기간 2회 백테스트 시 결과 완전 일치(시드 고정)
  - [ ] TG-15.3 FE dev 서버 + 백엔드 dev 서버 수동 검증 스크립트 — 전략 생성 → 백테스트 → `/runs/:runId` 결과 페이지 렌더 체크리스트(`seven-split/docs/phase1-readiness.md`)
  - [ ] TG-15.4 Readiness Checklist 문서 `seven-split/docs/phase1-readiness.md`:
    - [ ] 모든 TG 완료
    - [ ] `./gradlew :seven-split:domain:test :seven-split:app:test :seven-split:app:goldenTest` 성공
    - [ ] `kubectl apply -k k8s/overlays/k3s-lite` seven-split Ready
    - [ ] `/actuator/health`, `/actuator/prometheus` 정상
    - [ ] 빗썸 분봉 2023-01~현재 BTC/KRW, ETH/KRW 적재 완료
    - [ ] 골든셋 3종 green
    - [ ] 서비스 CLAUDE.md + docs 존재, 루트 Navigation 갱신
    - [ ] ADR-0024 Status 가 Proposed → Accepted 전환 검토 (본 TG 완료 후 별도 PR로)
    - [ ] Preflight P.0/P.1 closed 재확인
  - [ ] TG-15.5 릴리즈 노트 초안 `docs/specs/2026-04-24-seven-split-crypto-trading/phase1-release-notes.md` — 구현된 FR/NFR 목록 + 범위 밖 항목 + Phase 2 Preflight 후보(OQ-007/017/018)
  - [ ] TG-15.6 **Verify**: `./gradlew :seven-split:app:test --tests '*Phase1E2ESpec*'` + Readiness Checklist 전 항목 수동 체크 + 최종 PR 리뷰

**Acceptance Criteria**:
- E2E 시나리오가 통합 테스트 1본으로 재현 가능
- 결정론 재실행 결과 일치
- Readiness Checklist의 모든 항목이 objective하게 측정 가능
- Phase 2 착수를 위한 Preflight 목록(OQ-007/017/018)이 명시됨

---

## Execution Order

Preflight 가 닫힌 뒤, TG 간 의존성은 다음과 같다:

```
Preflight P.0 (OQ-011), P.1 (OQ-008)
        │
        ▼
      TG-01 (서비스 부트스트랩)
        │
        ├─► TG-02 (도메인 모델)
        │     │
        │     ├─► TG-03 (불변식 PBT)
        │     │
        │     └─► TG-04 (Port 정의)
        │             │
        │             ├─► TG-06 (ClickHouse 스키마)
        │             │     │
        │             │     └─► TG-05 (백테스트 엔진) ◄── TG-06 fixture 필요
        │             │             │
        │             │             └─► TG-07 (빗썸 수집 배치)
        │             │                     │
        │             └─► TG-08 (Persistence/JPA/Flyway)
        │                     │
        │                     └─► TG-09 (Application Service)
        │                             │
        │                             └─► TG-10 (REST API)
        │                                     │
        │                                     └─► TG-11 (FE 스캐폴드)
        │
        ├─► TG-12 (골든셋 리그레션)        [TG-05, TG-07 이후]
        │
        ├─► TG-13 (K8s k3s-lite overlay)   [TG-01, TG-08, TG-10 이후]
        │
        ├─► TG-14 (로깅/관측/CLAUDE.md)    [TG-09, TG-13 이후]
        │
        └─► TG-15 (통합 E2E + Readiness)   [TG-07, TG-09~14 이후, 최종]
```

병렬화 가이드:
- TG-03, TG-04는 TG-02 완료 후 동시에 진행 가능
- TG-06, TG-08은 TG-04 완료 후 동시에 진행 가능
- TG-07, TG-09는 각각 TG-05, TG-08 완료 후 동시에 진행 가능
- TG-12, TG-13, TG-14는 TG-09/10 완료 후 동시에 진행 가능

---

## Out of Scope for Phase 1 (Phase 2/3 이관 대상)

본 tasks.md는 Phase 1(백테스트) MVP 구현만 포괄한다. 다음 항목은 본 문서에서 명시적으로 제외한다.

### Phase 2 — 페이퍼 트레이딩 착수 시 TG 재구성 대상
- `MarketDataSubscriber` WebSocket 실 구현 (빗썸/업비트 public 시세)
- REST 폴백(10s 규칙) 실 동작 검증
- `SimulatedExchangeAdapter` (슬리피지/지연 파라미터화)
- 텔레그램 봇 알림 어댑터 (`NotificationSender` 구현)
- CircuitBreaker (resilience4j-kotlin 카탈로그 승격)
- Rate Limiter (Redis Lua 또는 bucket4j)
- KEK 회전 정책 (OQ-017)
- `audit_log` 불변성 보장 방식 (OQ-018)
- `processed_event` 테이블 기반 멱등 컨슈머 실 운영
- Kafka 토픽 실 발행 활성화 (Phase 1은 Outbox append까지)
- 이벤트 버스 in-process vs Kafka 결정 (OQ-007)
- 대시보드/리더보드 실시간 갱신(WebSocket or SSE)

### Phase 3 — 실매매 착수 시 TG 재구성 대상
- `BithumbExchangeAdapter` 실주문/취소/조회 실 구현
- `UpbitExchangeAdapter` 신규
- 긴급 청산/kill-switch (FR-RISK-02, OQ-013)
- 유저별 손실 한도 강제 (OQ-012)
- 실매매 Role + step-up 2FA (OQ-016)
- 주문 reconcile 절차 (OQ-014)
- 부분체결 복구 정책 확정 (OQ-003 — Phase 1은 OQ-020 `filledQty/targetQty` 인라인 결정에 한정)
- 빗썸/업비트 공식 Rate Limit 상수 (OQ-004)
- Gateway 우회 방지 NetworkPolicy / mTLS (OQ-015)
- `k8s/overlays/prod-k8s/seven-split/` overlay (HPA/PDB/TLS/NetworkPolicy)
- 페이퍼 → 실매매 정량 승격 게이트 (OQ-019)
- 외부 오픈 전 법적 검토 (OQ-005)
- 리더보드 점수 산식 확정 (OQ-010)
- 공개 리더보드 / SaaS 상용화 (Out of scope 영구)

### Phase 4+ (아이디어 레벨)
- 이메일 알림 (Phase 2+), 웹/모바일 푸시 (Phase 4+)
- ATR 동적 간격 %
- 고점 대비 -x% 대기 최초 진입 옵션
- 1번(quant-trader)과 `trading-core` 공통 모듈 추출

---

## Summary

- **Total Task Groups**: 15 (+ Preflight 2: P.0, P.1)
- **Total Checkbox sub-tasks**: 약 130개 (각 TG.N Verify 포함)
- **Phase 1 예상 기간**: 4~6주 (엔지니어 1명 기준, 외부 블로커 OQ-011/008 해소 후 산정)
- **Critical path**: Preflight → TG-01 → TG-02 → TG-04 → TG-06 → TG-05 → TG-07 → TG-09 → TG-10 → TG-15
- **Parallelizable**: TG-03/TG-04, TG-06/TG-08, TG-07/TG-09, TG-12/TG-13/TG-14
- **Out-of-scope 합의**: 위 Phase 2/3/4 목록은 별도 spec/ADR로 관리, 본 tasks.md 범위에서 제외

Phase 1 완료 = TG-15 Readiness Checklist 전 항목 green + ADR-0024 Status `Proposed → Accepted` 전환 PR 머지.
