package com.kgd.search.infrastructure.opensearch

import com.fasterxml.jackson.annotation.JsonFormat
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.kgd.search.domain.attraction.model.Admission
import com.kgd.search.domain.attraction.model.AttractionAttributeCodes
import com.kgd.search.domain.attraction.model.AttractionAttributeCodes.enumOrNull
import com.kgd.search.domain.attraction.model.AttractionAttributes
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionRegion
import com.kgd.search.domain.attraction.model.Availability
import com.kgd.search.domain.attraction.model.NearbyPlace
import com.kgd.search.domain.attraction.model.PetPolicy
import com.kgd.search.domain.attraction.model.SimilarPlace
import java.time.LocalDateTime

/**
 * `attractions` 인덱스 문서 (ADR-0065 — jackson 직렬화).
 * 필드 타입/분석기 정의는 batch 의 `opensearch/attractions-index.json` 이 SSOT.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class AttractionSearchDocument(
    val id: String,
    val contentId: String,
    val lang: String,
    val title: String,
    val titleLocal: String? = null,
    val location: GeoPoint,
    val address: String? = null,
    val areaCode: String? = null,
    val sigunguCode: String? = null,
    val ldongRegnCd: String? = null,
    val ldongSignguCd: String? = null,
    val category: String? = null,
    /** 원천 관광 유형 — 상세 지역 문구 「{시군구} {유형} N곳 중 …」 이 쓴다. 없으면 화면이 문구를 짐작하지 않는다. */
    val contentTypeId: String? = null,
    val imageUrl: String? = null,
    /** 재색인 전 옛 인덱스 문서에는 없다 — null 이면 FE 가 imageUrl 을 쓴다. */
    val thumbnailUrl: String? = null,
    val tel: String? = null,
    val overview: String? = null,
    /** 재색인 전 옛 인덱스 문서에는 없다 — null 이면 FE 가 좌표/주소 링크로 폴백한다. */
    val useTime: String? = null,
    val restDate: String? = null,
    val useFee: String? = null,
    val parking: String? = null,
    val parkingFee: String? = null,
    val infoCenter: String? = null,
    val introRaw: String? = null,
    val imagesRaw: String? = null,
    val infoRaw: String? = null,
    val sidoName: String? = null,
    val links: String? = null,
    val googlePlaceId: String? = null,
    /** 재색인 전 옛 인덱스 문서에는 없다 — 기본값 1.0(공식의 base)으로 중립 처리. */
    val popularityScore: Double = 1.0,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    val modifiedAt: LocalDateTime? = null,
    /*
     * 방문 속성·지역 안 위치 — 재색인 전 옛 인덱스 문서에는 없다. 그때는 도메인 값이 null 로 남아
     * 「모두 UNKNOWN」과 구별된다. 표기는 [AttractionAttributeCodes] 가 정한다.
     */
    val closureState: String? = null,
    val closedWeekdays: List<String>? = null,
    val attrParking: String? = null,
    val attrCreditCard: String? = null,
    val attrStrollerRental: String? = null,
    val petPolicy: String? = null,
    val attrAdmission: String? = null,
    val attributeParserVersion: Int? = null,
    val sigunguName: String? = null,
    val regionTypeCount: Int? = null,
    val regionCategoryCount: Int? = null,
    val lclsSystm3Name: String? = null,
    val sameCategoryNearby: List<Nearby>? = null,
    val similarElsewhere: List<Similar>? = null,
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    data class Nearby(val id: String, val title: String, val distanceMeters: Int)

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class Similar(val id: String, val title: String, val sidoName: String? = null)

    // 속성 필드는 재색인이 한 벌로 싣는다 — closureState 가 있으면 나머지도 있다.
    private fun attributes(): AttractionAttributes? = closureState?.let { state ->
        AttractionAttributes(
            regularClosure = AttractionAttributeCodes.regularClosure(state, closedWeekdays),
            parking = enumOrNull<Availability>(attrParking) ?: Availability.UNKNOWN,
            petPolicy = enumOrNull<PetPolicy>(petPolicy) ?: PetPolicy.UNKNOWN,
            creditCard = enumOrNull<Availability>(attrCreditCard) ?: Availability.UNKNOWN,
            strollerRental = enumOrNull<Availability>(attrStrollerRental) ?: Availability.UNKNOWN,
            freeAdmission = enumOrNull<Admission>(attrAdmission) ?: Admission.UNKNOWN,
            parserVersion = attributeParserVersion ?: 0,
        )
    }

    private fun region(): AttractionRegion? = regionTypeCount?.let { typeCount ->
        AttractionRegion(
            sigunguName = sigunguName,
            typeCount = typeCount,
            categoryCount = regionCategoryCount,
            categoryName = lclsSystm3Name,
            sameCategoryNearby = sameCategoryNearby.orEmpty().map { NearbyPlace(it.id, it.title, it.distanceMeters) },
        )
    }


    fun toDomain(): AttractionDocument = AttractionDocument(
        id = id,
        contentId = contentId,
        lang = lang,
        title = title,
        titleLocal = titleLocal,
        latitude = location.lat,
        longitude = location.lon,
        address = address,
        areaCode = areaCode,
        sigunguCode = sigunguCode,
        ldongRegnCd = ldongRegnCd,
        ldongSignguCd = ldongSignguCd,
        category = category,
        contentTypeId = contentTypeId,
        imageUrl = imageUrl,
        thumbnailUrl = thumbnailUrl,
        tel = tel,
        overview = overview,
        useTime = useTime,
        restDate = restDate,
        useFee = useFee,
        parking = parking,
        parkingFee = parkingFee,
        infoCenter = infoCenter,
        introRaw = introRaw,
        imagesRaw = imagesRaw,
        infoRaw = infoRaw,
        sidoName = sidoName,
        links = links,
        googlePlaceId = googlePlaceId,
        popularityScore = popularityScore,
        modifiedAt = modifiedAt,
        attributes = attributes(),
        region = region(),
        similarElsewhere = similarElsewhere?.map { SimilarPlace(it.id, it.title, it.sidoName) },
    )
}
