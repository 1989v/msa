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

    /** Approval metadata survives suspension; restoring records the latest approving administrator. */
    fun transition(action: String, adminId: Long, now: LocalDateTime = LocalDateTime.now()): MarketSteward {
        require(adminId > 0)
        val next = when {
            action == "APPROVE" && status == MarketStewardStatus.PENDING -> MarketStewardStatus.ACTIVE
            action == "REJECT" && status == MarketStewardStatus.PENDING -> MarketStewardStatus.REJECTED
            action == "SUSPEND" && status == MarketStewardStatus.ACTIVE -> MarketStewardStatus.SUSPENDED
            action == "RESTORE" && status == MarketStewardStatus.SUSPENDED -> MarketStewardStatus.ACTIVE
            else -> throw InvalidMarketStewardTransition("Cannot $action a $status application")
        }
        return if (next == MarketStewardStatus.ACTIVE) copy(status = next, approvedByMemberId = adminId, approvedAt = now)
        else copy(status = next)
    }

    fun canEdit(requestedMarketId: Long, requestedMemberId: Long): Boolean =
        status == MarketStewardStatus.ACTIVE && marketId == requestedMarketId && memberId == requestedMemberId
}

class InvalidMarketStewardTransition(message: String) : RuntimeException(message)
