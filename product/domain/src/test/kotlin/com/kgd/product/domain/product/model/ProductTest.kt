package com.kgd.product.domain.product.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class ProductTest : BehaviorSpec({
    given("상품 생성 시") {
        `when`("유효한 이름과 가격이 주어지면") {
            then("ACTIVE 상태의 상품이 생성되어야 한다") {
                val product = Product.create(
                    name = "테스트 상품",
                    price = Money(10000L),
                    stock = 100,
                    sellerId = 1L
                )
                product.status shouldBe ProductStatus.ACTIVE
                product.name shouldBe "테스트 상품"
                product.stock shouldBe 100
            }
        }
        `when`("가격이 0 이하이면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Product.create("상품", Money(0L), 10, sellerId = 1L)
                }
            }
        }
        `when`("가격을 수정할 때") {
            then("0 이하는 거부하고 원 단위 정수 그대로 담는다") {
                val product = Product.create("상품", Money(1000L), 10, sellerId = 1L)
                shouldThrow<IllegalArgumentException> { product.update(price = Money(-1L)) }
                product.update(price = Money(12_900L))
                product.price.amount shouldBe 12_900L
            }
        }
        `when`("상품명이 비어있으면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Product.create("", Money(1000L), 10, sellerId = 1L)
                }
            }
        }
    }
    given("상품 업데이트 시") {
        `when`("이름과 가격이 주어지면") {
            then("이름과 가격이 업데이트되어야 한다") {
                val product = Product.create("기존상품", Money(1000L), 10, sellerId = 1L)
                product.update("수정상품", Money(2000L))
                product.name shouldBe "수정상품"
                product.price shouldBe Money(2000L)
            }
        }
    }
    given("상품 비활성화 시") {
        `when`("ACTIVE 상태이면") {
            then("INACTIVE로 전환되어야 한다") {
                val product = Product.create("상품", Money(1000L), 10, sellerId = 1L)
                product.deactivate()
                product.status shouldBe ProductStatus.INACTIVE
            }
        }
        `when`("이미 INACTIVE 상태이면") {
            then("IllegalStateException이 발생해야 한다") {
                val product = Product.create("상품", Money(1000L), 10, sellerId = 1L)
                product.deactivate()
                shouldThrow<IllegalStateException> {
                    product.deactivate()
                }
            }
        }
    }
    given("재고 동기화 시") {
        `when`("유효한 가용 재고가 주어지면") {
            then("재고가 동기화되어야 한다") {
                val product = Product.create("상품", Money(1000L), 10, sellerId = 1L)
                product.syncStock(7)
                product.stock shouldBe 7
            }
        }
        `when`("가용 재고가 0이면") {
            then("재고가 0으로 동기화되어야 한다") {
                val product = Product.create("상품", Money(1000L), 10, sellerId = 1L)
                product.syncStock(0)
                product.stock shouldBe 0
            }
        }
        `when`("음수 재고가 주어지면") {
            then("IllegalArgumentException이 발생해야 한다") {
                val product = Product.create("상품", Money(1000L), 10, sellerId = 1L)
                shouldThrow<IllegalArgumentException> {
                    product.syncStock(-1)
                }
            }
        }
    }
})
