package com.kgd.order.application.claim.port

import com.kgd.order.domain.claim.model.Claim
import java.time.Instant

/** `order_claim` (`@Version`). 호출자의 order 트랜잭션 안에서 부른다 */
interface ClaimRepositoryPort {
    /** 새 클레임이면 넣고 id 를 채워 돌려준다. 있으면 버전을 대조해 옮긴다(다르면 `OptimisticLockingFailureException`) */
    fun save(claim: Claim): Claim
    fun findById(id: Long): Claim?

    /** 주문의 클레임 — id 순(요청 순) */
    fun findAllByOrderId(orderId: Long): List<Claim>

    /** 판매자의 클레임 — 최신순 */
    fun findAllBySellerId(sellerId: Long, limit: Int): List<Claim>

    /** 답을 기다리는 단계의 기한이 [now] 이하인 클레임의 orderId — 기한 순 */
    fun findDueOrderIds(now: Instant, limit: Int): List<Long>
}

/**
 * 클레임 명령 — order_db 아웃박스 행(키 = orderId). 받는 쪽은 사가 명령과 같은 컨슈머다.
 * 재입고·원복·환불은 클레임 키([Claim.idempotencyKey])로 멱등이라 기한 재발행이 효과를 두 번 내지 않는다.
 */
interface ClaimCommandPort {
    fun send(command: ClaimCommand)
}

sealed interface ClaimCommand {
    val orderId: Long

    /** `fulfillment.command.cancel` — 이행 라인은 주문 라인 id 로 식별한다(같은 상품 두 라인도 따로) */
    data class CancelFulfillment(override val orderId: Long, val orderItemIds: List<Long>) : ClaimCommand

    /** `inventory.command.restock` — 라인 지정 재입고, 출고 전 취소만 */
    data class RestockInventory(override val orderId: Long, val restockKey: String, val lines: List<Line>) : ClaimCommand

    /** `promotion.command.restore` — 포인트 안분분 원복, 전체 취소면 쿠폰 반환 */
    data class RestorePromotion(override val orderId: Long, val restoreKey: String, val pointAmount: Long, val fullCancel: Boolean) : ClaimCommand

    /** `payment.command.refund` — 부분·전액 환불 */
    data class RefundPayment(override val orderId: Long, val orderNo: String, val amount: Long, val refundKey: String) : ClaimCommand

    data class Line(val productId: Long, val quantity: Int)
}
