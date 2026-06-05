# JPA 영속성 컨벤션

> Infrastructure 레이어의 JPA Entity(`{Entity}JpaEntity`)와 Querydsl 조회 코드 작성 기준.
> Domain ↔ JpaEntity 매핑은 `docs/conventions/code-convention.md` §4, Entity 상태 변경은
> `docs/conventions/entity-mutation.md`, 트랜잭션 경계는 `docs/conventions/transactional-usage.md` 를 따른다.

이 문서의 두 가지 전제:

1. JpaEntity 는 도메인이 아니라 영속성 어댑터 모델이다. Clean Architecture 상 도메인 모델과 분리되며 Adapter 가 `toDomain()`/`fromDomain()` 으로 변환한다. 따라서 본 문서의 규칙은 모두 `infrastructure.persistence` 에만 적용된다.
2. MSA 에서는 경계가 매핑을 결정한다. 서비스·Aggregate 경계를 넘는지 여부가 연관관계를 객체로 맺을지 ID 로 보관할지를 가른다.

## 1. 경계가 매핑을 정한다

연관관계 매핑 여부는 취향이 아니라 경계로 정해진다.

### 경계를 넘으면: FK 를 plain ID 로

다른 서비스 / 다른 Aggregate 를 가리킬 때는 객체 참조를 만들지 않고 식별자 값만 보관한다. 서비스 간 DB 공유 금지 원칙과 정확히 맞물린다 — 참조는 ID 로, 데이터는 API 로.

```kotlin
@Entity
@Table(name = "orders")
class OrderJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "member_id", nullable = false)
    val memberId: Long,        // member 서비스의 식별자 — 객체 참조 아님

    @Column(name = "product_id", nullable = false)
    val productId: Long,       // product Aggregate — 조인이 필요하면 Querydsl 로
)
```

엔티티 그래프가 단순해지고, lazy loading / N+1 표면이 줄고, 경계가 코드에 드러난다.

### 경계 안이면: 단방향 LAZY 컴포지션만

하나의 Aggregate 안에서 루트가 자식의 라이프사이클을 소유할 때만 객체 매핑을 허용한다. 이때도 `LAZY` 를 쓰고, 자식은 루트를 통해서만 조작한다.

```kotlin
@OneToMany(
    mappedBy = "order",
    cascade = [CascadeType.ALL],
    orphanRemoval = true,
    fetch = FetchType.LAZY,
)
val items: MutableList<OrderItemJpaEntity> = mutableListOf()
```

### 금지: 경계를 넘는 양방향

서로 다른 Aggregate / 서비스 엔티티를 양방향으로 맺지 않는다. 동기화 비용, 순환 참조, 직렬화 사고, lazy/N+1 을 한꺼번에 불러온다. 양방향은 단일 Aggregate 내부 한정이다.

## 2. 예측 가능한 매핑

암묵적 동작을 명시적으로 바꿔 런타임 불확실성을 줄인다.

| 결정 | 규칙 | 이유 |
|---|---|---|
| enum 저장 | `@Enumerated(EnumType.STRING)` + 넉넉한 `length` | `ORDINAL` 은 enum 순서만 바뀌어도 데이터가 깨진다 |
| fetch | 항상 `LAZY`, `EAGER` 금지 | `EAGER` 는 안 쓰는 데이터까지 자동 로딩, 조회 비용 예측 불가 |
| 변경 컬럼 | `var` + `private set` | 외부 직접 대입 차단, 변경은 메서드로 (`entity-mutation.md`) |
| 식별자 | `val` | 한번 정해지면 바뀌지 않는다 |
| `equals`/`hashCode`/`toString` | 자동 생성에 기대지 않음 | 연관 컬렉션 순회로 인한 사고 방지 |

```kotlin
@Enumerated(EnumType.STRING)
@Column(name = "status", nullable = false, length = 30)
var status: OrderStatus = status
    private set
```

## 3. 스키마는 Flyway 가 소유한다

DDL 의 단일 소유자는 Flyway 마이그레이션(`db/migration`)이다. Hibernate 는 스키마를 만들지 않고 검증만 한다.

| 환경 | `ddl-auto` |
|---|---|
| 실 환경 | `validate` — Entity 와 마이그레이션 스키마 정합성 확인 |
| 슬라이스 테스트(H2) | `create-drop` 허용 |
| 금지 | 실 환경 `update` / `create` (schema drift) |

`open-in-view` 는 끈다. 영속성 컨텍스트를 뷰 렌더링까지 끌고 가지 않고, 필요한 데이터는 트랜잭션 경계 안에서 조회를 끝낸다.

## 4. 영속성 컨텍스트

변경 감지(dirty checking)를 활용한다. 트랜잭션 안 managed entity 는 flush 시 자동 update 되므로, 변경 후 `save()` 를 다시 호출하지 않는다.

```kotlin
fun cancel(orderId: Long) {
    val order = orderJpaRepository.findById(orderId)
        .orElseThrow { OrderNotFoundException(orderId) }
    order.cancel()        // 변경 감지 → update. save() 불필요
}
```

락은 충돌이 실재할 때만 건다. 없는 동시성을 가정해 락을 걸지 않는다.

| 방식 | 기준 |
|---|---|
| Optimistic (`@Version`) | 충돌 빈도 낮음, read-heavy, 감지 후 재시도 가능 |
| Pessimistic (`@Lock(PESSIMISTIC_WRITE)`) | 충돌 빈도 높음, 임계 구역, 중복 처리 방지 |

Pessimistic lock 은 트랜잭션 안에서만 의미가 있고 범위를 최소화한다. 락과 외부 IO 를 같은 트랜잭션에 넣지 않는다 (`transactional-usage.md`).

## 5. 조회는 Querydsl 로

단순 CRUD·derived query 는 `JpaRepository` 가, 동적 조건·조인·집계·페이지네이션은 `{Entity}QueryRepository` 가 맡는다. Repository interface 에 `@Query`/JPQL/native query 를 쓰지 않고, 무거운 조회는 QueryRepository 로 옮긴다. `JPAQueryFactory` 는 생성자 주입한다.

페이지네이션은 content / count 쿼리를 분리한다. count 쿼리에는 불필요한 join·order by 를 넣지 않고, raw `page`/`size` 대신 `Pageable` 을 받는다.

```kotlin
@Repository
class ProductQueryRepository(private val queryFactory: JPAQueryFactory) {

    private val product = QProductJpaEntity.productJpaEntity

    fun findAllByStatus(status: ProductStatus, pageable: Pageable): Page<ProductJpaEntity> {
        val content = queryFactory
            .selectFrom(product)
            .where(product.status.eq(status))
            .offset(pageable.offset)
            .limit(pageable.pageSize.toLong())
            .fetch()

        val total = queryFactory
            .select(product.count())
            .from(product)
            .where(product.status.eq(status))
            .fetchOne() ?: 0L

        return PageImpl(content, pageable, total)
    }
}
```

프로젝션은 타입 안전하게 한다. 화면/API shape 조회는 `@QueryProjection` 으로 컴파일 타임 타입 안전성을 확보한다. `Projections.constructor` 는 생성자 시그니처 불일치를 런타임까지 숨기므로 지양한다.

```kotlin
data class OrderSummary @QueryProjection constructor(
    val id: Long,
    val orderNo: String,
    val productName: String,
)
```

동적 조건은 null 을 무시하도록 작성한다. 값이 있을 때만 predicate 를 만들고 없으면 `null` 을 넘긴다 — Querydsl `where()` 는 `null` 을 무시하므로 `if` 로 조건을 조립하는 반복을 없앨 수 있다.

```kotlin
queryFactory.selectFrom(order)
    .where(statusEq(condition.status), createdBetween(condition.range))
    .fetch()

private fun statusEq(status: OrderStatus?): BooleanExpression? =
    status?.let { order.status.eq(it) }
```

조인은 FK 기반으로 명시한다. 객체 연관관계 대신 plain FK ID 로 `on` 절을 건다. N+1 은 Querydsl join 또는 batch fetch 로 풀고, `LazyInitializationException` 을 OSIV 나 lazy 접근으로 우회하지 않는다.

## 안티패턴

| 안티패턴 | 문제 | 올바른 방식 |
|---|---|---|
| 경계 넘는 객체 연관관계 | 그래프 복잡도·N+1 | FK plain ID |
| 경계 넘는 양방향 매핑 | 동기화·순환참조 | 단방향, Aggregate 내부만 |
| `EnumType.ORDINAL` | 순서 변경 시 데이터 훼손 | `EnumType.STRING` |
| `FetchType.EAGER` | 예측 불가 자동 로딩 | `LAZY` |
| 변경 후 `save()` 재호출 | dirty checking 미이해 | managed entity 변경만 |
| 실 환경 `ddl-auto: update` | schema drift | Flyway + `validate` |
| Repository interface `@Query`/JPQL | 조회 로직 분산 | QueryRepository |
| `Projections.constructor` | 컴파일 안전성 부족 | `@QueryProjection` |
| `LazyInitializationException` 을 OSIV 로 우회 | 트랜잭션 경계 흐림 | Querydsl DTO 조회 |

## References

- Domain ↔ JpaEntity 매핑: `docs/conventions/code-convention.md` §4
- Entity 상태 변경: `docs/conventions/entity-mutation.md`
- 트랜잭션 경계 / 외부 IO 분리: `docs/conventions/transactional-usage.md`
- Kotlin 코드 스타일: `docs/conventions/kotlin-style.md`
- Clean Architecture 원칙: `docs/architecture/00.clean-architecture.md`
- 본 컨벤션의 거버넌스: ADR-0026 docs taxonomy
