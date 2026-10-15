package com.kgd.place.application.market.service

import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.EditMarketUseCase
import com.kgd.place.application.market.usecase.MarketEditorActor
import com.kgd.place.application.market.usecase.MarketEditConflict
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.domain.market.model.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule

@Service
class MarketEditorService(
    private val query: MarketQueryPort,
    private val save: MarketSavePort,
    private val editor: MarketEditorPort,
    private val geometryEditor: com.kgd.place.application.market.usecase.MarketGeometryUseCase? = null,
    private val rejudge: com.kgd.place.application.market.usecase.RejudgeMarketUseCase? = null,
) : EditMarketUseCase {
    private val json = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
    data class Snapshot(val type: String, val store: MarketStore? = null, val zone: MarketZone? = null,
        val overrides: List<MarketStoreOverride> = emptyList(), val reason: String? = null)

    private fun page(page: Int, size: Int) { require(page in 0..100_000 && size in 1..100) }
    private fun access(actor: MarketEditorActor, marketId: Long, lock: Boolean = false): Market {
        actor.authorize(marketId)
        return (if (lock) editor.lockMarket(marketId) else editor.findMarket(marketId)) ?: throw BusinessException(ErrorCode.NOT_FOUND)
    }
    private fun admin(actor: MarketEditorActor) {
        if (actor.kind != MarketActorKind.ADMIN) throw BusinessException(ErrorCode.FORBIDDEN)
    }
    override fun list(actor: MarketEditorActor, name: String, page: Int, size: Int): EditMarketUseCase.Page<Market> {
        admin(actor); page(page, size); require(name.length <= 300)
        val (items, total) = editor.listMarkets(name.trim(), page, size)
        return EditMarketUseCase.Page(items, total, page, size)
    }
    @Transactional(transactionManager = "placeTransactionManager", readOnly = true)
    override fun detail(actor: MarketEditorActor, marketId: Long): EditMarketUseCase.Detail {
        val market = access(actor, marketId)
        val stores = query.findStores(marketId)
        val overrides = query.findOverrides(stores.map { requireNotNull(it.id) }).groupBy { it.storeId }
        return EditMarketUseCase.Detail(market, query.findZones(marketId), stores.map {
            val rows = overrides[it.id].orEmpty()
            EditMarketUseCase.Store(it, MarketStoreDisplay.from(it, rows), rows)
        })
    }
    private fun store(marketId: Long, storeId: Long): MarketStore =
        requireNotNull(query.findStores(marketId).find { it.id == storeId }) { "Store not in market" }
    private fun rows(storeId: Long) = query.findOverrides(listOf(storeId)).sortedBy { it.field.name }
    private val fields = mapOf("name" to MarketStoreField.NAME, "items" to MarketStoreField.ITEMS,
        "zoneId" to MarketStoreField.ZONE_ID, "membership" to MarketStoreField.MEMBERSHIP,
        "latitude" to MarketStoreField.LATITUDE, "longitude" to MarketStoreField.LONGITUDE)
    private fun zoneRef(marketId: Long, zoneId: Long?) {
        require(zoneId == null || query.findZones(marketId).any { it.id == zoneId }) { "Zone not in market" }
    }
    private fun validateOverrides(store: MarketStore, rows: List<MarketStoreOverride>) {
        val display = MarketStoreDisplay.from(store, rows)
        zoneRef(store.marketId, display.zoneId)
    }
    private fun log(actor: MarketEditorActor, marketId: Long, target: MarketChangeTarget, id: Long,
        action: MarketChangeAction, before: Snapshot, after: Snapshot) {
        save.appendChange(MarketChangeLog(marketId, target, id, action, actor.memberId, actor.kind,
            json.writeValueAsString(before), json.writeValueAsString(after)))
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun override(actor: MarketEditorActor, marketId: Long, storeId: Long, request: EditMarketUseCase.OverrideRequest) {
        access(actor, marketId, true)
        require(request.reason.isNotBlank() && request.reason.length <= 1000)
        require(request.values.isNotEmpty() || request.clear.isNotEmpty())
        require(request.values.keys.intersect(request.clear).isEmpty())
        require((request.values.keys + request.clear).all { it in fields }) { "Unsupported override field" }
        // Each coordinate operation must set or clear both axes, never a mixed set/clear.
        require(("latitude" in request.values) == ("longitude" in request.values))
        require(("latitude" in request.clear) == ("longitude" in request.clear))
        val source = store(marketId, storeId)
        val before = rows(storeId)
        val changed = (request.values.keys + request.clear).map { fields.getValue(it) }.toSet()
        val proposed = before.filter { it.field !in changed } + request.values.map { (field, value) ->
            val old = before.find { it.field == fields.getValue(field) }
            MarketStoreOverride(storeId, fields.getValue(field), value, request.reason, actor.memberId, actor.kind,
                id = old?.id, createdAt = old?.createdAt ?: java.time.LocalDateTime.now())
        }
        validateOverrides(source, proposed)
        editor.replaceOverrides(source, proposed)
        log(actor, marketId, MarketChangeTarget.STORE, storeId, MarketChangeAction.UPDATE,
            Snapshot("overrides", overrides = before, reason = request.reason),
            Snapshot("overrides", overrides = rows(storeId), reason = request.reason))
        rejudge?.rejudge(marketId)
    }
    private fun validateManual(row: MarketStore) {
        require(row.source == MarketStoreSource.MANUAL)
        zoneRef(row.marketId, row.zoneId)
        require(row.name.length <= 300)
        require(row.relativePosition?.let { it.length <= 100 } != false)
        if (row.pinKind == MarketPinKind.EXACT) {
            require(row.latitude != null && row.longitude != null) { "Exact pin requires coordinates" }
            require(row.referenceStoreId == null && row.relativePosition == null)
        } else {
            require(!row.positionNote.isNullOrBlank()) { "Reference pin requires a memo" }
            require(row.latitude == null && row.longitude == null) { "Reference pins derive their location" }
            val reference = store(row.marketId, requireNotNull(row.referenceStoreId))
            require(reference.id != row.id && reference.pinKind == MarketPinKind.EXACT) { "Reference must be a distinct exact store" }
            val display = MarketStoreDisplay.from(reference, rows(requireNotNull(reference.id)))
            require(display.coordinate != null && display.membership.status == MarketMembershipStatus.IN) { "Reference has no visible coordinate" }
        }
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun manualStore(actor: MarketEditorActor, marketId: Long, storeId: Long?, request: EditMarketUseCase.ManualStoreRequest): MarketStore {
        access(actor, marketId, true)
        val before = storeId?.let { store(marketId, it) }
        require(before == null || before.source == MarketStoreSource.MANUAL) { "Source store is read-only" }
        val row = MarketStore(marketId, request.name, MarketStoreSource.MANUAL, items = request.items, zoneId = request.zoneId,
            membership = MarketMembership(request.membership), pinKind = request.pinKind,
            latitude = request.latitude, longitude = request.longitude, referenceStoreId = request.referenceStoreId,
            relativePosition = request.relativePosition, positionNote = request.positionNote,
            actorKind = before?.actorKind ?: actor.kind, createdByMemberId = before?.createdByMemberId ?: actor.memberId,
            id = before?.id, createdAt = before?.createdAt ?: java.time.LocalDateTime.now())
        validateManual(row)
        if (row.pinKind != MarketPinKind.EXACT) require(query.findStores(marketId).none { it.referenceStoreId == storeId && storeId != null })
        val result = save.saveStore(row)
        log(actor, marketId, MarketChangeTarget.STORE, requireNotNull(result.id),
            if (before == null) MarketChangeAction.CREATE else MarketChangeAction.UPDATE,
            Snapshot("manual", store = before, overrides = before?.id?.let(::rows).orEmpty()),
            Snapshot("manual", store = result, overrides = rows(requireNotNull(result.id))))
        return result
    }
    private fun deleteStoreChecked(marketId: Long, id: Long) {
        require(store(marketId, id).source == MarketStoreSource.MANUAL) { "Source store is read-only" }
        require(query.findStores(marketId).none { it.referenceStoreId == id }) { "Store is referenced" }
        require(rows(id).isEmpty()) { "Clear overrides before deleting a store" }
        editor.deleteManualStore(id)
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun deleteStore(actor: MarketEditorActor, marketId: Long, storeId: Long) {
        access(actor, marketId, true)
        val before = store(marketId, storeId)
        deleteStoreChecked(marketId, storeId)
        log(actor, marketId, MarketChangeTarget.STORE, storeId, MarketChangeAction.DELETE,
            Snapshot("manual", store = before), Snapshot("manual"))
    }
    private fun validateZone(zone: MarketZone) {
        require(zone.name.length <= 300 && zone.sortOrder >= 0)
        require(zone.buildingName?.let { it.length <= 300 } != false)
        require(listOf(zone.dong, zone.floor).all { it == null || it.length <= 100 })
        MarketPolygon.validate(zone.polygonWkt)
        val zones = query.findZones(zone.marketId).associateBy { it.id }
        var parent = zone.parentId
        val visited = mutableSetOf<Long>()
        zone.id?.let { visited.add(it) }
        while (parent != null) {
            require(visited.add(parent)) { "Zone hierarchy cycle" }
            parent = requireNotNull(zones[parent]) { "Parent zone not in market" }.parentId
        }
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun zone(actor: MarketEditorActor, marketId: Long, zoneId: Long?, request: EditMarketUseCase.ZoneRequest): MarketZone {
        access(actor, marketId, true)
        val before = zoneId?.let { id -> requireNotNull(query.findZones(marketId).find { it.id == id }) { "Zone not in market" } }
        if (before?.polygonWkt != null && request.polygonWkt == null) admin(actor)
        val row = MarketZone(marketId, request.kind, request.name, before?.source ?: MarketZoneSource.MANUAL,
            sourceKey = before?.sourceKey, parentId = request.parentId, buildingName = request.buildingName,
            dong = request.dong, floor = request.floor, polygonWkt = request.polygonWkt, sortOrder = request.sortOrder,
            roadName = before?.roadName, id = before?.id, createdAt = before?.createdAt ?: java.time.LocalDateTime.now())
        validateZone(row)
        val result = editor.saveEditedZone(row)
        log(actor, marketId, MarketChangeTarget.ZONE, requireNotNull(result.id),
            if (before == null) MarketChangeAction.CREATE else MarketChangeAction.UPDATE,
            Snapshot("zone", zone = before), Snapshot("zone", zone = result))
        return result
    }
    private fun deleteZoneChecked(marketId: Long, id: Long) {
        requireNotNull(query.findZones(marketId).find { it.id == id })
        require(query.findZones(marketId).none { it.parentId == id }) { "Zone has children" }
        val stores = query.findStores(marketId)
        require(stores.none { it.zoneId == id }) { "Zone has source assignments" }
        require(query.findOverrides(stores.map { requireNotNull(it.id) }).none {
            it.field == MarketStoreField.ZONE_ID && it.value?.toLongOrNull() == id
        }) { "Zone has override assignments" }
        editor.deleteZone(id)
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun deleteZone(actor: MarketEditorActor, marketId: Long, zoneId: Long) {
        access(actor, marketId, true); admin(actor)
        val before = requireNotNull(query.findZones(marketId).find { it.id == zoneId })
        deleteZoneChecked(marketId, zoneId)
        log(actor, marketId, MarketChangeTarget.ZONE, zoneId, MarketChangeAction.DELETE,
            Snapshot("zone", zone = before), Snapshot("zone"))
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun orderZones(actor: MarketEditorActor, marketId: Long, ids: List<Long>) {
        access(actor, marketId, true)
        val zones = query.findZones(marketId).associateBy { requireNotNull(it.id) }
        require(ids.size == ids.distinct().size && ids.toSet() == zones.keys) { "Order must contain each market zone once" }
        ids.forEachIndexed { index, id ->
            val before = zones.getValue(id)
            val result = editor.saveEditedZone(before.copy(sortOrder = index))
            log(actor, marketId, MarketChangeTarget.ZONE, id, MarketChangeAction.UPDATE,
                Snapshot("zone", zone = before), Snapshot("zone", zone = result))
        }
    }
    override fun history(actor: MarketEditorActor, marketId: Long, page: Int, size: Int): EditMarketUseCase.Page<MarketChangeLog> {
        access(actor, marketId); page(page, size)
        val (items, total) = editor.findChanges(marketId, page, size)
        return EditMarketUseCase.Page(items, total, page, size)
    }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun revert(actor: MarketEditorActor, marketId: Long, logId: Long) {
        access(actor, marketId, true); admin(actor)
        val change = requireNotNull(editor.findChange(logId)) { "Change not found" }
        require(change.marketId == marketId)
        if (change.target in setOf(MarketChangeTarget.BOUNDARY, MarketChangeTarget.PATH, MarketChangeTarget.ENTRANCE, MarketChangeTarget.ROAD_RULE, MarketChangeTarget.MARKET_GEO)) {
            requireNotNull(geometryEditor).revert(actor, change)
            return
        }
        val before = json.readValue(requireNotNull(change.beforeRaw), Snapshot::class.java).copy(reason = null)
        val after = json.readValue(requireNotNull(change.afterRaw), Snapshot::class.java).copy(reason = null)
        require(before.type == after.type)
        val current = when (after.type) {
            "overrides" -> { store(marketId, change.targetId); Snapshot("overrides", overrides = rows(change.targetId)) }
            "manual" -> Snapshot("manual", store = query.findStores(marketId).find { it.id == change.targetId }, overrides = rows(change.targetId))
            "zone" -> Snapshot("zone", zone = query.findZones(marketId).find { it.id == change.targetId })
            else -> error("Unsupported history snapshot")
        }
        // Database timestamp precision is microseconds; creation metadata is not editorial state.
        fun canonical(s: Snapshot): Snapshot {
            val epoch = java.time.LocalDateTime.of(1970, 1, 1, 0, 0)
            return s.copy(store = s.store?.copy(createdAt = epoch), zone = s.zone?.copy(createdAt = epoch),
                overrides = s.overrides.map { it.copy(createdAt = epoch) }, reason = null)
        }
        if (canonical(current) != canonical(after)) throw MarketEditConflict("Changed since this history row; revert newer edits first")
        when (before.type) {
            "overrides" -> {
                val source = store(marketId, change.targetId)
                validateOverrides(source, before.overrides)
                editor.replaceOverrides(source, before.overrides)
            }
            "manual" -> if (before.store == null) deleteStoreChecked(marketId, change.targetId) else {
                require(before.store.marketId == marketId && before.store.id == change.targetId)
                validateManual(before.store)
                if (before.store.pinKind != MarketPinKind.EXACT) require(query.findStores(marketId).none { it.referenceStoreId == change.targetId })
                save.saveStore(before.store)
            }
            "zone" -> if (before.zone == null) deleteZoneChecked(marketId, change.targetId) else {
                require(before.zone.marketId == marketId && before.zone.id == change.targetId)
                if (before.zone.sourceKey != null && query.findZones(marketId).any {
                    it.id != change.targetId && it.source == before.zone.source && it.sourceKey == before.zone.sourceKey
                }) throw MarketEditConflict("Source zone was recreated; original ID cannot be restored")
                validateZone(before.zone)
                editor.saveEditedZone(before.zone)
            }
        }
        rejudge?.rejudge(marketId)
        log(actor, marketId, change.target, change.targetId, MarketChangeAction.REVERT, current, before)
    }
}
