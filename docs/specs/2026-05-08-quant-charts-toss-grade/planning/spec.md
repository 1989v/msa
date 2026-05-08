# Spec — Quant Charts Toss-grade Upgrade

**Linked**: ADR-0038, `requirements.md`, `research/notes.md`, `research/design-tokens.md`

---

## 1. Architecture (FE)

### 1.1 Module Layout

```
quant/frontend/src/
├── pages/
│   └── ChartsPage.tsx              # 5-tab 컨테이너, sticky 헤더, microcontext, query param 라우팅
├── charting/
│   ├── components/
│   │   ├── StickyStockHeader.tsx   # NEW — 종목명+가격+변동+microcontext
│   │   ├── MicrocontextRail.tsx    # NEW — 7-chip 가로 스크롤
│   │   ├── TimeframeSelector.tsx   # 변경 — 분봉 disabled 상태 지원
│   │   ├── ChartToolbar.tsx        # 변경 — 차트모양/지표popover/그리기/비교/크게보기
│   │   ├── IndicatorPopover.tsx    # NEW — 도구바 popover, IndicatorToggle 재사용
│   │   ├── SymbolPickerSheet.tsx   # 변경 — bottom sheet (mobile) + dialog (desktop)
│   │   ├── PriceFlash.tsx          # NEW (P3) — CSS animation wrapper
│   │   └── ChartCore.tsx           # NEW — lightweight-charts 4.2+ panes 래퍼
│   ├── hooks/
│   │   ├── useChartData.ts         # NEW — useQuery wrapper
│   │   ├── usePriceStream.ts       # NEW (P3) — SSE 훅
│   │   └── useFundamentals.ts      # NEW (P2)
│   ├── lib/
│   │   ├── indicators.ts           # 유지 — sub-pane 분리 위해 시리즈 메타 추가
│   │   ├── patternMatcher.ts       # 유지
│   │   └── patternOverlay.ts       # NEW — lightweight-charts 좌표 → Canvas overlay
│   └── tabs/                       # NEW — 5-tab 콘텐츠 컴포넌트
│       ├── ChartInfoTab.tsx        # 메인 차트 + 도구바
│       ├── StockInfoTab.tsx        # P2
│       ├── AiInsightTab.tsx        # 통합 패턴+유사+예측
│       ├── NewsTab.tsx             # placeholder (disabled)
│       └── FlowsTab.tsx            # placeholder (disabled)
└── components/charts/
    └── OhlcvCandleChart.tsx        # 변경 — ChartCore 로 위임
```

### 1.2 ChartsPage 레이아웃

**모바일 (< 1024)**:
```
[ Sticky Header ]
  - 종목명+코드  종목 변경 버튼
  - 큰 가격 / 변동 / 변동률
  - Microcontext 7-chip ◀ ▶ 가로 스크롤
[ Timeframe Selector ] (가로 스크롤)
[ ChartToolbar ] (가로 스크롤)
[ Tab Bar ] 차트·정보 / 종목정보 / AI / 뉴스 / 매매주체
[ Active Tab Content ]
[ (P3) Bottom 시간프레임 sticky 옵션 ]
```

**데스크톱 (≥ 1024)**:
```
[ Sticky Header (동일) ]
[ Timeframe + Toolbar (한 행) ]
┌──────────────────┬──────────────┐
│ Tab Bar + Active │  AI 사이드   │
│ Tab Content      │  요약 카드   │
│ (메인 차트는     │  (sticky)    │
│  panes 다층)     │              │
└──────────────────┴──────────────┘
```

### 1.3 5-Tab 라우팅

URL: `/quant/charts?asset=BTC&market=CRYPTO&tf=1d&tab=chart|info|insight|news|flows`

탭 전환은 **react-router 의 search param** 으로. deep link 가능.

## 2. Components

### 2.1 ChartCore (NEW)

`lightweight-charts` 4.2+ panes API 래퍼. 외부에 OHLCV + 보조지표 시리즈 입력만 받고 panes 자동 분리.

```ts
interface ChartCoreProps {
  bars: OhlcvBar[]
  chartType: 'candle' | 'line' | 'area' | 'heikinashi'
  indicators: IndicatorSeries[]      // { name, paneIndex, type, data, color }
  patternOverlays?: PatternOverlay[] // 좌표 변환용
  onCrosshairMove?: (info: CrosshairInfo) => void
  height?: number
}
```

- panes 분배 규칙:
  - paneIndex 0 = 가격 (메인)
  - 1 = 거래량
  - 2 = RSI / Stoch / Williams%R (oscillator)
  - 3 = MACD / OBV
- 색상은 `getComputedStyle(document.documentElement)` 로 `--ko-*` 토큰 동적 추출.

### 2.2 StickyStockHeader

```tsx
<StickyStockHeader
  symbol={symbol}
  priceSummary={priceSummary}     // last, change, changePct, isUp
  onSymbolClick={() => setPickerOpen(true)}
  microcontext={mcRows}           // 7-chip 데이터
/>
```

스크롤 시 `priceSummary` 폰트 크기 32→20px 트랜지션 (intersection observer).

### 2.3 MicrocontextRail

7-chip 가로 스크롤. 좌·우 화살표 버튼 (데스크톱), swipe (모바일).

| Chip | 데이터 |
|---|---|
| 1일 범위 | `dayLow ~ dayHigh` (오늘 OHLC bars) |
| 52주 범위 | `52wLow ~ 52wHigh` + 현재가 위치 (mini bar) |
| 거래대금 | `volume * close` 합 (오늘) |
| 거래량 | `volume` (오늘) |
| 시가총액 | `marketCap` (P2 fundamentals) — P1 은 placeholder |
| RSI | 마지막 RSI 값 + 색상 위계 |
| 변동성(ATR) | 마지막 ATR 값 |

### 2.4 TimeframeSelector

```tsx
const TIMEFRAMES = [
  { key: '1m',  label: '1분',  disabled: true },   // P3
  { key: '5m',  label: '5분',  disabled: true },
  { key: '30m', label: '30분', disabled: true },
  { key: '1d',  label: '일',   disabled: false },
  { key: '1w',  label: '주',   disabled: false },
  { key: '1M',  label: '월',   disabled: false },
  { key: '1y',  label: '년',   disabled: false },
]
```

`disabled` 칩은 회색 + tooltip "Phase 3 에서 활성화 예정".

### 2.5 ChartToolbar (변경)

```
[ 차트모양 ∨ ] [ 보조지표 ∨ ] [ 그리기 (P2) ] [ 종목비교 (P2) ] [ ⛶ 크게보기 ]
```

- 차트모양 popover: candle / line / area / heikinashi
- 보조지표 popover: 기존 `IndicatorToggle` 컴포넌트 재사용 — params 까지 포함
- 그리기/종목비교: P1 disabled (회색)
- 크게보기: `requestFullscreen` API

### 2.6 AiInsightTab

```
┌─────────────────────────────────────────────┐
│ ✨ AI 한 줄 요약 (자연어, 우리 백엔드)      │
│   "지난 30일 +12%, RSI 73 과매수"           │
├─────────────────────────────────────────────┤
│ 인식 패턴 (matches)            예측 (kNN)   │
│ [패턴 카드 그리드]             [샘플/5d/20d]│
├─────────────────────────────────────────────┤
│ 유사 자산 (pgvector similarity 표)          │
└─────────────────────────────────────────────┘
```

P1 은 자연어 요약은 클라이언트 측 단순 룰 기반 (RSI / 거래량 / 변동률 계산). P2 에서 LLM 통합 검토.

## 3. Backend (Phase 3 SSE)

### 3.1 SSE Endpoint

```
GET /api/v1/charts/stream/{asset}/{market}
Accept: text/event-stream

event: tick
id: <epoch_ms>
data: {"asset":"BTC","market":"YAHOO","ts":"...","price":"...","volume":"..."}

event: heartbeat
data: {}
```

### 3.2 Backend 구조

- `application/charts/port/PriceStreamPort.kt` — SSE 발행 port
- `infrastructure/charts/adapter/SsePriceStreamAdapter.kt` — Spring `SseEmitter`
- `infrastructure/charts/adapter/PricePollingScheduler.kt` — yfinance/FDR 폴링 → Redis pubsub
- Redis key: `quant:price:tick:{asset}:{market}` channel
- 다중 SSE 클라이언트는 Redis subscribe 로 fan-out
- 연결 idle timeout 30s, heartbeat 15s

### 3.3 Latency Budget

| 단계 | Target |
|---|---|
| Polling → Redis | < 200ms |
| Redis → SSE first byte | < 100ms |
| Total p99 | < 1.5s |

## 4. Color Token Migration

### 4.1 신규 토큰 (`DESIGN.md` 추가)

```css
/* Quote (한국 시세 관습) */
--ko-quote-rise: oklch(0.66 0.20 25);
--ko-quote-rise-strong: oklch(0.62 0.23 25);
--ko-quote-fall: oklch(0.66 0.20 250);
--ko-quote-fall-link: oklch(0.72 0.18 250);
```

### 4.2 마이그레이션 영향 범위

| 파일 | 변경 |
|---|---|
| `pages/ChartsPage.tsx` | `priceSummary` 색상 `--ko-status-*` → `--ko-quote-*` |
| `charting/components/PatternChart.tsx` | 캔들 색상 `--ko-quote-rise/fall` |
| `components/charts/OhlcvCandleChart.tsx` | upColor/downColor `--ko-quote-rise/fall` |
| `components/charts/BacktestRunChart.tsx` | 검토 — 백테스트 PnL 은 `--ko-status-*` 유지 |

`docs/standards/design-md.md` 갱신: "시세 색상은 `--ko-quote-*`, P/L 색상은 `--ko-status-*` 로 분리".

## 5. Test Strategy (Kotest BehaviorSpec, Vitest)

### 5.1 FE (Vitest + RTL)
- `ChartCore` panes 분배 — paneIndex 별 시리즈 등록 호출 확인
- `MicrocontextRail` 7-chip 렌더 + 좌우 스크롤 버튼 active/disabled
- `StickyStockHeader` 스크롤 트리거 폰트 사이즈 트랜지션 (intersection observer mock)
- `TimeframeSelector` disabled 칩 클릭 시 `onChange` 미호출
- 색상 토큰 회귀: snapshot

### 5.2 BE (Phase 3 — Kotest)
- `PriceStreamPortContract` — emit / disconnect 시퀀스
- `SsePriceStreamAdapterTest` — heartbeat 주기, 다중 클라이언트 fan-out
- `PricePollingSchedulerTest` — yfinance 모킹 + Redis publish

## 6. Migration Plan

P1 → P2 → P3 순차 출고.
- P1 출고 시 분봉 칩은 `disabled`. P3 에서 `disabled` 해제 + SSE 연결.
- 색상 토큰 마이그레이션은 P1 첫 PR 에서 일괄 처리 (모든 시세 표시 영역).

## 7. Risks

| Risk | Mitigation |
|---|---|
| lightweight-charts panes API 의 4.2 미만 사용 중 | `package.json` 확인 + 업그레이드 + visual regression |
| 패턴 overlay 좌표가 panes API 에서 어긋남 | `priceScale().priceToCoordinate` + `timeScale().timeToCoordinate` 직접 호출 |
| SSE 다중 종목 구독 시 Redis 채널 폭증 | per-asset/market 채널 + 구독 카운트로 fan-out 정리 |
| 모바일 fullscreen API 호환성 | iOS Safari 미지원 → fallback (zoom 모달) |
| 색상 토큰 일괄 변경의 회귀 | grep 으로 모든 사용처 list-up 후 PR 분리 |

## 8. Observability

- FE: PostHog event `charts_tab_change`, `charts_timeframe_change`, `charts_indicator_toggle`
- BE (P3): Prometheus
  - `quant_price_stream_subscribers{asset,market}` (gauge)
  - `quant_price_stream_emit_total{asset,market}` (counter)
  - `quant_price_polling_latency_seconds{source}` (histogram)

## 9. Rollout

- P1: feature flag 없이 직출고 (현 ChartsPage 직접 교체). 색상 토큰 변경은 모든 시세 요소 동시 변경.
- P2: P1 의 5-tab 위에 종목정보/AI 통합 카드 추가.
- P3: SSE 백엔드 신규 엔드포인트 + FE 분봉 활성화.
- 회귀 테스트는 quant-fe 의 기존 ChartsPage 시나리오 + 신규 케이스.
