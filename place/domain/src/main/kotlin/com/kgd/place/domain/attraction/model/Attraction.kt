package com.kgd.place.domain.attraction.model

import java.time.LocalDateTime

/**
 * 관광지 — MySQL SSOT, OpenSearch(attractions 인덱스)는 search-batch 가 일괄 재색인 (ADR-0065).
 * 출처: 한국관광공사 TourAPI 4.0 (KorService2 국문 / EngService2 영문).
 * 국문·영문은 TourAPI contentId 체계가 달라 언어별 별도 레코드로 적재한다 — (contentId, lang) 이 자연키.
 */
class Attraction private constructor(
    val id: Long? = null,
    val contentId: String,
    val lang: String,
    var title: String,
    var address: String? = null,
    var areaCode: String? = null,
    var sigunguCode: String? = null,
    var category: String? = null,
    var cat1: String? = null,
    var cat2: String? = null,
    var cat3: String? = null,
    var latitude: Double,
    var longitude: Double,
    var imageUrl: String? = null,
    var tel: String? = null,
    var overview: String? = null,
    var sourceModifiedAt: LocalDateTime? = null,
    var status: String = "ACTIVE",
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    companion object {
        val SUPPORTED_LANGS = setOf("ko", "en")

        @Suppress("LongParameterList")
        fun create(
            contentId: String,
            lang: String,
            title: String,
            latitude: Double,
            longitude: Double,
            address: String? = null,
            areaCode: String? = null,
            sigunguCode: String? = null,
            category: String? = null,
            cat1: String? = null,
            cat2: String? = null,
            cat3: String? = null,
            imageUrl: String? = null,
            tel: String? = null,
            overview: String? = null,
            sourceModifiedAt: LocalDateTime? = null,
        ): Attraction {
            require(contentId.isNotBlank()) { "contentId 는 비어있을 수 없습니다" }
            require(lang in SUPPORTED_LANGS) { "지원하지 않는 언어입니다: $lang (지원: $SUPPORTED_LANGS)" }
            require(title.isNotBlank()) { "관광지명은 비어있을 수 없습니다" }
            require(latitude in -90.0..90.0) { "위도는 -90~90 범위여야 합니다: $latitude" }
            require(longitude in -180.0..180.0) { "경도는 -180~180 범위여야 합니다: $longitude" }
            return Attraction(
                contentId = contentId,
                lang = lang,
                title = title,
                latitude = latitude,
                longitude = longitude,
                address = address?.takeIf { it.isNotBlank() },
                areaCode = areaCode?.takeIf { it.isNotBlank() },
                sigunguCode = sigunguCode?.takeIf { it.isNotBlank() },
                category = category?.takeIf { it.isNotBlank() },
                cat1 = cat1?.takeIf { it.isNotBlank() },
                cat2 = cat2?.takeIf { it.isNotBlank() },
                cat3 = cat3?.takeIf { it.isNotBlank() },
                imageUrl = imageUrl?.takeIf { it.isNotBlank() },
                tel = tel?.takeIf { it.isNotBlank() },
                overview = overview?.takeIf { it.isNotBlank() },
                sourceModifiedAt = sourceModifiedAt,
                status = "ACTIVE",
            )
        }

        @Suppress("LongParameterList")
        fun restore(
            id: Long?,
            contentId: String,
            lang: String,
            title: String,
            address: String?,
            areaCode: String?,
            sigunguCode: String?,
            category: String?,
            cat1: String?,
            cat2: String?,
            cat3: String?,
            latitude: Double,
            longitude: Double,
            imageUrl: String?,
            tel: String?,
            overview: String?,
            sourceModifiedAt: LocalDateTime?,
            status: String,
            createdAt: LocalDateTime,
        ): Attraction = Attraction(
            id = id,
            contentId = contentId,
            lang = lang,
            title = title,
            address = address,
            areaCode = areaCode,
            sigunguCode = sigunguCode,
            category = category,
            cat1 = cat1,
            cat2 = cat2,
            cat3 = cat3,
            latitude = latitude,
            longitude = longitude,
            imageUrl = imageUrl,
            tel = tel,
            overview = overview,
            sourceModifiedAt = sourceModifiedAt,
            status = status,
            createdAt = createdAt,
        )
    }

    /**
     * 재적재(upsert) 시 원천 최신값으로 동기화 — 자연키(contentId, lang)와 id 는 불변 (entity-mutation.md).
     * 목록 원천에 없는 보강 필드(개요)는 덮어쓰지 않는다.
     */
    fun syncFrom(source: Attraction) {
        require(source.contentId == contentId && source.lang == lang) {
            "자연키가 다른 관광지로 동기화할 수 없습니다: ${source.contentId}/${source.lang} → $contentId/$lang"
        }
        title = source.title
        address = source.address
        areaCode = source.areaCode
        sigunguCode = source.sigunguCode
        category = source.category
        cat1 = source.cat1
        cat2 = source.cat2
        cat3 = source.cat3
        latitude = source.latitude
        longitude = source.longitude
        imageUrl = source.imageUrl
        tel = source.tel
        /*
         * 개요는 목록 조회에 없다 — 건당 1콜인 상세 조회로만 채워지는 **보강 필드**다.
         * 목록 동기화가 통째로 덮어쓰면 며칠에 걸쳐 모은 개요가 한 번에 지워진다
         * (실제로 그렇게 300건을 잃었다). 들어온 값이 있을 때만 갱신한다.
         */
        overview = source.overview ?: overview
        sourceModifiedAt = source.sourceModifiedAt
        status = source.status
    }
}
