package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionExtrasRepositoryPort
import com.kgd.place.domain.attraction.model.AttractionBarrierFree
import com.kgd.place.domain.attraction.model.AttractionWellness
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionBarrierFreeJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionWellnessJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionBarrierFreeJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionWellnessJpaRepository
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class AttractionExtrasRepositoryAdapter(
    private val barrierFreeRepository: AttractionBarrierFreeJpaRepository,
    private val wellnessRepository: AttractionWellnessJpaRepository,
) : AttractionExtrasRepositoryPort {

    override fun findAttractionIds(lang: String, contentIds: Collection<String>): Map<String, Long> =
        if (contentIds.isEmpty()) {
            emptyMap()
        } else {
            contentIds.chunked(IN_CHUNK).flatMap { barrierFreeRepository.findAttractionIds(lang, it) }
                .associate { it.getContentId() to it.getId() }
        }

    override fun findBarrierFreeByContentIds(contentIds: Collection<String>): List<AttractionBarrierFree> =
        contentIds.chunked(IN_CHUNK).flatMap { barrierFreeRepository.findByContentIdIn(it) }.map { it.toDomain() }

    override fun saveBarrierFree(rows: List<AttractionBarrierFree>): Int =
        barrierFreeRepository.saveAll(
            rows.map { row ->
                AttractionBarrierFreeJpaEntity(
                    attractionId = row.attractionId,
                    contentId = row.contentId,
                    listRaw = row.listRaw,
                    detailRaw = row.detailRaw,
                    listModifiedAt = row.listModifiedAt,
                    detailSyncedAt = row.detailSyncedAt,
                    flags = AttractionBarrierFree.joinFlags(row.flags),
                    flagsRuleVer = row.flagsRuleVer?.toShort(),
                )
            },
        ).size

    override fun findBarrierFreeStates(): List<AttractionExtrasRepositoryPort.BarrierFreeState> =
        barrierFreeRepository.findStates().map {
            AttractionExtrasRepositoryPort.BarrierFreeState(it.getContentId(), it.getListModifiedAt(), it.getDetailSyncedAt())
        }

    override fun findBarrierFreeByAttractionIds(attractionIds: Collection<Long>): List<AttractionBarrierFree> =
        if (attractionIds.isEmpty()) emptyList() else barrierFreeRepository.findAllById(attractionIds).map { it.toDomain() }

    override fun replaceWellness(lang: String, rows: List<AttractionWellness>, syncedAt: LocalDateTime): Set<Long> {
        val before = wellnessRepository.findAttractionIdsByLang(lang).toSet()
        wellnessRepository.deleteByLang(lang)
        wellnessRepository.saveAll(
            rows.map { AttractionWellnessJpaEntity(it.attractionId, it.contentId, it.lang, it.themaCd, it.listRaw, syncedAt) },
        )
        return before
    }

    override fun findWellnessByAttractionIds(attractionIds: Collection<Long>): List<AttractionWellness> =
        if (attractionIds.isEmpty()) emptyList() else wellnessRepository.findAllById(attractionIds).map { it.toDomain() }

    private companion object {
        /** IN 절 하나에 싣는 값 수 — 요청 한 번(2,000건)을 두 번에 나눈다. */
        const val IN_CHUNK = 1_000
    }
}
