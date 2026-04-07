package com.kgd.fulfillment.application.fulfillment.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.fulfillment.application.fulfillment.port.FulfillmentRepositoryPort
import com.kgd.fulfillment.application.fulfillment.port.OutboxPort
import com.kgd.fulfillment.application.fulfillment.usecase.CreateFulfillmentUseCase
import com.kgd.fulfillment.application.fulfillment.usecase.GetFulfillmentUseCase
import com.kgd.fulfillment.application.fulfillment.usecase.TransitionFulfillmentUseCase
import com.kgd.fulfillment.domain.fulfillment.event.FulfillmentEvent
import com.kgd.fulfillment.domain.fulfillment.exception.FulfillmentNotFoundException
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class FulfillmentService(
    private val fulfillmentRepository: FulfillmentRepositoryPort,
    private val outboxPort: OutboxPort,
    private val objectMapper: ObjectMapper
) : CreateFulfillmentUseCase, TransitionFulfillmentUseCase, GetFulfillmentUseCase {

    override fun execute(command: CreateFulfillmentUseCase.Command): CreateFulfillmentUseCase.Result {
        val fulfillmentOrder = FulfillmentOrder.create(
            orderId = command.orderId,
            warehouseId = command.warehouseId
        )
        val saved = fulfillmentRepository.save(fulfillmentOrder)
        val savedId = requireNotNull(saved.id) { "저장된 풀필먼트에 ID가 없습니다" }

        val event = FulfillmentEvent.Created(
            fulfillmentId = savedId,
            orderId = saved.orderId,
            warehouseId = saved.warehouseId
        )
        outboxPort.save(
            aggregateType = "FulfillmentOrder",
            aggregateId = savedId,
            eventType = "fulfillment.order.created",
            payload = objectMapper.writeValueAsString(event)
        )

        return CreateFulfillmentUseCase.Result(
            fulfillmentId = savedId,
            orderId = saved.orderId,
            status = saved.getStatus().name
        )
    }

    override fun execute(command: TransitionFulfillmentUseCase.Command): TransitionFulfillmentUseCase.Result {
        val fulfillmentOrder = fulfillmentRepository.findById(command.fulfillmentId)
            ?: throw FulfillmentNotFoundException(command.fulfillmentId)

        val fromStatus = fulfillmentOrder.getStatus()
        val targetStatus = FulfillmentStatus.valueOf(command.targetStatus)
        val event = fulfillmentOrder.transition(targetStatus)
        fulfillmentRepository.save(fulfillmentOrder)

        val fulfillmentId = requireNotNull(fulfillmentOrder.id)
        val eventType = when (event) {
            is FulfillmentEvent.Shipped -> "fulfillment.order.shipped"
            is FulfillmentEvent.Delivered -> "fulfillment.order.delivered"
            is FulfillmentEvent.Cancelled -> "fulfillment.order.cancelled"
            else -> "fulfillment.order.status-changed"
        }
        outboxPort.save(
            aggregateType = "FulfillmentOrder",
            aggregateId = fulfillmentId,
            eventType = eventType,
            payload = objectMapper.writeValueAsString(event)
        )

        return TransitionFulfillmentUseCase.Result(
            fulfillmentId = fulfillmentId,
            orderId = fulfillmentOrder.orderId,
            fromStatus = fromStatus.name,
            toStatus = targetStatus.name
        )
    }

    @Transactional(readOnly = true)
    override fun findById(id: Long): GetFulfillmentUseCase.Result {
        val fulfillmentOrder = fulfillmentRepository.findById(id)
            ?: throw FulfillmentNotFoundException(id)
        return toResult(fulfillmentOrder)
    }

    @Transactional(readOnly = true)
    override fun findByOrderId(orderId: Long): GetFulfillmentUseCase.Result {
        val fulfillmentOrder = fulfillmentRepository.findByOrderId(orderId)
            ?: throw FulfillmentNotFoundException(orderId)
        return toResult(fulfillmentOrder)
    }

    private fun toResult(fo: FulfillmentOrder): GetFulfillmentUseCase.Result {
        return GetFulfillmentUseCase.Result(
            fulfillmentId = requireNotNull(fo.id),
            orderId = fo.orderId,
            warehouseId = fo.warehouseId,
            status = fo.getStatus().name,
            createdAt = fo.createdAt
        )
    }
}
