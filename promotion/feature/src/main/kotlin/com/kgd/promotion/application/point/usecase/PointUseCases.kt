package com.kgd.promotion.application.point.usecase

import com.kgd.promotion.domain.point.model.PointLedgerEntry
import com.kgd.promotion.domain.point.model.PointLedgerType
import java.time.Instant

/** 어드민 포인트 지급(데모) — 처리자·사유가 원장에 남는다 */
interface GrantPointsUseCase {
    fun grant(command: Grant): MyPointsView

    data class Grant(val memberId: String, val amount: Long, val actorId: String, val reason: String)
}

interface GetMyPointsUseCase {
    fun get(memberId: String): MyPointsView
}

data class MyPointsView(val memberId: String, val balance: Long, val recent: List<PointLedgerView>)

data class PointLedgerView(
    val delta: Long,
    val type: PointLedgerType,
    val balanceAfter: Long,
    val orderId: Long?,
    val reason: String?,
    val createdAt: Instant,
) {
    companion object {
        fun from(e: PointLedgerEntry) = PointLedgerView(e.delta, e.type, e.balanceAfter, e.orderId, e.reason, e.createdAt)
    }
}
