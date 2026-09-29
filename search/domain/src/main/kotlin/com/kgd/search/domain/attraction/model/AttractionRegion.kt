package com.kgd.search.domain.attraction.model

/**
 * 문서에 싣는 지역 안 위치 — [RegionAggregator] 의 결과에 표시용 이름을 붙인 것.
 * 시군구 코드나 유형이 없는 문서는 이 값이 없다.
 *
 * @property typeCount 같은 시군구·같은 유형 수 N(자기 포함)
 * @property categoryCount 거기에 lclsSystm3 까지 같은 수 M. 분류가 없는 문서는 null, 있으면 항상 M ≤ N
 * @property sameCategoryNearby 같은 시군구·유형·분류에서 가까운 곳(자기 제외, 최대 [RegionAggregator.NEAREST_LIMIT])
 */
data class AttractionRegion(
    val sigunguName: String?,
    val typeCount: Int,
    val categoryCount: Int?,
    val categoryName: String?,
    val sameCategoryNearby: List<NearbyPlace>,
)
