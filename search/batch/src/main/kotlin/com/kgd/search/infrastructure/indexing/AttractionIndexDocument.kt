package com.kgd.search.infrastructure.indexing

import com.fasterxml.jackson.annotation.JsonFormat
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonInclude
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.Jamo
import java.time.LocalDateTime

/**
 * `attractions` 인덱스 색인 문서 (ADR-0065 — jackson 직렬화).
 * 필드 타입/분석기 정의는 `opensearch/attractions-index.json` 이 SSOT.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
data class AttractionIndexDocument(
    val id: String,
    val contentId: String,
    val lang: String,
    val title: String,
    /**
     * 자모로 편 이름 (ADR-0065 P2 후속). 조합 중간 상태("경보")로도 자동완성이 맞게 한다.
     * 분해 규칙은 질의 쪽과 **같은 [Jamo]** 를 쓴다 — 한쪽만 바뀌면 조용히 아무것도 안 맞는다.
     */
    val titleJamo: String,
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
    val popularity: Long = 0,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    val modifiedAt: LocalDateTime? = null,
) {
    /** OpenSearch geo_point object 표기 — 필드명 lat/lon 고정. */
    data class GeoPoint(val lat: Double, val lon: Double)

    companion object {
        fun fromDomain(doc: AttractionDocument) = AttractionIndexDocument(
            id = doc.id,
            contentId = doc.contentId,
            lang = doc.lang,
            title = doc.title,
            titleJamo = Jamo.decompose(doc.title),
            location = GeoPoint(lat = doc.latitude, lon = doc.longitude),
            address = doc.address,
            areaCode = doc.areaCode,
            sigunguCode = doc.sigunguCode,
            ldongRegnCd = doc.ldongRegnCd,
            ldongSignguCd = doc.ldongSignguCd,
            category = doc.category,
            imageUrl = doc.imageUrl,
            tel = doc.tel,
            overview = doc.overview,
            popularity = doc.popularity,
            modifiedAt = doc.modifiedAt,
        )
    }
}
