package com.kgd.order.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.order.application.saga.port.SagaCommand
import com.kgd.order.application.saga.port.SagaCommandPort
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * 사가 명령 → order_db 아웃박스 행. 토픽과 페이로드 모양은 받는 쪽 컨슈머의 메시지 클래스를 따른다
 * (InventoryCommandMessage · PromotionCommandMessage · PaymentCommandMessage · FulfillmentCommandMessage).
 * Kafka 키 = orderId — 한 주문의 명령과 답이 한 파티션에 줄 선다. eventId 는 릴레이가 행마다 새로 넣는다.
 */
@Component
class SagaCommandOutboxAdapter(
    @Qualifier("orderOutboxPort") private val outbox: OutboxPort,
    private val objectMapper: ObjectMapper,
) : SagaCommandPort {

    override fun send(command: SagaCommand) {
        val (topic, payload) = when (command) {
            is SagaCommand.ReserveInventory -> "inventory.command.reserve" to mapOf(
                "orderId" to command.orderId,
                "lines" to command.lines.map { mapOf("productId" to it.productId, "quantity" to it.quantity) },
            )
            is SagaCommand.ConfirmInventory -> "inventory.command.confirm" to mapOf("orderId" to command.orderId)
            is SagaCommand.ReleaseInventory -> "inventory.command.release" to mapOf("orderId" to command.orderId)
            is SagaCommand.RestockInventory -> "inventory.command.restock" to mapOf("orderId" to command.orderId)
            is SagaCommand.ReservePromotion -> "promotion.command.reserve" to mapOf(
                "orderId" to command.orderId,
                "memberId" to command.memberId,
                "userCouponId" to command.userCouponId,
                "couponDiscount" to command.couponDiscount,
                "pointAmount" to command.pointAmount,
                "lines" to command.lines.map { mapOf("sellerId" to it.sellerId, "amount" to it.amount) },
            )
            is SagaCommand.ConfirmPromotion -> "promotion.command.confirm" to mapOf("orderId" to command.orderId)
            is SagaCommand.CancelPromotion -> "promotion.command.cancel" to mapOf("orderId" to command.orderId)
            is SagaCommand.RestorePromotion -> "promotion.command.restore" to mapOf(
                "orderId" to command.orderId,
                "restoreKey" to command.restoreKey,
                "pointAmount" to command.pointAmount,
                "fullCancel" to command.fullCancel,
            )
            is SagaCommand.AuthorizePayment -> "payment.command.authorize" to mapOf(
                "orderId" to command.orderId, "orderNo" to command.orderNo, "amount" to command.amount,
            )
            is SagaCommand.CapturePayment -> "payment.command.capture" to mapOf("orderId" to command.orderId, "orderNo" to command.orderNo)
            is SagaCommand.VoidPayment -> "payment.command.void" to mapOf("orderId" to command.orderId, "orderNo" to command.orderNo)
            is SagaCommand.CreateFulfillment -> "fulfillment.command.create" to mapOf(
                "orderId" to command.orderId,
                "lines" to command.lines.map {
                    mapOf("productId" to it.productId, "quantity" to it.quantity, "warehouseId" to it.warehouseId)
                },
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
        const val AGGREGATE_TYPE = "OrderSaga"
    }
}
