package com.kgd.payment.infrastructure.pg.mock

import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

interface MockPgTransactionJpaRepository : JpaRepository<MockPgTransactionJpaEntity, Long> {
    fun findByOrderNo(orderNo: String): MockPgTransactionJpaEntity?
    fun findByPaymentKey(paymentKey: String): MockPgTransactionJpaEntity?
    fun findAllByStatusAndCapturedAtGreaterThanEqualAndCapturedAtLessThanOrderByIdAsc(
        status: MockPgTxStatus,
        from: Instant,
        to: Instant,
    ): List<MockPgTransactionJpaEntity>
}
