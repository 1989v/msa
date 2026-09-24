package com.kgd.payment.infrastructure.scheduler

import com.kgd.payment.application.payment.service.ReconciliationService
import com.kgd.payment.application.payment.usecase.ReconcilePaymentsUseCase
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.LocalDate

/** 전날(KST) PG 대사 — 매일 05:10 KST. 정산 파일을 내는 모의 PG 에서만 돈다(토스 정산 조회는 연동 전) */
@Component
@ConditionalOnProperty(prefix = "payment", name = ["pg"], havingValue = "mock", matchIfMissing = true)
class PaymentReconciliationScheduler(
    private val reconcile: ReconcilePaymentsUseCase,
    @Qualifier("paymentClock") private val clock: Clock,
) {
    @Scheduled(cron = "\${payment.reconciliation.cron:0 10 5 * * *}", zone = "Asia/Seoul")
    fun run() {
        reconcile.reconcile(LocalDate.now(clock.withZone(ReconciliationService.SETTLEMENT_ZONE)).minusDays(1))
    }
}
