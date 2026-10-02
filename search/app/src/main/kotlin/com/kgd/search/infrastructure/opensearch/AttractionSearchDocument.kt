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
import com.kgd.search.domain.attraction.model.BarrierFreeInfo
import com.kgd.search.domain.attraction.model.CongestionDay
import com.kgd.search.domain.attraction.model.CourseStop
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.model.NearbyPlace
import com.kgd.search.domain.attraction.model.PetPolicy
import com.kgd.search.domain.attraction.model.SimilarPlace
import com.kgd.search.domain.attraction.model.WellnessTheme
import java.time.LocalDate
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
    /** 14일 고유 클릭 방문자 수 — 상세 「많이 클릭한 곳」 배지용. 신호를 못 읽은 회차·옛 문서는 없다. */
    val uniqueClickers14d: Int? = null,
    /** 행사 유효 기간 — 재색인이 정규화해 싣는다. 행사가 아니거나 날짜가 없으면(UNKNOWN) 둘 다 없다. */
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    val eventStartEffective: LocalDate? = null,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    val eventEndEffective: LocalDate? = null,
    /** 여행코스 구성 지점(순서대로). 코스가 아니거나 원문을 못 읽은 회차면 없다. */
    val courseStops: List<CourseStopEntry>? = null,
    /** 무장애 긍정 코드 · 원천 문장 — 상세 「무장애 정보」 절과 목록 필터가 읽는다. 정보 없는 곳·옛 문서는 없다. */
    val barrierFree: List<String>? = null,
    val barrierFreeDetail: Map<String, String>? = null,
    /** 웰니스 테마 코드·이름. 웰니스 목록에 없는 곳·옛 문서는 없다. */
    val wellnessTheme: String? = null,
    val wellnessThemeName: String? = null,
    /** 집중률 앞 30일 — 상세 「혼잡 예측」이 읽는다. 이름 매칭이 안 된 곳·옛 문서는 없다. */
    val congestion: List<CongestionEntry>? = null,
) {
    /** [eventEndEffective] 는 항목이 행사일 때의 유효 종료일 — 이 필드가 생기기 전 문서에는 없다. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    data class Nearby(
        val id: String,
        val title: String,
        val distanceMeters: Int,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
        val eventEndEffective: LocalDate? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class Similar(
        val id: String,
        val title: String,
        val sidoName: String? = null,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
        val eventEndEffective: LocalDate? = null,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class CongestionEntry(
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
        val date: LocalDate,
        val rate: Double,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    data class CourseStopEntry(val order: Int, val contentId: String? = null, val name: String, val attractionId: Long? = null)

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
            sameCategoryNearby = sameCategoryNearby.orEmpty()
                .map { NearbyPlace(it.id, it.title, it.distanceMeters, it.eventEndEffective) },
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
        similarElsewhere = similarElsewhere?.map { SimilarPlace(it.id, it.title, it.sidoName, it.eventEndEffective) },
        uniqueClickers14d = uniqueClickers14d,
        // 재색인이 이미 정규화한 값이라 같은 함수에 다시 넣어도 (s, e) 그대로다. 한쪽만 있는 문서는 생기지 않는다.
        eventPeriod = EventSchedule.effectivePeriod(eventStartEffective, eventEndEffective),
        courseStops = courseStops?.map { CourseStop(it.order, it.contentId, it.name, it.attractionId) },
        // 상세 문장이 하나도 없고 코드도 없으면 정보가 없는 것이다 — 빈 객체를 만들지 않는다
        barrierFree = if (barrierFree.isNullOrEmpty() && barrierFreeDetail.isNullOrEmpty()) {
            null
        } else {
            BarrierFreeInfo(barrierFree.orEmpty(), BarrierFreeInfo.detailOf(barrierFreeDetail.orEmpty()))
        },
        wellness = wellnessTheme?.let { WellnessTheme(it, wellnessThemeName) },
        congestion = congestion?.takeIf { it.isNotEmpty() }?.map { CongestionDay(it.date, it.rate) },
    )
}
