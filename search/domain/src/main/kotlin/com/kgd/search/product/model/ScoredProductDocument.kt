package com.kgd.search.domain.product.model

data class ScoredProductDocument(
    val document: ProductDocument,
    val esScore: Double
)
