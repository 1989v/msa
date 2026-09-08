package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionCategoryCodeRepositoryPort
import com.kgd.place.domain.attraction.model.AttractionCategoryCode
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionCategoryCodeJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionCategoryCodeJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Component
class AttractionCategoryCodeRepositoryAdapter(
    private val jpaRepository: AttractionCategoryCodeJpaRepository,
) : AttractionCategoryCodeRepositoryPort {

    @Transactional
    override fun upsertAll(codes: List<AttractionCategoryCode>): Int {
        if (codes.isEmpty()) return 0

        val existingByKey = codes.map { it.lang }.toSet()
            .flatMap { jpaRepository.findByLang(it) }
            .associateBy { it.lang to it.code }

        val now = LocalDateTime.now()
        val entities = codes.map { incoming ->
            AttractionCategoryCodeJpaEntity(
                id = existingByKey[incoming.lang to incoming.code]?.id,
                lang = incoming.lang,
                code = incoming.code,
                depth = incoming.depth,
                parentCode = incoming.parentCode,
                name = incoming.name,
                syncedAt = now,
            )
        }
        jpaRepository.saveAll(entities)
        return entities.size
    }

    @Transactional(readOnly = true)
    override fun findAll(lang: String?): List<AttractionCategoryCode> =
        (lang?.let { jpaRepository.findByLang(it) } ?: jpaRepository.findAll())
            .map {
                AttractionCategoryCode.restore(
                    id = it.id!!, lang = it.lang, code = it.code,
                    depth = it.depth, parentCode = it.parentCode, name = it.name,
                )
            }
}
