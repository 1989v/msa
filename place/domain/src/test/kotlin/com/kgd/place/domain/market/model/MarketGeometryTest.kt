package com.kgd.place.domain.market.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.doubles.plusOrMinus
import tools.jackson.databind.json.JsonMapper

class MarketGeometryTest : BehaviorSpec({
    fun coordinate(lat: Double, lng: Double) = MarketCoordinate(lat, lng)
    val square = listOf(coordinate(37.0, 127.0), coordinate(37.0, 127.001),
        coordinate(37.001, 127.001), coordinate(37.001, 127.0))
    fun store(road: String? = "오리로", address: String? = "경기도 광명시 오리로 964-1") = MarketStore(
        1, "원천 가게", MarketStoreSource.SANGGA, sourceKey = "s1", sanggaKey = "s1", sanggaRaw = "{}",
        latitude = 37.0005, longitude = 127.0005, roadName = road, roadAddress = address,
        membership = MarketMembership(MarketMembershipStatus.OUT), id = 1)
    given("market geometry") {
        `when`("points lie inside, outside or on the boundary") {
            then("containment includes the edge and closes an open ring") {
                MarketGeometry.contains(coordinate(37.0005, 127.0005), square) shouldBe true
                MarketGeometry.contains(coordinate(37.0, 127.0005), square) shouldBe true
                MarketGeometry.contains(coordinate(36.99, 127.0005), square) shouldBe false
            }
        }
        then("segment and polyline distances use meters, including zero-length segments") {
            val a = coordinate(37.0, 127.0)
            MarketGeometry.distanceToSegment(coordinate(37.001, 127.0), a, a) shouldBe (111.32 plusOrMinus 0.01)
            MarketGeometry.distanceToPolyline(coordinate(37.001, 127.0005), square.take(2)) shouldBe (111.32 plusOrMinus 0.01)
        }
        then("the convex hull draft encloses sources with twenty meters of margin") {
            val hull = MarketGeometry.boundaryDraft(square)
            hull.first() shouldBe hull.last()
            square.all { MarketGeometry.contains(it, hull) } shouldBe true
            square.forEach { point -> MarketGeometry.distanceToPolyline(point, hull).let { (it >= 19.99) shouldBe true } }
        }
        then("a polyline touching a boundary vertex and returning outside is not an entrance") {
            val tangent = MarketPath(1, null, false, listOf(coordinate(36.999, 127.0),
                coordinate(37.0, 127.0), coordinate(37.0, 126.999)), MarketGeometrySource.OSM, id = 1)
            MarketGeometry.entranceCandidates(square, listOf(tangent)).size shouldBe 0
        }
        then("outside travel along the boundary and back outside yields no entrance") {
            val run = MarketPath(1, null, false, listOf(coordinate(36.9995, 127.0002),
                coordinate(37.0, 127.0002), coordinate(37.0, 127.0008), coordinate(36.9995, 127.0008)),
                MarketGeometrySource.OSM, id = 1)
            MarketGeometry.entranceCandidates(square, listOf(run)).size shouldBe 0
        }
        then("an actual polyline crossing at a shared vertex yields one entrance") {
            val crossing = MarketPath(1, null, false, listOf(coordinate(36.999, 126.999),
                coordinate(37.0, 127.0), coordinate(37.0005, 127.0005)), MarketGeometrySource.OSM, id = 1)
            MarketGeometry.entranceCandidates(square, listOf(crossing)).map { it.coordinate } shouldBe listOf(coordinate(37.0, 127.0))
        }
        then("manual boundaries and paths survive source reload") {
            val manual = MarketBoundary(1, square, MarketGeometrySource.MANUAL)
            manual.reloadSource(MarketBoundary(1, square.reversed(), MarketGeometrySource.OSM)) shouldBe manual
            val path = MarketPath(1, "manual", true, square.take(2), MarketGeometrySource.MANUAL, id = 4)
            path.reloadSource(path.copy(name = "upstream", source = MarketGeometrySource.OSM)) shouldBe path
        }
    }
    given("membership priority") {
        val boundary = MarketBoundary(1, square, MarketGeometrySource.OSM)
        val wholeRoad = MarketRoadRule(1, "오리로", MarketMembershipStatus.IN, "시장 큰길")
        then("whole-road rule works with no boundary and no building number") {
            MarketStoreJudge.judge(store(address = null), null, emptyList(), listOf(wholeRoad)).let {
                it.membership shouldBe MarketMembershipStatus.IN; it.judgedBy shouldBe MarketJudgedBy.ROAD_RULE
            }
        }
        then("building range is inclusive and matches road name exactly") {
            val rule = wholeRoad.copy(buildingNoFrom = 960, buildingNoTo = 964)
            MarketStoreJudge.judge(store(), null, emptyList(), listOf(rule)).membership shouldBe MarketMembershipStatus.IN
            MarketStoreJudge.judge(store(address = "오리로 965"), null, emptyList(), listOf(rule)).judgedBy shouldBe MarketJudgedBy.INGEST
            MarketStoreJudge.judge(store("광명로"), null, emptyList(), listOf(rule)).judgedBy shouldBe MarketJudgedBy.INGEST
            rule.copy(buildingNoTo = null).matches("오리로", 1000) shouldBe true
            rule.copy(buildingNoFrom = null).matches("오리로", 10) shouldBe true
        }
        then("missing boundary coordinates yield UNKNOWN and paired coordinate overrides participate in judgment") {
            val missing = store().copy(latitude = null, longitude = null)
            MarketStoreJudge.judge(missing, boundary, emptyList(), listOf(wholeRoad)).membership shouldBe MarketMembershipStatus.UNKNOWN
            val overrides = listOf(
                MarketStoreOverride(1, MarketStoreField.LATITUDE, "37.0005", "현장", 1, MarketActorKind.ADMIN),
                MarketStoreOverride(1, MarketStoreField.LONGITUDE, "127.0005", "현장", 1, MarketActorKind.ADMIN))
            MarketStoreJudge.judge(missing, boundary, emptyList(), emptyList(), overrides).membership shouldBe MarketMembershipStatus.IN
        }
        then("a same-road line within 25m takes priority over a closer unnamed line") {
            val near = MarketPath(1, null, false, listOf(coordinate(37.0, 127.0005), coordinate(37.001, 127.0005)), MarketGeometrySource.OSM, id = 2)
            val sameRoad = near.copy(name = "오리로", named = true, id = 3,
                geometry = listOf(coordinate(37.0, 127.0007), coordinate(37.001, 127.0007)))
            MarketStoreJudge.judge(store(), boundary, listOf(near, sameRoad), emptyList()).let {
                it.pathId shouldBe 3; it.needsReview shouldBe false
            }
            val far = sameRoad.copy(geometry = listOf(coordinate(37.0, 127.001), coordinate(37.001, 127.001)))
            MarketStoreJudge.judge(store(), boundary, listOf(near, far), emptyList()).let {
                it.pathId shouldBe 2; it.needsReview shouldBe true
            }
        }
        then("override wins over boundary, boundary wins over rule, fallback keeps ingest") {
            val override = MarketStoreOverride(1, MarketStoreField.MEMBERSHIP, "OUT", "예외", 1, MarketActorKind.ADMIN)
            MarketStoreJudge.judge(store(), boundary, emptyList(), listOf(wholeRoad), listOf(override)).judgedBy shouldBe MarketJudgedBy.OVERRIDE
            MarketStoreJudge.judge(store(), boundary, emptyList(), listOf(wholeRoad.copy(membership = MarketMembershipStatus.OUT))).let {
                it.membership shouldBe MarketMembershipStatus.IN; it.judgedBy shouldBe MarketJudgedBy.BOUNDARY
            }
            MarketStoreJudge.judge(store(), null, emptyList(), emptyList()).let {
                it.membership shouldBe MarketMembershipStatus.OUT; it.judgedBy shouldBe MarketJudgedBy.INGEST
                it.pathId shouldBe null; it.needsReview shouldBe false
            }
        }
    }
    given("Gwangmyeong raw fixture (OSM 2026-10-15)") {
        // Read only raw geometry, name/coordinate/road fields; script-derived store fields are not inputs.
        val fixture = JsonMapper.builder().build().readTree(requireNotNull(javaClass.getResourceAsStream("/market/gwangmyeong_osm.json")))
        fun points(node: tools.jackson.databind.JsonNode) = (0 until node.size()).map { coordinate(node[it][0].asDouble(), node[it][1].asDouble()) }
        val polygon = points(fixture["poly"])
        val boundary = MarketBoundary(1, polygon, MarketGeometrySource.OSM)
        val paths = fixture["ped"].mapIndexed { index, row -> MarketPath(1, row["label"].asText(), row["named"].asBoolean(),
            points(row["g"]), MarketGeometrySource.OSM, id = index.toLong() + 1) }
        val stores = fixture["stores"].mapIndexed { index, row -> MarketStore(1, row["n"].asText(), MarketStoreSource.ONNURI,
            sourceKey = "$index", onnuriKey = "$index", onnuriRaw = "{}", latitude = row["la"].asDouble(),
            longitude = row["lo"].asDouble(), roadName = row["r"].asText(), id = index.toLong() + 1) }
        then("recomputes 153 inside, 29 main-road stores, and 104 automatic versus 49 review assignments") {
            val inside = stores.map { it to MarketStoreJudge.judge(it, boundary, paths, emptyList()) }
                .filter { it.second.membership == MarketMembershipStatus.IN }
            inside.size shouldBe 153
            inside.count { it.first.roadName == "오리로" } shouldBe 12
            inside.count { it.first.roadName == "광명로" } shouldBe 17
            inside.count { !it.second.needsReview } shouldBe 104
            inside.count { it.second.needsReview } shouldBe 49
            paths.size shouldBe 14
            println("GWANGMYEONG inside=${inside.size} mainRoad=29 auto=${inside.count { !it.second.needsReview }} review=${inside.count { it.second.needsReview }} paths=${paths.size}")
        }
        then("recomputes nine entrances from boundary intersections and compares reference coordinates") {
            val candidates = MarketGeometry.entranceCandidates(polygon, paths)
            println("GWANGMYEONG computedEntrances=${candidates.size} referenceEntrances=${fixture["ent"].size()}")
            candidates.size shouldBe 9
            fixture["ent"].forEach { reference ->
                val point = coordinate(reference["p"][0].asDouble(), reference["p"][1].asDouble())
                candidates.any { MarketGeometry.distanceToSegment(point, it.coordinate, it.coordinate) < 0.02 } shouldBe true
            }
        }
    }
})
