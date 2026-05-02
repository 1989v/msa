package com.kgd.common.messaging.outbox

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify

class OutboxJpaAdapterSpec : BehaviorSpec({

    given("OutboxJpaAdapter") {
        val repository = mockk<OutboxRepository>()
        val adapter = OutboxJpaAdapter(repository)

        `when`("save 가 호출되면") {
            then("OutboxEntity 한 건이 PENDING 상태로 INSERT 된다") {
                val captor = slot<OutboxEntity>()
                every { repository.save(capture(captor)) } answers { captor.captured }

                adapter.save(
                    aggregateType = "FulfillmentOrder",
                    aggregateId = 42L,
                    eventType = "fulfillment.order.created",
                    payload = """{"orderId":1}""",
                )

                verify(exactly = 1) { repository.save(any()) }
                captor.captured.aggregateType shouldBe "FulfillmentOrder"
                captor.captured.aggregateId shouldBe 42L
                captor.captured.eventType shouldBe "fulfillment.order.created"
                captor.captured.payload shouldBe """{"orderId":1}"""
                captor.captured.status shouldBe "PENDING"
                captor.captured.publishedAt shouldBe null
                captor.captured.eventId.length shouldBe 36 // UUID
            }
        }
    }
})
