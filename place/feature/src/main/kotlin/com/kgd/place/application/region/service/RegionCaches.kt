package com.kgd.place.application.region.service

/**
 * 지역 계층 조회 캐시 이름. 관광지 화면은 place MySQL 을 직접 읽지 않는다 — 지역 드롭다운·드릴다운·허브가
 * 부르는 계층 조회는 레디스에서 나가고, 적재(bulk upsert) 때 전부 비운다 (ADR-0071 §서빙 경로).
 */
object RegionCaches {
    /** 행정구역(시도·시군구) + 관광 분류 건수. 키는 `level:parent:lang`. */
    const val ADMINISTRATIVE = "placeAdministrativeRegions"

    /** GeoNames 지명 계층. 키는 `level:X` 또는 `parent:N`. */
    const val GEONAMES = "placeRegions"
}
