package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionEmbeddingRepositoryPort
import com.kgd.place.application.attraction.usecase.LookupAttractionEmbeddingsUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionEmbeddingsUseCase
import com.kgd.place.domain.attraction.model.AttractionEmbedding
import com.kgd.place.domain.attraction.model.EmbeddingModelRef
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

/**
 * 관광지 임베딩 벡터의 저장·조회 (ADR-0090).
 *
 * 여기서 하지 않는 것 둘 — **벡터를 만들지 않고**(로컬 GPU 도구의 몫), **임베딩 텍스트를 조립하지 않는다**
 * (규칙이 두 곳에 생기면 갈라지고, 갈라지면 해시가 전부 어긋나 조용히 전량 재임베딩이 된다).
 * 서버가 하는 일은 도구가 보낸 것이 앞뒤가 맞는지 검사하고 원본을 지키는 것이다.
 */
@Service
class AttractionEmbeddingService(
    private val embeddingRepository: AttractionEmbeddingRepositoryPort,
) : SyncAttractionEmbeddingsUseCase, LookupAttractionEmbeddingsUseCase {

    override fun findPending(modelRef: String, limit: Int): SyncAttractionEmbeddingsUseCase.Pending {
        val ref = EmbeddingModelRef.parse(modelRef)
        val (missing, stale) = embeddingRepository.countPending(ref.value)
        return SyncAttractionEmbeddingsUseCase.Pending(
            modelRef = ref.value,
            missing = missing,
            stale = stale,
            ids = embeddingRepository.findPendingIds(ref.value, limit),
        )
    }

    /**
     * 요청 전체가 한 트랜잭션이다. 한 건이라도 검증에 걸리면 **전부** 거부한다 —
     * 부분 성공을 허용하면 도구가 "무엇이 들어갔나"를 다시 물어야 하고, 그 왕복이 멱등을 깨뜨린다.
     */
    @Transactional
    override fun upsert(
        modelRef: String,
        items: List<SyncAttractionEmbeddingsUseCase.Item>,
    ): SyncAttractionEmbeddingsUseCase.Applied {
        val ref = EmbeddingModelRef.parse(modelRef)
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }

        val ids = items.map { it.attractionId }
        require(ids.toSet().size == ids.size) { "같은 attraction_id 가 요청 안에 두 번 있습니다" }
        val existing = embeddingRepository.existingAttractionIds(ids)
        val unknown = ids.filterNot { it in existing }
        require(unknown.isEmpty()) { "존재하지 않는 관광지입니다: ${unknown.take(10)}" }

        val stored = embeddingRepository.findByModelAndIds(ref.value, ids).associateBy { it.attractionId }
        val now = LocalDateTime.now()
        var inserted = 0
        var updated = 0
        var touched = 0

        val toSave = items.map { item ->
            val prev = stored[item.attractionId]
            val vector = item.vector
            if (vector == null) {
                // touch — 벡터를 안 보냈다는 건 "텍스트가 그대로다" 라는 주장이다. 그 주장을 저장된 해시로 검증한다.
                requireNotNull(prev) { "벡터 없이 보낼 수 없습니다(저장된 것이 없습니다): ${item.attractionId}" }
                require(prev.textHash == item.textHash) {
                    "벡터 없이 보냈는데 text_hash 가 다릅니다(텍스트가 바뀌었다면 벡터가 필요합니다): ${item.attractionId}"
                }
                touched++
                prev.touched(now)
            } else {
                if (prev == null) inserted++ else updated++
                AttractionEmbedding.create(
                    attractionId = item.attractionId,
                    modelRef = ref,
                    embeddingText = item.embeddingText,
                    textHash = item.textHash,
                    vector = vector,
                    embeddedAt = now,
                    id = prev?.id,
                )
            }
        }

        embeddingRepository.saveAll(toSave)
        log.info { "임베딩 upsert: model=${ref.value} 신규=$inserted 갱신=$updated touch=$touched" }
        return SyncAttractionEmbeddingsUseCase.Applied(inserted, updated, touched)
    }

    override fun status(modelRef: String): SyncAttractionEmbeddingsUseCase.Status {
        val ref = EmbeddingModelRef.parse(modelRef)
        val (missing, stale) = embeddingRepository.countPending(ref.value)
        return SyncAttractionEmbeddingsUseCase.Status(
            modelRef = ref.value,
            total = embeddingRepository.countActiveAttractions(),
            embedded = embeddingRepository.countByModel(ref.value),
            missing = missing,
            stale = stale,
            lastEmbeddedAt = embeddingRepository.lastEmbeddedAt(ref.value),
        )
    }

    @Transactional
    override fun deleteModel(modelRef: String): Int {
        val ref = EmbeddingModelRef.parse(modelRef)
        val deleted = embeddingRepository.deleteByModel(ref.value)
        log.info { "임베딩 삭제: model=${ref.value} $deleted 행" }
        return deleted
    }

    override fun lookup(modelRef: String, attractionIds: List<Long>): List<LookupAttractionEmbeddingsUseCase.Found> {
        if (attractionIds.isEmpty()) return emptyList()
        val ref = EmbeddingModelRef.parse(modelRef)
        return embeddingRepository.findByModelAndIds(ref.value, attractionIds).map {
            LookupAttractionEmbeddingsUseCase.Found(
                attractionId = it.attractionId,
                textHash = it.textHash,
                vector = it.vector,
                embeddedAt = it.embeddedAt,
            )
        }
    }
}
