package com.kgd.payment.infrastructure.pg.mock

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.Instant

/**
 * 모의 PG 쪽 거래 원장 — 실제 PG 라면 PG 사가 갖는 기록이다. 재조회·정산 파일이 이것을 읽는다.
 * 파드가 재시작돼도 대사가 어긋나지 않도록 메모리가 아니라 payment_db 에 둔다(결제 행과는 다른 테이블).
 */
@Entity
@Table(name = "mock_pg_transaction")
class MockPgTransactionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "order_no", nullable = false, length = 64)
    val orderNo: String,

    @Column(name = "payment_key", nullable = false, length = 200)
    val paymentKey: String,

    @Column(nullable = false)
    val amount: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: MockPgTxStatus,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant,
) {
    @Column(name = "captured_amount", nullable = false)
    var capturedAmount: Long = 0

    @Column(name = "refunded_amount", nullable = false)
    var refundedAmount: Long = 0

    @Column(name = "captured_at")
    var capturedAt: Instant? = null

    @Version
    @Column(nullable = false)
    var version: Long = 0
}

enum class MockPgTxStatus {
    /** 승인 호출이 타임아웃으로 끝나 PG 도 결론을 안 낸 상태 */
    PENDING,
    APPROVED,
    DECLINED,
    CAPTURED,
    CANCELED,
}
