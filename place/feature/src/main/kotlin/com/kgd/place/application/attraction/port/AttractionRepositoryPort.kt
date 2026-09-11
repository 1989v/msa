package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.Attraction
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface AttractionRepositoryPort {
    /** (contentId, lang) 자연키 기준 멱등 upsert — 기존 행은 원천 최신값으로 동기화. */
    fun upsertAll(attractions: List<Attraction>): UpsertSummary

    fun findById(id: Long): Attraction?

    /** 수집 큐가 관광지명을 한 번에 가져올 때 — 건별 조회를 100번 하지 않는다. */
    fun findAllByIds(ids: Collection<Long>): List<Attraction>

    /** lang 미지정 시 전체 — search-batch 재색인 풀스캔용. */
    fun findPage(lang: String?, pageable: Pageable): Page<Attraction>

    fun count(): Long

    /** 법정동 축 관광지 건수 — 드릴다운이 "몇 곳"을 보이는 근거. 관광 분류만 센다. */
    fun countByLdong(lang: String, categories: Collection<String>): List<LdongCount>

    /** 구글 place_id 미보강분 — id 순 단순 스캔 (수집기 큐, CollectGooglePlaceIdsUseCase). */
    fun findMissingGooglePlaceId(lang: String?, limit: Int): List<Attraction>

    /** 보강 결과 반영 — upsertAll(전체 동기화)과 달리 이미 로드된 도메인을 그대로 저장한다. */
    fun saveAll(attractions: List<Attraction>)

    data class UpsertSummary(val created: Int, val updated: Int)

    data class LdongCount(val regnCode: String, val signguCode: String?, val total: Long)
}
