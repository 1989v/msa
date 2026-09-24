package com.kgd.order.infrastructure.persistence.claim.adapter

import com.kgd.order.application.claim.port.ClaimRepositoryPort
import com.kgd.order.domain.claim.model.Claim
import com.kgd.order.domain.claim.model.ClaimStatus
import com.kgd.order.infrastructure.persistence.claim.entity.ClaimJpaEntity
import com.kgd.order.infrastructure.persistence.claim.repository.ClaimJpaRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.PageRequest
import org.springframework.orm.ObjectOptimisticLockingFailureException
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Instant

/** 호출자의 order 트랜잭션 안에서 부른다 */
@Component
class ClaimRepositoryAdapter(
    private val jpa: ClaimJpaRepository,
    @Qualifier("orderClock") private val clock: Clock,
) : ClaimRepositoryPort {

    override fun save(claim: Claim): Claim {
        val id = claim.id
        val entity = if (id == null) {
            ClaimJpaEntity(
                orderId = claim.orderId, userId = claim.userId, sellerId = claim.sellerId,
                lineNos = claim.lineNos.joinToString(","), requestedAt = claim.requestedAt,
            )
        } else {
            val found = jpa.findById(id).orElseThrow { IllegalStateException("클레임이 없다: id=$id") }
            if (found.version != claim.version) throw ObjectOptimisticLockingFailureException(ClaimJpaEntity::class.java, id)
            found
        }
        copy(claim, entity)
        return jpa.saveAndFlush(entity).toDomain()
    }

    override fun findById(id: Long): Claim? = jpa.findById(id).orElse(null)?.toDomain()

    override fun findAllByOrderId(orderId: Long): List<Claim> = jpa.findAllByOrderIdOrderByIdAsc(orderId).map { it.toDomain() }

    override fun findAllBySellerId(sellerId: Long, limit: Int): List<Claim> =
        jpa.findAllBySellerIdOrderByIdDesc(sellerId, PageRequest.of(0, limit)).map { it.toDomain() }

    override fun findDueOrderIds(now: Instant, limit: Int): List<Long> =
        jpa.findDueOrderIds(listOf(ClaimStatus.REQUESTED, ClaimStatus.APPROVED), now, PageRequest.of(0, limit))

    /** 바뀐 것이 없으면 행을 건드리지 않는다(버전도 그대로) */
    private fun copy(c: Claim, e: ClaimJpaEntity) {
        val before = fingerprint(e)
        e.status = c.status
        e.step = c.step
        e.goodsShipped = c.goodsShipped
        e.refundAmount = c.pgRefund
        e.pointRestore = c.pointRestore
        e.shippingRefund = c.shippingRefund
        e.fullCancel = c.fullCancel
        e.restorePromotion = c.restorePromotion
        e.rejectReason = c.rejectReason
        e.decidedBy = c.decidedBy
        e.attempts = c.attempts
        e.nextDeadlineAt = c.nextDeadlineAt
        e.stuck = c.stuck
        if (e.id == null || fingerprint(e) != before) e.updatedAt = clock.instant()
    }

    private fun fingerprint(e: ClaimJpaEntity) = listOf(
        e.status, e.step, e.goodsShipped, e.refundAmount, e.pointRestore, e.shippingRefund, e.fullCancel, e.restorePromotion,
        e.rejectReason, e.decidedBy, e.attempts, e.nextDeadlineAt, e.stuck,
    )

    private fun ClaimJpaEntity.toDomain() = Claim.restore(
        id = id, orderId = orderId, userId = userId, sellerId = sellerId,
        lineNos = lineNos.split(",").filter { it.isNotBlank() }.map { it.trim().toInt() },
        status = status, step = step, goodsShipped = goodsShipped, pgRefund = refundAmount, pointRestore = pointRestore,
        shippingRefund = shippingRefund, fullCancel = fullCancel, restorePromotion = restorePromotion,
        rejectReason = rejectReason, decidedBy = decidedBy, attempts = attempts, nextDeadlineAt = nextDeadlineAt,
        stuck = stuck, requestedAt = requestedAt, version = version,
    )
}
