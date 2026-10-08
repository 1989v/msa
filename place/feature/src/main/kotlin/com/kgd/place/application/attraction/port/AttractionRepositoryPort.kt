package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.Attraction
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import java.time.LocalDateTime

interface AttractionRepositoryPort {
    /** (contentId, lang) 자연키 기준 멱등 upsert — 기존 행은 원천 최신값으로 동기화. */
    fun upsertAll(attractions: List<Attraction>): UpsertSummary

    fun findById(id: Long): Attraction?

    /** 수집 큐가 관광지명을 한 번에 가져올 때 — 건별 조회를 100번 하지 않는다. */
    fun findAllByIds(ids: Collection<Long>): List<Attraction>

    /** 원천 번호 → 관광지 id. 원천마다 번호 체계가 달라 원천을 함께 준다 */
    fun findIdsBySource(source: String, lang: String, contentIds: Collection<String>): Map<String, Long>

    /** lang 미지정 시 전체 — search-batch 재색인 풀스캔용. */
    fun findPage(lang: String?, pageable: Pageable): Page<Attraction>

    /** id > afterId 를 id 순으로 최대 limit 건 — OFFSET 없이 이어 읽는 풀스캔용. */
    fun findAfter(lang: String?, afterId: Long, limit: Int): List<Attraction>

    fun count(): Long

    /** 운영 중이고 since ≤ 본문 변경 시각 < until 인 관광지를 id > afterId 부터 id 순으로 최대 size 건 — id·언어만. */
    fun findContentUpdated(since: LocalDateTime, until: LocalDateTime, afterId: Long, size: Int): List<ContentUpdated>

    /** 법정동 축 관광지 건수 — 드릴다운이 "몇 곳"을 보이는 근거. 관광 분류만 센다. */
    fun countByLdong(lang: String, categories: Collection<String>): List<LdongCount>

    /** 구글 place_id 미보강분 — id 순 단순 스캔 (수집기 큐, CollectGooglePlaceIdsUseCase). */
    fun findMissingGooglePlaceId(lang: String?, limit: Int): List<Attraction>

    /** 보강 결과 반영 — upsertAll(전체 동기화)과 달리 이미 로드된 도메인을 그대로 저장한다. */
    fun saveAll(attractions: List<Attraction>)

    data class UpsertSummary(val created: Int, val updated: Int)

    data class ContentUpdated(val id: Long, val lang: String)

    /** 같은 표시명·언어의 운영 관광지 수 — 이름이 겹치는 곳을 가린다(영상 검색어에 지역을 붙인다). */
    fun countByTitleDisplay(titles: Collection<String>): List<TitleCount>

    data class LdongCount(val regnCode: String, val signguCode: String?, val total: Long)

    data class TitleCount(val titleDisplay: String, val lang: String, val total: Long)
}
