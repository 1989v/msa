# ADR-0034: 통합 기술 스택 — Kotlin 단일 + Python ingest 사이드카

- **Status**: Accepted
- **Date**: 2026-05-04
- **Deciders**: kgd
- **Supersedes**: charting/docs/adr/ADR-003 (Python/FastAPI 선택)
- **Related**: ADR-0033, ADR-0035

## Context

ADR-0033 에서 quant + charting 의 full merge 를 결정했다. 두 서비스의 스택은 다르다:

| 영역 | quant | charting |
|---|---|---|
| 메인 언어 | Kotlin 2.2 / Spring Boot 4.0 | Python 3.11 / FastAPI |
| DB | MySQL + ClickHouse | PostgreSQL + pgvector |
| ML | 없음 (도메인 룰 기반) | numpy / pgvector cosine |
| 데이터 소스 | 빗썸 REST/WebSocket | yfinance + FinanceDataReader |

통합 시 단일 스택을 골라야 한다. 평가 항목:
- MSA 나머지 모듈 일관성 (common, gateway, order, search, member, ... 모두 Kotlin/Spring)
- 두 도메인 코드량/유지보수 부담
- ML/데이터 라이브러리 가용성

## Decision

**메인 서비스는 Kotlin/Spring 단일** + **OHLCV 데이터 ingest 만 Python 사이드카**로 분리한다.

### 메인 서비스 (Kotlin/Spring)

| charting 측 로직 | Kotlin 대체 |
|---|---|
| 60일 윈도우 임베딩 (numpy 32차원) | DJL 또는 multik 로 포팅 |
| pgvector cosine 검색 | JdbcTemplate + SQL `<=>` 연산자 (라이브러리 의존성 0) |
| 패턴 유사도 / 미래 수익률 예측 | 위와 동일 |
| 기술적 지표 (RSI/MACD/MA/BB) | **ta4j** (Java/Kotlin, 60+ 지표 내장) |

### Python ingest 사이드카

OHLCV 데이터 수집 라이브러리는 Python 한정이다:
- `yfinance` — Yahoo Finance 비공식, OSS quant 사실상 default
- `FinanceDataReader` — KR 시장 비공식 표준

이 두 라이브러리를 Kotlin 으로 포팅하는 비용 vs 작은 Python 배치를 분리 운영하는 비용을
비교했을 때 **분리 운영이 압도적으로 저렴**.

```
quant/ingest/  (별도 Python 프로젝트)
├── pyproject.toml
├── Dockerfile
└── src/
    ├── sources/{yfinance_src,fdr_src}.py
    ├── sinks/clickhouse_sink.py
    └── scheduler.py        K8s CronJob
```

**Contract**:
- 단방향 — Python sidecar 가 ClickHouse `quant.ohlcv` 에 INSERT 만
- 메인 서비스는 ClickHouse read only — Python 의존성 0
- 멱등 — `(asset_code, market_code, ts, interval)` UNIQUE
- 실행 — K8s CronJob (시간봉 매시 +5min, 일봉 KST 16:30)

### 비고려 옵션

- **Python 단일** — quant 의 Kotlin 코드량/MSA 일관성 고려 시 비현실적
- **Polyglot 양쪽 유지** — full merge 결정(ADR-0033) 과 모순. 운영 복잡 ↑
- **Kotlin 메인 + Kotlin ingest** — yfinance/FinanceDataReader 대체로 Polygon/Alpha Vantage
  유료 API 가능하나 Phase 1 무료 데이터 범위 ↓ → 미채택. Phase 2 운영 안정성 필요 시 재검토.

## Consequences

### Positive

- MSA 나머지 18+ 모듈과 스택 일관 (common/gateway/order/search/member/...)
- ML/벡터 검색 코어가 Kotlin 으로 통합 → 빌드/테스트/배포 파이프라인 단일
- Python 사이드카는 데이터 수집 전용 — 메인 서비스 장애에 영향 0
- yfinance/FinanceDataReader 의 라이브러리 우위 보존

### Negative

- Kotlin 진영 ML 라이브러리는 Python 대비 빈약 — 미래 ML 확장 시 다시 Python 사이드카 추가 가능성
- ingest sidecar 별도 lifecycle (Dockerfile, CI, K8s CronJob, 모니터링) 운영
- 임베딩 로직 포팅 시 결과 동등성 검증 필요 (numpy vs multik 부동소수점 차이)

### Mitigations

- ingest sidecar 는 `quant/ingest/` 단일 디렉토리 + 단순 CLI — 운영 표면 최소
- 임베딩 포팅 시 양 구현 결과를 동일 입력으로 비교하는 golden test 필수
- ML 확장 필요 시 본 ADR 의 "메인 서비스 Python 의존성 0" 원칙은 유지하되 별도 ML 사이드카 ADR 로

## Migration

### Phase 1 단계

1. ta4j / DJL 의존성 추가, `:quant:domain` / `:quant:app` 빌드 검증
2. pgvector schema `pattern` → `quant_pattern` rename + Flyway
3. 임베딩 로직 Kotlin 포팅 + golden test
4. `quant/ingest/` 신규 — yfinance/FinanceDataReader → ClickHouse insert
5. K8s CronJob 매니페스트
6. charting 서비스 stop (Phase 2 진입 전까지 대기)

### Phase 2 단계

1. charting 서비스 manifest / ingress / image 폐기
2. ADR-001 (charting) Status → Superseded

## References

- [Spec](../specs/2026-05-04-quant-unified-platform/planning/spec.md) §1.2 / §5
- ADR-0033 (Quant 통합 플랫폼)
- charting/docs/adr/ADR-003 (Python/FastAPI 선택 — Errata 추가)
