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
                captor.captured.partitionKey shouldBe null
                captor.captured.headers shouldBe null
            }
        }

        `when`("partitionKey 와 headers 를 넘기면") {
            then("레코드 키와 헤더 JSON 이 행에 남는다") {
                val captor = slot<OutboxEntity>()
                every { repository.save(capture(captor)) } answers { captor.captured }

                adapter.save(
                    aggregateType = "Order",
                    aggregateId = 7L,
                    eventType = "order.order.completed",
                    payload = """{"orderId":7}""",
                    partitionKey = "order-7",
                    headers = mapOf("traceparent" to "00-abc-def-01"),
                )

                captor.captured.partitionKey shouldBe "order-7"
                captor.captured.headers shouldBe """{"traceparent":"00-abc-def-01"}"""
            }
        }

        `when`("헤더 소스(현재 추적 문맥)가 있으면") {
            then("행에 그 헤더가 남고, 호출자가 같은 이름을 넘기면 호출자 것이 이긴다") {
                val traced = OutboxJpaAdapter(repository, headerSource = { mapOf("traceparent" to "00-trace-span-01", "baggage" to "k=v") })
                val captor = slot<OutboxEntity>()
                every { repository.save(capture(captor)) } answers { captor.captured }

                traced.save("Order", 1L, "order.order.confirmed", """{"orderId":1}""")
                captor.captured.headers shouldBe """{"traceparent":"00-trace-span-01","baggage":"k=v"}"""

                traced.save("Order", 1L, "order.order.confirmed", """{"orderId":1}""", null, mapOf("traceparent" to "00-explicit-01"))
                captor.captured.headers shouldBe """{"traceparent":"00-explicit-01","baggage":"k=v"}"""
            }
        }
    }
})
