package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.application.attraction.port.AttractionEmbeddingRepositoryPort
import com.kgd.place.domain.attraction.model.AttractionEmbedding
import com.kgd.place.domain.attraction.model.EmbeddingModelRef
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionEmbeddingJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionEmbeddingJpaRepository
import org.springframework.stereotype.Component
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.time.LocalDateTime

/** 벡터의 바이트 표현은 여기서만 다룬다 — float32 little-endian, 도구·API 와 같은 규약 (ADR-0090). */
@Component
class AttractionEmbeddingRepositoryAdapter(
    private val jpaRepository: AttractionEmbeddingJpaRepository,
) : AttractionEmbeddingRepositoryPort {

    override fun findByModelAndIds(modelRef: String, attractionIds: List<Long>): List<AttractionEmbedding> {
        if (attractionIds.isEmpty()) return emptyList()
        val ref = EmbeddingModelRef.parse(modelRef)
        return jpaRepository.findByModelRefAndAttractionIdIn(modelRef, attractionIds).map { it.toDomain(ref) }
    }

    override fun saveAll(embeddings: List<AttractionEmbedding>): Int {
        if (embeddings.isEmpty()) return 0
        return jpaRepository.saveAll(embeddings.map { it.toEntity() }).size
    }

    override fun findPendingIds(modelRef: String, limit: Int): List<Long> =
        jpaRepository.findPendingIds(modelRef, limit)

    override fun countPending(modelRef: String): Pair<Long, Long> {
        val row = jpaRepository.countPending(modelRef)
        // SUM 은 대상이 없으면 NULL 이다 — 0 으로 읽는다
        fun at(i: Int): Long = (row.getOrNull(i) as? Number)?.toLong() ?: 0L
        return at(0) to at(1)
    }

    override fun countByModel(modelRef: String): Long = jpaRepository.countByModelRef(modelRef)

    override fun lastEmbeddedAt(modelRef: String): LocalDateTime? = jpaRepository.findLastEmbeddedAt(modelRef)

    override fun countActiveAttractions(): Long = jpaRepository.countActiveAttractions()

    override fun existingAttractionIds(attractionIds: List<Long>): Set<Long> =
        if (attractionIds.isEmpty()) emptySet() else jpaRepository.findExistingIds(attractionIds).toSet()

    override fun deleteByModel(modelRef: String): Int = jpaRepository.deleteByModelRef(modelRef)

    private fun AttractionEmbedding.toEntity() = AttractionEmbeddingJpaEntity(
        id = id,
        attractionId = attractionId,
        modelRef = modelRef.value,
        dim = modelRef.dim.toShort(),
        embeddingText = embeddingText,
        textHash = textHash,
        vector = toBytes(vector),
        embeddedAt = embeddedAt,
    )

    private fun AttractionEmbeddingJpaEntity.toDomain(ref: EmbeddingModelRef) = AttractionEmbedding.create(
        attractionId = attractionId,
        modelRef = ref,
        embeddingText = embeddingText,
        textHash = textHash,
        vector = toFloats(vector),
        embeddedAt = embeddedAt,
        id = id,
    )

    companion object {
        fun toBytes(vector: FloatArray): ByteArray {
            val buf = ByteBuffer.allocate(vector.size * Float.SIZE_BYTES).order(ByteOrder.LITTLE_ENDIAN)
            vector.forEach { buf.putFloat(it) }
            return buf.array()
        }

        fun toFloats(bytes: ByteArray): FloatArray {
            require(bytes.size % Float.SIZE_BYTES == 0) { "벡터 바이트 길이가 4의 배수가 아닙니다: ${bytes.size}" }
            val buf = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
            return FloatArray(bytes.size / Float.SIZE_BYTES) { buf.float }
        }
    }
}
