package com.kgd.place.presentation.market.dto

import com.kgd.place.application.market.usecase.QueryMarketUseCase
import com.kgd.place.domain.market.model.Market
import com.kgd.place.domain.market.model.MarketActorKind
import com.kgd.place.domain.market.model.MarketMembershipStatus
import com.kgd.place.domain.market.model.MarketPinKind
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketType
import com.kgd.place.domain.market.model.MarketZone
import com.kgd.place.domain.market.model.MarketZoneKind
import com.kgd.place.domain.market.model.MarketZoneSource

/** Public fields only: upstream payloads and editorial member IDs never leave this boundary. */
data class MarketResponse(val market: Info, val zones: List<Zone>, val stores: List<Store>) {
    data class Attribution(val name: String, val url: String, val license: String)

    data class Info(
        val id: Long?, val contentId: String, val name: String, val marketType: MarketType,
        val latitude: Double?, val longitude: Double?, val roadAddress: String?, val jibunAddress: String?,
        val marketInfoMatched: Boolean, val sourceKey: String?, val sourceMarketType: String?,
        val storeCountRaw: String?, val openingCycle: String?, val facilities: String?, val attribution: Attribution?,
    )

    data class Zone(
        val id: Long?, val parentId: Long?, val kind: MarketZoneKind, val name: String,
        val source: MarketZoneSource, val roadName: String?, val buildingName: String?,
        val dong: String?, val floor: String?, val polygonWkt: String?, val sortOrder: Int,
        val children: List<Zone>,
    )

    data class Store(
        val id: Long?, val name: String, val items: String?, val zoneId: Long?,
        val membership: MarketMembershipStatus, val latitude: Double?, val longitude: Double?,
        val roadAddress: String?, val jibunAddress: String?, val buildingManagementNo: String?,
        val buildingName: String?, val dong: String?, val floor: String?, val ho: String?, val roadName: String?,
        val categoryMajor: String?, val categoryMid: String?, val categorySub: String?,
        val sources: List<MarketStoreSource>, val pinKind: MarketPinKind, val manual: Boolean,
        val actorKind: MarketActorKind?, val referenceStoreId: Long?, val relativePosition: String?, val positionNote: String?,
    )

    companion object {
        fun from(result: QueryMarketUseCase.MarketResult): MarketResponse = MarketResponse(
            market = info(result.market), zones = zones(result.zones), stores = result.stores.map { row ->
                val source = row.source
                val display = row.display
                Store(
                    id = source.id, name = display.name, items = display.items, zoneId = display.zoneId,
                    membership = display.membership.status, latitude = display.coordinate?.latitude,
                    longitude = display.coordinate?.longitude, roadAddress = source.roadAddress,
                    jibunAddress = source.jibunAddress, buildingManagementNo = source.buildingManagementNo,
                    buildingName = source.buildingName, dong = source.dong, floor = source.floor, ho = source.ho,
                    roadName = source.roadName, categoryMajor = source.categoryMajor, categoryMid = source.categoryMid,
                    categorySub = source.categorySub, sources = row.sources, pinKind = display.pinKind,
                    manual = source.source == MarketStoreSource.MANUAL, actorKind = source.actorKind,
                    referenceStoreId = source.referenceStoreId, relativePosition = source.relativePosition,
                    positionNote = source.positionNote,
                )
            },
        )

        private fun info(market: Market): Info = Info(
            id = market.id, contentId = market.attractionContentId, name = market.name, marketType = market.marketType,
            latitude = market.latitude, longitude = market.longitude, roadAddress = market.roadAddress,
            jibunAddress = market.jibunAddress, marketInfoMatched = market.marketInfoMatched, sourceKey = market.sourceKey,
            sourceMarketType = market.sourceMarketType, storeCountRaw = market.storeCountRaw,
            openingCycle = market.openingCycle, facilities = market.facilities,
            attribution = if (market.marketInfoMatched) Attribution(
                "전국전통시장표준데이터", "https://www.data.go.kr/data/15012894/standard.do", "공공누리 제1유형 (출처표시)",
            ) else null,
        )

        private fun zones(rows: List<MarketZone>): List<Zone> {
            val ids = rows.mapNotNull { it.id }.toSet()
            val byParent = rows.groupBy { it.parentId }
            val order = compareBy<MarketZone> { it.sortOrder }.thenBy { it.id }.thenBy { it.name }
            fun node(row: MarketZone, ancestors: Set<Long>): Zone {
                val path = ancestors + listOfNotNull(row.id)
                val children = if (row.id == null) emptyList() else byParent[row.id].orEmpty()
                    .filter { it.id !in path }.sortedWith(order).map { node(it, path) }
                return Zone(row.id, row.parentId, row.kind, row.name, row.source, row.roadName, row.buildingName,
                    row.dong, row.floor, row.polygonWkt, row.sortOrder, children)
            }
            return rows.filter { it.parentId == null || it.parentId !in ids }.sortedWith(order).map { node(it, emptySet()) }
        }
    }
}
