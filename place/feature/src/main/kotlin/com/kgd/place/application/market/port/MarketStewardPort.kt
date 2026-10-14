package com.kgd.place.application.market.port

import com.kgd.place.domain.market.model.MarketSteward
import com.kgd.place.domain.market.model.MarketStewardStatus

interface MarketStewardPort {
    fun find(marketId: Long, memberId: Long): MarketSteward?
    fun marketIdById(id: Long): Long?
    fun lockById(id: Long): MarketSteward?
    fun list(status: MarketStewardStatus?, page: Int, size: Int): Pair<List<MarketSteward>, Long>
    fun save(row: MarketSteward): MarketSteward
}
