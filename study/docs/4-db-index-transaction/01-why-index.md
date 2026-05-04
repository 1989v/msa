---
parent: 4-db-index-transaction
seq: 01
title: 인덱스가 왜 필요한가 — Full Table Scan vs Index Seek
type: deep
created: 2026-05-01
---

# 01. 인덱스가 왜 필요한가 — Full Table Scan vs Index Seek

## 핵심 정의

- **Full Table Scan (FTS)**: 테이블의 모든 row 를 순서대로 읽으면서 WHERE 조건을 evaluate. EXPLAIN 의 `type = ALL`.
- **Index Seek/Range Scan**: 인덱스 트리를 따라 일치 row(들) 의 위치만 곧장 찾아 읽음. EXPLAIN 의 `type = const | eq_ref | ref | range`.

인덱스의 본질은 "**O(log N) 트리로 디스크 페이지 진입점을 찾는 것**". 디스크는 페이지 단위로만 읽힌다는 물리 제약이 모든 의사결정을 결정한다.

## 왜 디스크 페이지가 결정적인가

### 페이지 단위 IO

- InnoDB 의 기본 페이지 = **16 KiB**. 한 페이지에 row 가 수십~수백 개.
- "1 row 만 읽고 싶어" 도 OS/디스크는 페이지 통째로 읽음. 메모리에 올린 뒤 그 안에서 row 를 찾는다.
- HDD: random IO (Input/Output, 입출력) 한 번 = ~10ms (seek + rotational). SSD: ~0.1ms 이지만 latency 는 여전히 메모리 접근 (~100ns) 의 1000 배.

### 비용 모델 (단순화)

행 N = 100,000,000 (1억), 한 페이지 row = 100, 따라서 페이지 P = 1,000,000.

| 작업 | 페이지 IO | 디스크 (10ms 가정) | SSD (0.1ms 가정) |
|---|---|---|---|
| Full Table Scan | 1,000,000 페이지 | 10,000 초 (≈ 2.7 시간) | 100 초 |
| B+Tree depth 4 lookup | 4 페이지 | 40 ms | 0.4 ms |

같은 1 row 조회인데 **6~7 자릿수** 차이. 인덱스가 "약간 빠르게" 가 아니라 "차원이 다르게" 빠른 이유.

### 메모리/Buffer Pool 가정

물론 buffer pool 에 페이지가 캐시되어 있으면 IO 안 일어난다. 그러나:
- working set 이 buffer pool (보통 RAM 의 70-80%) 보다 크면 cache miss 발생.
- **인덱스 페이지는 항상 buffer pool 우선 거주** — 작고 자주 쓰이므로 LRU 에서 살아남음. 데이터 페이지(leaf) 는 evict 되기 쉬움.
- 그래서 "인덱스 + cluster lookup" 의 random IO 를 줄이는 패턴이 중요 (covering index — 03/10 에서).

## 트리가 아니라 정렬 배열은 안 되나

- 정렬 배열에서 binary search = O(log N) 으로 같다.
- 단점: **삽입이 O(N)**. 1억 행 테이블에 INSERT 하나마다 평균 5천만 row 시프트? 불가.
- → 자가 균형 트리 필요. 단순 BST 는 skewed 되면 O(N), AVL/Red-Black 도 노드당 페이지 진입 횟수가 너무 많음 (depth 가 log₂N ≈ 27).
- → 한 노드에 여러 키를 넣어 **fanout 을 페이지 크기에 맞춘** B-Tree. 1억 행도 depth 3-4. (자세히 02 에서.)

## "그럼 모든 컬럼에 인덱스 박으면 안 되나"

안 된다. 인덱스에는 비용이 있다.

### 비용 1: Write Amplification

```
INSERT INTO orders (...) VALUES (...);
```
- clustered index (PK) 1번 쓰기.
- secondary index N 개 → 각각 leaf 페이지 갱신 (+ 분할 가능).
- **WAL (Write-Ahead Log, 선기록 로그 — redo log) 도 N+1 번 기록**.

쓰기 빈도 높은 OLTP 에서 secondary index 가 5개 → 7개로 늘면 INSERT 처리량 ~30% 하락이 흔함.

### 비용 2: 디스크/메모리 공간

각 secondary index 는 (인덱스 컬럼들 + PK (Primary Key, 기본 키)) 의 사본. PK 가 길면 (UUID 36byte, BIGINT 8byte) 인덱스 N 개에 모두 PK 가 박힘 → 공간 폭증.

### 비용 3: 옵티마이저 혼란

인덱스가 너무 많으면 옵티마이저가 잘못된 인덱스를 고를 확률 ↑. 통계가 stale 하면 더 자주 사고. (12 에서 자세히.)

### 비용 4: DDL (Data Definition Language) 비용

`CREATE INDEX` 자체가 분 ~ 시간 단위. Online DDL 도 무료가 아니다. (13 에서.)

## "그럼 인덱스를 언제 만드나"

면접에서 자주 나오는 trade-off 답변 표:

| 만든다 | 만들지 않는다 |
|---|---|
| WHERE/JOIN/ORDER BY 에 자주 등장 | DML 위주, READ 거의 없음 |
| selectivity 높음 (cardinality / N > 0.1) | enum, boolean 같은 cardinality 낮은 컬럼 단독 |
| 결과 row 수가 전체의 ~10% 이하 | 전체의 30% 이상 골라야 하는 조건 (옵티마이저가 ALL 선택) |
| 정렬/그룹핑 비용이 큰 컬럼 | 한두 번만 쓰는 ad-hoc 쿼리 |

> **rule of thumb**: 결과 row 가 전체의 **~25% 미만**이면 인덱스가 보통 이긴다 (random IO 가 많아도). 그 이상이면 옵티마이저가 알아서 ALL 선택.

## msa 사례로 보는 selectivity

`product/app/.../V1__create_products_table.sql`:

```sql
INDEX idx_products_status (status)
```

ProductStatus 가 `ON_SALE / OUT_OF_STOCK / DELETED` 3개라면 평균 selectivity = 1/3. 1억 상품 중 3300만 row 가 ON_SALE.

- `WHERE status = 'ON_SALE'` → 인덱스 안 탄다 (옵티마이저가 ALL 선택). FTS 가 더 빨라.
- `WHERE status = 'DELETED'` (희귀) → 인덱스가 이긴다.

→ status 단독 인덱스는 status 별 분포가 매우 편향되어 있을 때만 유효. **(status, created_at)** 복합으로 만드는 게 일반적인 답 (10 에서).

## 인덱스 없이 빠를 수 있는 경우

- **Tiny 테이블** (수백 row): 페이지 1-2 개. 인덱스가 오히려 부담.
- **Hot working set 이 buffer pool 에 다 들어감**: cache hit 만으로 ms 단위.
- **Bulk 분석** (`SELECT COUNT(*) FROM big GROUP BY country`): 어차피 전체 스캔 + 집계. 인덱스 무용지물 — 대신 columnar engine (ClickHouse) 으로 옮긴다 (msa analytics 가 그 패턴).

## Buffer Pool 과 working set 의 정량적 감각

InnoDB buffer pool 의 기본은 RAM 의 50-75% (운영은 70-80%). 일반적으로:

```
buffer_pool_size = 64 GB
hot_set (자주 쓰이는 인덱스 + 데이터) ≤ 64 GB → cache hit ratio > 99%
```

`SHOW ENGINE INNODB STATUS` 의 `Buffer pool hit rate` (1000/1000 이 만점). 990 이하면 working set > buffer pool.

→ "왜 인덱스가 빠른가" 의 진짜 답은 "**인덱스 페이지가 buffer pool 에 거의 항상 살아 있어서**". 운영 진단 1순위는 buffer pool 사이즈 vs working set 비교.

## 인덱스 추가 결정 흐름도

```
새 쿼리 발견
   │
   ▼
EXPLAIN 결과 type=ALL?
   │
   ├── No → 끝 (이미 인덱스 잘 활용)
   │
   └── Yes
        │
        ▼
   결과 row 수 / 전체 row 수 < 25%?
        │
        ├── No → 인덱스 안 만들고 ALL 유지
        │
        └── Yes
             │
             ▼
        WHERE/ORDER BY 컬럼 추출
             │
             ▼
        selectivity 검증 (cardinality 측정)
             │
             ▼
        복합 인덱스 vs 단독 인덱스 결정 (10 에서)
             │
             ▼
        write 빈도 추정 (인덱스 추가 비용)
             │
             ▼
        EXPLAIN ANALYZE (예측) → 운영 적용 → 측정
```

## 멘탈 모델

> "인덱스는 책의 색인. 1000 페이지 책에서 '색인' 이라는 단어 찾을 때 본문 1페이지부터 끝까지 읽지 않고 책 뒤 색인 → 페이지 번호 → 그 페이지로 직행. 단, 색인 만들고 유지하는 데도 종이가 든다."

## 핵심 포인트

- 디스크는 **페이지 단위** → random IO 1번 = HDD 10ms / SSD 0.1ms. FTS 와 Index Seek 의 차이는 6-7 자릿수.
- 인덱스는 공짜가 아님 — write amplification, 공간, 옵티마이저 혼란.
- **selectivity 25% 룰** — 결과 비율이 그 이상이면 옵티마이저가 인덱스 무시.
- buffer pool 에 cache 된 경우는 IO 비용이 사라짐 → 그래서 working set 사이즈가 RAM 안에 들어가는지 확인이 1순위.
- enum/boolean 같은 저-카디널리티 컬럼은 단독 인덱스 금지 — 복합으로 묶거나 partial 로.

## 다음 학습
- [02-btree-bplustree.md](02-btree-bplustree.md) — 왜 B+Tree 인가, 정확한 구조와 fanout
- [03-clustered-vs-secondary.md](03-clustered-vs-secondary.md) — InnoDB 의 clustered/secondary 가 모든 결정을 어떻게 좌우하는지
