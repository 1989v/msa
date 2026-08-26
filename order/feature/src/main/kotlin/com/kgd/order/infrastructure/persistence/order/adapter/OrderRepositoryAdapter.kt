package com.kgd.order.infrastructure.persistence.order.adapter

import com.kgd.order.application.order.port.DailyOrderCount
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.Order
import com.kgd.order.infrastructure.persistence.order.entity.OrderJpaEntity
import com.kgd.order.infrastructure.persistence.order.repository.OrderJpaRepository
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.LocalDateTime

@Component
class OrderRepositoryAdapter(
    private val jpaRepository: OrderJpaRepository
) : OrderRepositoryPort {

    override fun save(order: Order): Order {
        val id = order.id
        val entity = if (id != null) {
            jpaRepository.findByIdWithItems(id)
                ?.also { it.changeStatus(order.status) }
                ?: throw OrderNotFoundException(id)
        } else {
            OrderJpaEntity.fromDomain(order)
        }
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): Order? =
        jpaRepository.findByIdWithItems(id)?.toDomain()

    override fun findAllByUserId(userId: String): List<Order> =
        jpaRepository.findAllByUserIdWithItems(userId).map { it.toDomain() }

    override fun countCreatedAfter(from: LocalDateTime): Long =
        jpaRepository.countByCreatedAtAfter(from)

    override fun sumRevenueCreatedAfter(from: LocalDateTime): BigDecimal =
        jpaRepository.sumRevenueByCreatedAtAfter(from) ?: BigDecimal.ZERO

    // 네이티브 집계라 row 가 [java.sql.Date, count] 배열로 온다 — 포트 밖으로 나가기 전에 형을 준다
    override fun countDailyCreatedAfter(from: LocalDateTime): List<DailyOrderCount> =
        jpaRepository.aggregateDailyOrders(from).map { row ->
            DailyOrderCount(date = (row[0] as java.sql.Date).toLocalDate(), count = (row[1] as Number).toLong())
        }
}
