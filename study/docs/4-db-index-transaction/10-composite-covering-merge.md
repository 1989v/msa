---
parent: 4-db-index-transaction
seq: 10
title: 복합 인덱스 + Covering + Index Merge + Skip Scan
type: deep
created: 2026-05-01
---

# 10. 복합 인덱스 + Covering + Index Merge + Skip Scan

## 핵심 정의

- **복합 인덱스 (Composite Index)**: 여러 컬럼을 하나의 인덱스로. 컬럼 순서가 **결정적**.
- **Covering Index**: 쿼리가 필요한 모든 컬럼을 인덱스만으로 만족 → clustered lookup 생략.
- **Index Merge**: 옵티마이저가 여러 단독 인덱스의 결과를 union/intersection.
- **Index Skip Scan** (8.0+): 복합 인덱스의 leftmost 가 빠진 쿼리도 부분적으로 활용.

03 에서 secondary leaf = PK (Primary Key, 기본 키) 라는 구조를 이해했다면, 이 4개는 그 구조의 **활용 패턴 4종 세트**.

## 복합 인덱스 — 컬럼 순서 룰

### Leftmost Prefix 룰

`INDEX (a, b, c)` 인덱스가 있을 때 **활용 가능 패턴**:

| WHERE 조건 | 활용 |
|---|---|
| `a = ?` | ✅ |
| `a = ? AND b = ?` | ✅ |
| `a = ? AND b = ? AND c = ?` | ✅ (full key) |
| `a = ? AND c = ?` | △ (a 부분만 사용 + c 는 필터) |
| `b = ?` | ❌ (leftmost 없음) — 8.0 의 skip scan 가능성만 |
| `b = ? AND c = ?` | ❌ |

이유: B+Tree 의 정렬 순서가 (a 우선, 같으면 b, 같으면 c). a 를 모르면 트리 진입 자체 불가.

### 컬럼 순서 결정 룰 (4단계)

`(=, IN, range, ORDER BY)` 순서로 배치.

```
1. = 조건 컬럼들
2. IN 조건 컬럼
3. 범위 (BETWEEN, >, <)
4. ORDER BY 컬럼
```

**왜?**:
- `=` 은 트리에서 정확히 한 점 → 다음 컬럼이 그 안에서 또 정렬되어 있어 활용.
- 범위 이후 컬럼은 이미 정렬 깨져 있음 → 인덱스 활용 불가.

### 예시

쿼리: `WHERE status = 'PAID' AND user_id = 'alice' AND created_at > '2026-01-01' ORDER BY created_at DESC`

- 좋은 인덱스: `(user_id, status, created_at)` — = , =, range+order. user_id 가 selectivity 더 높을 가능성에서 leftmost.
- 나쁜 인덱스: `(created_at, user_id, status)` — leftmost 가 range → range 이후 컬럼 활용 불가.

### MySQL 8.0 의 Descending Index

```sql
CREATE INDEX idx_user_created ON orders(user_id, created_at DESC);
```

- 일반 ASC 인덱스도 ORDER BY DESC 에 backward scan 가능. 그러나 일부 케이스 (ASC + DESC 혼합) 는 descending index 가 효율적.
- MySQL 5.7 까진 DESC 키워드 무시됐음. 8.0 부터 진짜 reverse.

## Covering Index

### 정의

쿼리가 SELECT, WHERE, ORDER BY 에서 참조하는 **모든 컬럼이 인덱스 leaf 에 존재** → clustered lookup 생략.

```sql
-- 인덱스: (user_id, status, total_amount)
SELECT user_id, status, total_amount FROM orders WHERE user_id='alice';
-- → Using index ✅
```

### 효과

- secondary 페이지만 읽음 (cluster random IO (Input/Output, 입출력) 0).
- buffer pool hit rate ↑ (인덱스가 작아 RAM 안에 잘 들어감).

### 단점

- 인덱스 크기 ↑ (모든 컬럼 포함).
- DML (Data Manipulation Language) 비용 ↑ (인덱스 갱신 컬럼 수 ↑).
- 추가 컬럼 변경마다 인덱스 갱신.

### MySQL Has No INCLUDE Clause

PostgreSQL/SQL Server: `CREATE INDEX ... INCLUDE (col)` — 인덱스 키는 아니지만 leaf 에 포함 (정렬 X, 저장만).

MySQL 은 미지원 → "포함시키고 싶은 컬럼"도 인덱스 키로 넣어야 함 (정렬 부담).

대안: 인덱스 마지막에 사실상 필터 안 하는 컬럼 붙여 covering 흉내.
```sql
CREATE INDEX idx_user_status_amount ON orders(user_id, status, total_amount);
-- total_amount 는 정렬 의미 없지만 covering 위해 포함
```

### msa 적용 가능 후보

`WishlistItemJpaRepository.findByMemberId`:
```sql
SELECT id, member_id, product_id, created_at FROM wishlist_items WHERE member_id=?
```

- 기존 `uk_member_product (member_id, product_id)` UNIQUE → leaf 에 (member_id, product_id, PK).
- created_at 은 안 들어감 → clustered lookup 발생.
- 후보: covering 을 위해 별도 인덱스 `(member_id, created_at, product_id)` — 단, write 비용 vs read 빈도 비교.
- 현 트래픽이 낮다면 굳이 안 만드는 게 답 (17 에서).

## Index Merge

옵티마이저가 **여러 단독 인덱스를 동시에 사용** 하는 패턴.

### 3 가지 알고리즘

#### Index Merge Union (OR)

```sql
-- idx_user, idx_status 단독
SELECT * FROM orders WHERE user_id='alice' OR status='PAID';
```

- idx_user 로 alice 의 PK 모음 + idx_status 로 PAID 의 PK 모음 → **PK 합집합** 후 lookup.
- EXPLAIN: `type=index_merge, Extra=Using union(idx_user,idx_status)`

#### Index Merge Intersection (AND)

```sql
SELECT * FROM orders WHERE user_id='alice' AND status='PAID';
```

- 각각의 PK 모음의 **교집합**.
- 보통은 복합 인덱스가 더 빠름 → 옵티마이저는 cost 비교 후 선택.
- EXPLAIN: `Extra=Using intersect(idx_user,idx_status)`

#### Index Merge Sort-Union (OR + 정렬 필요)

```sql
SELECT * FROM orders WHERE user_id='alice' OR id > 1000 ORDER BY ...;
```

- OR 의 한쪽이 PK range → 정렬 후 합치기.

### 한계

- Index Merge 는 cost 가 복합 인덱스보다 항상 낮은 건 아님. 옵티마이저가 골라줘도 측정 필요.
- 8.0 에선 옵티마이저 hint `INDEX_MERGE`, `NO_INDEX_MERGE` 가능.
- **`OR` 가 많은 쿼리는 `UNION ALL` 분해가 더 빠를 때 흔함**.

```sql
-- 비효율
SELECT * FROM orders WHERE user_id='alice' OR status='PAID';

-- 효율
SELECT * FROM orders WHERE user_id='alice'
UNION ALL
SELECT * FROM orders WHERE status='PAID' AND user_id <> 'alice';
```

## Index Skip Scan (MySQL 8.0+)

### 정의

복합 인덱스 `(a, b)` 의 leftmost a 가 WHERE 에 없어도, **a 의 distinct 값마다 mini-range scan** 으로 인덱스 활용.

```sql
-- 인덱스: (region, age)
SELECT * FROM users WHERE age = 30;  -- region 없음
```

- region 의 distinct 가 적으면 (예: 5개) → 5번의 mini-range (`region=A AND age=30` 등) 로 스캔.
- region 이 너무 많으면 비효율 → 옵티마이저 cost 보고 선택.

### 한계

- `region` distinct 가 작아야 (수십 이하) 효과.
- WHERE 에 leftmost 가 없을 때 plan B 정도. 차라리 인덱스를 (age, region) 으로 만드는 게 맞을 때 많음.

EXPLAIN: `Extra=Using index for skip scan`

## ICP (Index Condition Pushdown) — 재방문

09 에서 짧게 언급. 인덱스의 **non-leftmost 컬럼 조건** 을 인덱스 단계에서 일찍 평가.

```sql
-- (user_id, age) 인덱스
SELECT * FROM users WHERE user_id='alice' AND age > 30;
```

- 5.6 이전: idx 에서 user_id='alice' 모은 뒤 clustered lookup → 그 row 의 age 검사 → 안 맞으면 폐기.
- 5.6 이후: idx leaf 에서 age > 30 까지 평가 → 맞는 PK 만 lookup. **lookup 수 감소**.

EXPLAIN: `Extra=Using index condition`

## MRR (Multi-Range Read)

secondary 인덱스로 PK 모은 뒤 lookup 시, PK 정렬 후 lookup → random IO → sequential 비슷하게.

EXPLAIN: `Extra=Using MRR`

기본 OFF. `optimizer_switch='mrr=on,mrr_cost_based=on'` 으로 켤 수 있음.

## 복합 인덱스 설계 워크플로우

1. 자주 쓰는 쿼리들 수집 (slow log + 코드 grep).
2. 각 쿼리의 WHERE / ORDER BY / SELECT 컬럼 추출.
3. 컬럼별 selectivity 확인:
   ```sql
   SELECT COUNT(DISTINCT user_id) / COUNT(*) FROM orders;  -- 0 ~ 1
   ```
4. 룰 적용: (=, IN, range, ORDER BY) 순서 + selectivity 높은 컬럼 leftmost.
5. covering 후보면 SELECT 컬럼 추가.
6. EXPLAIN ANALYZE 로 실측 확인.
7. write 영향 측정 (sysbench / load test).

## 안티패턴 (간단 — 11 에서 자세히)

```sql
-- 1. leftmost 없음
WHERE b = ? AND c = ?  -- (a,b,c) 인덱스 안 탐 (skip scan 가능성만)

-- 2. range 이후 컬럼 활용 X
WHERE a = ? AND b > 5 AND c = ?  -- c 는 인덱스로 못 거름

-- 3. ORDER BY 와 인덱스 정렬 mismatch
WHERE a = ? ORDER BY c   -- (a,b,c) 인덱스 → b 가 사이에 끼어 정렬 못 씀
```

## msa 후보 인덱스

### `orders` 의 (user_id, status, created_at)

현재: `idx_orders_user_id (user_id)`, `idx_orders_status (status)`.

자주 쓰일 쿼리 (가설):
```sql
SELECT * FROM orders WHERE user_id=? AND status=? ORDER BY created_at DESC LIMIT 20;
```

기존 인덱스로:
- idx_orders_user_id 사용 → user_id='alice' 범위 → clustered lookup → status, created_at 필터 + 정렬.
- 정렬 시 filesort 발생 가능.

복합 `(user_id, status, created_at)` 만들면:
- type=ref + Using index condition + filesort 제거.
- 단 selectivity 가 충분해야 (alice 의 PAID 가 충분히 좁아야).

### `outbox` 의 (published_at, occurred_at)

현재 (quant): `idx_outbox_unpublished (published_at, occurred_at)` — 이미 최적.
- `WHERE published_at IS NULL ORDER BY occurred_at LIMIT 100`
- IS NULL 은 인덱스 활용 가능 (11 에서).
- type=range, Extra=Using index condition. ✅

### `wishlist_items` 의 (member_id, created_at) 후보

현재: `uk_member_product (member_id, product_id)`.

쿼리: `SELECT ... WHERE member_id=? ORDER BY created_at DESC`
- 기존 인덱스로: member_id leftmost OK, but created_at 정렬은 filesort.
- 후보: `(member_id, created_at DESC)` covering — 단 selectivity 와 write 빈도 비교.
- 현 트래픽 낮다면 미루는 게 답.

## 멘탈 모델

> 복합 인덱스는 **전화번호부**. 성 (a) → 이름 (b) → 가운데이름 (c) 순으로 정렬. 성을 알면 이름 좁히고, 성을 모르면 처음부터 다 봐야 한다 (skip scan 은 성이 5개뿐이라 다 한번씩 들어가는 작전). Covering 은 전화번호부에 주소까지 적혀 있어 책 다른 부분 안 봐도 되는 것.

## 핵심 포인트

- 복합 인덱스 컬럼 순서: **(=, IN, range, ORDER BY)** + selectivity 높은 컬럼 leftmost.
- **Leftmost prefix 룰**: a 없이 b 만으로 인덱스 못 탐 (skip scan 가능성 제외).
- **Covering Index** = leaf 만으로 쿼리 해결. MySQL 은 INCLUDE 없으니 키에 포함.
- **Index Merge**: 단독 인덱스 여러 개의 union/intersect. 복합 인덱스보다 느릴 때 많음.
- **Skip Scan**: 8.0+, leftmost distinct 적을 때만 효과.
- **ICP / MRR**: 8.0 의 자동 최적화. EXPLAIN Extra 에 표시.
- 복합 인덱스 추가 전엔 항상 EXPLAIN ANALYZE + write 비용 측정.

## 다음 학습
- [11-anti-patterns.md](11-anti-patterns.md) — 인덱스 무효화 패턴
- [12-statistics-optimizer.md](12-statistics-optimizer.md) — 옵티마이저가 잘못 고를 때 대응
