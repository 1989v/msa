package com.kgd.search.application.unified.service

import com.kgd.search.application.attraction.usecase.SuggestAttractionUseCase
import com.kgd.search.application.unified.port.UnifiedSearchPort
import com.kgd.search.application.unified.usecase.SuggestUnifiedUseCase
import java.util.Locale
import org.springframework.stereotype.Service

/** Name-only engine queries. Neither full search nor query-vector resolution is called here. */
@Service
class SuggestUnifiedService(private val places: SuggestAttractionUseCase, private val documents: UnifiedSearchPort) : SuggestUnifiedUseCase {
    override fun execute(q: String, type: String?, size: Int): SuggestUnifiedUseCase.Result {
        require(q.isNotBlank() && q.length <= 120) { "q must contain 1..120 characters" }
        require(size in 1..20) { "size must be 1..20" }
        require(type == null || type in SearchUnifiedService.ALL_TYPES) { "Unknown type" }
        val query = q.trim()
        val hits = mutableListOf<SuggestUnifiedUseCase.Hit>()
        // Failures propagate as 503 instead of making an engine failure look like zero matches.
        if (type == null || type == "attraction") {
            hits += places.execute(query, "ko", 20).filter { it.type == "ATTRACTION" }.map {
                SuggestUnifiedUseCase.Hit("attraction:${it.id}", "attraction", it.title, it.category.orEmpty(), it.id, "ko")
            }
        }
        if (type != "attraction") {
            hits += documents.suggest(query, type, size).map {
                SuggestUnifiedUseCase.Hit(it.id, it.type, it.title, it.summary.orEmpty(), it.slug, group = it.facets["group"], brand = it.facets["brand"])
            }
        }
        val needle = query.lowercase(Locale.ROOT)
        fun rank(hit: SuggestUnifiedUseCase.Hit): Int {
            val title = hit.title.lowercase(Locale.ROOT)
            return when { title == needle -> 0; title.startsWith(needle) -> 1; else -> 2 }
        }
        val selected = hits.sortedWith(compareBy<SuggestUnifiedUseCase.Hit> { rank(it) }.thenBy { it.id }).take(size)
        return SuggestUnifiedUseCase.Result(selected, selected.size, size = size)
    }
}
