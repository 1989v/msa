package com.kgd.place.application.attraction.usecase

import java.time.LocalDateTime

/**
 * 임베딩 동기화 — `tools/embed`(로컬 GPU)가 쓰는 경로 (ADR-0090).
 *
 * 서버는 벡터를 만들지 않는다. 도구가 pending 을 받아 텍스트를 조립하고, 해시가 같으면 벡터 없이 touch 로,
 * 다르면 새 벡터와 함께 보낸다.
 */
interface SyncAttractionEmbeddingsUseCase {
    fun findPending(modelRef: String, limit: Int): Pending

    /** 요청 단위 all-or-nothing — 한 건이라도 검증에 걸리면 전부 거부한다(부분 성공은 도구가 상태를 다시 물어야 한다). */
    fun upsert(modelRef: String, items: List<Item>): Applied

    fun status(modelRef: String): Status

    fun deleteModel(modelRef: String): Int

    data class Pending(val modelRef: String, val missing: Long, val stale: Long, val ids: List<Long>)

    /** [vector] 가 null 이면 touch — 저장된 text_hash 와 같아야 하고, 다르면 거부된다. */
    data class Item(
        val attractionId: Long,
        val embeddingText: String,
        val textHash: String,
        val vector: FloatArray? = null,
    )

    data class Applied(val inserted: Int, val updated: Int, val touched: Int)

    data class Status(
        val modelRef: String,
        val total: Long,
        val embedded: Long,
        val missing: Long,
        val stale: Long,
        val lastEmbeddedAt: LocalDateTime?,
    )
}
