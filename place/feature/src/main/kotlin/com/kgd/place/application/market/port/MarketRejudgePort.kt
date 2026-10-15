package com.kgd.place.application.market.port

import com.kgd.place.domain.market.model.*

interface MarketGeometryQueryPort {
    fun findBoundary(marketId: Long): MarketBoundary?
    fun findPaths(marketId: Long): List<MarketPath>
    fun findRoadRules(marketId: Long): List<MarketRoadRule>
}

/** Restricted write shape: source membership, coordinates and payloads cannot be overwritten. */
interface MarketJudgmentSavePort {
    fun saveJudgment(marketId: Long, storeId: Long, judgment: MarketStoreJudgment)
}
