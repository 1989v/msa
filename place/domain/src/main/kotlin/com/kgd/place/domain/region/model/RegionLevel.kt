package com.kgd.place.domain.region.model

/** 행정 계층 레벨. 대륙 → 국가 → 광역(시/도/주) → 도시. */
enum class RegionLevel {
    CONTINENT,
    COUNTRY,
    REGION,
    CITY,
}
