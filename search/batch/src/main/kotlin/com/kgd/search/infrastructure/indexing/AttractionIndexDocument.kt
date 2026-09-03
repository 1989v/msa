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
    /** 숫자 정렬용 id — keyword `id` 로 정렬하면 "1","10","100" 사전순이 된다 (tiebreaker). */
    val idSort: Long,
    val contentId: String,
    val lang: String,
    val title: String,
    /** 원천 제목 꼬리 괄호의 다른 표기 (영문 문서: 국문명) — nori 색인해 국문 질의로 찾는다. */
    val titleLocal: String? = null,
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
    /** 대표 이미지 썸네일 — 표시 전용이라 색인하지 않는다 (mapping: index=false). */
    val thumbnailUrl: String? = null,
    val tel: String? = null,
    val overview: String? = null,
    /** 구글맵 딥링크용 place_id — 표시 전용이라 색인하지 않는다 (mapping: index=false). */
    val googlePlaceId: String? = null,
    /** 완결성 기반 브라우즈 정렬 신호 — 도메인이 계산한다 (AttractionPopularity). */
    val popularityScore: Double,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    val modifiedAt: LocalDateTime? = null,
) {
    /** OpenSearch geo_point object 표기 — 필드명 lat/lon 고정. */

    companion object {
        fun fromDomain(doc: AttractionDocument) = AttractionIndexDocument(
            id = doc.id,
            idSort = doc.id.toLongOrNull() ?: 0L,
            contentId = doc.contentId,
            lang = doc.lang,
            title = doc.title,
            titleLocal = doc.titleLocal,
            titleJamo = Jamo.decompose(doc.title),
            location = GeoPoint(lat = doc.latitude, lon = doc.longitude),
            address = doc.address,
            areaCode = doc.areaCode,
            sigunguCode = doc.sigunguCode,
            ldongRegnCd = doc.ldongRegnCd,
            ldongSignguCd = doc.ldongSignguCd,
            category = doc.category,
            imageUrl = doc.imageUrl,
            thumbnailUrl = doc.thumbnailUrl,
            tel = doc.tel,
            overview = doc.overview,
            googlePlaceId = doc.googlePlaceId,
            popularityScore = doc.popularityScore,
            modifiedAt = doc.modifiedAt,
        )
    }
}
