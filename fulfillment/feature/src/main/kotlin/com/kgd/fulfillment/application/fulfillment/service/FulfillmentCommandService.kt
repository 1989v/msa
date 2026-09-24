package com.kgd.fulfillment.application.fulfillment.service

import com.kgd.fulfillment.application.fulfillment.port.FulfillmentRepositoryPort
import com.kgd.fulfillment.application.fulfillment.usecase.ProcessFulfillmentCommandUseCase
import com.kgd.fulfillment.application.fulfillment.usecase.ProcessFulfillmentCommandUseCase.Answer
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentLine
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentLineStatus
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 이행 명령. 명령마다 fulfillment_db 한 트랜잭션 — 이행·라인 행과 답 아웃박스 행이 함께 커밋된다.
 * (order_id, warehouse_id) 유니크가 같은 생성 명령 동시 처리 둘 중 하나를 롤백시킨다.
 */
@Service
@Transactional
@Qualifier("fulfillmentTransactionManager")
class FulfillmentCommandService(
    private val fulfillments: FulfillmentRepositoryPort,
    private val events: FulfillmentEventPublisher,
) : ProcessFulfillmentCommandUseCase {
    private val log = KotlinLogging.logger {}

    override fun create(command: ProcessFulfillmentCommandUseCase.Create): Answer {
        require(command.lines.isNotEmpty()) { "create 의 lines 가 비었다: orderId=${command.orderId}" }
        val existing = fulfillments.findAllByOrderId(command.orderId)
        if (existing.isNotEmpty()) {
            log.info { "이행이 이미 있다 — 지금 상태로 다시 답한다: orderId=${command.orderId}" }
            events.created(command.orderId, existing)
            return Answer(FulfillmentEventPublisher.CREATED)
        }
        val created = command.lines.groupBy { it.warehouseId }.map { (warehouseId, lines) ->
            fulfillments.save(FulfillmentOrder.create(command.orderId, warehouseId, lines.map { it.productId to it.quantity }))
        }
        events.created(command.orderId, created)
        return Answer(FulfillmentEventPublisher.CREATED)
    }

    override fun cancel(command: ProcessFulfillmentCommandUseCase.Cancel): Answer {
        val all = fulfillments.findAllByOrderId(command.orderId)
        require(all.isNotEmpty()) { "이행이 없는 주문의 취소 명령: orderId=${command.orderId}" }

        val targets: List<Pair<FulfillmentOrder, FulfillmentLine>> = all.flatMap { fo ->
            fo.getLines().filter { command.productIds == null || it.productId in command.productIds }.map { fo to it }
        }
        command.productIds?.let { requested ->
            val missing = requested - targets.map { it.second.productId }.toSet()
            require(missing.isEmpty()) { "이행에 없는 라인의 취소 명령: orderId=${command.orderId}, productIds=$missing" }
        }
        // 전체 취소면 라인 없는 이행(REST 수동 생성)도 대상이다
        val touched = if (command.productIds == null) all else targets.map { it.first }.distinctBy { it.id }

        // 한 라인이라도 이미 출고됐으면 아무것도 취소하지 않는다 — 클레임은 판매자 승인으로 넘어간다
        val rejected = touched.filter { it.isShippedOrDelivered() }.flatMap { fo ->
            val active = targets.filter { it.first.id == fo.id && it.second.getStatus() == FulfillmentLineStatus.ACTIVE }
            when {
                active.isNotEmpty() -> active.map { it.first to it.second }
                fo.getLines().isEmpty() -> listOf(fo to null)
                else -> emptyList()
            }
        }
        if (rejected.isNotEmpty()) {
            events.cancelRejected(command.orderId, rejected)
            return Answer(FulfillmentEventPublisher.CANCEL_REJECTED)
        }

        touched.forEach { fo ->
            val productIds = targets.filter { it.first.id == fo.id }.map { it.second.productId }.toSet()
            fo.cancelLines(productIds)
            fulfillments.save(fo)
        }
        val cancelledIds = touched.filter { it.getStatus() == FulfillmentStatus.CANCELLED }.mapNotNull { it.id }
        events.cancelled(command.orderId, targets, cancelledIds)
        return Answer(FulfillmentEventPublisher.CANCELLED)
    }

    private fun FulfillmentOrder.isShippedOrDelivered() =
        getStatus() == FulfillmentStatus.SHIPPED || getStatus() == FulfillmentStatus.DELIVERED
}
