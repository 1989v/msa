---
parent: 4-db-index-transaction
seq: 11
title: 인덱스 안티패턴 — 무효화의 9 가지 흔한 원인
type: deep
created: 2026-05-01
---

# 11. 인덱스 안티패턴 — 무효화의 9 가지 흔한 원인

## 핵심 정의

코드 리뷰 / PR 에서 "이 쿼리 인덱스 안 타요" 의 원인은 거의 9 가지로 수렴한다. 각 패턴을 보자마자 식별 + 해법을 말할 수 있어야 한다.

## 1. WHERE 절에 함수 적용

### 패턴

```sql
-- 인덱스: idx_created_at (created_at)
SELECT * FROM orders WHERE DATE(created_at) = '2026-05-01';
SELECT * FROM users WHERE LOWER(email) = 'alice@x.com';
SELECT * FROM orders WHERE YEAR(created_at) = 2026;
```

### 왜 무효

함수 적용 후의 값은 인덱스에 없다. 인덱스는 **컬럼 원래 값** 으로 정렬.

### 해법

#### 범위로 변환

```sql
SELECT * FROM orders
WHERE created_at >= '2026-05-01 00:00:00'
  AND created_at <  '2026-05-02 00:00:00';
```

#### 함수 인덱스 (8.0.13+)

```sql
CREATE INDEX idx_lower_email ON users ((LOWER(email)));
-- 또는 generated column + 그 컬럼 인덱스
```

### EXPLAIN 으로 확인

```
type: ALL  key: NULL  ⚠️
```

## 2. Implicit Type Cast

### 패턴

```sql
-- user_id VARCHAR
SELECT * FROM orders WHERE user_id = 12345;
-- → 모든 user_id 를 INT 로 캐스팅 후 비교 → 인덱스 무효
```

### 왜

MySQL 의 비교 규칙: **숫자 vs 문자열 비교 시 양쪽을 숫자로 변환**. 컬럼이 VARCHAR 인데 리터럴이 INT → 컬럼 모든 row 에 함수 적용 효과 → 인덱스 무효.

### 해법

```sql
SELECT * FROM orders WHERE user_id = '12345';  -- 문자열 리터럴
```

JPA 사용 시 컬럼 타입과 PreparedStatement 파라미터 타입 일치 필수. Kotlin/JPA 는 보통 자동 일치되지만 raw SQL 에선 주의.

## 3. Leftmost Prefix 위반

### 패턴

```sql
-- 인덱스: (a, b, c)
SELECT * FROM t WHERE b = ? AND c = ?;  -- a 없음
```

### 해법

- 인덱스 컬럼 순서 재설계 (10 에서).
- 또는 b 단독 인덱스 추가.
- 또는 8.0+ 의 Skip Scan 에 의존 (leftmost distinct 가 적을 때만).

## 4. 부정 조건 (`<>`, `!=`, `NOT IN`)

### 패턴

```sql
SELECT * FROM orders WHERE status <> 'COMPLETED';
SELECT * FROM users WHERE country NOT IN ('KR', 'JP');
```

### 왜

- `<>` 는 거의 모든 row 가 일치 → 옵티마이저가 ALL 선택.
- 한국 + 일본 외 = 너무 많은 row → 인덱스 무용.

### 해법

- 가능하면 positive 로 재작성: `WHERE status IN ('PAID','REFUND','PENDING')`.
- 데이터 모델 재설계: deleted_at 같은 soft delete + `WHERE deleted_at IS NULL` (NULL 인덱스, 5번 참조).
- 답이 없으면 인덱스 안 만드는 게 답 (옵티마이저 판단 신뢰).

## 5. `IS NULL` / `IS NOT NULL` (조건부 효과)

### 일반 통념

"NULL 은 인덱스 못 탄다" 는 **틀린 말**. MySQL/InnoDB 는 NULL 을 인덱스에 포함.

### 정확한 답

- `WHERE col IS NULL` → 인덱스 활용 가능 (NULL row 수가 selectivity 좋으면).
- `WHERE col IS NOT NULL` → 거의 모든 row 일 가능성 ↑ → 옵티마이저가 ALL 선택할 수 있음.

### msa 사례 — 최적

```sql
-- quant outbox
SELECT * FROM outbox
WHERE published_at IS NULL
ORDER BY occurred_at
LIMIT 100;
```

- `idx_outbox_unpublished (published_at, occurred_at)` — published_at IS NULL 은 selectivity 매우 높음 (대부분은 published).
- → 인덱스 잘 탐. ✅

### Postgres 의 다른 점

Postgres 는 NULL 을 B-Tree 의 한쪽 끝에 모아둠. partial index 로 명시 처리도 가능. MySQL 은 그냥 다른 값처럼 처리.

## 6. `OR` 의 한쪽만 인덱스

### 패턴

```sql
-- idx_user (user_id) 만 존재
SELECT * FROM orders WHERE user_id='alice' OR phone_number='010-1234';
-- phone_number 인덱스 없음
```

### 왜

옵티마이저는 "한쪽이라도 ALL 이면 전체 ALL". user_id 인덱스만 못 살림.

### 해법

#### Index Merge (양쪽 모두 인덱스 있을 때)

```sql
-- idx_user, idx_phone 둘 다 있음
SELECT * FROM orders WHERE user_id='alice' OR phone_number='010-1234';
-- → Index Merge Union
```

#### UNION ALL 분해

```sql
SELECT * FROM orders WHERE user_id='alice'
UNION ALL
SELECT * FROM orders WHERE phone_number='010-1234' AND user_id<>'alice';
```

(중복 제거 위해 두 번째 쿼리에 NOT 조건 추가.)

## 7. `LIKE '%...'` 또는 양쪽 % 와일드카드

### 패턴

```sql
SELECT * FROM users WHERE email LIKE '%example.com';
SELECT * FROM articles WHERE title LIKE '%mysql%';
```

### 왜

leftmost 패턴이 fixed 가 아니면 B+Tree 진입 불가. 트리는 prefix 정렬이므로.

### 해법

- prefix LIKE 만 → `LIKE 'alice%'` 는 OK (range scan).
- 양쪽 % → 외부 검색 엔진 (Elasticsearch / OpenSearch). msa 의 `search`, `code-dictionary` 패턴.
- MySQL FULLTEXT (한국어는 ngram 토크나이저) — 04 에서.

### Reverse Index 트릭

도메인 끝 검색을 위해 reverse 컬럼 + 인덱스:
```sql
ALTER TABLE users ADD COLUMN email_reversed VARCHAR(255) GENERATED ALWAYS AS (REVERSE(email)) VIRTUAL;
ALTER TABLE users ADD INDEX idx_email_reversed (email_reversed);
SELECT * FROM users WHERE email_reversed LIKE 'moc.elpmaxe%';  -- ".com.example..." 의 reverse
```

## 8. Range 이후 컬럼은 인덱스 활용 X

### 패턴

```sql
-- 인덱스: (a, b, c)
SELECT * FROM t WHERE a = 1 AND b > 5 AND c = 3;
-- c 는 인덱스로 못 걸러짐
```

### 왜

range 후엔 인덱스 정렬이 깨짐 — c 는 b 의 각 값마다 무작위 분포.

### 해법

- 인덱스 순서 재설계: (a, c, b) — = 컬럼을 먼저, range 마지막.
- ICP 가 c 를 leaf 단계에서 평가 (5.6+) → clustered lookup 줄임 (`Using index condition`).

## 9. ORDER BY 인덱스 정렬과 mismatch

### 패턴

```sql
-- 인덱스: (user_id, created_at ASC)
SELECT * FROM orders WHERE user_id='alice' ORDER BY created_at DESC;
-- 기본은 ASC, DESC 정렬 시 backward scan 으로 처리 가능 (8.0+) 이지만
-- ASC + DESC 혼합은 filesort.

SELECT * FROM orders WHERE user_id='alice' ORDER BY price, created_at;
-- 인덱스에 없는 price 우선 정렬 → filesort
```

### 왜

인덱스 정렬과 일치하지 않으면 filesort.

### 해법

- 인덱스 컬럼 ASC/DESC 명시 (8.0+ DESC 인덱스).
- ORDER BY 의 모든 컬럼이 인덱스에 leftmost 매칭하게 재설계.

EXPLAIN: `Extra=Using filesort` ⚠️

## 보너스: 페이징 OFFSET 함정

### 패턴

```sql
SELECT * FROM orders ORDER BY id LIMIT 1000000, 20;
-- offset 1,000,000 = 1M row 를 읽고 버려야 함
```

### 왜

`LIMIT N, M` = "N 개 skip + M 개 반환". InnoDB 는 N 개를 실제로 fetch 후 폐기.

### 해법: Keyset (Cursor) Pagination

```sql
SELECT * FROM orders WHERE id > :last_seen_id ORDER BY id LIMIT 20;
```

- 클라이언트가 마지막 본 id 보내면 그 다음부터.
- 항상 인덱스 lookup 1회 + 20 row.

### 보너스 2: COUNT(*) 대안

전체 페이지 수가 필요하면:
- 정확 X, 추정으로 충분하면: `SHOW TABLE STATUS LIKE 'orders'` → `Rows` (대략).
- 또는 별도 카운터 테이블 + 트리거.

## 코드 리뷰 체크리스트 (msa PR 에 활용)

```
☐ WHERE 절에 함수/캐스트 없는가 (DATE(), LOWER(), 숫자 vs 문자열)
☐ 복합 인덱스 leftmost 만족하는가
☐ 부정 조건 (<>, NOT IN) 이면 인덱스 효과 의심
☐ OR 의 양쪽 모두 인덱스 있는가 (없으면 UNION 분해 검토)
☐ LIKE 에 leading % 없는가
☐ ORDER BY 가 인덱스 정렬과 일치하는가
☐ 큰 OFFSET 페이징 안 쓰는가 (keyset 으로)
☐ EXPLAIN 의 type 이 range 이상인가
☐ Extra 에 Using filesort/temporary 없는가
```

## msa 의 가능성 있는 안티패턴

### Wishlist 의 자연어 검색?

`wishlist` 는 검색 기능 미제공. 안전.

### Order 의 status 단독 인덱스

```sql
INDEX idx_orders_status (status)
```

- selectivity 낮음 → 거의 ALL 회귀.
- 운영에서 안 탐. **인덱스 제거 후보** (17 에서).

### Member 의 email 검색?

```sql
SELECT * FROM members WHERE email = ?
```
- email 인덱스 없음! `uk_sso (sso_provider, sso_provider_id)` 만 UNIQUE.
- email 검색이 자주 쓰이면 추가 후보 — 그러나 SSO 기반이라 외부에서 email 직접 검색은 별로 없을 듯. (15 에서.)

### Code-Dictionary 의 `concept_id VARCHAR(100) UNIQUE`

`concept_id` 가 유의미한 식별자라 외부에서 자주 검색. UNIQUE 인덱스로 충분. ✅

## 멘탈 모델

> 인덱스는 **정렬된 책의 색인**. 색인의 순서를 깨는 모든 행위 (함수 적용, 부정 조건, 양쪽 와일드카드, leftmost 위반) 가 무효화. "원래 컬럼 값" 그대로 비교하는 쿼리만 인덱스가 살린다.

## 핵심 포인트

- **함수 적용 = 인덱스 무효** — 범위로 변환 또는 함수 인덱스.
- **타입 캐스트** 도 함수 적용과 같은 효과.
- **Leftmost prefix** 룰 위반 시 skip scan 만 잠재적 활용.
- **부정 조건** (<>, NOT IN) 은 거의 항상 ALL.
- **IS NULL** 은 활용 가능 — outbox 같은 selectivity 높은 케이스.
- **OR** 양쪽 모두 인덱스 또는 UNION 분해.
- **LIKE 의 leading %** 는 절대 안 됨 → 외부 검색 엔진.
- **Range 후 컬럼** 활용 X — 컬럼 순서 재설계.
- **ORDER BY mismatch** = filesort.
- **OFFSET 페이징 → Keyset**.

## 다음 학습
- [12-statistics-optimizer.md](12-statistics-optimizer.md) — 옵티마이저가 인덱스 무시할 때
- [15-msa-queries.md](15-msa-queries.md) — msa 쿼리에서 안티패턴 후보 식별
