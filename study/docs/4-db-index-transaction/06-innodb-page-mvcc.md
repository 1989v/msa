---
parent: 4-db-index-transaction
seq: 06
title: InnoDB 페이지 + MVCC — Undo Log, Read View, Consistent Read
type: deep
created: 2026-05-01
---

# 06. InnoDB 페이지 + MVCC — Undo Log, Read View, Consistent Read

## 핵심 정의

- **MVCC (Multi-Version Concurrency Control, 다중 버전 동시성 제어)**: 같은 row 의 여러 버전을 유지해서 **읽기는 lock 없이** 일관성 보장.
- **Undo Log**: 수정 전 이미지를 보관. ROLLBACK 의 원본 + MVCC 의 과거 버전 소스.
- **Read View**: 어떤 버전이 "내가 볼 수 있는 버전" 인지 결정하는 메타.

이 문서는 InnoDB 의 RR 이 phantom 을 차단할 수 있는 근거를 페이지/undo/read view 단위로 분해한다.

## InnoDB 페이지 구조 (16 KiB)

```
┌──────────────────────────────────────────────────┐
│ FILE Header (38B) — checksum, page_no, prev/next │
├──────────────────────────────────────────────────┤
│ Page Header (56B) — n_recs, free, level, ...     │
├──────────────────────────────────────────────────┤
│ Infimum + Supremum Records (가상 경계)           │
├──────────────────────────────────────────────────┤
│ User Records (실제 row)                          │
│   - row1 → next pointer                          │
│   - row2 → next pointer                          │
│   - ...                                          │
├──────────────────────────────────────────────────┤
│ Free Space                                       │
├──────────────────────────────────────────────────┤
│ Page Directory (slot array, binary search 가속) │
├──────────────────────────────────────────────────┤
│ FILE Trailer (8B) — checksum 재확인              │
└──────────────────────────────────────────────────┘
```

- row 들은 **single-linked list** (next pointer) 로 연결.
- Page Directory 는 row 의 위치 slot — **페이지 안에서 binary search** 가능.
- Infimum / Supremum 은 가상 경계 record. **Gap Lock 의 시작/끝 지점**으로 쓰임 (07).

## Hidden Columns (모든 InnoDB row 에 자동 추가)

| 컬럼 | 크기 | 역할 |
|---|---|---|
| **DB_TRX_ID** | 6B | 마지막 수정한 TX ID |
| **DB_ROLL_PTR** | 7B | undo log 위치 포인터 (이전 버전 체인) |
| **DB_ROW_ID** | 6B | PK 명시 안 했을 때만, hidden PK |

→ row 1개당 **13B 오버헤드** (DB_ROW_ID 포함 시 19B). 이게 MVCC 의 인프라.

## Undo Log

### 두 종류

1. **Insert Undo**: INSERT 한 row 의 PK. ROLLBACK 시 그 row 삭제. 커밋 후 즉시 폐기.
2. **Update Undo**: UPDATE/DELETE 의 **이전 이미지**. ROLLBACK + MVCC read 양쪽에 사용 → **참조하는 TX 가 모두 끝나야 폐기 가능**.

### Long TX 가 위험한 이유

- TX1 이 SELECT 만 하고 1시간 살아 있으면, 그 동안 발생한 **모든 update 의 undo log 가 보존**되어야 함 (TX1 이 과거 버전을 볼 수 있어야).
- Undo tablespace 가 끝없이 자라면서 디스크/buffer pool 압박.
- → ADR-0020 의 "TX 안에 외부 IO 금지" 가 이 문제도 막는다.

### 버전 체인

```
현재 row (DB_TRX_ID=100, amount=300)
  ↓ DB_ROLL_PTR
undo: TX=80 의 버전 (amount=250)
  ↓
undo: TX=50 의 버전 (amount=200)
  ↓
undo: TX=30 의 버전 (amount=100, 최초 INSERT)
```

- 한 row 의 모든 과거 버전이 undo 에 체인으로.
- MVCC read 시 "내가 볼 수 있는 가장 가까운 버전" 까지 거슬러 올라감.

## Read View

TX 가 시작될 때 (또는 RC 면 SELECT 마다) 만들어지는 스냅샷 메타.

```
ReadView {
  m_low_limit_id   = 105   // 이 ID 이상은 무조건 못 봄 (미래 TX)
  m_up_limit_id    = 80    // 이 ID 미만은 무조건 보임 (이미 다 끝남)
  m_creator_trx_id = 100   // 자기 자신
  m_ids            = [82, 95]  // 현재 살아있는 TX IDs
}
```

### 가시성 판단 알고리즘

row 의 DB_TRX_ID (= X) 를 봤을 때:

```
if (X == m_creator_trx_id) → 보임 (내가 쓴 거)
if (X < m_up_limit_id)     → 보임 (이미 commit 된 옛 TX)
if (X >= m_low_limit_id)   → 안 보임 → undo 따라 이전 버전으로
if (X in m_ids)            → 안 보임 (아직 진행 중) → undo 따라 이전 버전으로
otherwise                  → 보임 (commit 됐고 m_ids 에 없음)
```

### REPEATABLE READ vs READ COMMITTED

| 격리 | Read View 생성 시점 |
|---|---|
| **RR** | TX 의 **첫 SELECT** 시. 이후 TX 끝까지 동일 view. → 같은 SELECT 두 번이 항상 같은 결과. |
| **RC** | **매 SELECT 마다** 새 view. → 한 TX 안에서도 SELECT 결과가 바뀔 수 있음 (Non-Repeatable Read). |

→ msa 의 일반 CRUD 가 RR 인 이유: 한 TX 안의 SELECT 들이 일관된 그림을 보장 받는 것이 어플리케이션 코드 단순성에 기여.

## MVCC 동작 — 단계별 시뮬레이션

### 시나리오: amount 100 인 account row

```
T0:  row(amount=100, DB_TRX_ID=10, ROLL_PTR→null)

T1 (TX=20): START TRANSACTION; SELECT amount FROM account WHERE id=1;
  → ReadView 생성: low=21, up=20, ids=[]
  → row 의 DB_TRX_ID=10 < up=20 → 보임 → 100 반환

T2 (TX=25): START TRANSACTION; UPDATE account SET amount=200; COMMIT;
  → row 갱신: (amount=200, DB_TRX_ID=25, ROLL_PTR→undo[100,TRX=10])
  → undo 에 (amount=100, TRX=10) 보관

T1: SELECT amount FROM account WHERE id=1;  -- 같은 TX 안에서 재조회
  → 같은 ReadView (RR)
  → row 의 DB_TRX_ID=25 ≥ low=21 → 안 보임
  → ROLL_PTR 따라 undo: (amount=100, TRX=10) → low=21 보다 작음 → 보임 → 100 반환

T1: COMMIT;
```

→ T2 가 commit 했는데도 T1 은 끝까지 100 으로 본다. **non-repeatable read 차단**. RR 의 핵심.

## Consistent Read vs Locking Read

| 종류 | SQL | 동작 |
|---|---|---|
| **Consistent (non-locking)** | 단순 `SELECT` | MVCC, lock 안 잡음, snapshot 시점 데이터 |
| **Locking read** | `SELECT ... FOR UPDATE`, `... LOCK IN SHARE MODE` / `FOR SHARE` | 현재(latest committed) 데이터 + row lock + (RR 에서) gap lock |
| Write | `UPDATE/DELETE/INSERT` | 항상 latest + X-lock |

> Locking read 는 **MVCC 우회** — snapshot 이 아니라 현재 데이터 보고 lock 잡음. 그래서 같은 TX 안에서 단순 SELECT (snapshot) 와 SELECT FOR UPDATE (current) 가 다른 row 를 반환할 수 있다 (혼합 워크로드의 함정).

### 코드 예 — JPA 에서

```kotlin
// Consistent read (non-locking)
val account = accountRepository.findById(1L).orElseThrow()

// Locking read (PESSIMISTIC_WRITE = X-lock)
@Lock(LockModeType.PESSIMISTIC_WRITE)
fun findByIdForUpdate(id: Long): Account?
```

## Read View 와 phantom

### 단순 SELECT (consistent read)

```sql
-- T1: RR
SELECT * FROM orders WHERE status='NEW';  -- 5 rows

-- T2: INSERT new row (status='NEW') + COMMIT

-- T1: 같은 SELECT
SELECT * FROM orders WHERE status='NEW';  -- 여전히 5 rows
```

- T2 의 새 row 는 DB_TRX_ID 가 T1 의 ReadView 보다 큼 → 안 보임. **phantom 차단**.

### Locking SELECT (FOR UPDATE)

```sql
-- T1: RR
SELECT * FROM orders WHERE status='NEW' FOR UPDATE;  -- 5 rows + gap lock

-- T2: INSERT new row (status='NEW')
-- → BLOCK! gap lock + insert intention 충돌 (07 에서)
```

- locking read 는 gap lock 으로 차단. **두 메커니즘이 짝**.

## 페이지/Buffer Pool 과의 상호작용

- 모든 read 는 우선 buffer pool 확인 → miss 면 디스크에서 페이지 로드.
- buffer pool 의 LRU 는 **midpoint insertion** 사용 — 갑작스런 큰 스캔이 hot 페이지를 쫓아내는 걸 완화.
  - 새 페이지는 LRU 의 5/8 지점에 삽입.
  - 한 번 더 read 되어야 head 로 승격.

## 통계와 운영 명령

```sql
-- 현재 버전 체인 길이 추정 (purge 가 따라잡고 있나)
SHOW ENGINE INNODB STATUS\G
-- "History list length" 가 수만~수십만 → undo 적체. long TX 의심.

-- 미사용 undo 정리
-- innodb_purge_threads (기본 4) 가 백그라운드 정리.
```

### History list length 가 폭주하면

- 원인: 어디선가 long-running TX (특히 `START TRANSACTION READ ONLY` 후 안 끝남, 또는 OIV 로 수십 분짜리 SELECT).
- 결과: undo tablespace 폭증, buffer pool 이 undo 페이지로 가득, 일반 쿼리 느려짐.
- 진단: `SELECT * FROM information_schema.innodb_trx ORDER BY trx_started LIMIT 10;`
- 처치: 해당 connection KILL.

## 멘탈 모델

> "DB 는 **한 row 에 대한 시간 여행 영상** 을 들고 있다. 현재 화면 = 마지막 commit 된 모습. 누군가 들어와서 'TX 시작!' 하면 그 시점의 화면을 자기 머리에 박아두고, 다른 사람이 화면을 바꿔도 자기 머리 속 화면만 본다. 영상 (undo) 은 모든 시청자가 떠나야 지울 수 있다."

## 핵심 포인트

- InnoDB row 는 항상 **DB_TRX_ID + DB_ROLL_PTR** 을 들고 있다.
- **Undo log 가 MVCC 의 인프라** — 과거 버전 체인 + ROLLBACK 양쪽 용도.
- **Read View** 는 RR 에선 TX 첫 SELECT 시, RC 에선 매 SELECT 시 생성.
- 단순 SELECT = consistent read = MVCC. `FOR UPDATE` = locking read = 현재 데이터 + lock.
- **Phantom 은 consistent read 측면에선 자동 차단**, locking read 측면에선 gap lock 으로 차단.
- Long TX 는 undo 적체 → 히스토리 리스트 폭주 → 전체 DB 성능 저하. ADR-0020 의 핵심 이유.

## 다음 학습
- [07-lock-types.md](07-lock-types.md) — Record / Gap / Next-key / Insert Intention Lock 의 정확한 동작
- [16-msa-tx-routing.md](16-msa-tx-routing.md) — MVCC 가 ADR-0020 (외부 IO 분리) 와 어떻게 만나는지
