package com.kgd.search.domain.bandit.model

/**
 * MAB arm 식별자. ADR-0050 Phase 3 에서 다중 scope 를 지원하기 위해 일반화됨.
 *
 * scope 는 fully qualified 문자열 — `category:{id}`, `brand:{id}`, `_default_` 등.
 * Redis key: `bandit:state:{scope}:{productId}`.
 *
 * Backward-compat note: ADR-0043 의 초기 디자인은 categoryId 단일 scope 였다. Phase 3 의
 * 본 변경은 Redis 키 prefix 가 바뀌어 기존 state 가 cold-start 로 복귀한다 (ADR-0050 §Phase 3 명시).
 */
data class BanditKey(
    val scope: String,
    val productId: String
) {
    /** Redis hash field (특정 key 내부 필드명 — 현재 미사용이지만 backward-compat 시그니처 보존). */
    fun redisField(): String = "$scope:$productId"

    companion object {
        const val DEFAULT_SCOPE: String = "_default_"
        const val SCOPE_CATEGORY = "category"
        const val SCOPE_BRAND = "brand"

        fun category(categoryId: String?, productId: String): BanditKey =
            BanditKey(scopeName(SCOPE_CATEGORY, categoryId), productId)

        fun brand(brandId: String?, productId: String): BanditKey =
            BanditKey(scopeName(SCOPE_BRAND, brandId), productId)

        fun custom(scopeType: String, scopeId: String?, productId: String): BanditKey =
            BanditKey(scopeName(scopeType, scopeId), productId)

        @Deprecated(
            "Use BanditKey.category(categoryId, productId)",
            ReplaceWith("BanditKey.category(categoryId, productId)")
        )
        fun of(categoryId: String?, productId: String): BanditKey =
            category(categoryId, productId)

        private fun scopeName(scopeType: String, scopeId: String?): String {
            val id = scopeId?.takeIf { it.isNotBlank() } ?: return DEFAULT_SCOPE
            return "$scopeType:$id"
        }
    }
}
