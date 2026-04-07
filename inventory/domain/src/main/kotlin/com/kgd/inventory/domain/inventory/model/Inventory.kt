package com.kgd.inventory.domain.inventory.model

import com.kgd.inventory.domain.inventory.exception.InsufficientStockException

class Inventory private constructor(
    val id: Long?,
    val productId: Long,
    val warehouseId: Long,
    private var availableQty: Int,
    private var reservedQty: Int,
    val version: Long,
) {
    companion object {
        fun create(productId: Long, warehouseId: Long, initialQty: Int): Inventory {
            require(initialQty >= 0) { "초기 수량은 0 이상이어야 합니다" }
            return Inventory(
                id = null,
                productId = productId,
                warehouseId = warehouseId,
                availableQty = initialQty,
                reservedQty = 0,
                version = 0L,
            )
        }

        fun restore(
            id: Long,
            productId: Long,
            warehouseId: Long,
            availableQty: Int,
            reservedQty: Int,
            version: Long,
        ): Inventory = Inventory(
            id = id,
            productId = productId,
            warehouseId = warehouseId,
            availableQty = availableQty,
            reservedQty = reservedQty,
            version = version,
        )
    }

    fun reserve(qty: Int) {
        if (availableQty < qty) {
            throw InsufficientStockException(productId, warehouseId, qty, availableQty)
        }
        availableQty -= qty
        reservedQty += qty
    }

    fun release(qty: Int) {
        require(reservedQty >= qty) { "해제 수량이 예약 수량을 초과합니다: reserved=$reservedQty, requested=$qty" }
        reservedQty -= qty
        availableQty += qty
    }

    fun confirm(qty: Int) {
        require(reservedQty >= qty) { "확정 수량이 예약 수량을 초과합니다: reserved=$reservedQty, requested=$qty" }
        reservedQty -= qty
    }

    fun receive(qty: Int) {
        require(qty > 0) { "입고 수량은 0보다 커야 합니다" }
        availableQty += qty
    }

    fun getAvailableQty(): Int = availableQty

    fun getReservedQty(): Int = reservedQty
}
