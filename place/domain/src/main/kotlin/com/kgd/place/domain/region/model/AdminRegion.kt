package com.kgd.place.domain.region.model

/** 행정구역 레벨 — 법정동 코드 체계의 두 단계만 쓴다. 읍면동은 탐색 단위가 아니다. */
enum class AdminRegionLevel { SIDO, SIGUNGU }

/**
 * 한국 행정구역 (ADR-0071). 출처: 행정안전부 법정동코드 전체자료.
 *
 * `Region`(GeoNames 지명 계층)과 **다른 것**이다. 세계 지명과 한국 행정구역을 한 모델에 담으면
 * 두 체계가 섞여 필터 결과가 경로에 따라 달라진다 — `attractions.sigungu_code` 가 그렇게 됐다.
 */
class AdminRegion private constructor(
    val code: String,
    val parentCode: String?,
    val level: AdminRegionLevel,
    var name: String,
    var nameEn: String? = null,
    var latitude: Double? = null,
    var longitude: Double? = null,
) {
    companion object {
        fun create(
            code: String,
            level: AdminRegionLevel,
            name: String,
            parentCode: String? = null,
            nameEn: String? = null,
            latitude: Double? = null,
            longitude: Double? = null,
        ): AdminRegion {
            require(name.isNotBlank()) { "행정구역명은 비어있을 수 없습니다" }
            val expected = if (level == AdminRegionLevel.SIDO) 2 else 5
            require(code.length == expected && code.all { it.isDigit() }) {
                "$level 코드는 숫자 ${expected}자리여야 합니다: $code"
            }
            if (level == AdminRegionLevel.SIGUNGU) {
                require(parentCode == code.take(2)) {
                    "시군구의 상위 코드는 앞 2자리여야 합니다: $code / $parentCode"
                }
            } else {
                require(parentCode == null) { "시도는 상위 코드를 갖지 않습니다: $parentCode" }
            }
            return AdminRegion(code, parentCode, level, name, nameEn?.takeIf { it.isNotBlank() },
                latitude, longitude)
        }

        fun restore(
            code: String,
            parentCode: String?,
            level: AdminRegionLevel,
            name: String,
            nameEn: String?,
            latitude: Double?,
            longitude: Double?,
        ) = AdminRegion(code, parentCode, level, name, nameEn, latitude, longitude)
    }

    /** 재적재 시 이름·영문명을 갱신한다 — 코드와 계층은 자연키다. */
    fun syncFrom(source: AdminRegion) {
        require(source.code == code) { "다른 행정구역으로 동기화할 수 없습니다: ${source.code} → $code" }
        name = source.name
        nameEn = source.nameEn ?: nameEn
        /*
         * 좌표는 법정동 자료에 없다 — 관광지 좌표에서 따로 계산해 넣는 **보강 필드**다.
         * 이름만 다시 적재할 때 통째로 덮으면 지도가 엉뚱한 곳을 본다. 개요와 같은 규칙으로
         * 값이 있을 때만 갱신한다 (ADR-0071).
         */
        val lat = source.latitude
        val lng = source.longitude
        if (lat != null && lng != null) locateAt(lat, lng)
    }

    /**
     * 지도 중심 좌표. 법정동 자료에 좌표가 없어 관광지 좌표로 채운다 — 지도를 어디에 놓을지
     * 정하는 값이라 행정 중심점일 필요가 없다.
     */
    fun locateAt(latitude: Double, longitude: Double) {
        this.latitude = latitude
        this.longitude = longitude
    }
}
