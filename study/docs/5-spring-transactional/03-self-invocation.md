---
parent: 5-spring-transactional
seq: 03
title: Self-invocation 함정 + 우회 패턴
type: deep
created: 2026-05-01
---

# 03. Self-invocation 함정

> **이 파일의 한 줄 요약** — 같은 빈 안에서 `this.method()` 로 호출하면 **프록시를 거치지 않으므로 `@Transactional` 이 무시된다**. 면접 단골 함정.

---

## 1. 문제 재현

```kotlin
@Service
class ProductService(
    private val repository: ProductRepositoryPort,
) {
    fun createBatch(commands: List<Command>): List<Product> {
        return commands.map { create(it) }  // ⚠ 같은 클래스 호출
    }

    @Transactional
    fun create(cmd: Command): Product {
        val product = Product.create(cmd.name, cmd.price)
        return repository.save(product)
    }
}
```

기대: 각 `create()` 호출이 **별도 트랜잭션** 으로 실행
실제: `createBatch()` 가 외부에서 호출될 때 **프록시 → ProductService 인스턴스** 로 진입한 뒤, 내부의 `create()` 호출은 **같은 인스턴스의 메서드를 직접 호출** (this.create) → 프록시를 거치지 않음 → 트랜잭션 미적용

만약 `createBatch()` 도 `@Transactional` 이면 외부에서 진입할 때 트랜잭션이 시작되어 모든 create 가 같은 트랜잭션으로 묶이지만, **`create()` 의 readOnly/REQUIRES_NEW 같은 속성은 무시된다.**

---

## 2. 왜 일어나는가 — 프록시 객체와 target 의 분리

```
[01 파일에서] 프록시 = ProductService$$SpringCGLIB$$0 (서브클래스)
              target = 진짜 ProductService 인스턴스 (필드 백업)

외부 호출:  someClient.createBatch(...)
            ↓
            프록시.createBatch(...)
            ↓
            TransactionInterceptor (옵션)
            ↓
            target.createBatch(...)        ← 여기서 this = target

target.createBatch() 안:
   commands.map { this.create(it) }       ← this 는 target! 프록시 아님
   → target.create(it) 직접 호출
   → TransactionInterceptor 호출 안 됨
   → @Transactional 무시
```

**핵심**: 프록시는 외부 호출만 가로챈다. 객체 내부에서 자기 메서드를 호출하면 프록시는 옆에서 구경만 한다.

---

## 3. 우회 방법 4가지

### 방법 1: self 주입 (권장)

```kotlin
@Service
class ProductService(
    private val repository: ProductRepositoryPort,
) {
    @Lazy
    @Autowired
    private lateinit var self: ProductService  // 프록시를 self 로 주입

    fun createBatch(commands: List<Command>): List<Product> {
        return commands.map { self.create(it) }  // ✅ 프록시 경유
    }

    @Transactional
    fun create(cmd: Command): Product { ... }
}
```

- `@Lazy` 가 필수 — 자기 자신을 의존성으로 가지면 순환 의존이 되어 빈 생성 실패. `@Lazy` 로 lookup 을 지연.
- 가장 명확하고 IDE 가 의도를 읽기 쉬움.

### 방법 2: AopContext.currentProxy()

```kotlin
@Configuration
@EnableAspectJAutoProxy(exposeProxy = true)  // 필수 옵션
class AopConfig

@Service
class ProductService(...) {
    fun createBatch(commands: List<Command>): List<Product> {
        val proxy = AopContext.currentProxy() as ProductService
        return commands.map { proxy.create(it) }
    }

    @Transactional
    fun create(cmd: Command): Product { ... }
}
```

- `exposeProxy = true` 가 필수 (default false)
- ThreadLocal 에서 프록시를 꺼내는 방식 — 비용 있음
- 비추천 — 코드가 magic 해 보임, AOP 설정 강제

### 방법 3: 클래스 분리 (msa 표준)

```kotlin
@Service
class ProductService(
    private val transactionalService: ProductTransactionalService,
) {
    fun createBatch(commands: List<Command>): List<Product> {
        return commands.map { transactionalService.save(...) }  // ✅ 다른 빈 → 프록시 경유
    }
}

@Service
@Transactional
class ProductTransactionalService(
    private val repository: ProductRepositoryPort,
) {
    fun save(product: Product): Product = repository.save(product)
}
```

- **msa 의 공식 패턴** (`docs/conventions/code-convention.md` §6)
- self-invocation 회피 + 외부 IO 분리를 동시에 달성
- 단점: 빈이 하나 더 생김, 클래스 책임 분리 명확화는 장점

### 방법 4: TransactionTemplate (프로그래밍 방식)

```kotlin
@Service
class ProductService(
    private val repository: ProductRepositoryPort,
    private val tx: TransactionTemplate,
) {
    fun createBatch(commands: List<Command>): List<Product> {
        return commands.map { cmd ->
            tx.execute { repository.save(Product.create(cmd.name, cmd.price))!! }!!
        }
    }
}
```

- 프록시 의존 없이 코드로 직접 트랜잭션 제어
- 동적인 트랜잭션 조건이 필요할 때 (e.g. 조건부 timeout) 유용
- 상세는 [10-transaction-template.md](10-transaction-template.md) 에서

---

## 4. 의외의 변형: REQUIRES_NEW 무력화

```kotlin
@Service
class ProductService(...) {
    @Transactional
    fun outer(cmd: Command) {
        repository.save(...)
        recordAudit(cmd)  // 같은 인스턴스 호출
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun recordAudit(cmd: Command) {
        auditRepository.save(...)
    }
}
```

기대: `recordAudit()` 이 새 트랜잭션 (TX2) 으로 분리되어, `outer()` 가 롤백되어도 audit 만은 커밋
실제: self-invocation 으로 프록시를 우회 → `recordAudit` 의 propagation 속성 무시 → `outer()` 와 같은 트랜잭션 → outer 롤백 시 audit 도 롤백

**`REQUIRES_NEW` 가 동작하려면 다른 빈을 거쳐야 한다.** 이게 면접의 진짜 함정 질문.

---

## 5. private 메서드는 프록시 자체가 안 됨

```kotlin
@Service
class ProductService(...) {
    fun createBatch(commands: List<Command>): List<Product> {
        return commands.map { create(it) }
    }

    @Transactional
    private fun create(cmd: Command): Product { ... }  // ⚠ private = 프록시 불가
}
```

이 경우 self-invocation 이전에 **CGLIB 가 private 메서드를 오버라이드 못 함** → 프록시 자체가 만들어지지 않음 → `@Transactional` 완전 무시.

해결: public 으로 변경 + 위 4가지 우회 중 하나 적용. 또는 `@Transactional` 을 제거.

---

## 6. Kotlin extension function 도 동일한 함정

```kotlin
@Service
class ProductService(...) {

    fun createBatch(commands: List<Command>): List<Product> {
        return commands.map { it.applyCreate() }  // extension 호출
    }

    @Transactional
    private fun Command.applyCreate(): Product { ... }  // ⚠ extension + private
}
```

Kotlin extension function 은 컴파일 시 **static 메서드** 로 변환된다. static 메서드는 프록시 대상이 아니다 → `@Transactional` 무시. 게다가 private extension 은 프록시 시도 자체가 막힘.

해결: extension 대신 일반 메서드 + 클래스 분리.

---

## 7. AOP Proxy 종류별 self-invocation 동작 비교

| 프록시 종류 | self-invocation | 우회 |
|---|---|---|
| **JDK Dynamic Proxy** | 미동작 | self 주입 / 클래스 분리 |
| **CGLIB Proxy** | 미동작 | self 주입 / 클래스 분리 |
| **AspectJ (LTW/CTW)** | **동작** | 우회 불필요 |

AspectJ (Load-Time Weaving 또는 Compile-Time Weaving) 를 쓰면 바이트코드 자체를 변환하므로 self-invocation 도 동작한다. 하지만 설정 복잡성 때문에 실무에서 거의 안 쓴다 — Spring 표준은 AOP (Aspect-Oriented Programming, 관점 지향 프로그래밍) 프록시 기반.

---

## 8. msa 코드 연결

msa 의 표준 회피책은 **클래스 분리** (방법 3):

```
[order/]
  OrderService.kt              ← 오케스트레이션 (TX 없음)
  OrderTransactionalService.kt ← @Transactional (DB 만)

[product/]
  ProductService.kt              ← 오케스트레이션
  ProductTransactionalService.kt ← @Transactional

[fulfillment/]
  FulfillmentService.kt          ← @Transactional 클래스 레벨 (예외 케이스)
                                   외부 IO (Input/Output, 입출력) 가 outboxPort.save 만이라 분리 불필요
```

`ProductTransactionalService` 와 `OrderTransactionalService` 가 코드베이스에 실제 존재 — `find` 결과로 확인됨. self-invocation 함정을 처음부터 클래스 단위로 회피하는 설계.

추가로 **suspend 함수** 의 경우 self 주입도 우회가 안 된다 (코루틴 컨텍스트가 ThreadLocal 동기화를 끊으므로). msa 의 `OrderService.execute(suspend)` 가 굳이 `OrderTransactionalService` 를 따로 둔 이유 — suspend 메서드 자체에 `@Transactional` 을 못 거는 환경에서, **non-suspend 빈 메서드를 호출** 하는 우회가 유일한 정답.

---

## 9. 요약 카드

- Self-invocation = 같은 빈 안에서 `this.method()` → 프록시 미경유 → `@Transactional` 무시
- 4가지 우회: **self 주입**, AopContext, **클래스 분리 (msa 표준)**, TransactionTemplate
- private 메서드는 그 이전에 프록시 자체가 안 됨
- Kotlin extension function 은 static 으로 컴파일 → 프록시 불가
- AspectJ (LTW/CTW) 를 쓰면 self-invocation 도 동작 (실무 드묾)
- msa 표준: `{Entity}Service` (오케스트레이션) + `{Entity}TransactionalService` (TX) 분리

---

## 다음 학습

- [04-propagation-7.md](04-propagation-7.md) — 7가지 전파 속성 전수
- [09-external-io-separation.md](09-external-io-separation.md) — 클래스 분리 패턴의 외부 IO 응용
