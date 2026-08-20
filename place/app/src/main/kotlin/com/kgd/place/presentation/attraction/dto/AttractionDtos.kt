package com.kgd.place.presentation.attraction.dto

import com.kgd.place.application.attraction.usecase.AttractionOverviewProbeUseCase
import com.kgd.place.application.attraction.usecase.GetAttractionLinksUseCase
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
    val ldongRegnCd: String? = null,
    val ldongSignguCd: String? = null,
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
        ldongRegnCd = ldongRegnCd,
        ldongSignguCd = ldongSignguCd,
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
            ldongRegnCd = view.ldongRegnCd,
            ldongSignguCd = view.ldongSignguCd,
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

/** 개요 negative cache 기록 요청 (ADR-0070) — 원천이 빈 개요를 준 (contentId, lang). */
data class RecordOverviewProbeRequest(
    @field:NotEmpty(message = "probes 는 비어있을 수 없습니다")
    @field:Valid
    val probes: List<Item>,
) {
    data class Item(
        @field:NotBlank(message = "contentId 는 필수입니다")
        val contentId: String,
        @field:NotBlank(message = "lang 은 필수입니다")
        val lang: String,
    ) {
        fun toCommand() = AttractionOverviewProbeUseCase.Command(contentId = contentId, lang = lang)
    }
}

data class OverviewProbeListResponse(val keys: List<String>, val total: Int)

data class RecordOverviewProbeResponse(val recorded: Int)

/**
 * 관광지 외부 링크 (ADR-0070). `revenueType` 이 AFFILIATE 인 것만 화면이 배지·고지와
 * `rel="sponsored"` 를 붙인다 — 표시 규칙은 화면 한 곳에서만 판단한다.
 */
data class AttractionLinksResponse(
    val collected: List<CollectedLinkResponse>,
    val deepLinks: List<DeepLinkResponse>,
    val pending: Boolean,
) {
    companion object {
        fun from(links: GetAttractionLinksUseCase.Links) = AttractionLinksResponse(
            collected = links.collected.map {
                CollectedLinkResponse(
                    source = it.source.name,
                    title = it.title,
                    url = it.url,
                    thumbnailUrl = it.thumbnailUrl,
                    author = it.author,
                    publishedAt = it.publishedAt,
                )
            },
            deepLinks = links.deepLinks.map {
                DeepLinkResponse(
                    provider = it.provider,
                    kind = it.kind.name,
                    url = it.url,
                    revenueType = it.revenueType.name,
                )
            },
            pending = links.pending,
        )
    }
}

data class CollectedLinkResponse(
    val source: String,
    val title: String,
    val url: String,
    val thumbnailUrl: String?,
    val author: String?,
    val publishedAt: LocalDateTime?,
)

data class DeepLinkResponse(
    val provider: String,
    val kind: String,
    val url: String,
    val revenueType: String,
)
