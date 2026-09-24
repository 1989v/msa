package com.kgd.order.infrastructure.persistence.order.repository

import com.kgd.order.domain.order.model.OrderLineStatus
import com.kgd.order.domain.order.model.OrderStatus
import com.kgd.order.infrastructure.persistence.order.entity.OrderJpaEntity
import com.kgd.order.infrastructure.persistence.order.entity.OrderStatusHistoryJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.time.LocalDateTime

interface OrderJpaRepository : JpaRepository<OrderJpaEntity, Long> {
    @Query("SELECT o FROM OrderJpaEntity o JOIN FETCH o.items WHERE o.id = :id")
    fun findByIdWithItems(id: Long): OrderJpaEntity?

    @Query("SELECT DISTINCT o FROM OrderJpaEntity o JOIN FETCH o.items WHERE o.userId = :userId ORDER BY o.createdAt DESC")
    fun findAllByUserIdWithItems(userId: String): List<OrderJpaEntity>

    fun countByUserIdAndStatusIn(userId: String, statuses: Collection<OrderStatus>): Long

    @Query(
        """
        SELECT DISTINCT o.id FROM OrderJpaEntity o JOIN o.items i
        WHERE o.status = :status AND i.status = :lineStatus AND i.deliveredAt <= :deliveredBefore
        ORDER BY o.id
        """
    )
    fun findAutoConfirmCandidateIds(
        @Param("status") status: OrderStatus,
        @Param("lineStatus") lineStatus: OrderLineStatus,
        @Param("deliveredBefore") deliveredBefore: Instant,
        pageable: Pageable,
    ): List<Long>

    // === Admin dashboard 집계 (read-only) ===

    fun countByCreatedAtAfter(from: LocalDateTime): Long

    @Query(
        """
        SELECT COALESCE(SUM(i.unitPriceWon * i.quantity), 0)
        FROM OrderJpaEntity o JOIN o.items i
        WHERE o.createdAt >= :from
        """
    )
    fun sumRevenueByCreatedAtAfter(@Param("from") from: LocalDateTime): Long?

    /** 일자별 주문 수 — 결과 row = [java.sql.Date, count(Long)]. */
    @Query(
        value = """
        SELECT CAST(o.created_at AS DATE) AS d, COUNT(*) AS c
        FROM orders o
        WHERE o.created_at >= :from
        GROUP BY CAST(o.created_at AS DATE)
        ORDER BY d
        """,
        nativeQuery = true,
    )
    fun aggregateDailyOrders(@Param("from") from: LocalDateTime): List<Array<Any>>
}

interface OrderStatusHistoryJpaRepository : JpaRepository<OrderStatusHistoryJpaEntity, Long> {
    fun findAllByOrderIdOrderByIdAsc(orderId: Long): List<OrderStatusHistoryJpaEntity>
}
