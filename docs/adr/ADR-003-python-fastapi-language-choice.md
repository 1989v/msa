# ADR-003 Python/FastAPI 언어 선택 (기존 Kotlin MSA와 별도)

## Status
Accepted

## Context

기존 MSA 서비스(Product, Order, Search)는 Kotlin + Spring Boot로 구현되어 있다.
Charting 서비스는 데이터 과학적 연산(OHLCV 피처 추출, 32-dim 임베딩, 통계 분석)이 핵심이다.

### 핵심 기술 요구사항

1. **수치 연산**: 슬라이딩 윈도우, 정규화, RSI/MACD, 선형회귀 기울기, 최대 드로우다운
2. **벡터 임베딩**: 32-dim float 배열 생성, pgvector 연동
3. **외부 데이터**: yfinance, FinanceDataReader 라이브러리 필요
4. **스케줄러**: 일일 배치 수집 (APScheduler)
5. **비동기 API**: 유사도 검색 응답 속도 최적화

## Decision

**Python 3.11 + FastAPI를 사용한다.**

- **런타임**: Python 3.11
- **웹 프레임워크**: FastAPI (Pydantic v2 내장)
- **ORM**: SQLAlchemy 2.x (async 지원)
- **DB 드라이버**: psycopg[binary] + pgvector Python 클라이언트
- **수치 연산**: numpy, pandas, scipy
- **데이터 수집**: yfinance, FinanceDataReader
- **스케줄러**: APScheduler 3.x
- **마이그레이션**: Alembic
- **로깅**: structlog

## Alternatives Considered

### Kotlin + Spring Boot (기존 스택 유지)
- **기각 이유:**
  - yfinance, FinanceDataReader는 Python 생태계 전용 (JVM 동등 라이브러리 없음)
  - Kotlin에서 numpy/scipy 수준의 수치 연산 라이브러리 부재
  - DL4J 등 JVM 수치 라이브러리는 과중하고 기능 제한적
  - pandas DataFrame 기반 슬라이딩 윈도우 처리는 Python이 압도적으로 간결

### Kotlin + Python 혼합 (마이크로서비스 내 혼용)
- **기각 이유:**
  - 단일 서비스 내 언어 혼용은 빌드/배포 복잡도를 급격히 증가시킴
  - MSA에서 서비스 단위로 언어가 다른 것은 표준 패턴 (Polyglot Microservices)

### Go
- **기각 이유:**
  - yfinance, FinanceDataReader Go 포팅 없음
  - 수치 연산 생태계 미성숙

## Consequences

### Positive
- yfinance, FinanceDataReader, numpy, scipy, pandas 생태계 그대로 활용
- FastAPI의 자동 OpenAPI 문서 생성
- Pydantic v2로 DTO 검증 통합
- Python 데이터 과학 커뮤니티 생태계 최대 활용

### Negative
- 기존 Kotlin 팀이 Python 코드 리뷰/유지보수 시 학습 비용
- JVM GC 튜닝 대신 Python 메모리 관리 고려 필요
- Kotlin MSA와 다른 빌드 시스템 (pyproject.toml vs Gradle)

### Neutral
- MSA 아키텍처에서 Polyglot 언어 선택은 일반적 패턴
- Docker 컨테이너로 언어 경계 격리
- 서비스 간 통신은 HTTP API로 언어 독립적
