package com.kgd.place.application.market.usecase

interface RejudgeMarketUseCase {
    /** Number of stores whose derived judgment or path assignment changed. */
    fun rejudge(marketId: Long): Int
}
