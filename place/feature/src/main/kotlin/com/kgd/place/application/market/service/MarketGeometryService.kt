package com.kgd.place.application.market.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.*
import com.kgd.place.application.market.usecase.MarketGeometryUseCase.*
import com.kgd.place.domain.market.model.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule

@Service
class MarketGeometryService(
    private val editor: MarketEditorPort,
    private val query: MarketQueryPort,
    private val save: MarketSavePort,
    private val geometry: MarketGeometryQueryPort,
    private val writes: MarketGeometryEditPort,
    private val judge: RejudgeMarketUseCase,
) : MarketGeometryUseCase {
    private val json = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
    data class Snapshot(val type: String = "geometry", val boundary: MarketBoundary? = null, val path: MarketPath? = null,
        val entrance: MarketEntrance? = null, val roadRule: MarketRoadRule? = null, val geo: GeoOverride? = null, val reason: String? = null)
    data class GeoOverride(val lat: Double?, val lng: Double?, val radius: Double?)
    private fun access(actor: MarketEditorActor, id: Long, lock: Boolean = false): Market {
        require(actor.kind == MarketActorKind.ADMIN) { "Geometry editing requires admin" }; actor.authorize(id)
        return (if (lock) editor.lockMarket(id) else editor.findMarket(id)) ?: throw BusinessException(ErrorCode.NOT_FOUND)
    }
    private fun reason(value: String) { require(value.isNotBlank() && value.length <= 1000) { "Reason is required (max 1000 characters)" } }
    private fun pathRef(marketId: Long, id: Long?) { require(id == null || geometry.findPaths(marketId).any { it.id == id }) { "Path not in market" } }
    private fun checkPathDeletion(marketId: Long, id: Long) {
        require(writes.findEntrances(marketId).none { it.viaPathId == id }) { "Path has entrance references" }
        val stores = query.findStores(marketId)
        require(query.findOverrides(stores.mapNotNull { it.id }).none {
            it.field == MarketStoreField.PATH_ID && it.value?.toLongOrNull() == id
        }) { "Path has store corrections" }
    }
    private fun snapshot(market: Market, target: MarketChangeTarget, id: Long?): Snapshot {
        val marketId = requireNotNull(market.id)
        return when (target) {
            MarketChangeTarget.BOUNDARY -> Snapshot(boundary = geometry.findBoundary(marketId))
            MarketChangeTarget.PATH -> Snapshot(path = geometry.findPaths(marketId).find { it.id == id })
            MarketChangeTarget.ENTRANCE -> Snapshot(entrance = writes.findEntrances(marketId).find { it.id == id })
            MarketChangeTarget.ROAD_RULE -> Snapshot(roadRule = geometry.findRoadRules(marketId).find { it.id == id })
            MarketChangeTarget.MARKET_GEO -> Snapshot(geo = GeoOverride(market.centerOverrideLat, market.centerOverrideLng, market.radiusOverrideM))
            else -> throw IllegalArgumentException("Unsupported geometry target")
        }
    }
    private fun log(actor: MarketEditorActor, marketId: Long, target: MarketChangeTarget, id: Long, action: MarketChangeAction, before: Snapshot, after: Snapshot, why: String) {
        save.appendChange(MarketChangeLog(marketId, target, id, action, actor.memberId, actor.kind,
            json.writeValueAsString(before.copy(reason = why)), json.writeValueAsString(after.copy(reason = why))))
    }
    @Transactional(transactionManager = "placeTransactionManager", readOnly = true)
    override fun geometry(actor: MarketEditorActor, marketId: Long): Geometry {
        val market = access(actor, marketId)
        val boundary = geometry.findBoundary(marketId)
        val paths = geometry.findPaths(marketId)
        val roads = writes.findRaw(marketId, MarketOsmKind.ROADS)?.let { raw ->
            val root = json.readTree(raw.payload)
            val rows = if (root.isArray) root else root.path("elements")
            rows.filter { it.path("geometry").isArray }.map { row ->
                val tags = row.path("tags")
                Road(tags.path("name").asString(null), tags.path("highway").asString(null), (0 until row.path("geometry").size()).map { index ->
                    val it = row.path("geometry")[index]
                    if (it.isArray) listOf(it[0].asDouble(), it[1].asDouble()) else listOf(it.path("lat").asDouble(), it.path("lon").asDouble())
                })
            }
        }.orEmpty()
        val attribution = if (roads.isNotEmpty() || boundary?.source == MarketGeometrySource.OSM || paths.any { it.source == MarketGeometrySource.OSM }) listOf("© OpenStreetMap contributors") else emptyList()
        return Geometry(boundary?.view(), paths.map { it.view() }, writes.findEntrances(marketId).map { it.view().copy(pathId = it.viaPathId?.takeIf { id -> paths.any { path -> path.id == id } }) },
            geometry.findRoadRules(marketId).map { it.view() }, market.geoView(), Background(roads), attribution)
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun edit(actor: MarketEditorActor, marketId: Long, target: MarketChangeTarget, id: Long?, request: Edit?, reason: String): Map<String, Any?> {
        val market = access(actor, marketId, true); reason(reason)
        require(request != null || id != null)
        val before = snapshot(market, target, id)
        if (id != null && target in setOf(MarketChangeTarget.PATH, MarketChangeTarget.ENTRANCE, MarketChangeTarget.ROAD_RULE)) {
            require(before.path != null || before.entrance != null || before.roadRule != null) { "Geometry not in market" }
        }
        var savedId = id ?: marketId
        val result: Pair<String, Any?> = when (target) {
            MarketChangeTarget.BOUNDARY -> {
                val row = request?.let { MarketBoundary(marketId, it.polygon.coordinates(), MarketGeometrySource.MANUAL) }
                writes.boundary(marketId, row); "boundary" to row?.view()
            }
            MarketChangeTarget.PATH -> {
                if (request == null) checkPathDeletion(marketId, requireNotNull(id))
                val row = request?.let { require(it.name == null || it.name.length <= 300)
                    MarketPath(marketId, it.name?.takeIf(String::isNotBlank), !it.name.isNullOrBlank(), it.geometry.coordinates(), MarketGeometrySource.MANUAL,
                        osmWayId = before.path?.osmWayId, sort = before.path?.sort ?: 0, id = id) }
                val saved = writes.path(marketId, id, row); savedId = saved?.id ?: requireNotNull(id)
                "path" to saved?.view()
            }
            MarketChangeTarget.ENTRANCE -> {
                val row = request?.let { pathRef(marketId, it.pathId); require(it.label == null || it.label.length <= 300)
                    MarketEntrance(marketId, requireNotNull(it.lat), requireNotNull(it.lng), it.pathId, it.label, MarketGeometrySource.MANUAL, id) }
                val saved = writes.entrance(marketId, id, row); savedId = saved?.id ?: requireNotNull(id)
                "entrance" to saved?.view()
            }
            MarketChangeTarget.ROAD_RULE -> {
                val row = request?.let { require(it.roadName?.length?.let { n -> n <= 300 } != false)
                    MarketRoadRule(marketId, requireNotNull(it.roadName), requireNotNull(it.membership), reason, it.buildingNoFrom, it.buildingNoTo, id) }
                val saved = writes.roadRule(marketId, id, row); savedId = saved?.id ?: requireNotNull(id)
                "roadRule" to saved?.view()
            }
            MarketChangeTarget.MARKET_GEO -> {
                val r = requireNotNull(request)
                val changed = market.copy(centerOverrideLat = r.centerLat, centerOverrideLng = r.centerLng, radiusOverrideM = r.radiusM)
                writes.geo(marketId, r.centerLat, r.centerLng, r.radiusM); "geo" to changed.geoView()
            }
            else -> throw IllegalArgumentException("Unsupported geometry target")
        }
        val after = snapshot(requireNotNull(editor.findMarket(marketId)), target, savedId)
        log(actor, marketId, target, savedId, if (request == null) MarketChangeAction.DELETE else if (id == null && target != MarketChangeTarget.BOUNDARY && target != MarketChangeTarget.MARKET_GEO) MarketChangeAction.CREATE else MarketChangeAction.UPDATE, before, after, reason)
        return mapOf(result, "rejudge" to Rejudge(judge.rejudge(marketId)))
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun reset(actor: MarketEditorActor, marketId: Long, request: Reset): Map<String, Any?> {
        val market = access(actor, marketId, true); reason(request.reason)
        val before = snapshot(market, MarketChangeTarget.BOUNDARY, marketId)
        val boundary = when (request.to) {
            MarketGeometrySource.OSM -> osmBoundary(marketId)
            MarketGeometrySource.DERIVED -> {
                val stores = query.findStores(marketId)
                val overrides = query.findOverrides(stores.mapNotNull { it.id }).groupBy { it.storeId }
                val points = stores.map { MarketStoreDisplay.from(it, overrides[it.id].orEmpty()) }.filter { it.membership.status == MarketMembershipStatus.IN }.mapNotNull { it.coordinate }
                MarketBoundary(marketId, MarketGeometry.boundaryDraft(points), MarketGeometrySource.DERIVED)
            }
            else -> throw IllegalArgumentException("Reset must be OSM or DERIVED")
        }
        writes.boundary(marketId, boundary)
        log(actor, marketId, MarketChangeTarget.BOUNDARY, marketId, MarketChangeAction.UPDATE, before, Snapshot(boundary = boundary), request.reason)
        return mapOf("boundary" to boundary.view(), "rejudge" to Rejudge(judge.rejudge(marketId)))
    }
    private fun osmBoundary(marketId: Long): MarketBoundary {
        val raw = requireNotNull(writes.findRaw(marketId, MarketOsmKind.BOUNDARY)) { "No OSM boundary draft" }
        val root = json.readTree(raw.payload)
        val elements = if (root.isArray) root else root.path("elements")
        val element = requireNotNull(elements.firstOrNull { it.path("tags").path("amenity").asString("") == "marketplace" &&
            (it.path("geometry").isArray || it.path("members").isArray) }) { "No OSM marketplace boundary" }
        fun points(node: tools.jackson.databind.JsonNode): List<MarketCoordinate> = (0 until node.size()).map { index ->
            val point = node[index]
            require(point.path("lat").isNumber && point.path("lon").isNumber) { "Invalid OSM coordinate" }
            MarketCoordinate(point.path("lat").asDouble(), point.path("lon").asDouble())
        }
        val polygon = if (element.path("geometry").isArray) points(element.path("geometry")) else {
            val segments = element.path("members").filter { it.path("role").asString("") == "outer" }
                .map { points(it.path("geometry")) }.toMutableList()
            require(segments.isNotEmpty() && segments.all { it.size >= 2 }) { "Missing OSM outer geometry" }
            val ring = segments.removeAt(0).toMutableList()
            while (segments.isNotEmpty()) {
                val index = segments.indexOfFirst { it.first() == ring.last() || it.last() == ring.last() }
                require(index >= 0) { "Disconnected OSM outer rings are unsupported" }
                val segment = segments.removeAt(index)
                ring.addAll((if (segment.first() == ring.last()) segment else segment.reversed()).drop(1))
            }
            ring
        }
        require(polygon.firstOrNull() == polygon.lastOrNull()) { "OSM boundary must be closed" }
        return MarketBoundary(marketId, polygon, MarketGeometrySource.OSM, element.path("type").asString(), element.path("id").asLong(), raw.fetchedAt)
    }
    override fun needsReview(actor: MarketEditorActor, marketId: Long): List<Review> {
        access(actor, marketId)
        val stores = query.findStores(marketId)
        val overrides = query.findOverrides(stores.mapNotNull { it.id }).groupBy { it.storeId }
        return stores.filter { it.needsReview }.map { row ->
            val display = MarketStoreDisplay.from(row, overrides[row.id].orEmpty())
            val suggested = MarketStoreJudge.judge(row, geometry.findBoundary(marketId), geometry.findPaths(marketId), geometry.findRoadRules(marketId), overrides[row.id].orEmpty().filter { it.field != MarketStoreField.PATH_ID }).pathId
            Review(requireNotNull(row.id), display.name, row.roadAddress, display.coordinate?.latitude, display.coordinate?.longitude, row.pathId, suggested)
        }
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun assign(actor: MarketEditorActor, marketId: Long, storeId: Long, request: Assignment): Map<String, Rejudge> {
        access(actor, marketId, true); reason(request.reason); pathRef(marketId, request.pathId)
        val store = requireNotNull(query.findStores(marketId).find { it.id == storeId }) { "Store not in market" }
        val before = query.findOverrides(listOf(storeId)).sortedBy { it.field.name }
        val old = before.find { it.field == MarketStoreField.PATH_ID }
        val row = MarketStoreOverride(storeId, MarketStoreField.PATH_ID, request.pathId?.toString(), request.reason, actor.memberId, actor.kind, old?.id, old?.createdAt ?: java.time.LocalDateTime.now())
        editor.replaceOverrides(store, before.filter { it.field != MarketStoreField.PATH_ID } + row)
        save.appendChange(MarketChangeLog(marketId, MarketChangeTarget.STORE, storeId, MarketChangeAction.UPDATE, actor.memberId, actor.kind,
            json.writeValueAsString(MarketEditorService.Snapshot("overrides", overrides = before, reason = request.reason)),
            json.writeValueAsString(MarketEditorService.Snapshot("overrides", overrides = query.findOverrides(listOf(storeId)).sortedBy { it.field.name }, reason = request.reason))))
        return mapOf("rejudge" to Rejudge(judge.rejudge(marketId)))
    }
    @Transactional(transactionManager = "placeTransactionManager", readOnly = true)
    override fun stores(marketId: Long, membership: MarketMembershipStatus): List<StoreLocation> {
        editor.findMarket(marketId) ?: throw BusinessException(ErrorCode.NOT_FOUND)
        val rows = query.findStores(marketId)
        val overrides = query.findOverrides(rows.mapNotNull { it.id }).groupBy { it.storeId }
        return rows.map { row -> row to MarketStoreDisplay.from(row, overrides[row.id].orEmpty()) }
            .filter { it.second.membership.status == membership }.map { (row, display) ->
                StoreLocation(requireNotNull(row.id), display.coordinate?.latitude, display.coordinate?.longitude)
            }
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun ingest(marketId: Long, request: Osm) {
        editor.lockMarket(marketId) ?: throw BusinessException(ErrorCode.NOT_FOUND)
        require(request.raw.keys.containsAll(listOf("boundary", "paths", "roads")))
        require(request.paths.map { it.osmWayId }.distinct().size == request.paths.size)
        MarketOsmKind.entries.forEach { kind -> writes.saveRaw(MarketOsmRaw(marketId, kind,
            json.writeValueAsString(request.raw[kind.name.lowercase()]), request.fetchedAt)) }
        if (geometry.findBoundary(marketId)?.source != MarketGeometrySource.MANUAL) {
            val incoming = request.boundary?.let { row ->
                require(row.source != MarketGeometrySource.MANUAL)
                val osm = row.osmId?.split('/')
                MarketBoundary(marketId, row.polygon.coordinates(), row.source, osm?.first(), osm?.last()?.toLong(), request.fetchedAt)
            }
            writes.boundary(marketId, incoming)
        }
        val existing = geometry.findPaths(marketId)
        val keys = request.paths.map { it.osmWayId }.toSet()
        existing.filter { it.source == MarketGeometrySource.OSM && it.osmWayId !in keys }.forEach { writes.path(marketId, it.id, null) }
        request.paths.forEach { row ->
            require(row.osmWayId > 0)
            val old = existing.find { it.osmWayId == row.osmWayId }
            if (old?.source != MarketGeometrySource.MANUAL) writes.path(marketId, old?.id,
                MarketPath(marketId, row.name, !row.name.isNullOrBlank(), row.geometry.coordinates(), MarketGeometrySource.OSM, row.osmWayId, old?.sort ?: 0, old?.id))
        }
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun revert(actor: MarketEditorActor, change: MarketChangeLog) {
        val market = access(actor, change.marketId, true)
        val before = json.readValue(requireNotNull(change.beforeRaw), Snapshot::class.java).copy(reason = null)
        val after = json.readValue(requireNotNull(change.afterRaw), Snapshot::class.java).copy(reason = null)
        val current = snapshot(market, change.target, change.targetId)
        fun canonical(s: Snapshot) = s.copy(boundary = s.boundary?.copy(fetchedAt = null), reason = null)
        if (canonical(current) != canonical(after)) throw MarketEditConflict("Changed since this history row; revert newer edits first")
        when (change.target) {
            MarketChangeTarget.BOUNDARY -> writes.boundary(change.marketId, before.boundary)
            MarketChangeTarget.PATH -> {
                val path = before.path
                if (path == null) checkPathDeletion(change.marketId, change.targetId)
                if (path?.osmWayId != null && geometry.findPaths(change.marketId).any { it.id != path.id && it.osmWayId == path.osmWayId })
                    throw MarketEditConflict("OSM path was recreated; original ID cannot be restored")
                writes.path(change.marketId, change.targetId, path)
            }
            MarketChangeTarget.ENTRANCE -> { pathRef(change.marketId, before.entrance?.viaPathId); writes.entrance(change.marketId, change.targetId, before.entrance) }
            MarketChangeTarget.ROAD_RULE -> writes.roadRule(change.marketId, change.targetId, before.roadRule)
            MarketChangeTarget.MARKET_GEO -> { val g = requireNotNull(before.geo); writes.geo(change.marketId, g.lat, g.lng, g.radius) }
            else -> throw IllegalArgumentException("Unsupported geometry revert")
        }
        judge.rejudge(change.marketId)
        log(actor, change.marketId, change.target, change.targetId, MarketChangeAction.REVERT, current, before, "Revert ${change.id}")
    }
}
