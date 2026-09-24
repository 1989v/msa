package com.kgd.order.application.order.port

import com.kgd.order.domain.claim.model.Claim
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.PurchaseConfirmation
import com.kgd.order.domain.sheet.model.ShippingLine
import java.time.Instant

/** order 가 settlement 에 내는 이벤트 — 호출자의 order 트랜잭션 안에서 아웃박스 행으로 남긴다 */
interface OrderEventPort {
    /** `order.order.confirmed` — 매입 분개의 원천. 라인(판매자·안분·수수료)과 판매자별 배송비 라인을 싣는다 */
    fun publishConfirmed(order: Order, confirmedAt: Instant)

    /** `order.claim.refunded` — 환불 분개의 원천. 취소 라인(n·c·dp·p)과 환불한 배송비 라인(s)을 싣는다 */
    fun publishClaimRefunded(order: Order, claim: Claim, refundedAt: Instant)

    /** `order.line.purchase-confirmed` — 확정 라인마다 한 건. 판매자 마지막 ACTIVE 라인이면 배송비 라인을 함께 싣는다 */
    fun publishPurchaseConfirmed(order: Order, confirmations: List<PurchaseConfirmation>, trigger: PurchaseConfirmTrigger, confirmedAt: Instant)

    /**
     * `order.line.purchase-confirmed` 의 배송비만 실은 건 — 확정 라인이 있는 판매자의 마지막 ACTIVE 라인이 확정이 아니라
     * 클레임으로 없어졌을 때. 라인 필드는 비어 있다
     */
    fun publishShippingSettlementDue(order: Order, shipping: List<ShippingLine>, confirmedAt: Instant)
}

/** 구매 확정을 일으킨 것 */
enum class PurchaseConfirmTrigger { BUYER, AUTO, CLAIM_CLOSED }
