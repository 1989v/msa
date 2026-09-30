package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionSimilarRepositoryPort
import com.kgd.place.application.attraction.usecase.LookupAttractionSimilarUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionSimilarUseCase
import com.kgd.place.domain.attraction.model.EmbeddingModelRef
import com.kgd.place.domain.attraction.model.SimilarAttractions
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

/**
 * 관광지 「비슷한 곳」 목록의 저장·조회. 계산은 `tools/embed` 의 몫이고, 여기는 목록이 앞뒤가 맞는지만 본다.
 */
@Service
class AttractionSimilarService(
    private val similarRepository: AttractionSimilarRepositoryPort,
) : SyncAttractionSimilarUseCase, LookupAttractionSimilarUseCase {

    @Transactional
    override fun replace(
        modelRef: String,
        documents: List<SyncAttractionSimilarUseCase.Document>,
    ): SyncAttractionSimilarUseCase.Applied {
        val ref = EmbeddingModelRef.parse(modelRef)
        require(documents.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        val ids = documents.map { it.attractionId }
        require(ids.toSet().size == ids.size) { "같은 attraction_id 가 요청 안에 두 번 있습니다" }

        val lists = documents.map { doc ->
            SimilarAttractions.create(doc.attractionId, ref, doc.similar.map { SimilarAttractions.Item(it.id, it.score) })
        }
        val referenced = ids + lists.flatMap { list -> list.items.map { it.similarId } }
        val existing = similarRepository.existingAttractionIds(referenced.toSet())
        val unknown = referenced.filterNot { it in existing }.distinct()
        require(unknown.isEmpty()) { "존재하지 않는 관광지입니다: ${unknown.take(10)}" }

        val rows = similarRepository.replace(lists, LocalDateTime.now())
        log.info { "비슷한 곳 교체: model=${ref.value} 문서=${lists.size} 행=$rows" }
        return SyncAttractionSimilarUseCase.Applied(documents = lists.size, rows = rows)
    }

    override fun lookup(modelRef: String, attractionIds: List<Long>): List<LookupAttractionSimilarUseCase.Found> {
        if (attractionIds.isEmpty()) return emptyList()
        val ref = EmbeddingModelRef.parse(modelRef)
        return similarRepository.findByModelAndIds(ref.value, attractionIds).map { list ->
            LookupAttractionSimilarUseCase.Found(
                attractionId = list.attractionId,
                modelRef = list.modelRef.value,
                similar = list.items.map { LookupAttractionSimilarUseCase.Similar(it.similarId, it.score) },
            )
        }
    }
}
