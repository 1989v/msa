---
parent: 5-spring-transactional
seq: 06
title: readOnly 심화 — writable(default)과의 비교
type: deep
created: 2026-05-01
---

# 06. readOnly 심화 — writable(default) 과의 비교

> **이 파일의 한 줄 요약** — `readOnly = true` 는 **단순 힌트가 아니라 4중 효과**를 갖는다: ① Hibernate FlushMode → MANUAL, ② entity snapshot 미보관, ③ JDBC `Connection.setReadOnly(true)`, ④ `TransactionSynchronizationManager` 메타로 라우팅 키 노출. 그 밖에 silent failure 안티패턴이 한 가지 있다.

---

## 1. `readOnly = true` 가 정확히 무엇을 하는가

```kotlin
@Transactional(readOnly = true)
fun findById(id: Long): Product = repository.findById(id) ?: throw NotFound()
```

뒤에서 일어나는 4가지 효과:

```
Spring                                              실제 효과
────────────────────────────────────────────────────────────────────────
@Transactional(readOnly=true)
   │
   ├─ 1. EntityManager.setFlushMode(MANUAL)         → dirty check skip, 자동 flush 안 함
   │
   ├─ 2. PersistenceContext 의 snapshot 미보관       → 메모리/CPU 절약
   │      (Hibernate org.hibernate.readOnly=true)
   │
   ├─ 3. Connection.setReadOnly(true)               → 드라이버 힌트
   │      (DataSourceUtils.prepareConnectionForTransaction)
   │
   └─ 4. TxSyncManager.isCurrentTransactionReadOnly() = true
                                                     → 라우팅 키 노출 (07 파일에서 활용)
```

각각 디테일을 보자.

---

## 2. 효과 1: Hibernate FlushMode → MANUAL

### Writable (default) 의 동작

```kotlin
@Transactional  // readOnly=false (default)
fun update(id: Long, newName: String) {
    val product = repository.findById(id)
    product.changeName(newName)
    // repository.save() 안 해도 commit 시 dirty check → flush
}
```

기본 FlushMode = `AUTO`:
- 쿼리 직전 자동 flush (read 와 write 정합성 보장)
- 트랜잭션 commit 직전 자동 flush
- entity 의 변경(dirty)을 검사 → 변경된 필드만 UPDATE 발행

### readOnly 의 동작

```kotlin
@Transactional(readOnly = true)
fun changeNameSilently(id: Long, newName: String) {
    val product = repository.findById(id)
    product.changeName(newName)  // ⚠ in-memory 만 변경
    // commit 시 flush 가 발생하지 않으므로 DB 미반영 (silent failure)
}
```

`readOnly = true` → Spring 이 `EntityManager.setFlushMode(FlushType.MANUAL)` 호출:
- **자동 flush 안 함**
- **dirty check 안 함**
- 명시적 `entityManager.flush()` 만 작동

### 왜 이게 효율적인가

읽기 전용 트랜잭션에서:
- dirty check 비용 = entity 개수 × 필드 개수 → 큰 조회에서 무시 못 할 비용
- 변경 안 할 거면 검사 자체가 낭비
- snapshot 메모리도 절약 (다음 효과)

---

## 3. 효과 2: PersistenceContext snapshot 미보관

### Writable 모드의 snapshot

JPA/Hibernate 는 entity 가 PersistenceContext 에 attach 될 때 **원본 상태의 snapshot** 을 유지한다. dirty check 시 현재 상태와 snapshot 을 비교해서 변경 감지.

```
PersistenceContext (entityManager)
├── Product(id=1) 인스턴스
│   ├─ name="A" (현재)
│   └─ snapshot: name="A" (원본 복사)
│
└── flush 시점: 현재 ≠ snapshot 비교 → 변경 감지
```

100개 entity 를 조회하면 100개의 snapshot 을 메모리에 유지. 큰 페이지 조회에서는 무시할 수 없음.

### readOnly 모드

Hibernate 는 `org.hibernate.readOnly` hint 를 통해 **snapshot 미보관**:

```kotlin
@Transactional(readOnly = true)
fun listProducts(): List<Product> = repository.findAll()  // snapshot 없음
```

- 메모리 절약
- dirty check 자체가 불가능 (비교할 원본 없음)
- 따라서 effect 1 (FlushMode.MANUAL) 과 함께 작동

---

## 4. 효과 3: JDBC Connection.setReadOnly(true)

### 동작

`DataSourceUtils.prepareConnectionForTransaction()` 이 `Connection.setReadOnly(true)` 호출.

JDBC 표준에서 이 메서드는 "이 트랜잭션은 readOnly 다" 라는 **드라이버 힌트** — 강제는 아님. 드라이버/DB 가 어떻게 처리할지는 구현 의존.

### MySQL 의 실제 동작

```java
Connection.setReadOnly(true);
// MySQL Connector/J 8.x → "SET SESSION TRANSACTION READ ONLY" 발행
```

readOnly 트랜잭션에서 INSERT/UPDATE/DELETE 시도 시:

```
ERROR 1792 (HY000): Cannot execute statement in a READ ONLY transaction.
```

→ 드라이버 단에서 예외 발생.

다만 **Hibernate 의 readOnly hint 와 JDBC setReadOnly 가 항상 함께 작동하지는 않는다**. Spring 은 둘 다 설정해주지만, 일부 환경에서 setReadOnly 가 무시되거나 효과가 약할 수 있음 (driver 버전 의존).

### Aurora / ProxySQL / RDS Proxy 라우팅

이 힌트는 **Aurora Read Replica 자동 라우팅** 의 핵심 신호:

- AWS Aurora MySQL: Connection 의 readOnly 플래그를 보고 reader endpoint 로 자동 라우팅 (드라이버 레벨)
- ProxySQL: query rule + connection state 로 read replica 라우팅
- RDS Proxy: read/write split 옵션 활성화 시 활용

**이것이 왜 우리에게 의미가 있나** — msa 가 application 레벨에서 이미 `RoutingDataSource` + `LazyConnectionDataSourceProxy` 로 라우팅을 하고 있어서, JDBC Connection.setReadOnly 를 별도로 활용하지는 않지만, Aurora 환경으로 옮길 때 추가 layer 로 활용 가능.

---

## 5. 효과 4: TransactionSynchronizationManager 메타 노출

### 동작

`@Transactional(readOnly=true)` 시작 시 Spring 이 `TransactionSynchronizationManager` 에 readOnly 플래그를 ThreadLocal 에 저장.

```kotlin
TransactionSynchronizationManager.isCurrentTransactionReadOnly()  // true
TransactionSynchronizationManager.getCurrentTransactionName()      // "com.kgd.product.application.ProductService.findById"
TransactionSynchronizationManager.isCurrentTransactionActive()     // true
TransactionSynchronizationManager.isActualTransactionActive()      // true
```

이 메타 정보를 활용해서:
- **`AbstractRoutingDataSource.determineCurrentLookupKey()`** 에서 readOnly 면 replica 로 분기 → **msa 11 서비스 표준 패턴**
- 로깅에 트랜잭션 메타 추가
- AOP advice 에서 트랜잭션 컨텍스트 확인

상세 패턴은 [07-replica-routing-pattern.md](07-replica-routing-pattern.md) 에서.

---

## 6. 안티패턴: readOnly = true 안에서 entity 수정 (Silent Failure)

### 시나리오

```kotlin
@Transactional(readOnly = true)
fun activate(productId: Long): Product {
    val product = repository.findById(productId) ?: throw NotFound()
    product.changeStatus(ProductStatus.ACTIVE)  // ⚠ readOnly 안에서 변경
    return product  // ❌ DB 미반영 — Silent Failure
}
```

`product.changeStatus(...)` 는 **JPA persistence context 안의 in-memory entity** 만 변경. 정상 시나리오라면 commit 시 dirty check → UPDATE 발행. 하지만 readOnly 모드는 FlushMode.MANUAL 이라 **flush 자체가 안 일어남**.

#### 결과:
- 컴파일 에러 없음
- 런타임 예외 없음
- 메서드는 정상 리턴
- DB 는 변경 안 됨
- 호출자는 변경됐다고 믿음

이게 가장 무서운 종류의 버그 — **silent failure**. 테스트가 in-memory 상태로 검증하면 통과해버림.

### 왜 driver 단 예외도 안 나는가

만약 `repository.save(product)` 를 명시적으로 호출했다면 INSERT/UPDATE SQL 이 발행되고 → JDBC `Connection.setReadOnly(true)` 가 걸려있으니 driver 가 예외를 던질 수도 있다 (MySQL 의 경우 ERROR 1792).

하지만 Hibernate 는 FlushMode.MANUAL 일 때 **SQL 자체를 발행하지 않는다** → driver 가 검사할 SQL 이 없음 → 예외도 없음.

`repository.save()` 도 Spring Data JPA 에서 entity 가 이미 attach 되어 있으면 별도 INSERT/UPDATE 없이 dirty check 에 위임 → readOnly 면 동일하게 silent.

### 방어 방법

1. **convention 강제**: msa 는 `docs/conventions/transactional-usage.md` 에서 단순 조회는 readOnly 도 빼고 (필요 시만), 변경은 readOnly 없는 트랜잭션에서.
2. **테스트**: Domain 테스트가 아니라 **integration test 에서 DB commit 후 재조회**로 검증. msa 의 `BehaviorSpec` 통합 테스트가 이 패턴.
3. **정적 분석**: `@Transactional(readOnly = true)` 메서드 안에서 setter/changeXxx 호출을 detekt rule 로 잡기 (오버엔지니어링 가능).

### 위 코드의 올바른 형태

```kotlin
@Transactional  // readOnly 제거
fun activate(productId: Long): Product {
    val product = repository.findById(productId) ?: throw NotFound()
    product.changeStatus(ProductStatus.ACTIVE)
    return product  // commit 시 dirty check → UPDATE
}
```

또는 명시적으로 별 트랜잭션으로 분리:
```kotlin
fun activate(productId: Long): Product {
    val product = readService.findById(productId)  // TX1 readOnly
    return writeService.activate(product)            // TX2 writable
}
```

---

## 7. readOnly = true vs `@Transactional` 빼기

msa convention (`docs/conventions/transactional-usage.md`) 은 **단순 조회 메서드에 `@Transactional(readOnly = true)` 도 권장하지 않는다**:

> 여러 쿼리 간 스냅샷 일관성이 필요하지 않은 경우 서비스 메서드에 `@Transactional` 을 선언하지 않는다.

이유:
- 단일 쿼리 = 자체 트랜잭션 (Spring Data 가 자동 관리)
- 외부 API/캐시 접근이 섞여 있을 때 트랜잭션이 커넥션을 길게 점유
- "필요할 때만 명시" 가 더 안전

### `@Transactional(readOnly = true)` 가 필요한 경우

| 상황 | 이유 |
|---|---|
| 여러 쿼리가 동일 스냅샷을 봐야 함 | 동시 변경 흡수 방지 |
| LazyLoading 필요 | PersistenceContext 가 메서드 끝까지 살아 있어야 |
| Replica 로 라우팅 시키고 싶음 (msa 패턴) | `RoutingDataSource` 가 readOnly 플래그를 봄 |
| 큰 조회 — snapshot 비용 절감 | dirty check + snapshot 보관 비용 회피 |

---

## 8. writable (default) vs readOnly 한눈에 비교

| 항목 | writable (default) | `readOnly = true` |
|---|---|---|
| FlushMode | AUTO | **MANUAL** |
| Dirty check | 활성 | **비활성** |
| Entity snapshot | 보관 | **미보관** |
| Connection.setReadOnly | false | **true** (드라이버 힌트) |
| TxSync.isCurrentTransactionReadOnly | false | **true** (라우팅 키) |
| INSERT/UPDATE/DELETE | 가능 | driver 단 예외 또는 무발행 |
| in-memory entity 변경 | commit 시 자동 반영 | **무시 (silent)** |
| 사용 시점 | 쓰기 / 단일 쓰기 트랜잭션 | 여러 쿼리 + 스냅샷 / Replica 라우팅 / Lazy |

---

## 9. 면접 답변 패턴

### Q. `readOnly = true` 의 실제 효과는?

> 4가지가 직렬로 작동합니다. 첫째, Hibernate FlushMode 가 MANUAL 로 바뀌어 자동 flush 와 dirty check 를 안 합니다. 둘째, persistence context 가 entity snapshot 을 안 보관해서 메모리/CPU 가 절약됩니다. 셋째, JDBC Connection.setReadOnly(true) 가 호출돼서 driver 단 힌트가 걸리는데, MySQL Connector/J 는 이걸 SESSION TRANSACTION READ ONLY 로 보내고 Aurora 같은 환경에서는 read replica 자동 라우팅 신호로 쓰입니다. 넷째, TransactionSynchronizationManager 에 readOnly 플래그가 ThreadLocal 로 노출돼서, AbstractRoutingDataSource 같은 application 레벨 라우팅에서 활용할 수 있습니다. 우리 msa 는 11개 서비스가 이 4번째 효과를 활용해서 RoutingDataSource 로 master/replica 를 분기하고 있습니다.

### Q. `readOnly = true` 트랜잭션 안에서 entity 를 수정하면?

> Silent failure 가 발생합니다. FlushMode 가 MANUAL 이라 dirty check 가 안 일어나고, JPA 가 SQL 을 발행하지 않아서 driver 의 readOnly 검사도 안 걸립니다. 메서드는 예외 없이 정상 리턴하고, in-memory 에서는 변경된 것처럼 보이지만 DB 에는 안 반영됩니다. 가장 무서운 종류의 버그라서 msa convention 에서는 **단순 조회는 `@Transactional` 자체를 빼고**, readOnly 가 정말 필요한 경우 (여러 쿼리 + 스냅샷, Lazy, Replica 라우팅) 에만 명시적으로 사용하도록 규정하고 있습니다.

---

## 10. 요약 카드

- `readOnly = true` 의 4중 효과: FlushMode.MANUAL / snapshot 미보관 / Connection.setReadOnly / TxSync 메타 노출
- writable (default) 와 가장 큰 차이는 **dirty check 의 유무** → 메모리/성능
- 안티패턴: `readOnly = true` 안에서 entity 변경 → silent failure (예외 없음, DB 미반영)
- msa convention: 단순 조회는 `@Transactional` 자체 안 붙임. readOnly 는 multi-query 일관성 / Lazy / Replica 라우팅 케이스에만.
- Aurora/ProxySQL 환경에서는 `Connection.setReadOnly(true)` 가 자동 read-replica 라우팅 신호

---

## 다음 학습

- [07-replica-routing-pattern.md](07-replica-routing-pattern.md) — readOnly 메타를 활용한 application-level routing
- [11-msa-mapping.md](11-msa-mapping.md) — msa 11 서비스의 실제 구현
