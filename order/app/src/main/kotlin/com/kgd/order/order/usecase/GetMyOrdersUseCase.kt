package com.kgd.order.application.order.usecase

import java.math.BigDecimal
import java.time.LocalDateTime

/**
 * 내 주문 목록 조회 — gateway 가 주입한 `X-User-Id` 기준으로 본인 주문만 반환한다.
 */
interface GetMyOrdersUseCase {
    fun execute(userId: String): List<Result>

    data class Result(
        val orderId: Long,
        val totalAmount: BigDecimal,
        val status: String,
        val createdAt: LocalDateTime,
        val items: List<Item>,
    )

    data class Item(
        val productId: Long,
        val quantity: Int,
        val unitPrice: BigDecimal,
    )
}
