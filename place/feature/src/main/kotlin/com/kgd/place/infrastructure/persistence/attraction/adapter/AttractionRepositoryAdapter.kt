package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionJpaRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class AttractionRepositoryAdapter(
    private val jpaRepository: AttractionJpaRepository,
) : AttractionRepositoryPort {

    /**
     * (contentId, lang) 기준 멱등 upsert. 배치(청크 ≤2000)로 들어오므로
     * 기존 행을 contentId IN 으로 한 번에 조회해 자연키 매칭 후 id 를 승계한다.
     */
    @Transactional
    override fun upsertAll(attractions: List<Attraction>): AttractionRepositoryPort.UpsertSummary {
        if (attractions.isEmpty()) return AttractionRepositoryPort.UpsertSummary(0, 0)

        val existingByKey = jpaRepository.findByContentIdIn(attractions.map { it.contentId }.toSet())
            .associateBy { it.contentId to it.lang }

        var created = 0
        var updated = 0
        val entities = attractions.map { incoming ->
            val existing = existingByKey[incoming.contentId to incoming.lang]
            if (existing == null) {
                created++
                AttractionJpaEntity.fromDomain(incoming)
            } else {
                updated++
                val merged = existing.toDomain().apply { syncFrom(incoming) }
                AttractionJpaEntity.fromDomain(merged)
            }
        }
        jpaRepository.saveAll(entities)
        return AttractionRepositoryPort.UpsertSummary(created, updated)
    }

    override fun findById(id: Long): Attraction? =
        jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findAllByIds(ids: Collection<Long>): List<Attraction> =
        if (ids.isEmpty()) emptyList() else jpaRepository.findAllById(ids).map { it.toDomain() }

    override fun findPage(lang: String?, pageable: Pageable): Page<Attraction> =
        (lang?.let { jpaRepository.findByLang(it, pageable) } ?: jpaRepository.findAll(pageable))
            .map { it.toDomain() }

    override fun count(): Long = jpaRepository.count()

    override fun countByLdong(
        lang: String,
        categories: Collection<String>,
    ): List<AttractionRepositoryPort.LdongCount> =
        jpaRepository.countByLdong(lang, categories).map {
            AttractionRepositoryPort.LdongCount(it.getRegnCode(), it.getSignguCode(), it.getTotal())
        }

    override fun findMissingGooglePlaceId(lang: String?, limit: Int): List<Attraction> {
        val pageable = PageRequest.of(0, limit, Sort.by("id"))
        val page = lang
            ?.let { jpaRepository.findByGooglePlaceIdIsNullAndStatusAndLang("ACTIVE", it, pageable) }
            ?: jpaRepository.findByGooglePlaceIdIsNullAndStatus("ACTIVE", pageable)
        return page.content.map { it.toDomain() }
    }

    override fun saveAll(attractions: List<Attraction>) {
        jpaRepository.saveAll(attractions.map { AttractionJpaEntity.fromDomain(it) })
    }
}
