package com.kgd.promotion.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.promotion.application.PromotionHarness
import com.kgd.promotion.application.T0
import com.kgd.promotion.application.hold.port.HoldEventType
import com.kgd.promotion.domain.hold.model.PromotionFailureReason
import com.kgd.promotion.domain.hold.model.PromotionHoldStatus
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.apache.kafka.clients.consumer.ConsumerRecord
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Duration
import java.util.UUID

/**
 * 컨슈머 → 실제 유스케이스·도메인(저장소 메모리). DLT 로 가는지는 리스너가 예외를 던지느냐로 정해진다 —
 * 컨테이너의 에러 핸들러가 예외만 DLT 로 보낸다. 그래서 판정 근거는 "예외 없음 + 발행된 failed 이벤트"다.
 */
class PromotionCommandConsumerTest : BehaviorSpec({

    val objectMapper = jacksonMapperBuilder().build()

    fun consumer(h: PromotionHarness): PromotionCommandConsumer {
        // 원장 겹은 그대로 통과시킨다 — 여기서 보는 것은 유스케이스의 답이다
        val idempotent = mockk<IdempotentEventHandler>()
        every { idempotent.process(any(), any(), any()) } answers {
            thirdArg<() -> Unit>().invoke()
            IdempotentEventHandler.Outcome.PROCESSED
        }
        return PromotionCommandConsumer(h.holdService, objectMapper, idempotent, mockk<IdempotentMetrics>(relaxed = true))
    }

    fun record(topic: String, json: String) = ConsumerRecord(topic, 0, 0L, "100", json)

    given("보류 30분이 지난 주문에 확정 명령이 온다") {
        then("리스너는 예외 없이 끝나고 failed(EXPIRED) 가 발행된다 — DLT 로 가지 않는다") {
            val h = PromotionHarness()
            h.grant("7", 5_000L)
            val c = consumer(h)
            c.onReserve(
                record(
                    PromotionCommandConsumer.RESERVE,
                    """{"eventId":"${UUID.randomUUID()}","orderId":100,"memberId":"7","pointAmount":3000,"lines":[{"sellerId":1,"amount":20000}]}""",
                ),
            )
            h.clock.now = T0.plus(Duration.ofMinutes(30))

            shouldNotThrowAny {
                c.onConfirm(record(PromotionCommandConsumer.CONFIRM, """{"eventId":"${UUID.randomUUID()}","orderId":100}"""))
            }
            h.events.holds.last().let {
                it.type shouldBe HoldEventType.FAILED
                it.reason shouldBe PromotionFailureReason.EXPIRED
            }
            h.holds.findByOrderId(100L)!!.status shouldBe PromotionHoldStatus.EXPIRED
            h.balanceOf("7") shouldBe 5_000L
        }
    }

    given("계약을 어긴 페이로드") {
        then("restoreKey 없는 원복은 예외 — 이것만 DLT 로 간다") {
            val h = PromotionHarness()
            shouldThrow<IllegalArgumentException> {
                consumer(h).onRestore(record(PromotionCommandConsumer.RESTORE, """{"orderId":100,"pointAmount":1000}"""))
            }
        }
    }
})
