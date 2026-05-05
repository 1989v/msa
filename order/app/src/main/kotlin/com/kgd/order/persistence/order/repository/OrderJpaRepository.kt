package com.kgd.order.infrastructure.persistence.order.repository

import com.kgd.order.infrastructure.persistence.order.entity.OrderJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.math.BigDecimal
import java.time.LocalDateTime

interface OrderJpaRepository : JpaRepository<OrderJpaEntity, Long> {
    @Query("SELECT o FROM OrderJpaEntity o JOIN FETCH o.items WHERE o.id = :id")
    fun findByIdWithItems(id: Long): OrderJpaEntity?

    // === Admin dashboard 집계 (read-only) ===

    fun countByCreatedAtAfter(from: LocalDateTime): Long

    @Query(
        """
        SELECT COALESCE(SUM(i.unitPrice * i.quantity), 0)
        FROM OrderJpaEntity o JOIN o.items i
        WHERE o.createdAt >= :from
        """
    )
    fun sumRevenueByCreatedAtAfter(@Param("from") from: LocalDateTime): BigDecimal?

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
