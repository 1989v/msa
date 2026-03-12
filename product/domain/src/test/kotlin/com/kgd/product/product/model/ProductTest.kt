package com.kgd.product.domain.product.model

import com.kgd.product.domain.product.exception.InsufficientStockException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class ProductTest : BehaviorSpec({
    given("상품 생성 시") {
        `when`("유효한 이름과 가격이 주어지면") {
            then("ACTIVE 상태의 상품이 생성되어야 한다") {
                val product = Product.create(
                    name = "테스트 상품",
                    price = Money(10000.toBigDecimal()),
                    stock = 100
                )
                product.status shouldBe ProductStatus.ACTIVE
                product.name shouldBe "테스트 상품"
                product.stock shouldBe 100
            }
        }
        `when`("가격이 0 이하이면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Product.create("상품", Money(0.toBigDecimal()), 10)
                }
            }
        }
        `when`("상품명이 비어있으면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Product.create("", Money(1000.toBigDecimal()), 10)
                }
            }
        }
    }
    given("상품 업데이트 시") {
        `when`("이름과 가격이 주어지면") {
            then("이름과 가격이 업데이트되어야 한다") {
                val product = Product.create("기존상품", Money(1000.toBigDecimal()), 10)
                product.update("수정상품", Money(2000.toBigDecimal()))
                product.name shouldBe "수정상품"
                product.price shouldBe Money(2000.toBigDecimal())
            }
        }
    }
    given("상품 비활성화 시") {
        `when`("ACTIVE 상태이면") {
            then("INACTIVE로 전환되어야 한다") {
                val product = Product.create("상품", Money(1000.toBigDecimal()), 10)
                product.deactivate()
                product.status shouldBe ProductStatus.INACTIVE
            }
        }
        `when`("이미 INACTIVE 상태이면") {
            then("IllegalStateException이 발생해야 한다") {
                val product = Product.create("상품", Money(1000.toBigDecimal()), 10)
                product.deactivate()
                shouldThrow<IllegalStateException> {
                    product.deactivate()
                }
            }
        }
    }
    given("재고 감소 시") {
        `when`("충분한 재고가 있으면") {
            then("재고가 감소해야 한다") {
                val product = Product.create("상품", Money(1000.toBigDecimal()), 10)
                product.decreaseStock(3)
                product.stock shouldBe 7
            }
        }
        `when`("재고가 부족하면") {
            then("InsufficientStockException이 발생해야 한다") {
                val product = Product.create("상품", Money(1000.toBigDecimal()), 5)
                shouldThrow<InsufficientStockException> {
                    product.decreaseStock(10)
                }
            }
        }
        `when`("수량이 0이면") {
            then("IllegalArgumentException이 발생해야 한다") {
                val product = Product.create("상품", Money(1000.toBigDecimal()), 10)
                shouldThrow<IllegalArgumentException> {
                    product.decreaseStock(0)
                }
            }
        }
    }
})
