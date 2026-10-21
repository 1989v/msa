package com.kgd.ranking.domain.cafe.model

import kotlin.math.*

/** Pure WGS84 geometry. Caller keeps a user's position request-scoped. */
object CafeGeo {
    fun distanceM(lat: Double, lng: Double, otherLat: Double, otherLng: Double): Double {
        val dLat = Math.toRadians(otherLat - lat)
        val dLng = Math.toRadians(otherLng - lng)
        val a = sin(dLat / 2).pow(2) + cos(Math.toRadians(lat)) * cos(Math.toRadians(otherLat)) * sin(dLng / 2).pow(2)
        return 6371008.8 * 2 * asin(sqrt(a.coerceIn(0.0, 1.0)))
    }
    fun latitudeDelta(km: Double) = Math.toDegrees(km / 6371.0088)
    fun longitudeDelta(km: Double, lat: Double) = (latitudeDelta(km) / cos(Math.toRadians(lat)).coerceAtLeast(0.00001)).coerceAtMost(180.0)
}
