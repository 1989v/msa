---
parent: 5-spring-transactional
seq: 05
title: 격리 수준 + DB 실제 동작 (InnoDB REPEATABLE READ)
type: deep
created: 2026-05-01
---

# 05. 격리 수준과 DB 실제 동작

> **이 파일의 한 줄 요약** — 표준 ANSI 4단계는 모델일 뿐, **InnoDB 의 REPEATABLE READ 는 일반적인 정의보다 강하다 (phantom 까지 차단)**. 실무는 DB 별 실제 구현을 알아야 한다.

---

## 1. 격리 수준이 다루는 문제

격리는 **동시 실행되는 트랜잭션이 서로의 결과를 어디까지 볼 것인가** 를 결정한다. 4가지 anomaly:

| Anomaly | 설명 | 예시 |
|---|---|---|
| **Dirty Read** | 다른 TX 의 **commit 안 된** 변경을 읽음 | TX1 이 row 수정 → TX2 가 그 값을 읽음 → TX1 롤백 → TX2 가 읽은 값은 허상 |
| **Non-repeatable Read** | 같은 row 를 두 번 읽었는데 값이 다름 | TX1 이 SELECT → TX2 가 UPDATE/COMMIT → TX1 이 다시 SELECT → 다른 값 |
| **Phantom Read** | 같은 조건의 SELECT 가 두 번에서 row 개수가 다름 | TX1 이 SELECT WHERE x>10 → TX2 가 INSERT(x=15) COMMIT → TX1 이 다시 SELECT → 새 row 등장 |
| **Lost Update** | 두 TX 가 같은 row 를 동시 수정해 한쪽이 묻힘 | TX1 read → TX2 read → TX1 write → TX2 write (TX1 변경 손실) |

---

## 2. ANSI 4 표준 격리 수준

| 격리 | Dirty Read | Non-rep Read | Phantom |
|---|---|---|---|
| **READ UNCOMMITTED** | O (허용) | O | O |
| **READ COMMITTED** | X | O | O |
| **REPEATABLE READ** | X | X | O |
| **SERIALIZABLE** | X | X | X |

ANSI 표준만 보면 REPEATABLE READ 는 phantom 을 허용한다. 하지만 **실제 DB 는 다르게 구현한다.**

---

## 3. DB 별 실제 구현

### MySQL InnoDB (REPEATABLE READ — default)

InnoDB 의 REPEATABLE READ 는 **phantom 까지 차단** 하는, 표준보다 강한 구현이다.

| 메커니즘 | 효과 |
|---|---|
| **Consistent Read (Snapshot)** | 일반 SELECT 는 트랜잭션 시작 시 스냅샷을 본다 → 다른 TX 의 commit 무시 |
| **Gap Lock + Next-Key Lock** | `SELECT ... FOR UPDATE` 같은 locking read 에서 인덱스 범위에 gap lock 을 걸어 INSERT 를 차단 → phantom 차단 |

```sql
-- TX1
START TRANSACTION;
SELECT * FROM orders WHERE user_id = 10 FOR UPDATE;
-- → user_id 인덱스 범위에 gap lock + next-key lock

-- TX2
INSERT INTO orders (user_id, ...) VALUES (10, ...);
-- → blocked! gap lock 때문에 대기

-- TX1 commit 후 TX2 진행
```

InnoDB 의 일반 SELECT 는 MVCC (Multi-Version Concurrency Control) 로 스냅샷을 보고, locking read (`FOR UPDATE`/`LOCK IN SHARE MODE`) 만 gap lock 을 활용. 따라서 **MySQL 에서 REPEATABLE READ 면 보통 phantom 도 안 본다**.

### PostgreSQL (READ COMMITTED — default)

PostgreSQL 도 MVCC 기반. REPEATABLE READ (`SERIALIZABLE SNAPSHOT ISOLATION` 의 약화 버전) 는 ANSI 표준 그대로의 의미를 갖는다 — **phantom 차단함, 단 write skew 는 발생 가능**.

PostgreSQL 의 `SERIALIZABLE` 은 SSI (Serializable Snapshot Isolation) 로 구현되어 lock 없이도 직렬화 가능성을 보장.

### Oracle / SQL Server

- **Oracle**: READ UNCOMMITTED, REPEATABLE READ 미지원. READ COMMITTED + SERIALIZABLE + 자체 READ_ONLY 만 지원. default 는 READ COMMITTED.
- **SQL Server**: 4단계 + SNAPSHOT (옵션) 지원. default 는 READ COMMITTED.

---

## 4. Spring 의 Isolation 매핑

```kotlin
@Transactional(isolation = Isolation.READ_COMMITTED)
fun something() { ... }
```

```kotlin
enum class Isolation {
    DEFAULT,            // DB 기본값 사용 (권장)
    READ_UNCOMMITTED,
    READ_COMMITTED,
    REPEATABLE_READ,
    SERIALIZABLE,
}
```

`Isolation.DEFAULT` 의 default 는 **DB 기본값** — 같은 코드라도 DB 가 다르면 격리가 다르게 동작.

| DB | Isolation.DEFAULT 의 의미 |
|---|---|
| MySQL InnoDB | REPEATABLE READ |
| PostgreSQL | READ COMMITTED |
| Oracle | READ COMMITTED |

**MySQL → PostgreSQL 이전 시 동시성 동작이 바뀐다는 점 주의**. DB 마이그레이션 면접 질문에 자주 나옴.

---

## 5. MVCC 가 격리에 미치는 효과

### MVCC 가 무엇인가

각 row 에 여러 버전을 유지하고, 트랜잭션이 자기 시점의 버전을 본다. lock 없이 일관된 읽기가 가능.

```
row(id=1, value=100, txn_id=10)        ← TX10 이 만든 버전
   │
   ├── value=200, txn_id=20            ← TX20 이 만든 버전 (commit 됨)
   │
   └── value=300, txn_id=25            ← TX25 가 만든 버전 (uncommit)

TX21 이 SELECT * WHERE id=1 →
  → 자기 시점에서 commit 된 가장 최근 버전 = 200 을 봄
```

### MVCC 의 이점

- 읽기/쓰기 충돌 없음 (Reader-Writer block 회피)
- 일관된 스냅샷 제공
- 단, 오래된 버전을 정리하는 비용 발생 (PostgreSQL 의 VACUUM, MySQL 의 purge)

### MVCC 한계 — Write Skew

PostgreSQL 의 REPEATABLE READ 같은 SI (Snapshot Isolation) 는 write skew 를 막지 못한다.

```
TX1: SELECT count(*) WHERE on_call=true → 2명
TX1: UPDATE set on_call=false WHERE id=A
TX2: SELECT count(*) WHERE on_call=true → 2명 (스냅샷)
TX2: UPDATE set on_call=false WHERE id=B
TX1 commit
TX2 commit
→ 결과: on_call 인 사람이 0명. "최소 1명은 on_call 이어야 한다" 제약 위반.
```

이를 막으려면 **SERIALIZABLE** 또는 **SELECT FOR UPDATE** 로 명시적 lock.

---

## 6. SELECT FOR UPDATE / LOCK IN SHARE MODE

```sql
SELECT * FROM products WHERE id = 1 FOR UPDATE;        -- X-lock (배타)
SELECT * FROM products WHERE id = 1 LOCK IN SHARE MODE; -- S-lock (공유)
```

JPA / Spring Data 에서는 `@Lock` 으로:

```kotlin
interface ProductRepository : JpaRepository<ProductJpaEntity, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM ProductJpaEntity p WHERE p.id = :id")
    fun findByIdForUpdate(id: Long): ProductJpaEntity?
}
```

| LockModeType | SQL |
|---|---|
| PESSIMISTIC_READ | LOCK IN SHARE MODE |
| PESSIMISTIC_WRITE | FOR UPDATE |
| PESSIMISTIC_FORCE_INCREMENT | FOR UPDATE + version 증가 |
| OPTIMISTIC | (read 시점 version 검증, commit 시 검증 다시) |
| OPTIMISTIC_FORCE_INCREMENT | OPTIMISTIC + 무조건 version 증가 |

### Optimistic Lock (`@Version`)

```kotlin
@Entity
class ProductJpaEntity(
    @Id val id: Long,
    val name: String,
    @Version var version: Long = 0,  // JPA 가 자동 증가 + 검증
)
```

UPDATE 시 `WHERE id = ? AND version = ?` 자동 추가. 다른 트랜잭션이 먼저 commit 했다면 version 이 안 맞아 0 row affected → `OptimisticLockException` 발생.

**msa 의 Inventory 에서 재고 차감 같은 동시성 충돌이 잦은 영역에 추천**. 다만 현재 msa 코드에는 `@Version` 적용이 없음 (개선 후보 — [13-improvements.md](13-improvements.md) 참고).

---

## 7. 격리 수준 선택 기준

| 시나리오 | 권장 격리 |
|---|---|
| 일반 OLTP CRUD | **DEFAULT** (DB 기본값 사용) |
| 통계/리포트 조회 | READ_COMMITTED 또는 NOT_SUPPORTED |
| 금융/재고 차감 (절대 lost update 금지) | **REPEATABLE_READ + SELECT FOR UPDATE** 또는 SERIALIZABLE |
| 분산 시스템 + 짧은 TX | READ_COMMITTED + 비관적 lock 회피 |

### 면접 답변 패턴

> "MySQL 기본값이 REPEATABLE READ 인데, InnoDB 는 표준 정의보다 강해서 일반 SELECT 도 스냅샷을 보고 locking read 는 gap lock 까지 걸어 phantom 까지 차단합니다. 그래서 PostgreSQL READ COMMITTED 에서 동작하던 코드를 MySQL 로 옮길 때는 격리 동작이 더 강해지는 방향이지만, 반대로 MySQL → PostgreSQL 이전 시 동시성 버그가 새로 드러날 수 있습니다."

---

## 8. msa 코드 연결

msa 의 모든 서비스는 **MySQL InnoDB + 기본 격리 (REPEATABLE READ)** 위에서 동작한다. `application.yml` 의 datasource 설정에 격리 명시 없음 → InnoDB default 그대로.

`@Transactional(isolation = ...)` 사용처도 `grep` 결과 거의 없음 — 이는 InnoDB 의 강한 default 가 비즈니스 요구를 충분히 만족시킨다는 의미.

### 재고 차감 (Inventory) 의 동시성 처리

```kotlin
@Transactional
override fun execute(command: ReserveStockUseCase.Command): ReserveStockUseCase.Result {
    val inventory = inventoryRepository.findByProductIdAndWarehouseId(...)  // 일반 SELECT
    inventory.reserve(command.qty)  // 도메인 메서드 (in-memory 검증)
    val savedInventory = inventoryRepository.save(inventory)
    ...
}
```

현재는 `@Version` 도 없고 `FOR UPDATE` 도 없다. 즉 **두 요청이 동시에 같은 productId/warehouseId 에 reserve 를 시도하면 lost update 가능**. 실제 운영에서는 다음 셋 중 하나로 보강 필요:

1. **Optimistic Lock**: `@Version` 추가 → 충돌 시 `OptimisticLockException` 후 재시도
2. **Pessimistic Lock**: `findByIdForUpdate` 로 SELECT FOR UPDATE
3. **Redis 분산 락**: 외부 큐로 직렬화

msa 코드의 cachePort 는 fast-path 검증용일 뿐 (DB 가 SSOT) → 동시성 보장 메커니즘은 아님.

이 부분은 [13-improvements.md](13-improvements.md) 의 개선 후보로 정리.

---

## 9. 요약 카드

- ANSI 4단계: READ_UNCOMMITTED < READ_COMMITTED < REPEATABLE_READ < SERIALIZABLE
- 4 anomaly: Dirty / Non-repeatable / Phantom / Lost Update
- **MySQL InnoDB REPEATABLE READ** 는 표준보다 강함 — phantom 까지 차단 (gap lock + MVCC)
- **PostgreSQL** default 는 READ COMMITTED, REPEATABLE READ 는 SI (write skew 가능)
- **Oracle** 은 REPEATABLE READ 미지원
- `Isolation.DEFAULT` = DB 기본값 — 마이그레이션 시 동작 변화 주의
- 동시성 충돌 핵심 도구: SELECT FOR UPDATE (Pessimistic) / `@Version` (Optimistic)

---

## 다음 학습

- [06-readonly-vs-writable.md](06-readonly-vs-writable.md) — readOnly 의 진짜 효과
- [07-replica-routing-pattern.md](07-replica-routing-pattern.md) — Replica routing
