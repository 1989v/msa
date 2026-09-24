package com.kgd.promotion.application.point.service

import com.kgd.promotion.application.point.port.PointLedgerRepositoryPort
import com.kgd.promotion.application.point.usecase.GetMyPointsUseCase
import com.kgd.promotion.application.point.usecase.GrantPointsUseCase
import com.kgd.promotion.application.point.usecase.MyPointsView
import com.kgd.promotion.application.point.usecase.PointLedgerView
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.util.UUID

@Service
class PointService(
    private val recorder: PointLedgerRecorder,
    private val ledger: PointLedgerRepositoryPort,
    @Qualifier("promotionClock") private val clock: Clock,
) : GrantPointsUseCase, GetMyPointsUseCase {

    @Transactional("promotionTransactionManager")
    override fun grant(command: GrantPointsUseCase.Grant): MyPointsView {
        val now = clock.instant()
        val balance = recorder.findOrOpen(command.memberId, now)
        recorder.record(balance) { it.earn(command.amount, "grant:${UUID.randomUUID()}", command.actorId, command.reason, now) }
        return view(command.memberId, balance.balance)
    }

    @Transactional("promotionTransactionManager", readOnly = true)
    override fun get(memberId: String): MyPointsView = view(memberId, recorder.find(memberId)?.balance ?: 0L)

    private fun view(memberId: String, balance: Long) =
        MyPointsView(memberId, balance, ledger.findRecentByMemberId(memberId, RECENT_LIMIT).map(PointLedgerView::from))

    private companion object {
        const val RECENT_LIMIT = 20
    }
}
