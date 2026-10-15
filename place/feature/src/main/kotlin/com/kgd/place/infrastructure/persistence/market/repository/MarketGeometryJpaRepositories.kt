package com.kgd.place.infrastructure.persistence.market.repository

import com.kgd.place.infrastructure.persistence.market.entity.*
import org.springframework.data.jpa.repository.JpaRepository

interface MarketBoundaryJpaRepository : JpaRepository<MarketBoundaryJpaEntity, Long>
interface MarketPathJpaRepository : JpaRepository<MarketPathJpaEntity, Long> {
    fun findAllByMarketIdOrderBySortAscIdAsc(marketId: Long): List<MarketPathJpaEntity>
}
interface MarketEntranceJpaRepository : JpaRepository<MarketEntranceJpaEntity, Long> {
    fun findAllByMarketId(marketId: Long): List<MarketEntranceJpaEntity>
}
interface MarketRoadRuleJpaRepository : JpaRepository<MarketRoadRuleJpaEntity, Long> {
    fun findAllByMarketIdOrderByIdAsc(marketId: Long): List<MarketRoadRuleJpaEntity>
}
interface MarketOsmRawJpaRepository : JpaRepository<MarketOsmRawJpaEntity, MarketOsmRawId>
