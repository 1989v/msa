---
parent: 5-spring-transactional
seq: 01
title: AOP 프록시 + 위치 규칙 (CGLIB vs JDK Dynamic Proxy)
type: deep
created: 2026-05-01
---

# 01. AOP 프록시 + 위치 규칙

> **이 파일의 한 줄 요약** — `@Transactional` 은 마법이 아니라 **외부에서 들어오는 메서드 호출을 가로채는 프록시 객체** 이다. 프록시를 거치지 않는 호출에는 트랜잭션이 걸리지 않는다.

---

## 1. `@Transactional` 의 실체는 무엇인가

런타임에 Spring 컨테이너가 다음 두 가지 중 하나를 만든다.

| 종류 | 조건 | 만드는 방식 |
|---|---|---|
| **JDK Dynamic Proxy** | 빈이 인터페이스를 구현 | `java.lang.reflect.Proxy` — 인터페이스의 메서드를 위임 객체로 라우팅 |
| **CGLIB Proxy** | 인터페이스 없는 클래스 빈 | 런타임에 **서브클래스를 바이트코드로 생성** (extends MyService) |

Spring Boot 2.0 이후 기본은 **CGLIB**. (`spring.aop.proxy-target-class=true` 가 default).

### 호출 흐름

```
Controller (외부 클라이언트)
   │
   │  productService.create(...)        ← CGLIB 프록시 메서드 호출
   ▼
ProductService$$SpringCGLIB$$0          ← 프록시 객체 (서브클래스)
   │
   │  TransactionInterceptor.invoke()
   │   ├─ 1. PlatformTransactionManager.getTransaction()
   │   ├─ 2. target.create(...)         ← 실제 ProductService 인스턴스 호출
   │   │    ↓ 비즈니스 로직 실행
   │   ├─ 3. (정상) commit / (예외) rollback
   │   └─ 4. 결과 반환
   ▼
호출자 (정상 결과 또는 예외)
```

핵심은 **`TransactionInterceptor`** 라는 AOP (Aspect-Oriented Programming, 관점 지향 프로그래밍) advice 가 호출 전후로 트랜잭션을 시작/커밋/롤백한다는 것. 비즈니스 코드 안에서 트랜잭션 코드를 한 줄도 쓰지 않는 이유는 이 인터셉터가 다 처리하기 때문이다.

---

## 2. CGLIB vs JDK Dynamic Proxy

### JDK Dynamic Proxy

```kotlin
interface ProductUseCase {
    fun create(cmd: Command): Result
}

@Service
class ProductService(...) : ProductUseCase {
    @Transactional
    override fun create(cmd: Command): Result { ... }
}
```

- 프록시 클래스가 `ProductUseCase` 를 구현하는 익명 객체 (`com.sun.proxy.$Proxy42`)
- **인터페이스에 없는 메서드는 프록시 못 함** → 같은 클래스의 다른 public 메서드라도 인터페이스 미선언이면 트랜잭션 미적용
- 런타임 오버헤드 약간 작음 (리플렉션 기반)

### CGLIB Proxy

```kotlin
@Service
open class ProductService(...) {  // Kotlin: open 필요 (kotlin-spring 플러그인이 자동 처리)
    @Transactional
    open fun create(cmd: Command): Result { ... }  // open 필요
}
```

- 프록시 클래스가 `ProductService` 를 **상속** (`ProductService$$SpringCGLIB$$0`)
- 인터페이스 없어도 동작 → 일관된 사용성
- **`final` 클래스/메서드 프록시 불가** — Kotlin 의 모든 클래스/메서드가 기본 final 이라 충돌. `kotlin-spring` 플러그인이 `@Component`/`@Service`/`@Transactional` 등이 붙은 빈을 자동 `open` 처리.
- `private` 메서드 프록시 불가 (서브클래스에서 보이지 않음)

### Spring Boot 의 기본 선택

`spring.aop.proxy-target-class` (default `true`) 로 인해 인터페이스 유무와 무관하게 **항상 CGLIB**. 이는 다음 이유:
1. 인터페이스 없는 빈에도 일관되게 적용
2. `@Autowired` 시 구체 클래스 타입으로 주입 가능 (인터페이스 강제 안 함)

설정으로 JDK 우선으로 바꿀 수도 있지만, 실무에서는 CGLIB 기본값을 유지한다.

---

## 3. `@Transactional` 위치 규칙

### 클래스에 붙일 때

```kotlin
@Service
@Transactional  // 모든 public 메서드에 적용
class ProductService(...) { ... }
```

- 모든 public 메서드가 트랜잭션에 참여
- 조회 전용 메서드도 쓰기 트랜잭션에 참여 → readOnly 최적화 못 받음
- msa convention 은 **메서드 레벨 권장**, 클래스 레벨 사용 시 조회 메서드에 `@Transactional(readOnly = true)` 명시 강제 (`docs/conventions/transactional-usage.md` §4)

### 메서드에 붙일 때

```kotlin
@Service
class ProductService(...) {
    @Transactional
    fun create(cmd: Command): Result { ... }

    @Transactional(readOnly = true)
    fun findById(id: Long): Product? = ...
}
```

- 권장 패턴
- 메서드별로 readOnly/timeout/rollbackFor 등 세밀 제어

### 인터페이스에 붙일 때

```kotlin
interface CreateProductUseCase {
    @Transactional   // ⚠ JDK Proxy 에서만 인식, CGLIB 에선 무시
    fun execute(cmd: Command): Result
}
```

- **권장하지 않음** — Spring Boot 의 기본 CGLIB 프록시 환경에서는 인터페이스 애노테이션을 못 본다.
- Spring 공식 문서도 "구현 클래스에 붙이라" 고 명시.

### 우선순위

같은 메서드에 클래스/메서드 양쪽 다 붙으면 **메서드 레벨이 우선**.

```kotlin
@Service
@Transactional  // 클래스 기본
class ProductService(...) {
    @Transactional(readOnly = true)  // 이 메서드만 readOnly
    fun findById(id: Long) = ...
}
```

---

## 4. 프록시가 안 거쳐지는 케이스 (트랜잭션 미동작 5대 원인)

| 원인 | 설명 |
|------|------|
| **Self-invocation** | 같은 빈 안에서 `this.method()` 호출 — 프록시 객체가 아닌 `target` 인스턴스의 메서드를 직접 호출 → 03 파일에서 상세 |
| **private 메서드** | CGLIB/JDK 모두 외부에서 호출 불가 → 프록시 적용 불가 |
| **final 메서드/클래스 (Kotlin/Java 공통)** | CGLIB 가 서브클래스에서 오버라이드 못 함. Kotlin 은 `kotlin-spring` 으로 자동 open. |
| **non-public + `proxy-target-class=true`** | protected/package-private 도 CGLIB 가 만들어주지만 권장 X. `@Transactional` 은 사실상 public only. |
| **객체를 직접 `new` 로 생성** | Spring 빈이 아니라서 프록시가 없음 |

### `private` 메서드 함정 재현

```kotlin
@Service
class OrderService(...) {

    fun placeOrder(cmd: Command): Order {
        return saveAndCharge(cmd)  // 같은 클래스 호출
    }

    @Transactional       // ⚠ 무시됨 — private + self-invocation 이중 함정
    private fun saveAndCharge(cmd: Command): Order { ... }
}
```

이 코드는 IDE 가 경고를 안 띄워주고, 런타임에도 예외가 안 난다. **그냥 트랜잭션 없이 동작하다가 어느 날 데이터 일관성이 깨진다.** 이런 게 면접 함정 질문의 정수.

---

## 5. 디버깅: 프록시가 적용됐는지 확인하는 방법

### IntelliJ Debugger

```kotlin
@Service
class ProductService(...) {
    fun debugSelf() {
        println(this.javaClass.name)  // ProductService$$SpringCGLIB$$0 면 OK
    }
}
```

CGLIB 프록시면 클래스 이름 끝에 `$$SpringCGLIB$$N` 또는 (구버전) `$$EnhancerBySpringCGLIB$$xxx` 가 붙는다.

### AOP 활성화 확인

```kotlin
@Configuration
@EnableTransactionManagement(proxyTargetClass = true)  // 명시적 활성화 (Boot 는 자동)
class TxConfig
```

Spring Boot 는 `DataSourceTransactionManager`/`JpaTransactionManager` 가 클래스패스에 있으면 자동으로 활성화.

### 빈 등록 확인

`spring.aop.proxy-target-class=false` 로 바꾸면 인터페이스 있는 빈은 JDK Proxy → 클래스 타입으로 주입 시 `BeanNotOfRequiredTypeException` 발생할 수 있다 (인터페이스 타입으로 주입해야 함). 이 차이를 안다는 것 자체가 면접 답변에 깊이를 더한다.

---

## 6. msa 코드 연결

msa 의 모든 서비스는 Spring Boot 기본 (CGLIB) 위에서 동작한다. 추가로:

- `kotlin-spring` Gradle 플러그인이 `build.gradle.kts` 에 등록되어 있어 `@Service`/`@Component`/`@Configuration`/`@Transactional` 클래스가 자동 `open` 처리됨.
- `ProductService` (final default 회피), `OrderService` 모두 명시적 `open` 없이 동작.

### Suspend 함수와 프록시

`OrderService.execute(suspend ...): Result` 처럼 코루틴 함수는 트랜잭션 동기화의 ThreadLocal 과 잘 어울리지 않는다 (코루틴 컨텍스트는 Thread 를 자유롭게 옮기므로). msa 는 이를 회피하기 위해 **suspend 메서드 자체에 `@Transactional` 을 안 붙이고**, 내부에서 `OrderTransactionalService.savePendingOrder(...)` 등 **non-suspend 빈 메서드를 호출**한다. 이 호출은 정상적으로 프록시를 거치고 ThreadLocal 트랜잭션이 정상 작동.

```kotlin
@Service
class OrderService(
    private val orderTransactionalService: OrderTransactionalService,  // non-suspend 트랜잭션 서비스
    ...
) : PlaceOrderUseCase {

    override suspend fun execute(cmd: Command): Result {
        val pending = orderTransactionalService.savePendingOrder(cmd)  // ✅ TX1
        val payment = paymentPort.requestPayment(...)                    // ⚠ TX 밖
        return orderTransactionalService.completeOrder(pending.id)       // ✅ TX2
    }
}
```

상세는 [09-external-io-separation.md](09-external-io-separation.md) 와 [11-msa-mapping.md](11-msa-mapping.md) 에서.

---

## 7. 요약 카드

- `@Transactional` 의 본질 = AOP **프록시** + `TransactionInterceptor`
- Spring Boot 기본은 **CGLIB** (서브클래스 기반) → Kotlin `final` 충돌은 `kotlin-spring` 플러그인이 자동 처리
- 프록시는 **외부에서 들어오는 public 메서드 호출만 가로챔** — 그 외(self-invocation, private, final, 직접 new) 는 트랜잭션 미적용
- 위치 규칙: **메서드 레벨 권장**, 클래스 레벨 사용 시 readOnly 명시 / 인터페이스 레벨은 권장 안 함
- 메서드 레벨이 클래스 레벨보다 **우선**

---

## 다음 학습

- [02-default-rollback-rules.md](02-default-rollback-rules.md) — 어떤 예외가 롤백을 트리거하는가
- [03-self-invocation.md](03-self-invocation.md) — self-invocation 함정과 우회 패턴
