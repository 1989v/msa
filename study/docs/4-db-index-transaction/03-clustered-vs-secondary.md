---
parent: 4-db-index-transaction
seq: 03
title: 클러스터드 vs 세컨더리 인덱스 — InnoDB 의 결정적 특징
type: deep
created: 2026-05-01
---

# 03. 클러스터드 vs 세컨더리 인덱스 — InnoDB 의 결정적 특징

## 핵심 정의

- **Clustered Index (클러스터드 인덱스)**: 테이블 데이터 자체가 인덱스의 leaf. **테이블이 곧 인덱스**. InnoDB 의 PK.
- **Secondary Index (세컨더리 인덱스)**: leaf 가 **PK 값**을 들고 있는 별도 B+Tree. 데이터 row 가 아님.

이 한 줄이 InnoDB 의 모든 성격을 결정한다. 면접 단골 ("InnoDB 는 왜 PK 가 중요해요?") 에 답하려면 leaf 그림을 머리에 그려야 한다.

## 다이어그램 — orders 테이블 예시

```
Clustered Index (PK = id)
┌─────────────────────────────────────────────────┐
│ Internal nodes: id 분기 키                      │
└─────────────────┬───────────────────────────────┘
                  ▼
┌──────────────────────────────────────────────────┐
│ Leaf 페이지 (실제 row 데이터)                    │
│ id=1 | user_id=alice | status=PAID | created_at  │
│ id=2 | user_id=bob   | status=NEW  | created_at  │
│ id=3 | user_id=alice | status=PAID | created_at  │
└──────────────────────────────────────────────────┘

Secondary Index on user_id (idx_orders_user_id)
┌─────────────────────────────────────────────────┐
│ Internal nodes: user_id 분기 키                 │
└─────────────────┬───────────────────────────────┘
                  ▼
┌──────────────────────────────────────────────────┐
│ Leaf 페이지 (인덱스 entry = user_id + PK)        │
│ alice → 1  (PK 값)                              │
│ alice → 3                                        │
│ bob   → 2                                        │
└──────────────────────────────────────────────────┘
```

**보조 인덱스의 leaf 는 PK 값**. 행 위치 (rowid/페이지번호) 가 아니라 **논리 키**.

## "왜 PK 값을 보조 인덱스 leaf 에 넣나"

대안: leaf 에 **물리 row 위치 (RID = page#, slot#)** 를 넣을 수도 있다 (MyISAM 이 이렇게).

- 단점: row 가 page split 으로 옮겨지면 모든 secondary index 가 RID 갱신 필요 → cascading update 폭발.
- InnoDB 의 PK 는 논리 키 → row 가 어느 페이지로 이사 가도 PK 는 그대로. secondary index 는 안전.

## 결과 1 — 보조 인덱스 조회는 2단계

`SELECT * FROM orders WHERE user_id = 'alice'`

1. `idx_orders_user_id` 트리에서 alice 찾음 → leaf 에서 PK 1, 3 발견.
2. **clustered index 트리에서 PK 1, 3 으로 다시 lookup** → 실제 row 가져옴.

이걸 **lookup (또는 random IO 룩업)** 이라 한다. row 가 N 개면 lookup 도 N 번.

### 예 — 100만 row 결과 시 비용

```
secondary index leaf scan: 1000 페이지 (sequential, fast)
clustered index lookup: 1,000,000 random IO !!
```

→ 결과 row 가 많으면 secondary index 가 **오히려 FTS 보다 느릴 수 있다**. 옵티마이저는 이 비용을 계산해서 ALL 로 회귀 (12 에서 다시).

## 결과 2 — Covering Index 의 의미

`SELECT user_id FROM orders WHERE user_id = 'alice'`

- secondary index leaf 에 user_id + PK 가 다 있음 → clustered lookup 불필요.
- EXPLAIN 의 Extra 에 **Using index** 표시. covering 이라 부른다.

`SELECT user_id, status FROM orders WHERE user_id = 'alice'`

- status 는 leaf 에 없음 → clustered lookup 발생. covering 안 됨.
- 인덱스를 **(user_id, status)** 로 만들면 covering — leaf 에 user_id, status, PK 다 존재.

> Covering 은 단순 최적화 기교가 아니라, **leaf 가 PK 값** 이라는 InnoDB 구조의 직접 결과. (10 에서 자세히.)

## 결과 3 — PK 길이가 모든 보조 인덱스 크기에 영향

PK = BIGINT (8B) vs PK = UUID(36B 또는 binary 16B):

- secondary index 가 5개 있으면 PK 가 5번 박힘.
- 1억 행 + UUID(36) → secondary index 1개당 추가 28B × 1억 = 2.6 GB **per index**.
- → "**짧은 PK**" 가 디스크 사용량 / buffer pool 효율 / 모든 secondary index 의 fanout 에 영향.

### 권장 PK 패턴

| 패턴 | 평가 |
|---|---|
| `BIGINT AUTO_INCREMENT` | 표준. 짧고 단조 증가. msa 의 대부분 서비스가 이 패턴. |
| `BINARY(16)` (UUID 압축) | 글로벌 유니크 필요할 때. 단조 증가 보장 안 되면 분할 비용 ↑. |
| `BINARY(16)` UUIDv7 | UUID 의 글로벌성 + 시간 prefix 단조 증가. **2026 권장**. |
| VARCHAR("ORDER-ABC123") | 안 됨. 매 secondary index 가 통째로 키 복사. |

msa 사례:
- `order/V1`: `id BIGINT AUTO_INCREMENT` (표준)
- `quant/V001`: `strategy_id BINARY(16)` (도메인 가시성 위해 UUID, 단조성 보장은 어플리케이션 책임)
- `code-dictionary`: `concept_id BIGINT AUTO_INCREMENT + concept_id VARCHAR(100) UNIQUE` — 두 번째는 secondary 로 두는 게 정답인데 둘 다 인덱싱돼 있는 건 의도된 패턴.

## 결과 4 — 클러스터드 인덱스 정렬 = 물리 순서

InnoDB 는 PK 순으로 row 가 정렬되어 디스크에 저장. → **PK 범위 쿼리는 sequential IO**.

```sql
SELECT * FROM orders WHERE id BETWEEN 100 AND 1000;
-- clustered leaf 에서 옆으로 1 페이지씩 읽기. 빠름.
```

반면 secondary index 의 `WHERE created_at BETWEEN ...`:
- secondary leaf 는 created_at 순. PK 는 그 안에서 random.
- clustered lookup 은 random IO.
- → 같은 1000 row 라도 PK 범위 vs created_at 범위는 비용 차이 큼.

## 결과 5 — InnoDB 의 PK 자동 생성

`CREATE TABLE t (a INT, b INT)` — PK 명시 안 하면?

1. UNIQUE NOT NULL 인 첫 컬럼이 있으면 그걸 PK 로.
2. 없으면 InnoDB 가 6B 짜리 hidden PK (DB_ROW_ID) 를 만든다.

→ **모든 row 가 어딘가 clustered 됨**. PK 없는 테이블은 없다. 단, hidden PK 는 단순 증가 sequence 로 모든 row 가 hot 한 마지막 페이지에 몰림 → 멀티 인서트 시 mutex 경합.

## 다른 RDBMS 와의 차이

| 엔진 | 데이터 저장 | leaf 키 |
|---|---|---|
| InnoDB | clustered (PK 순) | secondary leaf = PK |
| MyISAM | heap (insertion 순) | secondary leaf = RID |
| PostgreSQL | heap | secondary leaf = ctid (page#, slot#) |
| Oracle (default) | heap | secondary leaf = ROWID |
| Oracle IOT | clustered | secondary leaf = PK |
| SQL Server | clustered (CLUSTERED 인덱스 있을 때) | PK or RID |

→ **PostgreSQL 에는 clustered 가 없다**. 그래서 secondary lookup 비용 모델이 다름. ("postgres 는 covering index 가 덜 중요하다" 같은 말이 여기서 나옴.)

## msa 코드와 직접 연결

`product/V1__create_products_table.sql`:
```sql
CREATE TABLE products (
    id BIGINT AUTO_INCREMENT,
    name VARCHAR(200),
    price DECIMAL(19, 2),
    stock INT,
    status VARCHAR(20),
    created_at DATETIME,
    PRIMARY KEY (id),
    INDEX idx_products_status (status)
);
```

- clustered: id (BIGINT AUTO_INCREMENT) — 표준. 단조 증가.
- secondary: idx_products_status — leaf = (status, id). status 단독 selectivity 낮아 거의 안 탐 (01, 11 에서).

`order/V1__create_orders_table.sql`:
```sql
INDEX idx_orders_user_id (user_id),
INDEX idx_orders_status (status)
```

- secondary 2개 — `WHERE user_id = ?` 은 잘 탐 (selectivity 높음).
- `SELECT * FROM orders WHERE user_id = 'alice'` → idx_orders_user_id 로 PK 모음 → clustered lookup.

`SELECT id, user_id FROM orders WHERE user_id = 'alice'` → covering (Using index).

`SELECT * FROM orders WHERE user_id = 'alice' AND status = 'PAID'`:
- 옵티마이저가 idx_orders_user_id 와 idx_orders_status 중 하나 선택 (보통 user_id selectivity 높음) + status 는 추가 필터.
- 더 나은 답: **(user_id, status) 복합 인덱스**. msa 가 안 만든 이유는 user_id 만으로도 충분히 좁혀지기 때문 (10 에서).

## 멘탈 모델

> 도서관 비유. **clustered** = 책이 청구기호 순으로 책장에 꽂힘. **secondary** = '저자명 → 청구기호' 색인 카드. 저자로 찾아도 결국 청구기호로 책장 가야 책 본문을 본다 (lookup). 색인 카드에 abstract 까지 적혀 있으면 책장 안 가도 됨 (covering).

## 핵심 포인트

- InnoDB: **PK = clustered**, secondary leaf = PK 값.
- 보조 인덱스 조회 = 2단계 (secondary lookup → clustered lookup) → 결과 row 많으면 비싸다.
- **Covering index**: 필요한 모든 컬럼이 secondary leaf 에 있으면 clustered lookup 생략.
- **PK 짧고 단조 증가 (BIGINT AUTO_INCREMENT 또는 UUIDv7)** 가 모든 secondary index 효율을 결정.
- PostgreSQL 에는 clustered 없음 → MySQL 면접에 한정된 트레이드오프.

## 다음 학습
- [04-index-types.md](04-index-types.md) — Hash / Bitmap / Spatial / Fulltext
- [10-composite-covering-merge.md](10-composite-covering-merge.md) — Covering 이 secondary 구조에서 어떻게 나오는지
