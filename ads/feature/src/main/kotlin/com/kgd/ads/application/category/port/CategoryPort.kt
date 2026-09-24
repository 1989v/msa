package com.kgd.ads.application.category.port

import com.kgd.ads.application.category.dto.ContextMappingView
import com.kgd.ads.application.category.dto.HostCategoryView
import com.kgd.ads.domain.category.model.ContextCategory
import java.time.LocalDateTime

interface CategoryPort {
    fun categories(): List<ContextCategory>
    fun mappings(): List<ContextMappingView>
    fun saveMapping(contextKey: String, categoryCode: String, actorMemberId: Long, now: LocalDateTime)

    /** @return 지운 행이 있었는지 */
    fun deleteMapping(contextKey: String): Boolean

    fun hostCategories(): List<HostCategoryView>
    fun saveHostCategory(host: String, categoryCode: String, actorMemberId: Long, now: LocalDateTime)
}
