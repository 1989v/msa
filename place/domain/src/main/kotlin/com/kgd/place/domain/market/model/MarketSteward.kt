package com.kgd.place.domain.market.model

import java.time.LocalDateTime

data class MarketSteward(
    val marketId: Long,
    val memberId: Long,
    val orgName: String,
    val contact: String,
    val status: MarketStewardStatus = MarketStewardStatus.PENDING,
    val approvedByMemberId: Long? = null,
    val approvedAt: LocalDateTime? = null,
    val id: Long? = null,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    init {
        require(marketId > 0 && memberId > 0 && orgName.isNotBlank() && contact.isNotBlank())
        require(status != MarketStewardStatus.ACTIVE || (approvedByMemberId != null && approvedAt != null))
    }

    fun canEdit(requestedMarketId: Long, requestedMemberId: Long): Boolean =
        status == MarketStewardStatus.ACTIVE && marketId == requestedMarketId && memberId == requestedMemberId
}
