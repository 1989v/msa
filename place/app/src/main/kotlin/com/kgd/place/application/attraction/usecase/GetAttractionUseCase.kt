package com.kgd.place.application.attraction.usecase

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import java.time.LocalDateTime

interface GetAttractionUseCase {
    fun findById(id: Long): AttractionView

    fun findPage(lang: String?, pageable: Pageable): Page<AttractionView>

    data class AttractionView(
        val id: Long,
        val contentId: String,
        val lang: String,
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
        val googlePlaceId: String?,
        val sourceModifiedAt: LocalDateTime?,
        val status: String,
    )
}
