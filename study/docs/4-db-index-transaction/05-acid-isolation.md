---
parent: 4-db-index-transaction
seq: 05
title: ACID + 격리 4단계 + 이상현상
type: deep
created: 2026-05-01
---

# 05. ACID + 격리 4단계 + 이상현상

## 핵심 정의

- **ACID**: Atomicity / Consistency / Isolation / Durability — DB 트랜잭션의 4 보장.
- **Isolation Level**: 동시 트랜잭션끼리 얼마나 서로 안 보이게 할지의 4단계 (+ 1).
- **이상 현상 (Anomaly)**: 격리가 약할 때 발생하는 4가지 — Dirty Read / Non-Repeatable Read / Phantom Read / Lost Update.

이 문서는 격리 수준의 **표준 정의** 와 **InnoDB 만의 실제 동작** 차이를 분리해서 설명한다. 면접 단골 질문 ("RR 인데 phantom 발생?" "InnoDB 의 RR 은 왜 다른가?") 의 답이 여기서 나온다.

## ACID 4가지

### A — Atomicity (원자성)

- TX 안의 모든 작업이 **All-or-Nothing**.
- 구현: **undo log** (수정 전 이미지 보관) → ROLLBACK 시 원복.
- ADR-0020 의 "외부 IO 를 TX 밖으로" 가 이 보장을 외부 시스템까지 확장 못 한다는 한계에서 나옴 (Outbox/Saga 필요).

### C — Consistency (일관성)

- TX 종료 시 DB 가 **유효한 상태**. 무결성 제약 (FK, UNIQUE, CHECK) 통과.
- 비교적 약한 보장 — 무결성 제약은 어플리케이션 책임 (도메인 invariant 는 DB 가 모름).

### I — Isolation (고립성)

- 동시 TX 가 **서로 영향 없게**. 본 문서 핵심.
- 비용/안전 trade-off → 4단계 (+ snapshot isolation 같은 변형).

### D — Durability (지속성)

- 커밋된 TX 는 시스템 장애에도 **사라지지 않음**.
- 구현: **redo log (WAL = Write-Ahead Log)** + fsync.
- InnoDB: `innodb_flush_log_at_trx_commit = 1` (매 커밋마다 fsync) 가 기본 + 강력 보장.
  - `= 2` 는 OS 레벨 캐시까지만 → OS 크래시 시 일부 손실. 처리량 ↑.
  - `= 0` 은 1 초마다 flush → 안전성 매우 약함.

## 4가지 이상 현상

| 현상 | 설명 | 예 |
|---|---|---|
| **Dirty Read** | 다른 TX 가 아직 commit 안 한 값을 읽음 | T1 이 amount=200 으로 update (commit 전), T2 가 그 값을 읽고 결정. T1 rollback 되면 T2 잘못. |
| **Non-Repeatable Read** | 같은 row 를 두 번 읽었는데 값이 다름 | T1 이 SELECT id=1 → 100. T2 가 update + commit. T1 다시 SELECT → 200. |
| **Phantom Read** | 같은 조건으로 두 번 SELECT 했는데 row 수가 다름 | T1: SELECT count(*) WHERE status='NEW' → 5. T2: INSERT new row + commit. T1 다시 → 6. |
| **Lost Update** | 동시 update 가 한쪽을 덮어씀 | T1, T2 가 같은 row 읽고 각자 +1 하고 write → 한쪽 +1 만 반영. |

## 4 격리 수준 (SQL 표준)

| Level | Dirty | Non-Repeatable | Phantom |
|---|:---:|:---:|:---:|
| READ UNCOMMITTED | O | O | O |
| READ COMMITTED | X | O | O |
| REPEATABLE READ | X | X | O |
| SERIALIZABLE | X | X | X |

(O = 발생 가능, X = 차단)

## InnoDB 의 실제 동작 — 표준과 다르다

### InnoDB 기본: REPEATABLE READ + Phantom 차단

표준 RR 은 phantom 허용. 그러나 InnoDB 는 **Gap Lock + Next-Key Lock** 으로 **phantom 도 차단**한다 (자세히는 07).

```sql
-- T1
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT * FROM orders WHERE user_id = 'alice' FOR UPDATE;  -- locking read

-- T2 (다른 세션)
INSERT INTO orders (user_id, ...) VALUES ('alice', ...);
-- → BLOCK! T1 의 next-key lock 이 alice 의 gap 을 잡고 있음.
```

→ InnoDB 의 RR 은 사실상 **Snapshot Isolation + Gap Lock** 으로 phantom 까지 차단.

### consistent read vs locking read

InnoDB RR 에서 phantom 을 막는 메커니즘은 두 가지로 나뉜다:

1. **Consistent (non-locking) read**: 단순 `SELECT` — TX 시작 시점의 snapshot 을 본다. 다른 TX 의 INSERT 가 보이지 않음 → phantom 자체가 발생 안 함.
2. **Locking read**: `SELECT ... FOR UPDATE`, `SELECT ... LOCK IN SHARE MODE`, `INSERT/UPDATE/DELETE` — 실제 row + gap 에 lock. 다른 TX 의 INSERT 를 block.

→ "InnoDB RR 에서 phantom 발생하나?" 답:

> "표준 SQL 에선 RR 에서 phantom 가능합니다. 그러나 InnoDB 는 consistent read 는 snapshot, locking read 는 gap lock + next-key lock 으로 둘 다 차단합니다. 다만 mixed 워크로드 (snapshot read 후 update) 같은 일부 경계 케이스에선 'Write Skew' 같은 비표준 anomaly 가 여전히 가능하므로 SERIALIZABLE 까지 가야 완벽합니다."

### InnoDB 의 READ COMMITTED 와 차이

- RC 도 consistent read 는 가능 — 단, **각 SELECT 마다 새 snapshot**. (RR 은 TX 첫 SELECT 의 snapshot 고정.)
- RC 는 **Gap Lock 안 잡음** (`UNIQUE` 검색 + Foreign Key check 같은 예외 제외) → phantom 발생.
- → throughput 은 RC 가 약간 좋다 (gap lock 없어 동시 INSERT 빠름). 그러나 InnoDB 의 기본은 RR.

## Postgres 와 비교

| 격리 | InnoDB | Postgres |
|---|---|---|
| RU | RC 와 동일 (Postgres 가 RU 자체를 RC 처리) | 동일 |
| RC | snapshot per statement | snapshot per statement |
| RR | snapshot per TX + Gap Lock | snapshot per TX (gap lock 없음, 그래서 표준 RR 보다 강한 SI) |
| SER | 거의 lock 으로 직렬화 | SSI (Serializable Snapshot Isolation) — 충돌 감지 후 abort |

→ Postgres 의 RR 은 "Snapshot Isolation" 이라 부르는 게 정확. InnoDB 와 phantom 처리 방식이 다름.

## 격리 수준 선택 가이드 (msa 기준)

| 워크로드 | 권장 | 이유 |
|---|---|---|
| 일반 CRUD | RR (기본) | snapshot 일관성 + phantom 차단 |
| Outbox relay 폴링 | RC + SKIP LOCKED | 동시 worker, gap lock 줄여 throughput ↑ |
| 보고서/대시보드 | RC | snapshot 비용 절감 |
| 자금 이체, 재고 차감 | RR + 명시 lock (FOR UPDATE) | 엄격 보장 |
| **절대 권장 안 함** | RU | 거의 효용 없음, dirty read 부작용만 |
| 사실상 안 씀 | SERIALIZABLE | throughput 망가짐, optimistic lock 으로 대체 |

### Spring `@Transactional(isolation = ...)` 활용

```kotlin
@Transactional(isolation = Isolation.READ_COMMITTED)
fun batchProcessOutbox() { ... }
```

- TX 단위로 격리 변경 가능. msa 는 거의 사용 안 하고 InnoDB 기본 (RR) 에 의존.
- ADR-0020 의 "외부 IO 분리" 가 격리 수준보다 lock 보유 시간 자체를 줄이는 게 우선이라는 입장.

## Lost Update 와 Optimistic / Pessimistic Lock

격리 수준만으로 lost update 가 항상 막히진 않는다.

```sql
-- T1, T2 동시
BEGIN;
SELECT amount FROM account WHERE id = 1;  -- 둘 다 100
UPDATE account SET amount = amount + 50 WHERE id = 1;
-- ↑ 둘 다 150 으로 → 한쪽 lost
```

- RR 도 위 read 는 snapshot, write 는 별개 lock. read-modify-write 패턴은 **명시 lock** 필요.
- 해결:
  1. **Pessimistic**: `SELECT ... FOR UPDATE` 로 row lock.
  2. **Optimistic**: `UPDATE WHERE version = ?` + version 증가. (`@Version`)
  3. 단순 atomic UPDATE: `SET amount = amount + 50` — read 없이 바로 update (가능하면 가장 안전).

## SERIALIZABLE 의 비용

- InnoDB 의 SERIALIZABLE: 모든 SELECT 가 자동으로 LOCK IN SHARE MODE → 동시 TX 가 block / deadlock 폭발.
- 거의 모든 "직렬화 보장" 요구는 application level 에서 (1) row-level lock + (2) 도메인 invariant 검증 + (3) 멱등성 으로 해결.

## 멘탈 모델

> 격리는 "**다른 사람의 작업을 얼마나 안 보이게 할지**" 의 dial.
> RU = "남이 쓰던 메모도 다 보임", RC = "남이 책상에 둔 거만 보임", RR = "내가 들어왔을 때의 책상만 영원히 보임", SER = "내가 일하는 동안 다른 사람 작업 금지".
> 강하게 갈수록 안전 ↑ throughput ↓.

## 핵심 포인트

- ACID 의 I 가 격리. 4 단계 + InnoDB 의 RR 은 **표준 RR + Gap Lock 으로 phantom 까지 차단**.
- 표준 정의로 외우지 말고 **InnoDB 의 실제 동작** 으로 외운다.
- Postgres 와 InnoDB 는 RR 의 정의가 다르다 — Postgres 는 SI, InnoDB 는 SI + Gap Lock.
- Lost Update 는 격리 수준 만으로 막히지 않음 → optimistic 또는 pessimistic lock.
- msa 는 InnoDB 기본 RR + ADR-0020 의 lock 시간 단축 전략. 격리 수준을 직접 바꾸는 곳은 거의 없음.

## 다음 학습
- [06-innodb-page-mvcc.md](06-innodb-page-mvcc.md) — RR 의 snapshot 이 실제로 어떻게 만들어지나
- [07-lock-types.md](07-lock-types.md) — Gap Lock, Next-Key Lock 의 정확한 동작
