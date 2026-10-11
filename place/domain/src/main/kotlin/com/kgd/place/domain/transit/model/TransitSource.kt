package com.kgd.place.domain.transit.model

import java.time.LocalDate
import java.time.LocalDateTime

/** 역·정류장 원천 — 도시철도 역사정보(국가철도공단) · 전국 버스정류장 위치정보(국토교통부). */
enum class TransitSource { RAIL, BUS }

/**
 * 도시철도 역사정보 원천 한 행. `*Raw` 와 이름 칸은 원천 원문 문자열 그대로(빈 값은 빈 문자열), [latValue]·[lngValue]·[validCoord]·[baseDate] 는 파생이다.
 * [sourceKey] 는 자연 키 `역번호|노선번호|역사명|노선명` — 역번호만으로는 같은 역의 노선별 행이 겹친다.
 */
data class TransitRailStation(
    val sourceKey: String,
    val stationNo: String,
    val stationName: String,
    val lineNo: String,
    val lineName: String,
    val stationNameEn: String,
    val stationNameHanja: String,
    val transferType: String,
    val transferLineNo: String,
    val transferLineName: String,
    val latRaw: String,
    val lngRaw: String,
    val operatorName: String,
    val roadAddress: String,
    val phone: String,
    val baseDateRaw: String,
    val latValue: Double?,
    val lngValue: Double?,
    val validCoord: Boolean,
    val baseDate: LocalDate?,
) {
    init {
        require(sourceKey.isNotBlank()) { "철도 원천 자연 키가 비었다: $stationNo $stationName" }
    }
}

/** 전국 버스정류장 위치정보 원천 한 행. [sourceKey] 는 자연 키 `도시코드:정류장번호`. */
data class TransitBusStop(
    val sourceKey: String,
    val stopNo: String,
    val stopName: String,
    val latRaw: String,
    val lngRaw: String,
    val collectedDateRaw: String,
    val mobileShortNo: String,
    val cityCode: String,
    val cityName: String,
    val manageCityName: String,
    val latValue: Double?,
    val lngValue: Double?,
    val validCoord: Boolean,
    val collectedDate: LocalDate?,
) {
    init {
        require(sourceKey.isNotBlank()) { "버스 원천 자연 키가 비었다: $cityCode $stopNo" }
    }
}

/** 원천의 활성 적재 회차. */
data class TransitSourceRun(val source: TransitSource, val runId: String, val rows: Int, val activatedAt: LocalDateTime)

/** 시군구 버스 원천 연계 판정 — [stops] 는 그 시군구로 이어진 원천 정류장 수, [covered] 는 수집기 하한(100) 이상. */
data class BusCoverage(val sigunguCode: String, val stops: Int, val covered: Boolean) {
    init {
        require(SIGUNGU_CODE.matches(sigunguCode)) { "시군구 코드는 5자리 숫자여야 합니다: $sigunguCode" }
        require(stops >= 0) { "정류장 수가 음수다: $sigunguCode $stops" }
    }

    private companion object {
        val SIGUNGU_CODE = Regex("\\d{5}")
    }
}
