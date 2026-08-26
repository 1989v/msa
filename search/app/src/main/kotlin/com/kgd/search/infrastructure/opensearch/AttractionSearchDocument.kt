package com.kgd.search.infrastructure.opensearch

import com.fasterxml.jackson.annotation.JsonFormat
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.kgd.search.domain.attraction.model.AttractionDocument
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
    val imageUrl: String? = null,
    val tel: String? = null,
    val overview: String? = null,
    /** 재색인 전 옛 인덱스 문서에는 없다 — null 이면 FE 가 좌표/주소 링크로 폴백한다. */
    val googlePlaceId: String? = null,
    /** 재색인 전 옛 인덱스 문서에는 없다 — 기본값 1.0(공식의 base)으로 중립 처리. */
    val popularityScore: Double = 1.0,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    val modifiedAt: LocalDateTime? = null,
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    data class GeoPoint(val lat: Double = 0.0, val lon: Double = 0.0)

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
        imageUrl = imageUrl,
        tel = tel,
        overview = overview,
        googlePlaceId = googlePlaceId,
        popularityScore = popularityScore,
        modifiedAt = modifiedAt,
    )
}
