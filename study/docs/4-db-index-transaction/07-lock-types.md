---
parent: 4-db-index-transaction
seq: 07
title: Lock 종류 전수 — S/X/IS/IX, Record/Gap/Next-key/Insert Intention
type: deep
created: 2026-05-01
---

# 07. Lock 종류 전수 — S/X/IS/IX, Record/Gap/Next-key/Insert Intention

## 핵심 정의

InnoDB 의 lock 은 **두 축의 곱**으로 분류:

- **모드** (mode): 무엇을 막는가 → S(공유) / X(배타) / IS / IX / AUTO-INC
- **범위** (granularity / kind): 어디를 잡나 → Record / Gap / Next-Key / Insert Intention / Predicate (spatial)

면접에서 가장 자주 나오는 단일 주제. 정확한 호환성 매트릭스를 머리에 그릴 수 있어야 한다.

## Lock 모드 — 호환성 매트릭스

|  요청 \ 보유 | IS | IX | S | X |
|---|:---:|:---:|:---:|:---:|
| **IS** | ✅ | ✅ | ✅ | ❌ |
| **IX** | ✅ | ✅ | ❌ | ❌ |
| **S** | ✅ | ❌ | ✅ | ❌ |
| **X** | ❌ | ❌ | ❌ | ❌ |

- **S (Shared)**: 읽기 잠금. 여러 TX 가 같이 가질 수 있음. `SELECT ... LOCK IN SHARE MODE` / `FOR SHARE`.
- **X (Exclusive)**: 쓰기 잠금. 단독. `SELECT ... FOR UPDATE`, `UPDATE`, `DELETE`, `INSERT`.
- **IS (Intention Shared)**: "이 테이블 안 어딘가에 S lock 잡을 거야" 신호.
- **IX (Intention Exclusive)**: "이 테이블 안 어딘가에 X lock 잡을 거야" 신호.

### Intention Lock 이 왜 필요한가

면접 단골: **"IS/IX 가 없으면 어떤 문제?"**

> "테이블 전체에 LOCK TABLE WRITE 같은 table-level X-lock 을 걸려 할 때, 안에 row-level lock 이 있는지 확인하려면 모든 row 를 다 봐야 합니다. 그게 비현실적이라 InnoDB 는 row lock 을 잡기 전에 먼저 테이블에 IS/IX 를 마킹합니다. 그러면 누가 table-level lock 을 시도하면 IS/IX 와 충돌만 검사하면 끝."

### IS/IX 는 자동

application 코드에서 명시할 일 없음. row 의 S/X 를 잡으면 InnoDB 가 자동으로 부모 테이블에 IS/IX 를 건다.

## Lock 범위 (granularity)

```
┌──────────────────────────────────────────────────┐
│ Record Lock: 인덱스 record 자체에 lock           │
│ Gap Lock: 두 record 사이의 빈 공간에 lock        │
│ Next-Key Lock: Record + 그 앞의 Gap (gap+record)│
│ Insert Intention Lock: 특정 gap 에 INSERT 의도   │
└──────────────────────────────────────────────────┘
```

InnoDB 의 **모든 lock 은 인덱스 entry 에 걸린다**. 테이블에 인덱스가 없으면? **clustered index (PK) 의 entire scan 에 X-lock** → 사실상 테이블 락.

→ 면접 답변: "InnoDB 의 row lock 은 사실 인덱스 lock 입니다. 인덱스 없는 컬럼으로 UPDATE WHERE 하면 모든 row 를 X-lock 잡으므로, **WHERE 절의 컬럼은 반드시 인덱스가 있어야** row lock 의 효과를 누릴 수 있습니다."

### Record Lock (단일 인덱스 레코드)

```sql
-- T1
SELECT * FROM orders WHERE id = 5 FOR UPDATE;
-- → orders.PK 의 id=5 record 에 X-lock
```

- 다른 TX 의 `UPDATE WHERE id=5`, `DELETE WHERE id=5` block.
- `id=4` 또는 `id=6` 은 영향 없음.

### Gap Lock (빈 공간)

```
인덱스 leaf:  ... [3] [5] [7] [10] ...
                   ↑ ↑ ↑ ↑
                gap gap gap gap
                (3,5)(5,7)(7,10)...
```

- gap 은 두 record 사이 (열린 구간).
- gap lock 은 **INSERT 만 차단** — `SELECT/UPDATE/DELETE` 는 영향 없음.
- 같은 gap 에 여러 TX 가 동시에 gap lock 을 가질 수 있음 — gap lock 끼리는 호환 (대개).

### Next-Key Lock (Record + 앞 gap)

InnoDB 의 RR 에서 기본:

```sql
SELECT * FROM orders WHERE id BETWEEN 5 AND 10 FOR UPDATE;
-- → next-key lock: (3, 5], (5, 7], (7, 10] + record 5, 7, 10
-- → id=4 INSERT, id=6 INSERT, id=11 INSERT 모두 block (gap 침범)
```

→ phantom read 차단의 비결.

### Insert Intention Lock

```sql
-- T1: SELECT FOR UPDATE WHERE id BETWEEN 5 AND 10;
-- → next-key lock 보유

-- T2: INSERT INTO orders VALUES (id=8, ...);
-- → id=8 위치의 gap (7, 10) 에 insert intention lock 시도
-- → T1 의 gap lock 과 충돌 → wait
```

- INSERT 가 들어갈 위치 gap 에 잠시 거는 lock.
- 일반 gap lock 끼리는 호환이지만, **insert intention 과 gap lock 은 충돌**.
- 의미: "여기 끼워 넣고 싶다" vs "이 gap 비워두고 싶다" 의 충돌.

## 시나리오 — 정확한 lock 추적

### 케이스 1: PK 기반 단건 UPDATE

```sql
UPDATE orders SET status='PAID' WHERE id = 5;
```

- IX on orders (table-level intention)
- X record lock on orders.PK[id=5]
- Gap lock 없음 (`=` 검색이고 unique index)

### 케이스 2: 인덱스 없는 컬럼 UPDATE

```sql
UPDATE orders SET status='PAID' WHERE created_at = '2026-05-01';
-- created_at 에 인덱스 없음
```

- 모든 row 에 X-lock 시도 → **사실상 테이블 락**.
- → DML 시 WHERE 컬럼 인덱스 필수.

### 케이스 3: 범위 SELECT FOR UPDATE (RR)

```sql
SELECT * FROM orders WHERE user_id = 'alice' FOR UPDATE;
-- idx_orders_user_id 사용
```

- idx_orders_user_id 의 alice entries 에 next-key lock.
- alice 의 gap (이전 record 와의 gap, 마지막 record 다음 gap 까지) 도 lock.
- → 다른 TX 가 user_id='alice' 새 row INSERT 시 block.
- + clustered PK 의 해당 row 들에도 X record lock.

### 케이스 4: SKIP LOCKED (MySQL 8.0+)

```sql
SELECT * FROM outbox
WHERE published_at IS NULL
ORDER BY occurred_at
LIMIT 100
FOR UPDATE SKIP LOCKED;
```

- 다른 TX 가 lock 잡고 있는 row 는 **건너뜀**.
- Outbox relay 멀티 worker 에 표준 패턴 (msa 의 outbox 에서 향후 도입 후보).
- **NOWAIT** 옵션도 있음 — lock 획득 못 하면 즉시 에러.

## RC vs RR 의 lock 동작 차이

| 동작 | RC | RR |
|---|---|---|
| Record lock | ✅ | ✅ |
| Gap lock | ❌ (UNIQUE 검색의 not-found 등 일부 예외) | ✅ |
| Next-key lock | ❌ (record only) | ✅ |
| Phantom 차단 | ❌ | ✅ |

→ RC 가 **lock 더 적게** 잡음 → throughput ↑, but phantom 가능.

## AUTO-INC Lock (모드)

`INSERT` 시 다음 ID 를 받기 위한 특수 lock.

`innodb_autoinc_lock_mode` 3가지:

| 모드 | 동작 |
|---|---|
| **0 (traditional)** | 모든 INSERT 가 table lock (한 번에 한 TX 만 INSERT 가능). |
| **1 (consecutive)** | 단일 INSERT 는 mutex, 멀티-row INSERT 는 table lock. **MySQL 5.7 기본**. |
| **2 (interleaved)** | 모든 INSERT 가 mutex. 가장 빠름. **MySQL 8.0 기본**. statement-based replication 에서 ID 비연속 가능. |

→ MySQL 8.0 대부분의 프로젝트는 mode 2 + row-based replication.

## Predicate Lock (Spatial)

R-Tree 인덱스용. 일반 Gap Lock 이 1차원이라 2D 영역에 적용 불가 → MBR 단위 lock. 일반 OLTP 와 무관.

## Lock Escalation 이 InnoDB 에 있는가

면접 단골: **"InnoDB 도 Lock Escalation 하나요?"**

> "**없습니다**. SQL Server 같은 일부 엔진은 row lock 이 너무 많아지면 자동으로 page/table lock 으로 승격하지만, InnoDB 는 row lock 이 수백만 개여도 그대로 유지합니다. 메모리 비용은 있지만 동시성을 잃지 않는 게 더 중요하다는 설계 결정입니다."

## 명시적 잠금 구문

```sql
-- X-Lock (배타)
SELECT ... FOR UPDATE;

-- S-Lock (공유)
SELECT ... LOCK IN SHARE MODE;   -- 5.x 식
SELECT ... FOR SHARE;            -- 8.0+ 표준
```

### JPA / Spring Data 에서

```kotlin
@Lock(LockModeType.PESSIMISTIC_WRITE)  // X-Lock (FOR UPDATE)
@Query("SELECT a FROM Account a WHERE a.id = :id")
fun findByIdForUpdate(@Param("id") id: Long): Account?

@Lock(LockModeType.PESSIMISTIC_READ)   // S-Lock (FOR SHARE)
fun findByIdForShare(@Param("id") id: Long): Account?

// PESSIMISTIC_FORCE_INCREMENT — JPA 의 @Version 강제 증가까지 함께
```

QueryHint 로 timeout 도 가능:
```kotlin
@QueryHints(QueryHint(name = "javax.persistence.lock.timeout", value = "3000"))
```

## Lock 추적 (진단)

```sql
-- 현재 보유된 lock
SELECT * FROM performance_schema.data_locks;

-- lock 대기 관계
SELECT * FROM performance_schema.data_lock_waits;

-- 진행 중 TX
SELECT * FROM information_schema.innodb_trx;

-- LATEST DETECTED DEADLOCK 등
SHOW ENGINE INNODB STATUS\G
```

## msa 코드 연결

`order/V1`:
```sql
INDEX idx_orders_user_id (user_id),
INDEX idx_orders_status (status)
```

```sql
-- 시나리오: alice 의 PENDING 주문을 PAID 로 일괄 처리
UPDATE orders SET status='PAID' WHERE user_id='alice' AND status='PENDING';
```

- idx_orders_user_id 사용 가정.
- alice 의 모든 PK record 에 X-lock + 그 사이 gap 에 gap lock.
- 다른 TX 의 alice 새 주문 INSERT 가 block (insert intention 충돌).
- → ADR-0020 의 권고: 이런 bulk update 는 가능하면 짧게 끊어 (LIMIT + 반복) 또는 비동기로.

`quant` Outbox relay (`OutboxJpaRepository.findTop100ByPublishedAtIsNullOrderByOccurredAtAsc`):
- 현재 SKIP LOCKED 미사용. relay worker 가 1개일 때만 안전.
- 향후 worker N개 → SKIP LOCKED 도입 권장 (17 에서).

## Lock Wait Timeout

```sql
SHOW VARIABLES LIKE 'innodb_lock_wait_timeout';
-- 기본 50초. 너무 김.
```

- 운영 권장: **3-10초**. 너무 길면 connection pool 고갈.
- TX 별 override: `SET innodb_lock_wait_timeout = 3;`
- JPA: `javax.persistence.lock.timeout` (단, 실제 효과는 driver/엔진 의존).

## 멘탈 모델

> Lock 은 **인덱스 leaf 의 entry 에 표시되는 메모지**. record 위에 붙이는 메모 / record 사이 빈 공간에 붙이는 메모 / "여기 끼워 넣을게요" 메모. RR 에선 빈 공간 메모까지 강제 → 그래서 phantom 차단되지만, 동시 INSERT 가 자주 block 되는 부작용.

## 핵심 포인트

- 호환성: **S↔S** 만 공존. **IS↔IS, IS↔IX, IX↔IX** 도 호환 (서로 다른 row 를 가리킬 수 있으므로). X 는 모두 충돌.
- **모든 lock 은 인덱스 entry 에 걸린다** — WHERE 컬럼에 인덱스 없으면 사실상 테이블 락.
- **Record / Gap / Next-Key / Insert Intention** 4종.
- **InnoDB 기본 RR + Next-Key Lock** 이 phantom 차단의 핵심.
- RC 는 record only — throughput 은 ↑, phantom 가능.
- **Lock Escalation 은 InnoDB 에 없다**.
- **SKIP LOCKED** (8.0+) 가 outbox / queue 패턴의 표준.

## 다음 학습
- [08-deadlock-mdl.md](08-deadlock-mdl.md) — Deadlock 자동 감지 + MDL + AUTO-INC 디테일
- [10-composite-covering-merge.md](10-composite-covering-merge.md) — 인덱스 설계가 lock 범위에 미치는 영향
