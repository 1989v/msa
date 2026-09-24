package com.kgd.order.infrastructure.persistence.order.adapter

import com.kgd.order.application.order.port.DailyOrderCount
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderLineStatus
import com.kgd.order.domain.order.model.OrderStatus
import com.kgd.order.infrastructure.persistence.order.entity.OrderJpaEntity
import com.kgd.order.infrastructure.persistence.order.entity.OrderStatusHistoryJpaEntity
import com.kgd.order.infrastructure.persistence.order.repository.OrderJpaRepository
import com.kgd.order.infrastructure.persistence.order.repository.OrderStatusHistoryJpaRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.PageRequest
import org.springframework.orm.ObjectOptimisticLockingFailureException
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime

/** 호출자의 order 트랜잭션 안에서 부른다. 저장할 때 도메인에 쌓인 상태 전이를 이력 행으로 함께 남긴다 */
@Component
class OrderRepositoryAdapter(
    private val jpaRepository: OrderJpaRepository,
    private val historyRepository: OrderStatusHistoryJpaRepository,
    @Qualifier("orderClock") private val clock: Clock,
) : OrderRepositoryPort {

    override fun save(order: Order): Order {
        val now = clock.instant()
        val id = order.id
        val entity = if (id != null) {
            val found = jpaRepository.findByIdWithItems(id) ?: throw OrderNotFoundException(id)
            // 다른 트랜잭션이 먼저 바꾼 주문을 옛 값으로 덮지 않는다 — 커밋 때의 버전 검사와 같은 뜻을 읽은 시점에도 본다
            if (found.version != order.version) throw ObjectOptimisticLockingFailureException(OrderJpaEntity::class.java, id)
            found.apply(order, now)
            found
        } else {
            OrderJpaEntity.fromDomain(order, now)
        }
        val saved = jpaRepository.saveAndFlush(entity)
        val orderId = requireNotNull(saved.id)
        historyRepository.saveAll(
            order.pullStatusChanges().map {
                OrderStatusHistoryJpaEntity(
                    orderId = orderId, fromStatus = it.from?.name, toStatus = it.to.name, reason = it.reason,
                    actor = it.actor, occurredAt = it.occurredAt,
                )
            },
        )
        return saved.toDomain()
    }

    override fun findById(id: Long): Order? =
        jpaRepository.findByIdWithItems(id)?.toDomain()

    override fun findAllByUserId(userId: String): List<Order> =
        jpaRepository.findAllByUserIdWithItems(userId).map { it.toDomain() }

    override fun findAutoConfirmCandidateIds(deliveredBefore: Instant, limit: Int): List<Long> =
        jpaRepository.findAutoConfirmCandidateIds(OrderStatus.FULFILLING, OrderLineStatus.ACTIVE, deliveredBefore, PageRequest.of(0, limit))

    override fun countAwaitingPayment(userId: String): Long =
        jpaRepository.countByUserIdAndStatusIn(userId, OrderStatus.entries.filter { it.awaitingPayment })

    override fun countCreatedAfter(from: LocalDateTime): Long =
        jpaRepository.countByCreatedAtAfter(from)

    override fun sumRevenueCreatedAfter(from: LocalDateTime): BigDecimal =
        BigDecimal.valueOf(jpaRepository.sumRevenueByCreatedAtAfter(from) ?: 0L)

    // 네이티브 집계라 row 가 [java.sql.Date, count] 배열로 온다 — 포트 밖으로 나가기 전에 형을 준다
    override fun countDailyCreatedAfter(from: LocalDateTime): List<DailyOrderCount> =
        jpaRepository.aggregateDailyOrders(from).map { row ->
            DailyOrderCount(date = (row[0] as java.sql.Date).toLocalDate(), count = (row[1] as Number).toLong())
        }
}
