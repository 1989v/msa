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

### TG-3: Sticky 종목 헤더 + Microcontext
- [ ] T-3-1: `charting/components/StickyStockHeader.tsx` 신규 — 종목명/가격/변동/변동률
- [ ] T-3-2: 스크롤 시 가격 폰트 32→20px 트랜지션 (Intersection Observer)
- [ ] T-3-3: `charting/components/MicrocontextRail.tsx` 신규 — 7-chip 가로 스크롤
- [ ] T-3-4: 7-chip 데이터 계산 로직 (`useChartData` 또는 `useMemo`):
  - 1일 범위, 52주 범위(현재가 위치), 거래대금, 거래량, 시총(P1 placeholder), RSI 마지막값, ATR 마지막값
- [ ] T-3-5: 좌·우 화살표 버튼 (데스크톱) + swipe (모바일)
- [ ] T-3-6: ChartsPage 에 통합

### TG-4: 시간프레임 + 도구바
- [ ] T-4-1: `charting/components/TimeframeSelector.tsx` 변경 — 7-칩 (1m/5m/30m disabled, 1d/1w/1M/1y 활성)
- [ ] T-4-2: disabled 칩 hover 시 tooltip "Phase 3 활성화 예정"
- [ ] T-4-3: `charting/components/ChartToolbar.tsx` 변경 — 차트모양/보조지표/그리기(disabled)/종목비교(disabled)/크게보기
- [ ] T-4-4: `charting/components/IndicatorPopover.tsx` 신규 — 기존 `IndicatorToggle` 을 popover wrap
- [ ] T-4-5: 차트모양 popover — candle/line/area/heikinashi
- [ ] T-4-6: 크게보기 — `requestFullscreen` API + iOS Safari fallback

### TG-5: 5-Tab 시스템
- [ ] T-5-1: `charting/tabs/ChartInfoTab.tsx` 신규 — 메인 차트 + 도구바
- [ ] T-5-2: `charting/tabs/AiInsightTab.tsx` 신규 — 패턴+유사+예측 통합 (기존 4-tab 통합)
- [ ] T-5-3: `charting/tabs/StockInfoTab.tsx` 신규 — P2 placeholder
- [ ] T-5-4: `charting/tabs/NewsTab.tsx` / `FlowsTab.tsx` 신규 — disabled placeholder
- [ ] T-5-5: ChartsPage 의 4-tab → 5-tab 전환 + URL query param `tab=` 라우팅
- [ ] T-5-6: AiInsightTab — 자연어 요약 룰 (RSI/거래량/변동률 임계 기반 단문 생성)

### TG-6: SymbolPicker + 검색 단축키
- [ ] T-6-1: `charting/components/SymbolPickerSheet.tsx` — bottom sheet (mobile) + dialog (desktop)
- [ ] T-6-2: '/' 키 단축키 (focus 가 input 이 아닐 때)
- [ ] T-6-3: 기존 `SymbolSearch` 를 sheet 안에 embed

### TG-7: 데스크톱 사이드 AI 카드
- [ ] T-7-1: 데스크톱 ≥ 1024 에서 우측 sticky AI 요약 카드 (AiInsightTab 의 자연어 요약 + 핵심 매치 1개)
- [ ] T-7-2: 모바일에선 카드 미노출 (탭 안에서만)

### TG-8: P1 종합 검증
- [ ] T-8-1: a11y — keyboard navigation 모든 탭/도구바, ARIA labels
- [ ] T-8-2: prefers-reduced-motion 시 transitions 비활성
- [ ] T-8-3: 모바일 빠른 스크롤 시 sticky 헤더 jank 없음 (60fps)
- [ ] T-8-4: 색상 토큰 grep — 시세 영역에 `--ko-status-*` 잔존 0
- [ ] T-8-5: `hns:validate --code` PASS
- [ ] T-8-6: `hns:validate-fe-design` 통과 (AI slop 미탐지)
- [ ] T-8-7: 사용자 시연 + 승인

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
