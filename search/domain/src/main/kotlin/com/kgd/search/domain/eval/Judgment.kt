package com.kgd.search.domain.eval

data class Judgment(
    val query: String,
    val productId: String,
    val relevance: Int,
    val source: String = "weak",
    val weight: Double = 1.0
) {
    init {
        require(relevance in 0..3) { "relevance must be in 0..3: $relevance" }
        require(weight > 0.0) { "weight must be > 0: $weight" }
    }
}
