package com.kgd.settlement.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRecord
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.settlement.application.SettlementHarness
import com.kgd.settlement.domain.ledger.model.JournalType
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.mockk
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant
import java.util.UUID

/**
 * 수신 계약 — order·payment·seller 가 실제로 싣는 모양(필드 전부, 이 도메인이 안 쓰는 것 포함)의 JSON 을 넣어
 * 원장·정산 항목·판매자 행이 생기는지 본다. 페이로드 필드 이름이 바뀌면 여기서 먼저 빨간불이 난다.
 */
class SettlementEventConsumerTest : BehaviorSpec({

    class InMemoryProcessed : ProcessedEventRepositoryPort {
        val rows = mutableSetOf<Pair<UUID, String>>()
        override fun existsBy(eventId: UUID, consumerGroup: String) = (eventId to consumerGroup) in rows
        override fun mark(record: ProcessedEventRecord) {
            rows += record.eventId to record.consumerGroup
        }
        override fun deleteOlderThan(cutoff: Instant) = 0
    }

    fun consumer(h: SettlementHarness) = SettlementEventConsumer(
        h.ledger, h.register, h.sellerSync, jacksonMapperBuilder().build(),
        IdempotentEventHandler(InMemoryProcessed(), TransactionTemplate(mockk<PlatformTransactionManager>(relaxed = true))),
        mockk<IdempotentMetrics>(relaxed = true),
    )

    fun record(topic: String, json: String) = ConsumerRecord(topic, 0, 0L, "501", json)

    val line = """{"orderItemId":11,"lineNo":1,"sellerId":7,"productId":81,"quantity":2,"unitPrice":12000,
        "sellerCouponAllocation":1000,"platformCouponAllocation":1500,"pointAllocation":600,"commissionRateBp":1000,
        "netSales":23000,"commission":2300,"payable":20900}"""
    val confirmed = """{"eventId":"${UUID.randomUUID()}","orderId":501,"memberId":"buyer","itemsAmount":24000,"couponDiscount":2500,
        "pointAmount":600,"shippingAmount":3000,"payableAmount":23900,"confirmedAt":"2026-09-24T03:00:00Z",
        "lines":[$line],"shippingLines":[{"sellerId":7,"fee":3000}]}"""

    Given("order.order.confirmed (order 페이로드 모양 그대로)") {
        Then("매입 거래 1건, 같은 레코드가 다시 와도 1건") {
            val h = SettlementHarness(Instant.parse("2026-09-24T03:00:00Z"))
            val c = consumer(h)
            c.onOrderConfirmed(record("order.order.confirmed", confirmed))
            c.onOrderConfirmed(record("order.order.confirmed", confirmed))
            h.journals.journals.single().type shouldBe JournalType.CAPTURE
            h.journals.journals.single().debitTotal shouldBe 23_000L + 3_000L
        }
    }

    Given("order.claim.refunded · order.line.purchase-confirmed · payment.reconciliation.settled · seller.seller.approved") {
        Then("환불 거래·환불 키, 정산 항목(라인 + 배송비), PG 입금 거래, 판매자 행이 생긴다") {
            val h = SettlementHarness(Instant.parse("2026-09-24T03:00:00Z"))
            val c = consumer(h)
            c.onOrderConfirmed(record("order.order.confirmed", confirmed))
            c.onClaimRefunded(
                record(
                    "order.claim.refunded",
                    """{"eventId":"${UUID.randomUUID()}","claimId":31,"orderId":501,"memberId":"buyer","sellerId":7,"fullCancel":true,
                    "goodsShipped":false,"refundAmount":23900,"pointRestored":600,"couponReturnRequested":true,
                    "refundedAt":"2026-09-24T04:00:00Z","lines":[$line],"shippingLines":[{"sellerId":7,"fee":3000}]}""",
                ),
            )
            c.onLinePurchaseConfirmed(
                record(
                    "order.line.purchase-confirmed",
                    """{"eventId":"${UUID.randomUUID()}","orderId":502,"memberId":"buyer","sellerId":7,"trigger":"AUTO",
                    "confirmedAt":"2026-09-24T05:00:00Z","line":${line.replace("\"orderItemId\":11", "\"orderItemId\":21")},
                    "shippingLine":{"sellerId":7,"fee":3000}}""",
                ),
            )
            c.onReconciliationSettled(
                record(
                    "payment.reconciliation.settled",
                    """{"eventId":"${UUID.randomUUID()}","date":"2026-09-24","orderId":504,"orderNo":"ORD-504-1","paymentKey":"pk",
                    "grossAmount":10000,"pgFee":300,"depositAmount":9700}""",
                ),
            )
            c.onSeller(
                record(
                    "seller.seller.approved",
                    """{"eventId":"${UUID.randomUUID()}","sellerId":7,"memberId":"m7","status":"ACTIVE","commissionRateBp":1000,
                    "shippingFee":3000,"settlementCycle":"WEEKLY","occurredAt":"2026-09-20T00:00:00Z"}""",
                ),
            )

            h.journals.journals.map { it.type } shouldBe listOf(JournalType.CAPTURE, JournalType.REFUND, JournalType.PG_DEPOSIT)
            h.refunded.keys.keys shouldBe setOf("line:11", "shipping:501:7")
            h.items.items.keys shouldBe setOf("line:21", "shipping:502:7")
            h.sellers.find(7L)?.memberId shouldBe "m7"
            h.payableOf(7L) shouldBe 0L
        }
    }
})
