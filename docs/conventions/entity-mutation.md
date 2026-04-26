# Entity 수정 규칙

> **출처**: ADR-0022 에서 이전 (ADR-0026 분류 정책에 따른 재배치). 본문 자체가 "유형: Convention" 라벨이었고, 원칙(엔티티 캡슐화 = 자기 상태 변경의 책임)은 이미 ADR-0001 Clean Architecture + `docs/conventions/code-convention.md` §3 (Domain 모델 생성 패턴) 에 흡수되어 있음. 본 문서는 그 원칙의 실천 가이드.
> **History**: 원본 ADR 본문은 git history 의 `ADR-0022-entity-mutation-conventions.md` 참조.

## 기본 원칙

- 서비스 계층에서 엔티티 필드를 직접 대입하지 않는다. **엔티티 상태 변경은 엔티티 메서드로만 수행한다.**
- 예외는 JPA/Audit 필드 (`createdAt`, `updatedAt`), soft-delete 복원 (`deletedAt`) 등 인프라 성격이 명확한 값에 한정한다.
- Domain 모델의 mutable 필드는 `private set` 또는 `internal set` 으로 선언한다 (`docs/conventions/code-convention.md` §3 보완).

## 전체 동기화 vs 부분 수정 분리

- 전체 동기화와 부분 수정을 같은 메서드로 처리하지 않는다.
- **전체 동기화 (`update`)**: 외부 원본 기준으로 엔티티를 거의 전부 덮어쓰는 경우. 인자는 전체 동기화 전용 Command 또는 원본 VO 로 받는다.
- **부분 수정 (`changeXxx`, `applyXxx`)**: 운영자/API 수정처럼 일부 필드만 바꾸는 경우. 의도가 드러나는 메서드로 분리한다.

## 금지 패턴

- 부분 수정에서 현재 엔티티 값을 다시 모아 "전체 스냅샷 DTO" 를 만든 뒤 `update(...)` 에 전달하는 패턴은 금지한다.
- 생성 팩토리 (`create(...)`) 와 전체 동기화 메서드는 동일한 필드 규칙을 가져야 한다.
- 연관관계 변경은 필드 대입 대신 의도가 드러나는 메서드로 노출한다.

## 예시

```kotlin
// ✅ GOOD: Domain 모델 — 필드 캡슐화 + 명확한 변경 메서드
class Product private constructor(
    val id: Long?,
    name: String,
    price: BigDecimal,
    status: ProductStatus,
) {
    var name: String = name; private set
    var price: BigDecimal = price; private set
    var status: ProductStatus = status; private set

    // 전체 동기화 (배치/외부 데이터 수신)
    fun update(command: ProductSyncCommand) {
        this.name = command.name
        this.price = command.price
        this.status = command.status
    }

    // 부분 수정 (운영자/API)
    fun changeName(name: String) {
        this.name = name
    }

    fun changePrice(price: BigDecimal) {
        require(price > BigDecimal.ZERO) { "가격은 0보다 커야 합니다" }
        this.price = price
    }

    fun deactivate() {
        this.status = ProductStatus.INACTIVE
    }
}
```

```kotlin
// ❌ BAD: 서비스에서 직접 필드 대입
fun updateProduct(id: Long, request: UpdateRequest) {
    val product = repository.findById(id)
    product.name = request.name    // 직접 대입 — 캡슐화 위반
    product.price = request.price  // 직접 대입 — 검증 우회
    repository.save(product)
}

// ✅ GOOD: 엔티티 메서드를 통한 변경
fun updateProduct(id: Long, request: UpdateRequest) {
    val product = repository.findById(id)
    product.changeName(request.name)
    product.changePrice(request.price)
    repository.save(product)
}
```

## 네이밍 원칙

| 메서드 패턴 | 용도 | 예시 |
|------------|------|------|
| `update(Command/VO)` | 전체 동기화 (배치/외부 데이터) | `update(ProductSyncCommand)` |
| `changeXxx(value)` | 단일 필드 변경 | `changeName(name)`, `changeStatus(status)` |
| `applyXxx(Command)` | 복수 필드 변경 (특정 시나리오) | `applyPartnerUpdate(command)` |
| `{동사}()` | 비즈니스 행위 (상태 전이) | `deactivate()`, `cancel()`, `complete()` |

## References

- 본 컨벤션의 거버넌스: ADR-0026 docs taxonomy
- Domain 모델 생성 패턴: `docs/conventions/code-convention.md` §3
- Clean Architecture 원칙: `docs/architecture/00.clean-architecture.md`
- mrt-package ADR-0022: Entity 수정 규칙 (원전)
