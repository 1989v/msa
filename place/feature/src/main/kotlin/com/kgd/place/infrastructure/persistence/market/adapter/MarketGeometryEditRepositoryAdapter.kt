package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.port.MarketGeometryEditPort
import com.kgd.place.application.market.usecase.arrays
import com.kgd.place.domain.market.model.*
import com.kgd.place.infrastructure.persistence.market.entity.MarketOsmRawId
import com.kgd.place.infrastructure.persistence.market.repository.*
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.support.GeneratedKeyHolder
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper
import java.sql.Statement
import javax.sql.DataSource

@Component
class MarketGeometryEditRepositoryAdapter(
    @Qualifier("placeDataSource") dataSource: DataSource,
    private val entrances: MarketEntranceJpaRepository,
    private val raw: MarketOsmRawJpaRepository,
) : MarketGeometryEditPort {
    private val jdbc = JdbcTemplate(dataSource)
    private val json = JsonMapper.builder().build()
    @PersistenceContext(unitName = "place") private lateinit var em: EntityManager
    private fun flush() { em.flush(); em.clear() }
    private fun values(fields: Map<String, Any?>) = fields.values.map { if (it is Enum<*>) it.name else it }.toTypedArray()
    private fun upsert(table: String, key: String, id: Long?, fields: Map<String, Any?>): Long {
        flush()
        val all = if (id == null) fields else linkedMapOf<String, Any?>(key to id) + fields
        val sql = "INSERT INTO $table (${all.keys.joinToString()}) VALUES (${all.keys.joinToString { "?" }})" +
            " ON DUPLICATE KEY UPDATE " + fields.keys.joinToString { "$it = VALUES($it)" }
        val holder = GeneratedKeyHolder()
        jdbc.update({ connection -> connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS).also { statement ->
            values(all).forEachIndexed { index, value -> statement.setObject(index + 1, value) }
        } }, holder)
        return id ?: requireNotNull(holder.key).toLong()
    }
    private fun delete(table: String, marketId: Long, id: Long?) {
        flush(); jdbc.update("DELETE FROM $table WHERE market_id = ? AND id = ?", marketId, requireNotNull(id))
    }
    override fun findEntrances(marketId: Long) = entrances.findAllByMarketId(marketId).sortedBy { it.id }.map {
        MarketEntrance(it.marketId, it.latitude, it.longitude, it.viaPathId, it.label, it.source, it.id)
    }
    override fun findRaw(marketId: Long, kind: MarketOsmKind): MarketOsmRaw? = raw.findById(MarketOsmRawId(marketId, kind)).orElse(null)?.let {
        MarketOsmRaw(it.marketId, it.kind, it.payload, it.fetchedAt)
    }
    override fun findRawFetchedAt(marketId: Long): java.time.LocalDateTime? =
        jdbc.queryForObject("SELECT MAX(fetched_at) FROM market_osm_raw WHERE market_id = ?", java.time.LocalDateTime::class.java, marketId)
    override fun saveRaw(raw: MarketOsmRaw) {
        flush()
        jdbc.update("""INSERT INTO market_osm_raw (market_id,kind,payload,fetched_at) VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE payload=VALUES(payload), fetched_at=VALUES(fetched_at)""",
            raw.marketId, raw.kind.name, raw.payload, raw.fetchedAt)
    }
    override fun boundary(marketId: Long, value: MarketBoundary?) {
        if (value == null) { flush(); jdbc.update("DELETE FROM market_boundary WHERE market_id = ?", marketId); return }
        require(value.marketId == marketId)
        upsert("market_boundary", "market_id", marketId, linkedMapOf("polygon" to json.writeValueAsString(value.polygon.arrays()),
            "source" to value.source, "osm_type" to value.osmType, "osm_id" to value.osmId, "fetched_at" to value.fetchedAt))
    }
    override fun path(marketId: Long, id: Long?, value: MarketPath?): MarketPath? {
        if (value == null) { delete("market_path", marketId, id); return null }
        require(value.marketId == marketId)
        val saved = upsert("market_path", "id", id, linkedMapOf("market_id" to marketId, "name" to value.name,
            "named" to value.named, "geometry" to json.writeValueAsString(value.geometry.arrays()), "source" to value.source,
            "osm_way_id" to value.osmWayId, "sort_order" to value.sort))
        return value.copy(id = saved)
    }
    override fun entrance(marketId: Long, id: Long?, value: MarketEntrance?): MarketEntrance? {
        if (value == null) { delete("market_entrance", marketId, id); return null }
        require(value.marketId == marketId)
        return value.copy(id = upsert("market_entrance", "id", id, linkedMapOf("market_id" to marketId,
            "lat" to value.latitude, "lng" to value.longitude, "via_path_id" to value.viaPathId, "label" to value.label, "source" to value.source)))
    }
    override fun roadRule(marketId: Long, id: Long?, value: MarketRoadRule?): MarketRoadRule? {
        if (value == null) { delete("market_road_rule", marketId, id); return null }
        require(value.marketId == marketId)
        return value.copy(id = upsert("market_road_rule", "id", id, linkedMapOf("market_id" to marketId,
            "road_name" to value.roadName, "building_no_from" to value.buildingNoFrom, "building_no_to" to value.buildingNoTo,
            "membership" to value.membership, "reason" to value.reason)))
    }
    override fun geo(marketId: Long, lat: Double?, lng: Double?, radius: Double?) {
        flush(); check(jdbc.update("UPDATE market SET center_override_lat=?, center_override_lng=?, radius_override_m=? WHERE id=?",
            lat, lng, radius, marketId) == 1)
    }
}
