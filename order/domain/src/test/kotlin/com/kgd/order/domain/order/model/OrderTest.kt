package com.kgd.order.domain.order.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.math.BigDecimal

class OrderTest : BehaviorSpec({
    given("주문 생성 시") {
        `when`("상품 ID와 수량이 유효하면") {
            then("PENDING 상태의 주문이 생성되어야 한다") {
                val order = Order.create(
                    userId = "user-1",
                    items = listOf(OrderItem.of(productId = 1L, quantity = 2, unitPrice = Money(5000.toBigDecimal())))
                )
                order.status shouldBe OrderStatus.PENDING
                order.totalAmount.amount shouldBe 10000.toBigDecimal()
                order.userId shouldBe "user-1"
            }
        }
        `when`("주문 항목이 비어있으면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Order.create("user-1", emptyList())
                }
            }
        }
    }
    given("주문 완료 처리 시") {
        `when`("PENDING 상태이면") {
            then("COMPLETED로 전환되어야 한다") {
                val order = Order.create("user-1", listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))))
                order.complete()
                order.status shouldBe OrderStatus.COMPLETED
            }
        }
        `when`("PENDING이 아니면") {
            then("IllegalStateException이 발생해야 한다") {
                val order = Order.create("user-1", listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))))
                order.complete()
                shouldThrow<IllegalStateException> {
                    order.complete()
                }
            }
        }
    }
    given("주문 취소 시") {
        `when`("PENDING 상태이면") {
            then("CANCELLED로 전환되어야 한다") {
                val order = Order.create("user-1", listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))))
                order.cancel()
                order.status shouldBe OrderStatus.CANCELLED
            }
        }
    }
    given("OrderItem 생성 시") {
        `when`("수량이 0이면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    OrderItem.of(1L, 0, Money(1000.toBigDecimal()))
                }
            }
        }
        `when`("소계 계산") {
            then("unitPrice * quantity가 반환되어야 한다") {
                val item = OrderItem.of(1L, 3, Money(1000.toBigDecimal()))
                item.subtotal.amount shouldBe 3000.toBigDecimal()
            }
        }
    }
})
