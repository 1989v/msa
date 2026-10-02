package com.kgd.search.infrastructure.indexing

import com.fasterxml.jackson.annotation.JsonFormat
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonInclude
import com.kgd.search.domain.attraction.model.AttractionAttributeCodes
import com.kgd.search.domain.attraction.model.AttractionClickSignal
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.Jamo
import java.time.LocalDate
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
    /** 원천 분류체계 코드. `category` 가 접기 전의 원본이라 필터 축으로 쓴다. */
    val lclsSystm1: String? = null,
    val lclsSystm2: String? = null,
    val lclsSystm3: String? = null,
    /** 12 = 관광지. 질의 의도를 코드로 옮기는 가장 정확한 축이다. */
    val contentTypeId: String? = null,
    /** 반려동물 동반 여부 (원천 `acmpyTypeCd`). 테마 필터 축 — 값 그대로 term 으로 건다. */
    val petAcmpyType: String? = null,
    /** 주로 즐기는 곳 — indoor · outdoor · mixed (place 파생 값). 질의 이해가 term 으로 건다. */
    val setting: String? = null,
    val imageUrl: String? = null,
    /** 대표 이미지 썸네일 — 표시 전용이라 색인하지 않는다 (mapping: index=false). */
    val thumbnailUrl: String? = null,
    val tel: String? = null,
    val overview: String? = null,
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
    /** 구글맵 딥링크용 place_id — 표시 전용이라 색인하지 않는다 (mapping: index=false). */
    val googlePlaceId: String? = null,
    /** 완결성 기반 브라우즈 정렬 신호 — 도메인이 계산한다 (AttractionPopularity). */
    val popularityScore: Double,
    /**
     * 문서 벡터 (ADR-0090). 원본은 place `attraction_embedding` 이고, 재색인이 옮겨 싣는다.
     * 벡터가 없는 문서는 이 셋이 비고 BM25 로만 찾힌다 — 벡터 레그는 있는 문서만 태운다.
     *
     * **`_source` 에 그대로 둔다.** 원본이 DB 라 빼도 될 것 같지만, 매핑 `_source.excludes` 로 빼면
     * 인덱스가 3.4배 커진다(플러그인이 벡터를 다른 형태로 다시 저장한다 — 플랜 §8.4 실측).
     * 응답에서 빼는 것은 질의의 `_source.excludes` 가 한다.
     */
    val embedding: List<Float>? = null,
    /** 그 벡터를 만든 스탬프. 설정과 다르면 질의 경로가 벡터 레그를 끈다(스탬프 전환 창 안전). */
    val embeddingModel: String? = null,
    /** 어느 임베딩 텍스트로 만든 벡터인지 — 추적용이라 검색하지 않는다(mapping: index=false). */
    val embeddingHash: String? = null,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    val modifiedAt: LocalDateTime? = null,
    /*
     * 방문 속성 — 원문(restDate·parking·useFee·petAcmpyType·introRaw)에서 뽑은 파생 값이고 원문은 위에 그대로 있다.
     * 값을 모르면 UNKNOWN 을 **싣는다**. 비워 두면 「정보 없음」과 「아직 계산 안 함」이 구분되지 않는다.
     */
    /** ALWAYS_OPEN · WEEKLY · NO_WEEKLY · UNKNOWN ([com.kgd.search.domain.attraction.model.ClosureState]). */
    val closureState: String,
    /** WEEKLY 일 때만 MON..SUN. */
    val closedWeekdays: List<String>? = null,
    /** YES · NO · UNKNOWN */
    val attrParking: String,
    val attrCreditCard: String,
    val attrStrollerRental: String,
    /** ALLOWED · PARTIAL · UNKNOWN */
    val petPolicy: String,
    /** FREE · PAID · UNKNOWN */
    val attrAdmission: String,
    /** 이 값을 만든 해석 규칙의 판 — 규칙을 고친 뒤 옛 판으로 남은 문서를 찾는 데 쓴다. */
    val attributeParserVersion: Int,
    /*
     * 지역 안 위치 — 상세 표시 전용이라 색인하지 않는다(mapping: index=false · enabled=false).
     * 시군구 코드나 유형이 없는 문서는 다섯 필드가 모두 빈다.
     */
    val sigunguName: String? = null,
    val regionTypeCount: Int? = null,
    val regionCategoryCount: Int? = null,
    val lclsSystm3Name: String? = null,
    val sameCategoryNearby: List<Nearby>? = null,
    /** 다른 시도의 비슷한 곳 — 표시 전용(mapping: enabled=false). 목록이 없으면 필드가 빈다. */
    val similarElsewhere: List<Similar>? = null,
    /** 최근 14일 고유 클릭 방문자 수 — 상세 배지 표시용(mapping: index=false). 신호를 못 읽은 회차면 빈다. */
    val uniqueClickers14d: Int? = null,
    /**
     * 순위 계수 — 키워드 레그 점수 함수가 곱한다(스위치 기본 꺼짐). 상한·최소 표본은 fvf 로 못 걸어
     * 재색인이 미리 계산한다([com.kgd.search.domain.attraction.model.AttractionClickSignal]). 신호가 없으면 1.0.
     */
    val clickBoost: Double,
    /**
     * 행사 유효 기간 ([com.kgd.search.domain.attraction.model.EventSchedule.effectivePeriod]) — 행사 필터의 범위 질의가
     * 이 둘만 본다. 원천 날짜는 place 컬럼에 그대로 있다. 행사가 아니거나 날짜가 없으면(UNKNOWN) 둘 다 빈다.
     */
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    val eventStartEffective: LocalDate? = null,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    val eventEndEffective: LocalDate? = null,
    /** 여행코스 구성 지점(순서대로) — 표시 전용(mapping: enabled=false). 코스가 아니거나 원문을 못 읽었으면 빈다. */
    val courseStops: List<CourseStopEntry>? = null,
) {
    /** OpenSearch geo_point object 표기 — 필드명 lat/lon 고정. */

    /** 재색인이 place 에서 받아 오는 벡터 한 벌. 세 필드가 **함께** 채워지거나 함께 빈다. */
    data class Embedding(val vector: List<Float>, val modelRef: String, val textHash: String)

    /** 같은 시군구·유형·분류의 가까운 곳 한 건. */
    data class Nearby(
        val id: String,
        val title: String,
        val distanceMeters: Int,
        /** 항목이 행사일 때의 유효 종료일 — 렌더·화면이 재색인 뒤 끝난 항목을 거른다. */
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
        val eventEndEffective: LocalDate? = null,
    )

    /** 다른 시도의 비슷한 곳 한 건. */
    data class Similar(
        val id: String,
        val title: String,
        val sidoName: String? = null,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
        val eventEndEffective: LocalDate? = null,
    )

    /** 코스 구성 지점 한 건. [attractionId] 는 같은 언어 관광지가 있을 때만 — 없으면 이름만 그린다. */
    data class CourseStopEntry(val order: Int, val contentId: String? = null, val name: String, val attractionId: Long? = null)

    companion object {
        /** 속성은 재색인이 계산해 [AttractionDocument.attributes] 로 넘긴다 — 없으면 UNKNOWN 을 싣지 못하므로 거부한다. */
        fun fromDomain(doc: AttractionDocument, embedding: Embedding? = null): AttractionIndexDocument {
            val attributes = requireNotNull(doc.attributes) { "속성을 계산하지 않은 문서는 색인하지 않는다: ${doc.id}" }
            val region = doc.region
            return AttractionIndexDocument(
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
                lclsSystm1 = doc.lclsSystm1,
                lclsSystm2 = doc.lclsSystm2,
                lclsSystm3 = doc.lclsSystm3,
                contentTypeId = doc.contentTypeId,
                petAcmpyType = doc.petAcmpyType,
                setting = doc.setting,
                imageUrl = doc.imageUrl,
                thumbnailUrl = doc.thumbnailUrl,
                tel = doc.tel,
                overview = doc.overview,
                useTime = doc.useTime,
                restDate = doc.restDate,
                useFee = doc.useFee,
                parking = doc.parking,
                parkingFee = doc.parkingFee,
                infoCenter = doc.infoCenter,
                introRaw = doc.introRaw,
                imagesRaw = doc.imagesRaw,
                infoRaw = doc.infoRaw,
                sidoName = doc.sidoName,
                links = doc.links,
                googlePlaceId = doc.googlePlaceId,
                popularityScore = doc.popularityScore,
                embedding = embedding?.vector,
                embeddingModel = embedding?.modelRef,
                embeddingHash = embedding?.textHash,
                modifiedAt = doc.modifiedAt,
                closureState = AttractionAttributeCodes.closureState(attributes.regularClosure).name,
                closedWeekdays = AttractionAttributeCodes.closedWeekdays(attributes.regularClosure),
                attrParking = attributes.parking.name,
                attrCreditCard = attributes.creditCard.name,
                attrStrollerRental = attributes.strollerRental.name,
                petPolicy = attributes.petPolicy.name,
                attrAdmission = attributes.freeAdmission.name,
                attributeParserVersion = attributes.parserVersion,
                sigunguName = region?.sigunguName,
                regionTypeCount = region?.typeCount,
                regionCategoryCount = region?.categoryCount,
                lclsSystm3Name = region?.categoryName,
                sameCategoryNearby = region?.sameCategoryNearby?.map { Nearby(it.id, it.title, it.distanceMeters, it.eventEndEffective) },
                similarElsewhere = doc.similarElsewhere?.takeIf { it.isNotEmpty() }
                    ?.map { Similar(it.id, it.title, it.sidoName, it.eventEndEffective) },
                uniqueClickers14d = doc.uniqueClickers14d,
                clickBoost = AttractionClickSignal.boost(doc.uniqueClickers14d),
                eventStartEffective = doc.eventPeriod?.start,
                eventEndEffective = doc.eventPeriod?.end,
                courseStops = doc.courseStops?.takeIf { it.isNotEmpty() }
                    ?.map { CourseStopEntry(it.order, it.contentId, it.name, it.attractionId) },
            )
        }
    }
}
