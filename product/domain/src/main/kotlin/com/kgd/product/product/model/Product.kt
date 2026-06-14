package com.kgd.product.domain.product.model

import java.time.LocalDateTime

class Product private constructor(
    val id: Long? = null,
    var name: String,
    var price: Money,
    var stock: Int,
    var status: ProductStatus,
    var brand: String? = null,
    var description: String? = null,
    var category: String? = null,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    companion object {
        fun create(
            name: String,
            price: Money,
            stock: Int,
            brand: String? = null,
            description: String? = null,
            category: String? = null
        ): Product {
            require(name.isNotBlank()) { "상품명은 비어있을 수 없습니다" }
            require(stock >= 0) { "재고는 0 이상이어야 합니다" }
            return Product(
                name = name,
                price = price,
                stock = stock,
                status = ProductStatus.ACTIVE,
                brand = brand?.takeIf { it.isNotBlank() },
                description = description?.takeIf { it.isNotBlank() },
                category = category?.takeIf { it.isNotBlank() }
            )
        }

        fun restore(
            id: Long?,
            name: String,
            price: Money,
            stock: Int,
            status: ProductStatus,
            createdAt: LocalDateTime,
            brand: String? = null,
            description: String? = null,
            category: String? = null
        ): Product =
            Product(
                id = id,
                name = name,
                price = price,
                stock = stock,
                status = status,
                brand = brand?.takeIf { it.isNotBlank() },
                description = description?.takeIf { it.isNotBlank() },
                category = category?.takeIf { it.isNotBlank() },
                createdAt = createdAt
            )
    }

    fun deactivate() {
        check(status == ProductStatus.ACTIVE) { "활성 상품만 비활성화할 수 있습니다" }
        status = ProductStatus.INACTIVE
    }

    fun syncStock(availableQty: Int) {
        require(availableQty >= 0) { "재고는 0 이상이어야 합니다" }
        this.stock = availableQty
    }

    fun update(
        name: String? = null,
        price: Money? = null,
        brand: String? = null,
        description: String? = null,
        category: String? = null
    ) {
        name?.let {
            require(it.isNotBlank()) { "상품명은 비어있을 수 없습니다" }
            this.name = it
        }
        price?.let { this.price = it }
        brand?.let { this.brand = it.takeIf { v -> v.isNotBlank() } }
        description?.let { this.description = it.takeIf { v -> v.isNotBlank() } }
        category?.let { this.category = it.takeIf { v -> v.isNotBlank() } }
    }
}
