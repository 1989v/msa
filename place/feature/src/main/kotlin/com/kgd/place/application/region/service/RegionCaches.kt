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

    /**
     * 지역 허브 「방문 추이」. 키는 법정동 코드(시도 2자리 · 시군구 5자리 — 길이가 수준이라 겹치지 않는다).
     * 적재가 받은 지역의 키를 덮는다(write-through) — 비우지 않는다.
     */
    const val VISITORS = "placeRegionVisitors"

    /**
     * 시군구 날씨(기상청 단기·중기). 키는 시군구 법정동 코드 5자리. 적재가 받은 격자·구역을 쓰는 시군구의 키를 덮는다
     * (write-through) — 비우지 않는다. 값은 신선도로 거르기 전이고, 거르기는 읽을 때 한다.
     */
    const val WEATHER = "placeWeather"

    /**
     * 시군구 대기(최근접 측정소의 실시간 측정). 키는 시군구 법정동 코드 5자리. 측정 적재가 받은 측정소를 쓰는 시군구, 측정소 적재가
     * 매핑을 받은 시군구의 키를 덮는다(write-through) — 비우지 않는다. 값은 신선도(측정 3시간)로 거르기 전이고, 거르기는 읽을 때 한다.
     */
    const val AIR = "placeAir"
}
