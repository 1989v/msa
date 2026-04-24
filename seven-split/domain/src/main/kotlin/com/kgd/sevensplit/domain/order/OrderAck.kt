package com.kgd.sevensplit.domain.order

import java.time.Instant

/**
 * 거래소가 주문을 접수했음을 알리는 Ack DTO.
 *
 * `exchangeOrderId` 는 이후 체결 콜백 매칭에 쓰인다.
 */
data class OrderAck(
    val exchangeOrderId: String,
    val acceptedAt: Instant
)
