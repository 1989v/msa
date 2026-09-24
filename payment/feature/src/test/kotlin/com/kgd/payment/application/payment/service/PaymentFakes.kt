package com.kgd.payment.application.payment.service

import com.kgd.payment.application.opsissue.port.OpsIssuePage
import com.kgd.payment.application.opsissue.port.OpsIssueRepositoryPort
import com.kgd.payment.application.payment.port.PaymentEventPort
import com.kgd.payment.application.payment.port.PaymentRefundRepositoryPort
import com.kgd.payment.application.payment.port.PaymentRepositoryPort
import com.kgd.payment.application.payment.port.PgPort
import com.kgd.payment.application.payment.port.ReconciliationRepositoryPort
import com.kgd.payment.domain.opsissue.model.OpsIssue
import com.kgd.payment.domain.opsissue.model.OpsIssueStatus
import com.kgd.payment.domain.payment.model.Payment
import com.kgd.payment.domain.payment.model.PaymentRefund
import com.kgd.payment.domain.reconciliation.model.ReconciliationRecord
import io.mockk.mockk
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

val T0: Instant = Instant.parse("2026-09-24T01:00:00Z")

/** 저장소 포트의 메모리 구현 — 저장한 값을 다시 읽어 판정하려고 목 대신 쓴다 */
class InMemoryPayments : PaymentRepositoryPort {
    val rows = linkedMapOf<Long, Payment>()
    private var seq = 0L

    override fun create(payment: Payment): Payment {
        check(rows.values.none { it.orderNo == payment.orderNo }) { "uk_payment_order_no" }
        return copyWithId(payment, ++seq).also { rows[seq] = it }
    }

    override fun save(payment: Payment): Payment = payment.also { rows[requireNotNull(it.id)] = it }
    override fun findById(id: Long): Payment? = rows[id]
    override fun findByOrderNo(orderNo: String): Payment? = rows.values.firstOrNull { it.orderNo == orderNo }
    override fun findAllByOrderNoIn(orderNos: Collection<String>): List<Payment> = rows.values.filter { it.orderNo in orderNos }
    override fun findDueForInquiry(now: Instant, limit: Int): List<Payment> =
        rows.values.filter { it.status.isPending && it.nextInquiryAt?.let { t -> !t.isAfter(now) } == true }.take(limit)

    override fun findCapturedBetween(from: Instant, to: Instant): List<Payment> =
        rows.values.filter { it.capturedAt?.let { t -> !t.isBefore(from) && t.isBefore(to) } == true }

    private fun copyWithId(p: Payment, id: Long) = Payment.restore(
        id, p.orderId, p.orderNo, p.amount, p.paymentKey, p.status, p.capturedAmount, p.refundedAmount,
        p.voidRequestedAt, p.failureReason, p.inquiryAttempts, p.nextInquiryAt, p.authorizedAt, p.capturedAt,
        p.createdAt, p.updatedAt,
    )
}

class InMemoryRefunds : PaymentRefundRepositoryPort {
    val rows = mutableListOf<PaymentRefund>()
    override fun existsByRefundKey(refundKey: String): Boolean = rows.any { it.refundKey == refundKey }
    override fun save(refund: PaymentRefund): PaymentRefund = refund.also { rows += it }
}

class InMemoryOpsIssues : OpsIssueRepositoryPort {
    val rows = linkedMapOf<Long, OpsIssue>()
    private var seq = 0L
    override fun save(issue: OpsIssue): OpsIssue {
        val id = issue.id ?: ++seq
        val saved = OpsIssue.restore(
            id, issue.type, issue.targetId, issue.detail, issue.businessDate, issue.status, issue.actorId,
            issue.reason, issue.createdAt, issue.updatedAt,
        )
        rows[id] = saved
        return saved
    }

    override fun findById(id: Long): OpsIssue? = rows[id]
    override fun findPage(status: OpsIssueStatus?, page: Int, size: Int): OpsIssuePage =
        rows.values.filter { status == null || it.status == status }.let { OpsIssuePage(it, it.size.toLong()) }
}

class InMemoryReconciliations : ReconciliationRepositoryPort {
    val rows = mutableListOf<ReconciliationRecord>()
    override fun exists(settleDate: LocalDate, orderNo: String) = rows.any { it.settleDate == settleDate && it.orderNo == orderNo }
    override fun save(record: ReconciliationRecord) { rows += record }
    override fun delete(settleDate: LocalDate, orderNo: String) {
        rows.removeIf { it.settleDate == settleDate && it.orderNo == orderNo }
    }
}

/** 테스트가 시각을 앞으로 돌리는 시계 — 백오프·재조회 시각 판정용 */
class MutableClock(var now: Instant = T0) : Clock() {
    override fun getZone(): java.time.ZoneId = ZoneOffset.UTC
    override fun withZone(zone: java.time.ZoneId?): Clock = this
    override fun instant(): Instant = now
}

/** 실제 서비스 조립 — 트랜잭션 프록시만 없다(단위 테스트) */
class PaymentHarness(val clock: MutableClock = MutableClock()) {
    val payments = InMemoryPayments()
    val refunds = InMemoryRefunds()
    val opsIssues = InMemoryOpsIssues()
    val events = mockk<PaymentEventPort>(relaxed = true)
    val pg = mockk<PgPort>()
    val tx = PaymentTransactionalService(payments, refunds, opsIssues, events, clock)
    val voids = PaymentVoidExecutor(pg, tx)
    val commands = PaymentCommandService(payments, refunds, pg, tx, voids)
    val resolution = PaymentResolutionService(payments, pg, tx, voids, clock)
}
