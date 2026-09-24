package com.kgd.order.presentation.order.dto

import jakarta.validation.constraints.Positive

/** 주문 접수 — 주문서 id 하나. 금액·상품은 주문서 스냅샷에서만 온다(가격 필드 없음) */
data class PlaceOrderRequest(
    @field:Positive(message = "주문서 ID는 0보다 커야 합니다")
    val orderSheetId: Long,
)
