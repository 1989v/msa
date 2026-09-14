package com.kgd.common.analytics

/**
 * 노출 위치 (ADR-0095). **한 축으로 누르지 않는다** — `position` 하나로는
 * 「캐로셀 3번째」와 「3번째 섹션」이 구분되지 않는다.
 *
 * CTR 은 지면마다·순서마다 다른 수치라, 섞으면 「노출은 많은데 클릭이 없다」의 원인을 못 가린다.
 */
data class Placement(
    /** 화면 종류 — PLACE_HUB · ATTRACTION_DETAIL · PLACE_REGION. 화면마다 고유한 상수. */
    val screenType: String,
    /**
     * 그 화면의 주체. 관광지 상세면 그 관광지 id, 목록 화면이면 빈 문자열.
     * 「관광지 A 상세에서 B 가 노출됐다」를 알아야 주변 명소 추천의 쓸모를 판정할 수 있다.
     */
    val screenRef: String = "",
    /** 섹션 고유 id — NEARBY_ATTRACTIONS · AMENITY_CAROUSEL. */
    val sectionId: String = "",
    /**
     * 화면 안 섹션 순서. **값으로 남긴다** — 섹션 배치는 바뀌고, 그러면 과거 데이터의 위치를
     * 나중에 복원할 수 없다.
     */
    val sectionIndex: Int? = null,
    /** 섹션 안 순서. 캐로셀 내 위치를 포함한다. */
    val itemIndex: Int? = null,
)
