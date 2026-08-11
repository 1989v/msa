package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.Attraction
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface AttractionRepositoryPort {
    /** (contentId, lang) 자연키 기준 멱등 upsert — 기존 행은 원천 최신값으로 동기화. */
    fun upsertAll(attractions: List<Attraction>): UpsertSummary

    fun findById(id: Long): Attraction?

    /** lang 미지정 시 전체 — search-batch 재색인 풀스캔용. */
    fun findPage(lang: String?, pageable: Pageable): Page<Attraction>

    fun count(): Long

    data class UpsertSummary(val created: Int, val updated: Int)
}
