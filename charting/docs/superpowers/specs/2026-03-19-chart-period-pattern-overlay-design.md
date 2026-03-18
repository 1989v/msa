# Chart Period Selection & Smart Pattern Overlay

**Date**: 2026-03-19
**Status**: Approved
**Scope**: charting service (frontend + backend)

## Problem

1. 차트가 전체 일봉만 표시하며 기간별 봉 타입 전환이 불가능하다.
2. 패턴 오버레이가 항상 차트 마지막 60봉에 고정 표시되어, 실제 유사한 구간과 무관하게 배치된다.

## Requirements

### R1: 기간 선택 + 봉 타입 전환

| 버튼 | 데이터 범위 | 봉 타입 | 예상 봉 수 | 데이터 소스 |
|------|-----------|---------|-----------|------------|
| 1D | 당일 | 5분봉 | ~78 (US) / ~75 (KR) | 백엔드 분봉 API (신규) |
| 1W | 최근 1주 | 일봉 | ~5 | 기존 일봉 |
| 1M | 최근 1개월 | 일봉 | ~22 | 기존 일봉 |
| 3M | 최근 3개월 | 일봉 | ~60 | 기존 일봉 |
| 1Y | 최근 1년 | 주봉 | ~52 | 일봉 → 프론트 집계 |
| 5Y | 최근 5년 | 월봉 | ~60 | 일봉 → 프론트 집계 |

### R2: 스마트 패턴 오버레이

- 현재 화면의 봉 데이터에서 가장 유사한 구간에 자동 배치
- projection(예측선)이 차트 우측(미래)으로 연장
- 드래그로 수평 이동 가능 (봉 단위 스냅, 이동 중 유사도 점수 표시)
- 스케일 조정 가능 (가로 폭 늘리기/줄이기)

## Design

### 1. Backend: 분봉 데이터 수집

#### 1.1 DB 스키마 변경

`ohlcv_bars` 테이블에 `interval` 컬럼과 `bar_time` 컬럼 추가.

```sql
ALTER TABLE ohlcv_bars ADD COLUMN interval VARCHAR(5) NOT NULL DEFAULT '1d';
ALTER TABLE ohlcv_bars ADD COLUMN bar_time TIME NULL;

-- 기존 unique constraint 변경
-- 기존: (symbol_id, trade_date)
-- 변경: (symbol_id, trade_date, interval, bar_time)
```

- `interval`: `'1d'` (일봉) 또는 `'5m'` (5분봉)
- `bar_time`: 분봉일 때 시각 (예: `09:30:00`), 일봉은 `NULL`

#### 1.2 Domain Model 변경

`OhlcvBar`에 `interval`과 `bar_time` 필드 추가.

```python
@dataclass
class OhlcvBar:
    symbol_id: int
    trade_date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    interval: str = '1d'       # '1d' | '5m'
    bar_time: time | None = None
```

#### 1.3 Port 변경

`OhlcvRepositoryPort`에 interval 파라미터 추가:

```python
def find_by_symbol_and_date_range(
    self, symbol_id: int, start: date, end: date, interval: str = '1d'
) -> list[OhlcvBar]: ...
```

`MarketDataClientPort`에 분봉 fetch 메서드 추가:

```python
def fetch_intraday(self, ticker: str, interval: str = '5m') -> list[OhlcvBar]: ...
```

#### 1.4 UseCase: 분봉 수집

신규 `SyncIntradayUseCase`:

```
요청 (ticker, interval='5m')
  → TTL 체크 (마지막 분봉 시각 + 5분 > now?)
  → 만료 시: yfinance fetch (interval='5m', period='1d')
  → DB 저장 (upsert)
  → 응답: bars_count
```

yfinance 제한사항:
- `interval='5m'`은 최근 60일까지 조회 가능
- `interval='1m'`은 최근 7일까지
- 5분봉 선택 (데이터 양과 가용 기간의 균형)

#### 1.5 API 변경

```
GET /api/v1/{ticker}/ohlcv?interval=5m&start=2026-03-19
```

- `interval` 파라미터 추가 (기본값: `1d`)
- `5m` 요청 시 자동으로 TTL 기반 sync 수행 후 반환

#### 1.6 Alembic 마이그레이션

- `0002_add_intraday_support.py`
- `interval` 컬럼 추가, `bar_time` 컬럼 추가
- unique constraint 변경
- 기존 데이터에 `interval='1d'` 기본값 적용

### 2. Frontend: 기간 선택 UI

#### 2.1 PeriodSelector 컴포넌트

차트 상단에 버튼 그룹 배치:

```
[ 1D ] [ 1W ] [ 1M ] [ 3M ] [ 1Y ] [ 5Y ]
```

- 활성 버튼 강조 (배경색 변경)
- 기본 선택: `3M` (현재와 동일한 ~60 일봉)

#### 2.2 데이터 흐름

```
기간 변경
  ├─ 1D → fetchOhlcv(ticker, '5m') → 5분봉 데이터 직접 사용
  ├─ 1W/1M/3M → fetchOhlcv(ticker, '1d') → 날짜 필터링
  ├─ 1Y → fetchOhlcv(ticker, '1d') → aggregateWeekly()
  └─ 5Y → fetchOhlcv(ticker, '1d') → aggregateMonthly()
```

#### 2.3 집계 함수 (신규 lib/aggregation.ts)

```typescript
function aggregateWeekly(bars: OhlcvBar[]): OhlcvBar[]
function aggregateMonthly(bars: OhlcvBar[]): OhlcvBar[]
```

집계 규칙:
- Open: 기간 첫 봉의 Open
- Close: 기간 마지막 봉의 Close
- High: 기간 내 max(High)
- Low: 기간 내 min(Low)
- Volume: 기간 내 sum(Volume)
- trade_date: 기간 마지막 봉의 날짜

주봉 그루핑: ISO week 기준 (월~금)
월봉 그루핑: 같은 year-month

#### 2.4 API 타입 변경 (api.ts)

```typescript
function fetchOhlcv(ticker: string, interval?: '1d' | '5m'): Promise<OhlcvBar[]>
```

`OhlcvBar`에 `bar_time?: string` 필드 추가.

### 3. Frontend: 스마트 패턴 오버레이

#### 3.1 자동 배치 알고리즘

현재 화면의 봉 데이터에서 슬라이딩 윈도우 Pearson 상관계수 스캔:

```
입력: bars[] (현재 화면), pattern.curve[]
윈도우 크기: W = min(60, bars.length)

for offset = 0 to bars.length - W:
    window = bars[offset..offset+W].closes
    normalized = minMaxNormalize(window)
    interpolated = interpolatePattern(pattern.curve, W)
    score = pearsonCorr(normalized, interpolated)
    candidates.push({ offset, score })

bestMatch = candidates.sortBy(score).last()
```

- 최적 구간의 시작 offset에 패턴 오버레이 배치
- 패턴 끝에서 projection이 미래(우측)로 연장

#### 3.2 드래그 이동

lightweight-charts는 커스텀 드래그를 직접 지원하지 않으므로, 별도 인터랙션 레이어 구현:

**구현 방식**: 차트 위에 투명 overlay div + 마우스 이벤트

```
mousedown on pattern area → dragging = true, capture startX
mousemove → deltaX 계산 → 봉 단위 offset 변환 → 패턴 위치 업데이트
mouseup → dragging = false, 최종 위치 확정
```

- 봉 단위 스냅: `timeScale().coordinateToLogical(x)` 로 봉 인덱스 변환
- 이동 중 해당 위치의 유사도 점수를 툴팁으로 실시간 표시
- 패턴 오버레이 영역에 커서 변경 (`cursor: grab` → `cursor: grabbing`)

#### 3.3 스케일 조정

패턴 가로 폭(봉 수)을 조정하여 다른 기간과 비교:

**구현 방식**: 패턴 오버레이 위에서 마우스 휠 또는 양쪽 끝 핸들 드래그

```
wheel on pattern area → delta 계산 → 봉 수 ±1 조정
  → 패턴 curve를 새 봉 수에 맞게 리샘플링
  → 오버레이 재렌더링
```

- 기본: 60봉 (현재와 동일)
- 범위: 20~120봉
- 리샘플링: `interpolatePattern(pattern.curve, newWidth)` 기존 함수 재활용
- 스케일 변경 시 유사도 점수 재계산

#### 3.4 UI 피드백

- 패턴 오버레이 위 hover 시: 반투명 → 불투명 전환, 커서 변경
- 드래그 중: 유사도 점수 배지 표시 (예: `87.3%`)
- 스케일 조정 중: 현재 봉 수 표시 (예: `45 bars`)
- 자동 배치 리셋 버튼 (원래 최적 위치로 복귀)

### 4. State 관리 변경 (App.tsx)

```typescript
// 신규 state
const [period, setPeriod] = useState<Period>('3M')    // 기간 선택
const [patternOffset, setPatternOffset] = useState<number | null>(null)  // 드래그 offset (null=자동)
const [patternWidth, setPatternWidth] = useState(60)   // 스케일 (봉 수)

// 기간별 데이터 파생
const displayBars = useMemo(() => {
  switch (period) {
    case '1D': return intradayBars
    case '1W': return filterRecent(dailyBars, 7)
    case '1M': return filterRecent(dailyBars, 30)
    case '3M': return filterRecent(dailyBars, 90)
    case '1Y': return aggregateWeekly(filterRecent(dailyBars, 365))
    case '5Y': return aggregateMonthly(dailyBars)
  }
}, [period, dailyBars, intradayBars])
```

### 5. 파일 변경 목록

#### Backend (신규/변경)
| 파일 | 변경 |
|------|------|
| `src/domain/model/ohlcv.py` | `interval`, `bar_time` 필드 추가 |
| `src/domain/port/ohlcv_repository_port.py` | interval 파라미터 추가 |
| `src/domain/port/market_data_client_port.py` | `fetch_intraday()` 추가 |
| `src/application/usecase/sync_intraday_usecase.py` | **신규** — 분봉 TTL 동기화 |
| `src/application/usecase/get_symbol_ohlcv_usecase.py` | interval 파라미터 전달 |
| `src/adapter/client/yahoo_finance_client.py` | `fetch_intraday()` 구현 |
| `src/adapter/persistence/orm.py` | ORM 모델에 interval, bar_time 추가 |
| `src/adapter/persistence/ohlcv_repository.py` | interval 필터 쿼리 |
| `src/presentation/router/ohlcv_router.py` | `?interval=` 쿼리 파라미터 |
| `src/presentation/dto/ohlcv_dto.py` | bar_time 필드 추가 |
| `alembic/versions/0002_add_intraday_support.py` | **신규** — 마이그레이션 |

#### Frontend (신규/변경)
| 파일 | 변경 |
|------|------|
| `frontend/src/components/PeriodSelector.tsx` | **신규** — 기간 버튼 컴포넌트 |
| `frontend/src/lib/aggregation.ts` | **신규** — 주봉/월봉 집계 함수 |
| `frontend/src/components/PatternChart.tsx` | 패턴 오버레이 스마트 배치, 드래그, 스케일 |
| `frontend/src/lib/patternMatcher.ts` | 슬라이딩 윈도우 최적 위치 탐색 함수 추가 |
| `frontend/src/api.ts` | fetchOhlcv interval 파라미터, 타입 변경 |
| `frontend/src/App.tsx` | period state, displayBars 파생, PeriodSelector 연결 |

### 6. 테스트 계획

#### Backend
- `test_ohlcv_bar_interval`: interval/bar_time 필드 검증
- `test_sync_intraday_ttl`: TTL 만료 시만 fetch 확인
- `test_ohlcv_api_interval_param`: API interval 파라미터 동작

#### Frontend
- `aggregation.test.ts`: 주봉/월봉 집계 정확도
- `patternMatcher.test.ts`: 슬라이딩 윈도우 최적 위치 정확도

### 7. 제약 사항 및 리스크

| 항목 | 내용 | 대응 |
|------|------|------|
| yfinance 5분봉 제한 | 최근 60일까지만 과거 조회 가능 | 1D는 당일 데이터만 대상, 과거 분봉 미지원 |
| yfinance rate limit | 과도한 요청 시 일시 차단 가능 | TTL 5분으로 호출 빈도 제한 |
| 장외 시간 | 장 시작 전/후 분봉 없음 | 가장 최근 거래일 분봉 표시, 빈 상태 안내 메시지 |
| lightweight-charts 드래그 | 네이티브 드래그 미지원 | 투명 overlay div + 마우스 이벤트로 구현 |
| 패턴 스케일 UX | 너무 줄이면 패턴 왜곡 | 최소 20봉 제한 |
