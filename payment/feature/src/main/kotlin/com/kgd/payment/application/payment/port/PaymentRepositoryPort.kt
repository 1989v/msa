package com.kgd.payment.application.payment.port

import com.kgd.payment.domain.payment.model.Payment
import java.time.Instant

interface PaymentRepositoryPort {
    /** 새 결제 저장. 같은 orderNo 가 이미 있으면 DB 유니크 제약이 막는다 */
    fun create(payment: Payment): Payment
    fun save(payment: Payment): Payment
    fun findById(id: Long): Payment?
    fun findByOrderNo(orderNo: String): Payment?
    fun findAllByOrderNoIn(orderNos: Collection<String>): List<Payment>

    /** READY·UNKNOWN 중 재조회 시각이 된 것 */
    fun findDueForInquiry(now: Instant, limit: Int): List<Payment>

    /** 매입 시각이 [from, to) 인 결제 */
    fun findCapturedBetween(from: Instant, to: Instant): List<Payment>
}
