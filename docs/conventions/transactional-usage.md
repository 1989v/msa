# @Transactional 사용 규칙

> **출처**: ADR-0020 에서 이전 (ADR-0026 분류 정책에 따른 재배치). 본문 자체가 "유형: Convention" 라벨이었고, 4가지 규칙 모두 사용법/안티패턴 회피 가이드. 원칙 ("외부 IO 는 TXN 밖 / DB 커넥션 점유 최소화") 은 `docs/conventions/code-convention.md` §6 (TransactionalService 분리 패턴) 에서 다룸.
> **History**: 원본 ADR 본문은 git history 의 `ADR-0020-transactional-usage.md` 참조.

## 규칙

### 1. 단순 조회 서비스 메서드에 `@Transactional(readOnly = true)` 를 걸지 않는다

- 여러 쿼리 간 스냅샷 일관성이 필요하지 않은 경우 서비스 메서드에 `@Transactional` 을 선언하지 않는다.
- 각 Repository 호출은 자체 트랜잭션으로 실행되므로 별도 선언이 불필요하다.
- 특히 **외부 API 호출 / 캐시 접근 / 메시징이 포함된 메서드** 에서는 트랜잭션이 외부 호출 동안 DB 커넥션을 점유하므로 반드시 피한다.

**`@Transactional(readOnly = true)` 가 필요한 경우:**
- 여러 쿼리가 동일 스냅샷을 봐야 하는 경우 (정합성 요구)
- LazyLoading 으로 인해 영속성 컨텍스트가 필요한 경우

### 2. 외부 IO 가 포함된 메서드에서 트랜잭션을 분리한다

`docs/conventions/code-convention.md` §6 의 Transactional Service 분리 패턴을 준수한다:

```
TX1 (짧은 트랜잭션): 엔티티 저장/변경
→ 외부 API 호출 / 캐시 동기화 (트랜잭션 밖)
→ TX2 (짧은 트랜잭션): 결과 반영
```

- `{Entity}TransactionalService`: 짧은 DB 트랜잭션만 담당
- `{Entity}Service`: 전체 흐름 오케스트레이션 (트랜잭션 없음)

### 3. 중첩 `@Transactional` 에서 예외를 catch 하지 않는다

- `@Transactional` 메서드 A 가 `@Transactional` 메서드 B 를 호출할 때, B 에서 발생한 예외를 A 에서 catch 하면 `UnexpectedRollbackException` 이 발생한다.
- Spring AOP 프록시가 예외를 감지하여 트랜잭션을 rollback-only 로 마킹한 뒤 예외를 전파하므로, 호출부에서 catch 해도 롤백 마킹은 되돌릴 수 없다.

**대안**:
- 예외 대신 null 을 반환하는 별도 메서드를 제공한다. (예: `findByProvider()` → `findByProviderOrNull()`)
- 외부 트랜잭션이 불필요하면 `@Transactional` 을 제거한다.

### 4. 클래스 레벨 `@Transactional` 사용 시 주의

- 클래스 레벨 `@Transactional` 을 선언하면 모든 public 메서드가 트랜잭션에 참여한다.
- 조회 전용 메서드가 쓰기 트랜잭션에 참여하거나, 예외 발생 시 의도치 않은 롤백이 발생할 수 있다.
- **가능하면 메서드 레벨에서 필요한 곳에만 `@Transactional` 을 선언한다.**
- 클래스 레벨 선언이 필요한 경우, 조회 메서드에는 `@Transactional(readOnly = true)` 를 명시한다.

## 예시

```kotlin
// ❌ BAD: 외부 캐시/API 호출이 포함된 메서드에 @Transactional
@Transactional(readOnly = true)
fun getDetail(productId: Long): DetailResponse {
    val product = productRepository.findById(productId)     // DB 조회
    val stock = cachePort.getStock(productId)                // Redis — 트랜잭션이 커넥션 점유
    return DetailResponse(product, stock)
}

// ✅ GOOD: 트랜잭션 없이 각 호출이 자체 트랜잭션/커넥션 사용
fun getDetail(productId: Long): DetailResponse {
    val product = productRepository.findById(productId)
    val stock = cachePort.getStock(productId)
    return DetailResponse(product, stock)
}
```

```kotlin
// ❌ BAD: @Transactional 안에서 외부 API 호출 + DB 저장
@Transactional
fun processOrder(command: Command): Result {
    val order = orderRepository.save(Order.create(command))
    val payment = paymentClient.charge(order)  // 외부 API — DB 커넥션 점유
    order.complete(payment)
    return orderRepository.save(order)
}

// ✅ GOOD: TransactionalService 패턴으로 분리
fun processOrder(command: Command): Result {
    val order = transactionalService.createPending(command)  // TX1
    val payment = paymentClient.charge(order)                // 트랜잭션 밖
    return transactionalService.complete(order, payment)     // TX2
}
```

```kotlin
// ❌ BAD: 중첩 @Transactional에서 예외 catch → UnexpectedRollbackException
@Transactional
fun process() {
    val result = try {
        innerService.doSomething()  // @Transactional 메서드 — 예외 시 rollback-only
    } catch (e: Exception) {
        null  // catch해도 rollback-only 마킹은 되돌릴 수 없음
    }
}

// ✅ GOOD: null 반환 메서드 사용
fun process() {
    val result = innerService.doSomethingOrNull()
}
```

## 배경

mrt-package 에서 `@Transactional(readOnly = true)` 내부의 nested `@Transactional` 메서드가 예외를 던지면서 `UnexpectedRollbackException` 장애가 발생한 사례가 있었다. MSA 에서도 동일한 패턴이 발견되어 예방적으로 규칙을 도입한다.

## References

- 본 컨벤션의 거버넌스: ADR-0026 docs taxonomy
- TransactionalService 분리 패턴: `docs/conventions/code-convention.md` §6
- mrt-package ADR-0023: @Transactional 사용 규칙 (원전)
