package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.learn.ContentId
import com.kgd.quant.domain.learn.IndicatorCategory
import com.kgd.quant.domain.learn.IndicatorContent
import com.kgd.quant.domain.learn.Slug

/**
 * IndicatorContentRepositoryPort — 입문자 학습 CMS port (ADR-0033 Phase 1).
 *
 * - public read: published_at IS NOT NULL 만
 * - admin write: 모든 row, revision 자동 생성
 */
interface IndicatorContentRepositoryPort {
    suspend fun save(content: IndicatorContent): IndicatorContent
    suspend fun findById(id: ContentId): IndicatorContent?
    suspend fun findBySlug(slug: Slug, includeUnpublished: Boolean = false): IndicatorContent?
    suspend fun findPublished(category: IndicatorCategory? = null): List<IndicatorContent>
    suspend fun findAll(): List<IndicatorContent>
    suspend fun delete(id: ContentId)
}
