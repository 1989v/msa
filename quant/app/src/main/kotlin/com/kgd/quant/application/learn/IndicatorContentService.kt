package com.kgd.quant.application.learn

import com.kgd.quant.application.port.persistence.IndicatorContentRepositoryPort
import com.kgd.quant.domain.common.Clock
import com.kgd.quant.domain.learn.ContentId
import com.kgd.quant.domain.learn.IndicatorCategory
import com.kgd.quant.domain.learn.IndicatorContent
import com.kgd.quant.domain.learn.IndicatorExample
import com.kgd.quant.domain.learn.Slug
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.UUID

/**
 * IndicatorContentService — 입문자 학습 CMS CRUD (ADR-0033 Phase 1).
 */
@Component
class IndicatorContentService(
    private val repo: IndicatorContentRepositoryPort,
    private val clock: Clock,
) : IndicatorContentUseCase {
    /** ROLE_ADMIN 가드는 컨트롤러에서. */
    override suspend fun create(input: IndicatorContentUseCase.CreateInput): IndicatorContent {
        val now = clock.now()
        return repo.save(
            IndicatorContent(
                id = ContentId(UUID.randomUUID()),
                slug = input.slug,
                title = input.title,
                category = input.category,
                summary = input.summary,
                bodyMarkdown = input.bodyMarkdown,
                formulaTeX = input.formulaTeX,
                examples = input.examples,
                createdAt = now,
                updatedAt = now,
                publishedAt = if (input.publish) now else null,
            )
        )
    }

    override suspend fun update(id: ContentId, input: IndicatorContentUseCase.UpdateInput): IndicatorContent {
        val existing = repo.findById(id) ?: error("IndicatorContent not found: $id")
        val now = clock.now()
        val updated = existing.copy(
            title = input.title ?: existing.title,
            category = input.category ?: existing.category,
            summary = input.summary ?: existing.summary,
            bodyMarkdown = input.bodyMarkdown ?: existing.bodyMarkdown,
            formulaTeX = input.formulaTeX ?: existing.formulaTeX,
            examples = input.examples ?: existing.examples,
            updatedAt = now,
            publishedAt = when (input.publish) {
                true -> existing.publishedAt ?: now
                false -> null
                null -> existing.publishedAt
            },
        )
        return repo.save(updated)
    }

    override suspend fun listPublished(category: IndicatorCategory?): List<IndicatorContent> =
        repo.findPublished(category)

    override suspend fun bySlug(slug: Slug, includeUnpublished: Boolean): IndicatorContent? =
        repo.findBySlug(slug, includeUnpublished)

    override suspend fun delete(id: ContentId) = repo.delete(id)

}
