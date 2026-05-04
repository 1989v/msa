---
parent: 4-db-index-transaction
seq: 99
title: DB 인덱스 + 트랜잭션 개념 카탈로그 — Full-Coverage Index + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://dev.mysql.com/doc/refman/8.4/en/
  - https://dev.mysql.com/doc/refman/8.4/en/innodb-storage-engine.html
  - https://www.postgresql.org/docs/current/
---

# 99. DB 인덱스 + 트랜잭션 개념 카탈로그

> **목적** — 4-db-index-transaction 의 18+ deep file 매트릭스 + MySQL 8.4 / PostgreSQL 공식 기준 빠진 영역 (window function, GIN/GIST/BRIN, generated column, partitioning, Online DDL 의 lock-free option, group replication 등) 발굴.

---

## 0. 사용법

`19/99 §0` 와 동일.

---

## 1. 기존 커버 매트릭스 (요약)

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| 인덱스 | B+Tree, primary/secondary, covering, MRR, ICP | ✅ |
| MVCC | InnoDB undo, read view, snapshot isolation | ✅ |
| Lock | record/gap/next-key, intention lock, MDL (Metadata Lock) | ✅ |
| Transaction | isolation level (RU/RC/RR/Serializable), 2PC | ✅ |
| Deadlock | 진단, 회피 | ✅ |
| 실행 계획 | EXPLAIN, EXPLAIN ANALYZE | ✅ |
| 안티패턴 | N+1, OFFSET pagination, dynamic IN-list | ✅ |
| Online DDL | ALGORITHM=INSTANT/INPLACE/COPY | ✅ |
| Statistics / Optimizer | histogram, persistent stats | ✅ |
| msa entities / queries / TX routing | 적용 | ✅ |
| Online DDL 심화 | INSTANT/INPLACE/COPY / gh-ost / pt-osc / PG CREATE INDEX CONCURRENTLY | ✅ 커버 ([20](20-online-ddl-deep.md)) |
| Deadlock 안티패턴 | 4 조건 / wait-for graph / SHOW ENGINE INNODB STATUS / SKIP LOCKED / 회피 | ✅ 커버 ([21](21-deadlock-anti-patterns.md)) |

### 1-A. 갭 진단

1. **Window functions** — OVER / PARTITION / RANK / DENSE_RANK / ROW_NUMBER / LAG/LEAD
2. **CTE (Common Table Expression)** + Recursive CTE
3. **Generated columns / Stored vs Virtual**
4. **Partitioning** — RANGE / LIST / HASH / KEY + partition pruning
5. **JSON 함수 / JSON_TABLE** (MySQL 8) / JSONB (PG)
6. **Full-text search** (MySQL FT, PG tsvector)
7. **Spatial** (MySQL ST_*, PG PostGIS)
8. **Replication** — async / semi-sync / Group Replication / GTID / Read Replica routing
9. **InnoDB Cluster / Galera** — multi-primary
10. **Buffer pool tuning** — `innodb_buffer_pool_size`, dump/load, NUMA
11. **Redo log / Doublewrite buffer** — durability
12. **Adaptive Hash Index** (MySQL)
13. **InnoDB Cluster — MGR (Group Replication)**
14. **Row format** (DYNAMIC / COMPRESSED / REDUNDANT / COMPACT) + variable-length
15. **Tablespace 종류** (file-per-table, system, general, undo, temporary)
16. **Cluster Index 의 정렬 영향 + Random key (UUIDv4) 의 함정 + UUIDv7 권장**
17. **Sub-second binlog scan / parallel applier**
18. **Online DDL — INSTANT 의 한계 + ALGORITHM=COPY 의 ROW lock 사용**
19. **Histograms (column statistics)** + CARDINALITY 추정
20. **Query rewriter / SQL Plan Management**
21. **Performance Schema / sys schema** — DBA tools
22. **Statement-based vs Row-based Replication**
23. **Lock-free option for Online DDL** (binlog-aware)
24. **PostgreSQL 특화** — MVCC heap + visibility map, vacuum + bloat, GIN / GiST / BRIN / SP-GiST, hot/cold update, HOT (Heap-Only Tuple)
25. **PostgreSQL Logical replication / pglogical / Debezium connector**

---

## 2. 카테고리별 개념 트리

### A. 인덱스 자료구조

| 개념 | 정의 | 링크 | 상태 |
|---|---|---|---|
| B+Tree (clustered, secondary) | InnoDB 표준 | dev.mysql.com/innodb-index-types | ✅ |
| Hash Index | Memory engine, Adaptive Hash Index | docs | 🟡 |
| Full-text Index (FT) | MyISAM/InnoDB FT | docs | ★ 신규 |
| Spatial Index (R-Tree) | geo | docs | ★ 신규 |
| **GIN / GiST / BRIN / SP-GiST** (PG) | 종류별 적합 워크로드 | postgresql/indexes-types | ★ 신규 |
| Covering index | secondary 가 SELECT 모두 포함 | dev.mysql.com | ✅ |
| Multi-column index + leftmost prefix | 사용 조건 | docs | ✅ |
| Index Condition Pushdown (ICP) | filter 일부 storage 로 | docs | ✅ |
| Multi-Range Read (MRR) | secondary → primary 정렬 fetch | docs | ✅ |
| Adaptive Hash Index | InnoDB 의 자동 hash | docs | ★ 신규 |

### B. 트랜잭션 / Isolation / MVCC

| 개념 | 정의 | 상태 |
|---|---|---|
| Isolation Levels (RU/RC/RR/SER) | ANSI 4 + InnoDB RR 특이성 | ✅ |
| MVCC (snapshot read) | InnoDB undo log + read view | ✅ |
| Phantom read 정의 | gap lock 으로 RR 에서도 회피 | ✅ |
| Lost update / Write skew | SER 로만 회피 | 🟡 |
| Consistent Read vs Locking Read | SELECT vs SELECT FOR UPDATE | ✅ |
| **PostgreSQL 의 MVCC heap + visibility map** | 다른 구현 — vacuum 의 이유 | ★ 신규 |
| **HOT (Heap-Only Tuple)** (PG) | secondary 인덱스 갱신 회피 | ★ 신규 |
| 2PL (Two-Phase Locking) | 이론 모델 | 🟡 |
| 2PC (Two-Phase Commit) | 분산 — XA, but 운영상 회피 | ✅ |
| Saga 패턴 (#7 cross) | 보상 트랜잭션 | ✅ (#7) |

### C. Lock

| 개념 | 정의 | 상태 |
|---|---|---|
| Record lock / Gap lock / Next-key lock | InnoDB 3종 | ✅ |
| Intention Lock (IS / IX) | 다단 lock의 안내 | ✅ |
| Auto-increment lock modes (0/1/2) | concurrent insert 영향 | ✅ |
| **MDL (Metadata Lock)** | DDL 안전 — long-running TX 위험 | ✅ |
| Deadlock 진단 (`SHOW ENGINE INNODB STATUS`) | 분석 절차 | ✅ |
| Lock wait timeout / lock_wait_timeout | 분리 | ✅ |
| Pessimistic vs Optimistic lock | 패턴 | ✅ |

### D. 실행 계획 / 옵티마이저

| 개념 | 정의 | 상태 |
|---|---|---|
| EXPLAIN / EXPLAIN ANALYZE / EXPLAIN FORMAT=JSON | tree | ✅ |
| Optimizer trace | `optimizer_trace` ON | 🟡 |
| Histograms | column-level distribution | ✅ |
| Persistent statistics | `innodb_stats_persistent` | ✅ |
| Hint / Optimizer hints | `SELECT /*+ INDEX(...) */ ...` | 🟡 |
| Query Rewriter | 8.x plugin | ★ 신규 |
| **Window functions** (`OVER (PARTITION BY ... ORDER BY ...)`) | 분석 쿼리 표준 | ★ 신규 |
| **CTE (WITH)** + Recursive | 가독성 / 트리 순회 | ★ 신규 |
| **Generated columns** (Stored vs Virtual) | indexed expression | ★ 신규 |

### E. JSON / Spatial / Full-text / 특수 컬럼

| 개념 | 정의 | 상태 |
|---|---|---|
| MySQL JSON / JSON_TABLE | 8.0+ 함수 풀세트 | ★ 신규 |
| PostgreSQL JSONB / json operators | GIN 색인 | ★ 신규 |
| MySQL Full-Text (FT) | NATURAL/BOOLEAN mode | ★ 신규 |
| PG tsvector / tsquery | text search | ★ 신규 |
| MySQL Spatial (ST_*) / GIS | geo | ★ 신규 |
| PostGIS | PG 표준 | ★ 신규 |

### F. 파티셔닝 / 샤딩

| 개념 | 정의 | 상태 |
|---|---|---|
| Partitioning (RANGE / LIST / HASH / KEY) | 단일 테이블 분할 | ★ 신규 |
| Partition pruning | optimizer 가 파티션 skip | ★ 신규 |
| Sharding (app-level) | 다중 DB 분산 | 🟡 (#7) |
| Vitess / Citus | 자동 샤딩 솔루션 | skip (별 도구) |

### G. 복제 / HA

| 개념 | 정의 | 상태 |
|---|---|---|
| Statement-based vs Row-based Replication (SBR/RBR/MIXED) | binlog format | ★ 신규 |
| Async / Semi-sync replication | 보장 차이 | 🟡 |
| GTID (Global Transaction ID) | replication 신뢰성 표준 | 🟡 |
| Group Replication / InnoDB Cluster | multi-primary 옵션 | ★ 신규 |
| Galera (Percona/MariaDB) | sync replication | ★ 신규 |
| Read Replica routing | (#5 / #15 cross) | ✅ |
| Logical replication (PG) | pglogical / Debezium | ★ 신규 |

### H. Online DDL

| 개념 | 정의 | 상태 |
|---|---|---|
| ALGORITHM=INSTANT (8.0+) | metadata only | ✅ |
| ALGORITHM=INPLACE | online | ✅ |
| ALGORITHM=COPY | rebuild — 마지막 수단 | ✅ |
| LOCK= NONE / SHARED / EXCLUSIVE | 동시 DML 영향 | ✅ |
| **gh-ost / pt-online-schema-change** | external tool | ✅ 커버 ([20](20-online-ddl-deep.md)) |
| pg_repack (PG) | bloat 회피 | ★ 신규 |

### I. 운영 / 진단

| 개념 | 정의 | 상태 |
|---|---|---|
| Performance Schema / sys schema | DBA tools | ★ 신규 |
| Slow query log | 임계 초과 추적 | ✅ |
| `SHOW ENGINE INNODB STATUS` | deadlock / buffer / IO | ✅ |
| Buffer pool size / dump-load | warm-up | ★ 신규 |
| Redo log / Doublewrite buffer | durability | ★ 신규 |
| Backup (Xtrabackup / mysqldump / mydumper) | 도구 비교 | 🟡 |
| Point-in-Time Recovery (PITR) — binlog | 복구 | 🟡 |
| **PG vacuum / autovacuum / bloat** | 필수 운영 | ★ 신규 |
| **PG WAL + replication slot** | 복제 토대 | ★ 신규 |

### J. UUID / 키 설계

| 개념 | 정의 | 상태 |
|---|---|---|
| UUIDv4 (random) — clustered index 함정 | leaf 폭발 | 🟡 |
| **UUIDv7** (time-ordered) | 권장 | ★ 신규 |
| ULID / Snowflake | 분산 ID 대안 | 🟡 |
| Auto-increment + 분산 함정 | duplicate / hot shard | ✅ |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **Window functions + CTE** | 분석 쿼리 표준 — analytics 와 cross |
| 2 | **Generated columns + indexed expression** | 검색·정렬 인덱스 가속 |
| 3 | **MySQL Partitioning** | 대용량 테이블 운영 진입 |
| 4 | **PostgreSQL MVCC + vacuum/bloat** | PG 운영 필수 |
| 5 | **GIN/GiST/BRIN (PG)** | 다양한 워크로드 인덱스 |
| 6 | **UUIDv7 / ULID** | 분산 ID 표준 변경 |
| 7 | **Group Replication / InnoDB Cluster** | HA / Multi-Primary 진입 시 |
| 8 | **Statement vs Row-based Replication + GTID** | CDC / Debezium 와 직결 (#19 #14) |
| 9 | **JSON/JSONB + 함수** | semi-structured 처리 |
| 10 | **Performance Schema / sys schema 활용** | DBA 진단 표준 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. DB 특화:
- §3 → "MySQL vs PostgreSQL 등가 표" 1개
- §6 → "InnoDB vs PG MVCC 차이" / "MySQL vs PG 트랜잭션 격리 차이"
- §7 → 메트릭 (P_S, slow log, redo log)
- §8 → msa entities / repository / TX routing 코드 grounding

---

## 5. 참고 자료

- MySQL 8.4: https://dev.mysql.com/doc/refman/8.4/en/
- PostgreSQL: https://www.postgresql.org/docs/current/
- "High Performance MySQL" (Schwartz, Zaitsev, Tkachenko)
- "Designing Data-Intensive Applications" (Kleppmann) — Chapter 7-9
- "PostgreSQL Internals" (PG 공식 + 커뮤니티 자료)
- Use The Index, Luke: https://use-the-index-luke.com/
