<!-- source: quant -->
---
spec: quant-unified-platform
date: 2026-05-04
status: draft
parent: requirements.md
phase: Phase 1
---

# Spec — Quant 통합 플랫폼 (Phase 1)

## 0. 적용 범위

본 spec 은 **Phase 1** 의 기술 사양을 다룬다. Phase 2/3 은 별도 spec 으로 분리.

| Phase | 범위 |
|---|---|
| **Phase 1 (이 spec)** | 단일 서비스(quant) 흡수 + sealed `Strategy` 신규 + 빗썸 single-source 시그널 strategy + 차트 분석 메뉴(주식·암호화폐 OHLCV + 패턴 유사도 + 기술적 지표) + 입문자 학습 메뉴(CMS) + Python ingest 사이드카 + 환율 proxy |
| Phase 2 | 해외 거래소 (Binance) + 김치프리미엄 + cross-exchange 시그널 + 융합 strategy |
| Phase 3 | 실매매 / kill-switch / 2FA / 어드민 미디어 업로드 |

---

## 1. 아키텍처

### 1.1 서비스 구조

```
┌─────────────────────────────────────────────────────────────────┐
│ quant-fe (React SPA, ingress /quant/)                           │
│  ├─ /quant/strategies  자동매매                                  │
│  ├─ /quant/charts      차트 분석                                 │
│  └─ /quant/learn       입문자 지표 학습                          │
└─────────────────────────────────────────────────────────────────┘
                          │ /api/v1/*
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ quant (Kotlin/Spring Boot, port 8094)                           │
│  ├─ application/                                                 │
│  │   ├─ strategy/      Strategy sealed (Tranche / Signal / ...) │
│  │   ├─ chart/         OHLCV 조회, 패턴 유사도, 기술 지표 계산  │
│  │   └─ indicator/     Learn CMS                                │
│  └─ infrastructure/                                              │
│      ├─ exchange/      MarketAdapter (빗썸)                     │
│      ├─ persistence/   MySQL (strategy/run/cms) +              │
│      │                 ClickHouse (OHLCV) + pgvector (embedding)│
│      └─ ingest/        (없음 — Python sidecar 가 담당)          │
└─────────────────────────────────────────────────────────────────┘
                          ▲ ClickHouse insert (one-way)
                          │
┌─────────────────────────────────────────────────────────────────┐
│ quant-ingest (Python sidecar, batch)                            │
│  ├─ stocks/   yfinance, FinanceDataReader → ClickHouse          │
│  └─ crypto/   (Phase 2 — Binance)                               │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 모듈 구조 (Gradle)

| Gradle path | 역할 |
|---|---|
| `:quant:domain` | 순수 도메인 (Strategy sealed / Asset / Market / Tranche / Signal) |
| `:quant:app` | Spring Boot 앱 (port 8094) |
| `:quant:ingest` (신규) | Python sidecar 코드 (별도 lifecycle, gradle 외부) |

> `:quant:ingest` 는 Gradle module 이 아닌 `quant/ingest/` 경로의 독립 Python 프로젝트.
> Dockerfile / pyproject 별도. K8s CronJob 으로 배포.

### 1.3 ingress 라우팅

```yaml
- path: /quant/?(.*)        → quant-fe
- path: /api/v1/strategies/**, /api/v1/charts/**, /api/v1/indicators/**, /api/v1/learn/** → gateway → quant-service
```

기존 `/charting/(.*)` ingress 라우트는 Phase 1 마이그레이션 종료 후 제거.

---

## 2. 도메인 모델

### 2.1 Asset / Market 추상화

```kotlin
// domain/asset/
@JvmInline value class AssetCode(val value: String)   // "BTC", "AAPL", "005930"

enum class AssetClass { CRYPTO, STOCK_KR, STOCK_US }

data class Asset(
    val code: AssetCode,
    val class: AssetClass,
    val displayName: String,
)

// domain/market/
@JvmInline value class MarketCode(val value: String)  // "BITHUMB", "YAHOO", "FDR_KR"

data class Market(
    val code: MarketCode,
    val supportedClasses: Set<AssetClass>,
)
```

### 2.2 Strategy sealed (신규)

```kotlin
// domain/strategy/Strategy.kt
sealed interface Strategy {
    val id: StrategyId
    val tenantId: TenantId
    val asset: Asset
    val market: Market
    val createdAt: Instant
}

// 기존 (재배치)
data class TrancheStrategy(...): Strategy

// 신규 (Phase 1)
data class SignalStrategy(
    override val id: StrategyId,
    override val tenantId: TenantId,
    override val asset: Asset,
    override val market: Market,
    val signal: SignalConfig,         // 진입 시그널
    val exitSignal: SignalConfig?,    // 청산 시그널 (옵션)
    val sizing: PositionSizing,
    override val createdAt: Instant,
): Strategy

// 신규 (Phase 3)
data class HybridStrategy(...): Strategy   // 인터페이스만 Phase 1 에 선언
```

### 2.3 SignalConfig sealed (Phase 1)

```kotlin
sealed interface SignalConfig {
    fun describe(): String
}

data class VolumeSpike(
    val multiplier: BigDecimal,        // 직전 N봉 평균의 X배
    val window: Int,                   // 비교 윈도우 (분/봉 수)
): SignalConfig

data class RsiBreakout(
    val period: Int,                   // RSI 계산 기간 (기본 14)
    val threshold: BigDecimal,         // 진입 임계 (예: 30 / 70)
    val direction: Direction,          // OVERSOLD / OVERBOUGHT
): SignalConfig

data class MaCross(
    val fastPeriod: Int,
    val slowPeriod: Int,
    val direction: CrossDirection,     // GOLDEN / DEAD
): SignalConfig

data class BollingerSqueeze(
    val period: Int,
    val stdDev: BigDecimal,
    val squeezeThreshold: BigDecimal,
): SignalConfig
```

### 2.4 PositionSizing

```kotlin
sealed interface PositionSizing {
    data class FixedKrw(val amountKrw: BigDecimal): PositionSizing
    data class PercentBalance(val percent: BigDecimal): PositionSizing
    data class FixedQuantity(val quantity: BigDecimal): PositionSizing
}
```

### 2.5 IndicatorContent (CMS)

```kotlin
// domain/learn/
data class IndicatorContent(
    val id: ContentId,
    val slug: Slug,                    // "rsi", "macd", ...
    val title: String,
    val category: IndicatorCategory,   // TREND / MOMENTUM / VOLATILITY / VOLUME
    val summary: String,               // 1줄 요약
    val bodyMarkdown: String,          // 본문 (markdown)
    val formulaTeX: String?,           // KaTeX 수식
    val examples: List<IndicatorExample>,
    val createdAt: Instant,
    val updatedAt: Instant,
    val publishedAt: Instant?,         // null = draft
)

data class IndicatorExample(
    val label: String,
    val assetCode: AssetCode,
    val periodStart: LocalDate,
    val periodEnd: LocalDate,
    val description: String,
)
```

---

## 3. 데이터 모델

### 3.1 MySQL (도메인 + CMS)

| 테이블 | 컬럼 | 비고 |
|---|---|---|
| `strategy` | id, tenant_id, type(TRANCHE/SIGNAL/HYBRID), asset_code, asset_class, market_code, config_json, created_at | 단일 테이블 + type 컬럼 + JSON config |
| `signal_strategy_run` | id, strategy_id, tenant_id, period_start, period_end, status, summary_json | Phase 1 — 백테스트 결과 메타 |
| `indicator_content` | id, slug(unique), title, category, summary, body_md, formula_tex, examples_json, created_at, updated_at, published_at | CMS |
| `indicator_revision` | id, content_id, body_md, editor_id, created_at | 변경 이력 (간단) |

### 3.2 ClickHouse (시계열)

| 테이블 | 컬럼 | 비고 |
|---|---|---|
| `quant.ohlcv` | asset_code, asset_class, market_code, ts, open, high, low, close, volume, interval | 자산 무관 단일 테이블, partition by toYYYYMM(ts) |
| `quant.signal_eval` | run_id, ts, signal_type, value, triggered | 백테스트 시그널 평가 이력 |
| `quant.fx_proxy_tick` | ts, base, quote, price | USDT/KRW 등 환율 proxy 시세 |

### 3.3 pgvector (임베딩 — 기존)

`pattern_embedding(asset_code, market_code, ts_window_end, embedding vector(32))` — 기존 charting 테이블 그대로, schema rename `quant_pattern`.

---

## 4. API (REST, /api/v1/**)

### 4.1 Strategy
- `GET /api/v1/strategies` — 목록 (tenant)
- `POST /api/v1/strategies` — 생성. body: `{type, asset, market, config}` (config 는 type 별 polymorphic JSON)
- `GET /api/v1/strategies/{id}`
- `DELETE /api/v1/strategies/{id}`
- `POST /api/v1/strategies/{id}/backtests` — 백테스트 실행

### 4.2 Chart Analysis
- `GET /api/v1/charts/ohlcv?asset={code}&market={code}&interval=1d&from=&to=` — OHLCV
- `GET /api/v1/charts/indicators?asset={code}&market={code}&type=rsi&period=14&from=&to=` — 지표 시계열 (서버 계산, ta4j)
- `POST /api/v1/charts/similarity` — 패턴 유사도 검색 (기존 charting API 흡수)
- `GET /api/v1/charts/prediction?asset={code}&market={code}` — 미래 수익률 예측

### 4.3 Learn (CMS)
- `GET /api/v1/learn/indicators` — published 콘텐츠 목록
- `GET /api/v1/learn/indicators/{slug}` — 본문 + 수식 + 예제
- `POST /api/v1/learn/indicators` (ROLE_ADMIN) — 생성
- `PUT /api/v1/learn/indicators/{id}` (ROLE_ADMIN) — 수정
- `DELETE /api/v1/learn/indicators/{id}` (ROLE_ADMIN)

### 4.4 Internal
- `GET /api/v1/markets` — 지원 거래소/시장 목록
- `GET /api/v1/assets/search?q=` — 자산 검색 (자동완성)
- `GET /api/v1/fx/krw-usd` — Phase 1 환율 proxy (USDT/KRW), `FxRateProvider` port 통해

---

## 5. ingest sidecar 스펙

### 5.1 구조 (`quant/ingest/`)

```
quant/ingest/
├── pyproject.toml
├── Dockerfile
├── src/
│   ├── main.py             CLI entry (--source yfinance|fdr --asset XXX --interval 1d)
│   ├── sources/
│   │   ├── yfinance_src.py
│   │   └── fdr_src.py
│   ├── sinks/
│   │   └── clickhouse_sink.py
│   └── scheduler.py        K8s CronJob 진입점
└── tests/
```

### 5.2 K8s CronJob

```yaml
# k8s/base/quant-ingest/cronjob.yaml
schedule: "0 */1 * * *"   # 매시간
image: commerce/quant-ingest:latest
command: ["python", "-m", "src.scheduler", "--mode=incremental"]
```

### 5.3 ingest contract

- ClickHouse `quant.ohlcv` 에 INSERT만 (메인 서비스는 read only)
- 멱등 — `(asset_code, market_code, ts, interval)` UNIQUE
- 실패 시 Prometheus 메트릭 + Sentry/log

---

## 6. 환율 proxy (Phase 1)

### 6.1 인터페이스

```kotlin
interface FxRateProvider {
    suspend fun krwPerUsd(at: Instant = Instant.now()): BigDecimal
}
```

### 6.2 Phase 1 구현 — `BithumbUsdtKrwProxy`

빗썸 ticker `USDT_KRW` 시세를 1분 캐시 + 호출. 이미 빗썸 어댑터 있어 즉시 가능.

### 6.3 Phase 2 옵션

- `BankOfKoreaEcosProvider` — 공식, 일별 갱신
- `OpenExchangeRatesProvider` — 분 단위, 유료 검토

`FxRateProvider` port 분리되어 있어 추후 swap.

---

## 7. FE 구조

### 7.1 라우팅 (React Router, basename `/quant/`)

```
/                      홈 (대시보드)
/strategies            전략 목록
/strategies/new        전략 생성 (type 선택: TRANCHE / SIGNAL)
/strategies/:id        전략 상세
/charts                자산 검색 + 차트
/charts/:assetCode     자산별 차트 (OHLCV + 지표 토글 + 패턴 유사도 패널)
/learn                 학습 카탈로그
/learn/:slug           지표 상세
/admin/learn           (ROLE_ADMIN) CMS 관리
```

### 7.2 핵심 컴포넌트 (재사용)

- `OhlcvChart` (lightweight-charts) — 기존 charting 흡수
- `IndicatorTogglePanel` (RSI/MACD/MA/BB/Ichimoku/Volume) — ta4j 결과 시각화
- `PatternSimilarityPanel` — 기존 charting 흡수
- `StrategyTypeSelector` — TRANCHE / SIGNAL 선택
- `SignalConfigForm` — VolumeSpike / RsiBreakout / MaCross / BollingerSqueeze 별 폼
- `IndicatorContentRenderer` — markdown + KaTeX + 예제 inline 차트

---

## 8. 시퀀스 (핵심)

### 8.1 백테스트 (SignalStrategy)

```
FE → POST /api/v1/strategies/:id/backtests
  → quant-app: RunBacktestUseCase
    → 1) ClickHouse: SELECT ohlcv WHERE asset=X AND market=Y AND ts BETWEEN
    → 2) ta4j: 봉별 시그널 평가 (RSI/MACD/MA/BB/VolumeSpike)
    → 3) PaperExchangeAdapter: 가상 체결
    → 4) MySQL: signal_strategy_run insert
    → 5) ClickHouse: signal_eval insert
    → 6) Outbox: BacktestCompletedEvent
  → ApiResponse<BacktestRunSummary>
```

### 8.2 차트 + 지표 조회

```
FE → GET /api/v1/charts/ohlcv?asset=BTC&market=BITHUMB&interval=1d
  → quant-app: OhlcvQuery → ClickHouse 직접 read
FE → GET /api/v1/charts/indicators?asset=BTC&type=rsi&period=14
  → quant-app: IndicatorQuery → OHLCV read → ta4j 계산 → 시계열 반환
FE → POST /api/v1/charts/similarity {assetCode, windowEnd}
  → quant-app: SimilarityQuery → pgvector cosine search → top-K 반환
```

### 8.3 학습 콘텐츠

```
FE → GET /api/v1/learn/indicators
  → quant-app: ListIndicatorContentQuery → MySQL where published_at IS NOT NULL
  → 카테고리별 그룹핑 응답
어드민 → PUT /api/v1/learn/indicators/{id}
  → 권한 검증(ROLE_ADMIN) → MySQL update + indicator_revision insert
```

---

## 9. 비기능 / 운영

| 항목 | 기준 |
|---|---|
| API P95 latency | OHLCV 조회 ≤ 200ms, 지표 계산 ≤ 300ms (Tier 1) |
| pgvector 검색 P99 | ≤ 500ms (top-K 100) |
| ingest cadence | 시간봉 매시 정각 +5min, 일봉 매일 KST 16:30 |
| 멱등성 | strategy/backtest/cms 모두 멱등 키 (ADR-0029) |
| tenantId 격리 | strategy/run 모두 tenantId 필수 (INV-05) |
| 외부 노출 | 김치프리미엄 메뉴는 Phase 2 — Phase 1 결과물엔 무관 표현 |

---

## 10. 마이그레이션 / 영향

### 10.1 기존 charting 흡수

| 기존 | 통합 후 |
|---|---|
| `charting` Python 서비스 | (Phase 1 종료 후) 폐기 |
| pgvector schema `pattern` | rename `quant_pattern` |
| FE `/charting/` ingress | (Phase 1 종료 후) 제거 |
| FE `/agent-viewer/`, `/admin/` 등 | 영향 없음 |

### 10.2 기존 quant 영향

- `TrancheStrategy` → `Strategy` sealed 의 자식으로 재배치 (도메인 패키지 이동)
- 기존 백테스트 API path 유지 (하위 호환)
- 거래소 어댑터 인터페이스 일반화 (`MarketAdapter`) — 빗썸 어댑터 그대로 호환

### 10.3 ADR

- **ADR-0033** Quant 통합 플랫폼 도입 (옵션 C 결정)
- **ADR-0034** 통합 기술 스택 (Kotlin 단일 + Python ingest sidecar)
- **ADR-0035** 시계열 저장소 분리 유지 (Phase 2 통합 검토)
- charting/docs/adr/ADR-001 Errata — full merge 결정 반영
- ADR-0024 Errata — Strategy sealed 도입

---

## 11. 테스트 전략

| 레이어 | 도구 | 범위 |
|---|---|---|
| domain unit | Kotest BehaviorSpec + property-based | Strategy / SignalConfig / Asset 불변식 |
| application | Kotest + MockK | UseCase / Query 시퀀스 |
| infrastructure | Testcontainers (MySQL / ClickHouse / pgvector) | adapter / repository |
| ingest | pytest + ClickHouse docker | yfinance/fdr → ClickHouse insert |
| embedding golden | pytest + Kotest 양쪽 | 동일 60일 입력 → 32차원 출력 cosine ≥ 0.9999 (numpy ↔ multik/DJL 동등성) |
| e2e | RestAssured + ingress | API contract |

---

## 12. Out of scope (Phase 1)

- 김치프리미엄 / cross-exchange 시그널 → Phase 2
- 융합 strategy (Tranche + Signal) → Phase 3
- 실매매 → Phase 3
- 어드민 미디어 업로드 → Phase 3
- 입문자 학습 진도 / 게임화 → Phase 3
