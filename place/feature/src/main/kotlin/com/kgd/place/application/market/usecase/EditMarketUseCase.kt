package com.kgd.place.application.market.usecase

import com.kgd.place.domain.market.model.*
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/** Trusted entry points construct actors; STEWARD entry points must resolve active market grants each request. */
data class MarketEditorActor(val kind: MarketActorKind, val memberId: Long, val allowedMarketIds: Set<Long> = emptySet()) {
    init { require(memberId > 0) }
    fun authorize(marketId: Long) {
        if (kind != MarketActorKind.ADMIN && marketId !in allowedMarketIds) throw BusinessException(ErrorCode.FORBIDDEN)
    }
}

class MarketEditConflict(message: String) : RuntimeException(message)

interface EditMarketUseCase {
    fun list(actor: MarketEditorActor, name: String, page: Int, size: Int): Page<Market>
    fun detail(actor: MarketEditorActor, marketId: Long): Detail
    fun override(actor: MarketEditorActor, marketId: Long, storeId: Long, request: OverrideRequest)
    fun manualStore(actor: MarketEditorActor, marketId: Long, storeId: Long?, request: ManualStoreRequest): MarketStore
    fun deleteStore(actor: MarketEditorActor, marketId: Long, storeId: Long)
    fun zone(actor: MarketEditorActor, marketId: Long, zoneId: Long?, request: ZoneRequest): MarketZone
    fun deleteZone(actor: MarketEditorActor, marketId: Long, zoneId: Long)
    fun orderZones(actor: MarketEditorActor, marketId: Long, ids: List<Long>)
    fun history(actor: MarketEditorActor, marketId: Long, page: Int, size: Int): Page<MarketChangeLog>
    fun revert(actor: MarketEditorActor, marketId: Long, logId: Long)

    data class Page<T>(val items: List<T>, val total: Long, val page: Int, val size: Int)
    data class Detail(val market: Market, val zones: List<MarketZone>, val stores: List<Store>)
    data class Store(val source: MarketStore, val display: MarketStoreDisplay, val overrides: List<MarketStoreOverride>)
    /** clear removes selected overrides, values applies explicit values including null; both require a reason. */
    data class OverrideRequest(val values: Map<String, String?> = emptyMap(), val clear: Set<String> = emptySet(), val reason: String)
    data class ManualStoreRequest(
        val name: String, val items: String? = null, val zoneId: Long? = null,
        val membership: MarketMembershipStatus = MarketMembershipStatus.IN,
        val pinKind: MarketPinKind = MarketPinKind.EXACT, val latitude: Double? = null, val longitude: Double? = null,
        val referenceStoreId: Long? = null, val relativePosition: String? = null, val positionNote: String? = null,
    )
    data class ZoneRequest(
        val name: String, val kind: MarketZoneKind, val parentId: Long? = null,
        val polygonWkt: String? = null, val buildingName: String? = null, val dong: String? = null,
        val floor: String? = null, val sortOrder: Int = 0,
    )
}
