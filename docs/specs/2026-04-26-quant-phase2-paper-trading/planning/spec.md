---
spec: quant-phase2-paper-trading
date: 2026-04-26
status: spec-draft
phase: 2 of 3
depends-on:
  - planning/initialization.md
  - planning/requirements.md
  - planning/test-quality.md
  - context/open-questions.yml
phase1-references:
  - docs/specs/2026-04-24-quant-crypto-trading/planning/spec.md
  - docs/adr/ADR-0024-quant-service.md
  - quant/docs/phase1-readiness.md
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

# Specification — quant Phase 2 (Paper Trading)

> 본 spec은 Phase 1 spec(`docs/specs/2026-04-24-quant-crypto-trading/planning/spec.md`)을 단일 출처로 두고, **Phase 2 추가 범위만** 정의한다.
> 도메인 모델/Port/배포/보안 기조 등 변경 없는 항목은 Phase 1 spec을 참조하며 본 문서에 중복 서술하지 않는다.

---

## 1. Overview & Goals

Phase 1에서 확보한 결정론 백테스트 엔진(`StrategyExecutor`, `StrategyEngineLoop`, 도메인 모델)을 그대로 재사용하여, **빗썸 실시간 시세 + 가상 체결(Paper Trading)** 경로를 추가한다. 코어 엔진은 변경 없이 `ExchangeAdapter`/`MarketDataSubscriber` 구현체만 교체된다(Phase 1 결정 §6 Phase 추상화 재사용).

Phase 2의 목표는 (a) Phase 1 결정론 결과와 실시간 가상 체결 결과의 격차(slippage / latency / WS 단절)를 측정 가능한 형태로 노출, (b) Phase 3 실매매 진입 전 필수 운영 인프라(Resilience, Outbox 실 발행, KEK 회전, audit 불변성, 텔레그램 알림)를 가동·검증하는 것이다. **본 Phase에 실 거래소 주문 발송은 없다** — Phase 3 진입 전 안전판 역할.

---

## 2. Architecture (Phase 2 추가 컴포넌트)

### 2.1 신규 컴포넌트 배치

Phase 1 패키지 구조(`com.kgd.quant.{domain|application|infrastructure|presentation}`) 위에 다음 컴포넌트를 추가한다.

```
com.kgd.quant/
├── application/
│   ├── market/
│   │   └── MarketDataHub.kt                 (NEW) SharedFlow primary + fan-out
│   ├── paper/
│   │   ├── usecase/
│   │   │   ├── StartPaperTradingUseCase.kt  (NEW)
│   │   │   ├── PausePaperTradingUseCase.kt  (NEW)
│   │   │   └── ResumePaperTradingUseCase.kt (NEW)
│   │   └── port/
│   │       ├── PaperAccountRepositoryPort.kt (NEW)
│   │       └── KeyManagementService.kt       (NEW Port — KEK Adapter 추상화)
│   └── notification/
│       └── port/
│           └── NotificationPriorityQueue.kt  (NEW)
├── infrastructure/
│   ├── stream/
│   │   ├── BithumbWebSocketSubscriber.kt    (NEW MarketDataSubscriber 구현)
│   │   ├── BithumbRestFallbackPoller.kt     (NEW REST 폴백)
│   │   └── MarketTickKafkaCollector.kt      (NEW Hub fan-out → Kafka)
│   ├── client/
│   │   ├── exchange/
│   │   │   ├── AbstractJwtBasedExchangeAdapter.kt (NEW 베이스 — 빗썸/업비트 공통)
│   │   │   ├── BithumbJwtAuthenticator.kt   (NEW JWT HS256 서명)
│   │   │   └── PaperExchangeAdapter.kt      (NEW SimulatedExchange 구현)
│   │   └── notification/
│   │       └── TelegramBotNotificationSender.kt (NEW Phase 1 stub 대체)
│   ├── security/
│   │   ├── kms/
│   │   │   ├── OciVaultKmsAdapter.kt        (NEW 운영 KEK)
│   │   │   └── LocalFileKmsAdapter.kt       (NEW 로컬 dev KEK)
│   │   └── audit/
│   │       ├── AuditLogPublisher.kt         (NEW prev_hash 체인 + Kafka mirror)
│   │       └── AuditChainVerifier.kt        (NEW nightly 검증 job)
│   ├── messaging/
│   │   └── outbox/
│   │       └── OutboxKafkaRelay.kt          (REWORK Phase 1 log-only → 실 publish)
│   └── resilience/
│       ├── RedisTokenBucketRateLimiter.kt   (NEW Lua script)
│       └── CircuitBreakerConfiguration.kt   (NEW Resilience4j 설정)
└── presentation/
    └── paper/
        ├── PaperTradingController.kt        (NEW REST start/status)
        └── PaperStreamSseController.kt      (NEW SSE)
```

### 2.2 데이터 흐름 (페이퍼 모드)

```
Bithumb WS  ─┐
             ├──> BithumbWebSocketSubscriber ──> MarketDataHub (SharedFlow<Tick>)
Bithumb REST ┘   (10s 단절 시 폴백)                     │
                                                        ├──> StrategyEngineLoop (트리거 평가)
                                                        ├──> PaperExchangeAdapter (가상 체결)
                                                        ├──> PaperStreamSseController (FE push)
                                                        ├──> NotificationPriorityQueue → TelegramBotSender
                                                        └──> MarketTickKafkaCollector (옵셔널 bean,
                                                              Phase 2 default disabled)
```

`StrategyExecutor` 내부 코드는 Phase 1 그대로. `ExecutionMode = PAPER`일 때 DI 컨테이너가 `PaperExchangeAdapter` + `MarketDataHub.subscribe(symbol)`을 주입한다.

### 2.3 런타임 모델 (ADR-0002 재확인)

- 시세 수신/Hub 팬아웃: Coroutine `SharedFlow<Tick>` (in-process, hot path)
- WebSocket 클라이언트: `reactor-netty` `WebSocketClient` + `awaitX` 브릿지 (WebFlux 미도입)
- 거래소 REST: Phase 1 동일 (`WebClient` + `suspend`)
- SSE 컨트롤러: Spring MVC `SseEmitter` (suspend 컨트롤러 호환). 가상 스레드 위에서 long-lived 연결 유지.

---

## 3. 거래소 인증 정정 (Phase 1 Errata)

### 3.1 정정 사항

Phase 1 ADR-0024 §3·§9.1 / spec.md §9.1 / Phase 1 코드 일부에 표기된 **"빗썸 HMAC-SHA512 인증"은 오류**다. 빗썸 API 2.0은 **JWT(HS256)** 방식이며 업비트와 동일한 패턴이다.

| 항목 | Phase 1 표기 (오류) | Phase 2 정정 |
|---|---|---|
| 빗썸 인증 방식 | HMAC-SHA512 | JWT(HS256) |
| 보관 비밀 | (불명확) | Access Key + Secret Key (업비트와 동일) |
| 요청 헤더 | (불명확) | `Authorization: Bearer <jwt>` |
| JWT payload | — | `access_key`, `nonce`, `timestamp`, `query_hash`, `query_hash_alg=SHA512` |

> ADR-0024 본문 정정은 **ADR-0024 Errata 섹션 추가** 또는 **별도 ADR로 분리 발행**한다(본 spec §15 ADR 후보 참조).

### 3.2 공통 베이스 클래스

빗썸/업비트 모두 JWT 방식이므로 `AbstractJwtBasedExchangeAdapter` 베이스 클래스로 시그니처 생성/헤더 첨부/Rate Limiter 호출을 통일한다.

```kotlin
abstract class AbstractJwtBasedExchangeAdapter(
    private val keyManagementService: KeyManagementService,
    private val rateLimiter: RedisTokenBucketRateLimiter,
    private val circuitBreaker: CircuitBreaker,
) : ExchangeAdapter {
    protected abstract val exchange: Exchange
    protected suspend fun signedHeaders(tenantId: TenantId, queryString: String?): HttpHeaders { /* ... */ }
    // 공통: nonce 생성, query_hash(SHA512) 계산, JWT HS256 서명
}
```

Phase 2에서 `PaperExchangeAdapter`는 베이스 상속하지 않는다(가상 체결이라 인증 불필요). Phase 3에서 실 `BithumbExchangeAdapter` / `UpbitExchangeAdapter` 모두 본 베이스를 상속한다.

---

## 4. MarketDataHub 설계

### 4.1 책임

- 단일 빗썸 WS 구독 스트림을 in-process 다중 소비자에게 fan-out (FR-P2-HUB-01).
- 소비자: (a) `StrategyEngineLoop` 트리거 평가, (b) `PaperStreamSseController` FE push, (c) `NotificationPriorityQueue` 알림 트리거(고/저점 임박 등), (d) `MarketTickKafkaCollector` 외부 발행(옵셔널).
- Hub의 모든 emit은 비차단(`tryEmit`) — producer가 느린 소비자에 차단되지 않음.

### 4.2 시그니처 스케치

```kotlin
@Component
class MarketDataHub {
    private val flow = MutableSharedFlow<Tick>(
        replay = 0,
        extraBufferCapacity = 256,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    fun asFlow(): SharedFlow<Tick> = flow.asSharedFlow()
    fun emit(tick: Tick) {
        val accepted = flow.tryEmit(tick)
        if (!accepted) metrics.incrementDropped(reason = "buffer_overflow")
    }
}
```

### 4.3 Kafka fan-out collector (옵셔널)

- `MarketTickKafkaCollector`는 `MarketDataHub.asFlow()`를 별도 coroutine job에서 collect 하여 `quant.market.tick.bithumb.v1` 토픽으로 발행.
- `@ConditionalOnProperty(name = "quant.market-data.kafka-fanout.enabled", havingValue = "true")` — **Phase 2 default false**, 외부 소비자(analytics 등) 생기는 시점에 enable.
- 발행 실패는 hot path에 영향 0% (별도 coroutine context, 실패는 메트릭만 증가).

### 4.4 다이어그램

```
                       (single producer)
        WS Subscriber  ────► MarketDataHub.emit()
                                  │
                  ┌───────────────┼────────────────┬────────────────┐
                  ▼               ▼                ▼                ▼
        StrategyEngineLoop   SsePaperStream   AlertEngine     KafkaCollector
        (hot, tryEmit OK)    (per-client)     (priority Q)    (옵셔널 bean)
```

### 4.5 메트릭

- `quant.market.tick.received_total{exchange,symbol,source}` (source ∈ {WS, REST})
- `quant.market.tick.latency_seconds{exchange,symbol}` (수신 → Hub emit)
- `quant.market.hub.dropped_total{reason}` (DROP_OLDEST 발생 카운터)
- `quant.market.hub.subscribers{type}` (gauge — 활성 소비자 수)

---

## 5. SimulatedExchangeAdapter (PaperExchangeAdapter)

### 5.1 책임 (FR-P2-SIM)

- `ExchangeAdapter` port의 PAPER 구현체. 실 주문 발송 없이 `MarketDataHub`의 latest tick에 slippage 적용한 가격으로 가상 체결.
- 가상 잔고는 `PaperAccount` 엔티티로 관리 — `ExchangeCredential` 잔고와 절대 혼용 금지(INV-P2-09).
- 주문 ID는 Phase 1 동일 UUID v7. 가상 체결 결과의 `exchangeOrderId`는 `paper-{uuid}` prefix.

### 5.2 Slippage 모델

- 인터페이스 `SlippageModel`로 추상화 → Phase 3 volume-weighted/정규분포 교체 여지.
- Phase 2 default 구현 = `FixedSlippageModel(rate = 0.0005)` (0.05%, BTC/ETH 메이저 기준).
- 매수: `executedPrice = tick × (1 + 0.0005)` (unfavorable +)
- 매도: `executedPrice = tick × (1 - 0.0005)` (unfavorable -)

### 5.3 부분체결 시뮬

- 설정: `paper.partial-fill.probability` (default 0.0 — Phase 2는 비활성), `partial-fill.ratio-min/max`.
- 활성화 시 `OrderPartiallyFilled` 이벤트가 정상 경로로 발행되는지 인터페이스 검증 목적.

### 5.4 체결 latency 모델

- `paper.execution-latency.ms.default = 50` (REST 응답 가정값) + jitter ±20ms.
- 목적: 시세 수신 → 평가 → 가상 체결 → SSE push 경로의 latency SLO(NFR-P2-PERF-02 p95 ≤ 500ms) 검증.

### 5.5 가상 잔고 (`PaperAccount`)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| paper_account_id | BIGINT PK | |
| tenant_id | VARCHAR(64) | INV-05 |
| strategy_id | BIGINT | FK split_strategy |
| base_asset | VARCHAR(16) | KRW (default) |
| balance | DECIMAL(28,8) | 가상 잔고 |
| created_at / updated_at | DATETIME(6) | |

- Flyway V002에 신규 테이블 추가.
- Repository는 `PaperAccountRepositoryPort` 단일 진입점, tenantId 필터 강제.

---

## 6. WebSocket 클라이언트 (BithumbWebSocketSubscriber)

### 6.1 책임 (FR-P2-WS)

- 빗썸 Public WebSocket(`wss://`) 연결, `ticker` / `orderbook` / `transaction` 채널 구독.
- 수신 페이로드를 `Tick(symbol, price, qty, timestamp, source: WS|REST)`로 정규화하여 `MarketDataHub.emit()`.
- heartbeat / ping-pong 처리 (빗썸 사양 실측 기반, idle timeout 시 즉시 재연결).

### 6.2 재연결 / 폴백 정책

| 조건 | 동작 |
|---|---|
| WS 단절 감지 | 5초 이내 재연결 (지수 백오프 1s → 2s → 5s 상한) |
| 연속 10초 단절 | REST 매초 폴링 자동 활성, `ExchangeConnectionDegraded` 이벤트 발행 |
| WS 복구 | 자동 원복, `ExchangeConnectionRestored` 이벤트 발행, REST 폴링 중지 |
| heartbeat 미수신 | idle timeout 트리거 → 즉시 재연결 |

- WebSocket 연결 메트릭: `quant.ws.connection.state{exchange}` (0=disconnected, 1=fallback, 2=connected).
- 재연결 시도: `quant.ws.reconnect.attempts_total{exchange,outcome=success|fail}`.

### 6.3 구현 노트

- `reactor-netty` `WebSocketClient` + Coroutine 브릿지 (Phase 1 dependencies에 포함됨).
- 연결 lifecycle은 `@Component` 단위로 `@PostConstruct` 시작, `@PreDestroy` graceful close.
- 트랜잭션 외부(ADR-0020): WS 콜백/Hub emit 코드 경로에 `@Transactional` 금지.

---

## 7. TelegramBotNotificationSender

### 7.1 책임 (FR-P2-NOTIF)

- Phase 1 stub 대체. Telegram Bot API HTTP POST로 실 메시지 발송.
- Bot Token은 `NotificationTarget.botTokenCipher`(AES-GCM) → `KeyManagementService.unwrap()` 후 사용. 평문 로그/메트릭 금지(INV-P2-12).

### 7.2 우선순위 큐

```kotlin
enum class NotificationPriority { CRITICAL, RISK, INFO }

interface NotificationPriorityQueue {
    fun enqueue(event: NotificationEvent, priority: NotificationPriority)
    suspend fun dequeue(): NotificationEvent  // CRITICAL > RISK > INFO 순
}
```

- 우선순위 매핑:
  - **CRITICAL**: 긴급 청산 실행, 거래소 인증 실패, 5xx 연속(CB OPEN)
  - **RISK**: 회차 전 소진(`AWAITING_EXHAUSTED`), Rate Limit 80% 도달, WS 폴백 전환
  - **INFO**: 체결 성공, 슬롯 EMPTY 복귀

### 7.3 Rate Limit per chat

- per-chat 1 msg/s 토큰 버킷 (Telegram API 공식 한도 준수).
- 분산 환경 대비 Redis token bucket(§9 Resilience와 동일 메커니즘) 적용 — chatId가 키.

### 7.4 재시도 / 멱등성

- Telegram API 5xx/timeout: exponential backoff 3회(1s/2s/4s) → 실패 시 audit_log + 메트릭.
- 발송 worker는 `notification_event_id` 기반 멱등(ADR-0012 `processed_event` 패턴).

### 7.5 메트릭

- `quant.notification.send.latency_seconds{channel=telegram, priority}` (p50/p95)
- `quant.notification.send.failure_total{channel, reason}`
- `quant.notification.queue.depth{priority}` (gauge)

---

## 8. Resilience

### 8.1 CircuitBreaker (Resilience4j)

| Circuit Breaker | 대상 | 임계 |
|---|---|---|
| `bithumb-rest` | 빗썸 REST 폴링/주문조회 | 실패율 50% / window=20 / wait=30s |
| `bithumb-ws-reconnect` | WS 재연결 시도 | 실패율 50% / window=20 / wait=30s |
| `telegram-bot` | Telegram Bot API | 실패율 50% / window=20 / wait=30s |

- ADR-0015 §1 표준 설정 재사용. half-open 5회 성공 시 CLOSED 복귀.
- Phase 2에서 `gradle/libs.versions.toml`에 `resilience4j-circuitbreaker` / `resilience4j-kotlin` 카탈로그 등재 재확인(Phase 1 spec §16에서 "order/app 리터럴 카탈로그 승격"으로 명시됨).

### 8.2 Rate Limiter (Redis Token Bucket)

- 구현: `RedisTokenBucketRateLimiter` — Redis Lua script로 atomic 토큰 소비/refill.
- 키: `ratelimit:{exchange}:{tenantId}:{apiKeyHash}`.
- 버킷 사이즈/refill rate: Phase 2는 보수적 default(빗썸 공식 한도의 60%) — Phase 3에서 OQ-004 확정 후 상향.
- 80% 도달 시 RISK 알림, 95% 도달 시 자가 백오프.
- 메트릭: `quant.exchange.ratelimit.usage_ratio{exchange,tenant}` (Phase 1 정의 → 활성).

### 8.3 DLQ

- ADR-0015 §2 표준 적용. Spring Kafka `DefaultErrorHandler` + `DeadLetterPublishingRecoverer`.
- 3회 재시도(1s `FixedBackOff`) → `{원본토픽}.DLT` 전송.
- consumer group: `quant-{purpose}` (예: `quant-notification`, `quant-audit-mirror`).

### 8.4 Outbox → Kafka relay 활성화 (Phase 1 stub 제거)

- Phase 1 `OutboxRelay`는 log-only(payload deserialization 미구현 — 알려진 제약 #3).
- Phase 2: 실 Kafka publish + `published_at` 마킹. payload deserialization은 이벤트 type별 `EventPayloadCodec` 등록.
- 컨슈머 측 멱등성(ADR-0012): `processed_event(event_id)` 테이블로 중복 방어. Telegram worker, audit mirror consumer 모두 적용.

---

## 9. KEK 보관 (envelope encryption)

### 9.1 Port 추상화

```kotlin
interface KeyManagementService {
    suspend fun wrap(plaintextDek: ByteArray): WrappedDek      // returns kek-v{N} prefixed
    suspend fun unwrap(wrappedDek: ByteArray): ByteArray
    suspend fun currentKekVersion(): String                    // e.g. "kek-v2"
}
data class WrappedDek(val ciphertext: ByteArray, val kekVersion: String)
```

OCI 락-인 회피 + 미래 GCP/AWS/Vault self-host 마이그레이션 여지 확보 목적.

### 9.2 운영 어댑터 — `OciVaultKmsAdapter`

- OCI Vault Service(Always Free Tier) — envelope encryption REST API 호출(`/encrypt`, `/decrypt`).
- 자동 회전: OCI Vault 자체 회전 정책(연 1회 default) + lazy re-encryption.
- 감사 로그: OCI Audit Service에 자동 적재 → 외부 사본 확보.
- 자격증명 주입: `OCI_TENANCY`, `OCI_USER`, `OCI_FINGERPRINT`, `OCI_PRIVATE_KEY_PATH`, `OCI_REGION`, `OCI_VAULT_KEY_OCID` (K8s Secret).

### 9.3 로컬 dev 어댑터 — `LocalFileKmsAdapter`

- KEK는 환경변수 `QUANT_LOCAL_KEK`(hex 64 chars = 256 bits) 또는 `application-local.yml`에서 로드.
- `application-local.yml`은 `.gitignore` 처리, 절대 commit 금지(INV).
- 회전: 수동(`kek-v1` → `kek-v2` 환경변수 swap), lazy re-encryption은 동일 메커니즘으로 동작.

### 9.4 lazy re-encryption

- 회전 후 신규 DEK는 신규 KEK로 wrap.
- 기존 암호문 read 시점에 `unwrap → 신규 KEK로 wrap → write back`.
- 암호문 prefix `kek-v{N}`로 version 추적, mismatch 시 자동 재암호화.
- 메트릭: `quant.kek.rotation.lazy_reencrypt_total{from_version,to_version}`.

#### 9.4.1 동시성 처리

re-encryption 중 동일 row를 동시에 read-back-write 시 lost-update 방지:
- `exchange_credential` / `notification_target` 테이블에 `kek_version INT` 컬럼 추가 (V002)
- re-encryption 흐름:
  1. row read (현재 kek_version=N 확인)
  2. 새 KEK로 wrap
  3. UPDATE `... WHERE id=? AND kek_version=N` (optimistic lock)
  4. row count = 0 → 다른 트랜잭션이 먼저 갱신 → silent skip (다음 read 시 재시도)
- 충돌은 백그라운드 잡이 자연 재처리하므로 운영 영향 0.

### 9.5 회전 정책

| 환경 | 주기 | 메커니즘 |
|---|---|---|
| 운영 (OCI) | 1년 (Phase 2 시작값) | OCI Vault 자동 회전 |
| 로컬 dev | 수동 | SOP 문서 (`quant/docs/key-rotation-sop.md`) |

Phase 3 진입 시 90일로 단축 검토(OQ-P2-001 default 채택).

---

## 10. audit_log 불변성

### 10.1 신규 ClickHouse DB — `quant_audit`

Phase 1 `quant` DB와 **완전 분리**. RBAC 격리 강제.

| User | 권한 |
|---|---|
| `quant_audit_writer` | INSERT ONLY (quant 서비스가 사용) |
| `quant_audit_reader` | SELECT ONLY (검증 job, 운영자) |

DB 레벨 UPDATE/DELETE 권한 자체를 부여하지 않음 → DBA 권한 우회 시도조차 별도 권한 escalation 필요.

### 10.2 스키마

```sql
CREATE TABLE quant_audit.audit_log (
    audit_id        UInt64,
    tenant_id       String,
    occurred_at     DateTime64(6, 'UTC'),
    actor           String,
    action          String,
    resource        String,
    outcome         String,
    payload_json    String,
    prev_hash       String,         -- SHA-256(prev_row_hash || current_payload)
    current_hash    String,         -- SHA-256(payload_json + occurred_at + ...)
    kek_version     String          -- payload 내 암호문 KEK 버전 추적
) ENGINE = MergeTree()
  ORDER BY (tenant_id, occurred_at, audit_id);
```

- ReplacingMergeTree 등 변경 가능 엔진 금지.

### 10.3 prev_hash 체인 (FR-P2-SEC-02)

- 각 레코드 insert 시 직전 레코드의 `current_hash`를 `prev_hash`로 기록.
- `current_hash = SHA256(prev_hash || payload_json || occurred_at || actor)`.
- nightly 검증 job(`AuditChainVerifier`)이 24시간 분량 chain replay → invalid 검출 시 CRITICAL 알림.
- 메트릭: `quant.audit.hash_chain.invalid_total`.

### 10.4 Kafka mirror 토픽

- `quant.audit.v1` 토픽으로 동기 발행(Outbox 경유).
- ClickHouse INSERT 가 primary write, Kafka mirror 는 best-effort (실패 허용). Phase 3+ 에서 ETL 일관성 강화 시 Kafka primary + ClickHouse 다운스트림으로 역전 가능.
- 외부 consumer는 별도 저장소(또는 Phase 3+ S3 Object Lock)에 사본 보관.

### 10.5 INV (Phase 2 추가 — test-quality.md §4)

- INV-P2-10: prev_hash 무결성 검증 — application 레벨로 INSERT 직전 직전 row hash 계산 + chain 검증 job(시간당 1회) 으로 tamper 탐지. ClickHouse MergeTree는 NOT NULL constraint만 보장 (UPDATE/DELETE 권한은 RBAC 차단).
- INV-P2-11: 모든 암호문은 `kek-v{N}` prefix 보유, 누락 시 read 거부.

---

## 11. Outbox Kafka relay 활성

### 11.1 Phase 1 → Phase 2 변경점

| 항목 | Phase 1 | Phase 2 |
|---|---|---|
| `OutboxRelay.publish()` | log only (payload deserialization 미구현) | 실 Kafka publish |
| payload deserialization | 미구현 | `EventPayloadCodec<T>` 등록 (event type별) |
| `published_at` 마킹 | 미사용 | 발행 성공 시 update |
| 실패 처리 | 단순 catch+log | retry + DLQ + 메트릭 |

### 11.2 처리 흐름

1. `OutboxKafkaRelay`가 `published_at IS NULL`인 row를 polling(1s 간격, ADR-0015 §5).
2. `EventPayloadCodec` registry에서 event type lookup → JSON deserialize → Kafka publish.
3. publish ack 수신 시 `published_at = NOW()` update.
4. publish 실패 시 `published_at` 미세팅 → 다음 polling에서 재시도.
5. 3회 실패 누적 row는 별도 컬럼(`failure_count`)으로 추적, 임계 초과 시 운영 알림.

### 11.3 컨슈머 측 멱등성 (ADR-0012)

- `processed_event(event_id PK, processed_at)` 테이블로 중복 처리 방어.
- 적용 컨슈머: Telegram worker, audit mirror consumer, FE SSE collector(향후).

---

## 12. API 추가

### 12.1 신규 엔드포인트

| 메서드 | 경로 | 설명 | 비고 |
|---|---|---|---|
| POST | `/api/v1/strategies/{id}/start-paper` | 페이퍼 모드로 활성화 (`ExecutionMode=PAPER`) | Phase 1 `/activate`와 분리, FR-P2-USE-01 |
| GET | `/api/v1/strategies/{id}/paper/status` | 활성 PAPER 실행 현황(slot 상태, 누적 PnL) | tenantId 필터 |
| GET | `/api/v1/strategies/{id}/paper/sse` | SSE stream — 실시간 tick + 가상 체결 + slot 변경 | FR-P2-FE-03 |
| POST | `/api/v1/strategies/{id}/paper/pause` | 일시정지 (시세 구독은 유지) | US-P2-05 |
| POST | `/api/v1/strategies/{id}/paper/resume` | 재개 | US-P2-05 |
| GET | `/api/v1/paper/snapshot/{strategyId}` | SSE 진입 전 초기 hydrate (slot + 최근 체결 50건) | FR-P2-FE-05 |

### 12.2 SSE 응답 포맷

```
event: tick
data: {"symbol":"BTC/KRW","price":"95430000","ts":"2026-04-26T12:34:56.789Z","source":"WS"}

event: slot
data: {"slotId":1,"state":"FILLED","entryPrice":"95000000","qty":"0.01"}

event: order
data: {"orderId":"paper-...","side":"BUY","executedPrice":"95047500","slippage":"0.0005"}
```

- `Content-Type: text/event-stream`. 기존 Phase 1 `ApiResponse<T>` 래퍼 적용 대상 아님(SSE는 별도 포맷).

**SSE 인증 방식 (확정)**: **first-message JWT** 패턴
- EventSource는 표준 헤더 인증 미지원 (쿼리 파라미터 fallback은 access log 노출 위험으로 거부)
- 클라이언트는 SSE 연결 후 첫 message 로 `{"type": "auth", "token": "<jwt>"}` 전송
- 서버는 JWT 검증 후 `auth-ok` 또는 `auth-fail` 응답
- 실패 시 즉시 SSE 연결 종료
- Gateway 는 SSE 헤더 인증 우회를 허용하되, quant application 이 first-message 인증 강제
- 30초 내 인증 미완료 시 자동 종료

---

## 13. Gateway 변경

### 13.1 SSE long-lived 라우팅 활성화

Spring Cloud Gateway가 SSE long-lived connection을 안정 라우팅하도록 다음 변경 필요:

- 라우트 timeout 설정: `httpClient.responseTimeout`을 SSE 라우트(`/api/v1/strategies/*/paper/sse`)에 한해 비활성 또는 1h 이상으로 override.
- Reactor Netty `keepAlive` 명시적 enable.
- `Cache-Control: no-cache`, `X-Accel-Buffering: no` 응답 헤더 통과 확인.
- HTTP/1.1 chunked 응답 buffering 차단(Gateway 기본은 통과 OK, 명시 검증).

### 13.2 본 사이클 Gateway 모듈 변경 PR 포함

- 변경 파일: `gateway/src/main/resources/application.yml`(라우트 정의), `gateway/src/main/kotlin/.../config/SseRouteConfig.kt`(필요 시).
- 회귀 테스트: 기존 short-lived REST 라우팅 영향 없음 검증.
- 폴백: 클라이언트가 SSE 끊김/미지원 시 `polling 2s` (`/api/v1/strategies/{id}/paper/status` 폴링).

---

## 14. FE 추가 (페이퍼 트레이딩 모니터링)

### 14.1 신규 페이지

- `quant/frontend/src/pages/PaperTradingMonitor.tsx` (또는 동등).
- 진입 경로: 전략 상세 페이지 → "PAPER 모니터링" 버튼.

### 14.2 화면 구성 (FR-P2-FE-02)

- 거래쌍별 패널:
  - 현재가 (큰 폰트, 변동 highlight)
  - 최근 체결 N건 타임라인
  - 호가 흐름 (best bid / ask)
  - 활성 회차 슬롯 상태 (EMPTY / PENDING_BUY / FILLED 색상)
- 가상 체결 타임라인 (회차별 색상 분기)
- 활성 전략 카드 (누적 PnL, 회차 회전률)

### 14.3 실시간 연결

- 초기 hydrate: REST `GET /api/v1/paper/snapshot/{strategyId}`.
- 이후 SSE delta: `EventSource('/api/v1/strategies/{id}/paper/sse')`.
- 재연결: EventSource 기본 정책 + 5s exponential backoff.
- 폴백: SSE 끊김 시 2s polling.

### 14.4 디자인 가드 (재사용)

- Phase 1 PWA 셸 / Tailwind / Pretendard / lightweight-charts 그대로 재사용.
- 모바일 우선 (Phase 1 §12 [결정 2026-04-24]). 터치 친화, 세로 레이아웃.
- `docs/conventions/frontend-design.md` 준수.

---

## 15. K8s overlay (Phase 2 변경)

### 15.1 k3s-lite (`k8s/overlays/k3s-lite/quant/`)

| 변경 | 비고 |
|---|---|
| Redis (이미 활성) | Phase 1 standalone 재사용, Rate Limiter / per-chat token bucket 키 추가만 |
| KEK 환경변수 | `QUANT_LOCAL_KEK` (Secret 또는 dev시 .env, gitignore) |
| Kafka Outbox relay enable | `quant.outbox.kafka-relay.enabled=true` |
| Kafka fanout (옵셔널) | `quant.market-data.kafka-fanout.enabled=false` (Phase 2 default) |
| Telegram 자격 | `NotificationTarget` DB 등록(런타임 입력) — Secret 직접 주입 X |

- Deployment `strategy.type=Recreate` 명시. Phase 2 = single replica 가정 보호 (rolling update 시 일시적 replicas=2 발생 차단)

### 15.2 prod-k8s (`k8s/overlays/prod-k8s/quant/`)

| 변경 | 비고 |
|---|---|
| OCI Vault SecretRef | `OCI_PRIVATE_KEY` (Secret), `OCI_VAULT_KEY_OCID` (ConfigMap) |
| ClickHouse `quant_audit` DB user Secret | writer / reader 분리 |
| HPA 유지 | Phase 1 동일(CPU 70% degrade), p95 HPA는 Prometheus Adapter 도입 후 |
| Ingress (gateway 경유) | SSE 라우트 활성화 (gateway 변경 PR 의존) |

- Deployment `strategy.type=Recreate` 명시. Phase 2 = single replica 가정 보호 (rolling update 시 일시적 replicas=2 발생 차단). Phase 3 multi-replica 전환 시 ADR-0025 §Consequences leader pod 선출 패턴 도입.

> Phase 2는 staging/dev 한정 운영을 권장 (NFR-P2-DEP-01). prod-k8s 정식화는 Phase 3 진입 시 함께 진행.

---

## 16. Open Questions & Risks

### 16.1 Open Questions 상태

| OQ | 상태 | 비고 |
|---|---|---|
| OQ-P2-001 KEK 보관 | DECIDED — OCI Vault + LocalFile (본 spec §9 확정) | `KeyManagementService` Port 추상화 |
| OQ-P2-002 audit 불변성 | DECIDED — 별도 ClickHouse DB + RBAC + prev_hash + Kafka mirror (본 spec §10 확정) | |
| OQ-P2-003 slippage | DECIDED — 고정 0.05%, configurable | |
| OQ-P2-004 Telegram Rate | DECIDED — per-chat 1 msg/s + 우선순위 큐 | |
| OQ-P2-005 SharedFlow buffer | DECIDED — 256 + DROP_OLDEST | |
| OQ-P2-006 Rate Limiter | DECIDED — Redis token bucket(Lua) | Bucket4j+Redis는 Phase 3 검토 |
| OQ-P2-007 SSE | DECIDED — SseEmitter + Gateway 변경 PR | 폴백: polling 2s |
| OQ-011 거래소 약관 | OPEN — `context/exchange-terms.md` 검토 진행 중 | Phase 3 진입 전 closed 필수 |

### 16.2 Phase 3 진입 게이트

- OQ-011 closed (사용자 검토 완료)
- OCI Vault 운영 환경 구축 완료 (또는 LocalFile→KMS 마이그레이션 SOP 통과)
- Phase 2 실 운용 N주 누적 (Phase 3 진입 전 정량 게이트 OQ-019에서 확정)
- audit chain 검증 job nightly 운영 1주 무사고
- DLQ 잔량 0% 유지 메트릭 확보

### 16.3 Risks (Phase 2 추가)

- **R-P2-01**: SSE long-lived 연결이 Gateway 모듈 변경 미반영 시 끊김 빈발 → 본 사이클 PR 포함 강제, 미반영 시 임시 ClusterIP 직접 노출(Phase 3 정식화).
- **R-P2-02**: OCI Vault Always Free Tier rate limit / 가용성 → fallback으로 LocalFile 어댑터 hot-swap 가능 구조 유지(Port 추상화).
- **R-P2-03**: MarketDataHub DROP_OLDEST로 인한 trigger 평가 누락 → 메트릭 `dropped_total` 임계 알림 + Phase 3 buffer 사이즈 재튜닝.
- **R-P2-04**: Outbox relay 활성화 후 publish 실패 누적으로 outbox row 폭증 → `failure_count` 임계 알림 + 운영 수동 처리 경로.
- **R-P2-05**: 빗썸 JWT 정정 사항이 Phase 1 코드(REST adapter / 히스토리 ingest)에 일부 잔존 시 인증 실패 → Phase 2 사이클 시작 시 일괄 grep + 수정.

---

## 17. ADR 후보

Plan 단계에서 Phase 2 사이클 동안 다음 ADR을 발행한다:

| ADR | 제목 | 근거 OQ |
|---|---|---|
| ADR-0024 Errata | 빗썸 JWT 인증 정정 (HMAC-SHA512 → JWT/HS256) + AbstractJwtBasedExchangeAdapter 패턴 | 본 spec §3 |
| ADR-0025 (가칭) | Quant MarketDataHub (SharedFlow primary + Kafka fan-out) | OQ-007, §4 |
| ADR-0026 (가칭) | Quant Audit Log Immutability (별도 ClickHouse DB + RBAC + prev_hash + Kafka mirror) | OQ-P2-002, §10 |
| ADR-0027 (가칭) | Quant KEK 보관 — OCI Vault Envelope Encryption + Port 추상화 | OQ-P2-001, §9 |

> ADR-0024 Errata는 (a) ADR-0024 본문에 Errata 섹션 append 또는 (b) 별도 ADR로 분리 발행 — Plan 단계에서 형식 확정.

---

## 18. Existing Code to Leverage

| 영역 | 참조 위치 | 재사용 포인트 |
|---|---|---|
| Phase 1 도메인/엔진 | `quant/domain/`, `quant/app/application/backtest/` | `TrancheStrategy`, `TrancheSlot`, `StrategyExecutor`, `StrategyEngineLoop` 그대로 |
| Phase 1 Outbox | `quant/app/infrastructure/outbox/OutboxRelay.kt` | log-only → 실 publish 활성화 (§11) |
| Phase 1 Bithumb REST | `quant/app/infrastructure/bithumb/` | WS subscriber 구현 시 인증/에러 매핑 패턴 재활용 (단, 인증은 §3 정정 적용) |
| Phase 1 Credential 암호화 | `ExchangeCredential` / `NotificationTarget` AES-GCM 필드 | KEK 회전 + lazy re-encryption hook 추가 지점 (§9) |
| Phase 1 audit_log | Flyway V001 audit_log 테이블 | Phase 2 V002에서 prev_hash + 별도 ClickHouse DB 마이그레이션 (§10) |
| Phase 1 metrics | `infrastructure/metrics/QuantMetrics.kt` | Phase 2 신규 메트릭 추가 |
| Phase 1 FE | `quant/frontend/` | PWA 셸 / Tailwind / lightweight-charts 재사용 (§14) |
| Resilience4j | ADR-0015 + `order/app` 패턴 | CircuitBreaker / Rate Limiter 적용 (§8) |
| Kafka 컨벤션 | `docs/architecture/kafka-convention.md` | Phase 2 첫 실 발행 토픽 (`quant.*.v1`, DLQ `.DLT`) |
| 멱등 컨슈머 | ADR-0012 + Phase 1 `processed_event` | Telegram worker, audit mirror consumer (§11.3) |

---

## 19. Out of Scope (Phase 2 명시 제외)

- 빗썸/업비트 실 매매 주문 발송 (Phase 3)
- 업비트 어댑터 신설 (Phase 3 — `AbstractJwtBasedExchangeAdapter` 재사용)
- 글로벌 kill-switch / 손실 한도 / 페이퍼→실매매 정량 승격 게이트 (Phase 3, OQ-012/019)
- NetworkPolicy / mTLS / 실매매 2FA (Phase 3, OQ-013/015/016)
- 분할 원칙 1·3·4 포트폴리오 차원 (Phase 1 §15.1 유지)
- WORM 스토리지 (S3 Object Lock) — Phase 3+ 외부 오픈 시점
- volume-weighted / 정규분포 slippage — Phase 3 실 체결 데이터 calibration 후
- WebSocket 양방향 FE 연결 — Phase 2는 SSE만
- 공개 리더보드

---

## 20. Library Additions (Phase 2)

| Library | 용도 | libs.versions.toml 신규? |
|---|---|---|
| `resilience4j-circuitbreaker` | CircuitBreaker (REST/WS/Telegram) | `order/app` 리터럴 → 카탈로그 승격 |
| `resilience4j-kotlin` | Coroutine 통합 | 카탈로그 승격 |
| `reactor-netty` `WebSocketClient` | 빗썸 WS 구독 | Phase 1 transitive (신규 X) |
| `lettuce` Redis client (Lua eval) | Token bucket | Phase 1에서 이미 도입 |
| OCI SDK (`oci-java-sdk-keymanagement`) | OCI Vault REST | Yes |
| `nimbus-jose-jwt` | JWT HS256 서명 (AbstractJwtBasedExchangeAdapter) | Yes (또는 jjwt 등 비교 후 결정) |
