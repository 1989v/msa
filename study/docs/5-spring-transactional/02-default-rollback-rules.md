---
parent: 5-spring-transactional
seq: 02
title: 기본 롤백 규칙 + rollbackFor / noRollbackFor
type: deep
created: 2026-05-01
---

# 02. 기본 롤백 규칙

> **이 파일의 한 줄 요약** — `@Transactional` 은 **`RuntimeException` 과 `Error` 만 기본 롤백**, `Exception` (Checked) 은 기본 미롤백. 의도와 다르면 `rollbackFor` / `noRollbackFor` 로 명시.

---

## 1. 기본 롤백 규칙

Spring `TransactionInterceptor` 의 동작:

```
target.method() 실행
  ├─ 정상 종료              → commit
  ├─ RuntimeException 발생  → rollback
  ├─ Error 발생             → rollback
  └─ Checked Exception 발생 → commit (!!)
```

| 예외 타입 | 기본 동작 |
|---|---|
| `RuntimeException` (e.g. `IllegalArgumentException`, `BusinessException`) | **rollback** |
| `Error` (e.g. `OutOfMemoryError`) | rollback |
| `Exception` (Checked, e.g. `IOException`, `SQLException` non-RT) | **commit** |
| 정상 리턴 | commit |

### Kotlin 에서의 함의

**Kotlin 은 Checked Exception 이 없다.** 모든 예외가 RuntimeException 처럼 동작한다. 따라서 Kotlin 코드만 다룬다면 기본 롤백 규칙을 신경 쓸 일이 거의 없다.

다만 다음 경우에 Checked 가 등장한다:
- Java 라이브러리 호출 (`URLConnection.connect()` → `IOException`)
- JDBC 직접 사용 (`SQLException`)
- 파일 IO (Input/Output, 입출력) (`FileNotFoundException`)

```kotlin
@Transactional
fun saveAndExport(data: Data) {
    repository.save(data)
    exportToFile(data)  // throws IOException (Checked)
}

@Throws(IOException::class)
private fun exportToFile(data: Data) { ... }
```

`exportToFile` 이 `IOException` 을 던지면 **save 는 커밋된다.** 의도와 다른 결과.

---

## 2. 왜 Checked 는 기본 롤백 안 하나 — EJB 역사

Spring 의 이 규칙은 **EJB CMT (Container-Managed Transaction)** 표준에서 가져왔다.

EJB 시대에는 두 가지 예외 의미를 명확히 구분했다:
- **System Exception** = `RuntimeException` / `Error` → "예상 못 한 시스템 오류" → 롤백
- **Application Exception** = `Exception` (Checked) → "비즈니스가 명시적으로 던지는, 호출자가 인지하고 처리할 예외" → **롤백하지 않음** (호출자가 보상 결정)

이 철학이 Spring `@Transactional` 의 default 가 되었다. Checked 는 "비즈니스 로직의 일부" 로 간주되어 자동 롤백되지 않는 것.

10년 차에게 면접에서 이 역사를 말할 수 있으면 답변에 깊이가 생긴다 — "Spring 이 그렇게 정해서" 가 아니라 "EJB CMT 의 application exception / system exception 구분을 계승한 것".

---

## 3. `rollbackFor` / `noRollbackFor`

### `rollbackFor`

Checked Exception 이지만 롤백시키고 싶을 때:

```kotlin
@Transactional(rollbackFor = [Exception::class])  // Checked 포함 모든 예외 롤백
fun saveAndExport(data: Data) {
    repository.save(data)
    exportToFile(data)  // IOException 도 롤백
}
```

### `noRollbackFor`

RuntimeException 인데 롤백하고 싶지 않을 때 (드문 케이스):

```kotlin
@Transactional(noRollbackFor = [BusinessNotFoundException::class])
fun upsert(data: Data) {
    val existing = try {
        findOrThrow(data.id)  // throws BusinessNotFoundException (RT)
    } catch (e: BusinessNotFoundException) {
        null  // not found 는 정상 흐름
    }
    if (existing == null) save(data) else update(existing, data)
}
```

이 경우 **`findOrThrow` 가 `@Transactional` 메서드를 호출하지 않는 한** `noRollbackFor` 가 작동한다. 만약 호출한다면 → 03 / 08 파일의 self-invocation + UnexpectedRollbackException 함정.

### 기준

| 옵션 | 사용 시점 |
|---|---|
| `rollbackFor = [Exception::class]` | Java 라이브러리/Checked 예외 다루는 메서드 |
| `rollbackFor = [SpecificCheckedException::class]` | 특정 Checked 만 롤백 |
| `noRollbackFor = [...]` | RT 인데 비즈니스적으로 정상 케이스인 예외 |

---

## 4. 트랜잭션 롤백 결정의 다섯 단계

```
1. 메서드 실행 중 예외 발생
        ↓
2. TransactionInterceptor.completeTransactionAfterThrowing()
        ↓
3. RuleBasedTransactionAttribute.rollbackOn(ex)
        ├─ rollbackFor 매칭? → rollback
        ├─ noRollbackFor 매칭? → commit
        └─ 둘 다 없으면 default: RT/Error 만 rollback
        ↓
4. PlatformTransactionManager.rollback(status) or commit(status)
        ↓
5. 예외 그대로 호출자에게 전파
```

핵심: **롤백 여부는 예외 타입 매칭만으로 결정**. 메서드의 정상/비정상 종료가 아니라 **던진 예외가 무엇인가** 만 본다.

---

## 5. 함정: catch 후 정상 리턴

```kotlin
@Transactional
fun process(cmd: Command): Result {
    try {
        repository.save(cmd.toEntity())
        externalApi.notify(cmd)  // ⚠ throws IOException
    } catch (e: IOException) {
        log.warn("notify failed", e)
        return Result.partial()   // 정상 리턴 → commit
    }
    return Result.success()
}
```

이 코드는 외부 API 가 실패해도 **save 는 commit 된다**. 외부 시스템 동기화 실패 시에도 DB 만 저장되는 inconsistency 발생 가능.

해결:
- catch 후 `throw RuntimeException` 또는 `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()` 명시 호출
- 또는 처음부터 외부 API 호출을 트랜잭션 밖으로 분리 (msa 권장)

```kotlin
@Transactional
fun process(cmd: Command): Result {
    try {
        ...
    } catch (e: IOException) {
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()
        return Result.partial()
    }
}
```

---

## 6. 함정: 중첩 호출 시 catch + UnexpectedRollbackException

```kotlin
@Transactional
fun outer() {
    try {
        innerService.inner()  // @Transactional, throws RT
    } catch (e: Exception) {
        // 무시하려는 의도
    }
    // 여기서 commit 시도 → UnexpectedRollbackException
}
```

`inner()` 에서 RT 가 발생하면 Spring 은 트랜잭션을 **rollback-only 로 마킹** (전파 REQUIRED 의 경우 같은 트랜잭션이므로). outer 의 catch 가 예외를 삼켜도 **마킹은 되돌릴 수 없다**. outer 가 정상 리턴하려는 시점에 Spring 이 commit 을 시도하지만 rollback-only 마킹을 발견하고 `UnexpectedRollbackException` 을 던진다.

상세는 [08-class-level-pitfalls.md](08-class-level-pitfalls.md) 에서 다룸.

---

## 7. 격리 수준의 default

`@Transactional` 의 `isolation` 속성도 비슷하게 default 는 **`Isolation.DEFAULT` = DB 의 기본값에 위임**.

| DB | 기본 격리 |
|---|---|
| MySQL InnoDB | `REPEATABLE READ` |
| PostgreSQL | `READ COMMITTED` |
| Oracle | `READ COMMITTED` |
| SQL Server | `READ COMMITTED` |

**DB 가 다르면 같은 코드의 격리 동작이 달라진다는 의미**. 격리에 의존하는 비즈니스라면 `@Transactional(isolation = ...)` 명시.

상세는 [05-isolation-levels.md](05-isolation-levels.md) 에서.

---

## 8. msa 코드 연결

msa 의 `BusinessException` 은 `RuntimeException` 을 상속:

```kotlin
// common/exception/BusinessException.kt
class BusinessException(
    val errorCode: ErrorCode,
    message: String? = null,
) : RuntimeException(message ?: errorCode.message)
```

따라서 msa 의 모든 비즈니스 예외는 **기본 롤백 동작**. Kotlin 에 Checked 가 없으니 `rollbackFor` 를 명시할 필요가 거의 없다 — 이게 Kotlin + Spring 조합의 실용적 장점.

다만 `OrderService.execute()` 에서 `paymentPort.requestPayment()` 호출 부분은 **catch 후 OrderTransactionalService.cancelOrder(orderId) 를 호출**하는 패턴인데, 이는 다음과 같이 작동:

```kotlin
try {
    paymentPort.requestPayment(...)
} catch (e: Exception) {
    val cancelled = orderTransactionalService.cancelOrder(orderId)  // 새 TX (TX2')
    eventPort.publishOrderCancelled(cancelled)
    throw BusinessException(...)  // 명시적 throw → 호출자에게 전파
}
```

`OrderService.execute()` 자체에는 `@Transactional` 이 없으므로 `UnexpectedRollbackException` 우려가 없다 — 외부 catch 와 내부 catch 가 같은 트랜잭션에 있을 때만 함정이 발생한다는 점을 정확히 이해하고 설계된 코드.

---

## 9. 요약 카드

- 기본 롤백 규칙: **RuntimeException / Error → rollback**, **Checked → commit**
- 역사적 이유: EJB CMT 의 system exception (RT) vs application exception (Checked) 구분
- Kotlin 에는 Checked 가 없으므로 rollbackFor 가 거의 필요 없음
- `rollbackFor = [Exception::class]` — 모든 예외 롤백 (보수적)
- `noRollbackFor = [...]` — 특정 RT 만 무시 (드문 케이스)
- **catch 후 정상 리턴 = commit** → 외부 IO 실패가 묻힐 위험
- 격리 수준 기본값은 `Isolation.DEFAULT` = DB 기본값 (MySQL = REPEATABLE READ)

---

## 다음 학습

- [03-self-invocation.md](03-self-invocation.md) — 같은 클래스 내부 호출의 함정
- [05-isolation-levels.md](05-isolation-levels.md) — 격리 수준과 DB 실제 동작
- [08-class-level-pitfalls.md](08-class-level-pitfalls.md) — UnexpectedRollbackException 상세
