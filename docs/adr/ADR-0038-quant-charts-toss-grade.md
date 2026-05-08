# ADR-0038 — Quant 차트 페이지 토스증권 수준 고도화 (Foundation)

- **Status**: Accepted (2026-05-09) — **Phase 1 (Foundation) 출고 완료 (2026-05-09)**
- **Date**: 2026-05-08
- **Deciders**: 운영자
- **Related**:
  - ADR-0033 (Quant 통합 플랫폼 — sealed Strategy + 차트 분석)
  - ADR-0036 (Phase 2 cross-exchange + paper SSE)
  - ADR-0026 (Docs Taxonomy)
  - DESIGN.md 표준 (`docs/standards/design-md.md`)
  - Spec: `docs/specs/2026-05-08-quant-charts-toss-grade/`

---

## Context

`/quant/charts` 는 ADR-0033 Phase 1 에서 모바일 우선 기본 형태로 출고됐다. 자체 SVG `PatternChart` + 4-탭 (지표/패턴/예측/유사) 구조이며, 인터랙션·정보 위계·실시간성에서 토스증권 수준과 큰 갭이 있다.

운영자 요청: **토스증권 수준의 종목 상세 페이지 전면 재설계**. Large 스코프(차트 인터랙션 + 종목 상세 + 발견 화면 + 톤·정보 위계 + 실시간 SSE).

벤치마크 분석 결과 (`research/notes.md`, `research/design-tokens.md`):
- 토스는 **TradingView Advanced Charts iframe** + 자체 데이터·패널 합성
- 우측 드래그 정렬 가능 패널 5종(호가/시세/주문/매매주체/커뮤니티) + 글로벌 지수 마퀴 + 리모콘
- 다크 4단계 surface, 한국 관습 시세색 (rise=빨강, fall=파랑)

우리 quant 의 비교 우위는 **AI 인사이트(패턴 매칭, pgvector 유사도, 평균 수익률 예측)**.
우리 약점은 **호가/체결/매매주체/뉴스/시총·PE 등 데이터 풍부도**.

전부를 한 사이클에 끝낼 수 없으므로 **다단계 Phase 분할**과 **이번 ADR 의 결정 범위 한정**이 필요하다.

---

## Decision

이 ADR 은 **Foundation 3 phase (UI 인터랙션 + 정보 위계 + 실시간 시세)** 의 핵심 결정만 잠근다. 호가/매매주체/뉴스/발견 화면은 후속 spec/ADR 으로 분리.

### D1. 차트 라이브러리: **lightweight-charts v5+ 를 메인 엔진**으로 통합

- 현재 quant-fe 는 lightweight-charts 4.2.3 사용 중. **v5+ 가 multi-pane 정통 지원** (5.0 release: "Multi-Pane Support — One of our most requested features"). v4.2 는 multi-chart sync 흉내만 가능.
- v5 의 **panes API** 사용해 가격/거래량/RSI/MACD 를 **단일 chart + 별도 pane** 으로 분리. `chart.addSeries(SeriesType, options, paneIndex)` 시그니처 + `chart.addPane()`/`panes()`/`swapPanes()`/`removePane()`.
- v4 → v5 breaking changes:
  - `addCandlestickSeries(...)` → `addSeries(CandlestickSeries, ...)` (Series type 별도 import)
  - `addLineSeries / addHistogramSeries / addAreaSeries` 동일 통합
  - `series.setMarkers([...])` → `createSeriesMarkers(series, [...])` primitive 분리
- 패턴 overlay 는 lightweight-charts 의 `subscribeCrosshairMove` + `priceToCoordinate`/`timeToCoordinate` 좌표 변환 + Canvas overlay layer 로 합성. 기존 패턴 매칭 로직 (`patternMatcher.ts`) 보존.
- TradingView Advanced Charts (토스 사용) 는 라이선스 비용 부담 + iframe 통합 비용으로 보류.

**TG-2 진행 전략 — Plan C (단계적)**:
- 2-A: v5 업그레이드 (3 파일 series API rename + setMarkers primitive) — 기존 동작 유지
- 2-B: `ChartCore` 추출 + `OhlcvCandleChart` 위임
- 2-C: `PatternChart` 의 7 sub-panel 을 단일 chart + panes 로 통합
- 2-D: `lib/indicators.ts` paneIndex 메타 + 회귀 테스트

### D2. 색상 토큰 분리: `--ko-quote-*` (시세) vs `--ko-status-*` (P/L)

| 토큰 | 의미 | 사용처 |
|---|---|---|
| `--ko-quote-rise` (빨강) / `--ko-quote-fall` (파랑) | 한국 시세 관습 | 캔들 색, 가격 변동률, microcontext 칩 |
| `--ko-status-profit` (초록) / `--ko-status-loss` (빨강) | 수익/손실 의미 | 백테스트 PnL, 페이퍼/실매매 성과, 전략 평가 |

- 신규 토큰을 root `DESIGN.md` 에 등록 + `docs/standards/design-md.md` 표준 갱신.
- 기존 `ChartsPage` 가 `priceSummary` 에 `--ko-status-profit/loss` 를 잘못 사용 → `--ko-quote-rise/fall` 로 마이그레이션.

### D3. 정보 아키텍처 (5-tab 시스템)

`/quant/charts` 의 정보 탭을 **차트·정보 / 종목정보 / AI 인사이트 / 뉴스 / 매매주체** 5-tab 으로 재편.

- **탭 1: 차트·정보** (default) — 차트 + microcontext + 보조차트 sub-pane
- **탭 2: 종목정보** — 시총/거래대금/52주범위/거래량/PE/배당 (Phase 1 은 yfinance fundamentals 가능 항목만)
- **탭 3: AI 인사이트** — 기존 `prediction` + `similarity` + `patterns` 통합. **헤더 sticky AI 요약 카드** + 상세 카드 그리드.
- **탭 4: 뉴스·공시** — placeholder (Phase 후속)
- **탭 5: 매매주체** — placeholder (Phase 후속, FDR_KR/KRX 추가 ingest 필요)

토스 우측 5패널 드래그 정렬 시스템은 **채택하지 않음**. 단순 탭 + 데스크톱 우측 sticky AI 카드로 대체. 사용자 정의 패널 정렬은 비용 대비 효용 낮음.

### D4. Sticky 종목 헤더 — 토스 패턴 채택

- Sticky: 종목명+코드 + **큰 가격(헤어라인 sticky 시 축소)** + 변동률 + 변동금액
- Microcontext 가로 스크롤 칩: `1일 범위 / 52주 범위 / 거래대금 / 거래량 / 시가총액 / RSI / 변동성(ATR)` 7개 (Phase 1 은 yfinance daily 로 충분)
- 종목명 클릭 → 종목 검색 sheet (모바일) / dialog (데스크톱)

### D5. 시간프레임: `1분 / 5분 / 30분 / 일 / 주 / 월 / 년` 7개

- 현재 ingest 는 daily 가 주력. **분봉은 Phase 3 실시간 ingest 와 함께 도입**.
- Phase 1 은 일/주/월/년 4개 즉시 활성화. 분봉 칩은 비활성(disabled) 상태로 노출 → Phase 3 활성화 예정.

### D6. 차트 도구바: 차트모양 / 보조지표 / 그리기 / 종목비교 / 크게보기

- **차트모양**: candle / line / area (기존) + heikin-ashi (신규)
- **보조지표**: 기존 `IndicatorToggle` 을 도구바 popover 로 재배치. RSI/MACD 는 D1 의 sub-pane 으로 자동 분리.
- **그리기**: Phase 2 (가로선/추세선/측정도구) — Phase 1 은 placeholder 비활성
- **종목비교**: 다른 종목 overlay 비교 — Phase 2 도입
- **차트 크게보기**: fullscreen 토글 (브라우저 fullscreen API)

### D7. 실시간 시세 SSE — quant 백엔드 신규 엔드포인트

- 신규: `GET /api/v1/charts/stream/{asset}/{market}` (SSE)
- 백엔드: yfinance (해외) / FDR_KR (국내) / 빗썸 (CRYPTO Phase 2 ADR-0036) 의 polling fan-out → Redis pubsub → SSE relay
- 폴링 주기: 1m (yfinance / FDR), 1s (빗썸 ws available)
- FE: `usePriceStream` 훅 (Phase 2 `usePaperStream` 패턴 차용) + 가격 flash 애니메이션 (CSS keyframe transient)
- 인증: 익명 시세는 OK (gateway 의 차트 API 는 anonymous 허용 정책 — 기존)

### D8. 발견·트렌딩 화면 — 후속 spec

이 사이클에서 **제외**. 별도 spec `docs/specs/{date}-quant-discover/` 으로 분리.

### D9. 호가/체결/매매주체 — 후속 ADR

데이터 ingest 가 큰 부분이라 별도 ADR 필수.
- 호가/체결: 빗썸 ws 직접 ingest (CRYPTO 한정 Phase 2 ADR-0036 확장) + 국내·해외는 mock 또는 미지원 명시
- 매매주체: KRX 또는 FDR 보강 ingest

---

## Phase Roadmap

| Phase | 범위 | 종속성 | 예상 분량 |
|---|---|---|---|
| **P1: Foundation** ✅ | D1 차트엔진 통합 (TG-1~2-D), D2 토큰, D3 5-tab (TG-5), D4 sticky 헤더+microcontext (TG-3), D5 시간프레임(daily) + D6 도구바 (TG-4), SymbolPicker (TG-6), AI 사이드 카드 (TG-7), vitest 인프라 (TG-8) — **8 commits, 2026-05-09 완료** | none | 1일 |
| **P2: Info & AI** | 종목정보 탭(yfinance fundamentals fetch), AI 인사이트 통합 카드, 그리기·종목비교 | P1 | ~1.5주 |
| **P3: Realtime** | D7 SSE backend + `usePriceStream` + price flash + 분봉 시간프레임 활성화 | P1 + 백엔드 SSE | ~1.5주 |
| **(P4) Discover** | 발견·트렌딩 화면 | 별도 ADR/spec | (분리) |
| **(P5) Orderbook** | 호가/체결/매매주체 | 별도 ADR/spec | (분리) |

이 ADR 은 P1~P3 만 잠근다. P4/P5 는 후속 ADR 에서 결정.

---

## Consequences

### Positive
- lightweight-charts 단일 엔진 통합으로 코드/번들 일관성. panes API 로 보조차트 정통.
- 색상 토큰 의미 분리 — 시세와 손익이 시각적으로 분명하게 구분됨.
- Sticky 헤더 + microcontext + AI 카드로 정보 위계가 토스 수준에 근접.
- SSE 인프라가 paper trading (Phase 2) 와 일관 — 재사용 가능.
- AI 인사이트(패턴/유사/예측) 가 차별 카드로 위계 격상.

### Negative / Risks
- lightweight-charts panes API 는 4.2+ 필요 — 의존성 업그레이드 + 회귀 테스트.
- 패턴 overlay 를 lightweight-charts 좌표계와 합성하는 작업 비용 발생.
- 분봉 데이터는 P3 까지 미지원 — 토스 스타일 도구바를 만들면서 일부 시간프레임이 비활성으로 노출됨.
- 호가/매매주체/뉴스 가 "토스급" 의 큰 부분이지만 이 사이클에서 제외 → 사용자 기대치 관리 필요.
- TradingView Advanced 미채택으로 그리기 도구·지표 종류는 토스 대비 적음.

### Neutral
- 우측 드래그 정렬 패널 시스템 미채택 — 단순한 탭 시스템이 우리 콘텐츠 양에 더 적합.

---

## Alternatives Considered

| 대안 | 사유 (기각) |
|---|---|
| TradingView Advanced Charts iframe | 라이선스 비용 + 디자인 토큰/색상 통제 어려움 + 자체 인터랙션 한계 |
| Highcharts Stock | 상용 라이선스 비용 |
| 자체 SVG 풀 인터랙션 구현 | 작성/유지 비용 큼, lightweight-charts 가 이미 충분 |
| 단일 ADR 로 P1~P5 전부 잠금 | 호가/매매주체 ingest 가 별도 ADR 격 결정 |
| 우측 드래그 정렬 패널 채택 | 콘텐츠 양 부족, 복잡도 대비 효용 낮음 |

---

## Validation

- P1 출고 시: lightweight-charts 4.2+ panes 동작, 색상 토큰이 `DESIGN.md` 등록 + 모든 ChartsPage 코드 마이그레이션, sticky 헤더 + microcontext + 5-tab 출고
- P2 출고 시: yfinance fundamentals 종목정보 탭, AI 카드 통합
- P3 출고 시: SSE 엔드포인트 latency p99 < 1.5s (분봉), 가격 flash 60fps, 분봉 시간프레임 활성

---

## Open Questions

- OQ-Q01: lightweight-charts panes API 는 4.2 부터인데 현재 의존성 버전 확인 + 필요 시 업그레이드
- OQ-Q02: 분봉 ingest 는 P3 의 SSE 와 동시에 도입할 것인가, 아니면 분봉만 별도 ingest job 분리?
- OQ-Q03: 그리기 도구를 P2 가 아니라 P3 로 미루는 게 ROI 더 좋지 않은가?
- OQ-Q04: `usePriceStream` 인증 — 익명 OK 인지 운영자 최종 확인 (기존 차트 API 가 anonymous 라 일치 가정)
