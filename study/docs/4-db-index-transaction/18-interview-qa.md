---
parent: 4-db-index-transaction
seq: 18
title: 면접 Q&A 카드 — 4 Phase × 8~10 카드
type: deep
created: 2026-05-01
---

# 18. 면접 Q&A 카드 — 4 Phase × 8~10 카드

## 사용법

회독용. 학습 종료 후 **1주 간격으로 2-3회** 회독. 답변은 30초 ~ 2분 분량의 구두 답변을 상정해 작성.

각 카드 형식:
- **Q**: 질문
- **A (요약)**: 30초 답변
- **A (확장)**: 2분 답변 시 추가할 내용
- **함정**: 면접관이 파고들 가능성

---

## Phase 1: 자료구조 / 기본

### Q1.1 인덱스는 왜 B-Tree (실은 B+Tree) 인가요? Hash 가 아닌 이유?

**A (요약)**: 디스크 IO 가 페이지(16KiB) 단위라서 fanout 큰 트리가 유리합니다. B+Tree 는 한 페이지에 수백~수천 키를 담아 1억 row 도 depth 3-4. Hash 는 = 만 O(1) 이지만 범위/정렬을 못 해 OLTP 의 다수 쿼리에 부적합합니다.

**A (확장)**: AVL/Red-Black 같은 binary tree 는 depth 가 log₂N 이라 1억 row 도 ~27 IO 필요. B+Tree 는 같은 1억 row 도 3-4 IO. 또 leaf 가 연결 리스트라 범위 쿼리가 트리 재탐색 없이 옆으로 쭉. InnoDB 는 자주 쓰는 페이지에 Adaptive Hash Index 를 자동으로 만들어 hash 의 이점도 일부 가져갑니다.

**함정**: "B-Tree 와 B+Tree 차이는?" → "B+Tree 는 데이터가 leaf 에만, internal 은 분기 키만, leaf 끼리 연결 리스트".

### Q1.2 InnoDB 에서 PK 가 왜 그렇게 중요해요?

**A (요약)**: InnoDB 는 **clustered index = PK** 라서 테이블 자체가 PK 순으로 정렬됩니다. secondary index 의 leaf 는 row 위치가 아니라 **PK 값** 을 보유 — secondary 조회는 항상 secondary lookup → clustered lookup 의 2 단계. PK 가 길거나 무작위면 모든 secondary index 가 비대해지고 page split 도 자주 발생합니다.

**A (확장)**: 그래서 PK 컨벤션은 짧고 단조 증가 — BIGINT AUTO_INCREMENT 또는 UUIDv7. UUIDv4 같은 랜덤은 매 INSERT 가 leaf 중간을 분할 → 페이지 채움률 50-70%, random IO ↑.

**함정**: "PostgreSQL 도 그래요?" → "아니요, Postgres 는 heap + ctid 기반이라 clustered 개념이 없습니다. MySQL 면접 한정 트레이드오프."

### Q1.3 Covering Index 가 뭔가요? 왜 빠른가요?

**A (요약)**: 쿼리가 SELECT/WHERE/ORDER BY 에서 참조하는 모든 컬럼이 secondary index leaf 에 있어 clustered lookup 이 필요 없는 경우. 같은 1000 row 결과여도 random IO 가 사라져 자릿수 단위로 빨라집니다. EXPLAIN 의 Extra 에 `Using index` 로 표시.

**확장**: MySQL 은 PostgreSQL/SQL Server 의 `INCLUDE` 절이 없어, 포함시킬 컬럼도 인덱스 키로 넣어야 합니다 (정렬 부담). 인덱스 크기가 커지므로 trade-off.

### Q1.4 fanout, depth, page size 의 관계?

**A**: page size (16KiB) / (key + pointer) ≈ fanout. BIGINT key + 6B pointer → fanout 1170 정도. depth = log_fanout(N). 1억 row 면 depth 3-4. 모든 OLTP 인덱스가 사실상 3-5 depth 안에 들어갑니다.

### Q1.5 인덱스 만들면 항상 빨라지나요?

**A**: 아니요. (1) write amplification — 모든 INSERT 가 모든 secondary index 갱신. (2) 디스크/buffer pool 점유. (3) selectivity 낮으면 옵티마이저가 외면. (4) 옵티마이저 혼란 (잘못 고를 가능성). 결과 row 비율이 25% 이상이면 보통 ALL 이 인덱스보다 빠릅니다.

### Q1.6 ACID 4 가지를 InnoDB 가 어떻게 구현하나요?

**A**:
- **A**: undo log 로 ROLLBACK 가능.
- **C**: FK / UNIQUE / CHECK 제약 + application 책임.
- **I**: MVCC + Lock + 격리 수준.
- **D**: redo log (WAL) + fsync (`innodb_flush_log_at_trx_commit=1`).

### Q1.7 4 격리 수준의 이상 현상 매트릭스?

**A**:
| Level | Dirty | Non-Repeatable | Phantom |
|---|:-:|:-:|:-:|
| RU | O | O | O |
| RC | X | O | O |
| RR | X | X | O (표준) / X (InnoDB) |
| SER | X | X | X |

**확장**: InnoDB 의 RR 은 표준과 달리 phantom 도 차단 — consistent read 는 snapshot, locking read 는 next-key lock 으로.

### Q1.8 S-Lock 과 X-Lock 의 차이? FOR UPDATE 는?

**A**: S 는 공유 (읽기), X 는 배타 (쓰기). S↔S 만 호환, X 는 모두 충돌. `SELECT FOR UPDATE` 는 X-lock + (RR 에선) gap lock + next-key lock. `SELECT LOCK IN SHARE MODE` (또는 `FOR SHARE`) 는 S-lock.

---

## Phase 2: MVCC / Lock / EXPLAIN

### Q2.1 MVCC 가 어떻게 lock 을 대체하나요?

**A (요약)**: 같은 row 의 여러 버전을 undo log 로 유지해, 읽기는 lock 안 잡고 자기 TX 가 볼 수 있는 버전만 따라갑니다. ReadView 가 가시성 판단의 기준 — `DB_TRX_ID` 가 자기 view 보다 작거나 자기 자신이면 보임, 크면 undo 로 거슬러 올라감.

**확장**: RR 은 TX 첫 SELECT 시 ReadView 생성 후 끝까지 유지, RC 는 매 SELECT 마다. 그래서 RR 에선 TX 안에서 같은 SELECT 결과가 변하지 않음. Locking read (FOR UPDATE) 는 MVCC 우회 — 현재 데이터 + lock.

**함정**: "long TX 의 위험은?" → "undo 가 쌓여 history list 폭증, buffer pool 압박. ADR-0020 의 외부 IO 분리 이유."

### Q2.2 InnoDB RR 에서 phantom read 가 발생하나요?

**A**: 표준 SQL 정의로는 RR 에서 phantom 가능하지만, InnoDB 는 **next-key lock + gap lock** 으로 phantom 까지 차단합니다. 단, 단순 SELECT (consistent read) 는 snapshot 으로 자동 차단, locking read 는 lock 으로 차단 — 두 메커니즘이 짝.

**함정**: "그럼 InnoDB RR 은 SERIALIZABLE 인가요?" → "아니요. write skew 같은 일부 anomaly 는 SERIALIZABLE 만 막습니다."

### Q2.3 Gap Lock 이 뭔가요? 언제 발생?

**A**: 인덱스 두 record 사이의 빈 공간에 잡는 lock. INSERT 만 차단합니다. RR 에서 `SELECT FOR UPDATE` 또는 범위 UPDATE 시 발생. 같은 gap 에 여러 TX 가 동시에 gap lock 갖는 건 가능 — gap lock 끼리는 호환 (대개). 그러나 Insert Intention 과는 충돌 → INSERT 가 block.

### Q2.4 IS / IX (Intention Lock) 은 왜 필요해요?

**A**: row-level lock 과 table-level lock 을 효율적으로 공존시키기 위해서. table-level X-lock 시도 시 안에 row lock 이 있는지 확인하려면 모든 row 검사가 필요한데, IS/IX 가 있으면 메타 충돌만 검사하면 됩니다. application 코드는 명시 안 함 — InnoDB 가 자동.

### Q2.5 Lock Escalation 이 InnoDB 에 있나요?

**A**: 없습니다. SQL Server 같은 일부 엔진은 row lock 이 너무 많아지면 자동 page/table lock 으로 승격하지만, InnoDB 는 row lock 이 수백만 개여도 그대로 유지합니다. 메모리 비용은 있지만 동시성을 잃지 않는 게 더 중요하다는 설계 결정.

### Q2.6 Deadlock 감지/회피?

**A**: InnoDB 가 매 lock wait 시 wait-for graph 의 cycle 을 검사해 자동 감지 → cost 낮은 쪽 abort. application 은 SQLSTATE 40001 받아 retry (exponential backoff + jitter). 회피: 일관 lock 순서 + 짧은 TX (ADR-0020) + 명시 lock + 인덱스 + SKIP LOCKED.

**확장**: 진단은 `SHOW ENGINE INNODB STATUS` 의 LATEST DETECTED DEADLOCK 섹션 — 어떤 인덱스, 어떤 record 에서 cycle 발생했는지.

### Q2.7 MDL (Metadata Lock) 사슬?

**A**: DDL 의 MDL EXCLUSIVE 는 DML 의 MDL SHARED 와 충돌. long-running TX 가 SHARED MDL 을 들고 있으면 ALTER 가 wait → 그 뒤로 모든 후속 SELECT 도 wait → 서비스 정지. 회피: `innodb_lock_wait_timeout` 짧게 + DDL 전 long TX 확인 + INSTANT/INPLACE/pt-osc/gh-ost 활용.

### Q2.8 EXPLAIN 의 type / key / rows / Extra 핵심?

**A**:
- type: const/eq_ref/ref/range 까지 OK, ALL 의심.
- key: NULL 이면 인덱스 안 탐.
- rows: 예상 스캔 — 자릿수로 봄.
- Extra: Using index ✅, Using filesort/temporary ⚠️.

EXPLAIN ANALYZE (8.0.18+) 로 실측 vs 예측 괴리 확인.

### Q2.9 복합 인덱스 (a, b) 에서 WHERE b=? 만 쓰면?

**A**: leftmost prefix 위반이라 일반적으론 인덱스 미사용. 8.0+ 의 Index Skip Scan 이 a 의 distinct 가 적을 때만 mini-range 로 활용 가능. 차라리 b 단독 인덱스 또는 (b, a) 인덱스 추가가 정답.

### Q2.10 인덱스 안티패턴 5가지만 빠르게?

**A**:
1. WHERE 절 함수 적용 (`DATE(col)`, `LOWER(col)`).
2. Implicit type cast (VARCHAR vs INT).
3. Leading `%` LIKE.
4. 부정 조건 (`<>`, `NOT IN`).
5. range 이후 컬럼 (인덱스 활용 X).

해법: 범위 변환, 함수 인덱스, UNION 분해, 컬럼 순서 재설계.

---

## Phase 3: msa 코드베이스

### Q3.1 msa 의 outbox 인덱스 설계?

**A**: quant 의 `idx_outbox_unpublished (published_at, occurred_at)` 가 모범. `WHERE published_at IS NULL ORDER BY occurred_at LIMIT 100` 쿼리 한 번에 type=range + Using index condition + filesort 없음. inventory.outbox_event 는 인덱스 미정의로 ALL 가능 — 통일 필요.

### Q3.2 msa 의 격리 수준 정책?

**A**: 모든 서비스 InnoDB 기본 RR 사용. Spring `@Transactional(isolation=...)` 으로 직접 격리 변경하는 곳 없음. ADR-0020 의 핵심은 격리를 바꾸는 게 아니라 **lock 보유 시간 자체를 줄이는 것** — 외부 IO 를 TX 밖으로.

### Q3.3 msa 의 RoutingDataSource 어떻게 동작?

**A**: AbstractRoutingDataSource + LazyConnectionDataSourceProxy 결합. `@Transactional(readOnly=true)` 면 `TransactionSynchronizationManager.isCurrentTransactionReadOnly() = true` → REPLICA, 아니면 MASTER. LazyConnection 이 connection 획득을 첫 SQL 시점까지 늦춰 routing key 결정도 그때.

### Q3.4 multi-tenant (quant) 의 인덱스 컨벤션?

**A**: 모든 secondary 가 `(tenant_id, ...)` leftmost. INV-05 (모든 query tenant_id 필수) 와 결합. tenant 격리 + 인덱스 효율 동시. 단점은 단일 tenant 대량 데이터 시 hotspot — 향후 sharding 후보.

### Q3.5 inventory 의 낙관락 (`@Version`)?

**A**: `InventoryJpaEntity.version: Long` 으로 `UPDATE WHERE id=? AND version=?` 패턴. lock 보유 시간 0, 충돌 시 OptimisticLockingFailureException → retry. 동시 update 빈도 낮을 때 throughput 최강. 빈도 높으면 retry 폭주 → 비관락 또는 atomic UPDATE 검토.

### Q3.6 ADR-0020 의 외부 IO 분리가 인덱스/lock 에 어떻게?

**A**: `@Transactional` 안에서 외부 HTTP/Kafka 가 lock 보유 시간을 수초로 늘려 (1) deadlock 확률 ↑ (2) MDL 사슬 위험 ↑ (3) undo log 적체. 분리하면 lock 보유 시간 ms 단위 — 그 자체로 격리/lock 충돌 대부분 해결.

### Q3.7 ADR-0012 (idempotent consumer) 와 DB?

**A**: `processed_event` 테이블의 `PRIMARY KEY (event_id, consumer_group)` 가 멱등성의 마지막 방어선. 중복 이벤트 처리 시도 시 INSERT 가 PK 충돌로 실패 → 무시. application race condition 을 DB UNIQUE 제약으로 방어.

### Q3.8 msa 의 PK 전략?

**A**: 대부분 BIGINT AUTO_INCREMENT (단조 증가, secondary index 효율). quant 은 BINARY(16) UUID — 글로벌 식별 필요. 단점: secondary leaf 가 16B PK 보유로 8B BIGINT 대비 2배. 다만 모든 인덱스가 (tenant_id, ...) leftmost 라 PK 직접 lookup 빈도 낮아 실제 영향 작음.

### Q3.9 PR 리뷰 시 인덱스 점검?

**A**: 새 쿼리/인덱스 PR 에 EXPLAIN ANALYZE 결과 첨부 의무 컨벤션 권장. type/key/rows/Extra 4 필드 확인. 위험 신호 (ALL, filesort, temporary) 있으면 차단. msa 향후 도입 권장 (17 의 #11).

---

## Phase 4: 종합 / 시나리오

### Q4.1 1억 row 테이블에 ALTER 하나 추가하라면?

**A**: 8.0.12+ 의 INSTANT 가능한 변경 (마지막 위치 ADD COLUMN, DROP INDEX, RENAME 등) 이면 1초 내. INPLACE LOCK=NONE 가능 변경 (대부분 ADD INDEX) 이면 분~시간이지만 DML 동시 가능. row log 폭발 위험 있어 큰 테이블엔 pt-online-schema-change 또는 gh-ost 권장. 어떤 경우든 ALGORITHM, LOCK 명시.

### Q4.2 운영에서 갑자기 모든 SELECT 가 hang. 원인?

**A**: 가능성 순:
1. **MDL 사슬** — long TX + DDL waiter 뒤에 정상 SELECT 들이 줄섬.
2. **History list 폭증** — long TX 로 undo 적체 → buffer pool 점유.
3. **Deadlock detection mutex 폭주** — 동시 TX 수천개 시.
4. **replica 가 응답 멈춤** (read 측 라우팅 시).

진단: `SHOW PROCESSLIST` + `information_schema.innodb_trx` + `performance_schema.metadata_locks`. 첫 대응은 long TX kill.

### Q4.3 deadlock 이 자주 발생. 어떻게?

**A**: `SHOW ENGINE INNODB STATUS` 의 LATEST DETECTED DEADLOCK 분석 → 어떤 인덱스, 어떤 record 에서 cycle. 패턴 분류: (1) 반대 순서 UPDATE → 일관 순서로. (2) gap lock 충돌 → RC 격리 검토. (3) FK cascade → application 명시 처리. application retry 로 단기 대응 + 근본 원인 수정.

### Q4.4 Slow query 발견 후 절차?

**A**:
1. Slow log → pt-query-digest top 10.
2. EXPLAIN ANALYZE 로 type/key/rows/Extra.
3. 통계 stale 확인 → ANALYZE TABLE.
4. 안티패턴 점검 (함수 적용, leftmost 위반, OR 등).
5. 인덱스 후보 도출 → 운영 데이터 사본에서 EXPLAIN 비교.
6. write 비용 측정 (sysbench/load test).
7. PR + EXPLAIN 첨부.
8. 변경 후 p99 latency 재측정.

### Q4.5 인덱스 추가 vs 쿼리 재작성, 무엇 먼저?

**A**: 쿼리 재작성 (안티패턴 제거) 가 우선. 인덱스 추가는 write 비용 영구 발생이라 신중. 함수 적용/implicit cast/OR 같은 코드 레벨 수정으로 해결 가능하면 그것부터.

### Q4.6 Read-After-Write 일관성을 어떻게 보장?

**A**: 4 가지 패턴:
1. **stickiness**: 사용자 단위 cookie/session 으로 N 초간 master 라우팅.
2. **wait-for-replica**: write 직후 replica binlog 동기까지 짧게 wait.
3. **critical read = master**: 결제/주문 같은 핵심 read 는 readOnly 빼기.
4. **eventual consistency**: 어플리케이션이 약간의 지연 허용 + UI 가 polling.

msa 는 명시 정책 미정 — ADR 후보 (17 의 #6).

### Q4.7 partition / sharding 언제 검토?

**A**:
- **partition**: 단일 테이블이 시간/key 기반으로 자연 분할 가능 + row 수억 단위. 예: audit_log 의 시간 기반 partition.
- **sharding**: 단일 DB throughput 한계 + 도메인이 자연스럽게 분할 (multi-tenant). 분산 TX 불가 → 도메인 invariant 가 shard 안에 갇혀야.

msa 는 둘 다 미적용 — 트래픽 임계 도달 시 ADR-0030/31 검토.

### Q4.8 MySQL vs PostgreSQL, 본 학습 관점에서?

**A**:
- **clustered index**: MySQL 만. Postgres 는 heap + ctid.
- **RR 의 phantom**: MySQL 은 next-key lock 으로 차단, Postgres 는 SI 라 자동 차단.
- **partial index**: Postgres 만 지원.
- **함수 인덱스**: 둘 다 지원, 문법 다름.
- **online DDL**: MySQL 은 INPLACE/INSTANT/pt-osc, Postgres 는 CREATE INDEX CONCURRENTLY.
- **SKIP LOCKED**: 둘 다 8.0+ / 9.5+ 지원.

### Q4.9 면접에서 기억할 한 줄?

**A**: "**InnoDB 의 secondary index leaf 는 PK 값이고, RR 의 phantom 차단은 next-key lock 이며, ADR-0020 의 외부 IO 분리는 결국 lock 보유 시간을 줄이는 것**" — 본 학습의 핵심 3개 한 줄.

### Q4.10 자주 틀리는 함정?

**A**:
- **"InnoDB 도 lock escalation 한다"** — 아닙니다.
- **"NULL 은 인덱스 못 탄다"** — IS NULL 은 selectivity 좋으면 인덱스 잘 탑니다 (IS NOT NULL 이 위험).
- **"SELECT FOR UPDATE 가 MVCC snapshot 을 본다"** — 아닙니다, locking read 는 현재 데이터.
- **"REPEATABLE READ 가 SERIALIZABLE 과 같다"** — InnoDB 라도 write skew 같은 anomaly 는 RR 에서 가능.
- **"인덱스 추가만 하면 된다"** — write 비용 + 옵티마이저 혼란. 25% 룰 + selectivity 검증.

---

## Phase 5: 동시성 제어 Cookbook (시나리오 매핑) — 19 파일 보강

### Q5.1 동시성 제어, 어떤 패턴부터 검토하시나요?

**A (요약)**: 4 패턴 (UNIQUE / Optimistic / Pessimistic / Distributed) 을 외우는 게 아니라 **시나리오 → 패턴 매핑** 으로 답합니다. INSERT race → UNIQUE, UPDATE 충돌 → 충돌율 1% 기준 Optimistic/Pessimistic, 긴 TX → 분리 + 상태 머신, DB 밖 자원 → Distributed Lock. **핵심 룰**: "분산 락은 마지막 수단, DB 락이 본질".

**확장**: 회사 사례 — Stripe Idempotency-Key 는 (UNIQUE + Cache + Pessimistic) 의 결합, 은행 송금은 (UNIQUE + Pessimistic + 상태 머신), 티켓팅은 (Redis Lua + Outbox + UNIQUE).

**함정**: "Redis 분산 락이 DB lock 보다 빠르지 않나요?" → "단일 row 보호엔 DB lock 이 안전하고 fencing token 도 자동. 분산 락은 자원이 DB 밖일 때만." (#19 §1.2 참조)

### Q5.2 Optimistic vs Pessimistic 선택 기준?

**A (요약)**: **충돌 빈도** 가 1차 기준. < 1% Optimistic, > 10% Pessimistic, > 30% 면 재설계 (sharding / counter / Redis INCR). **TX 길이** 가 2차 기준 — Pessimistic 은 외부 IO 절대 금지 (ADR-0020).

**확장**: Shopify inventory 는 Optimistic (`updated_at` 기반), 은행 잔액은 Pessimistic, GitHub PR 은 Optimistic (ETag/If-Match), Cassandra LWT 도 Optimistic (Paxos).

**함정**: "@Version 으로 INSERT race 보호 가능?" → "불가. version=0 의 race window 존재. INSERT race 는 UNIQUE 제약." (#19 §3.1, §5.3)

### Q5.3 티켓팅처럼 같은 row 에 1만 TPS 가 들어오면?

**A (요약)**: DB Pessimistic Lock 은 1 TPS, Optimistic+retry 도 retry storm. 답은 **Redis Lua atomic 차감 + DB Outbox 비동기 확정**. 추가 layer: WAF + rate limit + 대기열 + pre-warm.

**확장**: 인터파크/Naver/Ticketmaster 모두 동일. Redis 단일 스레드가 직렬화 보장 + µs latency. DB 는 자기 페이스로 따라옴.

**함정**: "Redis 가 SSOT 의 일부면 가용성은?" → "RDB+AOF + replica + Sentinel/Cluster. 그래도 결제급 정합성은 부족 → Outbox 로 DB 가 ground truth." (#19 §3.5)

### Q5.4 결제는 Optimistic Lock 만으로 충분한가요?

**A (요약)**: **아니오**. Optimistic 의 retry 가 결제 retry 와 합쳐지면 이중 결제 위험. 결제는 **defense-in-depth** 4 layer: (1) Idempotency-Key 캐시, (2) DB UNIQUE on charge_id, (3) Pessimistic Lock on account row, (4) 상태 머신 (PENDING/AUTHORIZED/CAPTURED). + reconciliation batch.

**확장**: Stripe PaymentIntent 가 정확히 이 패턴. Toss / KakaoPay / 국내 은행 자금 이체 동일. **단일 패턴은 SPOF**.

**함정**: "DB UNIQUE 만으로 안 되나?" → "잔액 음수 방어 못 함. 차감 시 X-lock 필수. UNIQUE 는 결제 자체 dedup, lock 은 잔액 invariant." (#19 §4.1)

### Q5.5 Outbox multi-worker 는 어떻게 분배?

**A (요약)**: **`SELECT ... FOR UPDATE SKIP LOCKED`** (MySQL 8.0+). DB 가 행별 X-lock + 다른 worker 는 그 row 건너뜀. 추가 인프라 없이 worker N 개 모두 active → throughput N 배.

**확장**: Eventuate Tram / Stripe Webhook 큐 / Sidekiq Pro 모두 동일 (Postgres 면 동일 구문). 대안은 Debezium CDC 로 polling 자체 제거.

**함정**: "분산 락으로 한 worker 만 active 하면?" → "단일 worker → throughput 1배. SKIP LOCKED 가 분배에 더 적합." (#19 §3.8)

---

## 회독 권장 일정

- **D+0**: 학습 종료 직후 1회독.
- **D+7**: 한 주 후 2회독 (헷갈리는 카드만).
- **D+30**: 한 달 후 3회독.
- 면접 1주 전: 4회독 + 모의 답변 (구두 30초 / 2분 분기).

## 핵심 포인트

- 4 Phase × 8~10 카드 + Phase 5 (Cookbook) 5 카드 = **47 카드**.
- 면접 단골은 **Phase 2 (MVCC, Lock, EXPLAIN)** 에 몰려 있음 — 우선 회독.
- Phase 3 (msa) 는 **회사 사례 답변** 의 무기 — "저희 msa 에선..." 으로 시작 가능.
- Phase 5 (Cookbook) 는 **시나리오 → 패턴 매핑** 무기 — Stripe/Amazon/Shopify/은행/티켓팅 사례 결합.
- "한 줄 정리" 3개 (Q4.9) 를 머리에 박아두면 어떤 파생 질문도 방어.

## 마무리

이로써 #4 DB 인덱스 + 트랜잭션 격리 학습 종료.

다음 학습 후보:
- **#15 Connection Pool** — HikariCP + LazyConnection + leak detection.
- **#7 Distributed Systems** — 2PC, Saga, Outbox 가 본 학습의 단일 DB 격리와 어떻게 다른지.
- **#11 Observability** — slow log + p99 + Prometheus alarm 통합.
