package com.kgd.search.application.attraction.usecase

interface SearchAttractionUseCase {
    fun execute(query: Query): Result

    fun findById(id: String): AttractionSearchResult?

    data class Query(
        val keyword: String? = null,
        val lang: String? = null,
        val areaCode: String? = null,
        /** 법정동 축 (ADR-0071) — 지역 드릴다운이 쓰는 필터. */
        val sidoCode: String? = null,
        val sigunguCode: String? = null,
        /** 쉼표로 여러 개를 받는다 — `history` 도 `nature,history` 도 같은 파라미터다. */
        val category: String? = null,
        val lat: Double? = null,
        val lng: Double? = null,
        val radiusKm: Double? = null,
        /**
         * relevance(기본) | distance | eventStart — distance 는 lat/lng 지정 시에만 유효.
         * eventStart 는 유효 시작일 오름차순(날짜 없음은 뒤, 같으면 id 순)이고 벡터 레그를 쓰지 않는다.
         */
        val sort: String = "relevance",
        val page: Int = 0,
        val size: Int = 20,
        /**
         * 속성 패싯 필터 — **긍정 값만** 필터가 된다. 그 밖의 값(`NO`·`UNKNOWN`·`PAID`·오타)은 오류 없이
         * 무시하고 그 속성은 거르지 않는다. 「정보 없음」이나 부정으로 거르는 길은 두지 않는다.
         */
        val openToday: Boolean = false,
        /** `YES` 만 */
        val parking: String? = null,
        /** `YES` 만 */
        val creditCard: String? = null,
        /** `YES` 만 */
        val strollerRental: String? = null,
        /** 쉼표로 여러 개 — `ALLOWED`·`PARTIAL` 중 하나라도(OR) */
        val pet: String? = null,
        /** `FREE` 만 */
        val admission: String? = null,
        /** 쉼표로 여러 개 — 연 무장애 코드(`WHEELCHAIR`·`ELEVATOR`·`RESTROOM`)만, 코드 사이는 AND. 다른 값은 버린다 */
        val barrierFree: String? = null,
        /** true 면 웰니스 테마가 있는 곳만 */
        val wellness: Boolean = false,
        /** true 면 속성 패싯 건수를 센다(집계 요청 하나 더). 목록 첫 쪽만 보낸다. 필터 적용과는 무관하다. */
        val attributeFacets: Boolean = false,
        /**
         * 행사 상태 필터 `ONGOING`·`WEEKEND`·`UPCOMING`·`THIS_MONTH`·`NOT_ENDED`. 행사가 아닌 문서는 거르지 않는다.
         * 그 밖의 값은 무시한다(조건 없음).
         */
        val eventStatus: String? = null,
        /** true 면 오타 교정을 건너뛰고 받은 검색어 그대로 찾는다(「원래 검색어로 검색」). 응답 `correctedKeyword` 는 null. */
        val exact: Boolean = false,
    )

    data class AttractionSearchResult(
        val id: String,
        val contentId: String,
        val lang: String,
        /** 표시명 — 원천 제목의 꼬리 괄호 표기는 [titleLocal] 로 분리 */
        val title: String,
        /** 다른 표기 (영문 행: 국문명, 국문 행: 지역 구분자). 없으면 null */
        val titleLocal: String? = null,
        val category: String? = null,
        /** TourAPI 유형 코드(12 관광지 · 39 음식점 …). 상세의 「{시군구} {유형} N곳 중 …」 문장이 유형 이름을 여기서 얻는다 — 서버 렌더와 같은 문장을 화면도 그리게. */
        val contentTypeId: String? = null,
        val areaCode: String? = null,
        /**
         * 법정동 시도코드 (ADR-0071 의 지역 축).
         *
         * 응답에 실어야 상세 화면이 breadcrumb 에 지역 단계를 넣을 수 있다. 없던 동안
         * 프리렌더는 `…›서울특별시›경복궁`, 클라이언트는 `…›경복궁` 을 심어 한 페이지에
         * 서로 다른 BreadcrumbList 두 개가 남았다 (2026-09-10 실측).
         * `areaCode` 는 구 TourAPI 체계라 문서의 43% 에서 비어 이 자리에 쓸 수 없다.
         */
        val sidoCode: String? = null,
        val address: String? = null,
        val latitude: Double,
        val longitude: Double,
        val imageUrl: String? = null,
        /** 대표 이미지 썸네일(150×100). 카드 얼굴 같은 작은 자리용 — 없으면 FE 가 imageUrl 을 쓴다. */
        val thumbnailUrl: String? = null,
        val tel: String? = null,
        /**
         * 목록 응답은 TourAPI 원문을 `sourceText` 로 평문화한 뒤 200자로 자른 요약. 이스케이프되지 않은
         * 평문이라 HTML 로 내보내는 쪽이 escape 한다. 정규화 뒤 비면 null. 원문 전문은 단건 조회로.
         */
        val overview: String? = null,
        /** 구글맵 딥링크용 place_id — 없으면 FE 가 주소/좌표 검색 링크로 폴백한다. */
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
        /** 「캠핑장 정보」 — 고캠핑 원문 중 화면에 내는 키만 담은 JSON 객체 문자열. 캠핑장이 아니면 null */
        val camping: String? = null,
        val googlePlaceId: String? = null,
        val distanceKm: Double? = null,
        val position: Int = 0,
        /**
         * 원천 최종 수정일. sitemap 의 `lastmod` 가 이 값을 쓴다 — 없으면 6만 URL 이
         * 갱신 여부를 알릴 방법이 없어 크롤러가 전량을 같은 우선순위로 다시 훑는다.
         */
        val modifiedAt: java.time.LocalDateTime? = null,
        /** 원천 출처(TOURAPI · GOCAMPING …)·공공누리 유형 — 색인 값 그대로. 없으면 null(추정하지 않는다). */
        val source: String? = null,
        val copyrightDivCd: String? = null,
        /** 요금 평문 — 이미 정규화돼 있어 다시 `sourceText` 하지 않는다. 없으면 화면이 useFee 를 쓴다. */
        val feeText: String? = null,
        /** 반려동물 동반 원문 — petPolicy 가 UNKNOWN 일 때 상세가 그대로 보여 준다. */
        val petAcmpyType: String? = null,
        /**
         * 방문 속성 — 색인 표기 그대로(`ALWAYS_OPEN`·`YES`·`FREE` …). 화면 JSON-LD(`copy.mjs`)가 이 이름으로
         * 읽는다. 서버 렌더가 심은 JSON-LD 를 하이드레이션이 이 값으로 다시 쓰므로, 여기 빠지면 구글이 JS 를
         * 실행해 보는 최종 화면에서 영업 요일·무료 여부가 사라진다. 속성이 없던 옛 색인 문서는 null.
         */
        val closureState: String? = null,
        val closedWeekdays: List<String>? = null,
        val attrParking: String? = null,
        val attrCreditCard: String? = null,
        val attrStrollerRental: String? = null,
        val petPolicy: String? = null,
        val attrAdmission: String? = null,
        /** 지역 안 위치 — 단건 조회에만 싣는다(목록 응답을 무겁게 하지 않는다). */
        val region: Region? = null,
        /** 다른 시도의 비슷한 곳 — 단건 조회에만. 목록이 없는 문서는 null. */
        val similarElsewhere: List<Similar>? = null,
        /**
         * 최근 14일 고유 클릭 방문자 수 — 단건 조회에만. 화면은 최소 표본 이상일 때 「많이 클릭한 곳」을 그린다
         * (기준은 [com.kgd.search.domain.attraction.model.AttractionClickSignal.MIN_SAMPLE]).
         */
        val uniqueClickers14d: Int? = null,
        /**
         * 행사의 유효 기간(원천 시작·종료일을 정규화한 값, 양 끝 포함). 행사가 아니거나 날짜가 없으면 둘 다 null.
         * 상태 문구는 화면이 오늘 기준으로 같은 규칙으로 판정한다 — 응답에 상태를 싣지 않는 것은 캐시된 응답이 낡지 않게.
         */
        val eventStart: java.time.LocalDate? = null,
        val eventEnd: java.time.LocalDate? = null,
        /** 여행코스 구성 지점(순서대로). 코스가 아니거나 재색인이 원문을 읽지 못했으면 null. */
        val courseStops: List<CourseStop>? = null,
        /** 무장애 긍정 코드 — 목록·단건 모두. 정보가 없으면 null. */
        val barrierFree: List<String>? = null,
        /** 무장애 원천 키 → 원문 문장(원천 순서) — 단건 조회에만. */
        val barrierFreeDetail: Map<String, String>? = null,
        /** 웰니스 테마 코드·이름. */
        val wellnessTheme: String? = null,
        val wellnessThemeName: String? = null,
        /**
         * 집중률 앞 30일(예측일 순) — 단건 조회에만. 지난 날도 들어 있다 — 오늘을 거르는 것은 화면이다(응답이 캐시돼도 낡지 않게,
         * 행사 상태와 같은 이유). 이름 매칭이 안 된 곳은 null.
         */
        val congestion: List<CongestionDay>? = null,
        /** 여기 온 사람들이 함께 간 곳(원천 순위 순, 최대 6) — 단건 조회에만. 「비슷한 곳」과 겹쳐도 거르지 않는다(각 절이 따로 그린다). */
        val relatedPlaces: List<Related>? = null,
        /** 같은 장소의 다른 등록(관광지·쇼핑 등) — 단건 조회에만. 있으면 화면이 「복합공간」으로 알리고 잇는다. */
        val samePlace: List<SamePlaceRef>? = null,
    )

    /** 같은 장소의 다른 등록 — 제목은 이 관광지와 같다. [contentTypeId] 로 화면이 「쇼핑」 등을 붙인다. */
    data class SamePlaceRef(val id: String, val contentTypeId: String?)

    /** [category] 는 원천 소분류 이름 그대로. */
    data class Related(val rank: Int, val id: String, val title: String, val sidoName: String?, val category: String?)

    /** [rate] 는 원천 집중률 그대로(0~100). */
    data class CongestionDay(val date: java.time.LocalDate, val rate: Double)

    /** [attractionId] 는 같은 언어 관광지가 있을 때만 — 없으면 화면이 이름만 그리고 링크하지 않는다. */
    data class CourseStop(val order: Int, val contentId: String?, val name: String, val attractionId: Long?)

    /** 허브 링크는 `/regions/{sidoCode}{ldongSignguCd}`. */
    data class Region(
        val ldongSignguCd: String?,
        val sigunguName: String?,
        val typeCount: Int,
        val categoryCount: Int?,
        val categoryName: String?,
        val sameCategoryNearby: List<Nearby>,
    )

    /** [eventEndEffective] 는 항목이 행사일 때의 유효 종료일 — 화면이 오늘 기준으로 끝난 항목을 거른다. */
    data class Nearby(val id: String, val title: String, val distanceMeters: Int, val eventEndEffective: java.time.LocalDate?)

    data class Similar(val id: String, val title: String, val sidoName: String?, val eventEndEffective: java.time.LocalDate?)

    data class Result(
        val searchId: String,
        val attractions: List<AttractionSearchResult>,
        val totalElements: Long,
        val totalPages: Int,
        val currentPage: Int,
        /** 오타 교정으로 바꿔 검색했으면 바꾼 검색어. 화면이 「OO(으)로 검색한 결과」를 알린다 */
        val correctedKeyword: String? = null,
        /** 속성 패싯 건수. 건수 요청이 실패하면 null — 결과는 그대로 온다. */
        val attributeFacets: AttributeFacets? = null,
    )

    /**
     * 속성 값별 건수 — 키는 요청 파라미터 값과 같은 표기다(`parking.YES` ↔ `parking=YES`).
     * 각 건수는 자기 속성의 선택만 빼고 나머지 선택·구조 필터를 반영한다. `UNKNOWN`·부정 값은 싣지 않는다.
     */
    data class AttributeFacets(
        val openToday: Long,
        val parking: Map<String, Long>,
        val creditCard: Map<String, Long>,
        val strollerRental: Map<String, Long>,
        val pet: Map<String, Long>,
        val admission: Map<String, Long>,
        /** 무장애 코드별 건수(`barrierFree.WHEELCHAIR` ↔ `barrierFree=WHEELCHAIR`). */
        val barrierFree: Map<String, Long> = emptyMap(),
        val wellness: Long = 0,
    )
}
