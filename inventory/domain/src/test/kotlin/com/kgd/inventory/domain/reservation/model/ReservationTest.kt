package com.kgd.inventory.domain.reservation.model

import com.kgd.inventory.domain.reservation.exception.InvalidReservationStateException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class ReservationTest : BehaviorSpec({
    given("예약 확정 시") {
        `when`("ACTIVE 상태면") {
            then("CONFIRMED") {
                val reservation = Reservation.create(
                    orderId = 1L,
                    productId = 1L,
                    warehouseId = 1L,
                    qty = 10,
                )
                reservation.confirm()
                reservation.getStatus() shouldBe ReservationStatus.CONFIRMED
            }
        }

        `when`("CANCELLED 상태면") {
            then("예외") {
                val reservation = Reservation.create(
                    orderId = 1L,
                    productId = 1L,
                    warehouseId = 1L,
                    qty = 10,
                )
                reservation.cancel()
                shouldThrow<InvalidReservationStateException> {
                    reservation.confirm()
                }
            }
        }
    }

    given("예약 취소 시") {
        `when`("ACTIVE 상태면") {
            then("CANCELLED") {
                val reservation = Reservation.create(
                    orderId = 1L,
                    productId = 1L,
                    warehouseId = 1L,
                    qty = 10,
                )
                reservation.cancel()
                reservation.getStatus() shouldBe ReservationStatus.CANCELLED
            }
        }
    }

    given("예약 만료 시") {
        `when`("만료 시간이 지났으면") {
            then("EXPIRED") {
                val reservation = Reservation.create(
                    orderId = 1L,
                    productId = 1L,
                    warehouseId = 1L,
                    qty = 10,
                    ttlMinutes = -1L,  // 이미 만료된 예약
                )
                reservation.expire()
                reservation.getStatus() shouldBe ReservationStatus.EXPIRED
            }
        }
    }
    given("확정된 예약의 재입고") {
        fun confirmed(qty: Int) = Reservation.create(orderId = 1L, productId = 1L, warehouseId = 1L, qty = qty).also { it.confirm() }

        then("나눠서 되돌릴 수 있고 되돌린 합은 예약 수량을 넘지 못한다") {
            val reservation = confirmed(5)
            reservation.restock(2)
            reservation.restock(3)
            reservation.getRestockedQty() shouldBe 5
            reservation.restockableQty() shouldBe 0
            shouldThrow<IllegalArgumentException> { reservation.restock(1) }
        }

        then("확정 전(ACTIVE) 예약은 재입고할 수 없다 — 아직 가용에서 빠진 적이 없다") {
            val reservation = Reservation.create(orderId = 1L, productId = 1L, warehouseId = 1L, qty = 5)
            shouldThrow<InvalidReservationStateException> { reservation.restock(1) }
        }
    }
})
