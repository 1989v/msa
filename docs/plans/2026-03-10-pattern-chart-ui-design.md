# Pattern Chart UI — Design Document

**Date:** 2026-03-10
**Status:** Approved

---

## 1. Goal

차트 패턴 분석 서비스를 전문 트레이딩 터미널 수준으로 재구성한다.
핵심 기능: 종목 선택 → 실제 캔들 차트 + 유명 패턴 오버레이 + 미래 추세 예측 + 기술 지표 토글.

---

## 2. Technology

- **Chart Library:** `lightweight-charts` (TradingView OSS, 무료, ~100KB)
- **Framework:** React 18 + TypeScript (기존 유지)
- **지표 계산:** 클라이언트 사이드 순수 TypeScript (추가 API 없음)
- **패턴 매칭:** Pearson 상관계수, 클라이언트 사이드

---

## 3. Screen Layout

```
Header
Controls Row: [종목 검색] [US/KR] | [패턴 셀렉터 ▼ (매칭률%)] [신호 뱃지]
Indicator Toggles: [MA5] [MA20] [MA60] [BB] [VOL] [RSI] [MACD]
──────────────────────────────────────────────────────────────
Main Chart (Candlestick, Lightweight Charts)
  └─ 실제 캔들
  └─ MA5 / MA20 / MA60 선 (토글)
  └─ 볼린저밴드 상/하단 (토글)
  └─ 패턴 오버레이 — 주황 실선 (60일 매칭 구간)
  └─ 미래 추세 — 주황 점선 (향후 20일)
  └─ Today 수직선 + 미래 구간 음영
──────────────────────────────────────────────────────────────
Sub-charts (토글 ON 시 표시)
  └─ Volume 바 (기본 ON)
  └─ RSI(14) — 70/30 기준선 (기본 OFF)
  └─ MACD(12,26,9) — 선+시그널+히스토그램 (기본 OFF)
──────────────────────────────────────────────────────────────
Pattern Info Bar
  └─ 패턴 이름 | 매칭률 바 | 신호 | 한 줄 설명
  └─ 핵심 포인트 리스트
```

---

## 4. Pattern Library (10종)

| ID | 이름 | 신호 |
|----|------|------|
| `elliott_impulse` | Elliott Wave 5파동 | 중립 (조정 예상) |
| `head_shoulders` | Head & Shoulders | 하락 |
| `inverse_head_shoulders` | Inverse H&S | 상승 |
| `double_top` | Double Top | 하락 |
| `double_bottom` | Double Bottom | 상승 |
| `cup_handle` | Cup & Handle | 상승 |
| `ascending_triangle` | Ascending Triangle | 상승 |
| `descending_triangle` | Descending Triangle | 하락 |
| `bull_flag` | Bull Flag | 상승 |
| `bear_flag` | Bear Flag | 하락 |

각 패턴은 x∈[0,1], y∈[0,1] 정규화 커브 키포인트 + 미래 프로젝션 키포인트로 정의.

---

## 5. Pattern Matching Algorithm

1. 최근 60일 종가 추출
2. Min-max 정규화 → [0, 1]
3. 각 패턴 커브를 60포인트로 선형 보간
4. Pearson 상관계수 계산
5. 매칭 점수 = `(r + 1) / 2 × 100` (0~100%)
6. 점수 내림차순 정렬 → 최상위 패턴 자동 선택

---

## 6. Technical Indicators (클라이언트 계산)

| 지표 | 계산 | 기본값 |
|------|------|--------|
| MA5 / MA20 / MA60 | 단순이동평균 | MA5, MA20 ON |
| Bollinger Band | MA20 ± 2σ | OFF |
| Volume | OHLCV 원시 데이터 | ON |
| RSI(14) | Wilder's smoothing | OFF |
| MACD(12,26,9) | EMA차 + Signal + Histogram | OFF |

---

## 7. File Structure (변경 범위)

```
frontend/src/
├── lib/
│   ├── patterns.ts          # 10개 패턴 정의 (신규)
│   ├── patternMatcher.ts    # 보간 + Pearson 상관계수 (신규)
│   └── indicators.ts        # MA, BB, RSI, MACD 계산 (신규)
├── components/
│   ├── PatternChart.tsx     # Lightweight Charts 메인 차트 (신규)
│   ├── PatternSelector.tsx  # 패턴 드롭다운 + 매칭률 (신규)
│   ├── IndicatorToggle.tsx  # 지표 토글 버튼 그룹 (신규)
│   ├── PatternInfoBar.tsx   # 패턴 설명 패널 (신규)
│   └── SymbolSearch.tsx     # 기존 유지
├── App.tsx                  # 전체 레이아웃 재구성
└── api.ts                   # 기존 유지
```

삭제: `ChartOverlay.tsx`, `DateRangePicker.tsx`, `SimilarityResultList.tsx`, `ForecastSummary.tsx`

---

## 8. Data Flow

```
종목 선택
  → GET /api/v1/{ticker}/ohlcv (기존 엔드포인트)
  → 지표 계산 (client: MA, BB, RSI, MACD)
  → 패턴 매칭 (client: Pearson 상관계수 × 10패턴)
  → 최적 패턴 자동 선택
  → Lightweight Charts 렌더링
      ├─ CandlestickSeries (실제 가격)
      ├─ LineSeries (MA × 3, BB × 2, 패턴 오버레이, 미래 투영)
      └─ HistogramSeries (Volume, MACD histogram)
  → 패턴 변경시 오버레이/투영만 재계산 (즉시 반영)
```

---

## 9. Non-Goals

- 실시간 시세 (일별 데이터만)
- 백엔드 패턴 매칭 추가 (클라이언트 계산으로 충분)
- 로그인 / 포트폴리오 관리
