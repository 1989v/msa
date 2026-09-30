package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionSimilarRepositoryPort
import com.kgd.place.domain.attraction.model.EmbeddingModelRef
import com.kgd.place.domain.attraction.model.SimilarAttractions
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionSimilarJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionSimilarJpaRepository
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class AttractionSimilarRepositoryAdapter(
    private val jpaRepository: AttractionSimilarJpaRepository,
) : AttractionSimilarRepositoryPort {

    override fun replace(lists: List<SimilarAttractions>, computedAt: LocalDateTime): Int {
        if (lists.isEmpty()) return 0
        lists.groupBy { it.modelRef.value }.forEach { (modelRef, group) ->
            jpaRepository.deleteByModelRefAndAttractionIds(modelRef, group.map { it.attractionId })
        }
        val rows = lists.flatMap { list ->
            list.items.mapIndexed { rank, item ->
                AttractionSimilarJpaEntity(
                    attractionId = list.attractionId,
                    modelRef = list.modelRef.value,
                    rankNo = rank.toShort(),
                    similarId = item.similarId,
                    score = item.score,
                    computedAt = computedAt,
                )
            }
        }
        return jpaRepository.saveAll(rows).size
    }

    override fun findByModelAndIds(modelRef: String, attractionIds: List<Long>): List<SimilarAttractions> {
        if (attractionIds.isEmpty()) return emptyList()
        val ref = EmbeddingModelRef.parse(modelRef)
        return jpaRepository.findByModelRefAndAttractionIdInOrderByAttractionIdAscRankNoAsc(modelRef, attractionIds)
            .groupBy { it.attractionId }
            .map { (attractionId, rows) ->
                SimilarAttractions.create(attractionId, ref, rows.map { SimilarAttractions.Item(it.similarId, it.score) })
            }
    }

    override fun existingAttractionIds(attractionIds: Collection<Long>): Set<Long> =
        if (attractionIds.isEmpty()) emptySet() else jpaRepository.findExistingAttractionIds(attractionIds).toSet()
}
