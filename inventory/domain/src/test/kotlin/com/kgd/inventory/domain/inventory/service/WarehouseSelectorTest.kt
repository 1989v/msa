package com.kgd.inventory.domain.inventory.service

import com.kgd.inventory.domain.inventory.model.Inventory
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

class WarehouseSelectorTest : BehaviorSpec({

    fun inventory(warehouseId: Long, availableQty: Int): Inventory =
        Inventory.create(productId = 100L, warehouseId = warehouseId, initialQty = availableQty)

    given("창고 자동 선택 시") {
        `when`("여러 창고가 요청 수량을 충족하면") {
            then("가용 재고가 가장 많은 창고를 선택한다") {
                val candidates = listOf(
                    inventory(warehouseId = 1L, availableQty = 10),
                    inventory(warehouseId = 2L, availableQty = 50),
                    inventory(warehouseId = 3L, availableQty = 30),
                )
                WarehouseSelector.select(candidates, qty = 5)?.warehouseId shouldBe 2L
            }
        }

        `when`("가용 재고가 동률이면") {
            then("낮은 warehouseId 를 선택한다") {
                val candidates = listOf(
                    inventory(warehouseId = 3L, availableQty = 20),
                    inventory(warehouseId = 1L, availableQty = 20),
                    inventory(warehouseId = 2L, availableQty = 20),
                )
                WarehouseSelector.select(candidates, qty = 5)?.warehouseId shouldBe 1L
            }
        }

        `when`("일부 창고만 요청 수량을 충족하면") {
            then("수량 부족 창고는 후보에서 제외된다") {
                val candidates = listOf(
                    inventory(warehouseId = 1L, availableQty = 100),
                    inventory(warehouseId = 2L, availableQty = 3),
                )
                WarehouseSelector.select(candidates, qty = 5)?.warehouseId shouldBe 1L
            }
        }

        `when`("어떤 창고도 요청 수량을 충족하지 못하면") {
            then("null 을 반환한다") {
                val candidates = listOf(
                    inventory(warehouseId = 1L, availableQty = 3),
                    inventory(warehouseId = 2L, availableQty = 4),
                )
                WarehouseSelector.select(candidates, qty = 5).shouldBeNull()
            }
        }

        `when`("후보 목록이 비어 있으면") {
            then("null 을 반환한다") {
                WarehouseSelector.select(emptyList(), qty = 1).shouldBeNull()
            }
        }
    }
})
