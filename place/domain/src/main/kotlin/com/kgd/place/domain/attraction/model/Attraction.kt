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
    var ldongRegnCd: String? = null,
    var ldongSignguCd: String? = null,
    var category: String? = null,
    var cat1: String? = null,
    var cat2: String? = null,
    var cat3: String? = null,
    var lclsSystm1: String? = null,
    var lclsSystm2: String? = null,
    var lclsSystm3: String? = null,
    var contentTypeId: String? = null,
    var copyrightDivCd: String? = null,
    var thumbnailUrl: String? = null,
    var mapLevel: Int? = null,
    var zipcode: String? = null,
    var sourceCreatedAt: LocalDateTime? = null,
    var latitude: Double,
    var longitude: Double,
    var imageUrl: String? = null,
    var tel: String? = null,
    var overview: String? = null,
    var sourceModifiedAt: LocalDateTime? = null,
    var status: String = "ACTIVE",
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    /**
     * 표시명 — 원천 [title] 에서 꼬리 한글 괄호를 뗀 파생 값 ([AttractionTitle]).
     * 저장 시점마다 title 로부터 다시 계산되므로 전체 동기화가 돌아도 어긋날 수 없다.
     */
    val titleDisplay: String get() = AttractionTitle.parse(title).display

    /** 꼬리 괄호의 다른 표기 — 영문 행은 국문명, 국문 행은 지역 구분자. 없으면 null. */
    val titleLocal: String? get() = AttractionTitle.parse(title).local

    companion object {
        val SUPPORTED_LANGS = setOf("ko", "en")

        /**
         * 관광 성격의 분류. 지역 드릴다운의 건수는 이것만 센다 (ADR-0071) —
         * 적재의 62% 가 음식·쇼핑이라 다 세면 "제주 12,000곳" 같은 수가 나와 기대와 어긋난다.
         */
        val SIGHT_CATEGORIES = setOf("nature", "history", "culture", "leisure")

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
            ldongRegnCd: String? = null,
            ldongSignguCd: String? = null,
            category: String? = null,
            cat1: String? = null,
            cat2: String? = null,
            cat3: String? = null,
            lclsSystm1: String? = null,
            lclsSystm2: String? = null,
            lclsSystm3: String? = null,
            contentTypeId: String? = null,
            copyrightDivCd: String? = null,
            thumbnailUrl: String? = null,
            mapLevel: Int? = null,
            zipcode: String? = null,
            sourceCreatedAt: LocalDateTime? = null,
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
                ldongRegnCd = ldongRegnCd?.takeIf { it.isNotBlank() },
                ldongSignguCd = ldongSignguCd?.takeIf { it.isNotBlank() },
                category = category?.takeIf { it.isNotBlank() },
                cat1 = cat1?.takeIf { it.isNotBlank() },
                cat2 = cat2?.takeIf { it.isNotBlank() },
                cat3 = cat3?.takeIf { it.isNotBlank() },
                lclsSystm1 = lclsSystm1?.takeIf { it.isNotBlank() },
                lclsSystm2 = lclsSystm2?.takeIf { it.isNotBlank() },
                lclsSystm3 = lclsSystm3?.takeIf { it.isNotBlank() },
                contentTypeId = contentTypeId?.takeIf { it.isNotBlank() },
                copyrightDivCd = copyrightDivCd?.takeIf { it.isNotBlank() },
                thumbnailUrl = thumbnailUrl?.takeIf { it.isNotBlank() },
                mapLevel = mapLevel,
                zipcode = zipcode?.takeIf { it.isNotBlank() },
                sourceCreatedAt = sourceCreatedAt,
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
            ldongRegnCd: String?,
            ldongSignguCd: String?,
            category: String?,
            cat1: String?,
            cat2: String?,
            cat3: String?,
            lclsSystm1: String?,
            lclsSystm2: String?,
            lclsSystm3: String?,
            contentTypeId: String?,
            copyrightDivCd: String?,
            thumbnailUrl: String?,
            mapLevel: Int?,
            zipcode: String?,
            sourceCreatedAt: LocalDateTime?,
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
        // 법정동 코드는 목록 원천이 주는 값이라 구 코드와 같이 최신값으로 덮는다.
        // 개요처럼 보존해야 하는 보강 필드가 아니다 (ADR-0071).
        ldongRegnCd = source.ldongRegnCd
        ldongSignguCd = source.ldongSignguCd
        category = source.category
        cat1 = source.cat1
        cat2 = source.cat2
        cat3 = source.cat3
        /*
         * 원천이 주는 값은 **가공 없이 그대로** 최신값으로 덮는다 (ADR-0065).
         * 화면용 그루핑은 아래 category 가 따로 들고 있어, 그루핑 규칙을 바꿔도
         * 원천 재호출 없이 이 컬럼들로 다시 계산할 수 있다.
         */
        lclsSystm1 = source.lclsSystm1
        lclsSystm2 = source.lclsSystm2
        lclsSystm3 = source.lclsSystm3
        contentTypeId = source.contentTypeId
        copyrightDivCd = source.copyrightDivCd
        thumbnailUrl = source.thumbnailUrl
        mapLevel = source.mapLevel
        zipcode = source.zipcode
        sourceCreatedAt = source.sourceCreatedAt
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
