---
parent: 4-db-index-transaction
seq: 09
title: EXPLAIN / EXPLAIN ANALYZE — 실행 계획 해석
type: deep
created: 2026-05-01
---

# 09. EXPLAIN / EXPLAIN ANALYZE — 실행 계획 해석

## 핵심 정의

- **EXPLAIN**: 쿼리 실행 **예측** — 옵티마이저가 어떤 인덱스/조인 순서/접근 방식을 고를지.
- **EXPLAIN ANALYZE** (8.0.18+): **실측** — 실제 실행하면서 단계별 시간/row 측정.
- **EXPLAIN FORMAT=JSON**: 자세한 cost 포함. `WHERE` 적용 순서 등 디테일.

면접 단골: **"EXPLAIN 어떻게 보세요?"** → 핵심 4 필드 + 위험 신호 패턴 답할 수 있어야.

## 기본 EXPLAIN 출력 형식

```
EXPLAIN SELECT * FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = 'alice' AND o.status = 'PAID';
```

```
+----+-------------+-------+--------+-----------------------+------------------+---------+--------------+------+--------------------------+
| id | select_type | table | type   | possible_keys         | key              | key_len | ref          | rows | Extra                    |
+----+-------------+-------+--------+-----------------------+------------------+---------+--------------+------+--------------------------+
|  1 | SIMPLE      | o     | ref    | idx_orders_user_id,...| idx_orders_user_id| 402    | const        |  100 | Using where              |
|  1 | SIMPLE      | oi    | ref    | idx_order_items_oid   | idx_order_items_oid| 8     | commerce.o.id|    3 | NULL                     |
+----+-------------+-------+--------+-----------------------+------------------+---------+--------------+------+--------------------------+
```

## 핵심 4 필드

### 1. `type` — 접근 방식 (낮을수록 좋음)

좋은 순서대로:

| type | 설명 | 비용 |
|---|---|---|
| **system** | 테이블에 row 1개 (사실상 상수) | 0 |
| **const** | PK 또는 UNIQUE 인덱스 = 1개 row | 매우 낮음 |
| **eq_ref** | JOIN 시 PK/UNIQUE 로 정확히 1 row 매칭 | 매우 낮음 |
| **ref** | 인덱스 = 로 N rows | 낮음 |
| **range** | 인덱스 범위 (`BETWEEN`, `IN`, `>`, `<`) | 중간 |
| **index** | 인덱스 풀스캔 (leaf 전체) | 높음, but 데이터 페이지 안 봐도 될 때 |
| **ALL** | **테이블 풀스캔 (FTS)** | 매우 높음 |

→ **ALL 보이면 일단 의심**. 작은 테이블이면 정상, 큰 테이블이면 인덱스 부재 또는 selectivity 문제.

### 2. `key` — 실제 사용된 인덱스

- `possible_keys` 는 후보, `key` 는 옵티마이저 선택.
- `key = NULL` + `type = ALL` → 인덱스 안 탐.
- 잘못 골랐다 싶으면 `FORCE INDEX(idx_xxx)` 또는 `IGNORE INDEX` (12 에서).

### 3. `rows` — 예상 스캔 row 수

- 옵티마이저의 **추정**. 실제와 다를 수 있음 (통계 stale 시).
- `EXPLAIN ANALYZE` 의 `actual rows` 와 비교 → 통계 정확도 점검.
- 1억 row 테이블에서 rows 가 수백만이면 인덱스 효율 낮음.

### 4. `Extra` — 위험 신호

| 표시 | 의미 |
|---|---|
| **Using index** | covering index — leaf 만으로 해결, clustered lookup 없음 ✅ 좋음 |
| **Using where** | 인덱스 후 추가 필터 적용 (정상) |
| **Using index condition** | ICP (Index Condition Pushdown) — 인덱스에서 일찍 필터 ✅ |
| **Using filesort** | 메모리/디스크 정렬 발생 ⚠️ 위험 |
| **Using temporary** | 중간 임시 테이블 ⚠️ 위험 (DISTINCT, GROUP BY) |
| **Using join buffer (Block Nested Loop)** | JOIN 인덱스 부재 ⚠️ |
| **Using MRR** | Multi-Range Read — random IO 줄임 |
| **Impossible WHERE** | WHERE 조건이 항상 false |

→ **Using filesort + Using temporary** 가 동시에 보이면 거의 항상 인덱스 재설계 필요.

## EXPLAIN ANALYZE — 실측 모드 (8.0.18+)

```sql
EXPLAIN ANALYZE
SELECT * FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = 'alice';
```

출력 (tree 형식):

```
-> Nested loop inner join  (cost=120.50 rows=300)
                           (actual time=0.234..2.115 rows=287 loops=1)
    -> Index lookup on o using idx_orders_user_id (user_id='alice')
                           (cost=10.50 rows=100)
                           (actual time=0.041..0.180 rows=98 loops=1)
    -> Index lookup on oi using idx_order_items_oid (order_id=o.id)
                           (cost=1.10 rows=3)
                           (actual time=0.012..0.018 rows=2.93 loops=98)
```

### 읽는 법

- **cost / rows**: 옵티마이저 예측.
- **actual time**: 실제 누적 시간 (시작..종료). 두 번째 숫자가 누적.
- **actual rows**: 실측 row 수.
- **loops**: 이 단계 실행 횟수 (외부 loop 의 row 수).

### 위험 신호 — 예측과 실측 괴리

```
cost=10 rows=100 (예측)
actual=98 ✅ 정확
```

vs

```
cost=10 rows=100 (예측)
actual=950000 ⚠️ 통계 stale
```

→ `ANALYZE TABLE orders` 실행 (12 에서).

## EXPLAIN FORMAT=JSON

```sql
EXPLAIN FORMAT=JSON SELECT ...;
```

JSON 으로 자세한 cost / used_columns / attached_condition 출력. 워크로드 디버깅에 유용.

## 시나리오별 EXPLAIN 패턴

### 패턴 1: PK 단건 조회 (이상적)

```sql
EXPLAIN SELECT * FROM orders WHERE id = 5;
```
```
type: const   key: PRIMARY   rows: 1   Extra: NULL
```

### 패턴 2: 인덱스 = 다건 조회

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 'alice';
```
```
type: ref   key: idx_orders_user_id   rows: 98   Extra: Using where
```

### 패턴 3: 범위 스캔

```sql
EXPLAIN SELECT * FROM orders WHERE id BETWEEN 100 AND 200;
```
```
type: range   key: PRIMARY   rows: 101   Extra: Using where
```

### 패턴 4: Covering Index

```sql
-- (user_id, status) 복합 인덱스 가정
EXPLAIN SELECT user_id, status FROM orders WHERE user_id='alice';
```
```
type: ref   key: idx_user_status   rows: 98   Extra: Using index ✅
```

### 패턴 5: ALL (위험)

```sql
EXPLAIN SELECT * FROM orders WHERE LOWER(user_id) = 'alice';
-- 함수 적용 → 인덱스 무효
```
```
type: ALL   key: NULL   rows: 1000000   Extra: Using where
```

### 패턴 6: Index Merge

```sql
-- 단독 인덱스 idx_user, idx_status 모두 존재
EXPLAIN SELECT * FROM orders WHERE user_id='alice' OR status='PAID';
```
```
type: index_merge   key: idx_user,idx_status   Extra: Using union(idx_user,idx_status); Using where
```

### 패턴 7: Using filesort (위험)

```sql
EXPLAIN SELECT * FROM orders WHERE user_id='alice' ORDER BY price;
-- price 에 인덱스 없음
```
```
type: ref   key: idx_user   Extra: Using where; Using filesort
```

→ (user_id, price) 복합 인덱스 만들면 filesort 제거.

### 패턴 8: 인덱스 무효 (NOT IN, OR)

```sql
EXPLAIN SELECT * FROM orders WHERE user_id NOT IN ('alice', 'bob');
```
```
type: ALL   ⚠️
```

→ `NOT IN` 은 cardinality 가 높은 negative match → 옵티마이저가 ALL 선택.

## ICP (Index Condition Pushdown)

5.6+ 기능. WHERE 의 일부 조건을 인덱스 페이지 단에서 평가 → clustered lookup 횟수 감소.

```sql
-- (user_id, status) 인덱스
EXPLAIN SELECT * FROM orders WHERE user_id='alice' AND status='PAID' AND total>100;
-- total 은 leaf 에 없지만 user_id, status 는 leaf 에 있음
```

```
Extra: Using index condition  -- ICP 적용
```

→ `total>100` 이전에 `status='PAID'` 까지를 인덱스 단에서 거름. clustered lookup row 수 감소.

## EXPLAIN 으로 Lock 양 가늠

`SELECT ... FOR UPDATE` 의 `rows` 가 실제 lock 잡을 row 수. `rows = 1,000,000` 이면 100만 row + 그 사이 gap 까지 lock → 다른 TX block 가능성 ↑.

## 명령 cheat sheet

```sql
-- 기본
EXPLAIN SELECT ...;

-- 8.0+ 실측
EXPLAIN ANALYZE SELECT ...;

-- JSON (자세히)
EXPLAIN FORMAT=JSON SELECT ...;

-- TREE (8.0+, ANALYZE 없이)
EXPLAIN FORMAT=TREE SELECT ...;

-- 다른 connection 의 쿼리 EXPLAIN
EXPLAIN FOR CONNECTION 12345;
```

## msa 쿼리에 적용

`OrderJpaRepository.findByIdWithItems`:
```sql
SELECT o.*, oi.* FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.id = :id;
```
- 예상 plan: orders type=const + order_items type=ref(idx_order_items_oid).
- ✅ 좋음. PK + FK 인덱스 활용.

`WishlistItemJpaRepository.findByMemberId`:
```sql
SELECT * FROM wishlist_items WHERE member_id = ? LIMIT 20;
```
- index = `uk_member_product (member_id, product_id)` 의 leftmost 사용 → type=ref. ✅

`OutboxJpaRepository.findTop100ByPublishedAtIsNullOrderByOccurredAtAsc`:
```sql
SELECT * FROM outbox
WHERE published_at IS NULL
ORDER BY occurred_at ASC
LIMIT 100;
```
- 인덱스 `idx_outbox_unpublished (published_at, occurred_at)` 가 정확히 이 쿼리를 위해 설계됨.
- type = range, Extra = Using index condition. ✅
- IS NULL 도 이 인덱스의 leftmost 에 잘 들어감 (11 에서 다시).

## 함정 — EXPLAIN 만 보고 결론 X

- 통계가 stale 하면 rows 추정이 실제와 자릿수 차이 가능.
- 항상 **EXPLAIN ANALYZE** 로 실측 확인.
- buffer pool warm 상태에서 측정 (cold cache 면 IO 비용 ↑).
- 운영 트래픽과 다른 분포 (테스트 DB) 는 의미 적음.

## 권장 워크플로우

1. slow query log 에서 후보 쿼리 추출.
2. 운영 데이터 사본에서 `EXPLAIN ANALYZE` 실행.
3. type/key/rows/Extra 확인 → 위험 신호 식별.
4. 인덱스 후보 도출 → dev 에서 EXPLAIN 비교.
5. PR 리뷰 시 EXPLAIN 결과 첨부 (msa 컨벤션 후보).

## 멘탈 모델

> EXPLAIN 은 **요리하기 전에 레시피를 보는 것**. 어떤 도구 (인덱스) 를 어떤 순서로 쓸지. EXPLAIN ANALYZE 는 시연 — 실제로 만들어보고 시간 측정. JSON 은 영양성분표.

## 핵심 포인트

- **type 은 const/eq_ref/ref/range 까지 OK, ALL 은 의심**.
- **key = NULL** 은 거의 항상 문제.
- **rows** 는 추정이지만 자릿수 단위로 봄.
- **Extra**: Using index ✅, Using filesort/temporary ⚠️.
- **EXPLAIN ANALYZE** 로 예측 vs 실측 괴리 점검 → 통계 정확도 진단.
- ICP, Index Merge, MRR 같은 8.0 최적화도 EXPLAIN 에 표시됨.
- PR 리뷰에 EXPLAIN 첨부 컨벤션 도입이 효과적.

## 다음 학습
- [10-composite-covering-merge.md](10-composite-covering-merge.md) — Covering / Index Merge / Skip Scan
- [11-anti-patterns.md](11-anti-patterns.md) — type=ALL 으로 떨어뜨리는 안티패턴
