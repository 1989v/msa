<!-- source: quant -->
<!-- source: portal-fe -->
# Requirements — Quant Charts Toss-grade Upgrade

**Spec ID**: 2026-05-08-quant-charts-toss-grade
**Owner**: 운영자 (1989v)
**Status**: Draft
**Linked**: ADR-0038, `research/notes.md`, `research/design-tokens.md`

---

## 1. Goal

`/quant/charts` 종목 상세 페이지를 **토스증권 종목 상세(`/stocks/{code}/order`) 수준**의 정보 위계·인터랙션·실시간성으로 끌어올린다.
우리만의 차별점인 **AI 인사이트(패턴 매칭 / pgvector 유사도 / 평균 수익률 예측)** 를 격상시켜 단순 모방을 넘어선다.

## 2. Non-Goals (이 사이클)

- 호가창·체결 stream 시각화 (별도 ADR / 후속 spec)
- 매매주체(외국인/기관/개인) 데이터 (KRX/FDR 추가 ingest 필요)
- 뉴스·공시 피드 (별도 source)
- 발견·트렌딩 화면 (별도 spec)
- 커뮤니티 / 소셜 / 리모콘 사이드바
- TradingView Advanced Charts 채택 (라이선스 + 토큰 통제 한계)
- 실주문 UI (Phase 3 별도 진행 중)

## 3. Personas & User Stories

### P1 — 단타 투자자 "민지"
1주일 내 매매를 검토하며 차트를 본다.
- US-01: 종목명·가격·변동률을 즉시 파악 (sticky 헤더)
- US-02: 1일 / 52주 범위 / 거래대금 / 거래량 / 시가총액을 헤더 microcontext 로 한 눈에
- US-03: 일·주·월·년 시간프레임 1탭 전환
- US-04: 차트에서 crosshair 로 OHLC 즉시 확인
- US-05: RSI / MACD 가 별도 sub-pane 으로 분리되어 가독

### P2 — 중장기 투자자 "현우"
종목정보·재무·52주범위 중심.
- US-06: 종목정보 탭에서 시총·PE·배당 (Phase 2)
- US-07: 비교 차트(vs 코스피/SPY) 오버레이 (Phase 2)
- US-08: 52주 최고/최저 대비 현재가 위치를 microcontext 에서 시각

### P3 — Quant 사용자 "재호" (우리 차별 사용자)
백테스트·전략 + AI 인사이트를 활용.
- US-09: AI 인사이트 탭에서 패턴 매칭/유사도/예측을 통합 카드로 본다
- US-10: 종목 상세에서 "이 종목으로 전략 만들기" 진입점
- US-11: 차트 위 패턴 매칭 라인 overlay 토글

### P4 — 데이트레이더 "수아" (Phase 3)
실시간 가격 변화 모니터링.
- US-12: SSE 로 가격이 깜박이며 갱신 (price flash)
- US-13: 분봉 차트 (1분/5분/30분) — Phase 3

## 4. Acceptance Criteria (Phase별)

### Phase 1 — Foundation (이 사이클 핵심)

| ID | Criterion | Measure |
|---|---|---|
| AC-P1-01 | lightweight-charts 4.2+ 메인 차트 통합 | `OhlcvCandleChart` + `PatternChart` 가 단일 엔진 사용, 캔들/라인/영역/하이킨아시 4종 표시 |
| AC-P1-02 | RSI/MACD/거래량이 별도 sub-pane (panes API) | 메인 가격 panel + 보조 1~3 panel 동시 동기화, 시간축 일치 |
| AC-P1-03 | Sticky 종목 헤더 + 큰 가격 + 변동 + 변동률 | 스크롤 시 sticky, 색상은 `--ko-quote-rise/fall` |
| AC-P1-04 | Microcontext 가로 스크롤 칩 7개 | 1일범위 / 52주범위 / 거래대금 / 거래량 / 시총 / RSI / 변동성(ATR) — 각 칩 라벨+값+(있으면)미니 시각화 |
| AC-P1-05 | 시간프레임 7-칩 (분봉 4종 비활성) | 1분/5분/30분 = disabled 상태 노출, 일/주/월/년 = 활성 |
| AC-P1-06 | 차트 도구바 — 차트모양 / 보조지표 popover / 그리기(disabled) / 종목비교(disabled) / 크게보기 | 키보드 접근 가능, 모바일에선 도구바 가로 스크롤 |
| AC-P1-07 | 5-tab (차트·정보 / 종목정보 / AI 인사이트 / 뉴스(disabled) / 매매주체(disabled)) | 탭 전환 시 deep link `?tab=insight` 등 query param 보존 |
| AC-P1-08 | 신규 색상 토큰 `--ko-quote-rise/fall` 등록 + 모든 시세 색상 마이그레이션 | `DESIGN.md` + `docs/standards/design-md.md` 갱신, ChartsPage `priceSummary` 변경 |
| AC-P1-09 | 종목 검색 sheet/dialog (헤더 종목명 클릭) | 모바일 = bottom sheet, 데스크톱 = centered dialog, '/' 키 단축키 |
| AC-P1-10 | 모바일/데스크톱 레이아웃 분리 | 모바일 < md: 단일 column, sticky 헤더 + 풀폭 차트 + 하단 탭 / 데스크톱 ≥ md: 좌측 차트 + 우측 sticky AI 사이드 카드 |

### Phase 2 — Info & AI

| ID | Criterion |
|---|---|
| AC-P2-01 | 종목정보 탭 — yfinance fundamentals(시총/PE/배당/52주) 카드 |
| AC-P2-02 | AI 인사이트 통합 카드 — 패턴+유사+예측을 한 화면에 |
| AC-P2-03 | 그리기 도구 (가로선 / 추세선 / 측정도구) 활성화 |
| AC-P2-04 | 종목비교 overlay (다른 종목 1개 추가) |

### Phase 3 — Realtime

| ID | Criterion |
|---|---|
| AC-P3-01 | `GET /api/v1/charts/stream/{asset}/{market}` SSE 엔드포인트 |
| AC-P3-02 | `usePriceStream` 훅 — 자동 reconnect, last-id 복구 |
| AC-P3-03 | 가격 flash 애니메이션 (CSS keyframe, < 600ms) |
| AC-P3-04 | 분봉(1분/5분/30분) 시간프레임 활성화 |
| AC-P3-05 | 백엔드 SSE p99 latency < 1.5s |

## 5. Constraints

- **Clean Architecture**: 도메인 레이어 변경 없음. 신규 SSE 는 application port + infrastructure adapter 분리.
- **DESIGN.md 표준**: 모든 색상은 `--ko-*` 토큰 경유. hex 직접 입력 금지.
- **Latency Budget (ADR-0025)**: 차트 OHLCV API p99 ≤ 800ms (현 ≤ 600ms 유지). SSE first-byte p99 ≤ 1.5s.
- **반응형**: 모바일 우선, 데스크톱 ≥ 1024px 에서 우측 사이드 카드 활성.
- **a11y**: keyboard navigation (모든 도구바/탭 포커스 가능), ARIA labels, prefers-reduced-motion 시 flash 비활성.
- **Bundle**: 신규 의존성 추가 없음 (lightweight-charts 이미 사용 중).
- **API 응답 포맷**: `ApiResponse<T>` 유지.

## 6. Out of Scope (확인용)

- 실주문 UI (별도)
- 호가 시각화 / 체결 stream
- 매매주체 / 뉴스 / 커뮤니티
- 발견·트렌딩 화면
- 글로벌 지수 마퀴
- TradingView 임베드
