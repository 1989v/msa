package com.kgd.place.application.market.port

/** Rebuild derived search rows inside the caller's place transaction. */
interface MarketSearchRefreshPort {
    fun refresh(marketId: Long)
}
