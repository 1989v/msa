package com.kgd.order.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.order.application.readmodel.service.ReadModelSyncService
import com.kgd.order.support.InMemoryOrderPorts
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.apache.kafka.clients.consumer.ConsumerRecord
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant
import java.util.UUID

/**
 * 읽기 모델 컨슈머 — 발행자 페이로드 모양을 받아 행 값으로 판정한다.
 * 멱등 원장은 통과시키는 대역이다(원장 자체는 common 테스트가 본다).
 */
class OrderReadModelConsumerTest : BehaviorSpec({
    val ports = InMemoryOrderPorts()
    val sync = ReadModelSyncService(ports.products, ports.sellers, ports.couponDefinitions, ports.userCoupons, ports.points)
    val handler = mockk<IdempotentEventHandler>()
    every { handler.process(any(), any(), any()) } answers {
        thirdArg<() -> Unit>().invoke()
        IdempotentEventHandler.Outcome.PROCESSED
    }
    val consumer = OrderReadModelConsumer(sync, jacksonMapperBuilder().build(), handler, mockk<IdempotentMetrics>(relaxed = true))

    fun record(topic: String, json: String, timestamp: Long = 0L) =
        ConsumerRecord(topic, 0, 0L, timestamp, org.apache.kafka.common.record.TimestampType.CREATE_TIME, 0, 0, "k", json,
            org.apache.kafka.common.header.internals.RecordHeaders(), java.util.Optional.empty())

    fun id() = UUID.randomUUID()

    given("seller.seller.*") {
        then("정지 뒤 늦게 도착한 옛 승인은 반영하지 않는다") {
            consumer.onSeller(record("seller.seller.suspended",
                """{"eventId":"${id()}","sellerId":7,"memberId":"m-7","status":"SUSPENDED","commissionRateBp":1200,"shippingFee":3000,"settlementCycle":"WEEKLY","occurredAt":"2026-10-02T00:00:00Z"}"""))
            consumer.onSeller(record("seller.seller.approved",
                """{"eventId":"${id()}","sellerId":7,"memberId":"m-7","status":"ACTIVE","commissionRateBp":1200,"shippingFee":3000,"settlementCycle":"WEEKLY","occurredAt":"2026-10-01T00:00:00Z"}"""))
            ports.sellerRows[7L]!!.status shouldBe "SUSPENDED"
        }
        then("승인 전(PENDING) 수수료율 null 도 받는다 — epoch 초(ms) 시각도") {
            consumer.onSeller(record("seller.seller.applied",
                """{"eventId":"${id()}","sellerId":9,"memberId":"m-9","status":"PENDING","commissionRateBp":null,"shippingFee":0,"settlementCycle":"MONTHLY","occurredAt":1790000000.123}"""))
            ports.sellerRows[9L]!!.commissionRateBp shouldBe null
            ports.sellerRows[9L]!!.occurredAt shouldBe Instant.ofEpochSecond(1790000000L, 123000000L)
        }
    }

    given("product.item.*") {
        then("새 이벤트: 정수 가격 + occurredAt") {
            consumer.onProduct(record("product.item.updated",
                """{"eventId":"${id()}","productId":101,"name":"머그","price":12000,"status":"ACTIVE","sellerId":7,"eventTime":"2026-10-01T09:00:00","occurredAt":"2026-10-01T00:00:00Z"}"""))
            ports.productRows[101L]!!.price shouldBe 12_000L
        }
        then("아웃박스 전 이벤트: DECIMAL 가격 · occurredAt 없음 → eventTime 을 서울 시각으로") {
            consumer.onProduct(record("product.item.created",
                """{"eventId":"${id()}","productId":102,"name":"컵","price":3000.00,"status":"ACTIVE","sellerId":1,"eventTime":"2026-09-01T09:00:00"}"""))
            ports.productRows[102L]!!.price shouldBe 3_000L
            ports.productRows[102L]!!.occurredAt shouldBe Instant.parse("2026-09-01T00:00:00Z")
        }
    }

    given("promotion.*") {
        then("쿠폰 발급 → 보류로 RESERVED, 늦게 온 발급 재전달은 상태를 되돌리지 않는다") {
            val issued = """{"eventId":"${id()}","userCouponId":900,"memberId":"m-1","couponDefinitionId":50,"status":"AVAILABLE","issuedAt":"2026-10-01T00:00:00Z"}"""
            consumer.onCouponIssued(record("promotion.coupon.issued", issued))
            consumer.onHold(record("promotion.hold.reserved",
                """{"eventId":"${id()}","orderId":1,"command":"RESERVE","memberId":"m-1","holdStatus":"RESERVED","userCouponId":900,"couponDefinitionId":50,"userCouponStatus":"RESERVED","couponDiscount":1000,"pointAmount":0,"restoredPointAmount":0,"restoredPoints":null,"couponReturned":false,"reason":null,"expiresAt":"2026-10-01T01:00:00Z","occurredAt":"2026-10-01T00:30:00Z"}"""))
            consumer.onCouponIssued(record("promotion.coupon.issued", issued.replace(Regex("\"eventId\":\"[^\"]+\""), "\"eventId\":\"${id()}\"")))
            ports.userCouponRows[900L]!!.status shouldBe "RESERVED"
        }
        then("쿠폰 없는 보류 이벤트는 건너뛴다") {
            consumer.onHold(record("promotion.hold.failed",
                """{"eventId":"${id()}","orderId":2,"command":"RESERVE","memberId":null,"holdStatus":null,"userCouponId":null,"couponDefinitionId":null,"userCouponStatus":null,"couponDiscount":0,"pointAmount":0,"restoredPointAmount":0,"restoredPoints":null,"couponReturned":false,"reason":"HOLD_NOT_FOUND","expiresAt":null,"occurredAt":"2026-10-01T00:30:00Z"}"""))
            ports.userCouponRows.keys shouldBe setOf(900L)
        }
        then("쿠폰 정의·포인트 잔액") {
            consumer.onCouponDefined(record("promotion.coupon.defined",
                """{"eventId":"${id()}","couponDefinitionId":50,"name":"정률","type":"RATE","amount":null,"rateBp":1000,"maxDiscount":5000,"minOrderAmount":10000,"validFrom":"2026-10-01T00:00:00Z","validUntil":"2026-11-01T00:00:00Z","bearer":"SELLER","sellerId":7,"status":"ACTIVE","issueLimit":100}""",
                timestamp = 1_000L))
            consumer.onPointChanged(record("promotion.point.changed",
                """{"eventId":"${id()}","memberId":"m-1","balance":4500,"delta":-500,"type":"USE","orderId":1,"occurredAt":"2026-10-01T00:30:00Z"}"""))
            ports.definitionRows[50L]!!.rateBp shouldBe 1_000
            ports.definitionRows[50L]!!.sellerId shouldBe 7L
            ports.pointRows["m-1"]!!.balance shouldBe 4_500L
        }
    }
})
