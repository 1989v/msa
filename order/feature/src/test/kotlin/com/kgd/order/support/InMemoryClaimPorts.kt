package com.kgd.order.support

import com.kgd.order.application.claim.port.ClaimCommand
import com.kgd.order.application.claim.port.ClaimCommandPort
import com.kgd.order.application.claim.port.ClaimRepositoryPort
import com.kgd.order.domain.claim.model.Claim
import org.springframework.orm.ObjectOptimisticLockingFailureException
import java.time.Instant

/** 클레임 저장소·명령의 메모리 구현 — 저장은 `@Version` 과 같게 버전이 다르면 충돌을 던진다 */
class InMemoryClaimPorts {
    private val rows = linkedMapOf<Long, Claim>()
    private val sent = mutableListOf<ClaimCommand>()
    private var seq = 0L

    val commands: List<ClaimCommand> get() = sent.toList()
    fun claim(id: Long): Claim = requireNotNull(rows[id])
    fun all(): List<Claim> = rows.values.toList()
    fun clearCommands() = sent.clear()

    val repository = object : ClaimRepositoryPort {
        override fun save(claim: Claim): Claim {
            val id = claim.id ?: ++seq
            val stored = rows[id]
            if (stored != null && stored.version != claim.version) throw ObjectOptimisticLockingFailureException(Claim::class.java, id)
            val saved = copy(claim, id, (stored?.version ?: -1) + 1)
            rows[id] = saved
            return copy(saved, id, saved.version)
        }
        override fun findById(id: Long) = rows[id]?.let { copy(it, id, it.version) }
        override fun findAllByOrderId(orderId: Long) = rows.values.filter { it.orderId == orderId }.map { copy(it, it.id!!, it.version) }
        override fun findAllBySellerId(sellerId: Long, limit: Int) =
            rows.values.filter { it.sellerId == sellerId }.reversed().take(limit).map { copy(it, it.id!!, it.version) }
        override fun findDueOrderIds(now: Instant, limit: Int) = rows.values
            .filter { it.awaitingAnswer && it.nextDeadlineAt?.isAfter(now) == false }.map { it.orderId }.distinct().take(limit)
    }

    val commandPort = object : ClaimCommandPort {
        override fun send(command: ClaimCommand) { sent += command }
    }

    private fun copy(c: Claim, id: Long, version: Long) = Claim.restore(
        id, c.orderId, c.userId, c.sellerId, c.lineNos, c.status, c.step, c.goodsShipped, c.pgRefund, c.pointRestore,
        c.shippingRefund, c.fullCancel, c.restorePromotion, c.rejectReason, c.decidedBy, c.attempts, c.nextDeadlineAt, c.stuck,
        c.requestedAt, version,
    )
}
