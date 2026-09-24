package com.kgd.order.presentation.order.dto

/** 이번에 구매 확정한 라인 번호 */
data class PurchaseConfirmResponse(val orderId: Long, val confirmedLineNos: List<Int>)
