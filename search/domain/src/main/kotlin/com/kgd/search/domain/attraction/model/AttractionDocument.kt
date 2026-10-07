package com.kgd.search.domain.attraction.model

import java.time.LocalDateTime

/**
 * 관광지 검색 읽기 모델 (ADR-0065). SSOT 는 place 서비스 MySQL — search-batch 가 일괄 재색인.
 * 국문/영문은 언어별 별도 문서(lang)로 색인한다.
 */
data class AttractionDocument(
    val id: String,
    val contentId: String,
    val lang: String,
    /** 표시명 — place 의 titleDisplay. 원천 제목의 꼬리 괄호 표기는 [titleLocal] 로 분리됐다. */
    val title: String,
    /** 꼬리 괄호의 다른 표기 — 영문 문서는 국문명. 국문 질의가 영문 문서를 찾는 리콜 축이다. */
    val titleLocal: String? = null,
    val latitude: Double,
    val longitude: Double,
    val address: String? = null,
    val areaCode: String? = null,
    val sigunguCode: String? = null,
    /** 법정동 시도/시군구 코드 — 지역 드릴다운의 축 (ADR-0071).
     *  `areaCode`/`sigunguCode` 는 두 코드 체계가 섞여 있어 필터 축으로 쓰지 않는다. */
    val ldongRegnCd: String? = null,
    val ldongSignguCd: String? = null,
    val category: String? = null,
    /**
     * 원천 분류체계 (TourAPI). `category` 는 이것을 6종으로 접은 **파생**이고, 원본은 이쪽이다.
     * 접는 과정에서 `VE`(문화관광)가 culture/nature 로 갈리는 식의 손실이 있어 필터 축으로는 원본을 쓴다.
     * 이름은 place `attraction_category_codes` 가 갖고 있다.
     */
    val lclsSystm1: String? = null,
    val lclsSystm2: String? = null,
    val lclsSystm3: String? = null,
    /** 원천이 매긴 관광 유형 — 12 가 곧 「관광지」다. 질의 의도를 코드로 옮길 때 쓴다. */
    val contentTypeId: String? = null,
    /** 반려동물 동반 여부 (원천 `acmpyTypeCd`). 테마 필터 축 — 값 그대로 term 으로 건다. */
    val petAcmpyType: String? = null,
    /** 주로 즐기는 곳 — indoor · outdoor · mixed (place 파생 값). 「실내」·「비 오는 날」 질의의 필터 축. */
    val setting: String? = null,
    val imageUrl: String? = null,
    /** 대표 이미지 썸네일(원천 firstimage2, 150×100). 카드 얼굴처럼 작은 자리는 원본(약 500KB) 대신 이것을 쓴다. */
    val thumbnailUrl: String? = null,
    val tel: String? = null,
    val overview: String? = null,
    /** 구글맵 딥링크용 Google Places place_id — 검색 조건이 아니라 상세 표시물이다. */
    val useTime: String? = null,
    val restDate: String? = null,
    val useFee: String? = null,
    val parking: String? = null,
    val parkingFee: String? = null,
    val infoCenter: String? = null,
    val introRaw: String? = null,
    /** 부가 사진·반복정보 원문 (TourAPI detailImage2/detailInfo2). 화면 표시용 — 색인하지 않는다. */
    val imagesRaw: String? = null,
    val infoRaw: String? = null,
    /** 시도 이름. 화면이 285행 목록을 받아 코드→이름을 바꾸던 것을 없앤다 (ADR-0095). */
    val sidoName: String? = null,
    /** 외부 링크(수집분 + 조립 딥링크) 원문 JSON. 상세에서 DB 를 안 부르게 한다. */
    val links: String? = null,
    /** 「캠핑장 정보」 — 고캠핑 원문 중 화면에 내는 키만 담은 JSON 객체 문자열(place 가 고른다). 캠핑장이 아니면 null */
    val camping: String? = null,
    val googlePlaceId: String? = null,
    /**
     * 완결성 기반 정렬 신호 — 위 필드들에서 파생한다 ([AttractionPopularity]).
     * 색인 경로는 기본값(계산)을 쓰고, 읽기 경로는 인덱스에 저장된 값을 그대로 넘긴다.
     * 방문자 지표로 바꾸지 않는다 — 방문자 신호는 [uniqueClickers14d] 가 따로 갖고, 이름·의미·사용처가 다르다.
     */
    val popularityScore: Double = AttractionPopularity.score(imageUrl = imageUrl, overview = overview, tel = tel),
    val modifiedAt: LocalDateTime? = null,
    /**
     * 원문에서 뽑은 방문 속성 ([AttractionAttributeParser]). 재색인이 계산해 싣는다.
     * null 은 이 필드가 생기기 전에 색인된 문서다 — 「모두 UNKNOWN」과 다르다.
     */
    val attributes: AttractionAttributes? = null,
    /** 지역 안 위치. 시군구 코드나 유형이 없는 문서는 null. */
    val region: AttractionRegion? = null,
    /** 다른 시도의 비슷한 곳(같은 언어·유형, 임베딩 코사인 순). 목록이 없거나 옛 색인 문서면 null. */
    val similarElsewhere: List<SimilarPlace>? = null,
    /**
     * 최근 14일(KST) 클릭한 고유 방문자 수 ([AttractionClickSignal]). 재색인이 analytics 집계 표에서 읽어 싣는다.
     * null 은 그 회차에 신호를 못 읽었거나 이 필드가 생기기 전 문서다 — 0(읽었는데 클릭 없음)과 다르다.
     */
    val uniqueClickers14d: Int? = null,
    /** 행사(유형 15·85)의 유효 기간 ([EventSchedule.effectivePeriod]). 행사가 아니거나 날짜가 없으면 null(UNKNOWN). */
    val eventPeriod: EventPeriod? = null,
    /** 여행코스(유형 25)의 구성 지점, `subnum` 순서. 코스가 아니거나 원문을 못 읽었으면 null. */
    val courseStops: List<CourseStop>? = null,
    /** 무장애 여행 정보(국문). 상세를 아직 안 받았거나 원천에 없는 곳·옛 색인 문서는 null. */
    val barrierFree: BarrierFreeInfo? = null,
    /** 웰니스관광 테마. 웰니스 목록에 없는 곳·옛 색인 문서는 null. */
    val wellness: WellnessTheme? = null,
    /** 집중률 예측(예측일 순, 국문). 이름 매칭으로 이어지지 않은 곳·옛 색인 문서는 null. */
    val congestion: List<CongestionDay>? = null,
    /** 여기 온 사람들이 함께 간 곳(원천 순위 순, 국문, 최대 [RelatedPlace.MAX]). 이어진 곳이 없거나 옛 색인 문서는 null. */
    val relatedPlaces: List<RelatedPlace>? = null,
    /** 같은 장소의 다른 등록(관광지·쇼핑 등) — 있으면 상세가 「복합공간」으로 알린다. 없거나 옛 색인 문서는 null. */
    val samePlace: List<SamePlace>? = null,
)
