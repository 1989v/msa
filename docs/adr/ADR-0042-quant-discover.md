# ADR-0042 — Quant 발견·트렌딩 화면 (`/quant/discover`)

- **Status**: Proposed (별도 spec / 후속 사이클 진행)
- **Date**: 2026-05-09
- **Deciders**: 운영자
- **Related**: ADR-0038 (차트 페이지 토스급 Foundation), ADR-0033 (Quant 통합 플랫폼)

---

## Context

토스 홈 화면 (`/`) 은 종목 발견 — 거래대금 상위 / 거래량 / 급상승 / 급하락 / 카테고리. P1 Foundation 의 ChartsPage 는 종목 검색만 (`/` 단축키 + SymbolPickerSheet). 토스급 발견 화면이 별도 라우트로 필요.

quant-fe 의 기존 `/quant/strategies` (전략 리스트), `/quant/charts` (차트), `/quant/learn` (지표 학습) 외에 `/quant/discover` 신설.

데이터 source:
- **거래대금/거래량**: 우리 ClickHouse OHLCV 에서 일별 집계 가능 (이미 데이터 있음)
- **급상승/급하락**: OHLCV close vs 전일 close
- **카테고리**: 자산 카탈로그 (`asset_catalog` 테이블 — 최근 commit 818e108 에서 도입됨)
- **트렌딩**: 검색 빈도 (PostHog event 또는 DB count) — 후속

---

## Decision

### D1. 새 라우트 `/quant/discover`
- AppShell width="full"
- 메인: 종목 리스트 (거래대금 상위 default) + 미니 sparkline
- 좌측 (lg 이상): 카테고리 필터 (코인 / 국내주식 / 미국주식 / ETF)
- 우측 (lg 이상): "지금 뜨는" 트렌딩 / 글로벌 지수 마퀴

### D2. 백엔드 신규 endpoint
```
GET /api/v1/discover/top-volume?market=...&limit=20
GET /api/v1/discover/top-gainers?market=...&limit=20
GET /api/v1/discover/top-losers?market=...&limit=20
GET /api/v1/discover/categories  // 자산 카탈로그 카테고리 트리
```

- ClickHouse 일별 집계 — `quant.discover_daily_ranking` materialized view 도입
- 캐시 TTL 5분 (장중)

### D3. FE 컴포넌트
- `pages/DiscoverPage.tsx` 신규
- `discover/components/RankingList.tsx` — 종목 행 (logo / name / price / 변동률 / mini sparkline)
- `discover/components/CategorySidebar.tsx`
- `discover/components/TrendingPanel.tsx` (lg 우측)
- `discover/components/IndicesMarquee.tsx` — 8개 글로벌 지수 무한 스크롤 (KOSPI/KOSDAQ/달러환율/나스닥/S&P500/필반/VIX/달러인덱스)

### D4. 글로벌 지수 마퀴 — 별도 ingest 필요
- 8개 지수 데이터 가져오는 source: yfinance (^KS11=KOSPI, ^KQ11=KOSDAQ, KRW=X=달러환율, ^IXIC=NASDAQ, ^GSPC=S&P500, ^SOX=필반, ^VIX, DX-Y.NYB=달러인덱스)
- Python sidecar 가 일별 ingest 추가
- 백엔드 `GET /api/v1/discover/global-indices` (5분 캐시)

### D5. 검색 빈도 트렌딩
- PostHog event `charts_symbol_view` 카운트 (이미 일부 적재) → 시간대별 ranking
- 또는 자체 redis counter

---

## Consequences

### Positive
- 종목 발견 유입 경로 — 사용자가 종목 검색 외 진입점 확장
- ClickHouse 데이터 활용 — 신규 ingest 최소 (글로벌 지수 8종만)
- 자산 카탈로그 (818e108) 와 시너지

### Negative / Risks
- 거래대금 ranking 은 KR/US 시장 별로 의미 다름 (USD/KRW 단위 차이)
- 모바일에서 다단 ranking 의 정보 위계 디자인 어려움 (토스도 가로 스크롤 사용)
- 검색 빈도 트렌딩은 사용자 표본 적을 때 의미 약함 (운영 초기)

---

## Phase

| Phase | 범위 |
|---|---|
| PA | top-volume / top-gainers / top-losers + 백엔드 + FE RankingList + 카테고리 사이드바 |
| PB | 글로벌 지수 마퀴 + ingest 8종 |
| PC (옵션) | PostHog 트렌딩 + redis counter |
| PD | 검색 결과 페이지 향상 (현재 SymbolPickerSheet 와 별개) |

---

## Open Questions

- OQ-DC-01: 거래대금 ranking 통화 통일 (USD 환산 vs KRW 환산 vs 시장 분리)
- OQ-DC-02: 모바일 ranking 페이지의 UX (토스는 가로 스크롤 sticky 헤더)
- OQ-DC-03: 발견 화면이 portal-fe 의 root catch-all (`/`) 와 어떻게 공존? portal-fe 는 코드 사전 + 포트폴리오 통합 SPA, quant-fe 는 트레이딩 전용. 발견 화면은 quant-fe 안 (`/quant/discover`) 이 자연스러움.
