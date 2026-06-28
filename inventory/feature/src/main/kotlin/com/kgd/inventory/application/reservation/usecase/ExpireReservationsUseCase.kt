package com.kgd.inventory.application.reservation.usecase

interface ExpireReservationsUseCase {
    fun execute(): Int // returns number of expired reservations
}
