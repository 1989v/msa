---
parent: 5-spring-transactional
seq: 10
title: TransactionTemplate / 프로그래밍 방식 트랜잭션
type: deep
created: 2026-05-01
---

# 10. TransactionTemplate / 프로그래밍 방식

> **이 파일의 한 줄 요약** — `@Transactional` 은 선언적, `TransactionTemplate` 은 프로그래밍 방식. 동적 조건/세밀 제어 / suspend / 프록시 미지원 환경에서 유용. 실무 빈도는 낮지만 알고 있으면 함정 회피.

---

## 1. 선언적 vs 프로그래밍 방식

### 선언적 — `@Transactional`

```kotlin
@Transactional(readOnly = true, timeout = 5)
fun findById(id: Long): Product? = repository.findById(id)
```

- AOP 프록시가 호출 전후로 트랜잭션 관리
- 코드가 깔끔, 의도 명확
- **프록시 의존** — self-invocation, suspend, private 메서드 등에서 함정

### 프로그래밍 방식 — `TransactionTemplate`

```kotlin
@Service
class ProductService(
    private val repository: ProductRepository,
    private val tx: TransactionTemplate,
) {
    fun findById(id: Long): Product? = tx.execute { repository.findById(id) }
}
```

- 코드로 직접 트랜잭션 시작/commit/rollback
- 프록시 의존 없음 → self-invocation 무관
- 코드량 증가, 의도가 분산

---

## 2. TransactionTemplate 사용

### 기본 빈 등록

```kotlin
@Configuration
class TxConfig {
    @Bean
    fun transactionTemplate(txManager: PlatformTransactionManager): TransactionTemplate =
        TransactionTemplate(txManager).apply {
            propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRED
            isolationLevel = TransactionDefinition.ISOLATION_DEFAULT
            timeout = 30
            isReadOnly = false
        }
}
```

Spring Boot 는 `JpaTransactionManager` 가 있으면 자동으로 `TransactionTemplate` 빈을 만들어주지 않음 — 명시적 등록 필요.

### 사용

```kotlin
fun process(cmd: Command): Result {
    return tx.execute { status ->
        try {
            val saved = repository.save(...)
            // 비즈니스 로직
            Result.success(saved)
        } catch (e: SomeBusinessException) {
            status.setRollbackOnly()
            Result.failure(e.message)
        }
    } ?: Result.failure("transaction returned null")
}
```

- `execute(callback)` — 콜백 실행 + 자동 commit/rollback
- `status.setRollbackOnly()` — 명시적 롤백 마킹
- 콜백 안에서 RT 발생 → 자동 rollback (선언적과 동일 규칙: RT/Error 만 rollback, Checked 는 commit)

### `executeWithoutResult` (Kotlin 친화)

```kotlin
fun saveAll(items: List<Item>) {
    tx.executeWithoutResult { _ ->
        items.forEach { repository.save(it) }
    }
}
```

리턴 값이 없을 때 사용. (Spring 5.2+)

---

## 3. 다른 propagation/isolation 별 사용

같은 메서드에서 여러 트랜잭션을 다르게 시작:

```kotlin
@Service
class BatchService(
    txManager: PlatformTransactionManager,
) {
    private val txRequiresNew = TransactionTemplate(txManager).apply {
        propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
    }
    private val txReadOnly = TransactionTemplate(txManager).apply {
        isReadOnly = true
    }

    fun process(items: List<Item>) {
        items.forEach { item ->
            txRequiresNew.execute {  // 각 아이템마다 새 트랜잭션
                processOne(item)
            }
        }
    }
}
```

- `TransactionTemplate` 인스턴스마다 속성 고정 — 동적이라기보단 빈에 미리 정의해두고 골라 쓰는 패턴

---

## 4. 언제 TransactionTemplate 을 쓰나

### 케이스 1: 동적 조건

```kotlin
fun process(cmd: Command, useShortTx: Boolean): Result {
    val template = if (useShortTx) shortTx else longTx
    return template.execute { ... }
}
```

`@Transactional` 은 컴파일 타임 결정 — 런타임에 timeout 을 동적으로 바꿀 수 없다.

### 케이스 2: Suspend / Coroutine 환경

```kotlin
suspend fun execute(cmd: Command): Result = withContext(Dispatchers.IO) {
    tx.execute { repository.save(...) }!!
}
```

`@Transactional` 은 suspend 메서드와 잘 안 어울림 (ThreadLocal 기반 동기화). `withContext(Dispatchers.IO)` 로 Thread 를 고정한 뒤 `TransactionTemplate` 을 부르면 동작.

다만 msa 의 표준은 **suspend 메서드에 `@Transactional` 을 안 붙이고**, non-suspend 빈 (`OrderTransactionalService`) 의 메서드를 호출하는 우회. `TransactionTemplate` 은 빈 분리가 어려운 케이스에서만 고려.

### 케이스 3: 프레임워크 외부에서 트랜잭션이 필요할 때

- 스케줄러/Job 의 entry point
- 이벤트 listener (Spring 외부 lib)
- main 메서드에서 트랜잭션 필요

### 케이스 4: 명시적 컨트롤이 필요한 곳

- 복잡한 retry 로직
- 트랜잭션 안의 부분 실패를 정밀 제어
- Saga orchestrator 의 step 처리

---

## 5. 프로그래밍 방식의 다른 도구

### `PlatformTransactionManager` 직접 사용

```kotlin
@Service
class LowLevelService(
    private val txManager: PlatformTransactionManager,
) {
    fun manualTx() {
        val def = DefaultTransactionDefinition().apply {
            propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRED
        }
        val status = txManager.getTransaction(def)
        try {
            // 비즈니스 로직
            txManager.commit(status)
        } catch (e: Exception) {
            txManager.rollback(status)
            throw e
        }
    }
}
```

`TransactionTemplate` 의 내부를 그대로 노출한 형태. 거의 안 씀 — 보일러플레이트만 늘어남.

### `TransactionAspectSupport.currentTransactionStatus()`

```kotlin
@Transactional
fun process() {
    try {
        ...
    } catch (e: Exception) {
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()
    }
}
```

`@Transactional` 안에서 명시적 롤백 마킹할 때. 08 파일의 함정 회피책.

---

## 6. Reactive 환경의 트랜잭션

### 문제: ThreadLocal 미작동

`TransactionSynchronizationManager` 는 ThreadLocal 기반 — Reactor / WebFlux 환경에서는 Thread 가 자유롭게 hop 하므로 그대로 안 통한다.

### 해결: ReactiveTransactionManager + TransactionalOperator

```kotlin
@Service
class ReactiveProductService(
    private val repository: ReactiveProductRepository,
    private val tx: TransactionalOperator,
) {
    fun create(cmd: Command): Mono<Product> = repository.save(...)
        .`as`(tx::transactional)
}
```

또는 `@Transactional` (Spring 5+ 가 Reactive 환경 인식) — 다만 R2DBC 같은 reactive driver 가 필요. msa 는 JPA + JDBC 환경이라 reactive 트랜잭션은 미사용.

### 코루틴

```kotlin
@Service
class CoroutineService(
    private val tx: TransactionalOperator,
) {
    suspend fun create(cmd: Command): Product {
        return tx.executeAndAwait { repository.save(...) }
    }
}
```

`spring-tx` 6+ 의 코루틴 확장. Spring Boot 3.0+ 에서 사용 가능.

---

## 7. msa 코드의 트랜잭션 전략

`grep` 으로 확인한 msa 의 트랜잭션 사용:

| 도구 | 사용처 |
|---|---|
| `@Transactional` (선언적) | 거의 모든 Service / TransactionalService |
| `@Transactional(readOnly = true)` | 조회 메서드 (필요한 경우만) |
| `TransactionTemplate` | **사용 없음** (`grep -rn "TransactionTemplate"` 0건) |
| `TransactionAspectSupport` | 사용 없음 |
| `ReactiveTransactionManager` | 사용 없음 (JPA + JDBC 환경) |

**msa 는 선언적 트랜잭션 + 클래스 분리 (TransactionalService) 만으로 모든 케이스를 풀고 있다.** 이게 깔끔한 패턴이고, `TransactionTemplate` 의 필요성이 없다는 의미.

`OrderService.execute()` 가 suspend 인 경우조차 `OrderTransactionalService` 의 non-suspend 메서드 호출로 우회 — `TransactionTemplate` 도입 필요 없음.

---

## 8. TransactionTemplate vs 선언적 비교표

| 항목 | `@Transactional` | `TransactionTemplate` |
|---|---|---|
| 코드량 | 적음 | 많음 |
| 의도 가시성 | 높음 (애노테이션) | 낮음 (코드에 분산) |
| 프록시 의존 | 있음 | 없음 |
| self-invocation 영향 | 받음 | 안 받음 |
| 동적 속성 | 어려움 | 쉬움 |
| Suspend / Coroutine | 어색함 | 쉬움 (단, 빈 분리로도 해결) |
| 빈도 | ★★★ | ☆ |

---

## 9. 면접 답변 패턴

### Q. TransactionTemplate 은 언제 쓰나요?

> 거의 안 씁니다. `@Transactional` 이 선언적이라 코드가 깔끔하고, 함정도 클래스 분리로 거의 다 풀리니까요. 그래도 알고 있는 케이스는 두 가지: 첫째, 동적으로 timeout 이나 propagation 을 바꿔야 할 때. 둘째, suspend 함수처럼 ThreadLocal 기반 트랜잭션 동기화가 어색한 곳에서 명시적으로 트랜잭션 경계를 정해야 할 때입니다. 다만 우리 msa 는 suspend 인 OrderService 도 non-suspend 인 OrderTransactionalService 빈을 호출하는 우회로 풀어서 TransactionTemplate 없이 모든 케이스를 처리하고 있습니다.

---

## 10. 요약 카드

- `TransactionTemplate` = 프로그래밍 방식 트랜잭션 — 콜백 기반
- 프록시 의존 없음 → self-invocation, suspend 환경에서 안전
- 동적 조건, 명시적 retry/rollback 제어가 필요한 케이스
- msa 는 선언적 + 클래스 분리만으로 모두 해결, `TransactionTemplate` 미사용
- Reactive 환경은 `TransactionalOperator` (ReactiveTransactionManager 기반) — msa 미해당

---

## 다음 학습

- [11-msa-mapping.md](11-msa-mapping.md) — msa 11 서비스의 트랜잭션 표준
- [12-msa-outbox-saga.md](12-msa-outbox-saga.md) — msa Outbox + Saga 적용 분석
