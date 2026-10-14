package com.kgd.place.domain.market.model

import java.time.LocalDateTime

data class MarketChangeLog(
    val marketId: Long,
    val target: MarketChangeTarget,
    val targetId: Long,
    val action: MarketChangeAction,
    val memberId: Long,
    val actorKind: MarketActorKind,
    val beforeRaw: String? = null,
    val afterRaw: String? = null,
    val id: Long? = null,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    init {
        require(marketId > 0 && targetId > 0 && memberId > 0)
    }
}
