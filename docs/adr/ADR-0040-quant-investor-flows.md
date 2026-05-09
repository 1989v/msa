# ADR-0040 — Quant 매매주체 동향 (외국인/기관/개인)

- **Status**: Proposed (별도 spec / 후속 사이클 진행)
- **Date**: 2026-05-09
- **Deciders**: 운영자
- **Related**: ADR-0038 (차트 페이지 토스급 Foundation), ADR-0034 (Python ingest sidecar)

---

## Context

토스 종목 상세의 우측 "개인·외국인·기관" 패널은 KR 주식의 핵심 데이터 — 외국인 순매수/매도 + 기관 매매 동향 + 일별 누적. P1 Foundation 에서 ChartsPage 의 'flows' 탭은 disabled placeholder.

데이터 source:
- **KRX 공식 데이터**: 일별 매매주체 통계 — 무료 공개 (장 마감 후 익일 09시 갱신)
- **FDR (FinanceDataReader)**: KRX 데이터 wrapper, Python sidecar 가 이미 사용 중 (ADR-0034)
- **NaverPay / 토스**: 비공식 API (라이선스 위험)

Python sidecar 의 FDR ingest 가 OHLCV 만 가져옴 → 매매주체 ingest 는 별도 작업.

---

## Decision

### D1. Python sidecar 확장 (`quant/ingest/`)
- 기존 OHLCV ingest 와 동일 모듈에 매매주체 ingest 추가
- FDR `StockListing` + `StockInvestorTrend` (또는 KRX 직접 API) 호출
- 일 단위 batch (장 마감 후 1회, KST 18:00 cron)

### D2. ClickHouse 저장 (별도 테이블)
```sql
CREATE TABLE quant.investor_flows (
  trade_date Date,
  asset_code String,
  market_code String,
  individual_net Int64,    -- 개인 순매수 (주, +/-)
  foreign_net Int64,       -- 외국인 순매수
  institution_net Int64,   -- 기관 순매수
  ingested_at DateTime
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(trade_date)
ORDER BY (asset_code, market_code, trade_date)
```

### D3. 백엔드
- `application/port/persistence/InvestorFlowsPort.kt` — query(asset, market, from, to)
- `application/chart/InvestorFlowsQuery.kt`
- `infrastructure/persistence/clickhouse/ClickHouseInvestorFlowsAdapter.kt`
- `presentation/controller/ChartController.kt` 에 `GET /api/v1/charts/investor-flows` 추가

### D4. FE
- `charting/components/InvestorFlowsPanel.tsx` 신규
  - 카드 3종: 개인/외국인/기관 순매수 (오늘 vs 전일)
  - 일별 표 (최근 7일 또는 14일)
  - 누적 차트 (옵션)
- ChartsPage 의 'flows' 탭 disabled 해제 → 활성

### D5. CRYPTO / STOCK_US 미지원
- KR 주식 전용. 다른 자산 클래스는 placeholder.

---

## Consequences

### Positive
- 토스급 정보 패널 — KR 주식 사용자에게 핵심 가치
- ClickHouse 시계열 활용 (시장 일별 데이터에 적합)
- Python sidecar 재사용

### Negative / Risks
- FDR 의 KRX wrapper 안정성 (라이브러리 갱신 의존)
- 장 마감 후 18시 ingest 실패 시 다음 날 데이터 누락 가능 → fallback 정책 필요
- 종목 매핑 (FDR ticker vs 우리 asset_code) 에 edge case
- 데이터 라이선스 — KRX 의 매매주체 통계는 무료지만 재배포는 제약 가능 (조사 필요)

---

## Phase

| Phase | 범위 |
|---|---|
| PA | ingest sidecar 확장 + ClickHouse 테이블 + 백엔드 endpoint |
| PB | FE InvestorFlowsPanel + 'flows' 탭 활성 |
| PC (옵션) | ETF 종목 별도 처리 (외국인/기관 의미 다름) |

---

## Open Questions

- OQ-IF-01: 데이터 라이선스 (KRX 재배포 약관 조사)
- OQ-IF-02: ingest 실패 시 SLO + alerting
- OQ-IF-03: 누적 차트 UX — 일별 bar vs 누적 line
