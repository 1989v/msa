package com.kgd.order.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.order.application.claim.port.ClaimCommand
import com.kgd.order.application.claim.port.ClaimCommandPort
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * 클레임 명령 → order_db 아웃박스 행. 페이로드는 받는 쪽 메시지 클래스를 따른다
 * (FulfillmentCommandMessage · InventoryCommandMessage · PromotionCommandMessage · PaymentCommandMessage).
 * 키 = orderId — 사가 명령과 같은 파티션에 줄 선다.
 */
@Component
class ClaimCommandOutboxAdapter(
    @Qualifier("orderOutboxPort") private val outbox: OutboxPort,
    private val objectMapper: ObjectMapper,
) : ClaimCommandPort {

    override fun send(command: ClaimCommand) {
        val (topic, payload) = when (command) {
            is ClaimCommand.CancelFulfillment -> "fulfillment.command.cancel" to mapOf(
                "orderId" to command.orderId,
                "lines" to command.orderItemIds.map { mapOf("orderItemId" to it) },
            )
            is ClaimCommand.RestockInventory -> "inventory.command.restock" to mapOf(
                "orderId" to command.orderId,
                "restockKey" to command.restockKey,
                "lines" to command.lines.map { mapOf("productId" to it.productId, "quantity" to it.quantity) },
            )
            is ClaimCommand.RestorePromotion -> "promotion.command.restore" to mapOf(
                "orderId" to command.orderId,
                "restoreKey" to command.restoreKey,
                "pointAmount" to command.pointAmount,
                "fullCancel" to command.fullCancel,
            )
            is ClaimCommand.RefundPayment -> "payment.command.refund" to mapOf(
                "orderId" to command.orderId,
                "orderNo" to command.orderNo,
                "amount" to command.amount,
                "refundKey" to command.refundKey,
                "reason" to REFUND_REASON,
            )
        }
        outbox.save(
            aggregateType = AGGREGATE_TYPE,
            aggregateId = command.orderId,
            eventType = topic,
            payload = objectMapper.writeValueAsString(payload),
            partitionKey = command.orderId.toString(),
            headers = emptyMap(),
        )
    }

    companion object {
        const val AGGREGATE_TYPE = "OrderClaim"
        const val REFUND_REASON = "CLAIM"
    }
}
