package com.kgd.place.application.attraction.usecase

import java.time.LocalDateTime

/** 재색인(search-batch)이 쓰는 경로 — 페이지마다 id 묶음의 벡터를 받아 색인 문서에 싣는다 (ADR-0090). */
interface LookupAttractionEmbeddingsUseCase {
    fun lookup(modelRef: String, attractionIds: List<Long>): List<Found>

    data class Found(
        val attractionId: Long,
        val textHash: String,
        val vector: FloatArray,
        val embeddedAt: LocalDateTime,
    )
}
