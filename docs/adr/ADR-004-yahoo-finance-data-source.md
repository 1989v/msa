# ADR-004 외부 데이터 소스 — Yahoo Finance (yfinance) + FinanceDataReader

## Status
Accepted

## Context

Charting 서비스는 주식 OHLCV(Open/High/Low/Close/Volume) 히스토리 데이터를 외부에서 수집해야 한다.

### 데이터 요구사항

- **US 주식**: S&P 100 종목, 5년 히스토리
- **KR 주식**: KOSPI/KOSDAQ 50 종목, 5년 히스토리
- **일별 OHLCV**: 수정 주가(Adjusted Price) 포함
- **일일 업데이트**: 미국 장 마감 후(UTC 22:00), 한국 장 마감 후(UTC 09:00)
- **초기 일괄 수집**: ~5년 × (150 종목) × ~252 거래일 ≈ 190,000 레코드

### 제약사항

- 서버 비용 최소화: 무료 API 우선
- Rate limit 준수 필요 (유료 API 대비 제한적)
- 한국 주식 지원 필수 (KRX 데이터)

## Decision

**yfinance (US/글로벌) + FinanceDataReader (KR 보완)를 사용한다.**

### 수집 전략

| 종목 | 라이브러리 | 이유 |
|------|-----------|------|
| US (S&P 100) | yfinance | AAPL, MSFT 등 미국 주식 안정적 지원 |
| KR (KOSPI/KOSDAQ) | yfinance (005930.KS 형식) + FinanceDataReader 폴백 | yfinance KR 지원 불안정 시 FDR 대체 |

### 폴백 전략

```
yfinance.download(ticker) → 성공 시 사용
  └─ 실패/빈 데이터 → FinanceDataReader.DataReader(ticker, start, end)
```

### Rate Limit 대응

- 종목 간 0.5~1초 딜레이
- 일일 증분 수집으로 API 부하 최소화 (초기 1회 일괄 수집 후)
- 실패 시 다음 스케줄까지 재시도 (APScheduler)

## Alternatives Considered

### Alpha Vantage
- **기각 이유:** 무료 플랜 25 requests/day 제한 (150 종목 일일 업데이트 불가)

### Polygon.io
- **기각 이유:** 유료 플랜 필요 (서버 비용 최소화 원칙 위반)

### KRX 직접 크롤링
- **기각 이유:** HTML 파싱 취약성, 유지보수 비용 증가. FinanceDataReader가 KRX를 추상화하여 제공

### DART (금융감독원 API)
- **기각 이유:** 공시 데이터 위주, 일별 OHLCV 직접 제공 없음

## Consequences

### Positive
- yfinance: pip install로 즉시 사용, 글로벌 표준 주식 데이터 라이브러리
- FinanceDataReader: 한국 주식 데이터 안정적 지원 (KRX, KOSPI, KOSDAQ)
- 두 라이브러리 모두 무료, 오픈소스
- pandas DataFrame 반환으로 OHLCV 처리 일관성

### Negative
- **비공식 API**: Yahoo Finance 공식 API 아님, 정책 변경 시 수집 불가 위험
- Rate limit으로 대규모 초기 수집 시 시간 소요 (재시도 로직 필수)
- 수정 주가 계산 방식 차이 가능성 (분할/배당 조정)

### Risk Mitigation

- yfinance 의존성을 `MarketDataClientPort` 인터페이스 뒤에 숨겨 교체 가능하게 설계
- 어댑터 패턴으로 `YahooFinanceClient`와 `FinanceDataReaderClient`를 교체 가능하게 구현
- 향후 유료 API(Polygon.io, Tiingo) 전환 시 어댑터만 교체

### Neutral
- 일별 OHLCV 수집이므로 실시간 시세 불필요
- 주말/공휴일 수집 스킵은 거래일 캘린더로 처리
