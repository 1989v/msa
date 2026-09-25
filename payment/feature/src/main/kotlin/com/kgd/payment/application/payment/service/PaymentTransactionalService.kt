package com.kgd.payment.application.payment.service

import com.kgd.common.exception.NotFoundException
import com.kgd.payment.application.opsissue.port.OpsIssueRepositoryPort
import com.kgd.payment.application.payment.port.PaymentEventPort
import com.kgd.payment.application.payment.port.PaymentEventType
import com.kgd.payment.application.payment.port.PaymentRefundRepositoryPort
import com.kgd.payment.application.payment.port.PaymentRepositoryPort
import com.kgd.payment.application.payment.port.PgInquiry
import com.kgd.payment.application.payment.port.PgResult
import com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase
import com.kgd.payment.domain.opsissue.model.OpsIssue
import com.kgd.payment.domain.opsissue.model.OpsIssueType
import com.kgd.payment.domain.payment.exception.OrderNoConflictException
import com.kgd.payment.domain.payment.model.Payment
import com.kgd.payment.domain.payment.model.PaymentRefund
import com.kgd.payment.domain.payment.model.PaymentStatus
import com.kgd.payment.domain.payment.model.VoidDecision
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

/**
 * 결제의 짧은 DB 트랜잭션만 모은다 — PG 호출은 이 클래스 밖(호출자)에서 한다.
 * 상태 변경 · 아웃박스 행 · 운영 이슈 행이 payment_db 한 트랜잭션에 묶인다.
 */
@Service
class PaymentTransactionalService(
    private val payments: PaymentRepositoryPort,
    private val refunds: PaymentRefundRepositoryPort,
    private val opsIssues: OpsIssueRepositoryPort,
    private val events: PaymentEventPort,
    @Qualifier("paymentClock") private val clock: Clock,
) {
    private val log = KotlinLogging.logger {}

    sealed interface Begin {
        val payment: Payment

        /** 이 orderNo 로 이미 결제가 있다 — PG 를 다시 부르지 않는다 */
        data class Existing(override val payment: Payment) : Begin

        /** 새 READY 행 — 이제 PG 를 부른다 */
        data class Started(override val payment: Payment) : Begin
    }

    @Transactional("paymentTransactionManager")
    fun begin(command: ProcessPaymentCommandUseCase.Authorize): Begin {
        payments.findByOrderNo(command.orderNo)?.let { existing ->
            if (existing.orderId != command.orderId || existing.amount != command.amount) {
                throw OrderNoConflictException(command.orderNo)
            }
            return Begin.Existing(existing)
        }
        val started = Payment.start(command.orderId, command.orderNo, command.amount, clock.instant())
        return Begin.Started(payments.create(started))
    }

    @Transactional("paymentTransactionManager")
    fun applyAuthorization(paymentId: Long, result: PgResult): Payment {
        val p = load(paymentId)
        if (!p.status.isPending) return p // 재조회가 먼저 결론 냈다
        val now = clock.instant()
        when (result) {
            is PgResult.Approved -> return approve(p, result.paymentKey, result.captured, now)
            is PgResult.Declined -> {
                p.fail(result.reason, now)
                return saveAndPublish(p, PaymentEventType.FAILED, result.reason)
            }
            is PgResult.Unknown -> {
                if (p.status != PaymentStatus.READY) return p
                p.markUnknown(result.reason, now)
                return saveAndPublish(p, PaymentEventType.UNKNOWN, result.reason)
            }
        }
    }

    /**
     * 재조회 결과로 결론 낸다. 이미 결론 난 결제면 아무것도 하지 않는다(중복 웹훅·재조회 경합).
     * PG 금액이 우리 행과 다르면 승인으로 받지 않고 미결로 센다 — 소진되면 사람이 본다.
     */
    @Transactional("paymentTransactionManager")
    fun applyInquiry(paymentId: Long, inquiry: PgInquiry): Payment {
        val p = load(paymentId)
        if (!p.status.isPending) return p
        val now = clock.instant()
        return when (inquiry) {
            is PgInquiry.Approved ->
                if (inquiry.amount == p.amount) {
                    approve(p, inquiry.paymentKey, inquiry.captured, now)
                } else {
                    miss(p, "AMOUNT_MISMATCH(pg=${inquiry.amount}, payment=${p.amount})")
                }
            is PgInquiry.Declined -> {
                p.fail(inquiry.reason, now)
                saveAndPublish(p, PaymentEventType.FAILED, inquiry.reason)
            }
            PgInquiry.NotFound -> {
                p.fail(PG_NOT_FOUND, now)
                saveAndPublish(p, PaymentEventType.FAILED, PG_NOT_FOUND)
            }
            is PgInquiry.Unavailable -> miss(p, inquiry.reason)
        }
    }

    /** [capturedAt] 은 PG 가 기록한 매입 시각 — 결제 행과 PG 원장이 같은 값을 갖는다(대사 정산일 경계) */
    @Transactional("paymentTransactionManager")
    fun markCaptured(paymentId: Long, capturedAt: Instant): Payment {
        val p = load(paymentId)
        p.capture(capturedAt)
        return saveAndPublish(p, PaymentEventType.CAPTURED)
    }

    /** 이미 매입된 결제에 매입 명령이 왔다 — 상태는 그대로, 사가에 captured 로 다시 답한다 */
    @Transactional("paymentTransactionManager")
    fun answerCaptured(paymentId: Long): Payment {
        val p = load(paymentId)
        events.publish(PaymentEventType.CAPTURED, p)
        return p
    }

    /** 매입된 결제의 VOID(전액 취소) 반영. 사가의 VOID 명령에 대한 답이라 voided 로 알린다(결제 상태는 REFUNDED) */
    @Transactional("paymentTransactionManager")
    fun markCancelledAfterCapture(paymentId: Long): Payment {
        val p = load(paymentId)
        val now = clock.instant()
        val amount = p.refundableAmount
        p.cancelCaptured(now)
        refunds.save(PaymentRefund(paymentId = paymentId, refundKey = "void-${p.orderNo}", amount = amount, reason = VOID_REASON, createdAt = now))
        val saved = payments.save(p)
        events.publish(PaymentEventType.VOIDED, saved, VOID_REASON, amount)
        return saved
    }

    @Transactional("paymentTransactionManager")
    fun markVoided(paymentId: Long): Payment {
        val p = load(paymentId)
        p.void(clock.instant())
        return saveAndPublish(p, PaymentEventType.VOIDED)
    }

    @Transactional("paymentTransactionManager")
    fun requestVoid(orderNo: String): Pair<Payment, VoidDecision> {
        val p = payments.findByOrderNo(orderNo) ?: throw NotFoundException("Payment", orderNo)
        val decision = p.requestVoid(clock.instant())
        return (if (decision == VoidDecision.DEFERRED) payments.save(p) else p) to decision
    }

    @Transactional("paymentTransactionManager")
    fun recordRefund(paymentId: Long, command: ProcessPaymentCommandUseCase.Refund): Payment {
        val p = load(paymentId)
        val now = clock.instant()
        p.refund(command.amount, now)
        refunds.save(PaymentRefund(paymentId = paymentId, refundKey = command.refundKey, amount = command.amount, reason = command.reason, createdAt = now))
        val saved = payments.save(p)
        events.publish(PaymentEventType.REFUNDED, saved, command.reason, command.amount)
        return saved
    }

    /**
     * 승인 결론. PG 가 매입까지 했으면(토스 승인 확인) authorized 뒤에 captured 를 이어서 낸다 — 같은 트랜잭션·같은 키라
     * 사가는 authorized 를 먼저 받는다. 사가가 나중에 보내는 매입 명령에는 [answerCaptured] 가 답한다.
     */
    private fun approve(p: Payment, paymentKey: String, captured: Boolean, now: Instant): Payment {
        p.authorize(paymentKey, now)
        val authorized = saveAndPublish(p, PaymentEventType.AUTHORIZED)
        if (!captured) return authorized
        authorized.captureByPg(now)
        return saveAndPublish(authorized, PaymentEventType.CAPTURED)
    }

    private fun miss(p: Payment, reason: String): Payment {
        val now = clock.instant()
        if (p.status == PaymentStatus.READY) {
            p.markUnknown(reason, now)
            return saveAndPublish(p, PaymentEventType.UNKNOWN, reason)
        }
        val exhausted = p.recordInquiryMiss(now)
        val saved = payments.save(p)
        if (exhausted) {
            log.warn { "결제 재조회 소진 → 운영 이슈: orderNo=${p.orderNo}, last=$reason" }
            opsIssues.save(
                OpsIssue.open(
                    OpsIssueType.PAYMENT_UNKNOWN, p.orderNo,
                    "재조회 ${Payment.MAX_INQUIRIES}회로도 결론이 나지 않았다 (마지막 응답: $reason)", null, now,
                ),
            )
        }
        return saved
    }

    private fun saveAndPublish(p: Payment, type: PaymentEventType, reason: String? = null): Payment {
        val saved = payments.save(p)
        events.publish(type, saved, reason)
        return saved
    }

    private fun load(id: Long): Payment = payments.findById(id) ?: throw NotFoundException("Payment", id)

    private companion object {
        const val PG_NOT_FOUND = "PG_NOT_FOUND"
        const val VOID_REASON = "VOID"
    }
}
