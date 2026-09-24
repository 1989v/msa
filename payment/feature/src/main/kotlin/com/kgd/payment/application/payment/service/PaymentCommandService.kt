package com.kgd.payment.application.payment.service

import com.kgd.common.exception.NotFoundException
import com.kgd.payment.application.payment.port.PaymentRefundRepositoryPort
import com.kgd.payment.application.payment.port.PaymentRepositoryPort
import com.kgd.payment.application.payment.port.PgPort
import com.kgd.payment.application.payment.port.PgResult
import com.kgd.payment.application.payment.usecase.PaymentView
import com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase
import com.kgd.payment.domain.payment.exception.InvalidPaymentStateException
import com.kgd.payment.domain.payment.model.Payment
import com.kgd.payment.domain.payment.model.PaymentStatus
import com.kgd.payment.domain.payment.model.VoidDecision
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service

/**
 * 결제 명령 흐름. 트랜잭션 없음 — DB 는 [PaymentTransactionalService] 의 짧은 트랜잭션, PG 는 그 사이에 부른다.
 *
 * 멱등: 승인은 orderNo 로 결제 행을 먼저 찾아 있으면 PG 를 부르지 않는다. 환불은 refundKey 로 거른다.
 * 같은 주문의 명령은 Kafka 키(orderId)로 한 파티션에 줄 서므로 한 주문을 두 스레드가 동시에 처리하지 않는다.
 */
@Service
class PaymentCommandService(
    private val payments: PaymentRepositoryPort,
    private val refunds: PaymentRefundRepositoryPort,
    private val pg: PgPort,
    private val tx: PaymentTransactionalService,
    private val voids: PaymentVoidExecutor,
) : ProcessPaymentCommandUseCase {
    private val log = KotlinLogging.logger {}

    override fun authorize(command: ProcessPaymentCommandUseCase.Authorize): PaymentView =
        when (val begun = tx.begin(command)) {
            is PaymentTransactionalService.Begin.Existing -> PaymentView.from(begun.payment)
            is PaymentTransactionalService.Begin.Started -> {
                val result = runCatching {
                    command.paymentKey?.let { pg.confirm(it, command.orderNo, command.amount) }
                        ?: pg.authorize(command.orderNo, command.amount)
                }.getOrElse {
                    // 어댑터가 분류하지 못한 예외 — 승인됐는지 모르므로 UNKNOWN 으로 두고 재조회에 맡긴다
                    log.warn(it) { "PG 승인 호출 예외 → UNKNOWN: orderNo=${command.orderNo}" }
                    PgResult.Unknown("PG_ERROR:${it.javaClass.simpleName}")
                }
                PaymentView.from(tx.applyAuthorization(requireNotNull(begun.payment.id), result))
            }
        }

    override fun capture(orderNo: String): PaymentView {
        val p = find(orderNo)
        if (p.status.isCaptured) return PaymentView.from(p)
        if (p.status != PaymentStatus.AUTHORIZED || p.voidRequestedAt != null) {
            throw InvalidPaymentStateException(p.status, "CAPTURE")
        }
        pg.capture(requireNotNull(p.paymentKey), p.amount)
        return PaymentView.from(tx.markCaptured(requireNotNull(p.id)))
    }

    override fun void(orderNo: String): PaymentView {
        val (p, decision) = tx.requestVoid(orderNo)
        return PaymentView.from(if (decision == VoidDecision.EXECUTE) voids.execute(p) else p)
    }

    override fun refund(command: ProcessPaymentCommandUseCase.Refund): PaymentView {
        val p = find(command.orderNo)
        if (refunds.existsByRefundKey(command.refundKey)) return PaymentView.from(p)
        p.checkRefundable(command.amount)
        pg.refund(requireNotNull(p.paymentKey), command.amount, command.refundKey, command.reason)
        return PaymentView.from(tx.recordRefund(requireNotNull(p.id), command))
    }

    private fun find(orderNo: String): Payment =
        payments.findByOrderNo(orderNo) ?: throw NotFoundException("Payment", orderNo)
}
