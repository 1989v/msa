package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionAccessRepositoryPort
import com.kgd.place.domain.attraction.model.AttractionAccess
import com.kgd.place.domain.attraction.model.TransitKind
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionAccessJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionAccessJpaRepository
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class AttractionAccessRepositoryAdapter(
    private val repository: AttractionAccessJpaRepository,
) : AttractionAccessRepositoryPort {

    override fun replace(attractionIds: Collection<Long>, rows: List<AttractionAccess>, computedAt: LocalDateTime): Int {
        val removed = attractionIds.chunked(IN_CHUNK).sumOf { repository.deleteByAttractionIds(it) }
        repository.saveAll(
            rows.map {
                AttractionAccessJpaEntity(
                    attractionId = it.attractionId, kind = it.kind.name, stopRank = it.rank, sourceKey = it.sourceKey, name = it.name,
                    nameEn = it.nameEn, lineNames = it.lines, distanceM = it.distanceM, baseDate = it.baseDate, computedAt = computedAt,
                )
            },
        )
        return removed
    }

    override fun deleteComputedBefore(computedAt: LocalDateTime): Int = repository.deleteComputedBefore(computedAt)

    override fun findByAttractionIds(attractionIds: Collection<Long>): List<AttractionAccess> =
        attractionIds.distinct().chunked(IN_CHUNK).flatMap { repository.findByAttractionIdIn(it) }.map {
            AttractionAccess(
                attractionId = it.attractionId, kind = TransitKind.valueOf(it.kind), rank = it.stopRank, sourceKey = it.sourceKey,
                name = it.name, nameEn = it.nameEn, lines = it.lineNames, distanceM = it.distanceM, baseDate = it.baseDate,
            )
        }

    override fun findBusCoverage(attractionIds: Collection<Long>): Map<Long, Boolean> =
        attractionIds.distinct().chunked(IN_CHUNK).flatMap { repository.findBusCoverage(it) }
            .associate { it.getAttractionId() to it.getCovered() }

    private companion object {
        /** IN 절 하나에 싣는 값 수 — 재색인 묶음(500) · 수집기 묶음(2,000)이 한 번에 들어간다. */
        const val IN_CHUNK = 2_000
    }
}
