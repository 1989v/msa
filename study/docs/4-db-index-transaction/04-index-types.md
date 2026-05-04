---
parent: 4-db-index-transaction
seq: 04
title: B-Tree 외 인덱스 종류 — Hash / Bitmap / Spatial / Fulltext
type: deep
created: 2026-05-01
---

# 04. B-Tree 외 인덱스 종류 — Hash / Bitmap / Spatial / Fulltext

## 핵심 정의

OLTP RDBMS 의 기본은 B+Tree. 그러나 특정 쿼리 패턴엔 다른 자료구조가 압도적이다. 면접 질문 ("hash index 는 왜 안 쓰나요?") 에 답하려면 각 변형의 trade-off 를 알아야 한다.

| 인덱스 | 자료구조 | 강점 | 약점 | MySQL/InnoDB 지원 |
|---|---|---|---|---|
| B+Tree | tree | =, IN, 범위, 정렬 | random insert 분할 | ✅ (기본) |
| Hash | hash table | = 만, O(1) | 범위/정렬 X | △ (MEMORY 엔진, AHI) |
| Bitmap | row-bitmap | 저-카디널리티 AND/OR | concurrent update 충돌 | ❌ (Oracle/Postgres-only) |
| Spatial (R-Tree) | r-tree | 2D 영역 검색 | scalar 검색 X | ✅ (SPATIAL INDEX) |
| Fulltext (역색인) | inverted | 자연어 토큰 검색 | LIKE/정렬 X | ✅ (FULLTEXT INDEX) |
| GiST/GIN | tree/inverted | JSONB, array, fuzzy | overhead | Postgres 전용 |
| LSM | sstable | 쓰기 throughput | read amplification | RocksDB/Cassandra |

## Hash 인덱스

### 구조

```
key → hash(key) → bucket → [row pointers...]
```

- `WHERE id = 5` → O(1) (이론).
- `WHERE id > 5` → 모든 bucket 스캔. **범위 쿼리 X**.
- `ORDER BY id` 도 X. hash 는 순서가 없다.

### MySQL 에서

- **MEMORY 엔진** 의 기본 인덱스가 hash. 그러나 MEMORY 엔진 자체를 OLTP 에 거의 안 씀.
- **InnoDB Adaptive Hash Index (AHI)**: InnoDB 가 자주 쓰이는 B+Tree 페이지에 자동으로 hash table 을 만들어줌. 켜고 끄기: `innodb_adaptive_hash_index = ON | OFF`.
  - 효과: 특정 PK 단건 조회가 O(1).
  - 부작용: AHI 의 mutex 가 hot lock 이 되어 멀티 코어 환경에서 오히려 느려짐. 고동시성 환경에선 끄는 게 답인 경우 흔함.
- **Postgres** 는 hash index 를 명시 생성 가능 (`CREATE INDEX ... USING HASH`) but 추천 빈도 낮음.

### 면접 답변 템플릿

> "B-Tree 가 = 와 범위/정렬을 모두 커버하기 때문에 hash 의 = 전용 이점은 작고, 범위 쿼리 비중이 큰 OLTP 에선 hash 만 쓰면 다른 모든 쿼리가 풀스캔이 됩니다. 그래서 InnoDB 는 B+Tree 를 기본으로 쓰고, 핫스팟 PK 조회만 AHI 로 자동 캐싱합니다."

## Bitmap 인덱스

### 구조

각 distinct value 마다 row count 만큼의 bit vector.

```
status='ACTIVE'  : 1 0 1 1 0 1 0 ...   (전체 row 수만큼)
status='DELETED' : 0 1 0 0 1 0 1 ...
```

- AND/OR 가 **bit 연산** 으로 끝남. CPU SIMD 친화.
- 저-카디널리티 컬럼 (status, gender, region) 에 압도적.
- 1억 row × 4 bit = 50MB → 인덱스가 매우 작음.

### 약점 — DML 거의 불가

- 한 row 가 update 되면 모든 bitmap 갱신.
- bitmap lock 단위가 매우 크고 동시성 X.
- → **OLAP / DW 전용**. OLTP 에는 부적합.

### MySQL/InnoDB 는 지원 안 함

- Oracle, PostgreSQL (`bitmap heap scan` 은 다른 개념), DB2 가 명시 지원.
- MySQL 은 BITMAP 키워드 없음. 대안:
  1. 저-카디널리티 컬럼 단독 인덱스 만들지 말고
  2. **(status, created_at)** 복합 또는
  3. partition 으로 분리 (status 별 파티션).

### 비슷한 기능 — Index Merge (10 에서)

여러 secondary index 결과를 RowID 비트맵 형태로 AND/OR 처리. MySQL 의 "bitmap-like" 기법.

## R-Tree (Spatial)

### 구조

2D 좌표계의 MBR (Minimum Bounding Rectangle) 트리.

```
Root: 지구 전체 사각형
├── 한국 사각형
│   ├── 서울 사각형 → 강남, 마포, ...
│   └── 부산 사각형
└── 일본 사각형
```

- "이 좌표 (lat, lng) 가 어느 다각형 안에 있나?" 같은 검색을 O(log N).
- 거리/근접 (KNN (K-Nearest Neighbors, K-최근접 이웃)) 도 효율적.

### MySQL

```sql
CREATE TABLE places (
  id BIGINT PRIMARY KEY,
  location POINT NOT NULL SRID 4326,
  SPATIAL INDEX (location)
);

SELECT * FROM places
WHERE ST_Distance_Sphere(location, POINT(127.0, 37.5)) < 1000;
```

- InnoDB 부터 SPATIAL INDEX 정상 지원 (이전엔 MyISAM 만).
- 단, **scalar = / 범위 쿼리에는 안 탐**. spatial 함수 사용해야 인덱스 사용.

### msa 사례

현재 msa 11개 서비스 모두 spatial 미사용. 향후 후보:
- `gifticon` 의 매장 위치 기반 추천 (잠재적).
- `quant` 은 시계열이라 무관.

## Fulltext (역색인)

### 구조

문서 → 토큰화 → 토큰별 (doc_id 리스트). 검색 엔진 (Lucene, ES) 의 핵심.

```
"the quick brown fox" → tokens: [quick, brown, fox] (stop words 제거)
inverted index:
  quick → doc1, doc7, doc12
  brown → doc1, doc3
  fox   → doc1, doc7, doc15
```

- AND: doc 리스트 교집합.
- OR: 합집합.
- TF-IDF (Term Frequency – Inverse Document Frequency, 용어 빈도-역문서 빈도) / BM25 (Best Match 25) 로 score 계산해 정렬.

### MySQL FULLTEXT

```sql
CREATE TABLE articles (
  id BIGINT PRIMARY KEY,
  title VARCHAR(200),
  body TEXT,
  FULLTEXT KEY ft_title_body (title, body)
);

SELECT * FROM articles
WHERE MATCH(title, body) AGAINST('mysql index' IN NATURAL LANGUAGE MODE);
```

- 한국어 형태소 미지원 (ngram 토크나이저는 가능). 한국어 검색 품질 낮음.
- → 한국어 검색은 거의 항상 **Elasticsearch / OpenSearch** 사용.
- msa 에선 `search` 서비스가 ES (Elasticsearch), `code-dictionary` 가 OpenSearch 사용.

### LIKE 와의 비교

```sql
WHERE body LIKE '%mysql%'
```
- 앞 % → 인덱스 못 탐. 풀스캔.
- → fulltext 인덱스 또는 외부 검색 엔진 필수.

## 함수 / 표현식 인덱스 (Generated / Expression Index)

### MySQL 8

```sql
-- (a) generated column + 그 컬럼에 인덱스
ALTER TABLE orders
  ADD COLUMN created_date DATE GENERATED ALWAYS AS (DATE(created_at)) VIRTUAL,
  ADD INDEX idx_created_date (created_date);

-- (b) MySQL 8.0.13+ : 직접 표현식 인덱스
CREATE INDEX idx_lower_email ON users ((LOWER(email)));
```

쿼리:
```sql
SELECT * FROM orders WHERE DATE(created_at) = '2026-05-01';
-- (a) 또는 (b) 인덱스 → 자동 매칭
```

- 11 (안티패턴) 에서 다시: **WHERE 절 함수 적용은 인덱스 무효** 가 기본 룰. 함수 인덱스가 그 예외.

## Partial Index (Postgres 만)

```sql
CREATE INDEX idx_active_orders ON orders(user_id)
WHERE status = 'ACTIVE';
```

- 조건에 맞는 row 만 인덱싱. 인덱스 크기 ↓ + buffer pool 효율 ↑.
- MySQL 은 **미지원**. 대안: 별도 테이블 (active_orders) 분리 또는 (status, user_id) 복합 인덱스 (status 가 leftmost).

## msa 가 사용하는 인덱스 타입 매핑

| 서비스 | 사용 인덱스 | 비고 |
|---|---|---|
| order | B+Tree (idx_orders_user_id, idx_orders_status, FK (Foreign Key, 외래 키)) | OLTP 표준 |
| product | B+Tree (idx_products_status) | selectivity 낮아 거의 안 탐 |
| member | B+Tree + UNIQUE (uk_sso) | SSO (Single Sign-On, 단일 로그인) 로그인 lookup |
| wishlist | B+Tree + UNIQUE (uk_member_product) | 중복 추가 방지 |
| auth | B+Tree + UNIQUE (uk_member_role) | RBAC (Role-Based Access Control, 역할 기반 접근 제어) 중복 방지 |
| quant | B+Tree (idx_*_tenant 다수) | multi-tenant 패턴 |
| code-dictionary | B+Tree | 검색은 OpenSearch 가 담당 |
| analytics | ClickHouse (skip index, primary index) | OLAP — 전혀 다른 모델 |
| search | Elasticsearch (Lucene 역색인) | OLTP 인덱스 X |

→ msa 는 **OLTP 는 InnoDB B+Tree**, **검색은 ES/OpenSearch**, **분석은 ClickHouse** 로 역할 분리. 옳은 패턴.

## 핵심 포인트

- **B+Tree 가 OLTP 표준** — = 와 범위와 정렬을 모두 커버.
- **Hash**: O(1) 이지만 범위 X — InnoDB AHI 가 자동 처리. 직접 만들 일 없음.
- **Bitmap**: OLAP 전용. MySQL 미지원. msa 의 analytics 는 ClickHouse 로 해결.
- **R-Tree (Spatial)**: 좌표 기반. ST_* 함수로만 인덱스 사용.
- **Fulltext (역색인)**: 자연어 검색. 한국어는 ES/OpenSearch 가 답.
- **함수 인덱스**: WHERE 함수 적용 안티패턴의 정식 우회법 (11 에서).
- **Partial index**: Postgres 전용. MySQL 은 별도 테이블/복합 인덱스로 대체.

## 다음 학습
- [05-acid-isolation.md](05-acid-isolation.md) — 트랜잭션 ACID 와 격리 4단계
- [11-anti-patterns.md](11-anti-patterns.md) — 함수 인덱스가 해결하는 안티패턴
