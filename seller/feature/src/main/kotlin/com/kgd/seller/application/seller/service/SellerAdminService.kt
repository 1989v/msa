package com.kgd.seller.application.seller.service

import com.kgd.common.exception.NotFoundException
import com.kgd.seller.application.seller.port.SellerAdminActionRepositoryPort
import com.kgd.seller.application.seller.port.SellerEventPort
import com.kgd.seller.application.seller.port.SellerEventType
import com.kgd.seller.application.seller.port.SellerRepositoryPort
import com.kgd.seller.application.seller.usecase.ManageSellerUseCase
import com.kgd.seller.application.seller.usecase.SellerView
import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerAdminAction
import com.kgd.seller.domain.seller.model.SellerAdminActionType
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

/** 상태 변경 · 조치 이력 · 아웃박스 행이 seller_db 한 트랜잭션에 묶인다. */
@Service
class SellerAdminService(
    private val sellers: SellerRepositoryPort,
    private val actions: SellerAdminActionRepositoryPort,
    private val events: SellerEventPort,
    @Qualifier("sellerClock") private val clock: Clock,
) : ManageSellerUseCase {

    @Transactional("sellerTransactionManager")
    override fun approve(command: ManageSellerUseCase.Approve): SellerView =
        act(command.sellerId, command.actorId, command.reason, SellerAdminActionType.APPROVE, SellerEventType.APPROVED) {
            s, now -> s.approve(command.commissionRateBp, now)
        }

    @Transactional("sellerTransactionManager")
    override fun reject(command: ManageSellerUseCase.Reject): SellerView =
        act(command.sellerId, command.actorId, command.reason, SellerAdminActionType.REJECT, event = null) {
            s, now -> s.reject(command.reason, now)
        }

    @Transactional("sellerTransactionManager")
    override fun suspend(command: ManageSellerUseCase.Suspend): SellerView =
        act(command.sellerId, command.actorId, command.reason, SellerAdminActionType.SUSPEND, SellerEventType.SUSPENDED) {
            s, now -> s.suspend(command.reason, now)
        }

    @Transactional("sellerTransactionManager")
    override fun reactivate(command: ManageSellerUseCase.Reactivate): SellerView =
        act(command.sellerId, command.actorId, command.reason, SellerAdminActionType.REACTIVATE, SellerEventType.REACTIVATED) {
            s, now -> s.reactivate(now)
        }

    @Transactional("sellerTransactionManager")
    override fun changeCommission(command: ManageSellerUseCase.ChangeCommission): SellerView =
        act(command.sellerId, command.actorId, command.reason, SellerAdminActionType.CHANGE_COMMISSION, SellerEventType.UPDATED) {
            s, now -> s.changeCommission(command.commissionRateBp, now)
        }

    private fun act(
        sellerId: Long,
        actorId: String,
        reason: String?,
        type: SellerAdminActionType,
        event: SellerEventType?,
        change: (Seller, Instant) -> Unit,
    ): SellerView {
        val seller = sellers.findById(sellerId) ?: throw NotFoundException("Seller", sellerId)
        val from = seller.status
        val now = Instant.now(clock)
        change(seller, now)
        val saved = sellers.save(seller)
        actions.record(
            SellerAdminAction(
                sellerId = sellerId,
                action = type,
                actorId = actorId,
                reason = reason?.takeIf { it.isNotBlank() },
                fromStatus = from,
                toStatus = saved.status,
                commissionRateBp = saved.commissionRateBp,
                createdAt = now,
            ),
        )
        event?.let { events.publish(it, saved) }
        return SellerView.from(saved)
    }
}
