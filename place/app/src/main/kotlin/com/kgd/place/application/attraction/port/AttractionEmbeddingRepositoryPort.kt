package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.AttractionEmbedding
import java.time.LocalDateTime

interface AttractionEmbeddingRepositoryPort {
    fun findByModelAndIds(modelRef: String, attractionIds: List<Long>): List<AttractionEmbedding>

    /** (attraction_id, model_ref) 유니크 위의 upsert. 반환은 실제로 쓴 행 수. */
    fun saveAll(embeddings: List<AttractionEmbedding>): Int

    /** 벡터가 없거나 `attractions.updated_at` 이 더 최신인 id — 후보만 좁힌다(확정은 도구가 해시로). */
    fun findPendingIds(modelRef: String, limit: Int): List<Long>

    /** (없음, stale) */
    fun countPending(modelRef: String): Pair<Long, Long>

    fun countByModel(modelRef: String): Long

    fun lastEmbeddedAt(modelRef: String): LocalDateTime?

    fun countActiveAttractions(): Long

    /** 존재하는 관광지 id 만 남긴다 — 없는 id 로 벡터가 들어오면 영영 안 읽힌다. */
    fun existingAttractionIds(attractionIds: List<Long>): Set<Long>

    /** 옛 스탬프 정리 (모델 교체 뒤). */
    fun deleteByModel(modelRef: String): Int
}
