package com.kgd.product.domain.product.policy

import com.kgd.product.domain.product.exception.InsufficientStockException
import com.kgd.product.domain.product.model.Product
import org.springframework.stereotype.Component

@Component
class ProductPolicy {
    fun validateStockDecrease(product: Product, quantity: Int) {
        if (product.stock < quantity) throw InsufficientStockException()
    }
}
