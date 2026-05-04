# Quant Phase 3 Spec — Live Trading

> 본 문서: 실매매 도메인의 기술 스펙. 컨텍스트와 OQ는 [initialization.md](initialization.md) 참조.
> 목표: 사용자가 quant 플랫폼에서 **실제 자본**으로 자동매매 실행, 사고 시 ≤ 200ms 내 차단.

## 1. 도메인 모델 추가

### 1.1 LiveTradingMode (sealed)

```kotlin
sealed interface LiveTradingMode {
    object Disabled : LiveTradingMode
    data class Enabled(
        val activatedAt: Instant,
        val activatedBy: UserId,
        val twoFaTokenHash: String,    // 2FA 검증 흔적 (replay 방지)
    ) : LiveTradingMode
    data class Suspended(
        val reason: SuspendReason,
        val suspendedAt: Instant,
    ) : LiveTradingMode
}

enum class SuspendReason {
    USER_KILL_SWITCH,
    GLOBAL_KILL_SWITCH,
    DAILY_LOSS_LIMIT,
    DAILY_VOLUME_LIMIT,
    RECONCILE_DRIFT,
    EXCHANGE_REJECTION_BURST,
}
```

### 1.2 RiskLimit (per-tenant)

```kotlin
data class RiskLimit(
    val tenantId: TenantId,
    val dailyLossLimitKrw: BigDecimal,        // default: 100,000
    val dailyVolumeLimitKrw: BigDecimal,      // default: 1,000,000
    val singleOrderMaxKrw: BigDecimal,        // default: 100,000
    val updatedAt: Instant,
    val updatedBy: UserId,
)
```

매일 KST 00:00 기준 reset (배치).

### 1.3 KillSwitch (3 단계)

| 레벨 | 키 | 영향 범위 | 토글 권한 |
|---|---|---|---|
| Global | `quant:kill-switch:global` | 전체 사용자 모든 strategy | Admin (Phase 4+ 에서 2인 승인) |
| Tenant | `quant:kill-switch:tenant:{tenantId}` | 해당 tenant 모든 strategy | 사용자 본인 |
| Strategy | `quant:kill-switch:strategy:{strategyId}` | 단일 strategy | 사용자 본인 |

저장:
- **Redis** (저지연 read, ≤200ms reflect 보장)
- **MySQL** `kill_switch_log` (append-only 감사)

### 1.4 OrderRecord (실주문)

Phase 2 의 페이퍼 OrderRecord 확장:

```kotlin
data class OrderRecord(
    val id: OrderId,
    val tenantId: TenantId,
    val strategyId: StrategyId,
    val market: Market,
    val asset: Asset,
    val side: OrderSide,
    val type: SpotOrderType,            // ADR-0024: limit/market only, 레버리지 금지
    val priceKrw: BigDecimal?,
    val quantity: BigDecimal,
    val status: OrderStatus,
    val exchangeOrderId: String?,       // 거래소가 부여한 ID
    val placedAt: Instant,
    val filledAt: Instant?,
    val cancelledAt: Instant?,
    val tradeMode: TradeMode,           // PAPER | LIVE
    val auditHashPrev: String?,         // chain
    val auditHashCurrent: String,       // SHA-256(prev || serialized)
)
```

### 1.5 AuditEvent (chain)

```kotlin
data class AuditEvent(
    val id: AuditId,
    val tenantId: TenantId,
    val eventType: AuditEventType,      // ORDER_PLACED, ORDER_FILLED, KILL_SWITCH_TOGGLE,
                                         // RISK_LIMIT_CHANGE, LIVE_MODE_TOGGLE, RECONCILE_DRIFT
    val payloadJson: String,             // canonical JSON
    val occurredAt: Instant,
    val prevHash: String?,
    val currentHash: String,             // SHA-256(prev || canonical(payload) || occurredAt)
)
```

체인 검증 job:
- 매일 KST 03:00
- per-tenant 마지막 100,000 이벤트 검증, mismatch 발견 시 즉시 글로벌 alarm + 해당 tenant suspend

## 2. 거래소 어댑터

### 2.1 LiveExchangeAdapter 인터페이스

```kotlin
interface LiveExchangeAdapter : MarketAdapter {  // Phase 2 MarketAdapter 확장
    suspend fun placeOrder(
        credential: DecryptedCredential,
        order: OrderPlacement,
    ): OrderAck

    suspend fun cancelOrder(
        credential: DecryptedCredential,
        exchangeOrderId: String,
        symbol: String,
    ): CancelAck

    suspend fun fetchOrderStatus(
        credential: DecryptedCredential,
        exchangeOrderId: String,
        symbol: String,
    ): OrderStatusSnapshot

    suspend fun fetchAccountBalance(
        credential: DecryptedCredential,
    ): AccountBalance
}
```

### 2.2 거래소별 구현

| 거래소 | 서명 | RPS 한도 | 비고 |
|---|---|---|---|
| 빗썸 | JWT(HS256, secret=API_SECRET) | 135 req/sec (public+private) | ADR-0024 Errata |
| 업비트 | JWT(RS256, query string hash) | 8 req/sec (order) | nonce 필수 |
| Bybit | HMAC-SHA256(query+body, secret) + X-BAPI-* 헤더 | 10 req/sec (private) | recv_window=5000 |
| OKX | HMAC-SHA256(timestamp+method+path+body, secret) + OK-ACCESS-* + Passphrase | 6 req/2s | passphrase 추가 키 |

모든 어댑터:
- `@ConditionalOnProperty` 게이팅 (`quant.exchange.{name}.enabled`)
- Resilience4j RateLimiter
- request/response 로그 시 API key/signature 마스킹
- `@RetryableException` 으로 5xx / 일시 네트워크 오류 재시도

## 3. 주문 라이프사이클

```
[USER]              [QUANT]                       [EXCHANGE]
                    StrategyExecutor.tick()
                    └ check live-mode (Enabled?)
                    └ check kill-switch (3 levels)
                    └ check risk-limit (daily loss/volume)
                    └ check single-order-max
                    ↓
                    LiveExchangeAdapter.placeOrder()
                                                  ──→ POST /order
                                                  ←── 200 OK { exchangeOrderId }
                    ↓
                    AuditEvent.append(ORDER_PLACED, hashChain)
                    OrderRecord.save(status=PENDING)
                    ↓
                    [5min cron] ReconcileJob.run()
                    └ fetchOrderStatus per pending order
                                                  ──→ GET /order/{id}
                                                  ←── 200 { status: FILLED }
                    └ if mismatch → AuditEvent + alarm
                    └ OrderRecord.update(status=FILLED, filledAt)
                    └ AuditEvent.append(ORDER_FILLED)
```

### 3.1 게이트 순서 (모든 실주문 placeOrder 전)

```
1. live-mode == Enabled
2. global-kill-switch == OFF
3. tenant-kill-switch == OFF
4. strategy-kill-switch == OFF
5. dailyLossKrw + estimatedLoss <= dailyLossLimitKrw
6. dailyVolumeKrw + orderVolumeKrw <= dailyVolumeLimitKrw
7. orderVolumeKrw <= singleOrderMaxKrw
```

하나라도 실패 시: 주문 거부 + AuditEvent(ORDER_REJECTED) + 사용자 알림 (Telegram/email).

## 4. 2FA

### 4.1 등록

- 사용자가 quant FE 에서 "live-trading 활성화" 버튼 클릭
- 서버: TOTP secret 32 bytes 생성 → AES-256-GCM 으로 암호화 (KEK = OCI Vault)
- FE: QR 코드 (otpauth://...) 표시
- 사용자: Google Authenticator 등에 등록 후 6자리 코드 입력 → 서버 검증

### 4.2 검증 (live-mode 활성화 / 한도 변경 / kill-switch 해제)

- 사용자가 6자리 TOTP 입력
- 서버: 현재 시각 ±1 step (30s) 까지 허용
- 검증 성공 → AuditEvent(2FA_VERIFIED) + 토큰 hash 저장 (5분 유효, replay 방지)
- 5분 안에 해당 작업 완료해야 함

### 4.3 백업 코드

- 등록 시 8개의 1회용 백업 코드 (10자리 random) 발급
- 사용자가 다운로드/인쇄
- TOTP 분실 시 백업 코드로 1회 인증 → 재등록

## 5. Kill-Switch 운영

### 5.1 사용자 셀프

```
PUT /api/v1/kill-switch/tenant
PUT /api/v1/kill-switch/strategy/{strategyId}
```

- Body: `{ enabled: true, reason: "string" }`
- 인증: JWT (사용자) + 2FA 검증 토큰
- 효과: Redis SET (TTL 없음, 명시 OFF 까지 유지) + MySQL append + AuditEvent

### 5.2 글로벌 (Admin)

```
PUT /api/v1/admin/kill-switch/global
```

- 인증: Admin role JWT + 2FA
- Phase 4 에서 2인 승인 (현재는 Admin 1인 가능)
- 효과: Redis SET + 모든 활성 strategy 의 다음 tick 부터 차단

### 5.3 자동 trigger

```kotlin
// 평가 위치: StrategyExecutor.tick()
fun checkAndAutoSuspend(tenantId: TenantId): Boolean {
    val today = todayMetrics(tenantId)
    if (today.lossKrw >= riskLimit.dailyLossLimitKrw) {
        killSwitch.toggleTenant(tenantId, on = true, reason = SuspendReason.DAILY_LOSS_LIMIT)
        return true
    }
    if (today.volumeKrw >= riskLimit.dailyVolumeLimitKrw) {
        killSwitch.toggleTenant(tenantId, on = true, reason = SuspendReason.DAILY_VOLUME_LIMIT)
        return true
    }
    return false
}
```

자동 trigger 발생 시 사용자에게 즉시 알림 (Telegram). 다음날 KST 00:00 reset 후 자동 해제 — 단, 사용자가 명시 해제 (2FA) 까지 OFF 유지가 default.

## 6. Reconciliation

### 6.1 ReconcileJob

```kotlin
@Component
class ReconcileJob(...) {
    @Scheduled(cron = "0 */5 * * * *")  // 5분마다
    fun run() = runBlocking {
        val pendingOrders = orderRepo.findByStatusAndTradeMode(
            status = OrderStatus.PENDING,
            tradeMode = TradeMode.LIVE,
            olderThan = Duration.ofSeconds(30),
        )
        pendingOrders.forEach { order ->
            val snapshot = liveAdapter[order.market]
                .fetchOrderStatus(credential, order.exchangeOrderId!!, symbol)
            if (snapshot.status != order.status) {
                auditEvents.append(RECONCILE_DRIFT, order, snapshot)
                if (snapshot.isFinal) {
                    orderRepo.update(order.id, snapshot.status)
                } else {
                    alarmService.warn("Order drift: $order vs $snapshot")
                }
            }
        }
    }
}
```

### 6.2 Drift 정책

- `PENDING` → `FILLED` / `CANCELLED` / `REJECTED`: 자동 반영 + AuditEvent
- `PENDING` → 거래소가 모름 (404): 6시간 이상 unknown 이면 `LOST` 상태 + 글로벌 alarm
- 정합 mismatch (수량/가격 차이): 즉시 tenant kill-switch + 운영자 페이지

## 7. API 엔드포인트

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/v1/2fa/register` | JWT | 2FA seed 발급 |
| POST | `/api/v1/2fa/verify` | JWT | TOTP 검증 → 토큰 hash 발급 (5분 유효) |
| PUT | `/api/v1/live-mode` | JWT + 2FA | live-trading 활성/비활성 |
| GET | `/api/v1/risk-limit` | JWT | 현재 한도 조회 |
| PUT | `/api/v1/risk-limit` | JWT + 2FA | 한도 변경 |
| PUT | `/api/v1/kill-switch/tenant` | JWT + 2FA(해제 시) | tenant kill-switch |
| PUT | `/api/v1/kill-switch/strategy/{id}` | JWT + 2FA(해제 시) | strategy kill-switch |
| PUT | `/api/v1/admin/kill-switch/global` | Admin JWT + 2FA | global kill-switch |
| GET | `/api/v1/orders` | JWT | 주문 이력 (페이징) |
| POST | `/api/v1/orders/{id}/cancel` | JWT | 사용자 수동 취소 |
| GET | `/api/v1/audit-log` | JWT | 본인 audit chain 조회 |

## 8. 데이터베이스

### 8.1 신규 MySQL 테이블

```sql
CREATE TABLE live_trading_state (
    tenant_id        BINARY(16) PRIMARY KEY,
    mode             VARCHAR(16) NOT NULL,    -- DISABLED/ENABLED/SUSPENDED
    activated_at     DATETIME(6),
    activated_by     BIGINT,
    suspend_reason   VARCHAR(32),
    suspended_at     DATETIME(6),
    updated_at       DATETIME(6) NOT NULL
);

CREATE TABLE risk_limit (
    tenant_id              BINARY(16) PRIMARY KEY,
    daily_loss_limit_krw   DECIMAL(20,2) NOT NULL,
    daily_volume_limit_krw DECIMAL(20,2) NOT NULL,
    single_order_max_krw   DECIMAL(20,2) NOT NULL,
    updated_at             DATETIME(6) NOT NULL,
    updated_by             BIGINT NOT NULL
);

CREATE TABLE kill_switch_log (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    scope        VARCHAR(16) NOT NULL,    -- GLOBAL/TENANT/STRATEGY
    target_id    BINARY(16),              -- tenantId or strategyId
    enabled      BOOLEAN NOT NULL,
    reason       VARCHAR(255),
    actor_id     BIGINT NOT NULL,
    occurred_at  DATETIME(6) NOT NULL,
    INDEX idx_scope_target (scope, target_id),
    INDEX idx_occurred_at (occurred_at)
);

CREATE TABLE two_fa_secret (
    user_id           BIGINT PRIMARY KEY,
    encrypted_secret  VARBINARY(255) NOT NULL,
    encrypted_dek     VARBINARY(255) NOT NULL,
    backup_codes_hash JSON NOT NULL,
    registered_at     DATETIME(6) NOT NULL,
    last_verified_at  DATETIME(6)
);

CREATE TABLE audit_event (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id     BINARY(16) NOT NULL,
    event_type    VARCHAR(32) NOT NULL,
    payload_json  LONGTEXT NOT NULL,
    occurred_at   DATETIME(6) NOT NULL,
    prev_hash     CHAR(64),                -- SHA-256 hex
    current_hash  CHAR(64) NOT NULL,
    INDEX idx_tenant_time (tenant_id, occurred_at),
    UNIQUE KEY uq_current_hash (current_hash)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

CREATE TABLE order_record (
    id              BINARY(16) PRIMARY KEY,
    tenant_id       BINARY(16) NOT NULL,
    strategy_id     BINARY(16) NOT NULL,
    market_code     VARCHAR(16) NOT NULL,
    asset_code      VARCHAR(32) NOT NULL,
    side            VARCHAR(8) NOT NULL,
    type            VARCHAR(16) NOT NULL,
    price_krw       DECIMAL(28,8),
    quantity        DECIMAL(28,8) NOT NULL,
    status          VARCHAR(16) NOT NULL,
    exchange_order_id VARCHAR(128),
    placed_at       DATETIME(6) NOT NULL,
    filled_at       DATETIME(6),
    cancelled_at    DATETIME(6),
    trade_mode      VARCHAR(8) NOT NULL,    -- PAPER/LIVE
    audit_hash_prev    CHAR(64),
    audit_hash_current CHAR(64) NOT NULL,
    INDEX idx_tenant_strategy_status (tenant_id, strategy_id, status),
    INDEX idx_status_placed_at (status, placed_at)
);
```

### 8.2 Redis 키 스키마

| 키 | 값 | TTL | 용도 |
|---|---|---|---|
| `quant:kill-switch:global` | `1`/`0` | none | global flag |
| `quant:kill-switch:tenant:{id}` | `1`/`0` | none | tenant flag |
| `quant:kill-switch:strategy:{id}` | `1`/`0` | none | strategy flag |
| `quant:risk-metrics:{tenantId}:{yyyy-mm-dd}` | hash {loss, volume, count} | 25h | 일일 누적 |
| `quant:2fa:token:{userId}:{tokenHash}` | `1` | 5분 | 2FA 검증 토큰 (one-time) |
| `quant:2fa:rate-limit:{userId}` | counter | 1분 | 2FA brute force 방어 (5회/분) |

## 9. 보안

- API key / signature: 모든 로그 / outbox / audit_log 에 마스킹
- TLS: gateway → quant 만 cleartext (내부) — 외부 → gateway 는 mTLS Phase 4
- IP 화이트리스트 (선택): `risk_limit` 에 allowed_ip_cidr 컬럼 추가, 활성 시 해당 IP에서만 live-mode 토글
- Audit 보존: 7년, S3/GCS 영구 archive (Phase 2 backup 와 별도)

## 10. Observability

신규 메트릭:

- `quant_live_orders_total{exchange, status}` — 거래소별 주문 카운터
- `quant_live_order_latency_seconds{exchange}` — 주문 round-trip
- `quant_kill_switch_state{scope, target}` — 1 (ON) / 0 (OFF)
- `quant_risk_limit_breach_total{tenant, type}` — 한도 초과 카운터
- `quant_reconcile_drift_total{exchange, drift_type}`
- `quant_audit_chain_verify_total{result}` — daily verify pass/fail
- `quant_2fa_verify_total{result}` — success/failure

알람:
- `quant_audit_chain_verify_total{result="fail"} > 0` → P1
- `quant_kill_switch_state{scope="global"} == 1` → P1 (운영자에게)
- `quant_reconcile_drift_total > 0` 5분간 → P2

## 11. Testing

- Domain: 모든 Risk Limit / Kill-Switch / TOTP 검증 로직은 BehaviorSpec + property-based
- Adapter: WireMock 으로 거래소 응답 stub (4개 거래소 × 5 시나리오 = 20)
- Integration: paper-mode 에서 live-mode 와 동일 로직 흐름 (TestContainers + Redis + MySQL)
- Chaos: kill-switch 토글 후 ≤200ms 차단 검증 (in-memory 평가)
- Audit chain: 의도적 변조 후 verify job 이 detect 하는지

## 12. 배포 순서

1. ADR-0037 승인 (OQ-011 ~ OQ-020 closure 후)
2. 도메인 모델 + 마이그레이션
3. 4개 거래소 어댑터 (paper 모드부터 — Phase 2 동일 단계)
4. Kill-Switch + Risk Limit + 2FA
5. Reconcile + Audit chain
6. **Beta 단계** — Admin 본인 1계정만 live-mode 활성, 1주간 monitoring
7. **Closed Beta** — 신청한 사용자 5명, 일일 한도 100,000 KRW 강제
8. **GA** — 전체 사용자 open, 한도 default 적용
