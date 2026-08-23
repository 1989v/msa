package com.kgd.ranking.infrastructure.routes

import java.math.BigDecimal
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot

/** 지도 위 한 점. 거리 계산은 전부 미터 단위로 한다. */
data class LatLng(val latitude: Double, val longitude: Double)

/**
 * Google encoded polyline 디코더 (정밀도 5).
 *
 * Routes API 는 경로를 인코딩된 문자열로 준다. 라이브러리를 들이지 않는 이유는 알고리즘이
 * 20줄이고 골든 문자열로 검증 가능하기 때문이다.
 */
object Polyline {

    fun decode(encoded: String): List<LatLng> {
        val points = mutableListOf<LatLng>()
        var index = 0
        var lat = 0
        var lng = 0

        while (index < encoded.length) {
            lat += decodeValue(encoded, index).also { index = it.nextIndex }.value
            lng += decodeValue(encoded, index).also { index = it.nextIndex }.value
            points += LatLng(lat / 1e5, lng / 1e5)
        }
        return points
    }

    private data class Decoded(val value: Int, val nextIndex: Int)

    private fun decodeValue(encoded: String, start: Int): Decoded {
        var index = start
        var shift = 0
        var result = 0
        var byte: Int
        do {
            byte = encoded[index++].code - 63
            result = result or ((byte and 0x1f) shl shift)
            shift += 5
        } while (byte >= 0x20)
        val value = if (result and 1 != 0) (result shr 1).inv() else result shr 1
        return Decoded(value, index)
    }
}

/**
 * 평면 근사 거리 계산.
 *
 * 한반도 규모(수백 km)에서 위경도 격자를 평면으로 봐도 오차가 0.1% 수준이라 haversine 을
 * 쓰지 않는다 — 이 값은 "약 N분"을 만드는 입력이지 측량값이 아니다.
 */
object Geo {
    private const val METERS_PER_DEGREE_LAT = 111_320.0

    fun distanceMeters(a: LatLng, b: LatLng): Double {
        val latMeters = (a.latitude - b.latitude) * METERS_PER_DEGREE_LAT
        val lngMeters = (a.longitude - b.longitude) * METERS_PER_DEGREE_LAT *
            cos(Math.toRadians((a.latitude + b.latitude) / 2))
        return hypot(latMeters, lngMeters)
    }

    fun latDegrees(meters: Double): Double = meters / METERS_PER_DEGREE_LAT

    fun lngDegrees(meters: Double, atLatitude: Double): Double {
        val scale = METERS_PER_DEGREE_LAT * cos(Math.toRadians(atLatitude))
        return if (abs(scale) < 1.0) 1.0 else meters / scale
    }

    /**
     * 점에서 선분까지의 수직 거리.
     *
     * 꼭짓점까지의 거리로 대신하면 **경로 위에 있는 지점도 꼭짓점 간격의 절반만큼 떨어진 것으로
     * 나온다.** 그러면 "이탈 0분"인 주유소가 결과에서 빠지고, 폴리라인을 성기게 만들수록
     * 그 오차가 커진다. 선분까지 재면 성글게 만들어도 거리는 정확하다.
     */
    fun distanceToSegment(point: LatLng, a: LatLng, b: LatLng): Double {
        val lngScale = METERS_PER_DEGREE_LAT * cos(Math.toRadians(a.latitude))
        val bx = (b.longitude - a.longitude) * lngScale
        val by = (b.latitude - a.latitude) * METERS_PER_DEGREE_LAT
        val px = (point.longitude - a.longitude) * lngScale
        val py = (point.latitude - a.latitude) * METERS_PER_DEGREE_LAT

        val lengthSquared = bx * bx + by * by
        if (lengthSquared == 0.0) return hypot(px, py)

        val t = ((px * bx + py * by) / lengthSquared).coerceIn(0.0, 1.0)
        return hypot(px - t * bx, py - t * by)
    }

    /** 경로 전체에서 가장 가까운 지점까지의 거리. */
    fun distanceToPath(point: LatLng, path: List<LatLng>): Double = when {
        path.isEmpty() -> Double.MAX_VALUE
        path.size == 1 -> distanceMeters(point, path.first())
        else -> (1 until path.size).minOf { distanceToSegment(point, path[it - 1], path[it]) }
    }

    fun toLatLng(latitude: BigDecimal?, longitude: BigDecimal?): LatLng? =
        if (latitude == null || longitude == null) null
        else LatLng(latitude.toDouble(), longitude.toDouble())

    /**
     * 경로를 [intervalMeters] 간격으로 성기게 만든다.
     *
     * Routes API 의 폴리라인은 꼭짓점이 수천 개라 그대로 쓰면 박스 질의가 그만큼 돈다.
     * 후보를 찾는 데는 성긴 표본이면 충분하고, 정확한 이탈거리는 원본 꼭짓점으로 다시 잰다.
     */
    fun sample(path: List<LatLng>, intervalMeters: Double): List<LatLng> {
        if (path.isEmpty()) return emptyList()
        val samples = mutableListOf(path.first())
        var accumulated = 0.0
        for (i in 1 until path.size) {
            accumulated += distanceMeters(path[i - 1], path[i])
            if (accumulated >= intervalMeters) {
                samples += path[i]
                accumulated = 0.0
            }
        }
        if (samples.last() != path.last()) samples += path.last()
        return samples
    }
}
