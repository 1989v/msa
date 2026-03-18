# Charting Service

## Overview

주식 차트 패턴 유사도 분석 및 수익률 예측 서비스.
커머스 도메인과 독립적으로 운영된다 (ADR-001).

## Tech Stack

커머스 서비스(Kotlin/Spring Boot)와 다른 기술 스택을 사용한다 (ADR-003).

- **Backend**: Python 3.11 + FastAPI
- **Database**: PostgreSQL + pgvector (port 5433, ADR-002)
- **Data Source**: Yahoo Finance / FinanceDataReader (ADR-004)
- **Frontend**: React 18 + lightweight-charts (port 3010)

## Directory Structure

```
charting/
├── src/              ← FastAPI 백엔드 소스
├── frontend/         ← React 프론트엔드
├── infra/            ← Docker/인프라 설정
├── tests/            ← 테스트
├── alembic/          ← DB 마이그레이션
├── docs/prd/         ← PRD 문서
├── pyproject.toml    ← Python 프로젝트 설정
└── seed_demo.py      ← 데모 데이터 시드
```

## Core Domain

- **OHLCV 데이터 수집**: APScheduler를 통한 일일 수집
- **패턴 생성**: 60-day 슬라이딩 윈도우 기반 패턴, 32-dim 벡터 임베딩
- **유사 패턴 검색**: pgvector 코사인 유사도 기반 top-20 검색
- **수익률 예측**: ForecastPolicy (+5d/+20d/+60d 통계)

## Data Ownership

- PostgreSQL + pgvector DB 완전 소유 (port 5433)
- tables: `symbols`, `ohlcv_bars`, `patterns`
- 커머스 DB(MySQL)와 완전 분리

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/similarity` | 유사 패턴 검색 + 예측 통계 |
| GET | `/api/v1/symbols` | 추적 종목 목록 |
| POST | `/api/v1/symbols` | 종목 등록 |
| GET | `/api/v1/{ticker}/ohlcv` | OHLCV 데이터 조회 |

## Constraints

- 커머스 DB (Product/Order) 접근 금지
- Kafka 이벤트 발행/구독 없음 (독립 도메인)
- 실시간 시세 제공 없음 (일별 데이터만)

## Related ADRs

- ADR-001: Charting Service Introduction
- ADR-002: pgvector over Elasticsearch
- ADR-003: Python/FastAPI Language Choice
- ADR-004: Yahoo Finance Data Source
