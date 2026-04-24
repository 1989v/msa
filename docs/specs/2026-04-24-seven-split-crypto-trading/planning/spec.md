---
spec: seven-split-crypto-trading
date: 2026-04-24
updated: 2026-04-24 (post review-1)
status: spec-draft
depends-on:
  - planning/initialization.md
  - planning/requirements.md
  - planning/test-quality.md
  - context/open-questions.yml
  - ideabank/docs/12-seven-split-crypto.md
standards:
  - docs/architecture/00.clean-architecture.md
  - docs/architecture/module-structure.md
  - docs/architecture/kafka-convention.md
  - docs/architecture/api-response.md
  - docs/adr/ADR-0002-language-and-framework.md
  - docs/adr/ADR-0012-idempotent-consumer.md
  - docs/adr/ADR-0014-code-convention.md
  - docs/adr/ADR-0015-resilience-strategy.md
  - docs/adr/ADR-0019-k8s-migration.md
  - docs/adr/ADR-0020-transactional-usage.md
  - docs/adr/ADR-0021-logging-conventions.md
  - docs/adr/ADR-0022-entity-mutation-conventions.md
---

# Specification — seven-split-crypto-trading

> Last revised: 2026-04-24 (post review-1)

## 1. Overview & Goals

박성현 『세븐 스플릿』의 정통 7원칙(특히 원칙 5·6·7: 직전 회차 대비 -3% 추가매수, 회차별 동일 매수 금액, 손절 없음)을 빗썸/업비트 현물 암호화폐 거래에 적용하는 **자동매매 웹 서비스**를 구축한다. 변동성을 리스크가 아닌 **회차별 독립 익절 기회**로 전환해 꾸준한 현금흐름을 만드는 것이 제품의 존재 이유다.

운영 초기에는 본인 1인 1계정(MVP)이지만 코드와 데이터는 `tenantId` 격리 멀티테넌트 구조로 시작한다. **백테스트 → 페이퍼 트레이딩 → 실매매** 세 모드를 하나의 전략 엔진 코드가 다형적으로 처리하고, 모드는 런타임 주입(`ExecutionMode`)으로만 달라진다. SLO는 틱 → 주문 송신 p95 500ms, WS 끊김 5s/10s 복구, 30일 분봉 5분 재생이며, 공개 랭킹이 아닌 **본인 용도 리더보드 + 대시보드 + 체결 타임라인**을 MVP에 포함한다.

---

## 2. Architecture

### 2.1 레이어 (Clean Architecture)

의존성 방향: `Presentation → Application → Domain ← Infrastructure` (docs/architecture/00.clean-architecture.md 준수). Domain은 Spring/JPA/WebClient 금지.

### 2.2 중첩 서브모듈 (`module-structure.md` 컨벤션)

| Gradle 경로 | 파일시스템 | 역할 |
|---|---|---|
| `:seven-split:domain` | `seven-split/domain/` | 순수 도메인: `SplitStrategy`, `RoundSlot`, 트리거 정책, 도메인 이벤트 |
| `:seven-split:app` | `seven-split/app/` | Spring Boot: UseCase, Port, Infrastructure Adapter, REST |

`:seven-split:domain` 의존: `common` (BusinessException/ErrorCode) 한정. Spring 의존성 없음.
`:seven-split:app` 의존: `:seven-split:domain` + `common` + Spring Boot 4.0.4 / Kotlin 2.2.21 / Java 25 런타임 (ADR-0002).

### 2.3 런타임 혼용 (ADR-0002)

- Tomcat 요청 처리: 가상 스레드 (`spring.threads.virtual.enabled=true`) — 전략 인스턴스 대량 모니터링 시 블로킹 스레드 병목 방지
- 내부 DB(JPA/QueryDSL): blocking
- **거래소 REST 호출**: `WebClient` + Kotlin Coroutine `suspend`
- **거래소 WebSocket 시세**: Coroutine `Flow` (SharedFlow 팬아웃)
- **WebFlux 도입 금지** (ADR-0002). Gateway만 예외.

### 2.4 패키지 (`com.kgd.sevensplit.*`)

```
com.kgd.sevensplit/
├── domain/
│   ├── strategy/   (model, policy, event, exception)
│   ├── slot/       (RoundSlot 상태머신)
│   ├── order/      (Order, idempotent key)
│   └── credential/ (ExchangeCredential 도메인 규칙)
├── application/
│   └── {strategy|slot|order|market|notification}/
│       ├── usecase/ port/ service/ dto/
├── infrastructure/
│   ├── persistence/  (JPA + QueryDSL)
│   ├── client/       (Bithumb/Upbit Adapter, Telegram)
│   ├── messaging/    (Kafka Producer + Outbox publisher)
│   ├── stream/       (WebSocket subscriber, Flow 버스)
│   └── config/
└── presentation/
    └── {strategy|dashboard|leaderboard|admin}/
```

> 네이밍 주의: 기존 플랫폼 컨벤션(서비스 식별자에 underscore 없음)을 따라 `com.kgd.sevensplit` (snake_case 금지) 사용.

---

## 3. Domain Model

### 3.1 Aggregate & Entity

| 이름 | 타입 | 주요 속성 | 불변식 |
|---|---|---|---|
| `SplitStrategy` | Aggregate Root | `strategyId`, `tenantId`, `targetSymbol`, `SplitStrategyConfig`, `ExecutionMode`, `StrategyStatus` | `roundCount ∈ [1,50]`, `entryGapPercent < 0`, 모든 `takeProfitPercentPerRound[i] > 0` (INV-07) |
| `SplitStrategyConfig` | Value Object | `roundCount`, `entryGapPercent`, `takeProfitPercentPerRound: List<BigDecimal>`, `initialOrderAmount`, 위험한도 | 회차별 익절 배열 길이 = roundCount, 모든 회차 매수 명목 동일 (INV-03) |
| `StrategyRun` | Entity (라운드 실행 인스턴스) | `runId`, `strategyId`, `tenantId`, `startedAt`, `endedAt`, `ExecutionMode`, `seed`, `EndReason?` | 동일 `runId` 재실행 금지. `end(reason)` 호출 시에만 `endedAt` 세팅 |
| `RoundSlot` | Entity | `slotId`, `runId`, `roundIndex`, `state`, `entryPrice`, `quantity`, `takeProfitPercent` | 상태 전이: `EMPTY → PENDING_BUY → FILLED → PENDING_SELL → CLOSED → EMPTY` (FR-ENG-05, ADR-0022 캡슐화) |
| `Order` | Entity | `orderId`(UUID v7, idempotent), `slotId`, `side`, `quantity`, `price`, `status`, `exchangeOrderId` | 동일 `orderId` 재전송 시 거래소 신규 주문 금지 (INV-06) |
| `ExchangeCredential` | Aggregate Root | `credentialId`, `tenantId`, `exchange`, `apiKeyCipher`, `apiSecretCipher`, `passphraseCipher?`, `ipWhitelist` | AES-GCM 봉투 암호화 후 저장, 평문 로그/응답 금지 |
| `NotificationTarget` | Value Object | `tenantId`, `channel`, `botTokenCipher`, `chatId` | AES-GCM 봉투 암호화 (OQ-009) |
| `ExecutionResult` | Read-Model | 리더보드용 집계(수익률/MDD/샤프/체결수) | 산식은 OQ-010에서 확정 후 고정 |

**`StrategyRun` 종료 조건**:
- `StrategyRun.end(reason: EndReason)` 호출 시점에 `endedAt` 세팅.
- `enum EndReason { Liquidated, Paused, Completed, Archived }`
- 세팅 조건: **수동 청산 / 백테스트 데이터 소진 / 사용자 아카이브** 중 하나일 때만 종료 처리.

### 3.2 상태머신

- `StrategyStatus`: `DRAFT → ACTIVE → PAUSED → LIQUIDATED → ARCHIVED`
- `StrategyRun.status`: `INITIALIZED → ACTIVE → (ACTIVE ↔ AWAITING_EXHAUSTED) → LIQUIDATING → CLOSED`
  - `AWAITING_EXHAUSTED`: 모든 슬롯이 `FILLED` 상태일 때 진입 (FR-ENG-06). 이 상태에서는 신규 매수 트리거가 중단되며, 어떤 슬롯이라도 매도되어 `EMPTY` 복귀하면 `ACTIVE`로 복귀. 손절 없음(원칙 7).
- `RoundSlot.state`: `EMPTY → PENDING_BUY → FILLED → PENDING_SELL → CLOSED → EMPTY` (`EMPTY` 복귀 시 재사용)
- `Order.status`: `ACCEPTED → SUBMITTED → PARTIALLY_FILLED → FILLED | REJECTED | CANCELLED`
- **INV-01 손절 없음**: 어떤 경로로도 `StopLoss`/`StopLossTriggered` 이벤트/상태가 발생하지 않는다 (속성 기반 테스트로 강제).

### 3.3 도메인 이벤트

모든 이벤트는 Outbox append-only 후 Kafka 발행(FR-ENG-07):

- `StrategyActivated`, `StrategyPaused`, `StrategyResumed`, `StrategyLiquidated`
- `RoundSlotOpened`, `RoundSlotClosed`
- `OrderPlaced`, `OrderFilled`, `OrderPartiallyFilled`, `OrderFailed`, `OrderCancelled`
- `RiskLimitBreached`, `EmergencyLiquidationTriggered`
- `ExchangeConnectionDegraded` (WS → REST 폴백 전환), `ExchangeConnectionRestored`

### 3.4 도메인 규약 (Domain Contract)

- **매수 트리거 (FR-ENG-03)**: `currentPrice ≤ lastFilledEntryPrice × (1 + entryGapPercent/100)` 충족 시 다음 회차 매수 발행. `lastFilledEntryPrice`는 가장 최근 체결된 회차의 entryPrice (번호상 마지막 아님).
- **매도 트리거 (FR-ENG-04, INV-02)**: 슬롯 i의 매도는 `slot_i.entryPrice × (1 + takeProfitPercentPerRound[i]/100) ≤ currentPrice` 일 때만 — 평균단가 참조 금지.
- **전 회차 소진 시 (FR-ENG-06)**: 모든 슬롯이 `FILLED` 상태면 `StrategyRun.status = AWAITING_EXHAUSTED` 로 전이, 신규 매수 발행 중단, 손절 없음 (원칙 7).
- **도메인 메서드 시그니처**:
  - `RoundSlot.evaluateSellTrigger(tick: Price): SellDecision`
  - `SplitStrategy.nextRoundEntryCondition(lastFilledRound: RoundSlot): PriceCondition`
  - `RoundSlot.sell(executedPrice: Price)` precondition: `executedPrice >= entryPrice × (1 + takeProfitPercent)`. 위반 시 `StopLossAttemptException`.
- **레버리지 금지 (원칙 2)**: `OrderCommand.orderType = SpotOrderType` 타입 제약. margin/future 주문 생성 불가.

---

## 4. Port Interfaces

모든 port는 Domain 또는 Application에 선언, Infrastructure가 구현(ADR-0014).

| Port | 책임 | 주요 메서드 (시그니처만) |
|---|---|---|
| `ExchangeAdapter` | 거래소 REST 주문/잔고/체결 조회 추상화 (빗썸/업비트 교체) | `placeOrder(OrderCommand): OrderAck`, `cancelOrder(...)`, `fetchBalance(...)`, `fetchExecution(orderId)` (전 메서드 `suspend`) |
| `MarketDataSubscriber` | WebSocket 시세 구독 + REST 폴백 | `subscribe(symbol): Flow<Tick>`, `fallbackPoll(symbol): Flow<Tick>` |
| `NotificationSender` | 알림 채널 추상화 (Telegram → Email → Push) | `send(TenantId, NotificationEvent): Result` |
| `EventPublisher` | Outbox → Kafka 발행 | `publish(DomainEvent)` |
| `OrderRepositoryPort` / `SlotRepositoryPort` / `StrategyRepositoryPort` | 영속화 | 표준 CRUD + tenantId 필터 강제 (INV-05) |
| `CredentialVault` | API Key/Token 암/복호화 | `store(...)`, `load(tenantId, exchange)` |
| `HistoricalMarketDataSource` | 백테스트 OHLCV 소스 | `stream(symbol, from, to, interval): Flow<Bar>` |
| `Clock` | 결정론 테스트용 시간 주입 | `now(): Instant` |

**모드 주입 패턴**: 엔진 `StrategyExecutor`는 `ExchangeAdapter`(실매매) / `SimulatedExchangeAdapter`(페이퍼) / `BacktestExchangeAdapter`(백테스트) 세 구현을 `ExecutionMode`에 따라 DI로 선택. 엔진 로직은 단일.

---

## 5. Infrastructure 선택

| 기술 | 역할 |
|---|---|
| **MySQL** | `split_strategy`, `strategy_run`, `round_slot`, `order`, `exchange_credential`, `notification_target`, `outbox`, `audit_log` (CRUD + Outbox) |
| **Kafka** | 도메인 이벤트 발행 (`seven-split.*.v1` 토픽). DLQ는 `.DLT` 접미사 (kafka-convention.md) |
| **ClickHouse** | 과거 OHLCV 분봉(백테스트), 실매매 체결 시계열 분석용 |
| **Redis** | Rate Limiter 토큰 카운터 (유저 API Key 단위), 틱 캐시, 전략 헬스체크 |
| **Outbox** | 상태 전이와 이벤트 발행의 원자성 보장 (INV-04) |

**ClickHouse 스키마 분리 (analytics와의 충돌 해소)**:
analytics ClickHouse **인프라(노드/클러스터)는 재사용**하되, 별도 데이터베이스 **`seven_split`**을 신설하여 스키마/테이블 소유는 독립. analytics DB/schema 직접 참조 금지. 테이블 네이밍은 prefix 없이 db 네임스페이스로 격리:
- `seven_split.market_tick_{exchange}` (분봉/틱 OHLCV)
- `seven_split.backtest_run` (백테스트 실행 메타 + 결과 집계)
- `seven_split.execution_result` (체결 시계열)

Local dev는 k3d `k8s/overlays/k3s-lite`, 운영은 `k8s/overlays/prod-k8s` (ADR-0019).

---

## 6. Phase별 구현 범위

| Phase | 목표 | 포함 | 제외 |
|---|---|---|---|
| **Phase 1 — 백테스트** | 결정론 시뮬레이터로 파라미터 튜닝 | 빗썸 REST 히스토리 배치 수집(BTC/KRW·ETH/KRW 분봉 2023-01~현재) → ClickHouse `seven_split` DB 적재, `BacktestExchangeAdapter`, 골든셋 테스트, 기본 대시보드(실행 결과 표), 리더보드 read-model 스켈레톤 | WebSocket 구독, 실 주문, 텔레그램 알림 |
| **Phase 2 — 페이퍼 트레이딩** | 실 시세 + 가상 체결로 엔진 검증 | `MarketDataSubscriber` WebSocket 구현, REST 폴백, `SimulatedExchangeAdapter`(슬리피지/지연 파라미터화), 텔레그램 봇 알림, 대시보드 전 기능, 리더보드 산식 고정(OQ-010 해소), 리더보드 비교 UI | 실 주문, 업비트 어댑터 |
| **Phase 3 — 실매매** | 빗썸 실 자본 운용 + 업비트 추가 | `BithumbExchangeAdapter` 실주문, `UpbitExchangeAdapter` 신규, Rate Limiter(OQ-004 해소), 부분체결 복구(OQ-003 해소), 감사 로그 강화, 긴급 청산 경로 검증 | 공개 랭킹, 마진/선물, 해외 거래소 |
| **Phase 4(제외)** | 이메일/웹푸시, ATR 동적 간격, 고점 대비 -x% 대기 진입, 1번 서비스와의 `trading-core` 추출 | — | 본 스펙 out-of-scope |

세 Phase는 **독립 릴리즈 가능**하도록 모듈화하고, 동일 엔진 코드가 `ExecutionMode`와 Adapter 교체만으로 각 모드를 수행한다.

---

## 7. API Design

인증: Gateway가 JWT HS256 검증 단독 수행 → 내부 서비스는 `X-User-Id`, `X-User-Roles` 헤더만 신뢰 (ADR-0002). 본 서비스는 `X-User-Id`를 `tenantId`로 매핑.

응답 포맷: `ApiResponse<T>` 공통 래퍼 (docs/architecture/api-response.md). 예외는 `GlobalExceptionHandler`로 매핑.

| 메서드 | 경로 | 설명 | 비고 |
|---|---|---|---|
| POST | `/api/v1/strategies` | 전략 생성 (Config 포함) | FR-ENG-01 검증 |
| GET | `/api/v1/strategies` | 내 전략 목록 | tenantId 필터 강제 |
| GET | `/api/v1/strategies/{id}` | 전략 상세 + 회차 슬롯 현황 | FR-DASH-01 |
| PATCH | `/api/v1/strategies/{id}` | 일시정지·재개·파라미터 변경 | 재가동은 `PAUSED` 상태 선행 필수 |
| POST | `/api/v1/strategies/{id}/activate` | 활성화 (1회차 시장가 매수 진입) | FR-ENG-02 |
| POST | `/api/v1/strategies/{id}/liquidate` | 긴급 청산 (1-click) | FR-RISK-02, 감사 로그 |
| GET | `/api/v1/strategies/{id}/runs` | 실행 이력 | 리더보드 소스 |
| GET | `/api/v1/dashboard/overview` | 전략 단위 손익/MDD/누적 수익률 | FR-DASH-02 |
| GET | `/api/v1/dashboard/executions` | 체결 타임라인 (필터: 기간/거래쌍) | FR-DASH-03/04 |
| GET | `/api/v1/leaderboard` | 본인 용도 랭킹 | FR-DASH-05, tenantId 스코프 |
| POST | `/api/v1/leaderboard/compare` | 2개 이상 run 오버레이 비교 | FR-DASH-06 |
| POST | `/api/v1/credentials` | 거래소 API Key 등록 (AES-GCM 저장) | 평문 응답 금지 |
| POST | `/api/v1/notifications/telegram` | 텔레그램 botToken/chatId 등록 | OQ-009 |
| POST | `/api/v1/backtests` | 백테스트 제출 (Phase 1) | 결과는 `runs`와 동일 스키마로 저장 |

---

## 8. 이벤트 스키마 (Kafka)

네이밍: `seven-split.{entity}.{event}.v1` (docs/architecture/kafka-convention.md 준수). 버전 suffix `v1` 고정, 스키마 breaking 변경 시 `v2` 새 토픽.

| Topic | Payload 요약 | 수신(예상) |
|---|---|---|
| `seven-split.strategy.activated.v1` | `{tenantId, strategyId, config, startedAt}` | analytics |
| `seven-split.strategy.liquidated.v1` | `{tenantId, strategyId, reason, triggeredBy}` | analytics, notification |
| `seven-split.slot.opened.v1` | `{tenantId, runId, slotId, roundIndex, price, qty}` | notification, analytics |
| `seven-split.slot.closed.v1` | `{tenantId, slotId, entryPrice, exitPrice, pnl}` | notification, analytics, leaderboard |
| `seven-split.order.placed.v1` | `{tenantId, orderId, exchange, side, qty, price}` | — |
| `seven-split.order.filled.v1` | `{tenantId, orderId, exchangeOrderId, filledQty, avgPrice, fee}` | leaderboard |
| `seven-split.order.failed.v1` | `{tenantId, orderId, reason, retryable}` | notification, DLQ 대상 |
| `seven-split.risk.limit_breached.v1` | `{tenantId, strategyId, limitType, value}` | notification |

DLQ는 `.DLT` 접미사(공용 규약). Consumer group: `seven-split-{purpose}` (예: `seven-split-leaderboard`, `seven-split-notification`).

---

## 9. Resilience

ADR-0015 장애 대비 전략 준수.

- **CircuitBreaker 대상**: `ExchangeAdapter`(빗썸/업비트 REST), Telegram Bot API, ClickHouse 쿼리. 실패 임계 도달 시 `OPEN` → half-open 자동 복귀.
- **Rate Limiter (per-key)**: 유저 API Key 단위 Redis 토큰 버킷. 거래소 공식 한도는 OQ-004에서 확정 후 상수화. 80% 도달 시 알림, 95% 도달 시 지수 백오프로 자가 조절.
- **DLQ**: Kafka Consumer 3회 재시도(1s `FixedBackOff`) 후 `*.DLT` 토픽. 재처리 스크립트 별도.
- **Idempotent Order** (INV-06): `orderId = UUIDv7`(클라 생성) → 거래소 `clientOrderId` 전달. 재시도 시 동일 id 재사용, 거래소 응답을 idempotent하게 매핑.
- **Idempotent Consumer** (ADR-0012): 체결 이벤트 수신 시 `processed_event(event_id)` 테이블로 중복 처리 방어.
- **부분체결 복구 (OQ-003)**: 기본 방침 — 미체결 잔량은 `entryGapPercent` 재평가 후 (a) 재주문 or (b) 취소; 구체 정책은 서비스 ADR로 확정.
- **WebSocket 복구 (Q-A)**: 끊김 5s 내 재연결, 10s 지속 시 REST 폴링 자동 폴백, 복구 시 원복.
- **Outbox**: 상태 전이와 이벤트 발행의 원자성 보장 (트랜잭션 내 insert, 별도 publisher가 비동기 flush) — ADR-0020 "외부 IO는 트랜잭션 밖".

### 9.1 거래소 WebSocket 특성 (Phase 1~2는 public 시세만)

- **빗썸**: HMAC-SHA512 인증 / 비표준 JSON 페이로드 / heartbeat 미기재(구현 시 실측 확인 필요)
- **업비트**: JWT 인증 / gzip 압축 요청 가능 / idle 120s disconnect
- **범위**: Phase 1~2는 **public 시세 WS만 구독**, private 채널(주문/체결)은 **REST 폴링**으로 확보. private WS 도입은 Phase 3 이후 ADR로 결정.

---

## 10. Security

- **API Key 암호화** (FR-SEC-01): AES-GCM 봉투 암호화. DEK는 레코드별 랜덤, KEK 관리는 OQ-006에서 확정(KMS vs env). `apiSecret`은 어떤 DTO/로그/Kafka payload에도 평문 노출 금지.
- **텔레그램 Bot Token** (OQ-009): 동일 `CredentialVault`에 `channel='telegram'` 복합키로 저장. 1 테넌트 당 여러 `chatId`(공유 그룹) 허용 여부는 OQ-009에서 결정.
- **테넌트 격리** (FR-SEC-03, INV-05): 모든 Repository 쿼리에 `tenantId` 조건 강제. `@TenantAware` AOP 또는 JPA Filter로 누락 방지 테스트.
- **IP 화이트리스트** (FR-SEC-02): 거래소 Key 등록 시 허용 IP 목록 함께 저장.
- **감사 로그**: `audit_log` 테이블에 `{actor, tenantId, timestamp, action, resource, outcome}` 기록. 대상: Key CRUD, 주문 집행, 긴급 청산, 전략 활성/중지.
- **법적 검토** (OQ-005): 외부 오픈 의사결정 전 블로커. MVP 본인 1인 운용 한정.

---

## 11. Observability

- **로깅** (ADR-0021): `kotlin-logging` 람다 형식만 허용 (`logger.info { "..." }`). Error 레벨은 복구 불가 오류에만. API Key/Secret/Token 평문 로그 금지 (INV, 정규식 캡처 테스트로 강제).
- **메트릭** (Micrometer):
  - `seven_split.market.tick.received_total{exchange,symbol}`
  - `seven_split.strategy.evaluation.latency_seconds{mode}` (p50/p95/p99, NFR-PERF-01)
  - `seven_split.order.submit.success_total` / `..failure_total{reason}`
  - `seven_split.exchange.ratelimit.usage_ratio{exchange,tenant}` (80% 경보)
  - `seven_split.ws.connection.state{exchange}` (connected/degraded/fallback)
  - `seven_split.notification.send.latency_seconds{channel}`
- **트레이싱**: 각 전략 실행에 `executionId` 부여(NFR-OBS-03), OpenTelemetry span 전파(틱 수신 → 평가 → 주문).
- **대시보드 SLO**: 별도 Grafana 대시보드(운영), 제품 대시보드(사용자)와 분리.
- **대시보드 엔드포인트 SLO (NFR-PERF-04)**: `/dashboard/*`, `/leaderboard` p95 ≤ 500ms. `seven_split.dashboard.response.latency_seconds{endpoint}` 메트릭으로 감시.

---

## 12. K8s 배포

ADR-0019 이원화 준수.

| 모드 | Overlay | 비고 |
|---|---|---|
| 로컬/엣지 | `k8s/overlays/k3s-lite/seven-split/` | Redis standalone 전환(기존 5개 서비스 패턴 재사용), ClickHouse/Kafka 단일 인스턴스 공유 |
| 운영 | `k8s/overlays/prod-k8s/seven-split/` | HPA, PDB, TLS, NetworkPolicy |

- **이미지**: Jib 기반 tar (`./gradlew :seven-split:app:jibBuildTar`), `scripts/image-import.sh` 경로에 통합
- **HPA 기준**: CPU 70% 또는 `seven_split.strategy.evaluation.latency_seconds` p95 > 500ms 가 연속 3분 유지되면 스케일아웃. 최소 2 replica(가용성), 최대 10
  - **전제**: p95 기반 HPA는 **Prometheus Adapter** 구축을 전제로 한다. 미구축 시 Phase 3 전까지 **CPU 70% 기반으로 degrade**하며, p95 HPA는 Prometheus Adapter 도입 후 enable.
- **PDB**: `minAvailable=1`
- **ConfigMap/Secret**: DB/Kafka/Redis/ClickHouse 엔드포인트 + 텔레그램/거래소 KEK 주입
- **Profile**: `SPRING_PROFILES_ACTIVE=kubernetes`
- **Ingress**: Gateway를 통한 라우팅 (본 서비스는 ClusterIP, 직접 노출 금지)

**프론트엔드 배치**: `seven-split/frontend/` **독립 모듈 신설** (React + Vite). `charting` 서비스 재사용 대신 독립 유지 — 사유: 대시보드/리더보드가 **내부 관리용**이라 `charting`의 **공개 차트 렌더링**과 도메인 분리 필요.

---

## 13. Existing Code to Leverage

| 대상 | 참조 위치 | 재사용 포인트 |
|---|---|---|
| Nested submodule 뼈대 | `product/domain`, `order/domain`, `search/domain` | Gradle 구성, 패키지 레이아웃 |
| 도메인 이벤트 + Outbox | `order/app` 상태 전이 패턴 | `OrderPlaced`/`OrderFilled` 구조 참고 |
| Kafka 컨벤션 | `docs/architecture/kafka-convention.md` | 토픽 네이밍, DLQ `.DLT`, Consumer group |
| ApiResponse 래퍼 | `common` | 공통 응답 포맷 |
| 멱등 컨슈머 | ADR-0012 | `processed_event` 테이블 패턴 |
| ClickHouse 적재 패턴 | `analytics` 서비스 | OHLCV/틱 적재 패턴(**인프라만 공유, DB 분리**), Kafka Streams 연계 참고 |
| 차트 협업 | `charting` (Python/FastAPI) | 공개 차트 엔드포인트. 본 서비스 내부 관리 FE는 별도 `seven-split/frontend/`로 분리 |
| FE 가드레일 | `docs/conventions/frontend-design.md` | 대시보드 타이포/색상/접근성 |
| K8s overlay | `k8s/overlays/{k3s-lite,prod-k8s}/` 기존 서비스 | Deployment/Service/HPA/PDB 템플릿 |

**프론트엔드**: `seven-split/frontend/` React + Vite 독립 모듈 신설 (위 §12 확정).

---

## 14. Open Questions & Risks

### 14.1 Open Questions (→ `context/open-questions.yml`)

| OQ | 요지 | 블로커 |
|---|---|---|
| OQ-001 | "2/1포인트" 용어 정의 | Phase 1 파라미터 기본값 |
| OQ-002 | 암호화폐 변동성 기본값 (-3/+10 vs -5~-8/+5~+15) | SplitStrategyConfig 기본값 |
| OQ-003 | 부분체결·재시도·복구 정책 | executor 구현 |
| OQ-004 | 빗썸·업비트 공식 Rate Limit 수치 | RateLimiter 구현 |
| OQ-005 | 국내 법적 이슈 검토 | 외부 오픈 의사결정 |
| OQ-006 | API Key 암호화 키 관리(KMS vs env), 감사 로그 보관 | Key CRUD API 구현 |
| OQ-007 | 틱 이벤트 버스 in-process vs Kafka | stream 모듈 설계 (Phase 2) |
| OQ-008 | ClickHouse 틱 적재 파이프라인 설계 | Phase 1 백테스트 실행 |
| OQ-009 | 텔레그램 Bot Token 저장/멀티테넌트 분배 | NotificationChannel + 어댑터 |
| OQ-010 | 리더보드 점수 산식 | leaderboard 스키마 확정 |
| OQ-011 | 거래소 약관상 자동매매 허용 확인 | **Phase 1 착수 전** |
| OQ-012 | 유저별 손실 한도 구체 정의 | Phase 3 착수 전 ADR |
| OQ-013 | 글로벌 kill-switch + 2FA | Phase 3 착수 전 ADR |
| OQ-014 | 주문 reconcile 절차 | Phase 3 착수 전 |
| OQ-015 | Gateway 우회 방지 (NetworkPolicy/mTLS) | Phase 3 착수 전 ADR |
| OQ-016 | 실매매 Role + step-up 2FA 엔드포인트 | Phase 3 착수 전 |
| OQ-017 | KEK 회전 정책 | Phase 2 착수 전 |
| OQ-018 | `audit_log` 불변성 보장 방식 | Phase 2 착수 전 |
| OQ-019 | 페이퍼 → 실매매 승격 정량 게이트 | Phase 3 착수 전 |
| OQ-020 | 부분체결 중간 substate 설계 | Phase 1 도메인 설계 시 |

### 14.2 Risks

- **R-01**: 거래소 API 스펙 변경 → `ExchangeAdapter` port 격리로 영향 범위 한정 + Contract Test
- **R-02**: WebSocket 불안정으로 지연 SLO 위반 → 10s 폴백 + CircuitBreaker + 알림
- **R-03**: 결정론 깨짐(시간/난수) → `Clock`/`RandomSource` 주입, 골든셋 회귀 보호
- **R-04**: 실매매 자본 손실 → Phase 2 페이퍼 승인 전 Phase 3 진입 금지 운영 규칙
- **R-05**: Rate Limit 초과로 주문 실패 → per-key 토큰 버킷 + 80% 경보 + 95% 자가 백오프
- **R-06**: API Key 유출 → AES-GCM 암호화 + IP 화이트리스트 + 감사 로그 + 평문 로그 검출 테스트

---

## 15. Out of Scope

- 마진/선물/파생상품 (현물 전용)
- 자동 종목 추천
- 해외 거래소 (Binance 등, 장기 로드맵)
- 공개 리더보드
- "고점 대비 -x% 대기" 최초 진입 옵션 (Phase 4+)
- ATR·변동성 기반 동적 간격 % (Phase 4+)
- 이메일 알림 (Phase 2+), 웹/모바일 푸시 (Phase 4+)
- 외부 사용자 오픈 / SaaS 상용화 (OQ-005 해소 후 판단)
- 1번(퀀트 에이전트 토론) 서비스와의 `trading-core` 공통 모듈 추출 (1번 구현 시점까지 보류)

### 15.1 7원칙 MVP 범위 선언

**세븐스플릿 7원칙 중 포트폴리오 차원 3개 (원칙 1·3·4)는 MVP 범위 밖으로 선언한다.**

- **원칙 1** (장기투자 계좌 자산 40%+ 비중 유지): 포트폴리오 애그리게이트가 필요하나 본 MVP는 **전략 단위 설계**. 향후 `AccountPortfolio` 도메인 확장 시 별도 피처로 도입.
- **원칙 3** (장기투자 목표 수익률 10%+): `takeProfitPercentPerRound` 검증 시 **참고용**으로만 활용, 강제 invariant 아님.
- **원칙 4** (최초 매수 = 계좌 자산 5% 이내): **절대 금액 기반 `FR-RISK-01`로 대체**. 계좌 잔고 대비 %는 포트폴리오 확장 시 재검토.

MVP에서 강제되는 7원칙: **2(레버리지 금지), 5(-n% 추가매수), 6(회차 균등 금액), 7(손절 없음) + 회차 독립 익절**.

---

## 16. Library Additions

Phase별 신규 라이브러리 편입 목록. 카탈로그 관리 기준은 `gradle/libs.versions.toml`.

| Library | 용도 | Phase | libs.versions.toml 신규? |
|---|---|---|---|
| `turbine` | Flow 테스트 | 1 | Yes |
| `kotest-property` | Property-based 테스트 (INV-01~07 속성 강제) | 1 | Yes |
| `testcontainers-mysql` | 통합 테스트 | 1 | MySQL은 기존 재사용 여부 확인 후 결정 |
| `testcontainers-clickhouse` | 통합 테스트 | 1 | Yes |
| `testcontainers-kafka` | 통합 테스트 | 1 | Yes |
| `resilience4j-circuitbreaker` | CB | 2 | `order/app` 리터럴을 **카탈로그로 승격** |
| `resilience4j-kotlin` | Coroutine 통합 | 2 | `order/app` 리터럴을 **카탈로그로 승격** |
| `bucket4j` (대안: Redis Lua) | Rate Limiter | 2 | **선택** — Redis Lua 직접 구현 권장 (신규 의존 0) |
| `reactor-netty` WebSocketClient | 거래소 WS 구독 | 2 | 기존 의존성에 포함 (신규 X) |

