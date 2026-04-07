package com.kgd.inventory.presentation.inventory.dto

data class ReserveRequest(
    val orderId: Long,
    val productId: Long,
    val warehouseId: Long,
    val qty: Int,
)

data class ReleaseRequest(
    val orderId: Long,
    val productId: Long,
)

data class ConfirmRequest(
    val orderId: Long,
    val productId: Long,
)

data class ReceiveRequest(
    val productId: Long,
    val warehouseId: Long,
    val qty: Int,
)
