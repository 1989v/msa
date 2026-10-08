package com.kgd.place.presentation.attraction.dto

import com.kgd.place.application.attraction.usecase.AttractionOverviewProbeUseCase
import com.kgd.place.application.attraction.usecase.GetAttractionUseCase
import com.kgd.place.application.attraction.usecase.UpsertAttractionUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import java.time.LocalDate
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
    /** 원천 — 없으면 TourAPI. 고캠핑 수집기는 GOCAMPING 을 준다 (자연키 (source, contentId, lang)) */
    val source: String? = null,
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
    val lclsSystm1: String? = null,
    val lclsSystm2: String? = null,
    val lclsSystm3: String? = null,
    val contentTypeId: String? = null,
    val copyrightDivCd: String? = null,
    val thumbnailUrl: String? = null,
    val mapLevel: Int? = null,
    val zipcode: String? = null,
    val sourceCreatedAt: LocalDateTime? = null,
    val imageUrl: String? = null,
    val tel: String? = null,
    val overview: String? = null,
    val introRaw: String? = null,
    val useTime: String? = null,
    val restDate: String? = null,
    val useFee: String? = null,
    val parking: String? = null,
    val parkingFee: String? = null,
    val infoCenter: String? = null,
    val introSyncedAt: LocalDateTime? = null,
    /** 반려동물 동반 (detailPetTour2). 필터용 파생 + 원문. */
    val petAcmpyType: String? = null,
    val petRaw: String? = null,
    val petSyncedAt: LocalDateTime? = null,
    val imagesRaw: String? = null,
    val infoRaw: String? = null,
    val extraSyncedAt: LocalDateTime? = null,
    /** 행사 시작일·종료일 — 수집기가 원천 yyyyMMdd 를 ISO(yyyy-MM-dd)로 바꿔 싣는다. */
    val eventStartDate: LocalDate? = null,
    val eventEndDate: LocalDate? = null,
    /** 목록 행 원문 (행사·숙박·코스 목록). */
    val listRaw: String? = null,
    val googlePlaceId: String? = null,
    val sourceModifiedAt: LocalDateTime? = null,
) {
    fun toCommand(): UpsertAttractionUseCase.Command = UpsertAttractionUseCase.Command(
        contentId = contentId,
        lang = lang,
        source = source,
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
        lclsSystm1 = lclsSystm1,
        lclsSystm2 = lclsSystm2,
        lclsSystm3 = lclsSystm3,
        contentTypeId = contentTypeId,
        copyrightDivCd = copyrightDivCd,
        thumbnailUrl = thumbnailUrl,
        mapLevel = mapLevel,
        zipcode = zipcode,
        sourceCreatedAt = sourceCreatedAt,
        imageUrl = imageUrl,
        tel = tel,
        overview = overview,
        introRaw = introRaw,
        useTime = useTime,
        restDate = restDate,
        useFee = useFee,
        parking = parking,
        parkingFee = parkingFee,
        infoCenter = infoCenter,
        introSyncedAt = introSyncedAt,
        petAcmpyType = petAcmpyType,
        petRaw = petRaw,
        petSyncedAt = petSyncedAt,
        imagesRaw = imagesRaw,
        infoRaw = infoRaw,
        extraSyncedAt = extraSyncedAt,
        eventStartDate = eventStartDate,
        eventEndDate = eventEndDate,
        listRaw = listRaw,
        googlePlaceId = googlePlaceId,
        sourceModifiedAt = sourceModifiedAt,
    )
}

data class BulkUpsertAttractionResponse(val created: Int, val updated: Int, val total: Long) {
    companion object {
        fun from(result: UpsertAttractionUseCase.Result) =
            BulkUpsertAttractionResponse(result.created, result.updated, result.total)
    }
}

/**
 * 관광지 조회 응답.
 *
 * **원천 컬럼을 전부 담는다.** 개요 수집기는 이 응답을 읽어 그대로 bulk upsert 로 되돌려
 * 보내고, bulk 는 전체 동기화라 **여기 없는 필드는 매일 null 로 덮인다** (ADR-0065).
 * 실제로 cat1~3 이 이 응답에 없어 그렇게 지워지고 있었다. 컬럼을 추가하면 여기도 같이 넣는다.
 */
data class AttractionResponse(
    val id: Long,
    val contentId: String,
    val lang: String,
    val source: String,
    val title: String,
    /** title 파생 (조회 전용 — 적재 요청에는 없다, 서버가 저장 때마다 다시 계산한다) */
    val titleDisplay: String,
    val titleLocal: String?,
    val address: String?,
    val zipcode: String?,
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
    val setting: String?,
    val imagesRaw: String?,
    val infoRaw: String?,
    val extraSyncedAt: LocalDateTime?,
    val eventStartDate: LocalDate?,
    val eventEndDate: LocalDate?,
    val listRaw: String?,
    val googlePlaceId: String?,
    val sourceModifiedAt: LocalDateTime?,
    /** 본문 변경 시각 — 서버 계산값이라 적재 요청([UpsertAttractionItem])에는 없다. RSS·IndexNow 의 기준 */
    val contentUpdatedAt: LocalDateTime?,
    val status: String,
) {
    companion object {
        fun from(view: GetAttractionUseCase.AttractionView) = AttractionResponse(
            id = view.id,
            contentId = view.contentId,
            lang = view.lang,
            source = view.source,
            title = view.title,
            titleDisplay = view.titleDisplay,
            titleLocal = view.titleLocal,
            address = view.address,
            zipcode = view.zipcode,
            areaCode = view.areaCode,
            sigunguCode = view.sigunguCode,
            ldongRegnCd = view.ldongRegnCd,
            ldongSignguCd = view.ldongSignguCd,
            category = view.category,
            cat1 = view.cat1,
            cat2 = view.cat2,
            cat3 = view.cat3,
            lclsSystm1 = view.lclsSystm1,
            lclsSystm2 = view.lclsSystm2,
            lclsSystm3 = view.lclsSystm3,
            contentTypeId = view.contentTypeId,
            copyrightDivCd = view.copyrightDivCd,
            thumbnailUrl = view.thumbnailUrl,
            mapLevel = view.mapLevel,
            sourceCreatedAt = view.sourceCreatedAt,
            latitude = view.latitude,
            longitude = view.longitude,
            imageUrl = view.imageUrl,
            tel = view.tel,
            overview = view.overview,
            introRaw = view.introRaw,
            useTime = view.useTime,
            restDate = view.restDate,
            useFee = view.useFee,
            parking = view.parking,
            parkingFee = view.parkingFee,
            infoCenter = view.infoCenter,
            introSyncedAt = view.introSyncedAt,
            petAcmpyType = view.petAcmpyType,
            petRaw = view.petRaw,
            petSyncedAt = view.petSyncedAt,
            setting = view.setting,
            imagesRaw = view.imagesRaw,
            infoRaw = view.infoRaw,
            extraSyncedAt = view.extraSyncedAt,
            eventStartDate = view.eventStartDate,
            eventEndDate = view.eventEndDate,
            listRaw = view.listRaw,
            googlePlaceId = view.googlePlaceId,
            sourceModifiedAt = view.sourceModifiedAt,
            contentUpdatedAt = view.contentUpdatedAt,
            status = view.status,
        )
    }
}

/**
 * [nextAfterId] 는 키셋 요청(`afterId`)에서만 채운다. 키셋 응답은 count 쿼리를 하지 않으므로 전체 건수·쪽수를 모른다 —
 * 세 수를 -1 로 둔다. 필드를 빼거나 null 로 바꾸면 이 모양을 non-null 로 읽는 기존 호출자가 깨진다.
 */
data class AttractionPageResponse(
    val attractions: List<AttractionResponse>,
    val totalElements: Long,
    val totalPages: Int,
    val currentPage: Int,
    val nextAfterId: Long? = null,
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
