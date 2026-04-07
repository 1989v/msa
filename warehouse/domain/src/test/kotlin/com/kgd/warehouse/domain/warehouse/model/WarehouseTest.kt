package com.kgd.warehouse.domain.warehouse.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class WarehouseTest : BehaviorSpec({
    given("창고 생성 시") {
        `when`("유효한 정보가 주어지면") {
            then("활성 상태의 창고가 생성되어야 한다") {
                val warehouse = Warehouse.create(
                    name = "강남 창고",
                    address = "서울특별시 강남구",
                    latitude = 37.4979,
                    longitude = 127.0276,
                )
                warehouse.name shouldBe "강남 창고"
                warehouse.active shouldBe true
            }
        }
        `when`("이름이 비어있으면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Warehouse.create("", "주소", 0.0, 0.0)
                }
            }
        }
    }

    given("창고 비활성화 시") {
        `when`("활성 상태이면") {
            then("비활성으로 변경되어야 한다") {
                val warehouse = Warehouse.create("창고", "주소", 0.0, 0.0)
                warehouse.deactivate()
                warehouse.active shouldBe false
            }
        }
        `when`("이미 비활성이면") {
            then("IllegalStateException이 발생해야 한다") {
                val warehouse = Warehouse.create("창고", "주소", 0.0, 0.0)
                warehouse.deactivate()
                shouldThrow<IllegalStateException> {
                    warehouse.deactivate()
                }
            }
        }
    }

    given("창고 활성화 시") {
        `when`("비활성 상태이면") {
            then("활성으로 변경되어야 한다") {
                val warehouse = Warehouse.create("창고", "주소", 0.0, 0.0)
                warehouse.deactivate()
                warehouse.activate()
                warehouse.active shouldBe true
            }
        }
        `when`("이미 활성이면") {
            then("IllegalStateException이 발생해야 한다") {
                val warehouse = Warehouse.create("창고", "주소", 0.0, 0.0)
                shouldThrow<IllegalStateException> {
                    warehouse.activate()
                }
            }
        }
    }
})
