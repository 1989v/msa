package com.kgd.quant.application.learn.usecase

import com.kgd.quant.domain.learn.ContentId
import com.kgd.quant.domain.learn.IndicatorCategory
import com.kgd.quant.domain.learn.IndicatorContent
import com.kgd.quant.domain.learn.IndicatorExample
import com.kgd.quant.domain.learn.Slug

/** 입문자 학습 CMS CRUD (ADR-0033 Phase 1). ROLE_ADMIN 가드는 컨트롤러에서 */
interface IndicatorContentUseCase {
    suspend fun create(input: CreateInput): IndicatorContent
    suspend fun update(id: ContentId, input: UpdateInput): IndicatorContent
    suspend fun listPublished(category: IndicatorCategory? = null): List<IndicatorContent>
    suspend fun bySlug(slug: Slug, includeUnpublished: Boolean = false): IndicatorContent?
    suspend fun delete(id: ContentId)

    data class CreateInput(
        val slug: Slug,
        val title: String,
        val category: IndicatorCategory,
        val summary: String,
        val bodyMarkdown: String,
        val formulaTeX: String?,
        val examples: List<IndicatorExample>,
        val publish: Boolean = false,
    )

    data class UpdateInput(
        val title: String? = null,
        val category: IndicatorCategory? = null,
        val summary: String? = null,
        val bodyMarkdown: String? = null,
        val formulaTeX: String? = null,
        val examples: List<IndicatorExample>? = null,
        val publish: Boolean? = null,                  // null = no change
    )
}
