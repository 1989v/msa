package com.kgd.quant.application.port.exchange

import com.kgd.quant.domain.common.Price
import com.kgd.quant.domain.order.OrderSide

/**
 * SlippageModel — 페이퍼 트레이딩 가상 체결가 계산 port (TG-P2-08).
 *
 * ## 배치 위치
 * Application 레이어. `PaperExchangeAdapter` 가 마지막 tick 가격에 슬리피지를 적용해 가상 체결가를 산출.
 *
 * ## 계약
 * - `apply(tick, BUY)` → tick 보다 비싸지거나 같음 (불리한 방향)
 * - `apply(tick, SELL)` → tick 보다 싸지거나 같음 (불리한 방향)
 * - 결정론을 보장한다 — 동일 (tick, side) 입력은 항상 동일한 결과.
 *
 * ## 구현체
 * - [com.kgd.quant.infrastructure.exchange.FixedSlippageModel] (Phase 2 default 0.05%)
 * - 동적 슬리피지 (호가창 기반) 는 Phase 3+ 검토.
 */
interface SlippageModel {
    fun apply(tick: Price, side: OrderSide): Price
}
