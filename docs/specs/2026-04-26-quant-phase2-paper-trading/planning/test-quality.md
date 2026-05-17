<!-- source: quant -->
---
spec: quant-phase2-paper-trading
date: 2026-04-26
status: test-strategy-draft (Phase 2 추가분만)
phase: 2 of 3
depends-on:
  - planning/requirements.md
  - context/open-questions.yml
phase1-references:
  - docs/specs/2026-04-24-quant-crypto-trading/planning/test-quality.md
standards:
  - docs/standards/test-rules.md (Kotest BehaviorSpec + MockK)
  - docs/adr/ADR-0002-language-and-framework.md
  - docs/adr/ADR-0012-idempotent-consumer.md
  - docs/adr/ADR-0015-resilience-strategy.md
---

# Test & Quality Strategy — Phase 2 (Paper Trading) 추가분

> Phase 1 `test-quality.md`의 도메인 결정론/골든셋/INV 규약은 변경 없이 유지된다.
> 본 문서는 **Phase 2에서 신규로 추가되는 테스트 영역**만 다룬다.

---

## 1. 추가 테스트 목표

- **비결정론 경계 격리**: 실시간 시세/네트워크 IO/외부 API는 fake 또는 testcontainers로 격리하고, 도메인 평가 자체는 Phase 1 결정론 테스트로 보호 유지.
- **시간 의존성 가상화**: 재연결 5s / REST 폴백 10s / Rate Limit refill 등은 Coroutine virtual time (`runTest`) 또는 `MutableClock`으로 검증.
- **분산 일관성**: Redis token bucket은 multi-instance 동시 호출 시나리오로 검증.
- **변조 검출 가능성**: audit chain / KEK 회전은 negative path (의도적 변조/구버전 데이터) 도 강제 검증.
- **플랫폼 SLA 회귀 보호**: Phase 1 NFR-PERF-01 (틱 → 평가 → 송신 p95 500ms) 가 PAPER 경로에서도 성립하는지 nightly 측정.

---

## 2. 영역별 테스트 (신규)

### 2.1 WebSocket 통합 테스트 (FR-P2-WS)

**도구**: Testcontainers (필요 시) + 자체 Fake Bithumb WebSocket Server (Ktor 또는 Java WebSocket Server) + Coroutine `runTest` virtual time + Turbine.

| Spec 후보 | 검증 |
|---|---|
| `BithumbWebSocketSubscriberSpec` | 정상 메시지 수신 → `Tick` 정규화 출력 |
| `BithumbWebSocketReconnectSpec` | 5s 이내 재연결 (지수 백오프 1s→2s→5s 상한) |
| `BithumbWebSocketFallbackSpec` | 10s 연속 끊김 → REST 폴링 자동 전환, 복구 시 자동 원복, `ExchangeConnectionDegraded`/`Restored` 이벤트 발행 |
| `BithumbWebSocketHeartbeatSpec` | ping-pong / idle timeout 처리 |
| `WebSocketChaosScenarioSpec` (옵션) | toxiproxy 또는 자체 chaos 주입으로 random disconnect 패턴 검증 |

**원칙**:
- 실 빗썸 endpoint 호출 금지 (모든 테스트는 fake server target).
- virtual time을 우선 사용하고, 실제 5s/10s wall-clock은 nightly 잡에서만 사용.

### 2.2 MarketDataHub Fan-out (FR-P2-HUB)

**도구**: Turbine, Kotest BehaviorSpec, MockK (Kafka publisher mock).

| Spec 후보 | 검증 |
|---|---|
| `MarketDataHubFanoutSpec` | 다중 구독자가 동일 tick 수신 (in-process SharedFlow 검증) |
| `MarketDataHubBufferOverflowSpec` | 느린 소비자 + extraBufferCapacity=256 + DROP_OLDEST 시 새 tick 우선, drop 카운터 증가 |
| `MarketDataHubKafkaCollectorSpec` | Kafka publisher bean 활성/비활성 시 동작 격리 (active → publish 호출, inactive → no-op), 발행 실패 시 hot path 영향 0% |
| `MarketDataHubBackpressureSpec` | producer 비차단 (DROP_OLDEST 정책 강제) |

### 2.3 SimulatedExchangeAdapter (FR-P2-SIM)

**도구**: Kotest BehaviorSpec, kotest-property (slippage boundary), MockK.

| Spec 후보 | 검증 |
|---|---|
| `PaperExchangeAdapterMarketBuySpec` | 시장가 매수: latest tick × (1 + 0.0005) 가격 체결 (slippage 매수 +) |
| `PaperExchangeAdapterMarketSellSpec` | 시장가 매도: latest tick × (1 - 0.0005) 가격 체결 (slippage 매도 -) |
| `SlippageModelPropertySpec` | property — 매수 가격 ≥ tick, 매도 가격 ≤ tick (어떤 입력에서도) |
| `PaperExchangeAdapterPartialFillSpec` | partial-fill probability=1.0 강제 시 OrderPartiallyFilled 이벤트 발행, ratio가 [min,max] 범위 |
| `PaperAccountIsolationSpec` | PaperAccount 잔고 변경이 실 ExchangeCredential 잔고와 분리됨 (DB/repository 격리) |
| `OrderIdIdempotencySpec` | 동일 OrderId 재전송 시 동일 가상 체결 결과 반환 (INV-06 유지) |

### 2.4 Telegram Bot Sender (FR-P2-NOTIF)

**도구**: MockWebServer (OkHttp) — Telegram Bot API 스텁.

| Spec 후보 | 검증 |
|---|---|
| `TelegramBotSenderHappyPathSpec` | 정상 메시지 포맷 (markdown/parse_mode 등), HTTP 200 처리 |
| `TelegramBotSenderRateLimitSpec` | per-chat 1 msg/s 토큰 버킷 — 1초 내 2건 발송 시 두 번째 지연 |
| `TelegramBotSenderPrioritySpec` | CRITICAL > RISK > INFO 순서로 큐에서 dequeue |
| `TelegramBotSenderRetryBackoffSpec` | API 5xx 3회 (1s/2s/4s) 재시도 후 audit_log 실패 기록 |
| `TelegramBotSenderTokenMaskingSpec` | bot token 평문이 어떤 로그/메트릭에도 노출되지 않음 (Phase 1 `SensitiveDataMaskingSpec` 패턴 재사용) |
| `TelegramBotSenderIdempotencySpec` | notification_event_id 기반 중복 발송 방어 (ADR-0012) |

### 2.5 Resilience (FR-P2-RES)

**도구**: Resilience4j Kotlin + Coroutine virtual time, Testcontainers Redis (Rate Limiter), Testcontainers Kafka (DLQ).

| Spec 후보 | 검증 |
|---|---|
| `BithumbRestCircuitBreakerSpec` | 실패율 50% (window 20) 도달 시 OPEN, 30s 후 half-open, 5회 성공 시 CLOSED |
| `TelegramCircuitBreakerSpec` | 동일 임계 정책, half-open 실패 시 재 OPEN |
| `RedisTokenBucketSpec` | Lua script 정확성 — 토큰 소비/refill, multi-thread 동시 호출 시 합산 오버플로 0% |
| `RedisTokenBucketDistributedSpec` | 2개 인스턴스 동시 호출 시 합산 한도 준수 (Testcontainers Redis 공유) |
| `KafkaConsumerDlqSpec` | 3회 재시도 후 `.DLT` 토픽 격리, retry 횟수 메트릭 정확성 |
| `OutboxKafkaRelaySpec` | 미발행 row polling → publish → published_at 마킹, payload deserialization 정확성 (Phase 1 알려진 제약 #3 검증) |
| `OutboxRelayFailureRecoverySpec` | publish 실패 시 published_at 미세팅, 다음 polling에서 재시도 |

### 2.6 KEK 회전 (FR-P2-SEC-01)

**도구**: 단위 테스트 + Testcontainers (KMS LocalStack 또는 fake KMS adapter).

| Spec 후보 | 검증 |
|---|---|
| `KekRotationLazyReencryptSpec` | kek-v1 암호문 → 회전 후 kek-v2 wrap → 다음 read 시 lazy re-encrypt 후 write back, version prefix 갱신 |
| `KekVersionPrefixSpec` | 암호문 prefix `kek-v{N}` 정확성, version 누락 시 예외 |
| `KekRotationBackwardCompatSpec` | kek-v1 데이터와 kek-v2 데이터가 동시에 존재해도 read 정상 |
| `KekRotationFailureSpec` | KMS 연결 실패 시 환경변수 KEK fallback (degrade 모드) 동작 |

### 2.7 audit_log 불변성 (FR-P2-SEC-02)

**도구**: Testcontainers MySQL + Kafka, Kotest BehaviorSpec.

| Spec 후보 | 검증 |
|---|---|
| `AuditLogHashChainAppendSpec` | 신규 row insert 시 prev_hash = SHA256(prev_row || payload) 정확성 |
| `AuditLogHashChainTamperDetectionSpec` | 임의 row UPDATE/DELETE (DBA 권한) 시 nightly 검증 job이 invalid 검출 |
| `AuditLogDbPermissionSpec` | application user로 UPDATE/DELETE 시도 시 권한 거부 (Flyway migration 검증) |
| `AuditLogKafkaMirrorSpec` | row insert 후 `quant.audit.v1` 토픽에 동일 payload 발행, consumer 격리 저장소 적재 검증 |
| `AuditLogChainReplayJobSpec` | nightly job이 24시간 분량 chain replay, 정상 시 metric 0 / invalid 시 alarm |

### 2.8 ExecutionMode=PAPER UseCase (FR-P2-USE)

**도구**: Kotest BehaviorSpec, MockK.

| Spec 후보 | 검증 |
|---|---|
| `ActivateStrategyPaperModeSpec` | PAPER 모드 활성화 시 PaperExchangeAdapter + MarketDataHub.subscribe 주입 |
| `PaperModeEngineReuseSpec` | StrategyExecutor / StrategyEngineLoop 코드가 BACKTEST와 PAPER 양쪽에서 동일하게 동작 (Adapter 교체만) |
| `PaperModeEndReasonSpec` | EndReason ∈ {Liquidated, Paused, Archived} 만 허용 (Completed 차단) |
| `PaperResultSchemaCompatSpec` | PAPER 결과가 Phase 1 BacktestResult 스키마로 직렬화 가능, leaderboard 비교 UI 데이터 호환 |

### 2.9 FE 페이퍼 모니터링 (FR-P2-FE)

**도구**: Vitest + React Testing Library + EventSource mock.

| Spec 후보 | 검증 |
|---|---|
| `PaperTradingMonitorPageSpec` | 초기 hydrate (REST snapshot) → SSE delta 갱신 합산 |
| `SsePaperStreamHookSpec` | EventSource 재연결 (5s exponential backoff), error 핸들링 |
| `RealtimePricePanelSpec` | 가격 변동 highlight, 호가 흐름 표시, 모바일 레이아웃 |
| `PaperExecutionTimelineSpec` | 가상 체결 타임라인 표시, 회차별 색상 분기 |
| `MultiSymbolTabsSpec` | 거래쌍 탭 전환 시 SSE 구독 격리 (탭 변경 시 정상 unsubscribe) |

### 2.10 메트릭 (FR-P2-OBS)

**도구**: Micrometer SimpleMeterRegistry + 단위 테스트.

| Spec 후보 | 검증 |
|---|---|
| `Phase2MetricsRegistrationSpec` | §6.9 신규 메트릭 10종 모두 registry에 등록, label key 정확성 |
| `WebSocketStateGaugeSpec` | gauge 값 0/1/2 = disconnected/fallback/connected 전이 정확성 |
| `TickLatencyHistogramSpec` | 수신 → Hub emit 측정값 기록 (timer) |

---

## 3. 통합 / E2E 시나리오 (Phase 2 추가)

### 3.1 PAPER 모드 end-to-end (Docker 환경 1회)

1. k3s-lite 또는 Docker compose 환경 기동 (MySQL + Redis + Kafka + Fake Bithumb WS server)
2. PAPER 전략 활성화 (BTC/KRW, 7회차)
3. Fake WS 서버에서 시나리오 시세 (정상 → 끊김 10s → 복구) 송신
4. 검증: 회차별 가상 체결 발생, ExchangeConnectionDegraded/Restored 이벤트, Outbox → Kafka 발행, audit_log row + Kafka mirror, Telegram 알림 (mock receiver), FE SSE 실시간 갱신
5. 종료 후: 메트릭 (`/actuator/prometheus`)에 §6.9 메트릭 모두 노출 확인

### 3.2 부하 / SLO 회귀 (nightly)

- **틱 → 평가 → 가상 체결 SLO** (NFR-P2-PERF-02): k6 또는 Gatling으로 100 TPS tick 주입, p95 ≤ 500ms 회귀 보호
- **Telegram 발송 SLO** (NFR-P2-PERF-04): mock receiver 부하, p95 ≤ 2s 측정
- **WebSocket 복구** (NFR-P2-REL-01/02): 끊김 주입 후 5s/10s 규칙 timing 측정

---

## 4. INV (Phase 2 추가)

Phase 1 INV-01 ~ INV-07 유지. 본 Phase 2 신규:

- **INV-P2-08 (시세 출처 표기)**: 모든 `Tick` 인스턴스는 `source ∈ {WS, REST}` 필드를 가지며 누락 금지.
- **INV-P2-09 (PaperAccount 격리)**: PaperAccount 잔고는 ExchangeCredential 잔고 테이블과 절대 동일 row를 참조하지 않는다. Repository 단계 검증.
- **INV-P2-10 (audit chain 정합성)**: 어떤 audit_log row도 prev_hash 필드 없이 insert될 수 없다 (DB constraint + 검증 job 양쪽).
- **INV-P2-11 (KEK version 표기)**: 모든 암호문은 `kek-v{N}` prefix를 가지며 누락 시 read 거부.
- **INV-P2-12 (Telegram token masking)**: Bot Token 평문이 어떤 log/metric/exception message에도 노출되지 않는다 (Phase 1 마스킹 확장).

---

## 5. 커버리지 목표 (Phase 2 추가 영역)

| 대상 | 라인 커버리지 | 비고 |
|---|---|---|
| `MarketDataHub` (Hub + collector) | ≥ 85% | Coroutine Flow 분기 위주 |
| `BithumbWebSocketSubscriber` | ≥ 75% | fake server 기반 (실 endpoint 제외) |
| `PaperExchangeAdapter` + `SlippageModel` | ≥ 90% | 도메인 인접, 결정론 |
| `TelegramBotNotificationSender` | ≥ 80% | MockWebServer 기반 |
| `OutboxRelay` (Phase 2 활성화 코드) | ≥ 85% | payload deserialization 포함 |
| KEK 회전 / audit chain | ≥ 90% | 보안 핵심, negative path 강제 |
| FE PaperTradingMonitor | ≥ 70% | RTL + EventSource mock |

---

## 6. 오픈 이슈 (Phase 2 test-quality 관점)

- **TQ-P2-OQ-01**: Fake Bithumb WebSocket Server 구현체 — Ktor / Spring WebSocket / Java WebSocket API 중 어느 것? (test code 의존성 최소화 우선)
- **TQ-P2-OQ-02**: AWS KMS LocalStack 사용 vs 자체 Fake KEK Provider — CI 환경 이미지 크기/속도 trade-off
- **TQ-P2-OQ-03**: SSE FE 통합 테스트에서 EventSource polyfill 선택 (jsdom 기본 미지원)
- **TQ-P2-OQ-04**: Phase 2 nightly SLO 측정 환경 — 로컬 k3d / CI runner / 전용 노드 표준화 (Phase 1 TQ-OQ-04와 통합)

이 목록은 Plan 단계 진입 시 `context/open-questions.yml`로 승격 검토.

---

## 7. CI 통합

- **PR 필수 (CI normal)**: Phase 1 기존 + 본 문서 §2 의 단위/Coroutine virtual time 테스트 (네트워크 / 실 Redis / 실 Kafka 미사용)
- **PR opt-in (`-PincludeIntegration=true`)**: §2.1 / §2.5 / §2.7 의 Testcontainers 기반 (Redis / Kafka / MySQL)
- **Nightly**: §3.2 SLO 회귀 + §3.1 E2E 1회 + 보안 negative path (audit tamper, KEK fallback)
- **Release-candidate 직전**: 풀 스위트 + 수동 PAPER 모드 1일 운용 (실 빗썸 시세 + mock telegram)
