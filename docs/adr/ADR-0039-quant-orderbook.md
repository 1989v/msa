# ADR-0039 — Quant 호가/체결 stream (CRYPTO 우선)

- **Status**: Proposed (별도 spec / 후속 사이클 진행)
- **Date**: 2026-05-09
- **Deciders**: 운영자
- **Related**: ADR-0036 (Phase 2 cross-exchange), ADR-0038 (차트 페이지 토스급 Foundation)

---

## Context

토스 종목 상세는 호가 5/10단 + 체결 stream 을 우측 패널로 표시. 우리 quant 는 P1 Foundation 에서 차트·정보·AI 인사이트만 출고. 호가/체결은 ADR-0038 D9 에서 별도 ADR 로 분리.

데이터 source 결정이 자산 클래스마다 다름:
- **CRYPTO (빗썸)**: ws orderbook + transaction 무료 공개 API
- **STOCK_KR**: KRX 회원사 데이터 또는 FDR (지연 호가만), 무료 실시간은 어려움
- **STOCK_US**: Yahoo / Alpha Vantage 무료는 호가 없음, IEX Cloud / Polygon 유료

→ **CRYPTO 우선**, 주식은 후속 phase 또는 영구 미지원.

---

## Decision

### D1. 우선순위: 빗썸 CRYPTO ws → 성공 후 평가
- 빗썸 ws orderbook + transaction subscribe (이미 ADR-0036 Phase 2 cross-exchange 에서 ws infra 일부 설치됨, 재사용)
- STOCK_KR / STOCK_US 호가는 P3 후 별도 spec 에서 비용/공급 결정

### D2. 백엔드 구조
- `application/chart/OrderbookPort.kt` — interface
- `infrastructure/exchange/BithumbOrderbookAdapter.kt` — ws subscribe + parse
- `application/chart/OrderbookSnapshotService.kt` — 5/10단 snapshot 유지
- `presentation/controller/ChartsOrderbookController.kt` — `GET /api/v1/charts/orderbook/{asset}/{market}` (snapshot) / `GET /stream/orderbook/{asset}/{market}` (SSE delta)

### D3. 데이터 모델 (도메인)
```kotlin
data class OrderbookLevel(val price: BigDecimal, val quantity: BigDecimal)
data class OrderbookSnapshot(
  val asset: AssetCode, val market: MarketCode,
  val asks: List<OrderbookLevel>,  // 매도 호가 (오름차순)
  val bids: List<OrderbookLevel>,  // 매수 호가 (내림차순)
  val ts: Instant,
)
data class TradeFill(
  val asset: AssetCode, val market: MarketCode,
  val price: BigDecimal, val quantity: BigDecimal, val side: 'BUY'|'SELL',
  val ts: Instant,
)
```

### D4. FE
- `charting/components/OrderbookPanel.tsx` 신규 — 5/10단 시각화 (매도 위 / 매수 아래, depth bar)
- `charting/components/TradeFlow.tsx` 신규 — 체결 stream 테이블
- ChartsPage 의 'flows' 탭(현재 disabled) 가 호가·체결 합본 → 'orderbook' tab 으로 재명명, 또는 데스크톱 우측 사이드 카드와 동시

### D5. STOCK_KR / STOCK_US 지원
- **현재 결정**: P3 후 평가. 무료 source 부재로 비용 vs 가치 trade-off 큼.
- KR: KRX 회원사 가입 비용 (월 단위 license). FDR 은 지연 호가 only.
- US: IEX Cloud Free tier 는 호가 미포함. Polygon $29/mo 시작.

---

## Consequences

### Positive
- CRYPTO 호가 → 김치프리미엄 (ADR-0036) 과 시너지
- ws infra 재사용
- 토스급 패널 1단계

### Negative / Risks
- 빗썸 ws 안정성 (재연결 필요)
- 호가 변동 빈도 높음 → 클라이언트 데이터 폭증 가능 (throttle 필수)
- KR/US 주식은 사실상 미지원 → 사용자 기대치 관리

---

## Phase Roadmap

| Phase | 범위 | 종속성 |
|---|---|---|
| **PA**: CRYPTO 호가 (빗썸) | 백엔드 ws + snapshot + SSE delta + FE OrderbookPanel | ADR-0036 ws infra |
| **PB**: 체결 stream | TradeFill SSE + FE TradeFlow 테이블 | PA |
| **PC**: STOCK_KR (옵션) | KRX 회원사 가입 후 ingest | 비용 결정 |
| **PD**: STOCK_US (옵션) | IEX/Polygon 유료 — 비용 vs 가치 평가 | 비용 결정 |

이 ADR 은 PA/PB 의 방향만 결정. PC/PD 는 별도 ADR.

---

## Open Questions

- OQ-OB-01: 빗썸 ws 의 throughput / reconnect SLO 측정 필요
- OQ-OB-02: 호가 SSE delta vs snapshot polling — 5초 polling 도 검토할 가치 (구현 단순)
- OQ-OB-03: 모바일 호가 패널 UX — 토스는 우측 sticky, 우리는 모바일 우선 → 탭 안 또는 sheet
