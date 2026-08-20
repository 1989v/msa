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
        val address: String?,
        val areaCode: String?,
        val sigunguCode: String?,
        val ldongRegnCd: String?,
        val ldongSignguCd: String?,
        val category: String?,
        val latitude: Double,
        val longitude: Double,
        val imageUrl: String?,
        val tel: String?,
        val overview: String?,
        val sourceModifiedAt: LocalDateTime?,
        val status: String,
    )
}
