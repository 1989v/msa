package com.kgd.payment.application.payment.service

import com.kgd.payment.application.payment.port.PaymentRepositoryPort
import com.kgd.payment.application.payment.port.PgInquiry
import com.kgd.payment.application.payment.port.PgPort
import com.kgd.payment.application.payment.usecase.ResolvePaymentUseCase
import com.kgd.payment.domain.payment.model.Payment
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import java.time.Clock

/** 재조회 스케줄러와 토스 웹훅이 같이 쓰는 결론 경로 — 판정 근거는 항상 PG 재조회 결과다 */
@Service
class PaymentResolutionService(
    private val payments: PaymentRepositoryPort,
    private val pg: PgPort,
    private val tx: PaymentTransactionalService,
    private val voids: PaymentVoidExecutor,
    @Qualifier("paymentClock") private val clock: Clock,
) : ResolvePaymentUseCase {
    private val log = KotlinLogging.logger {}

    override fun resolveDue(): Int {
        val due = payments.findDueForInquiry(clock.instant(), BATCH_SIZE)
        due.forEach { p ->
            runCatching { resolve(p) }
                .onFailure { log.warn(it) { "결제 재조회 실패: orderNo=${p.orderNo}" } }
        }
        return due.size
    }

    override fun resolveByOrderNo(orderNo: String): ResolvePaymentUseCase.ResolveOutcome {
        val p = payments.findByOrderNo(orderNo) ?: return ResolvePaymentUseCase.ResolveOutcome.NOT_FOUND
        if (!p.status.isPending) return ResolvePaymentUseCase.ResolveOutcome.ALREADY_RESOLVED
        val after = resolve(p)
        return if (after.status.isPending) {
            ResolvePaymentUseCase.ResolveOutcome.STILL_PENDING
        } else {
            ResolvePaymentUseCase.ResolveOutcome.RESOLVED
        }
    }

    private fun resolve(p: Payment): Payment {
        val inquiry = runCatching { pg.inquire(p.orderNo) }
            .getOrElse { PgInquiry.Unavailable("INQUIRY_ERROR:${it.javaClass.simpleName}") }
        val applied = tx.applyInquiry(requireNotNull(p.id), inquiry)
        return voids.executeIfDue(applied)
    }

    private companion object {
        const val BATCH_SIZE = 50
    }
}
