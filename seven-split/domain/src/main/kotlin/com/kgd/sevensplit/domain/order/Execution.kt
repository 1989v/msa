package com.kgd.sevensplit.domain.order

import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import java.time.Instant

/**
 * 체결 DTO — 거래소의 체결 이벤트 한 건을 표현.
 *
 * 부분체결이 다건 발생할 수 있으므로, 도메인에서는 누적 체결 수량을 Order에서 집계한다.
 */
data class Execution(
    val price: Price,
    val quantity: Quantity,
    val executedAt: Instant
)
