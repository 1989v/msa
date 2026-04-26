package com.kgd.quant.domain.order

import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.Price
import com.kgd.quant.domain.common.Quantity
import com.kgd.quant.domain.common.StrategyId

/**
 * 주문 실행 요청 DTO — Application → Exchange Adapter 간 전달.
 *
 * `type`이 [SpotOrderType.Market] 이면 price 는 null (또는 무시됨).
 * `type`이 [SpotOrderType.Limit] 이면 `type.price` 가 곧 지정가.
 *
 * ## Phase 2 확장 (TG-P2-08)
 * - [strategyId] 와 [symbol] 은 페이퍼/실매매에서 PaperAccount 잔고 분기와 라이브 시세 조회를 위해 필요.
 * - Phase 1 백테스트 호환을 위해 둘 다 nullable + default null. BacktestExchangeAdapter 는 사용하지 않는다.
 * - PAPER/LIVE 어댑터 호출 시에는 반드시 채워서 전달해야 한다 (어댑터 내부 require 가드 권장).
 */
data class OrderCommand(
    val orderId: OrderId,
    val side: OrderSide,
    val type: SpotOrderType,
    val quantity: Quantity,
    val price: Price?,
    val strategyId: StrategyId? = null,
    val symbol: String? = null
)
