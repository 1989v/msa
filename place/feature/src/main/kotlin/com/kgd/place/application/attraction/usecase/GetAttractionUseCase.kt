package com.kgd.place.application.attraction.usecase

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import java.time.LocalDate
import java.time.LocalDateTime

interface GetAttractionUseCase {
    fun findById(id: Long): AttractionView

    fun findPage(lang: String?, pageable: Pageable): Page<AttractionView>

    /**
     * id 가 [afterId] 보다 큰 관광지를 id 순으로 최대 [size] 건. 다음 요청은 [AttractionSlice.nextAfterId] 를 넘긴다.
     * OFFSET 페이징은 건너뛸 행을 전부 읽어 뒤 페이지일수록 느려진다 — 풀스캔은 이 경로를 쓴다.
     */
    fun findAfter(lang: String?, afterId: Long, size: Int): AttractionSlice

    /** [nextAfterId] 가 null 이면 더 읽을 것이 없다. */
    data class AttractionSlice(val items: List<AttractionView>, val nextAfterId: Long?)

    data class AttractionView(
        val id: Long,
        val contentId: String,
        val lang: String,
        val source: String = "TOURAPI",
        val title: String,
        /** title 파생 표기 (AttractionTitle) — 화면·외부 검색은 display, 병기는 local. */
        val titleDisplay: String,
        val titleLocal: String?,
        val address: String?,
        val areaCode: String?,
        val sigunguCode: String?,
        val ldongRegnCd: String?,
        val ldongSignguCd: String?,
        val category: String?,
        val cat1: String?,
        val cat2: String?,
        val cat3: String?,
        val lclsSystm1: String?,
        val lclsSystm2: String?,
        val lclsSystm3: String?,
        val contentTypeId: String?,
        val copyrightDivCd: String?,
        val thumbnailUrl: String?,
        val mapLevel: Int?,
        val zipcode: String?,
        val sourceCreatedAt: LocalDateTime?,
        val latitude: Double,
        val longitude: Double,
        val imageUrl: String?,
        val tel: String?,
        val overview: String?,
        val introRaw: String?,
        val useTime: String?,
        val restDate: String?,
        val useFee: String?,
        val parking: String?,
        val parkingFee: String?,
        val infoCenter: String?,
        val introSyncedAt: LocalDateTime?,
        val petAcmpyType: String?,
        val petRaw: String?,
        val petSyncedAt: LocalDateTime?,
        /** 주로 즐기는 곳 — indoor · outdoor · mixed (파생 값, 없으면 null) */
        val setting: String?,
        val imagesRaw: String?,
        val infoRaw: String?,
        val extraSyncedAt: LocalDateTime?,
        /** 행사 시작일·종료일 (원천 값 그대로) · 목록 행 원문 */
        val eventStartDate: LocalDate?,
        val eventEndDate: LocalDate?,
        val listRaw: String?,
        val googlePlaceId: String?,
        val sourceModifiedAt: LocalDateTime?,
        val status: String,
    )
}
