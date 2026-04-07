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
})
