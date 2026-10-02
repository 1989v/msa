package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.AttractionBarrierFree
import com.kgd.place.domain.attraction.model.AttractionWellness
import java.time.LocalDateTime

/** 관광지에 붙는 2단계 공공데이터 표(무장애 · 웰니스). 관광지 행(attractions)은 읽기만 한다. */
interface AttractionExtrasRepositoryPort {

    /** 원천 contentId → 관광지 id (그 언어 행만). 없는 contentId 는 결과에 없다. */
    fun findAttractionIds(lang: String, contentIds: Collection<String>): Map<String, Long>

    fun findBarrierFreeByContentIds(contentIds: Collection<String>): List<AttractionBarrierFree>

    fun saveBarrierFree(rows: List<AttractionBarrierFree>): Int

    fun findBarrierFreeStates(): List<BarrierFreeState>

    fun findBarrierFreeByAttractionIds(attractionIds: Collection<Long>): List<AttractionBarrierFree>

    /** 그 언어의 태그를 [rows] 로 통째로 바꾼다. 반환은 바꾸기 전 그 언어의 태그가 붙어 있던 관광지 id. */
    fun replaceWellness(lang: String, rows: List<AttractionWellness>, syncedAt: LocalDateTime): Set<Long>

    fun findWellnessByAttractionIds(attractionIds: Collection<Long>): List<AttractionWellness>

    data class BarrierFreeState(val contentId: String, val listModifiedAt: LocalDateTime?, val detailSyncedAt: LocalDateTime?)
}
