package com.kgd.inventory.infrastructure.persistence.inventory.adapter

import com.kgd.inventory.infrastructure.persistence.inventory.entity.InventoryJpaEntity
import com.kgd.inventory.infrastructure.persistence.inventory.repository.InventoryJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verifyOrder

/**
 * 주문 예약의 잠금 순서 — 여러 주문이 같은 재고 행들을 잡을 때 모두 inventory id 오름차순으로
 * 잡아야 서로를 기다리는 원형이 생기지 않는다(교착).
 */
class InventoryReservationLockOrderTest : BehaviorSpec({
    given("id 가 뒤섞여 조회되는 재고 행들") {
        val jpa = mockk<InventoryJpaRepository>()
        every { jpa.findIdsByProductIdIn(listOf(100L, 200L)) } returns listOf(9L, 2L, 5L)
        every { jpa.findByIdForUpdate(any()) } answers {
            val id = firstArg<Long>()
            InventoryJpaEntity(id = id, productId = 100L, warehouseId = id, availableQty = 1, reservedQty = 0)
        }
        val adapter = InventoryRepositoryAdapter(jpa)

        `when`("주문 예약용으로 잠그면") {
            val locked = adapter.lockAllByProductIds(listOf(100L, 200L))

            then("id 오름차순으로 한 행씩 FOR UPDATE 한다") {
                verifyOrder {
                    jpa.findByIdForUpdate(2L)
                    jpa.findByIdForUpdate(5L)
                    jpa.findByIdForUpdate(9L)
                }
                locked.map { it.id } shouldBe listOf(2L, 5L, 9L)
            }
        }
    }
})
