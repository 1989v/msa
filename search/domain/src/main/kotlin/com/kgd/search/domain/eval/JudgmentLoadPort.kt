package com.kgd.search.domain.eval

interface JudgmentLoadPort {
    /** 모든 judgment 를 query → (productId → relevance) 형태로 반환. */
    fun loadAll(): Map<String, Map<String, Int>>
}
