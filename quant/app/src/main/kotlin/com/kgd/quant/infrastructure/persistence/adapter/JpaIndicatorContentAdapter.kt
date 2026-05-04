package com.kgd.quant.infrastructure.persistence.adapter

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.application.port.persistence.IndicatorContentRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.learn.ContentId
import com.kgd.quant.domain.learn.IndicatorCategory
import com.kgd.quant.domain.learn.IndicatorContent
import com.kgd.quant.domain.learn.IndicatorExample
import com.kgd.quant.domain.learn.Slug
import com.kgd.quant.infrastructure.persistence.entity.IndicatorContentEntity
import com.kgd.quant.infrastructure.persistence.repository.IndicatorContentJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Component
import java.time.LocalDate

/**
 * JpaIndicatorContentAdapter — CMS 정식 구현 (ADR-0033 Phase 1 후반).
 *
 * `examples_json` 은 [ExampleJson] 리스트의 JSON 직렬화.
 */
@Component
@Primary
class JpaIndicatorContentAdapter(
    private val jpa: IndicatorContentJpaRepository,
    private val objectMapper: ObjectMapper,
) : IndicatorContentRepositoryPort {

    override suspend fun save(content: IndicatorContent): IndicatorContent = withContext(Dispatchers.IO) {
        val existing = jpa.findById(content.id.value).orElse(null)
        val entity = existing ?: IndicatorContentEntity(contentId = content.id.value)
        entity.apply {
            slug = content.slug.value
            title = content.title
            category = content.category.name
            summary = content.summary
            bodyMd = content.bodyMarkdown
            formulaTex = content.formulaTeX
            examplesJson = objectMapper.writeValueAsString(
                content.examples.map { it.toJson() }
            )
            createdAt = content.createdAt
            updatedAt = content.updatedAt
            publishedAt = content.publishedAt
        }
        jpa.save(entity)
        content
    }

    override suspend fun findById(id: ContentId): IndicatorContent? = withContext(Dispatchers.IO) {
        jpa.findById(id.value).orElse(null)?.toDomain()
    }

    override suspend fun findBySlug(slug: Slug, includeUnpublished: Boolean): IndicatorContent? =
        withContext(Dispatchers.IO) {
            val entity = jpa.findBySlug(slug.value) ?: return@withContext null
            if (!includeUnpublished && entity.publishedAt == null) null else entity.toDomain()
        }

    override suspend fun findPublished(category: IndicatorCategory?): List<IndicatorContent> =
        withContext(Dispatchers.IO) {
            val rows = if (category == null) {
                jpa.findAllByPublishedAtIsNotNullOrderByTitleAsc()
            } else {
                jpa.findAllByPublishedAtIsNotNullAndCategoryOrderByTitleAsc(category.name)
            }
            rows.map { it.toDomain() }
        }

    override suspend fun findAll(): List<IndicatorContent> = withContext(Dispatchers.IO) {
        jpa.findAll().sortedBy { it.title }.map { it.toDomain() }
    }

    override suspend fun delete(id: ContentId) {
        withContext(Dispatchers.IO) { jpa.deleteById(id.value) }
    }

    private fun IndicatorContentEntity.toDomain(): IndicatorContent {
        val examples: List<ExampleJson> =
            objectMapper.readValue(examplesJson, object : TypeReference<List<ExampleJson>>() {})
        return IndicatorContent(
            id = ContentId(contentId),
            slug = Slug(slug),
            title = title,
            category = IndicatorCategory.valueOf(category),
            summary = summary,
            bodyMarkdown = bodyMd,
            formulaTeX = formulaTex,
            examples = examples.map { it.toDomain() },
            createdAt = createdAt,
            updatedAt = updatedAt,
            publishedAt = publishedAt,
        )
    }

    private fun IndicatorExample.toJson(): ExampleJson = ExampleJson(
        label = label,
        assetCode = assetCode.value,
        periodStart = periodStart.toString(),
        periodEnd = periodEnd.toString(),
        description = description,
    )

    data class ExampleJson(
        val label: String = "",
        val assetCode: String = "",
        val periodStart: String = "",
        val periodEnd: String = "",
        val description: String = "",
    ) {
        fun toDomain(): IndicatorExample = IndicatorExample(
            label = label,
            assetCode = AssetCode(assetCode),
            periodStart = LocalDate.parse(periodStart),
            periodEnd = LocalDate.parse(periodEnd),
            description = description,
        )
    }
}
