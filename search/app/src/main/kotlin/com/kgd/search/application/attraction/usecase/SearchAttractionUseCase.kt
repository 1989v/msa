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
        /** relevance(기본) | distance — distance 는 lat/lng 지정 시에만 유효 */
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
        /** true 면 속성 패싯 건수를 센다(집계 요청 하나 더). 목록 첫 쪽만 보낸다. 필터 적용과는 무관하다. */
        val attributeFacets: Boolean = false,
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
        /** 목록 응답은 200자 요약 — 전문은 단건 조회로 */
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
        val googlePlaceId: String? = null,
        val distanceKm: Double? = null,
        val position: Int = 0,
        /**
         * 원천 최종 수정일. sitemap 의 `lastmod` 가 이 값을 쓴다 — 없으면 6만 URL 이
         * 갱신 여부를 알릴 방법이 없어 크롤러가 전량을 같은 우선순위로 다시 훑는다.
         */
        val modifiedAt: java.time.LocalDateTime? = null,
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
    )

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
    )
}
