---
parent: 4-db-index-transaction
seq: 12
title: 통계와 옵티마이저 — 카디널리티 / 히스토그램 / Slow Log
type: deep
created: 2026-05-01
---

# 12. 통계와 옵티마이저 — 카디널리티 / 히스토그램 / Slow Log

## 핵심 정의

옵티마이저가 인덱스를 고를 수 있게 해주는 **통계 데이터** 를 다룬다.

- **Cardinality**: 인덱스 컬럼의 distinct 값 추정치.
- **Histogram**: 컬럼 값 분포 (8.0+).
- **Cost Model**: row 한 개 읽는 비용, IO 한 번 비용 등 cost 함수의 매개변수.

옵티마이저가 "잘못 골랐다" 의 원인은 거의 (1) 통계 stale, (2) cost model mismatch, (3) 옵티마이저 한계 셋.

## Cardinality (카디널리티)

### 정의

```
cardinality(col) = COUNT(DISTINCT col)
selectivity(col) = cardinality(col) / total_rows  ∈ (0, 1]
```

- 1 에 가까울수록 high-cardinality (PK, UUID).
- 0 에 가까울수록 low (boolean, enum).

### 옵티마이저의 cost 추정

```
estimated_rows_returned = total_rows / cardinality
```

`WHERE col = ?` 의 추정 행 수. cardinality 가 큰 컬럼은 적은 row → 인덱스 유리.

### 통계 보기

```sql
SHOW INDEX FROM orders\G
```
```
*************************** 1. row ***************************
        Table: orders
   Non_unique: 0
     Key_name: PRIMARY
 Seq_in_index: 1
  Column_name: id
    Cardinality: 1000000
*************************** 2. row ***************************
     Key_name: idx_orders_user_id
  Column_name: user_id
    Cardinality: 50000
```

→ 1M rows / 50K cardinality = 20 row per user (평균). selectivity OK.

### 통계 갱신

InnoDB 는 자동 통계 (변경의 10% 이상 시 등). 그러나 **stale 자주 발생**:
- bulk import 직후
- 큰 DELETE 직후
- 시계열 패턴 (오래된 데이터 안 변하지만 통계 갱신 트리거 안 됨)

```sql
ANALYZE TABLE orders;  -- 통계 강제 재계산
```

- InnoDB 의 통계 sample size: `innodb_stats_transient_sample_pages` (기본 8) — 너무 작아서 부정확. 운영은 `innodb_stats_persistent_sample_pages` (기본 20).

### Persistent vs Transient Statistics

```sql
-- 8.0+ 기본은 PERSISTENT
SET GLOBAL innodb_stats_persistent = 1;

-- 테이블별 설정
ALTER TABLE orders STATS_PERSISTENT=1, STATS_SAMPLE_PAGES=100;
```

- Persistent: mysql.innodb_index_stats 에 저장. 재시작 후에도 유지.
- Transient: 메모리에만, 재시작마다 재계산. 작은 DB 외엔 비추.

## Histogram (8.0+)

### 동기

cardinality 만으론 **비균등 분포** 를 못 표현.

```
status='ACTIVE' : 99% of rows
status='DELETED': 1% of rows
status='PENDING': 1% of rows
```

- cardinality(status) = 3. 옵티마이저는 selectivity = 1/3 으로 추정.
- 실제 ACTIVE 검색 → 99% 매칭 → ALL 이 빠른데, 옵티마이저는 인덱스 선택.
- DELETED 검색 → 1% 매칭 → 인덱스 좋은데, 옵티마이저가 그것도 1/3 추정 → 잘못된 비교.

→ histogram 으로 분포 정확히 알면 해결.

### 사용

```sql
ANALYZE TABLE orders UPDATE HISTOGRAM ON status WITH 16 BUCKETS;
```

- 컬럼 값을 16 bucket 으로 나눠 빈도 저장.
- WHERE 절 cost 추정에 활용.

### 한계

- **인덱스 없는 컬럼에만** histogram 효과 큼 (인덱스 있으면 cardinality + 인덱스 dive 가 더 정확).
- 자주 갱신 안 됨 → stale 위험.

## Index Dive

옵티마이저는 cardinality 외에 **인덱스 직접 접근** 으로 더 정확한 cost 추정 — `index dive`.

```sql
WHERE id BETWEEN 100 AND 200
```

- 옵티마이저가 인덱스 leaf 두 점 (100, 200) 을 직접 살펴 그 사이 row 수 추정.
- IN 절이 너무 길면 dive 비용 ↑ → `eq_range_index_dive_limit` (기본 200) 이상 IN 값이면 cardinality 만 사용.

## Cost Model

`mysql.engine_cost`, `mysql.server_cost` 테이블에 cost 단위 가격.

| 항목 | 기본값 (대략) |
|---|---|
| disk_temptable_create_cost | 20 |
| disk_temptable_row_cost | 0.5 |
| io_block_read_cost | 1.0 |
| memory_block_read_cost | 0.25 |
| key_compare_cost | 0.05 |
| row_evaluate_cost | 0.1 |

운영은 거의 default. SSD 환경이라 IO cost 를 낮춰야 정확하다고 주장하는 사람도 있지만 일반적으로 손대지 않음.

## 옵티마이저 힌트

### Optimizer Hint (8.0+ 표준)

```sql
SELECT /*+ INDEX(orders idx_orders_user_id) */ * FROM orders WHERE user_id='alice';
SELECT /*+ NO_INDEX_MERGE(orders) */ * FROM orders WHERE user_id='alice' OR status='PAID';
SELECT /*+ JOIN_ORDER(o, oi) */ * FROM orders o JOIN order_items oi ...;
```

### FORCE / IGNORE INDEX (legacy)

```sql
SELECT * FROM orders FORCE INDEX (idx_orders_user_id) WHERE ...;
SELECT * FROM orders IGNORE INDEX (idx_orders_status) WHERE ...;
```

### USE INDEX FOR ... (5.7+)

```sql
SELECT * FROM orders USE INDEX FOR ORDER BY (idx_created_at) ...;
```

→ 힌트는 **최후 수단**. 통계 갱신 + 인덱스 재설계가 우선.

## 옵티마이저 트레이스 (디버깅)

```sql
SET optimizer_trace='enabled=on';
SELECT * FROM orders WHERE user_id='alice';
SELECT * FROM information_schema.OPTIMIZER_TRACE\G
SET optimizer_trace='enabled=off';
```

JSON 으로 옵티마이저의 cost 계산 과정 모두 출력. 왜 인덱스 A 대신 B 골랐는지 추적.

## Slow Query Log

### 활성화

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.5;  -- 0.5초 이상
SET GLOBAL log_queries_not_using_indexes = 'ON';
```

`/var/log/mysql/slow.log` (또는 my.cnf 설정 위치) 에 기록.

### Format

```
# Time: 2026-05-01T12:00:00
# User@Host: app[app] @ ...
# Query_time: 1.234567  Lock_time: 0.000123 Rows_sent: 100  Rows_examined: 1000000
SELECT * FROM orders WHERE LOWER(user_id) = 'alice';
```

→ Rows_examined / Rows_sent 비율이 100:1 이상이면 인덱스 효율 낮음.

### 분석 도구

```bash
# Percona toolkit
pt-query-digest /var/log/mysql/slow.log
```

- 쿼리별 빈도, 누적 시간, p50/p95 출력.
- 운영 진단 1순위.

### Performance Schema 대안

8.0 의 performance_schema 도 동등 기능:

```sql
SELECT digest_text, count_star, sum_timer_wait/1e12 AS total_sec
FROM performance_schema.events_statements_summary_by_digest
ORDER BY sum_timer_wait DESC
LIMIT 10;
```

## 운영 진단 워크플로우

```
1. slow log on
2. pt-query-digest 로 top 10 쿼리 추출
3. 각 쿼리 EXPLAIN ANALYZE
4. 통계 stale 의심되면 ANALYZE TABLE
5. 인덱스 재설계 또는 힌트 (최후)
6. 변경 후 다시 측정
```

## msa 적용

### slow log 활성화 권장

운영 환경에 일관 적용 — `long_query_time = 0.5` 가 시작점.

### Outbox 의 통계

`outbox.published_at IS NULL` 의 selectivity 는 시간에 따라 동적:
- 정상: 거의 0 (배치가 따라잡고 있음).
- 장애: 100% (배치 멈춤).
- 옵티마이저는 장애 시점에도 인덱스 사용 — IS NULL row 가 적다고 추정 → 실제 100% 일 때 인덱스 dive 시 비싸짐.
- → 장애 시 ANALYZE TABLE outbox 강제. 또는 application level 에서 알람 + 수동 조치.

### routing 영향

ADR-0020 의 readOnly → replica 라우팅. replica 에 통계 갱신이 master 와 다를 수 있음 (replication 으로 mysql.innodb_index_stats 도 sync 되지만 sample 시점 차이). → master 에서 EXPLAIN, replica 에서 다시 비교 권장.

## 함정

### 1. 통계가 너무 자주 갱신되어도 부담

- `innodb_stats_auto_recalc = 0` 으로 끄고 cron 으로 ANALYZE 강제하는 운영도 있음.

### 2. partition 테이블의 통계

- partition 별 통계 따로 + 전체 통계.
- 1개 partition 만 update 가 많으면 전체 통계 stale 될 수 있음.

### 3. histogram 갱신은 자동 X

- 명시적 `ANALYZE TABLE ... UPDATE HISTOGRAM` 필요. cron 등록.

### 4. EXPLAIN 의 rows 가 자릿수 다름

- 통계 stale 신호. ANALYZE TABLE 후 재확인.

## 멘탈 모델

> 옵티마이저는 **여행 가이드**. 통계 = 지도. 지도가 오래되어 길이 막힌 줄 모르면 더 먼 길 안내. ANALYZE TABLE = 지도 업데이트. histogram = 도시별 인구 분포 정보. 힌트는 "이 길로 가" 명령 — 가이드보다 내가 더 잘 안다고 확신할 때만.

## 핵심 포인트

- **Cardinality** = distinct 값 수. selectivity = cardinality / total. 인덱스 효과의 1차 결정.
- **InnoDB 통계는 자동이지만 stale 자주** — bulk import / 큰 DELETE 후 ANALYZE TABLE.
- **Persistent statistics** 가 8.0 기본. STATS_SAMPLE_PAGES 늘리면 정확도 ↑.
- **Histogram (8.0+)** 은 비균등 분포 컬럼에 효과. 인덱스 없는 컬럼 우선.
- **Optimizer hint** 는 최후 수단. 통계 갱신 + 인덱스 재설계가 우선.
- **Slow log + pt-query-digest** 가 운영 진단의 표준.
- Replica routing 사용 시 master 와 replica 통계 차이 가능 → 양쪽 EXPLAIN 비교.

## 다음 학습
- [13-online-ddl.md](13-online-ddl.md) — 인덱스 추가 시 MDL 차단 회피
- [15-msa-queries.md](15-msa-queries.md) — msa 쿼리에 통계/힌트 적용 후보
