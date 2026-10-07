package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionJpaRepository
import org.springframework.data.domain.Limit
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
     * (source, contentId, lang) 기준 멱등 upsert. 배치(청크 ≤2000)로 들어오므로
     * 기존 행을 contentId IN 으로 한 번에 조회해 자연키 매칭 후 id 를 승계한다 — 번호가 같아도 원천이 다르면 다른 곳이다.
     */
    @Transactional
    override fun upsertAll(attractions: List<Attraction>): AttractionRepositoryPort.UpsertSummary {
        if (attractions.isEmpty()) return AttractionRepositoryPort.UpsertSummary(0, 0)

        val existingByKey = jpaRepository.findByContentIdIn(attractions.map { it.contentId }.toSet())
            .associateBy { Triple(it.source, it.contentId, it.lang) }

        var created = 0
        var updated = 0
        val entities = attractions.map { incoming ->
            val existing = existingByKey[Triple(incoming.source, incoming.contentId, incoming.lang)]
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

    override fun findIdsBySource(source: String, lang: String, contentIds: Collection<String>): Map<String, Long> =
        contentIds.chunked(IN_CHUNK)
            .flatMap { jpaRepository.findBySourceAndLangAndContentIdIn(source, lang, it) }
            .associate { it.contentId to it.id!! }

    override fun findAllByIds(ids: Collection<Long>): List<Attraction> =
        if (ids.isEmpty()) emptyList() else jpaRepository.findAllById(ids).map { it.toDomain() }

    override fun findPage(lang: String?, pageable: Pageable): Page<Attraction> =
        (lang?.let { jpaRepository.findByLang(it, pageable) } ?: jpaRepository.findAll(pageable))
            .map { it.toDomain() }

    override fun findAfter(lang: String?, afterId: Long, limit: Int): List<Attraction> =
        (
            lang?.let { jpaRepository.findByLangAndIdGreaterThanOrderByIdAsc(it, afterId, Limit.of(limit)) }
                ?: jpaRepository.findByIdGreaterThanOrderByIdAsc(afterId, Limit.of(limit))
            ).map { it.toDomain() }

    override fun count(): Long = jpaRepository.count()

    override fun countByLdong(
        lang: String,
        categories: Collection<String>,
    ): List<AttractionRepositoryPort.LdongCount> =
        jpaRepository.countByLdong(lang, categories).map {
            AttractionRepositoryPort.LdongCount(it.getRegnCode(), it.getSignguCode(), it.getTotal())
        }

    override fun countByTitleDisplay(titles: Collection<String>): List<AttractionRepositoryPort.TitleCount> =
        if (titles.isEmpty()) {
            emptyList()
        } else {
            jpaRepository.countByTitleDisplay(titles).map {
                AttractionRepositoryPort.TitleCount(it.getTitleDisplay(), it.getLang(), it.getTotal())
            }
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

    private companion object {
        /** IN 목록 상한 — 한 쿼리에 수천 개를 싣지 않는다 */
        const val IN_CHUNK = 1000
    }
}
