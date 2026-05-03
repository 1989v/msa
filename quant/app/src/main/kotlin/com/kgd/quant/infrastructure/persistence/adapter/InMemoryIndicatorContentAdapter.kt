package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.IndicatorContentRepositoryPort
import com.kgd.quant.domain.learn.ContentId
import com.kgd.quant.domain.learn.IndicatorCategory
import com.kgd.quant.domain.learn.IndicatorContent
import com.kgd.quant.domain.learn.Slug
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap

/**
 * ⚠️ TEMPORARY — `IndicatorContentRepositoryPort` 의 in-memory stub.
 *
 * 정식 구현은 JPA + indicator_content 테이블 (V20260504_002) — Phase 1 follow-up.
 *
 * TODO(removal): JpaIndicatorContentAdapter 합류 후 본 클래스 삭제.
 */
@Component
class InMemoryIndicatorContentAdapter : IndicatorContentRepositoryPort {

    private val store = ConcurrentHashMap<ContentId, IndicatorContent>()

    override suspend fun save(content: IndicatorContent): IndicatorContent {
        store[content.id] = content
        return content
    }

    override suspend fun findById(id: ContentId): IndicatorContent? = store[id]

    override suspend fun findBySlug(slug: Slug, includeUnpublished: Boolean): IndicatorContent? =
        store.values.firstOrNull {
            it.slug == slug && (includeUnpublished || it.isPublished)
        }

    override suspend fun findPublished(category: IndicatorCategory?): List<IndicatorContent> =
        store.values
            .filter { it.isPublished }
            .filter { category == null || it.category == category }
            .sortedBy { it.title }

    override suspend fun findAll(): List<IndicatorContent> =
        store.values.sortedBy { it.title }

    override suspend fun delete(id: ContentId) {
        store.remove(id)
    }
}
