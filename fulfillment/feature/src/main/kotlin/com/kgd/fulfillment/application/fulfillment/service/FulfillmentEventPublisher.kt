package com.kgd.fulfillment.application.fulfillment.service

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentLine
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentStatus
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * `fulfillment.order.*` 를 fulfillment_db 아웃박스 행으로 남긴다. 호출자의 트랜잭션 안에서만 부른다.
 * 키는 전부 orderId — 사가·클레임이 한 주문의 답을 한 파티션에서 순서대로 받는다.
 * 명령 경로와 REST 수동 전이가 같은 토픽에 같은 모양을 낸다.
 */
@Component
class FulfillmentEventPublisher(
    @Qualifier("fulfillmentOutboxPort") private val outbox: OutboxPort,
    private val objectMapper: ObjectMapper,
) {
    fun created(orderId: Long, fulfillments: List<FulfillmentOrder>) =
        save(ORDER_AGGREGATE, orderId, orderId, CREATED, CreatedPayload(orderId, fulfillments.map { it.view() }))

    fun statusChanged(fulfillment: FulfillmentOrder, from: FulfillmentStatus, to: FulfillmentStatus) = save(
        FULFILLMENT_AGGREGATE, fulfillment.requireId(), fulfillment.orderId, STATUS_CHANGED,
        StatusChangedPayload(fulfillment.requireId(), fulfillment.orderId, from.name, to.name),
    )

    fun shipped(fulfillment: FulfillmentOrder) =
        save(FULFILLMENT_AGGREGATE, fulfillment.requireId(), fulfillment.orderId, SHIPPED, fulfillment.progress())

    fun delivered(fulfillment: FulfillmentOrder) =
        save(FULFILLMENT_AGGREGATE, fulfillment.requireId(), fulfillment.orderId, DELIVERED, fulfillment.progress())

    /** [lines] 는 취소 요청이 가리킨 라인 전부(이미 취소돼 있던 것 포함) — 재발행 명령에도 같은 답이 나간다 */
    fun cancelled(orderId: Long, lines: List<Pair<FulfillmentOrder, FulfillmentLine>>, cancelledFulfillmentIds: List<Long>) = save(
        ORDER_AGGREGATE, orderId, orderId, CANCELLED,
        CancelledPayload(orderId, lines.map { (fo, line) -> LineRef(fo.requireId(), line.productId, line.quantity) }, cancelledFulfillmentIds),
    )

    fun cancelRejected(orderId: Long, lines: List<Pair<FulfillmentOrder, FulfillmentLine?>>) = save(
        ORDER_AGGREGATE, orderId, orderId, CANCEL_REJECTED,
        CancelRejectedPayload(
            orderId = orderId,
            reason = REASON_ALREADY_SHIPPED,
            lines = lines.map { (fo, line) ->
                RejectedLine(fo.requireId(), line?.productId, line?.quantity, fo.getStatus().name)
            },
        ),
    )

    private fun save(aggregateType: String, aggregateId: Long, orderId: Long, topic: String, payload: Any) {
        outbox.save(
            aggregateType = aggregateType,
            aggregateId = aggregateId,
            eventType = topic,
            payload = objectMapper.writeValueAsString(payload),
            partitionKey = orderId.toString(),
            headers = emptyMap(),
        )
    }

    private fun FulfillmentOrder.requireId() = requireNotNull(id) { "저장되지 않은 이행: orderId=$orderId" }

    private fun FulfillmentOrder.view() = FulfillmentView(
        fulfillmentId = requireId(), warehouseId = warehouseId, status = getStatus().name,
        lines = getLines().map { LineView(it.productId, it.quantity, it.getStatus().name) },
    )

    private fun FulfillmentOrder.progress() = ProgressPayload(
        fulfillmentId = requireId(), orderId = orderId, warehouseId = warehouseId,
        lines = getLines().map { LineView(it.productId, it.quantity, it.getStatus().name) },
    )

    companion object {
        const val CREATED = "fulfillment.order.created"
        const val STATUS_CHANGED = "fulfillment.order.status-changed"
        const val SHIPPED = "fulfillment.order.shipped"
        const val DELIVERED = "fulfillment.order.delivered"
        const val CANCELLED = "fulfillment.order.cancelled"
        const val CANCEL_REJECTED = "fulfillment.order.cancel-rejected"
        const val REASON_ALREADY_SHIPPED = "ALREADY_SHIPPED"
        private const val ORDER_AGGREGATE = "FulfillmentOrderGroup"
        private const val FULFILLMENT_AGGREGATE = "FulfillmentOrder"
    }
}

data class LineView(val productId: Long, val quantity: Int, val status: String)
data class FulfillmentView(val fulfillmentId: Long, val warehouseId: Long, val status: String, val lines: List<LineView>)
data class CreatedPayload(val orderId: Long, val fulfillments: List<FulfillmentView>)
data class StatusChangedPayload(val fulfillmentId: Long, val orderId: Long, val from: String, val to: String)

/** shipped · delivered — 이 이행에 담긴 라인(취소된 라인은 status=CANCELLED) */
data class ProgressPayload(val fulfillmentId: Long, val orderId: Long, val warehouseId: Long, val lines: List<LineView>)
data class LineRef(val fulfillmentId: Long, val productId: Long, val quantity: Int)
data class CancelledPayload(val orderId: Long, val lines: List<LineRef>, val cancelledFulfillmentIds: List<Long>)

/** 라인 없는 이행(REST 수동 생성)이 거절되면 productId·quantity 가 비어 있다 */
data class RejectedLine(val fulfillmentId: Long, val productId: Long?, val quantity: Int?, val fulfillmentStatus: String)
data class CancelRejectedPayload(val orderId: Long, val reason: String, val lines: List<RejectedLine>)
