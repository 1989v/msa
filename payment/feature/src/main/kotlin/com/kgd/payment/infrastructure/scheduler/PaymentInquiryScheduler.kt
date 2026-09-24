package com.kgd.payment.infrastructure.scheduler

import com.kgd.payment.application.payment.usecase.ResolvePaymentUseCase
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/** 결과 미상 결제 재조회. 백오프(30초·1·2·4·2.5분)는 행의 next_inquiry_at 이 갖고, 여기는 10초마다 기한 된 것만 본다 */
@Component
class PaymentInquiryScheduler(
    private val resolve: ResolvePaymentUseCase,
) {
    @Scheduled(
        fixedDelayString = "\${payment.inquiry.interval-ms:10000}",
        initialDelayString = "\${payment.inquiry.initial-delay-ms:30000}",
    )
    fun run() {
        resolve.resolveDue()
    }
}
