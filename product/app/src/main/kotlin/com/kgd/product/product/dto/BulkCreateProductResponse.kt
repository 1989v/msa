package com.kgd.product.presentation.product.dto

import com.kgd.product.application.product.usecase.CreateProductUseCase

data class BulkCreateProductResponse(
    val count: Int,
    val ids: List<Long>
) {
    companion object {
        fun from(results: List<CreateProductUseCase.Result>) =
            BulkCreateProductResponse(count = results.size, ids = results.map { it.id })
    }
}
