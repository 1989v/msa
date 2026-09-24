package com.kgd.product.infrastructure.persistence.product.entity

import com.kgd.product.domain.product.model.Money
import com.kgd.product.domain.product.model.Product
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/**
 * 가격 확장 단계 — 코드는 `price_won` 을 읽고, 롤백한 옛 코드를 위해 옛 `price` 에도 같은 값을 쓴다.
 * 판정 근거는 엔티티가 두 컬럼 필드에 실제로 담은 값이다.
 */
class ProductJpaEntityTest : BehaviorSpec({
    given("도메인 상품을 엔티티로 옮기면") {
        then("price_won 과 옛 price 가 같은 원 단위 값이다") {
            val entity = ProductJpaEntity.fromDomain(Product.create("상품", Money(12_900L), 3, sellerId = 7L))

            entity.priceWon shouldBe 12_900L
            entity.price.compareTo(12_900.toBigDecimal()) shouldBe 0
            entity.toDomain().price shouldBe Money(12_900L)
        }
    }

    given("가격을 바꾼 상품으로 전체 동기화하면") {
        then("두 컬럼이 함께 바뀐다 — 한쪽만 옛 값으로 남지 않는다") {
            val entity = ProductJpaEntity.fromDomain(Product.create("상품", Money(1_000L), 3, sellerId = 7L))
            val changed = entity.toDomain().apply { update(price = Money(2_500L)) }

            entity.update(changed)

            entity.priceWon shouldBe 2_500L
            entity.price.compareTo(2_500.toBigDecimal()) shouldBe 0
            entity.toDomain().price shouldBe Money(2_500L)
        }
    }
})
