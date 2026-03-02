package com.kgd.search.application.product.port

import com.kgd.search.domain.product.model.ProductDocument

interface ProductIndexPort {
    fun indexProduct(document: ProductDocument)
    fun bulkIndex(documents: List<ProductDocument>)
}
