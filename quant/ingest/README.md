# quant-ingest — OHLCV ingest sidecar

ADR-0033/0034 — 메인 서비스(Kotlin/Spring) 외부에서 OHLCV 데이터를 ClickHouse `quant.ohlcv`
테이블에 단방향 적재한다.

## 데이터 소스

- **yfinance** — US 주식 + 일부 암호화폐
- **FinanceDataReader** — KR 주식 (KOSPI/KOSDAQ)

## 실행

```bash
python -m src.scheduler --mode=incremental --interval=1d --lookback-days=7
```

## K8s CronJob

`k8s/base/quant-ingest/cronjob.yaml`:
- 시간봉 — 매시 +5min
- 일봉 — KST 16:30 평일

## 환경 변수

| 키 | 기본값 | 설명 |
|---|---|---|
| `CLICKHOUSE_HOST` | `clickhouse` | ClickHouse 서비스 호스트 |
| `CLICKHOUSE_PORT` | `8123` | HTTP 포트 |
| `CLICKHOUSE_DB`   | `quant` | DB 이름 |
| `CLICKHOUSE_USER` | `default` | 사용자 |
| `CLICKHOUSE_PASSWORD` | `` | 비밀번호 |

## 자산 카탈로그

`src/scheduler.py` 의 `DEFAULT_TARGETS` 가 Phase 1 시드. 운영에선 ConfigMap / DB 시드로 교체.
