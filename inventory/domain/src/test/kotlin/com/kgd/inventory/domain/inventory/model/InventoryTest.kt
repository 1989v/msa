package com.kgd.inventory.domain.inventory.model

import com.kgd.inventory.domain.inventory.exception.InsufficientStockException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class InventoryTest : BehaviorSpec({
    given("재고 생성 시") {
        `when`("초기 수량이 주어지면") {
            then("가용 재고가 설정된다") {
                val inventory = Inventory.create(productId = 1L, warehouseId = 1L, initialQty = 100)
                inventory.getAvailableQty() shouldBe 100
                inventory.getReservedQty() shouldBe 0
            }
        }
    }

    given("재고 예약 시") {
        `when`("가용 수량이 충분하면") {
            then("예약 성공") {
                val inventory = Inventory.create(productId = 1L, warehouseId = 1L, initialQty = 100)
                inventory.reserve(30)
                inventory.getAvailableQty() shouldBe 70
                inventory.getReservedQty() shouldBe 30
            }
        }

        `when`("가용 수량이 부족하면") {
            then("InsufficientStockException") {
                val inventory = Inventory.create(productId = 1L, warehouseId = 1L, initialQty = 10)
                shouldThrow<InsufficientStockException> {
                    inventory.reserve(20)
                }
            }
        }
    }

    given("예약 해제 시") {
        `when`("예약 수량이 있으면") {
            then("available 복구") {
                val inventory = Inventory.create(productId = 1L, warehouseId = 1L, initialQty = 100)
                inventory.reserve(30)
                inventory.release(20)
                inventory.getAvailableQty() shouldBe 90
                inventory.getReservedQty() shouldBe 10
            }
        }
    }

    given("예약 확정 시") {
        `when`("예약 수량이 있으면") {
            then("reserved 차감") {
                val inventory = Inventory.create(productId = 1L, warehouseId = 1L, initialQty = 100)
                inventory.reserve(30)
                inventory.confirm(20)
                inventory.getAvailableQty() shouldBe 70
                inventory.getReservedQty() shouldBe 10
            }
        }
    }

    given("입고 시") {
        `when`("수량이 주어지면") {
            then("available 증가") {
                val inventory = Inventory.create(productId = 1L, warehouseId = 1L, initialQty = 100)
                inventory.receive(50)
                inventory.getAvailableQty() shouldBe 150
            }
        }
    }
})
