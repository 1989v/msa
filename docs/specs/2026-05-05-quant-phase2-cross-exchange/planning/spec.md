<!-- source: quant -->
---
spec: quant-phase2-cross-exchange
date: 2026-05-05
status: draft
parent: initialization.md
phase: Phase 2
---

# Spec — Cross-Exchange Signal & charting 흡수 (Phase 2)

## 1. Phase 1 → Phase 2 차이

| 영역 | Phase 1 | Phase 2 |
|---|---|---|
| 거래소 어댑터 | 빗썸 (단일) | 빗썸 + Binance (cross-exchange) |
| 시그널 strategy | single-source (VolumeSpike/RSI/MA/BB) | + KimchiPremium / ArbitrageSpread |
| charting 서비스 | 병행 운영 | **폐기** — manifest/image/ingress 제거 |
| 융합 strategy | 도메인 모델만 | 백테스트 + paper trading 와이어업 |
| FX | 빗썸 USDT/KRW proxy | + Open Exchange Rates / 한국은행 ECOS 옵션 |

## 2. Binance 어댑터

### 2.1 위치 / 인터페이스

- `infrastructure/exchange/BinanceMarketAdapter` — `MarketAdapter` 구현
- public REST: `https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT`
- WebSocket (Phase 2 후반): `wss://stream.binance.com:9443/ws/btcusdt@trade`

### 2.2 인증 / Rate Limit
- public ticker 는 인증 0.
- IP 당 1200 weight/min — `X-MBX-USED-WEIGHT-1M` 헤더로 모니터링 + Resilience4j RateLimiter.

### 2.3 자산 매핑
- 도메인 `AssetCode("BTC")` ↔ Binance `BTCUSDT` 변환 mapper.
- `AssetClass.CRYPTO` 만 지원.

## 3. KimchiPremiumSignal

### 3.1 도메인

```kotlin
data class KimchiPremium(
    val krMarket: MarketCode,        // BITHUMB
    val foreignMarket: MarketCode,   // BINANCE
    val asset: AssetCode,            // BTC
    val premiumPercent: BigDecimal,  // (kr - foreign·fx) / foreign·fx × 100
    val krwPrice: BigDecimal,
    val foreignUsdPrice: BigDecimal,
    val krwPerUsd: BigDecimal,
    val ts: Instant,
)

data class KimchiPremiumThreshold(
    val entryThresholdPercent: BigDecimal,  // 예: 5.0 (프리미엄 ≥ 5% 시 진입)
    val exitThresholdPercent: BigDecimal,   // 예: 1.0 (프리미엄 ≤ 1% 시 청산)
) : SignalConfig
```

`SignalConfig` sealed 자식 추가.

### 3.2 계산 흐름

```
KimchiPremiumCalculator
  ├ BinanceMarketAdapter.latestPrice(BTC) → BTCUSDT (USD)
  ├ BithumbMarketAdapter.latestPrice(BTC) → BTC/KRW
  ├ FxRateProvider.krwPerUsd() → KRW/USD
  └ premium% = (krwPrice - usdPrice·fx) / (usdPrice·fx) × 100
```

ClickHouse `quant.kimchi_premium_tick` 적재 (시계열 차트).

## 4. charting 흡수

### 4.1 코드 마이그레이션

| charting | quant 대응 |
|---|---|
| `src/application/usecase/SimilaritySearchUseCase.py` | `SimilarityQuery.searchSimilar` (이미 Phase 1 후반에 wire-up) |
| `src/application/usecase/PredictReturnUseCase.py` | 신규 `PredictionQuery` (Phase 2) — pgvector top-K → 평균 future return |
| `src/adapter/yfinance_adapter.py` | quant/ingest sidecar (이미 Phase 1) |
| `pattern` 테이블 | `quant_pattern` (이미 Phase 1 인프라) |

### 4.2 PredictionQuery (신규)

```kotlin
@Component
class PredictionQuery(
    private val embedder: PatternEmbedder,
    private val ohlcvRepo: OhlcvRepositoryPort,
    private val embeddingRepo: PatternEmbeddingRepositoryPort,
) {
    suspend fun predict(
        asset: AssetCode, market: MarketCode, windowEnd: Instant,
        k: Int = 50,
    ): Prediction {
        val v = embedder.embed(...)
        val hits = embeddingRepo.searchTopK(v, k = k)
        return Prediction(
            avg5d  = hits.mapNotNull { it.return5d  }.average(),
            avg20d = hits.mapNotNull { it.return20d }.average(),
            avg60d = hits.mapNotNull { it.return60d }.average(),
            sample = hits.size,
        )
    }
}
```

REST: `GET /api/v1/charts/prediction?asset=BTC&market=BITHUMB&k=50`

### 4.3 매니페스트 폐기 단계

`docs/runbooks/charting-deprecation.md` 4단계 절차 그대로:
1. 트래픽 검증 (1주)
2. Soft scale 0 (`patches/charting-replicas-zero.yaml` 추가)
3. Hard remove (k8s/base 디렉토리 삭제 + ingress 정리 + ADR-001 Status=Superseded)
4. 데이터 마이그레이션 (charting `pattern` → `quant_pattern`)

## 5. HybridStrategy 백테스트

### 5.1 평가 로직

```
for each bar:
    if signalGate.entrySignal triggered at bar:
        trancheBase 의 분할 진입 시작 (회차별 매수가 / 익절)
    각 회차의 익절 조건은 trancheBase.config 에 따름
```

### 5.2 RunHybridBacktestUseCase

- 입력: HybridStrategy id, 기간
- 출력: BacktestRunSummary (실현 PnL / 회차별 fill / 시그널 trigger 횟수)
- 단위 테스트: 시그널 무발화 → 진입 0회, 시그널 항상 trigger → tranche 단독 백테스트와 동등

## 6. 거래소 어댑터 일반화

`MarketAdapter` 확장 (Phase 2):

```kotlin
interface MarketAdapter {
    val market: Market
    fun supports(asset: Asset): Boolean
    suspend fun latestPrice(asset: Asset): BigDecimal
    suspend fun latestPriceAt(asset: Asset): Instant
    // Phase 2 신규
    suspend fun candles(asset: Asset, interval: String, from: Instant, to: Instant): List<IndicatorCalculator.Bar>
}
```

Bithumb / Binance 양쪽 구현.

## 7. ADR

- **ADR-0036** Phase 2 도입 (cross-exchange + charting 폐기)
- charting/docs/adr/ADR-001 Status: Accepted → **Superseded** (Phase 2 종료 시)

## 8. 비기능

| 항목 | 기준 |
|---|---|
| 김치프리미엄 갱신 | ≤ 5초 (REST polling) — Phase 2 후반 WebSocket 으로 ≤ 1초 |
| Binance Rate Limit | 1200 weight/min, R4j RateLimiter |
| FX 캐시 | 빗썸 USDT/KRW 60초 cache (Phase 1 그대로) |
| 운영 표면 | charting 서비스 폐기 시 메트릭/로그/CI 일괄 정리 |

## 9. Out of scope (Phase 3+)

- 실매매 / kill-switch / 2FA
- Bybit / OKX / 기타 해외 거래소
- 어드민 미디어 업로드 (image/video 첨부)
- 학습 진도 / 게임화
