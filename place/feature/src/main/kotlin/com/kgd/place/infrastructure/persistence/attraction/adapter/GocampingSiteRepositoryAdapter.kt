package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.GocampingSiteRepositoryPort
import com.kgd.place.domain.attraction.model.GocampingSite
import com.kgd.place.infrastructure.persistence.attraction.entity.GocampingSiteJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.GocampingSiteJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper
import org.springframework.transaction.annotation.Transactional

@Component
class GocampingSiteRepositoryAdapter(
    private val repository: GocampingSiteJpaRepository,
) : GocampingSiteRepositoryPort {

    /** 기본키가 원천 contentId 라 save 가 곧 덮어쓰기다 */
    @Transactional
    override fun upsertAll(sites: List<GocampingSite>): Int =
        repository.saveAll(sites.map { GocampingSiteJpaEntity.fromDomain(it) }).size

    override fun findCampingInfo(attractionIds: Collection<Long>): Map<Long, String> {
        if (attractionIds.isEmpty()) return emptyMap()
        val own = attractionIds.chunked(IN_CHUNK).flatMap { repository.findByAttractionIdIn(it) }.associateBy { it.attractionId!! }
        val matched = attractionIds.chunked(IN_CHUNK).flatMap { repository.findByMatchedAttractionIdIn(it) }
            .groupBy { it.matchedAttractionId!! }.mapValues { (_, rows) -> rows.minBy { it.contentId } }
        return (matched + own).mapNotNull { (id, row) -> displayJson(row.itemRaw)?.let { id to it } }.toMap()
    }

    /** 원문에서 화면에 내는 키만 — 값이 비면 뺀다. 원문을 못 읽으면 null */
    private fun displayJson(itemRaw: String): String? = runCatching {
        val raw = json.readTree(itemRaw)
        val picked = GocampingSite.DISPLAY_KEYS.mapNotNull { key ->
            raw.get(key)?.asString()?.trim()?.takeIf { it.isNotEmpty() }?.let { key to it }
        }.toMap()
        picked.takeIf { it.isNotEmpty() }?.let { json.writeValueAsString(it) }
    }.onFailure { log.warn { "고캠핑 원문을 못 읽었다: ${it.message}" } }.getOrNull()

    private companion object {
        const val IN_CHUNK = 1000
        val json: JsonMapper = JsonMapper.builder().build()
        val log = KotlinLogging.logger {}
    }
}
