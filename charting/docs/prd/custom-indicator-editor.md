# PRD: Custom Indicator Editor (Level 3)

**Status**: TODO
**Date**: 2026-03-20

## 개요

TradingView Pine Script와 유사하게, 사용자가 직접 수식을 작성하여 보조지표를 생성/저장/관리할 수 있는 기능.

## 목표

- 사용자가 수식 기반으로 커스텀 보조지표를 정의
- 정의한 지표를 차트에 오버레이 또는 서브패널로 표시
- 지표를 저장/불러오기/공유 가능

## 핵심 기능

### 1. 수식 에디터 UI

- 코드 에디터 (Monaco Editor 또는 CodeMirror)
- 자동 완성: 내장 함수 (sma, ema, rsi, stdev, max, min 등)
- 실시간 미리보기: 수식 입력 즉시 차트에 반영
- 에러 표시: 잘못된 수식 하이라이트

### 2. 수식 언어 (DSL)

```
# 볼린저 밴드 커스텀
period = input(20, "기간")
mult = input(2.0, "표준편차 배수")
basis = sma(close, period)
upper = basis + mult * stdev(close, period)
lower = basis - mult * stdev(close, period)
plot(basis, "기준선", color=#3b82f6)
plot(upper, "상단", color=#06b6d4, style=dashed)
plot(lower, "하단", color=#06b6d4, style=dashed)
fill(upper, lower, color=#06b6d420)
```

### 내장 함수

| 함수 | 설명 |
|------|------|
| `sma(source, period)` | 단순 이동평균 |
| `ema(source, period)` | 지수 이동평균 |
| `stdev(source, period)` | 표준편차 |
| `rsi(source, period)` | RSI |
| `macd(source, fast, slow, signal)` | MACD |
| `atr(period)` | ATR |
| `highest(source, period)` | 기간 내 최고값 |
| `lowest(source, period)` | 기간 내 최저값 |
| `crossover(a, b)` | a가 b를 상향 돌파 |
| `crossunder(a, b)` | a가 b를 하향 돌파 |

### 내장 변수

`open`, `high`, `low`, `close`, `volume`, `bar_index`

### 3. 저장/관리

- 사용자별 커스텀 지표 목록 (DB 저장)
- 이름, 설명, 수식, 표시 설정 (색상, 라인 스타일, 서브패널 여부)
- 가져오기/내보내기 (JSON)

### 4. 렌더링

- `plot()` → 라인 시리즈
- `fill()` → 영역 채우기
- `hline()` → 수평선
- `plotshape()` → 마커
- 서브패널 자동 분리: `overlay=false` 시 별도 패널

## 기술 구현 방향

### 프론트엔드

- **파서**: mathjs 기반 expression evaluator + 커스텀 함수 등록
- 또는 PEG.js로 경량 DSL 파서 구현
- **에디터**: Monaco Editor (VS Code 엔진, 자동완성/하이라이트 지원)
- **렌더링**: 파싱 결과 → lightweight-charts series 동적 생성

### 백엔드

- `custom_indicators` 테이블: id, user_id, name, description, formula, settings, created_at
- CRUD API: `/api/v1/indicators`

## DB 스키마

```sql
CREATE TABLE custom_indicators (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    formula TEXT NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 예상 공수

- DSL 파서 + 내장 함수: 1주
- 수식 에디터 UI (Monaco): 3일
- 실시간 미리보기 연동: 2일
- 저장/관리 API + DB: 2일
- 테스트 + 에지 케이스: 2일
- **총: 약 2.5-3주**

## 참고

- TradingView Pine Script Reference: https://www.tradingview.com/pine-script-reference/
- mathjs: https://mathjs.org/
- Monaco Editor: https://microsoft.github.io/monaco-editor/
