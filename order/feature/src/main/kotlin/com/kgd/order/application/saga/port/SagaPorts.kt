package com.kgd.order.application.saga.port

import com.kgd.order.domain.opsissue.model.OpsIssue
import com.kgd.order.domain.saga.model.OrderSaga
import com.kgd.order.domain.saga.model.ReservedLine
import java.time.Instant

/** `order_saga` (`@Version`). 저장이 다른 트랜잭션의 커밋과 겹치면 `OptimisticLockingFailureException` */
interface OrderSagaRepositoryPort {
    fun create(saga: OrderSaga)
    fun save(saga: OrderSaga)
    fun findByOrderId(orderId: Long): OrderSaga?
    fun findAllByOrderIds(orderIds: Collection<Long>): List<OrderSaga>

    /** 진행 중(RUNNING · COMPENSATING)이고 기한이 [now] 이하인 사가의 orderId — 기한 순 */
    fun findDueOrderIds(now: Instant, limit: Int): List<Long>
}

/** order 스키마 `ops_issue` */
interface OrderOpsIssueRepositoryPort {
    fun save(issue: OpsIssue)
}

/**
 * 사가 명령 — 아웃박스 행(키 = orderId)으로 남긴다. 호출자의 order 트랜잭션 안에서만 부른다.
 * 받는 쪽은 전부 orderId(원복은 restoreKey)로 멱등이라 기한 재발행이 같은 명령을 여러 번 내도 효과는 한 번이다.
 */
interface SagaCommandPort {
    fun send(command: SagaCommand)
}

sealed interface SagaCommand {
    val orderId: Long

    data class ReserveInventory(override val orderId: Long, val lines: List<StockLine>) : SagaCommand
    data class ConfirmInventory(override val orderId: Long) : SagaCommand
    data class ReleaseInventory(override val orderId: Long) : SagaCommand

    /** 이 주문의 확정 수량 전부를 가용으로 되돌린다(보류 만료 규칙 a) */
    data class RestockInventory(override val orderId: Long) : SagaCommand

    data class ReservePromotion(
        override val orderId: Long,
        val memberId: String,
        val userCouponId: Long?,
        val couponDiscount: Long,
        val pointAmount: Long,
        /** 쿠폰 대상 금액 — 판매자와 판매가 × 수량(배송비 제외) */
        val lines: List<SellerAmount>,
    ) : SagaCommand

    data class ConfirmPromotion(override val orderId: Long) : SagaCommand
    data class CancelPromotion(override val orderId: Long) : SagaCommand
    data class RestorePromotion(override val orderId: Long, val restoreKey: String, val pointAmount: Long, val fullCancel: Boolean) : SagaCommand

    data class AuthorizePayment(override val orderId: Long, val orderNo: String, val amount: Long) : SagaCommand
    data class CapturePayment(override val orderId: Long, val orderNo: String) : SagaCommand

    /** 결제가 결과 미상이면 결제 쪽이 미뤄 뒀다가 결론 시 실행한다(규칙 b) */
    data class VoidPayment(override val orderId: Long, val orderNo: String) : SagaCommand

    data class CreateFulfillment(override val orderId: Long, val lines: List<ReservedLine>) : SagaCommand

    data class StockLine(val productId: Long, val quantity: Int)
    data class SellerAmount(val sellerId: Long, val amount: Long)
}
