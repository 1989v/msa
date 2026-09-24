package com.kgd.order.infrastructure.persistence.saga.adapter

import com.kgd.order.application.saga.port.OrderSagaRepositoryPort
import com.kgd.order.domain.saga.model.OrderSaga
import com.kgd.order.domain.saga.model.ReservedLine
import com.kgd.order.domain.saga.model.SagaStatus
import com.kgd.order.domain.saga.model.SagaStep
import com.kgd.order.infrastructure.persistence.saga.entity.OrderSagaJpaEntity
import com.kgd.order.infrastructure.persistence.saga.repository.OrderSagaJpaRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.PageRequest
import org.springframework.orm.ObjectOptimisticLockingFailureException
import org.springframework.stereotype.Component
import tools.jackson.core.type.TypeReference
import tools.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Instant

/** 호출자의 order 트랜잭션 안에서 부른다 */
@Component
class OrderSagaRepositoryAdapter(
    private val jpa: OrderSagaJpaRepository,
    private val objectMapper: ObjectMapper,
    @Qualifier("orderClock") private val clock: Clock,
) : OrderSagaRepositoryPort {

    override fun create(saga: OrderSaga) {
        val entity = OrderSagaJpaEntity(saga.orderId, saga.orderNo, saga.paymentRequired, saga.startedAt, saga.prePivotDeadlineAt)
        copy(saga, entity)
        jpa.saveAndFlush(entity)
    }

    override fun save(saga: OrderSaga) {
        val entity = jpa.findById(saga.orderId).orElseThrow { IllegalStateException("사가가 없다: orderId=${saga.orderId}") }
        // 읽은 뒤 다른 트랜잭션이 커밋했으면 여기서, 읽기와 쓰기 사이에 커밋했으면 flush 의 버전 조건이 되돌린다
        if (entity.version != saga.version) throw ObjectOptimisticLockingFailureException(OrderSagaJpaEntity::class.java, saga.orderId)
        copy(saga, entity)
        jpa.saveAndFlush(entity)
    }

    override fun findByOrderId(orderId: Long): OrderSaga? = jpa.findById(orderId).orElse(null)?.toDomain()

    override fun findAllByOrderIds(orderIds: Collection<Long>): List<OrderSaga> =
        if (orderIds.isEmpty()) emptyList() else jpa.findAllById(orderIds).map { it.toDomain() }

    override fun findDueOrderIds(now: Instant, limit: Int): List<Long> =
        jpa.findDueOrderIds(listOf(SagaStatus.RUNNING, SagaStatus.COMPENSATING), now, PageRequest.of(0, limit))

    override fun findStalledOrderIds(enteredBefore: Instant, limit: Int): List<Long> =
        jpa.findStalledOrderIds(listOf(SagaStatus.RUNNING, SagaStatus.COMPENSATING), enteredBefore, PageRequest.of(0, limit))

    /** 바뀐 것이 없으면 행을 건드리지 않는다 — 단계와 맞지 않아 무시한 답이 버전을 올려 동시 처리끼리 부딪치지 않게 */
    private fun copy(saga: OrderSaga, entity: OrderSagaJpaEntity) {
        val before = fingerprint(entity)
        entity.status = saga.status
        entity.step = saga.step
        entity.attempts = saga.attempts
        entity.nextDeadlineAt = saga.nextDeadlineAt
        entity.stepEnteredAt = saga.stepEnteredAt
        entity.pendingVoid = saga.pendingVoid
        entity.holdsExpired = saga.holdsExpired
        entity.paymentUnknown = saga.paymentUnknown
        entity.inventoryConfirmed = saga.inventoryConfirmed
        entity.promotionConfirmed = saga.promotionConfirmed
        entity.cancelRequested = saga.cancelRequested
        entity.compensationPlan = saga.compensationPlan.takeIf { it.isNotEmpty() }?.joinToString(",") { it.name }
        entity.failureReason = saga.failureReason
        // MySQL JSON 컬럼은 저장한 문자열을 정규화해 돌려준다 — 문자열로 비교하면 매번 바뀐 것으로 보여 버전이 오른다
        if (parse(entity.reservedLines) != saga.reservedLines) {
            entity.reservedLines = saga.reservedLines.takeIf { it.isNotEmpty() }?.let(objectMapper::writeValueAsString)
        }
        if (fingerprint(entity) != before) entity.updatedAt = clock.instant()
    }

    private fun parse(json: String?): List<ReservedLine> = json?.let { objectMapper.readValue(it, RESERVED_LINES) }.orEmpty()

    private fun fingerprint(e: OrderSagaJpaEntity) = listOf(
        e.status, e.step, e.attempts, e.nextDeadlineAt, e.stepEnteredAt, e.pendingVoid, e.holdsExpired, e.paymentUnknown, e.inventoryConfirmed,
        e.promotionConfirmed, e.cancelRequested, e.compensationPlan, e.failureReason, e.reservedLines,
    )

    private fun OrderSagaJpaEntity.toDomain() = OrderSaga.restore(
        orderId = orderId,
        orderNo = orderNo,
        paymentRequired = paymentRequired,
        status = status,
        step = step,
        attempts = attempts,
        nextDeadlineAt = nextDeadlineAt,
        startedAt = startedAt,
        prePivotDeadlineAt = prePivotDeadlineAt,
        pendingVoid = pendingVoid,
        holdsExpired = holdsExpired,
        paymentUnknown = paymentUnknown,
        inventoryConfirmed = inventoryConfirmed,
        promotionConfirmed = promotionConfirmed,
        cancelRequested = cancelRequested,
        compensationPlan = compensationPlan?.split(",")?.filter { it.isNotBlank() }?.map(SagaStep::valueOf).orEmpty(),
        failureReason = failureReason,
        reservedLines = parse(reservedLines),
        version = version,
        stepEnteredAt = stepEnteredAt,
    )

    private companion object {
        val RESERVED_LINES = object : TypeReference<List<ReservedLine>>() {}
    }
}
