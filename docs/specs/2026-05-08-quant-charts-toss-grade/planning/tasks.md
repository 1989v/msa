# Tasks — Quant Charts Toss-grade Upgrade

**Linked**: ADR-0038, `requirements.md`, `spec.md`

각 phase 는 독립 출고 가능한 단위. P1 → P2 → P3 sequential.
체크박스는 implementation 진행에 따라 업데이트.

---

## Phase 1 — Foundation (이번 사이클 핵심)

### TG-1: 색상 토큰 분리 + DESIGN.md 표준 갱신
- [ ] T-1-1: `DESIGN.md` 에 `--ko-quote-rise/fall/rise-strong/fall-link` 추가
- [ ] T-1-2: `docs/standards/design-md.md` 에 "시세 vs P/L 색상 분리" 정책 추가
- [x] T-1-3: `quant/frontend/src/pages/ChartsPage.tsx` 의 `priceSummary` 색상 마이그레이션 (`--ko-status-*` → `--ko-quote-*`) — 4b477ed
- [x] T-1-4: `OhlcvCandleChart.tsx`, `PatternChart.tsx` 캔들/볼륨/MACD 히스토그램/호버 색상 마이그레이션 — 4b477ed
- [x] T-1-5: 회귀 grep — ChartsPage L312/L508-520 의 `--ko-status-*` 잔존은 P/L 의미라 의도된 유지

### TG-2: lightweight-charts v5+ panes 통합 (Plan C 단계적, ADR-0038 D1)

#### TG-2-A: v4 → v5 업그레이드 — 958b8b8
- [x] T-2-A-1: `quant/frontend/package.json` ^4.2.3 → ^5.2.0 + npm install
- [x] T-2-A-2: 3 파일의 series API 통합 — `addCandlestickSeries/Line/Histogram/Area(opts)` → `addSeries(SeriesType, opts)` (sed 일괄 + import 5종 추가)
- [x] T-2-A-3: markers primitive — `series.setMarkers(...)` → `createSeriesMarkers(series, ...)`
- [x] T-2-A-4: ADR-0038 D1 정정 — v4.2+ → v5+ + breaking change 표 + Plan C 명시

#### TG-2-B: ChartCore 추출 + OhlcvCandleChart 위임 — 3dfef92
- [x] T-2-B-1: `charting/components/ChartCore.tsx` 신규 — props (bars/chartType/indicators[]/onCrosshairMove/onChartReady/toTime/paneStretch)
- [x] T-2-B-2: panes 분배 로직 — paneIndex 0(가격) / 1(거래량) / 2(oscillator) / 3(momentum), v5 `addSeries(SeriesType, opts, paneIndex)`
- [x] T-2-B-3: 색상은 `getComputedStyle` 로 `--ko-*` 토큰 동적 추출, OKLCH literal fallback
- [x] T-2-B-4: heikinashi 변환 helper, withAlpha (hex/rgb/oklch all-format)
- [x] T-2-B-5: `OhlcvCandleChart.tsx` → ChartCore 위임 wrapper

#### TG-2-C: PatternChart panes 통합 + PatternOverlay 분리 — b3dbca3
- [x] T-2-C-1: `charting/components/PatternOverlay.tsx` 신규 — chart/mainSeries 인스턴스 받아 좌표 변환 + 패턴 라인/projection (chart.addSeries) + score 마커 (createSeriesMarkers, candle 모드) + DOM 드래그 핸들/score badge
- [x] T-2-C-2: `PatternChart.tsx` 재작성 (840줄 → ~480줄) — 단일 ChartCore + indicators[] 동적 매핑
- [x] T-2-C-3: 활성화된 sub-pane 만 paneIndex 1+ 동적 할당 (Volume/RSI/MACD/Stoch/Williams/ATR/OBV)
- [x] T-2-C-4: 메인 pane overlays — MA 5/20/60/120, Bollinger Bands, VWAP (paneIndex 0)
- [x] T-2-C-5: prepareBars 의 KR intraday timezone 안전 로직 보존 (sequential 5min timestamp)

#### TG-2-D: indicators.ts paneIndex 메타 + 규약 문서화
- [x] T-2-D-1: `lib/indicators.ts` 에 `IndicatorKey` / `IndicatorPaneGroup` / `IndicatorMeta` / `INDICATOR_META` / `activeSubPaneKeys` 신규 export
- [x] T-2-D-2: paneIndex 규약 JSDoc 명시 (overlay=0, volume / oscillator / momentum 동적 할당)
- [ ] T-2-D-3: PatternChart 의 hardcoded color array 를 INDICATOR_META 참조로 점진 교체 (TG-4 IndicatorPopover 와 함께)
- [ ] T-2-D-4: vitest 인프라 도입 + 회귀 테스트 — **P1 종합 검증 TG-8 로 이관**
  - 도입 비용 (vitest, @testing-library/react, jsdom, vitest.config.ts) 이 단일 task 수준이라 묶음
  - 테스트 대상: ChartCore paneIndex 분배, prepareBars intraday detect, activeSubPaneKeys 순서, PatternOverlay 드래그 핸들

### TG-3: Sticky 종목 헤더 + Microcontext — 5a8513a
- [x] T-3-1: `charting/components/StickyStockHeader.tsx` 신규 — 종목명/큰 가격/변동률, --ko-quote-* 토큰
- [x] T-3-2: 가격 폰트 xl/2xl + tabular-nums (Intersection Observer 기반 트랜지션은 P2)
- [x] T-3-3: `charting/components/MicrocontextRail.tsx` 신규 — 가로 스크롤 chips, RangePositionBar
- [x] T-3-4: 7-chip P1 데이터 — 30일 범위(+ 위치 bar) / 거래대금 / 평균 거래량 / RSI(14) tone / ATR / MA20 + dev% / 기간 수익률
- [x] T-3-5: 데스크톱 좌·우 chevron 버튼 (스크롤 가능 시 노출), 모바일 swipe (snap-x)
- [x] T-3-6: ChartsPage 통합 + 미사용 fetchSymbols / assetLabel 정리

### TG-4: 시간프레임 + 도구바 + IndicatorPopover — f0abc09
- [x] T-4-1: `charting/components/TimeframeSelector.tsx` 신규 — 7-칩 + types.ts TimeframeKey/TIMEFRAMES 메타
- [x] T-4-2: 분봉 3종 disabled (Phase 3 SSE 와 함께 활성), aria-disabled + tooltip
- [x] T-4-3: `ChartToolbar.tsx` 갱신 — 차트모양 popover (heikinashi 추가) + IndicatorPopover + 그리기(P2 disabled) + 종목비교(P2 disabled) + 크게보기
- [x] T-4-4: `IndicatorPopover.tsx` 신규 — 외부 클릭/ESC 닫기, 활성 카운트 배지
- [x] T-4-5: 차트모양 popover — 4종 (candle/heikinashi/line/area)
- [x] T-4-6: 크게보기 = requestFullscreen API
- [x] T-4-7: PeriodSelector.tsx 삭제, 기존 누적 타입 에러 2건 (fetchSymbols/Period) 해결

### TG-5: 5-Tab 시스템 + URL 라우팅 — 37037d9
- [x] T-5-1: BottomTab 5종 — chart(default) / info(disabled) / insight / news(disabled) / flows(disabled)
- [x] T-5-2: insight 탭 — AI 자연어 요약 + 패턴 매치 + Prediction KPI + Similarity 표 통합
- [x] T-5-3: info / news / flows 는 DisabledTabPlaceholder + Phase 2 활성화 안내
- [x] T-5-4: URL ?tab= 라우팅 (useSearchParams, replace), default(chart) 는 query 미박힘
- [x] T-5-5: aiSummaryText helper — RSI/MA20/변동률 임계 기반 단문 (P2 LLM 격상 검토)
- [x] T-5-6: 탭 nav role=tablist + aria-selected/disabled, --ko-accent-primary 토큰
- [ ] T-5-4: `charting/tabs/NewsTab.tsx` / `FlowsTab.tsx` 신규 — disabled placeholder
- [ ] T-5-5: ChartsPage 의 4-tab → 5-tab 전환 + URL query param `tab=` 라우팅
- [ ] T-5-6: AiInsightTab — 자연어 요약 룰 (RSI/거래량/변동률 임계 기반 단문 생성)

### TG-6: SymbolPicker + 검색 단축키 — ef9bb2b
- [x] T-6-1: `SymbolPickerSheet.tsx` 신규 — bottom sheet (모바일) + side dialog (데스크톱), role=dialog/aria-modal, ESC/overlay 닫기, 자동 input focus
- [x] T-6-2: '/' 키 단축키 (window keydown, INPUT/TEXTAREA/contentEditable focus 시 무시)
- [x] T-6-3: 기존 `SymbolSearch` 를 sheet 안에 embed, ChartsPage 의 inline SymbolSheet 제거

### TG-7: 데스크톱 사이드 AI 카드 — 4c851d3
- [x] T-7-1: `AiSideCard.tsx` 신규 — summary + topMatch + prediction (5d/20d KPI) + onSeeMore (insight 탭 점프)
- [x] T-7-2: ChartsPage outer lg grid (main 1fr + aside 320px), aside 는 hidden lg:block + sticky top-260px
- [x] T-7-3: 모바일/태블릿은 grid 미적용 — 단일 column 유지

### TG-8: P1 종합 검증
- [x] T-8-1: a11y — role=tab/tablist/dialog, aria-selected/disabled/modal, aria-label/title 19곳 (검증)
- [x] T-8-2: prefers-reduced-motion → tokens.css `@media` 에서 모든 duration 0ms (TG-1 에 이미 적용)
- [x] T-8-3: vitest + jsdom 도입 (vitest@^2.1.9, jsdom@^26.1.0) + vitest.config.ts + npm scripts (test/test:watch)
- [x] T-8-4: 색상 토큰 grep — 시세 영역 `--ko-status-*` 잔존 7곳 모두 P/L 의미 (similarity 5d/20d, AiSideCard MiniReturnKpi, ChartsPage 에러 메시지) — 의도된 유지
- [x] T-8-5: 단위 테스트 12 passing — INDICATOR_META 메타 일관성 / activeSubPaneKeys 순서 / calcMA / calcRSI / calcOBV / calcBollingerBands / calcVWAP
- [x] T-8-6: typecheck 0 errors final
- [ ] T-8-7: 통합 테스트 (RTL + 컴포넌트) — P2 또는 별도 사이클
- [ ] T-8-8: `hns:validate --code` 실행 + 사용자 시연 + 승인

---

## Phase 2 — Info & AI

### TG-9: 종목정보 탭
- [ ] T-9-1: 백엔드 — quant `/api/v1/charts/fundamentals/{asset}/{market}` (yfinance fundamentals 캐시)
- [ ] T-9-2: `charting/hooks/useFundamentals.ts` 신규
- [ ] T-9-3: `StockInfoTab.tsx` 활성화 — 시총/PE/배당/52주/베타/EPS 카드 그리드
- [ ] T-9-4: Microcontext 의 시총 칩이 fundamentals 데이터로 실측

### TG-10: AI 통합 카드 + LLM (검토)
- [ ] T-10-1: AiInsightTab 자연어 요약을 LLM 호출로 (옵션) — quant 백엔드 신규 endpoint or client-side
- [ ] T-10-2: 카드 그리드 재배치 — 패턴 / 유사 / 예측 / 자연어 4-grid

### TG-11: 그리기 도구
- [ ] T-11-1: `charting/lib/drawing.ts` — 가로선/추세선/측정도구 데이터 모델
- [ ] T-11-2: lightweight-charts plugin 또는 Canvas overlay 로 구현
- [ ] T-11-3: 로컬 storage 저장 (per asset)
- [ ] T-11-4: 도구바 그리기 disabled → 활성

### TG-12: 종목비교 overlay
- [ ] T-12-1: 도구바 종목비교 popover — 종목 1개 추가 선택
- [ ] T-12-2: ChartCore 에 비교 시리즈 (정규화 — 시작점 100% 기준) overlay
- [ ] T-12-3: legend 표시

---

## Phase 3 — Realtime

### TG-13: 백엔드 SSE 엔드포인트
- [ ] T-13-1: ADR-0038 D7 검토 — 분봉 ingest 별도 ADR 필요 여부 확인 (OQ-Q02)
- [ ] T-13-2: `application/charts/port/PriceStreamPort.kt`
- [ ] T-13-3: `infrastructure/charts/adapter/SsePriceStreamAdapter.kt` (Spring `SseEmitter`)
- [ ] T-13-4: `infrastructure/charts/adapter/PricePollingScheduler.kt` (yfinance/FDR 폴링)
- [ ] T-13-5: Redis pubsub fan-out
- [ ] T-13-6: heartbeat 15s, idle timeout 30s
- [ ] T-13-7: presentation `ChartsStreamController.kt` — `GET /api/v1/charts/stream/{asset}/{market}`
- [ ] T-13-8: 메트릭 (subscribers / emit / latency)
- [ ] T-13-9: Kotest BehaviorSpec — 다중 구독, reconnect, heartbeat

### TG-14: FE usePriceStream + 가격 flash
- [ ] T-14-1: `charting/hooks/usePriceStream.ts` — SSE EventSource + 자동 reconnect (last-id)
- [ ] T-14-2: `charting/components/PriceFlash.tsx` — CSS keyframe (rise: green flash, fall: red flash, < 600ms)
- [ ] T-14-3: prefers-reduced-motion 시 flash 비활성
- [ ] T-14-4: StickyStockHeader 가격에 PriceFlash 적용

### TG-15: 분봉 시간프레임 활성화
- [ ] T-15-1: 백엔드 1분/5분/30분 OHLCV ingest (별도 job 또는 SSE 누적)
- [ ] T-15-2: `/api/v1/charts/ohlcv` interval 파라미터 확장 (`1m`/`5m`/`30m`)
- [ ] T-15-3: TimeframeSelector 의 1m/5m/30m disabled 해제

### TG-16: P3 종합
- [ ] T-16-1: SSE p99 latency 측정 (Prometheus)
- [ ] T-16-2: 부하 테스트 (k6 — 동시 SSE 1000 연결)
- [ ] T-16-3: 사용자 시연 + 승인

---

## 후속 spec (이 ADR 외)

| 영역 | spec 후보 명 | 비고 |
|---|---|---|
| 호가 / 체결 stream | `2026-XX-quant-orderbook` | 별도 ADR + ingest 결정 |
| 매매주체 (외국인/기관) | `2026-XX-quant-flows` | KRX/FDR ingest 보강 |
| 뉴스·공시 | `2026-XX-quant-news-feed` | 별도 source |
| 발견·트렌딩 화면 | `2026-XX-quant-discover` | `/quant/discover` 신규 라우트 |
| 글로벌 지수 마퀴 | (작은 PR) | 8개 indices 추가 ingest + 풋터 컴포넌트 |

---

## Open Questions (구현 중 확인)

- OQ-Q01: lightweight-charts 현 버전 → T-2-1 에서 확인
- OQ-Q02: 분봉 ingest 가 P3 SSE 와 동시 도입 vs 분리
- OQ-Q03: 그리기 도구를 P2 → P3 로 이동? (ROI 비교)
- OQ-Q04: SSE 익명 허용 정책 운영자 최종 확인
- OQ-Q05: `Toss Product Sans` 가 없으니 `Pretendard` 채택 — 이미 시스템 폰트인지, 추가 import 필요한지 확인
