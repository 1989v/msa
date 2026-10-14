package com.kgd.place.application.market.usecase

import com.kgd.place.domain.market.model.MarketSteward
import com.kgd.place.domain.market.model.MarketStewardStatus

interface MarketStewardUseCase {
    fun apply(memberId: Long, marketId: Long, request: Application): MarketSteward
    fun current(memberId: Long, marketId: Long): MarketSteward?
    fun list(memberId: Long, status: MarketStewardStatus?, page: Int, size: Int): EditMarketUseCase.Page<MarketSteward>
    fun decide(memberId: Long, id: Long, action: Action): MarketSteward
    /** Resolve from persistence for each request; callers must never cache this grant. */
    fun actor(memberId: Long, marketId: Long): MarketEditorActor

    data class Application(val orgName: String, val contact: String)
    enum class Action { APPROVE, REJECT, SUSPEND, RESTORE }
    data class Decision(val action: Action)
}
