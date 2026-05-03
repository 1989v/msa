---
spec: quant-phase2-paper-trading
date: 2026-04-26
status: requirements-draft
phase: 2 of 3
source-planning:
  - planning/initialization.md
  - context/open-questions.yml
phase1-references:
  - docs/specs/2026-04-24-quant-crypto-trading/planning/requirements.md
  - docs/specs/2026-04-24-quant-crypto-trading/planning/spec.md
  - docs/specs/2026-04-24-quant-crypto-trading/planning/phase1-release-notes.md
  - docs/adr/ADR-0024-quant-service.md
  - quant/docs/phase1-readiness.md
decisions-confirmed-on: 2026-04-26
author: shape-agent
---

# Requirements — Quant Phase 2 (Paper Trading)

> 본 문서는 `planning/initialization.md` (Phase 2 seed) + 사용자 사전 합의(2026-04-26) + Phase 2 신규 OQ 7개 default 제안을 통합한 요구사항이다.
> Phase 1 (백테스트) 산출물은 변경 없이 유지되며, 본 문서는 **Phase 2 추가 범위**만 정의한다.
> Phase 1 공통 도메인/구조/컨벤션은 Phase 1 `requirements.md` / `spec.md`를 단일 출처로 참조하고 중복 서술하지 않는다.

---

## 1. Initial Description (Phase 2 압축 요약)

Phase 1 결정론 백테스트 엔진 위에 **실시간 시세 수신 + 가상 체결 (Paper Trading)** 경로를 추가한다. 핵심 추가 컴포넌트는:

- 빗썸 WebSocket Public 시세 구독 + REST 폴백 + 자동 재연결
- `MarketDataHub` (Coroutine `SharedFlow` primary + Kafka fan-out side-effect)
- `SimulatedExchangeAdapter` (실시간 시세 + 가상 체결, slippage 모델, 부분체결 시뮬)
- `ExecutionMode = PAPER` 전용 UseCase 경로
- `TelegramBotNotificationSender` 어댑터 (Phase 1 stub → 실 발송)
- Resilience: CircuitBreaker / Rate Limiter / DLQ 활성화
- Outbox → Kafka 실 발행 (Phase 1 log-only → 활성화)
- 보안 강화: KEK 회전 정책 + `audit_log` 불변성 보장
- FE 페이퍼 트레이딩 실시간 모니터링 페이지 (현재가/최근 체결/호가 흐름)

Phase 1과의 가장 큰 차이는 **결정론 → 실시간 비결정론**, **단일 시세 소스 → 다중 소비자 hot-path**, **무알림 → 텔레그램 실 발송**. 실 거래소 주문 발송은 본 Phase 범위가 아니다 (Phase 3).

---

## 2. Q&A

### 2.1 Phase 2 핵심 결정 (사용자 사전 합의 — 2026-04-26)

| ID | 질문 | 결정 | 근거 |
|---|---|---|---|
| OQ-007 (이월) | 시세 이벤트 버스 구현 | **SharedFlow primary + Kafka fan-out side-effect collector** (`MarketDataHub`) | hot-path 지연 최소 + 외부 소비자 확장성 (Kafka publisher bean은 Phase 2 옵셔널, Phase 3+ 활성) |
| OQ-011 (이월) | 빗썸 약관 자동매매 허용 | **진행** — 명시적 금지 조항 미발견, Order rate limit 존재 = 자동매매 전제 설계로 해석 | 법무 검토는 Phase 3 실매매 진입 전 재수행 권장 (Phase 2는 가상 체결 → 위험 낮음) |

### 2.2 Phase 2 신규 OQ default 제안 (사용자 1회 확인 대상)

> 사용자에게 합리적 default 1세트를 제시하고, 추가 변경 의견이 없으면 진행한다.
> 변경 시점은 Plan 단계 (spec.md 작성 직전)까지 허용.

| ID | 질문 | Default 결정 | 사유 |
|---|---|---|---|
| OQ-P2-001 | KEK 회전 주기 + 키 저장소 | **OCI Vault Service (Always Free Tier) + 1년 회전 + lazy re-encryption**. 운영 환경 OCI Vault 미구축 시 LocalFile/환경변수 KEK + SOP 문서화로 degrade. | OCI Vault는 Always Free Tier로 비용 0 + 단일 클라우드(OCI) 단순화. 짧은 회전(90일)은 Phase 2 운영 부하 과다 → 1년 시작 후 Phase 3에서 단축 검토. lazy re-encryption은 다음 접근 시 재암호화로 일괄 마이그레이션 회피. |
| OQ-P2-002 | `audit_log` 불변성 보장 | **prev_hash 체인 + DB 권한 REVOKE (UPDATE/DELETE) + Kafka mirror topic** (옵션 D — WORM 스토리지는 Phase 3+) | DB 권한 분리 + 해시 체인으로 변조 검출 + Kafka mirror로 외부 사본 확보 = 운영 단순성과 보안 균형. WORM/S3 Object Lock은 Phase 3 외부 오픈 시점 도입. |
| OQ-P2-003 | Slippage 모델 | **고정 0.05% (BTC/ETH 메이저 자산 기본)** | Phase 2는 엔진 검증이 목적 → 단순/예측 가능. volume-weighted/정규분포는 Phase 3에서 실 체결 데이터로 calibration 후 도입. |
| OQ-P2-004 | Telegram Rate Limit | **per-chat 1 msg/s + 우선순위 큐 (CRITICAL > RISK > INFO)** | 옵션 A + C 결합. Telegram API 공식 한도 준수 + 체결/리스크 알림은 즉시 발송 보장. 배치(B)는 즉시성 손실로 부적합. |
| OQ-P2-005 | SharedFlow buffer 전략 | **`extraBufferCapacity=256`, `BufferOverflow.DROP_OLDEST`** | 시세는 최신성이 가치 (지나간 틱은 의미 약함). 메모리 안전 + 느린 소비자가 producer를 멈추지 않음. SUSPEND는 WebSocket 소비 지연 위험. |
| OQ-P2-006 | Rate Limiter 구현체 | **Redis token bucket (Lua script)**. Bucket4j+Redis backend는 Phase 3 검토. | Phase 2 단계에서 multi-instance 스케일아웃 가정 → 분산 일관성 필요. in-process Bucket4j는 인스턴스 간 초과 허용 위험. |
| OQ-P2-007 | FE 실시간 연결 방식 | **SSE (Server-Sent Events)** | 단방향 push로 폴링 대비 효율 + WebSocket 대비 단순 (게이트웨이/인증 별도 처리 불필요). 양방향이 필요해지면 Phase 3에서 WebSocket 전환 검토. |

### 2.3 시각 자료

- `planning/visuals/` 디렉토리 비어 있음 (`No visual files found` — bash 확인).
- 페이퍼 트레이딩 모니터링 페이지 와이어프레임은 Plan 단계 또는 implement 단계에서 추가 수집 예정.

---

## 3. Existing Code to Reference (Phase 2 신규/확장 관점)

| 영역 | 참조 대상 | 재사용 포인트 |
|---|---|---|
| Phase 1 도메인/엔진 | `quant/domain/`, `quant/app/application/backtest/` | `TrancheStrategy`, `TrancheSlot`, `StrategyExecutor`, `StrategyEngineLoop` 그대로 재사용. PAPER 모드는 Adapter 교체로만 동작. |
| Phase 1 Outbox | `quant/app/infrastructure/outbox/OutboxRelay.kt`, `OutboxEventPublisher.kt` | Phase 1 log-only → Phase 2 Kafka 실 발행 활성화 (payload deserialization 구현 포함) |
| Phase 1 Bithumb REST | `quant/app/infrastructure/bithumb/` (history ingest service, REST client) | WebSocket subscriber 신규 구현 시 인증/시그니처/에러 매핑 패턴 재활용 |
| Phase 1 Credential 암호화 | `ExchangeCredential` / `NotificationTarget` AES-GCM 필드 | KEK 회전 + lazy re-encryption hook 추가 지점 |
| Phase 1 audit_log | Flyway V001의 `audit_log` 테이블 | Phase 2에서 `prev_hash` 컬럼 추가 + 권한 REVOKE migration |
| Phase 1 metrics | `infrastructure/metrics/QuantMetrics.kt`, `OutboxPendingMetric` | Phase 2 메트릭 추가 (WS state, tick latency, Telegram send latency, rate limit usage) |
| Phase 1 FE | `quant/frontend/src/pages`, `components` | 페이퍼 트레이딩 모니터링 페이지 신규 추가, 기존 PWA 셸/Tailwind/lightweight-charts 재사용 |
| Resilience4j (플랫폼) | ADR-0015 + 기존 서비스 설정 패턴 | CircuitBreaker / Rate Limiter 적용 |
| Kafka 컨벤션 | `docs/architecture/kafka-convention.md` | Phase 2에서 첫 실 발행 토픽 사용 (`quant.*.v1`, DLQ `.DLT`) |
| 멱등 컨슈머 | ADR-0012 + Phase 1 `processed_event` 패턴 | Telegram 발송 worker, audit mirror consumer 적용 |
| `@Transactional` 규칙 | ADR-0020 | WebSocket 콜백/Kafka publish는 트랜잭션 밖 |

---

## 4. Visual Assets

- `planning/visuals/` 비어 있음. 디자인 mockup은 별도 수집 예정.
- 참조 가능한 디자인 가드: `docs/conventions/frontend-design.md` (mobile-first PWA, Pretendard, Tailwind 기준).

---

## 5. User Stories

### 5.1 페이퍼 트레이딩 운영자 (본인, MVP 1인)

- **US-P2-01 (페이퍼 모드 전략 활성화)**: 사용자로서, Phase 1에서 정의한 전략을 `ExecutionMode = PAPER`로 활성화해 실제 빗썸 실시간 시세에 대한 가상 체결을 시작하고 싶다. 그래야 백테스트와 실매매 사이의 검증 구간을 확보할 수 있다.
- **US-P2-02 (실시간 시세 모니터링)**: 사용자로서, 활성 전략의 대상 거래쌍 현재가·최근 체결·호가 흐름을 1초 내 갱신되는 페이지에서 확인하고 싶다.
- **US-P2-03 (가상 체결 결과 확인)**: 사용자로서, 페이퍼 트레이딩으로 발생한 가상 매수/매도 체결 (slippage 적용 후) 을 회차별로 확인하고 백테스트 결과와 비교하고 싶다.
- **US-P2-04 (실시간 알림 수신)**: 사용자로서, 페이퍼 모드에서도 체결/회차 소진/거래소 에러/Rate Limit 임박 이벤트를 텔레그램으로 즉시 받고 싶다 (Phase 1 stub → 실 발송).
- **US-P2-05 (전략 일시정지/재개)**: 사용자로서, 페이퍼 트레이딩 중 전략을 일시정지하거나 재개해도 시세 구독은 끊기지 않고, 재개 시 즉시 트리거 평가가 재개되길 원한다.
- **US-P2-06 (페이퍼 결과 리뷰)**: 사용자로서, 페이퍼 실행을 종료한 후 누적 수익률/MDD/회차 회전률 등을 백테스트와 동일한 리더보드 스키마로 비교하고 싶다.

### 5.2 운영/관측

- **US-P2-07 (시세 단절 가시성)**: 운영자로서, WebSocket 단절 → REST 폴백 전환 → WebSocket 복구 이벤트가 메트릭/대시보드에 즉시 노출되어 거래소 장애 여부를 판단하고 싶다.
- **US-P2-08 (Rate Limit 모니터링)**: 운영자로서, 거래소 API Key 단위 호출 한도 사용률을 80%/95% 임계로 텔레그램 알림 받고 싶다.
- **US-P2-09 (DLQ 가시성)**: 운영자로서, Kafka consumer 실패 메시지가 `.DLT` 토픽에 격리되어 재처리 절차로 복구할 수 있길 원한다.

### 5.3 보안/감사

- **US-P2-10 (KEK 회전)**: 보안 담당자로서, KEK가 정기 회전되며 회전 후에도 기존 암호문이 lazy re-encryption으로 점진 마이그레이션되어 다운타임 없이 갱신되길 원한다.
- **US-P2-11 (감사 로그 변조 검출)**: 감사 담당자로서, `audit_log` 테이블이 `prev_hash` 체인으로 연결되어 임의 수정/삭제 시 검증 단계에서 즉시 감지되길 원한다.

---

## 6. Functional Requirements

### 6.1 WebSocket / 시세 수신 (FR-P2-WS)

- **FR-P2-WS-01**: 빗썸 Public WebSocket(`wss://`)에 대한 `MarketDataSubscriber` 구현체(`BithumbWebSocketSubscriber`)를 제공한다. 거래쌍별 ticker / orderbook / transaction 채널 구독 가능.
- **FR-P2-WS-02**: 끊김 감지 후 **5초 이내 재연결**을 시도한다 (지수 백오프 시작값 1s, 상한 5s).
- **FR-P2-WS-03**: **연속 10초 이상 끊김** 시 자동으로 REST 매초 폴링으로 폴백하고, WebSocket 복구 시 자동 원복한다. 전환/원복 시점에 `ExchangeConnectionDegraded` / `ExchangeConnectionRestored` 도메인 이벤트를 발행한다.
- **FR-P2-WS-04**: heartbeat / ping-pong 프레임 처리 (빗썸 사양 실측값 기반). idle timeout 발생 시 즉시 재연결 트리거.
- **FR-P2-WS-05**: 수신 페이로드는 `Tick(symbol, price, qty, timestamp, source: WS|REST)` 도메인 모델로 정규화 후 `MarketDataHub`로 emit.
- **FR-P2-WS-06**: WebSocket 구독은 Coroutine `Flow`, REST 폴링은 `suspend` 함수로 구현한다 (ADR-0002 — WebFlux 금지).

### 6.2 MarketDataHub (FR-P2-HUB)

- **FR-P2-HUB-01**: `MarketDataHub`는 단일 빗썸 구독 스트림을 내부 다중 소비자에게 fan-out하는 Coroutine `SharedFlow<Tick>` 컴포넌트로 신설한다.
- **FR-P2-HUB-02**: 소비자는 (a) Strategy Engine (트리거 평가), (b) FE SSE Push, (c) Telegram Alert Engine, (d) Kafka fan-out side-effect collector 4종을 1차 정의한다.
- **FR-P2-HUB-03**: SharedFlow 설정: `replay=0`, `extraBufferCapacity=256`, `onBufferOverflow=DROP_OLDEST` (OQ-P2-005 default).
- **FR-P2-HUB-04**: Kafka fan-out collector는 별도 coroutine job이 비동기로 `quant.market.tick.v1` 토픽에 발행한다. publisher bean은 `@ConditionalOnProperty`로 optional 처리 (Phase 2 default disabled, Phase 3+ enable).
- **FR-P2-HUB-05**: Hub의 backpressure / drop / publish 실패는 메트릭 (`quant.market.hub.dropped_total`, `..publish_failure_total`) 으로 노출한다.

### 6.3 SimulatedExchangeAdapter (FR-P2-SIM)

- **FR-P2-SIM-01**: `ExchangeAdapter` port의 `PaperExchangeAdapter` 구현체를 신설한다. 실 거래소 주문 발송 없이 가상 체결을 생성한다.
- **FR-P2-SIM-02**: 시장가 주문은 **현재 `MarketDataHub`의 latest tick에 slippage를 적용한 가격**으로 즉시 체결한다.
- **FR-P2-SIM-03**: Slippage 모델: **고정 0.05%** (OQ-P2-003 default). 매수 시 unfavorable 방향(+), 매도 시 unfavorable 방향(-)으로 적용. 모델은 `SlippageModel` 인터페이스로 추상화하여 Phase 3에서 volume-weighted 등으로 교체 가능.
- **FR-P2-SIM-04**: 부분체결 시뮬: 설정값 `paper.partial-fill.probability` (default 0.0 — Phase 2는 비활성, 단 인터페이스/이벤트 경로는 검증) 와 `partial-fill.ratio-min/max` 파라미터 보유. 활성화 시 `OrderPartiallyFilled` 이벤트 발행 검증.
- **FR-P2-SIM-05**: 주문 ID는 Phase 1과 동일하게 UUID v7 idempotent key 사용. 가상 체결 결과는 `Order.exchangeOrderId`에 `paper-{uuid}` prefix로 기록.
- **FR-P2-SIM-06**: 가상 잔고는 `PaperAccount` 엔티티로 분리 관리한다. (실 거래소 잔고와 절대 혼용 금지 — DB 컬럼/테이블 분리)

### 6.4 ExecutionMode=PAPER UseCase 경로 (FR-P2-USE)

- **FR-P2-USE-01**: `ActivateStrategyUseCase`는 `ExecutionMode = PAPER`로 활성화 시 `PaperExchangeAdapter` + `MarketDataHub.subscribe(symbol)`을 주입한다 (Phase 1 BACKTEST는 `BacktestExchangeAdapter` + `HistoricalMarketDataSource`).
- **FR-P2-USE-02**: `StrategyExecutor` / `StrategyEngineLoop` 코드는 **Phase 1 그대로 재사용**한다 (단일 엔진 + Adapter 교체 원칙 — FR-PH-04).
- **FR-P2-USE-03**: PAPER 모드 종료 트리거는 `EndReason ∈ { Liquidated, Paused, Archived }` 중 하나. 백테스트의 `Completed` (데이터 소진) 는 PAPER에서는 발생 불가.
- **FR-P2-USE-04**: PAPER 모드 결과는 Phase 1과 동일한 `BacktestResult` 스키마 재사용 (단 `executionMode='PAPER'` 필드로 구분), 리더보드/대시보드에서 동일 비교 UI 적용 (US-P2-06).

### 6.5 Telegram 알림 (FR-P2-NOTIF)

- **FR-P2-NOTIF-01**: `TelegramBotNotificationSender`를 `NotificationSender` port의 구현체로 신설한다. Phase 1 stub 대체.
- **FR-P2-NOTIF-02**: Bot Token은 `NotificationTarget.botTokenCipher` (AES-GCM)에서 복호화 후 사용. 평문 로그/메트릭 금지 (INV — Phase 1 마스킹 테스트 재사용).
- **FR-P2-NOTIF-03**: 발송 경로: `NotificationEvent → 우선순위 큐 → per-chat 1 msg/s 토큰 버킷 → Telegram Bot API HTTP POST` (OQ-P2-004).
  - 우선순위: `CRITICAL` (긴급 청산, 거래소 인증 실패) > `RISK` (Rate Limit 80%, 회차 소진) > `INFO` (체결 성공, 일반 상태).
- **FR-P2-NOTIF-04**: 실패 시 exponential backoff 3회 (1s/2s/4s) 재시도. 최종 실패는 `audit_log`에 기록 + 메트릭 카운터 증가.
- **FR-P2-NOTIF-05**: 알림 이벤트 타입 (Phase 1 §FR-NOTIF-02 재정의):
  - INFO: 체결 성공, 슬롯 EMPTY 복귀
  - RISK: 회차 전 소진(`AWAITING_EXHAUSTED`), Rate Limit 80% 도달, WebSocket 폴백 전환
  - CRITICAL: 거래소 인증 실패, 긴급 청산 실행, 5xx 연속 발생
- **FR-P2-NOTIF-06**: 발송 worker는 멱등성 보장 (ADR-0012). `notification_event_id` 기반 중복 방어.

### 6.6 Resilience (FR-P2-RES)

- **FR-P2-RES-01 (CircuitBreaker)**: Resilience4j `CircuitBreaker`를 다음 IO 경계에 적용 — 빗썸 REST 폴링, 빗썸 WebSocket 재연결, Telegram Bot API. 임계: 실패율 50% / window=20 호출 / wait=30s. half-open 자동 복귀.
- **FR-P2-RES-02 (Rate Limiter)**: 거래소 API Key 단위 Redis token bucket (Lua script — OQ-P2-006 default). 버킷 사이즈/refill rate는 빗썸 공식 한도 기반 (OQ-004는 Phase 3에서 정확한 수치 확정, Phase 2는 보수적 default 값 사용).
- **FR-P2-RES-03 (DLQ 활성화)**: Kafka consumer 3회 재시도 (FixedBackOff 1s) 후 `*.DLT` 토픽 전송. consumer group: `quant-{purpose}`. 재처리 스크립트는 운영 doc로 분리.
- **FR-P2-RES-04 (Outbox → Kafka 실 발행)**: Phase 1 log-only → Phase 2에서 `OutboxRelay`가 미발행 이벤트를 폴링하여 Kafka에 publish하고 `published_at` 마킹. payload deserialization 구현 (Phase 1 알려진 제약 #3 해소).

### 6.7 보안 강화 (FR-P2-SEC)

- **FR-P2-SEC-01 (KEK 회전)**: KEK 관리 = OCI Vault Service (Always Free Tier, default). 회전 주기 = 1년. 회전 발생 시 신규 DEK는 신규 KEK로 wrapping; 기존 암호문은 **lazy re-encryption** — 다음 read 시점에 재암호화 후 write back.
  - OCI Vault 미구축 환경: LocalFile/환경변수 KEK + manual rotation SOP 문서 (`quant/docs/key-rotation-sop.md`) 로 degrade.
  - Key version 식별자(`kek-v1`, `kek-v2`)를 암호문 prefix에 기록하여 회전 추적.
- **FR-P2-SEC-02 (`audit_log` 불변성)**: 다음 3중 방어를 적용:
  1. Application 계층 — 각 row insert 시 `prev_hash = SHA256(prev_row || current_payload)` 체인 컬럼 기록
  2. DB 권한 — application user에 UPDATE/DELETE 권한 REVOKE (INSERT/SELECT만 GRANT)
  3. Kafka mirror — `quant.audit.v1` 토픽에 동기 발행, 외부 consumer가 별도 저장소(또는 Phase 3+ S3 Object Lock)에 사본 보관
  - 검증 job: nightly cron이 hash chain replay하여 변조 시 alarm.
- **FR-P2-SEC-03**: Phase 1의 INV (평문 시크릿 로그 금지, tenantId 격리)는 Phase 2에서도 유지 — KEK 회전 / Telegram Bot 로그 모두에 적용.

### 6.8 FE 페이퍼 트레이딩 모니터링 (FR-P2-FE)

- **FR-P2-FE-01 (모니터링 페이지 신설)**: `quant/frontend/src/pages/PaperTradingMonitor.tsx` (또는 동등) 신규 페이지. 활성 PAPER 전략 카드 + 거래쌍별 실시간 패널.
- **FR-P2-FE-02 (실시간 패널)**: 거래쌍별로 (a) 현재가 (b) 최근 체결 N건 타임라인 (c) 호가 흐름 (best bid/ask) (d) 활성 회차 슬롯 상태 표시.
- **FR-P2-FE-03 (실시간 연결)**: SSE (`/api/v1/paper/stream`) 로 단방향 server-push. 재연결은 EventSource 기본 정책 + 5s exponential backoff.
- **FR-P2-FE-04**: 백엔드 `SsePaperStreamController`는 `MarketDataHub.asSharedFlow().asFlux()` (또는 Coroutine `Flow` → ServerSentEvent) 로 변환하여 송출. 인증: 기존 JWT 헤더 기반.
- **FR-P2-FE-05**: 페이지 진입 시 초기 스냅샷 (slot 상태, 최근 체결 50건) 은 REST `/api/v1/paper/snapshot/{strategyId}` 로 hydrate, 이후 SSE delta로 갱신.
- **FR-P2-FE-06**: 모바일 우선 (Phase 1 §12 [결정 2026-04-24] PWA 유지). 터치 친화 인터랙션, 세로 레이아웃 우선.

### 6.9 메트릭/관측 (FR-P2-OBS)

- **FR-P2-OBS-01**: 신규 메트릭 (Micrometer):
  - `quant.market.tick.received_total{exchange,symbol,source}` (source=WS|REST)
  - `quant.market.tick.latency_seconds{exchange,symbol}` (수신 → Hub emit)
  - `quant.market.hub.dropped_total{reason}` (DROP_OLDEST 발생)
  - `quant.ws.connection.state{exchange}` (gauge 0/1/2 = disconnected/fallback/connected)
  - `quant.ws.reconnect.attempts_total{exchange,outcome}` (success|fail)
  - `quant.notification.send.latency_seconds{channel,priority}` (p50/p95)
  - `quant.notification.send.failure_total{channel,reason}`
  - `quant.exchange.ratelimit.usage_ratio{exchange,tenant}` (Phase 1 정의 → 실 측정 활성화)
  - `quant.audit.hash_chain.invalid_total` (검증 job 실패 카운터)
  - `quant.kek.rotation.lazy_reencrypt_total{from_version,to_version}`
- **FR-P2-OBS-02**: 분산 트레이싱 — 각 PAPER run에 `executionId` (Phase 1 정의) + 추가로 `tickId` / `orderRequestId` span attribute 부여하여 시세 → 평가 → 가상 체결 → 알림 경로 시각화.

---

## 7. Non-Functional Requirements

### 7.1 성능·SLO

- **NFR-P2-PERF-01 (시세 수신 latency)**: 빗썸 WebSocket 메시지 수신 → `MarketDataHub` emit 지연 **p50 ≤ 50ms / p95 ≤ 150ms** (네트워크 RTT 제외 기준, 단일 인스턴스).
- **NFR-P2-PERF-02 (틱 → 평가 → 가상 체결)**: 페이퍼 모드에서 **p50 ≤ 200ms / p95 ≤ 500ms / p99 ≤ 1s** (Phase 1 NFR-PERF-01 SLO를 PAPER 경로로 실측 검증).
- **NFR-P2-PERF-03 (FE SSE push)**: SSE 이벤트 backend emit → 브라우저 onmessage **p95 ≤ 300ms** (LAN 기준, WAN은 측정 후 Phase 3에서 별도 SLO).
- **NFR-P2-PERF-04 (Telegram 발송)**: notification publish → Telegram API 200 응답 **p95 ≤ 2s** (CRITICAL/RISK 우선순위 기준), INFO는 best-effort.

### 7.2 가용성·복구 SLO

- **NFR-P2-REL-01 (WebSocket 재연결)**: 끊김 감지 → 재연결 시도 ≤ 5s (Phase 1 NFR-PERF-02 유지).
- **NFR-P2-REL-02 (REST 폴백 전환)**: 10s 연속 끊김 → REST 폴링 자동 활성, 복구 시 자동 원복. 전환/원복 시 도메인 이벤트 발행 누락 0%.
- **NFR-P2-REL-03 (CircuitBreaker)**: 거래소 REST 5xx/timeout 50% (window 20) 도달 시 OPEN, 30s 후 half-open. half-open 5회 성공 시 CLOSED 복귀.
- **NFR-P2-REL-04 (DLQ)**: Kafka consumer 3회 재시도 후 100% `.DLT` 격리. consumer 재시작 시 DLQ 잔량 0%인지 메트릭 검증.

### 7.3 보안

- **NFR-P2-SEC-01 (KEK 회전 주기)**: 1년 (default). OCI Vault 미사용 시 manual SOP에 회전 절차 + 검증 체크리스트 명시.
- **NFR-P2-SEC-02 (audit chain 검증)**: nightly job이 24시간 내 모든 신규 row의 hash chain 검증. invalid 검출 시 즉시 CRITICAL 알림.
- **NFR-P2-SEC-03**: Phase 1 NFR-SEC (평문 로그/메트릭 금지, 보관 기간) 유지. Telegram Bot Token도 동일 강제.

### 7.4 용량 (Phase 2 추가)

- **NFR-P2-CAP-01**: PAPER 모드 동시 활성 슬롯 35개 (Phase 1 NFR-CAP-01 동일) 운영 시 메모리 사용 ≤ 512MB / replica.
- **NFR-P2-CAP-02**: WebSocket 단일 연결당 거래쌍 ≤ 5종 (BTC/KRW, ETH/KRW + 향후 3종 여유). 초과 시 다중 연결로 분산.
- **NFR-P2-CAP-03**: SSE 동시 클라이언트 ≤ 10개 (본인 1인 기준 + 모바일/데스크탑 멀티탭 여유).

### 7.5 관측성 / 배포

- **NFR-P2-OBS-01**: Phase 1 NFR-OBS (kotlin-logging 람다, executionId, 평문 시크릿 금지) 유지 + §6.9 신규 메트릭 추가.
- **NFR-P2-DEP-01**: k3s-lite overlay에 PAPER 모드 동작 가능한 설정 (Redis standalone, Kafka single broker). prod-k8s overlay는 Phase 3과 함께 정식화 (Phase 2는 staging/dev 한정).

---

## 8. Scope

### 8.1 In-Scope (Phase 2)

- 빗썸 Public WebSocket 시세 구독 + REST 폴백 + 자동 재연결/복구
- `MarketDataHub` (SharedFlow primary + Kafka fan-out collector, fan-out은 optional bean)
- `PaperExchangeAdapter` (slippage 모델 + 부분체결 시뮬 인터페이스)
- `ExecutionMode = PAPER` UseCase 경로 (Activate/Liquidate/Pause/Resume)
- `TelegramBotNotificationSender` (per-chat 1 msg/s + 우선순위 큐)
- Resilience: CircuitBreaker (REST/WS/Telegram), Rate Limiter (Redis token bucket), DLQ 활성
- Outbox → Kafka 실 발행 활성화 (payload deserialization 포함)
- KEK 회전 정책 (OCI Vault + 1년 + lazy re-encryption, OCI 미구축 시 LocalFile + SOP)
- `audit_log` 불변성 강화 (prev_hash chain + DB REVOKE + Kafka mirror)
- FE 페이퍼 트레이딩 모니터링 페이지 (SSE 기반 실시간)
- Phase 2 신규 메트릭 (시세 latency, WS state, 알림 latency, audit chain 등)

### 8.2 Out-of-Scope (Phase 2 명시 제외 — Phase 3 이후)

- 빗썸 실 매매 주문 발송 (`BithumbExchangeAdapter` 실 주문 경로)
- 업비트 어댑터 (REST/WS)
- 글로벌 kill-switch (전 테넌트 일괄 중지)
- 유저별 손실 한도 정의 + 강제 (OQ-012)
- 페이퍼 → 실매매 승격 정량 게이트 (OQ-019)
- NetworkPolicy / mTLS (서비스 간)
- 실매매 2FA Role / step-up auth
- 분할 원칙 1·3·4 포트폴리오 차원 (Phase 1 §15.1 유지)
- 공개 리더보드
- WORM 스토리지 (S3 Object Lock) — Phase 3+ 외부 오픈 시점 도입
- volume-weighted / 정규분포 slippage 모델 — Phase 3 실 체결 데이터로 calibration 후 도입
- WebSocket 양방향 FE 연결 — Phase 2는 SSE만

---

## 9. Assumptions

- **A-P2-01**: Phase 1 결정론 백테스트 엔진(`StrategyExecutor`, `StrategyEngineLoop`, 도메인 모델, Outbox 테이블)은 변경 없이 재사용 가능하다.
- **A-P2-02**: 빗썸 Public WebSocket은 Phase 1 약관 검토(OQ-011)에서 자동매매 명시 금지 미발견 → Phase 2 시세 구독은 약관 위반 없음. (실 매매는 Phase 3 진입 전 법무 재검토)
- **A-P2-03**: Telegram Bot Token은 사용자가 BotFather로 직접 생성하여 등록한다. 1 테넌트 당 multiple chatId 지원 여부는 Phase 3 OQ-009 확정 시점까지 단일 chatId로 동작.
- **A-P2-04**: OCI Vault Service 채택 (사용자 결정). 운영 환경에 OCI Vault Always Free Tier가 구축되어 있거나 또는 LocalFile/환경변수 KEK + SOP로 degrade 가능하다. OCI 도입 결정은 본 spec과 별개 인프라 트랙.
- **A-P2-05**: Redis는 Phase 1 인프라에 이미 standalone으로 배포 (k3s-lite overlay) — Token bucket Lua script 추가만으로 동작.
- **A-P2-06**: Kafka는 Phase 2에서 첫 실 발행을 시작하지만, Phase 1에서 인프라/토픽 컨벤션은 이미 준비됨. broker 단일 인스턴스 (k3s-lite) 가정.
- **A-P2-07**: SSE는 Gateway에서 별도 설정 변경 없이 routing 가능 (HTTP/1.1 long-lived 또는 HTTP/2). 만약 Gateway 제약 발생 시 직접 ClusterIP 노출 임시 허용 (Phase 3 정식화).

---

## 10. Dependencies

### 10.1 Phase 1 산출물 의존

- `quant/domain/` — `TrancheStrategy`, `TrancheSlot`, `Order`, 도메인 이벤트, `ExchangeCredential`, `NotificationTarget`
- `quant/app/` — `StrategyExecutor`, `StrategyEngineLoop`, `OutboxRelay`, `OutboxEventPublisher`, `ExecuteLiquidationUseCase`, `CreateStrategyUseCase`, `RunBacktestUseCase`, AES-GCM 마스킹/암호화 인프라
- Flyway V001 (9 테이블) — Phase 2에서 V002 추가 (audit_log `prev_hash`, paper_account, kek_version 등)
- ClickHouse `quant.execution_result` — PAPER 결과도 동일 스키마 적재
- FE `quant/frontend/` — PWA 셸, lightweight-charts, Tailwind 재사용

### 10.2 내부 MSA 의존성 (Phase 1과 동일 + 활성화)

- `gateway` — JWT 검증 + SSE long-lived connection routing
- `auth` / `member` — `tenantId` 식별 (변경 없음)
- `common` — Outbox, ApiResponse, BusinessException

### 10.3 외부 의존성 (신규/활성화)

- **빗썸 Public WebSocket** (`wss://`) — 신규 (Phase 1은 REST 히스토리만)
- **Telegram Bot API** (`https://api.telegram.org`) — 신규 실 발송 (Phase 1 stub)
- **OCI Vault Service (Always Free Tier)** (default) 또는 LocalFile/환경변수 KEK — KEK 회전 (신규)
- **Redis** — Token bucket Lua script (Phase 1 캐시 용도 → Phase 2 Rate Limiter 추가)
- **Kafka** — Outbox relay 실 발행 + audit mirror (Phase 1 log-only → 활성화)

### 10.4 인프라 요구

- Kafka broker 활성 (k3s-lite single broker 또는 prod-k8s 3-broker)
- Redis (standalone — k3s-lite 패턴)
- Prometheus + Grafana (Phase 1 대비 신규 메트릭 추가, 대시보드 신설 예정)

### 10.5 블로커 (Plan 단계 전 해소 필요)

**Phase 2 신규 OQ default 채택 시 즉시 진행 가능. 변경 의사 시 사용자 확인 후 진행**:

- OQ-P2-001 KEK 회전 (default: OCI Vault + 1년 + lazy)
- OQ-P2-002 audit 불변성 (default: prev_hash + REVOKE + Kafka mirror)
- OQ-P2-003 slippage (default: 고정 0.05%)
- OQ-P2-004 Telegram Rate (default: per-chat 1 msg/s + priority queue)
- OQ-P2-005 SharedFlow buffer (default: 256 + DROP_OLDEST)
- OQ-P2-006 Rate Limiter (default: Redis token bucket)
- OQ-P2-007 FE 실시간 (default: SSE)

### 10.6 ADR / Standards

- **재사용 (Phase 1 동일)**: ADR-0002, ADR-0012, ADR-0014, ADR-0015, ADR-0019, ADR-0020, ADR-0021, ADR-0022, ADR-0024
- **신규 작성 후보 (Plan 단계에서 결정)**:
  - ADR-0025 (가칭): Quant MarketDataHub (SharedFlow + Kafka fan-out) — OQ-007 결정 공식화
  - ADR-0026 (가칭): Quant Audit Log Immutability (prev_hash + REVOKE + Kafka mirror) — OQ-018 결정 공식화
  - ADR-0027 (가칭): Quant KEK Rotation Policy — OQ-017 결정 공식화

---

## 11. Test Strategy (Phase 2 추가 — 상세 `planning/test-quality.md`)

Phase 1의 도메인 결정론 테스트는 변경 없이 유지. Phase 2는 다음 영역을 추가한다:

| 영역 | 도구 | 목적 |
|---|---|---|
| WebSocket 통합 | Testcontainers + 자체 fake WebSocket server (또는 toxiproxy) | 정상 수신, 끊김 → 5s 재연결, 10s → REST 폴백, 복구 시 원복 |
| Slippage 모델 unit | Kotest property-based | 0.05% 고정 적용 정확성 (매수+, 매도-), 가격 boundary 케이스 |
| MarketDataHub fan-out | Turbine (Coroutine Flow test) | 다중 소비자 동시 수신, DROP_OLDEST 동작, Kafka publish 격리 |
| Telegram Bot 발송 | MockWebServer | 우선순위 큐 정렬, per-chat 1 msg/s 토큰 버킷, 실패 backoff 3회, 평문 토큰 로그 금지 |
| CircuitBreaker | Resilience4j Kotlin + virtual time | OPEN 임계 도달, half-open 복귀, REST/WS/Telegram 각각 |
| Rate Limiter (Redis) | Testcontainers Redis + Lua script | 분산 환경에서 정확한 토큰 소비, 다중 인스턴스 동시 호출 격리 |
| Outbox → Kafka relay | Testcontainers Kafka | 미발행 이벤트 polling, 발행 후 published_at 마킹, payload deserialization 정확성 |
| KEK 회전 lazy re-encrypt | 단위 + 통합 | 신규 KEK로 wrap, 기존 데이터 read 시 재암호화 후 write back, version prefix 정확성 |
| audit_log hash chain | 단위 + nightly job 시뮬 | prev_hash 체인 정합성, 임의 row 변조 시 검증 실패 검출 |
| FE SSE 실시간 | Vitest + EventSource mock | 초기 hydrate + delta 갱신, 재연결 5s exponential backoff, 다중 거래쌍 분기 |

성능 SLO (NFR-P2-PERF-01~04) 는 nightly 잡 또는 release-candidate 직전 1회 측정. CI normal에서는 skip.

---

## 12. Requirements Summary

- **Functional**: Phase 2 = 빗썸 WebSocket 시세 + MarketDataHub (SharedFlow + Kafka fan-out) + PaperExchangeAdapter (slippage 모델) + ExecutionMode=PAPER 경로 + Telegram 실 발송 (우선순위 + 토큰 버킷) + Resilience (CB / Rate Limiter / DLQ / Outbox 실 발행) + 보안 강화 (KEK 회전 + audit chain) + FE SSE 실시간 모니터링.
- **Scope**: Phase 1 백테스트 엔진 위에 실시간 가상 체결 경로 추가. 실 매매/업비트/글로벌 kill-switch/손실 한도/승격 게이트/2FA/원칙 1·3·4 는 Phase 3 이후.
- **Technical**: Phase 1 기술 스택 그대로 유지 (Kotlin 2.2.21 + Spring Boot 4.0.4, Coroutine Flow, JPA + QueryDSL, Tomcat 가상 스레드). 신규: Resilience4j Kotlin, Redis Lua script, OCI Vault Service (또는 LocalFile + SOP), SSE controller. FE는 Phase 1 PWA 셸 위에 모니터링 페이지 추가.
- **Decisions ratio**: 사용자 사전 합의 2건 (OQ-007, OQ-011) + Phase 2 신규 OQ 7건 default 제안 (1회 확인 후 진행).

---

## 13. Next Steps

1. 사용자에게 §2.2 default 제안 1세트 확인 (변경 의견 수집 — 1회).
2. (선택) 변경 발생 시 본 requirements.md + open-questions.yml 업데이트.
3. `planning/test-quality.md` (Phase 2 추가분) 검토.
4. Plan 단계 진입: ADR-0025/0026/0027 초안, spec.md (Phase 2 모듈 구조 + 데이터 모델 추가 + API 엔드포인트 추가), tasks.md.
