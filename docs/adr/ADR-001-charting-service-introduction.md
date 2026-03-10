# ADR-001 Charting 서비스 MSA 신규 도입

## Status
Accepted

## Context

기존 MSA 커머스 플랫폼(Gateway, Product, Order, Search)은 상품/주문 중심 도메인을 다룬다.
주식 OHLCV 데이터 기반의 차트 패턴 유사도 분석 및 미래 수익률 예측 기능은 기존 서비스와 도메인이 완전히 분리된 신규 요구사항이다.

### 요구사항

- 주식 OHLCV 데이터를 60-day 슬라이딩 윈도우로 패턴화
- 32-차원 벡터로 임베딩하여 pgvector 코사인 유사도 검색
- 과거 유사 패턴 기반 미래 수익률(+5d/+20d/+60d) 통계 예측
- MVP 규모: ~125,000 패턴 (S&P 100 + KOSPI/KOSDAQ 50, 5년 히스토리)
- 서버 비용 최소화: CPU-only, 단일 서버

### 기존 서비스와의 관계

Charting 서비스는 커머스 도메인(상품/주문)과 독립적이며, 공유 데이터 없이 완전히 분리된 서비스로 운영된다.
기존 MSA 서비스와 직접 API 연동은 초기에 불필요하다.

## Decision

**charting 서비스를 MSA 신규 서비스로 추가한다.**

- 포트: 8010 (API), 5433 (PostgreSQL+pgvector), 3010 (Frontend)
- 독자적인 Docker Compose 구성으로 기존 서비스와 독립 배포
- Clean Architecture 준수: domain / application / adapter / presentation 계층 분리
- 데이터 소유권: charting-db (PostgreSQL + pgvector extension) 완전 소유

## Alternatives Considered

### 기존 서비스 확장
- **기각 이유:** 주식 분석 도메인은 커머스 도메인과 무관. 기존 서비스에 추가 시 단일 책임 원칙 위반, 불필요한 결합 발생.

### 외부 SaaS 활용
- **기각 이유:** 커스텀 임베딩 로직(32-dim) 및 유사도 검색 파이프라인 제어 필요. 비용 및 벤더 종속 문제.

## Consequences

### Positive
- 도메인 분리로 독립 배포/확장 가능
- 기존 서비스에 영향 없이 신규 기능 추가
- Charting 특화 스택 선택 자유도 확보

### Negative
- 운영 서비스 수 증가 (인프라 복잡도 소폭 증가)
- 추가 PostgreSQL 인스턴스 관리 필요

### Neutral
- 기존 Kotlin 서비스와 다른 언어 스택 사용 (별도 ADR에서 결정)
