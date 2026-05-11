package com.kgd.search.domain.bandit.model

data class BanditKey(
    val categoryId: String,
    val productId: String
) {
    fun redisField(): String = "$categoryId:$productId"

    companion object {
        const val DEFAULT_CATEGORY: String = "_default_"

        fun of(categoryId: String?, productId: String): BanditKey =
            BanditKey(categoryId?.takeIf { it.isNotBlank() } ?: DEFAULT_CATEGORY, productId)
    }
}
