package com.kgd.place.domain.market.model

/** Geographic POLYGON WKT: finite lon/lat rings, closed, non-degenerate and simple. */
object MarketPolygon {
    fun validate(wkt: String?) {
        if (wkt == null) return
        require(wkt.length <= 100_000)
        val body = Regex("^POLYGON\\s*\\(\\s*(.*)\\s*\\)$", RegexOption.IGNORE_CASE)
            .matchEntire(wkt.trim())?.groupValues?.get(1) ?: throw IllegalArgumentException("Expected POLYGON WKT")
        val rings = Regex("\\(([^()]*)\\)").findAll(body).toList()
        require(Regex("^\\s*\\([^()]+\\)(\\s*,\\s*\\([^()]+\\))*\\s*$").matches(body))
        val polygons = rings.map { ring -> ring.groupValues[1].split(',').map { point ->
            val xy = point.trim().split(Regex("\\s+"))
            require(xy.size == 2)
            val lng = requireNotNull(xy[0].toDoubleOrNull())
            val lat = requireNotNull(xy[1].toDoubleOrNull())
            MarketCoordinate(lat, lng)
            lng to lat
        } }
        require(polygons.sumOf { it.size } <= 2001)
        fun cross(a: Pair<Double, Double>, b: Pair<Double, Double>, c: Pair<Double, Double>) =
            (b.first - a.first) * (c.second - a.second) - (b.second - a.second) * (c.first - a.first)
        fun on(a: Pair<Double, Double>, b: Pair<Double, Double>, c: Pair<Double, Double>) =
            c.first in minOf(a.first, b.first)..maxOf(a.first, b.first) &&
                c.second in minOf(a.second, b.second)..maxOf(a.second, b.second)
        fun intersects(a: Pair<Double, Double>, b: Pair<Double, Double>, c: Pair<Double, Double>, d: Pair<Double, Double>): Boolean {
            val x = cross(a, b, c); val y = cross(a, b, d); val z = cross(c, d, a); val t = cross(c, d, b)
            return (x * y < 0 && z * t < 0) || (x == 0.0 && on(a, b, c)) ||
                (y == 0.0 && on(a, b, d)) || (z == 0.0 && on(c, d, a)) || (t == 0.0 && on(c, d, b))
        }
        polygons.forEach { points ->
            require(points.size >= 4 && points.first() == points.last()) { "Polygon ring must close" }
            require(points.dropLast(1).distinct().size == points.size - 1)
            val area = points.zipWithNext().sumOf { (a, b) -> a.first * b.second - b.first * a.second }
            require(kotlin.math.abs(area) > 1e-12) { "Polygon has no area" }
            val edges = points.zipWithNext()
            edges.indices.forEach { i ->
                val a = points[(i + edges.size - 1) % edges.size]; val b = points[i]; val c = points[i + 1]
                require(cross(a, b, c) != 0.0 || (a.first - b.first) * (c.first - b.first) +
                    (a.second - b.second) * (c.second - b.second) <= 0.0) { "Polygon ring overlaps itself" }
                for (j in i + 1 until edges.size) {
                    if (j == i + 1 || (i == 0 && j == edges.lastIndex)) continue
                    val (a, b) = edges[i]; val (c, d) = edges[j]
                    require(!intersects(a, b, c, d)) {
                        "Polygon must not self-intersect"
                    }
                }
            }
        }
        fun inside(point: Pair<Double, Double>, ring: List<Pair<Double, Double>>): Boolean =
            ring.zipWithNext().count { (a, b) ->
                (a.second > point.second) != (b.second > point.second) &&
                    point.first < (b.first - a.first) * (point.second - a.second) / (b.second - a.second) + a.first
            } % 2 == 1
        polygons.indices.forEach { i ->
            if (i > 0) require(inside(polygons[i].first(), polygons[0])) { "Polygon hole lies outside outer ring" }
            for (j in i + 1 until polygons.size) {
                require(polygons[i].zipWithNext().none { (a, b) -> polygons[j].zipWithNext().any { (c, d) -> intersects(a, b, c, d) } }) {
                    "Polygon rings intersect"
                }
                if (i > 0) require(!inside(polygons[i].first(), polygons[j]) && !inside(polygons[j].first(), polygons[i])) { "Polygon holes overlap" }
            }
        }
    }
}
