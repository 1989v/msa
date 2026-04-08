package com.kgd.experiment.domain.model

data class Variant(
    val id: Long?,
    val name: String,
    val weight: Int,
    val config: Map<String, Any>
) {
    init {
        require(weight > 0) { "Variant weight must be positive: $weight" }
        require(name.isNotBlank()) { "Variant name must not be blank" }
    }
}
