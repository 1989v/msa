package com.kgd.place.presentation.attraction.dto

import com.kgd.place.application.attraction.usecase.GetAttractionUseCase
import com.kgd.place.application.attraction.usecase.UpsertAttractionUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class BulkUpsertAttractionRequest(
    @field:NotEmpty(message = "관광지 목록은 비어있을 수 없습니다")
    @field:Size(max = 2000, message = "한 번에 최대 2000건까지 적재할 수 있습니다")
    @field:Valid
    val attractions: List<UpsertAttractionItem>,
)

data class UpsertAttractionItem(
    @field:NotBlank val contentId: String,
    @field:NotBlank val lang: String,
    @field:NotBlank val title: String,
    val latitude: Double,
    val longitude: Double,
    val address: String? = null,
    val areaCode: String? = null,
    val sigunguCode: String? = null,
    val category: String? = null,
    val cat1: String? = null,
    val cat2: String? = null,
    val cat3: String? = null,
    val imageUrl: String? = null,
    val tel: String? = null,
    val overview: String? = null,
    val sourceModifiedAt: LocalDateTime? = null,
) {
    fun toCommand(): UpsertAttractionUseCase.Command = UpsertAttractionUseCase.Command(
        contentId = contentId,
        lang = lang,
        title = title,
        latitude = latitude,
        longitude = longitude,
        address = address,
        areaCode = areaCode,
        sigunguCode = sigunguCode,
        category = category,
        cat1 = cat1,
        cat2 = cat2,
        cat3 = cat3,
        imageUrl = imageUrl,
        tel = tel,
        overview = overview,
        sourceModifiedAt = sourceModifiedAt,
    )
}

data class BulkUpsertAttractionResponse(val created: Int, val updated: Int, val total: Long) {
    companion object {
        fun from(result: UpsertAttractionUseCase.Result) =
            BulkUpsertAttractionResponse(result.created, result.updated, result.total)
    }
}

data class AttractionResponse(
    val id: Long,
    val contentId: String,
    val lang: String,
    val title: String,
    val address: String?,
    val areaCode: String?,
    val sigunguCode: String?,
    val category: String?,
    val latitude: Double,
    val longitude: Double,
    val imageUrl: String?,
    val tel: String?,
    val overview: String?,
    val sourceModifiedAt: LocalDateTime?,
    val status: String,
) {
    companion object {
        fun from(view: GetAttractionUseCase.AttractionView) = AttractionResponse(
            id = view.id,
            contentId = view.contentId,
            lang = view.lang,
            title = view.title,
            address = view.address,
            areaCode = view.areaCode,
            sigunguCode = view.sigunguCode,
            category = view.category,
            latitude = view.latitude,
            longitude = view.longitude,
            imageUrl = view.imageUrl,
            tel = view.tel,
            overview = view.overview,
            sourceModifiedAt = view.sourceModifiedAt,
            status = view.status,
        )
    }
}

data class AttractionPageResponse(
    val attractions: List<AttractionResponse>,
    val totalElements: Long,
    val totalPages: Int,
    val currentPage: Int,
)
