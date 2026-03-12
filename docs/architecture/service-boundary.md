# Service Boundary

## 1. Gateway

### Responsibility
- 인증/인가
- 라우팅
- 요청 검증
- 외부 요청 표준화

### Does NOT
- 비즈니스 로직 수행 금지
- DB 접근 금지

---

## 2. Product Service

### Responsibility
- 상품 CRUD
- 상품 상태 관리
- 상품 도메인 규칙

### Data Ownership
- product DB 완전 소유

---

## 3. Order Service

### Responsibility
- 주문 생성
- 주문 상태 전이
- 결제 연계 (외부 API)

### Data Ownership
- order DB 완전 소유

---

## 4. Search Service

### Responsibility
- 검색 API 제공
- Elasticsearch 인덱스 관리
- Kafka 이벤트 기반 색인

### Data Ownership
- Elasticsearch 인덱스 소유
- RDBMS 미사용 (또는 최소화)

---

## 5. Charting Service

### Responsibility
- 주식 OHLCV 데이터 수집 및 저장 (Yahoo Finance / FinanceDataReader)
- 60-day 슬라이딩 윈도우 기반 패턴 생성 및 32-dim 벡터 임베딩
- pgvector 코사인 유사도 기반 유사 패턴 검색 (top-20)
- 미래 수익률(+5d/+20d/+60d) 통계 예측 (ForecastPolicy)
- React 차트 시각화 프론트엔드 제공

### Data Ownership
- PostgreSQL + pgvector DB 완전 소유 (port 5433)
- symbols, ohlcv_bars, patterns 테이블
- 커머스 DB(MySQL)와 완전 분리

### Tech Stack
- Python 3.11 + FastAPI (ADR-003)
- pgvector/pgvector:pg16 (ADR-002)
- yfinance + FinanceDataReader (ADR-004)
- React 18 + Recharts (Frontend, port 3010)

### API Endpoints
- POST /api/v1/similarity — 유사 패턴 검색 + 예측 통계
- GET  /api/v1/symbols — 추적 종목 목록
- POST /api/v1/symbols — 종목 등록
- GET  /api/v1/{ticker}/ohlcv — OHLCV 데이터 조회

### Does NOT
- 커머스 DB(Product/Order) 접근 금지
- Kafka 이벤트 발행/구독 없음 (독립 도메인)
- 실시간 시세 제공 없음 (일별 데이터만)

---

## 6. Data Ownership Rule

- 서비스 간 DB 공유 금지
- 데이터 변경은 이벤트 기반으로 전파
- 직접 조회가 필요한 경우 API 호출