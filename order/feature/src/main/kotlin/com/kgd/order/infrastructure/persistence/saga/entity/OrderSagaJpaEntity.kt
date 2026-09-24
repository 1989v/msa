package com.kgd.order.infrastructure.persistence.saga.entity

import com.kgd.order.domain.order.model.OrderFailureReason
import com.kgd.order.domain.saga.model.SagaStatus
import com.kgd.order.domain.saga.model.SagaStep
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.Instant

/**
 * 사가 진행 행 — 주문당 하나. `@Version` 이 같은 주문의 답을 동시에 처리하는 두 트랜잭션 중 늦은 쪽을 되돌린다.
 * 남은 보상 계획은 단계 이름을 쉼표로, 확정 라인은 JSON 으로 담는다.
 */
@Entity
@Table(name = "order_saga")
class OrderSagaJpaEntity(
    @Id
    @Column(name = "order_id")
    val orderId: Long,
    @Column(name = "order_no", nullable = false, length = 64) val orderNo: String,
    @Column(name = "payment_required", nullable = false) val paymentRequired: Boolean,
    @Column(name = "started_at", nullable = false) val startedAt: Instant,
    @Column(name = "pre_pivot_deadline_at", nullable = false) val prePivotDeadlineAt: Instant,
) {
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    var status: SagaStatus = SagaStatus.RUNNING

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30)
    var step: SagaStep = SagaStep.INVENTORY_RESERVE

    @Column(nullable = false) var attempts: Int = 0
    @Column(name = "next_deadline_at", nullable = false) var nextDeadlineAt: Instant = startedAt
    /** 컬럼 추가 전에 만든 행은 NULL — 도메인은 시작 시각으로 대신 본다 */
    @Column(name = "step_entered_at") var stepEnteredAt: Instant? = null
    @Column(name = "pending_void", nullable = false) var pendingVoid: Boolean = false
    @Column(name = "holds_expired", nullable = false) var holdsExpired: Boolean = false
    @Column(name = "payment_unknown", nullable = false) var paymentUnknown: Boolean = false
    @Column(name = "inventory_confirmed", nullable = false) var inventoryConfirmed: Boolean = false
    @Column(name = "promotion_confirmed", nullable = false) var promotionConfirmed: Boolean = false
    @Column(name = "cancel_requested", nullable = false) var cancelRequested: Boolean = false
    @Column(name = "compensation_plan", length = 200) var compensationPlan: String? = null

    @Enumerated(EnumType.STRING) @Column(name = "failure_reason", length = 40)
    var failureReason: OrderFailureReason? = null

    @Column(name = "reserved_lines", columnDefinition = "JSON") var reservedLines: String? = null
    @Column(name = "updated_at", nullable = false) var updatedAt: Instant = startedAt

    @Version
    @Column(nullable = false)
    var version: Long = 0
        private set
}
