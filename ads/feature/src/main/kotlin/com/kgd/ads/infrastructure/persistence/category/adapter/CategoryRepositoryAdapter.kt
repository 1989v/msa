package com.kgd.ads.infrastructure.persistence.category.adapter

import com.kgd.ads.application.category.dto.ContextMappingView
import com.kgd.ads.application.category.dto.HostCategoryView
import com.kgd.ads.application.category.port.CategoryPort
import com.kgd.ads.domain.category.model.ContextCategory
import com.kgd.ads.infrastructure.persistence.category.entity.ContextMappingJpaEntity
import com.kgd.ads.infrastructure.persistence.category.entity.HostCategoryJpaEntity
import com.kgd.ads.infrastructure.persistence.category.repository.ContextCategoryJpaRepository
import com.kgd.ads.infrastructure.persistence.category.repository.ContextMappingJpaRepository
import com.kgd.ads.infrastructure.persistence.category.repository.HostCategoryJpaRepository
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class CategoryRepositoryAdapter(
    private val categoryRepository: ContextCategoryJpaRepository,
    private val mappingRepository: ContextMappingJpaRepository,
    private val hostCategoryRepository: HostCategoryJpaRepository,
) : CategoryPort {

    override fun categories(): List<ContextCategory> =
        categoryRepository.findAll().sortedBy { it.sortOrder }.map { ContextCategory(it.code, it.label, it.sortOrder) }

    override fun mappings(): List<ContextMappingView> =
        mappingRepository.findAll().sortedBy { it.contextKey }.map { ContextMappingView(it.contextKey, it.categoryCode, it.updatedBy, it.updatedAt) }

    override fun saveMapping(contextKey: String, categoryCode: String, actorMemberId: Long, now: LocalDateTime) {
        mappingRepository.save(ContextMappingJpaEntity(contextKey, categoryCode, actorMemberId, now))
    }

    override fun deleteMapping(contextKey: String): Boolean {
        if (!mappingRepository.existsById(contextKey)) return false
        mappingRepository.deleteById(contextKey)
        return true
    }

    override fun hostCategories(): List<HostCategoryView> =
        hostCategoryRepository.findAll().sortedBy { it.host }.map { HostCategoryView(it.host, it.categoryCode, it.updatedBy, it.updatedAt) }

    override fun saveHostCategory(host: String, categoryCode: String, actorMemberId: Long, now: LocalDateTime) {
        hostCategoryRepository.save(HostCategoryJpaEntity(host, categoryCode, actorMemberId, now))
    }
}
