package com.kgd.place.application.market.usecase

import com.kgd.place.domain.market.model.*
import java.time.LocalDateTime

interface MarketGeometryUseCase {
    fun geometry(actor: MarketEditorActor, marketId: Long): Geometry
    fun edit(actor: MarketEditorActor, marketId: Long, target: MarketChangeTarget, id: Long?, request: Edit?, reason: String): Map<String, Any?>
    fun reset(actor: MarketEditorActor, marketId: Long, request: Reset): Map<String, Any?>
    fun needsReview(actor: MarketEditorActor, marketId: Long): List<Review>
    fun assign(actor: MarketEditorActor, marketId: Long, storeId: Long, request: Assignment): Map<String, Rejudge>
    fun ingest(marketId: Long, request: Osm)
    fun revert(actor: MarketEditorActor, change: MarketChangeLog)
    data class Rejudge(val changedStores: Int)
    data class Boundary(val polygon: List<List<Double>>, val source: MarketGeometrySource, val osmId: String? = null)
    data class Path(val id: Long?, val name: String?, val named: Boolean, val geometry: List<List<Double>>, val source: MarketGeometrySource)
    data class Entrance(val id: Long?, val lat: Double, val lng: Double, val pathId: Long?, val label: String?, val source: MarketGeometrySource)
    data class Geo(val centerLat: Double?, val centerLng: Double?, val radiusM: Double, val centerOverridden: Boolean, val radiusOverridden: Boolean)
    data class RoadRule(val id: Long?, val roadName: String, val buildingNoFrom: Int?, val buildingNoTo: Int?, val membership: MarketMembershipStatus, val reason: String)
    data class Road(val name: String?, val highway: String?, val geometry: List<List<Double>>)
    data class Background(val roads: List<Road>)
    data class Geometry(val boundary: Boundary?, val paths: List<Path>, val entrances: List<Entrance>, val roadRules: List<RoadRule>, val geo: Geo, val background: Background, val attribution: List<String>)
    data class Edit(val polygon: List<List<Double>> = emptyList(), val name: String? = null, val geometry: List<List<Double>> = emptyList(),
        val lat: Double? = null, val lng: Double? = null, val pathId: Long? = null, val label: String? = null,
        val roadName: String? = null, val buildingNoFrom: Int? = null, val buildingNoTo: Int? = null, val membership: MarketMembershipStatus? = null,
        val centerLat: Double? = null, val centerLng: Double? = null, val radiusM: Double? = null, val reason: String)
    data class Reset(val to: MarketGeometrySource, val reason: String)
    data class Assignment(val pathId: Long?, val reason: String)
    data class Review(val storeId: Long, val name: String, val roadAddress: String?, val lat: Double?, val lng: Double?, val pathId: Long?, val suggestedPathId: Long?)
    data class Osm(val fetchedAt: LocalDateTime, val raw: Map<String, Any?>, val boundary: Boundary?, val paths: List<OsmPath>)
    data class OsmPath(val osmWayId: Long, val name: String?, val geometry: List<List<Double>>)
}

fun List<MarketCoordinate>.arrays(): List<List<Double>> = map { listOf(it.latitude, it.longitude) }
fun List<List<Double>>.coordinates(): List<MarketCoordinate> = map { require(it.size == 2); MarketCoordinate(it[0], it[1]) }
fun MarketBoundary.view() = MarketGeometryUseCase.Boundary(polygon.arrays(), source, osmId?.let { "${osmType ?: "way"}/$it" })
fun MarketPath.view() = MarketGeometryUseCase.Path(id, name, named, geometry.arrays(), source)
fun MarketEntrance.view() = MarketGeometryUseCase.Entrance(id, latitude, longitude, viaPathId, label, source)
fun MarketRoadRule.view() = MarketGeometryUseCase.RoadRule(id, roadName, buildingNoFrom, buildingNoTo, membership, reason)
fun Market.geoView() = MarketGeometryUseCase.Geo(centerOverrideLat ?: latitude, centerOverrideLng ?: longitude,
    radiusOverrideM ?: if (marketType == MarketType.BUILDING) 150.0 else 300.0, centerOverrideLat != null, radiusOverrideM != null)
