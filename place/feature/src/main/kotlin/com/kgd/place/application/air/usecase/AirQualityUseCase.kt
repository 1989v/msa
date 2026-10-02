package com.kgd.place.application.air.usecase

import java.time.LocalDateTime

/**
 * 시군구의 측정소 후보와 각 측정소의 실시간 대기 — 관광지 상세의 「대기질」 절이 부른다. 화면이 부르는 경로라 레디스 캐시에서 나간다.
 * 화면은 후보 가운데 그 관광지에서 가장 가까운 측정소 하나를 고른다(후보가 시군구 관광지마다의 최근접을 다 품는다).
 * [now] 는 KST 벽시계 — 측정 3시간이 지난 값은 이 시각으로 거른다.
 */
interface AirQualityUseCase {
    fun air(sigunguCode: String, now: LocalDateTime): Air

    /** 캐시 값의 모양이라 문자열·수로만 둔다(날짜 타입 직렬화 설정에 기대지 않는다). [stations] 가 비면(후보 전) 화면은 절을 그리지 않는다. */
    data class Air(val sigunguCode: String, val stations: List<Station>)

    /** [measurement] 가 없으면(측정 없음 · 3시간 초과) 화면은 그 측정소로 절을 그리지 않는다. */
    data class Station(val name: String, val latitude: Double, val longitude: Double, val measurement: Measurement?)

    /** [dataTime] 은 측정소 자신의 측정 시각(`yyyy-MM-ddTHH:mm`, KST). 값·등급·Flag 는 원천 문자열 그대로. */
    data class Measurement(val sidoName: String, val dataTime: String, val pm10: Pollutant, val pm25: Pollutant)

    /** [grade] 는 원천 등급 코드(1 좋음 · 2 보통 · 3 나쁨 · 4 매우나쁨), [flag] 는 원천 상태 표시(통신장애 · 점검및교정 …). */
    data class Pollutant(val value: String?, val grade: String?, val flag: String?)
}
