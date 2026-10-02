package com.kgd.place.domain.air.model

import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 에어코리아 측정소 하나. 좌표는 측정소정보 `getMsrstnList` 의 `dmX`(위도) · `dmY`(경도) — 필드 이름과 반대다.
 * 바꿔 읽는 일은 수집기(place-ingest `air`)가 하고 한반도 범위로 검사한다.
 */
data class AirStation(val stationName: String, val latitude: Double, val longitude: Double)

/**
 * 시군구의 측정소 후보 하나 — 그 시군구 관광지 가운데 [attractions] 곳의 최근접 측정소(대표점의 최근접일 뿐이면 0).
 * [distanceM] 은 시군구 대표점에서 측정소까지(대표점이 없으면 null). 둘 다 수집기가 계산한 파생 값이다.
 */
data class AirStationMapping(val sigunguCode: String, val stationName: String, val distanceM: Int?, val attractions: Int)

/** 오염물질 하나의 원천 값 — `{물질}Value` · `{물질}Grade` · `{물질}Flag` 문자열 그대로. */
data class AirPollutant(val value: String?, val grade: String?, val flag: String?)

/** 측정소 하나의 최신 실시간 측정. [fields] 는 원천 행의 키 → 값 문자열 그대로다. */
data class AirMeasurement(val sidoName: String, val stationName: String, val dataTime: LocalDateTime?, val fields: Map<String, String?>)

/**
 * 대기 측정값 규칙. 이용허락이 공공누리 제3유형(변경금지)이라 값·등급은 원천 문자열을 그대로 옮기기만 한다 —
 * 수로 바꾸거나, 여러 측정소를 평균하거나, 등급을 다시 매기는 함수를 두지 않는다.
 */
object AirQuality {
    /** 측정 뒤 이 시간이 지나면 응답에서 뺀다(화면은 절을 숨긴다). */
    val FRESH: Duration = Duration.ofHours(3)

    private val DATA_TIME = Regex("""(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})""")

    /** 원천 `dataTime`(`yyyy-MM-dd HH:mm`, KST). 원천은 자정을 그날의 `24:00` 으로 준다 — 다음 날 00:00 으로 읽는다. */
    fun parseDataTime(raw: String?): LocalDateTime? {
        val m = raw?.let { DATA_TIME.matchEntire(it.trim()) } ?: return null
        val (y, mo, d, h, mi) = m.destructured
        return runCatching {
            val date = LocalDate.of(y.toInt(), mo.toInt(), d.toInt())
            if (h.toInt() == 24 && mi.toInt() == 0) date.plusDays(1).atStartOfDay() else date.atTime(h.toInt(), mi.toInt())
        }.getOrNull()
    }

    fun isFresh(dataTime: LocalDateTime?, now: LocalDateTime): Boolean =
        dataTime != null && !now.isAfter(dataTime.plus(FRESH))

    /** [code] 는 원천 접두(`pm10` · `pm25` · `o3` · `no2` · `co` · `so2` · `khai`). */
    fun pollutant(fields: Map<String, String?>, code: String): AirPollutant =
        AirPollutant(fields["${code}Value"], fields["${code}Grade"], fields["${code}Flag"])
}
