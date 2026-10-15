package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.port.MarketGeometryQueryPort
import com.kgd.place.application.market.port.MarketJudgmentSavePort
import com.kgd.place.domain.market.model.*
import com.kgd.place.infrastructure.persistence.market.repository.*
import com.kgd.place.infrastructure.persistence.market.entity.MarketStoreJpaEntity
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper

@Component
class MarketGeometryRepositoryAdapter(
    private val boundaries: MarketBoundaryJpaRepository,
    private val paths: MarketPathJpaRepository,
    private val rules: MarketRoadRuleJpaRepository,
) : MarketGeometryQueryPort, MarketJudgmentSavePort {
    @PersistenceContext(unitName = "place")
    private lateinit var entityManager: EntityManager
    private val json = JsonMapper.builder().build()
    private fun coordinates(raw: String): List<MarketCoordinate> {
        val array = json.readTree(raw)
        require(array.isArray)
        return (0 until array.size()).map { index ->
            val point = array[index]
            require(point.isArray && point.size() == 2 && point[0].isNumber && point[1].isNumber)
            MarketCoordinate(point[0].asDouble(), point[1].asDouble())
        }
    }
    override fun findBoundary(marketId: Long): MarketBoundary? = boundaries.findById(marketId).orElse(null)?.let {
        MarketBoundary(it.marketId, coordinates(it.polygon), it.source, it.osmType, it.osmId, it.fetchedAt)
    }
    override fun findPaths(marketId: Long): List<MarketPath> = paths.findAllByMarketIdOrderBySortAscIdAsc(marketId).map {
        MarketPath(it.marketId, it.name, it.named, coordinates(it.geometry), it.source, it.osmWayId, it.sort, it.id)
    }
    override fun findRoadRules(marketId: Long): List<MarketRoadRule> = rules.findAllByMarketIdOrderByIdAsc(marketId).map {
        MarketRoadRule(it.marketId, it.roadName, it.membership, it.reason, it.buildingNoFrom, it.buildingNoTo, it.id)
    }
    override fun saveJudgment(marketId: Long, storeId: Long, judgment: MarketStoreJudgment) {
        // JPQL bulk update bypasses full source-row merging. Both market scope and MANUAL protection live in the write.
        entityManager.flush()
        val changed = entityManager.createQuery("""
            update MarketStoreJpaEntity s set s.judgedMembership = :membership, s.judgedBy = :by,
                s.pathId = :path, s.needsReview = :review
            where s.id = :id and s.marketId = :market and s.source <> :manual
        """.trimIndent()).setParameter("membership", judgment.membership).setParameter("by", judgment.judgedBy)
            .setParameter("path", judgment.pathId).setParameter("review", judgment.needsReview)
            .setParameter("id", storeId).setParameter("market", marketId).setParameter("manual", MarketStoreSource.MANUAL)
            .executeUpdate()
        check(changed == 1) { "Source store not found in market" }
        entityManager.refresh(entityManager.getReference(MarketStoreJpaEntity::class.java, storeId))
    }
}
