package com.kgd.product.domain.product.model

import com.kgd.product.domain.product.exception.InsufficientStockException
import java.time.LocalDateTime

class Product private constructor(
    val id: Long? = null,
    var name: String,
    var price: Money,
    var stock: Int,
    var status: ProductStatus,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    companion object {
        fun create(name: String, price: Money, stock: Int): Product {
            require(name.isNotBlank()) { "상품명은 비어있을 수 없습니다" }
            require(stock >= 0) { "재고는 0 이상이어야 합니다" }
            return Product(name = name, price = price, stock = stock, status = ProductStatus.ACTIVE)
        }

        fun restore(
            id: Long?,
            name: String,
            price: Money,
            stock: Int,
            status: ProductStatus,
            createdAt: LocalDateTime
        ): Product =
            Product(id = id, name = name, price = price, stock = stock, status = status, createdAt = createdAt)
    }

    fun deactivate() {
        check(status == ProductStatus.ACTIVE) { "활성 상품만 비활성화할 수 있습니다" }
        status = ProductStatus.INACTIVE
    }

    fun decreaseStock(quantity: Int) {
        require(quantity > 0) { "수량은 0보다 커야 합니다" }
        if (stock < quantity) throw InsufficientStockException()
        stock -= quantity
    }

    fun update(name: String? = null, price: Money? = null) {
        name?.let {
            require(it.isNotBlank()) { "상품명은 비어있을 수 없습니다" }
            this.name = it
        }
        price?.let { this.price = it }
    }
}
