package com.kgd.payment.application.payment.port

import com.kgd.payment.domain.payment.model.Payment
import java.time.LocalDate

/** 결제 이벤트 발행 — 상태 변경과 같은 트랜잭션의 아웃박스 행이다. Kafka 키 = orderId */
interface PaymentEventPort {
    fun publish(type: PaymentEventType, payment: Payment, reason: String? = null, refundAmount: Long? = null)
    fun publishSettled(payment: Payment, settleDate: LocalDate, line: PgSettlementLine)
}

enum class PaymentEventType { AUTHORIZED, FAILED, UNKNOWN, CAPTURED, VOIDED, REFUNDED }
