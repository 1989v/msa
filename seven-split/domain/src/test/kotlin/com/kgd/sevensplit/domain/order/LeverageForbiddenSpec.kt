package com.kgd.sevensplit.domain.order

import com.kgd.sevensplit.domain.common.Price
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe

/**
 * Principle 2: 레버리지 / 마진 / 선물 금지.
 *
 *   - 주문 타입은 SpotOrderType sealed 계층으로 한정.
 *   - 허용 서브타입: Market, Limit.
 *   - margin / future 는 계층에 존재하지 않아 컴파일 시점에 차단된다.
 *
 *   컴파일 시점 보증을 리플렉션으로 재확인하여, 향후 누군가
 *   SpotOrderType 에 새 서브타입을 추가하면 이 테스트가 실패하도록 guard 한다.
 */
class LeverageForbiddenSpec : BehaviorSpec({

    Given("SpotOrderType sealed 계층") {
        Then("서브타입은 Market 과 Limit 뿐이다") {
            // Principle 2
            val names = SpotOrderType::class.sealedSubclasses.map { it.simpleName!! }
            names shouldContainExactlyInAnyOrder listOf("Market", "Limit")
        }
        Then("Margin / Future / Leverage 관련 타입이 존재하지 않는다") {
            // Principle 2 — 이름 기반 가드 (실수로라도 추가되면 실패)
            val forbiddenKeywords = listOf("Margin", "Future", "Leverage", "Perp", "Perpetual")
            val names = SpotOrderType::class.sealedSubclasses.map { it.simpleName!! }
            forbiddenKeywords.all { kw ->
                names.none { it.contains(kw, ignoreCase = true) }
            } shouldBe true
        }
    }

    Given("Order 를 SpotOrderType.Limit 으로 생성") {
        When("price 와 type.price 가 일치하면") {
            Then("정상 생성된다") {
                // Principle 2 — 허용 타입은 정상 동작
                val price = Price.of("100")
                val order = Order.create(
                    orderId = com.kgd.sevensplit.domain.common.OrderId.newV7(),
                    slotId = com.kgd.sevensplit.domain.common.SlotId.newId(),
                    side = OrderSide.BUY,
                    type = SpotOrderType.Limit(price),
                    quantity = com.kgd.sevensplit.domain.common.Quantity.of("1"),
                    price = price
                )
                order.type::class.simpleName shouldBe "Limit"
            }
        }
    }
})
