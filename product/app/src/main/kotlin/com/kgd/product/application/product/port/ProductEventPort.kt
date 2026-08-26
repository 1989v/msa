package com.kgd.product.application.product.port

import com.kgd.product.domain.product.model.Product

interface ProductEventPort {
    fun publishProductCreated(product: Product)
    fun publishProductUpdated(product: Product)
}
