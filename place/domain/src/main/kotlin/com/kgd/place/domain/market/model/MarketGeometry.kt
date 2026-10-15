package com.kgd.place.domain.market.model

import java.time.LocalDateTime
import kotlin.math.*

enum class MarketGeometrySource { OSM, DERIVED, MANUAL }
enum class MarketJudgedBy { OVERRIDE, BOUNDARY, ROAD_RULE, INGEST }
enum class MarketOsmKind { BOUNDARY, PATHS, ROADS }

data class MarketBoundary(val marketId: Long, val polygon: List<MarketCoordinate>, val source: MarketGeometrySource,
    val osmType: String? = null, val osmId: Long? = null, val fetchedAt: LocalDateTime? = null) {
    init { require(marketId > 0 && polygon.distinct().size >= 3) }
    fun reloadSource(incoming: MarketBoundary): MarketBoundary {
        require(incoming.marketId == marketId && incoming.source != MarketGeometrySource.MANUAL)
        return if (source == MarketGeometrySource.MANUAL) this else incoming
    }
}
data class MarketPath(val marketId: Long, val name: String?, val named: Boolean, val geometry: List<MarketCoordinate>,
    val source: MarketGeometrySource, val osmWayId: Long? = null, val sort: Int = 0, val id: Long? = null) {
    init {
        require(marketId > 0 && geometry.size >= 2 && geometry.distinct().size >= 2)
        require(source != MarketGeometrySource.DERIVED && (!named || !name.isNullOrBlank()))
    }
    fun reloadSource(incoming: MarketPath): MarketPath {
        require(incoming.marketId == marketId && incoming.source == MarketGeometrySource.OSM)
        return if (source == MarketGeometrySource.MANUAL) this else incoming.copy(id = id)
    }
}
data class MarketEntrance(val marketId: Long, val latitude: Double, val longitude: Double, val viaPathId: Long?,
    val label: String?, val source: MarketGeometrySource, val id: Long? = null) {
    init { require(marketId > 0); MarketCoordinate(latitude, longitude) }
}
data class MarketRoadRule(val marketId: Long, val roadName: String, val membership: MarketMembershipStatus,
    val reason: String, val buildingNoFrom: Int? = null, val buildingNoTo: Int? = null, val id: Long? = null) {
    init {
        require(marketId > 0 && roadName.isNotBlank() && reason.isNotBlank())
        require(membership != MarketMembershipStatus.UNKNOWN)
        require(buildingNoFrom == null || buildingNoFrom >= 0)
        require(buildingNoTo == null || buildingNoTo >= 0)
        require(buildingNoFrom == null || buildingNoTo == null || buildingNoFrom <= buildingNoTo)
    }
    fun matches(road: String?, buildingNo: Int?): Boolean = road == roadName &&
        ((buildingNoFrom == null && buildingNoTo == null) || (buildingNo != null &&
            (buildingNoFrom == null || buildingNo >= buildingNoFrom) && (buildingNoTo == null || buildingNo <= buildingNoTo)))
}
data class MarketOsmRaw(val marketId: Long, val kind: MarketOsmKind, val payload: String, val fetchedAt: LocalDateTime)
data class MarketStoreJudgment(val membership: MarketMembershipStatus, val judgedBy: MarketJudgedBy,
    val pathId: Long?, val needsReview: Boolean)
data class MarketEntranceCandidate(val coordinate: MarketCoordinate, val viaPathId: Long?)

/** Local latitude approximation for market-scale geometry; arrays use latitude, longitude order. */
object MarketGeometry {
    private const val METERS_PER_DEGREE = 111320.0
    private fun edges(polygon: List<MarketCoordinate>) =
        (if (polygon.first() == polygon.last()) polygon else polygon + polygon.first()).zipWithNext()

    fun distanceToSegment(point: MarketCoordinate, a: MarketCoordinate, b: MarketCoordinate): Double {
        val scale = cos(Math.toRadians(point.latitude)) * METERS_PER_DEGREE
        val ax = (a.longitude - point.longitude) * scale; val ay = (a.latitude - point.latitude) * METERS_PER_DEGREE
        val bx = (b.longitude - point.longitude) * scale; val by = (b.latitude - point.latitude) * METERS_PER_DEGREE
        val dx = bx - ax; val dy = by - ay
        val length = dx * dx + dy * dy
        val t = if (length == 0.0) 0.0 else (-(ax * dx + ay * dy) / length).coerceIn(0.0, 1.0)
        return hypot(ax + t * dx, ay + t * dy)
    }
    fun distanceToPolyline(point: MarketCoordinate, line: List<MarketCoordinate>): Double =
        line.zipWithNext().minOf { (a, b) -> distanceToSegment(point, a, b) }

    /** Boundary points are inside. */
    fun contains(point: MarketCoordinate, polygon: List<MarketCoordinate>): Boolean {
        val edges = edges(polygon)
        if (edges.any { (a, b) -> distanceToSegment(point, a, b) < 0.0001 }) return true
        return edges.count { (a, b) ->
            (a.latitude > point.latitude) != (b.latitude > point.latitude) &&
                point.longitude < (b.longitude - a.longitude) * (point.latitude - a.latitude) /
                    (b.latitude - a.latitude) + a.longitude
        } % 2 == 1
    }

    /** Convex hull of a 20m (default) circumscribed buffer around each source point. */
    fun boundaryDraft(points: List<MarketCoordinate>, marginMeters: Double = 20.0): List<MarketCoordinate> {
        require(points.isNotEmpty() && marginMeters.isFinite() && marginMeters > 0)
        val latitude = points.map { it.latitude }.average()
        val scale = METERS_PER_DEGREE * cos(Math.toRadians(latitude))
        require(abs(scale) > 1e-6)
        val radius = marginMeters / cos(PI / 16)
        val buffered = points.flatMap { point -> (0 until 16).map { i ->
            MarketCoordinate(point.latitude + sin(i * PI / 8) * radius / METERS_PER_DEGREE,
                point.longitude + cos(i * PI / 8) * radius / scale)
        } }.distinct().sortedWith(compareBy({ it.longitude }, { it.latitude }))
        fun cross(a: MarketCoordinate, b: MarketCoordinate, c: MarketCoordinate) =
            (b.longitude - a.longitude) * (c.latitude - a.latitude) - (b.latitude - a.latitude) * (c.longitude - a.longitude)
        fun half(rows: List<MarketCoordinate>): List<MarketCoordinate> {
            val hull = mutableListOf<MarketCoordinate>()
            rows.forEach { p ->
                while (hull.size >= 2 && cross(hull[hull.size - 2], hull.last(), p) <= 0) hull.removeAt(hull.lastIndex)
                hull.add(p)
            }
            return hull.dropLast(1)
        }
        val hull = half(buffered) + half(buffered.reversed())
        return hull + hull.first()
    }

    /** Distinct boundary crossings. Tangencies and collinear boundary travel are not entrances. */
    fun entranceCandidates(boundary: List<MarketCoordinate>, paths: List<MarketPath>): List<MarketEntranceCandidate> {
        val candidates = mutableListOf<MarketEntranceCandidate>()
        paths.forEach { path ->
            fun side(segmentIndex: Int, fraction: Double, direction: Int): MarketCoordinate? {
                var index = segmentIndex
                var t = fraction.coerceIn(0.0, 1.0)
                while (index in 0 until path.geometry.lastIndex) {
                    val start = path.geometry[index]; val end = path.geometry[index + 1]
                    val length = distanceToSegment(start, end, end)
                    val available = if (direction < 0) t else 1 - t
                    if (length > 0 && available * length > 0.001) {
                        val offset = minOf(available / 2, 0.02 / length)
                        val sample = t + direction * offset
                        val point = MarketCoordinate(start.latitude + sample * (end.latitude - start.latitude),
                            start.longitude + sample * (end.longitude - start.longitude))
                        // Follow the actual path across a boundary run until it reaches a strict side.
                        if (edges(boundary).none { (a, b) -> distanceToSegment(point, a, b) < 0.0001 }) return point
                    }
                    index += direction
                    t = if (direction < 0) 1.0 else 0.0
                }
                return null
            }
            path.geometry.zipWithNext().forEachIndexed { segmentIndex, (a, b) -> edges(boundary).forEach edge@{ (c, d) ->
            val rx = b.longitude - a.longitude; val ry = b.latitude - a.latitude
            val sx = d.longitude - c.longitude; val sy = d.latitude - c.latitude
            val denominator = rx * sy - ry * sx
            if (abs(denominator) < 1e-18) return@edge
            val cx = c.longitude - a.longitude; val cy = c.latitude - a.latitude
            val t = (cx * sy - cy * sx) / denominator
            val u = (cx * ry - cy * rx) / denominator
            if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return@edge
            val p = MarketCoordinate(a.latitude + t * ry, a.longitude + t * rx)
            val before = side(segmentIndex, t, -1) ?: return@edge
            val after = side(segmentIndex, t, 1) ?: return@edge
            if (contains(before, boundary) != contains(after, boundary) && candidates.none {
                    distanceToSegment(p, it.coordinate, it.coordinate) < 0.01 }) {
                candidates.add(MarketEntranceCandidate(p, path.id))
            }
        } } }
        return candidates
    }
}

object MarketStoreJudge {
    fun judge(store: MarketStore, boundary: MarketBoundary?, paths: List<MarketPath>, rules: List<MarketRoadRule>,
        overrides: List<MarketStoreOverride> = emptyList()): MarketStoreJudgment {
        require(boundary == null || boundary.marketId == store.marketId)
        require(paths.all { it.marketId == store.marketId } && rules.all { it.marketId == store.marketId })
        require(overrides.all { it.storeId == store.id })
        val display = MarketStoreDisplay.from(store, overrides)
        val point = display.coordinate
        val override = overrides.find { it.field == MarketStoreField.MEMBERSHIP }
        val buildingNo = store.roadName?.let { road -> store.roadAddress?.let {
            Regex("(?:^|\\s)" + Regex.escape(road) + "\\s+(\\d+)").find(it)?.groupValues?.get(1)?.toIntOrNull()
        } }
        val rule = rules.firstOrNull { it.matches(store.roadName, buildingNo) }
        val (membership, by) = when {
            override != null -> MarketMembershipStatus.valueOf(requireNotNull(override.value)) to MarketJudgedBy.OVERRIDE
            boundary != null -> (if (point == null) MarketMembershipStatus.UNKNOWN else if (MarketGeometry.contains(point, boundary.polygon))
                MarketMembershipStatus.IN else MarketMembershipStatus.OUT) to MarketJudgedBy.BOUNDARY
            rule != null -> rule.membership to MarketJudgedBy.ROAD_RULE
            else -> store.membership.status to MarketJudgedBy.INGEST
        }
        if (point == null || paths.isEmpty() || membership != MarketMembershipStatus.IN)
            return MarketStoreJudgment(membership, by, null, false)
        val distances = paths.map { it to MarketGeometry.distanceToPolyline(point, it.geometry) }
        val matching = distances.filter { (path, distance) -> path.named && path.name == store.roadName && distance <= 25.0 }
            .minByOrNull { it.second }
        val correction = overrides.find { it.field == MarketStoreField.PATH_ID }
        if (correction != null) {
            val id = correction.value?.toLong()
            if (id == null || paths.any { it.id == id }) return MarketStoreJudgment(membership, by, id, false)
        }
        val selected = matching ?: distances.minBy { it.second }
        return MarketStoreJudgment(membership, by, selected.first.id, matching == null)
    }
}
