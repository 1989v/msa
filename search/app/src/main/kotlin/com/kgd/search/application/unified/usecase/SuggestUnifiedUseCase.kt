package com.kgd.search.application.unified.usecase

interface SuggestUnifiedUseCase {
    fun execute(q: String, type: String?, size: Int): Result
    data class Hit(val id: String, val type: String, val title: String, val summary: String, val sourceId: String, val lang: String? = null, val group: String? = null, val brand: String? = null)
    data class Result(val hits: List<Hit>, val total: Int, val page: Int = 0, val size: Int, val mode: String = "bm25")
}
