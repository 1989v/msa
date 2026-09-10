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
        val googlePlaceId: String? = null,
        val distanceKm: Double? = null,
        val position: Int = 0,
        /**
         * 원천 최종 수정일. sitemap 의 `lastmod` 가 이 값을 쓴다 — 없으면 6만 URL 이
         * 갱신 여부를 알릴 방법이 없어 크롤러가 전량을 같은 우선순위로 다시 훑는다.
         */
        val modifiedAt: java.time.LocalDateTime? = null,
    )

    data class Result(
        val searchId: String,
        val attractions: List<AttractionSearchResult>,
        val totalElements: Long,
        val totalPages: Int,
        val currentPage: Int,
    )
}
