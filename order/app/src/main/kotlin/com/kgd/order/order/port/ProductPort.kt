package com.kgd.order.application.order.port

import java.math.BigDecimal

interface ProductPort {
    suspend fun validateProduct(productId: Long): ProductInfo
}

data class ProductInfo(
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val stock: Int,
)
