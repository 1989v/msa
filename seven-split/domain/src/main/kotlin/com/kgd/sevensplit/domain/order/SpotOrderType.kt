package com.kgd.sevensplit.domain.order

import com.kgd.sevensplit.domain.common.Price

/**
 * Spot(현물) 주문 타입 sealed 계층.
 *
 * 7분할 전략은 현물만 허용한다. margin / future 는 이 계층 하위에 없으므로
 * 컴파일 시점에 사용이 차단된다 (INV-03 / INV-04).
 */
sealed class SpotOrderType {
    object Market : SpotOrderType()

    data class Limit(val price: Price) : SpotOrderType()
}
