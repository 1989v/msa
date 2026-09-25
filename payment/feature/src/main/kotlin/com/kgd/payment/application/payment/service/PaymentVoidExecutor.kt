package com.kgd.payment.application.payment.service

import com.kgd.payment.application.payment.port.PgPort
import com.kgd.payment.domain.payment.model.Payment
import com.kgd.payment.domain.payment.model.PaymentStatus
import org.springframework.stereotype.Service

/**
 * PG 취소 호출(트랜잭션 밖) → 반영. 명령 처리와 재조회 결론(보류 만료 규칙 b)이 같이 쓴다.
 * 승인만 된 결제는 VOIDED, 이미 매입된 결제(토스 승인 확인 = 매입)는 전액 취소라 REFUNDED 로 끝난다.
 */
@Service
class PaymentVoidExecutor(
    private val pg: PgPort,
    private val tx: PaymentTransactionalService,
) {
    fun execute(payment: Payment): Payment {
        pg.void(requireNotNull(payment.paymentKey) { "승인 거래 키 없는 결제는 취소할 수 없다" }, payment.amount)
        val id = requireNotNull(payment.id)
        return if (payment.status == PaymentStatus.CAPTURED) tx.markCancelledAfterCapture(id) else tx.markVoided(id)
    }

    /** 결과 미상 중에 들어온 VOID 가 AUTHORIZED 결론을 만났으면 지금 실행한다 */
    fun executeIfDue(payment: Payment): Payment = if (payment.pendingVoidDue) execute(payment) else payment
}
