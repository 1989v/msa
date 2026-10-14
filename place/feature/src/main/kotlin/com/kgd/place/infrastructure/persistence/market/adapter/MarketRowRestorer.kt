package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.domain.market.model.*
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import javax.sql.DataSource

/** Explicit IDs are needed for history restoration. JdbcTemplate joins the same place transaction. */
@Component
class MarketRowRestorer(@Qualifier("placeDataSource") dataSource: DataSource) {
    private val jdbc = JdbcTemplate(dataSource)
    private fun insert(table: String, fields: Map<String, Any?>) {
        jdbc.update("INSERT INTO $table (${fields.keys.joinToString()}) VALUES (${fields.keys.joinToString { "?" }})",
            *fields.values.map { if (it is Enum<*>) it.name else it }.toTypedArray())
    }
    fun store(r: MarketStore) = insert("market_store", linkedMapOf(
        "id" to requireNotNull(r.id), "market_id" to r.marketId, "name" to r.name, "source" to r.source,
        "source_key" to r.sourceKey, "zone_id" to r.zoneId, "items" to r.items,
        "category_major" to r.categoryMajor, "category_mid" to r.categoryMid, "category_sub" to r.categorySub,
        "latitude" to r.latitude, "longitude" to r.longitude, "road_address" to r.roadAddress,
        "jibun_address" to r.jibunAddress, "building_management_no" to r.buildingManagementNo,
        "building_name" to r.buildingName, "dong" to r.dong, "floor" to r.floor, "ho" to r.ho,
        "road_name" to r.roadName, "onnuri_key" to r.onnuriKey, "sangga_key" to r.sanggaKey,
        "onnuri_raw" to r.onnuriRaw, "sangga_raw" to r.sanggaRaw, "membership" to r.membership.status,
        "pin_kind" to r.pinKind, "reference_store_id" to r.referenceStoreId, "relative_position" to r.relativePosition,
        "position_note" to r.positionNote, "actor_kind" to r.actorKind,
        "created_by_member_id" to r.createdByMemberId, "created_at" to r.createdAt))
    fun zone(r: MarketZone) = insert("market_zone", linkedMapOf(
        "id" to requireNotNull(r.id), "market_id" to r.marketId, "kind" to r.kind, "name" to r.name,
        "source" to r.source, "source_key" to r.sourceKey, "parent_id" to r.parentId, "road_name" to r.roadName,
        "building_name" to r.buildingName, "dong" to r.dong, "floor" to r.floor, "polygon_wkt" to r.polygonWkt,
        "sort_order" to r.sortOrder, "created_at" to r.createdAt))
    fun override(r: MarketStoreOverride) = insert("market_store_override", linkedMapOf(
        "id" to requireNotNull(r.id), "store_id" to r.storeId, "field" to r.field, "value" to r.value,
        "reason" to r.reason, "member_id" to r.memberId, "actor_kind" to r.actorKind, "created_at" to r.createdAt))
}
