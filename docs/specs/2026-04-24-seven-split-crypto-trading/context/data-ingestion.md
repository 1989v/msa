# 빗썸 시세 데이터 적재 파이프라인 설계 (Preflight P.1 / OQ-008)

**상태**: ✅ TG-07 구현 + 본 문서로 closed 가능
**작성일**: 2026-04-26
**연관 OQ**: OQ-008 (data-ingestion, high)

---

## 목표

빗썸 BTC/KRW, ETH/KRW 분봉을 2023-01-01 ~ 현재까지 ClickHouse `seven_split.market_tick_bithumb`에 적재. 백테스트 엔진의 `HistoricalMarketDataSource` 입력으로 사용.

---

## 1. 빗썸 REST API 사양

**엔드포인트**: `GET https://api.bithumb.com/public/candlestick/{order_currency}_{payment_currency}/{chart_intervals}`

**chart_intervals 값**: `1m`, `3m`, `5m`, `10m`, `30m`, `1h`, `6h`, `12h`, `24h`

**응답 형식**:
```json
{
  "status": "0000",
  "data": [
    [1700000000000, "30000000", "30100000", "30200000", "29900000", "1.5"],
    ...
  ]
}
```
컬럼 순서: `[timestamp_ms, open, close, high, low, volume]`

**중요**: 빗썸 candlestick은 **단일 호출에 가능한 과거 전체를 반환**. 페이지네이션 X. 응답 크기 = 거래소가 보관하는 전체 (수천 ~ 수만 row 가능).

---

## 2. ClickHouse 스키마

위치: `seven-split/app/src/main/resources/clickhouse/seven_split/V002__market_tick_bithumb.sql`

```sql
CREATE TABLE IF NOT EXISTS seven_split.market_tick_bithumb (
    symbol       String,
    `interval`   LowCardinality(String),
    ts           DateTime64(3, 'UTC'),
    open         Decimal(38, 8),
    high         Decimal(38, 8),
    low          Decimal(38, 8),
    close        Decimal(38, 8),
    volume       Decimal(38, 8),
    ingestedAt   DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingestedAt)
PARTITION BY toYYYYMM(ts)
ORDER BY (symbol, `interval`, ts);
```

- **PK**: `(symbol, interval, ts)` — 동일 키 중복 시 `ingestedAt` 최신 값으로 대체 (`ReplacingMergeTree`)
- **PARTITION**: 월 단위 (`toYYYYMM(ts)`) — 분봉 5년 = 60개 파티션
- **TTL**: Phase 1 미적용. 5년 보관 정책은 OQ-008 후속에서 결정 후 추가

---

## 3. 적재 전략

### 3.1 증분 수집 (TG-07 구현 완료)

`BithumbHistoryIngestService.ingest()`:
1. `FileIngestCheckpointStore.loadLastTs(symbol, interval)` — 이전 적재의 maxTs 로드
2. `BithumbRestClient.fetchCandles()` 1회 호출
3. 응답 row 중 `timestampMs > checkpoint` 필터링
4. ClickHouse insert (1000 row 배치)
5. `checkpointStore.saveLastTs(...)` 갱신

체크포인트 파일 경로: `.ingest/checkpoints/{symbol}-{interval}.checkpoint` (UTF-8, ISO-8601)

### 3.2 재수집 (Force Full)

`forceFull = true` 파라미터로 호출 시 checkpoint 무시하고 전체 적재. `ReplacingMergeTree`가 중복을 흡수하므로 재실행 안전.

### 3.3 실패 슬라이스 처리

`IngestDlqRecorder` 가 실패를 `.ingest/dlq/{symbol}-{interval}.dlq.log` 파일에 append. 형식:
```
2026-04-26T10:30:00Z\tBTC_KRW\t1m\tcheckpoint=2026-04-25T23:59Z\treason=connection timeout
```

운영자가 DLQ 파일 확인 후 수동 재실행. Phase 2에서 자동 재시도 스케줄러 도입 검토.

---

## 4. 실행 방법

### 단발 실행
```bash
./gradlew :seven-split:app:bootRun --args='--spring.profiles.active=ingest-bithumb --interval=1m'
```

`BithumbIngestCommand` (ApplicationRunner)가 BTC, ETH 순차 호출 후 종료.

### 정기 스케줄링 (운영)
- 옵션 A: K8s `CronJob` 으로 매시간 1회 실행 (Phase 2 도입 검토)
- 옵션 B: Spring `@Scheduled` 빈으로 동일 프로세스 내 주기 실행 (현 미구현)

Phase 1 MVP는 **수동 실행** 기준.

---

## 5. 데이터 정합성

### 갭 (Gap) 감지
운영자가 ClickHouse에서 다음 쿼리로 누락 구간 점검:
```sql
SELECT symbol, `interval`, 
       toYYYYMM(ts) AS month,
       count() AS rows,
       min(ts) AS minTs,
       max(ts) AS maxTs
FROM seven_split.market_tick_bithumb
WHERE symbol IN ('BTC_KRW', 'ETH_KRW') AND `interval` = '1m'
GROUP BY symbol, `interval`, month
ORDER BY symbol, month;
```

기대 row 수 (1m 기준): `30 days * 1440 min ≈ 43,200/month`. 95% 미만이면 갭 의심.

### 가격 검증
빗썸 외부 데이터(Coingecko 등)와 임의 시점 가격 비교 (수동 sample).

---

## 6. Phase 1 범위 / 미해소

### 포함
- BTC_KRW, ETH_KRW × 1m 분봉
- 2023-01 ~ 현재
- 단발 실행 + checkpoint + DLQ
- ClickHouse 단독 DB (`seven_split`)

### 제외 (Phase 2 이후)
- 자동 정기 스케줄링 (CronJob / @Scheduled)
- DLQ 자동 재시도
- 다른 거래쌍 (USDT_KRW 등)
- 다른 interval (5m, 1h, 24h)
- 업비트 동시 적재
- 5년 TTL 정책

---

## 7. OQ-008 종결 근거

본 문서 + TG-07 구현으로 다음 항목 해소:
- ✅ REST API 엔드포인트 / 응답 스키마 정리 (§1)
- ✅ ClickHouse 스키마 + PK / PARTITION / ORDER BY 명시 (§2)
- ✅ 증분 / 재수집 / 실패 처리 (§3)

→ **`open-questions.yml` OQ-008 status: open → closed**, decisions_log 추가 권장.
