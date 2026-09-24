package com.kgd.settlement.domain.ledger.model

import com.kgd.settlement.domain.ledger.exception.InvalidJournalException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.time.LocalDate

/**
 * 스펙 SR-9 분개 규칙 표 네 시점 — 현실적인 주문 하나로 줄마다 금액을 손으로 계산해 적고 거래가 그 값과 같은지 본다.
 *
 * 주문: 판매자 7 머그 12,000 × 2 (판매자 쿠폰 1,000 · 플랫폼 쿠폰 1,500 · 포인트 600, 수수료 10%)
 *      판매자 9 받침 8,000 × 1 (플랫폼 쿠폰 500 · 포인트 400, 수수료 5%), 배송비 판매자 7 3,000 · 판매자 9 2,500
 */
class JournalRulesTest : BehaviorSpec({

    val t0 = Instant.parse("2026-09-24T03:00:00Z")

    // 순매출 = 판매가 × 수량 − 판매자 쿠폰, 수수료 = HALF_UP(순매출 × bp / 10000)
    val mug = LineAmounts(orderItemId = 11L, sellerId = 7L, netSales = 23_000L, commission = 2_300L, platformCoupon = 1_500L, point = 600L)
    val coaster = LineAmounts(orderItemId = 12L, sellerId = 9L, netSales = 8_000L, commission = 400L, platformCoupon = 500L, point = 400L)
    val shipping = listOf(ShippingAmount(7L, 3_000L), ShippingAmount(9L, 2_500L))
    // N = 31,000 · S = 5,500 · C = 2,700 · Dp = 2,000 · P = 1,000 · X = 33,500
    val payable = 33_500L

    fun Journal.lines() = entries.map { Triple(it.account, it.side, it.amount) to it.sellerId }

    Given("매입 (order.order.confirmed)") {
        val j = JournalRules.capture(501L, payable, listOf(mug, coaster), shipping, "evt-1", t0)

        Then("차 PG 미수금 X · 판촉 비용 Dp+P / 대 판매자별 N+S−C · 수수료 수익 C, 차 = 대 = N+S") {
            j.lines() shouldContainExactlyInAnyOrder listOf(
                Triple(Account.PG_RECEIVABLE, EntrySide.DEBIT, 33_500L) to null,
                Triple(Account.PROMOTION_EXPENSE, EntrySide.DEBIT, 3_000L) to null,
                Triple(Account.SELLER_PAYABLE, EntrySide.CREDIT, 23_000L + 3_000L - 2_300L) to 7L,
                Triple(Account.SELLER_PAYABLE, EntrySide.CREDIT, 8_000L + 2_500L - 400L) to 9L,
                Triple(Account.COMMISSION_REVENUE, EntrySide.CREDIT, 2_700L) to null,
            )
            j.debitTotal shouldBe 36_500L
            j.creditTotal shouldBe 36_500L
            j.sourceKey shouldBe "capture:order:501"
        }
        Then("이벤트의 결제액이 라인에서 다시 계산한 X 와 다르면 기록하지 않는다") {
            shouldThrow<InvalidJournalException> { JournalRules.capture(501L, payable + 1, listOf(mug, coaster), shipping, "evt-1", t0) }
        }
    }

    Given("0원 주문 — 포인트·쿠폰이 전액을 덮었다") {
        Then("PG 미수금 줄 없이 판촉 비용만으로 균형") {
            val free = LineAmounts(21L, 7L, netSales = 5_000L, commission = 500L, platformCoupon = 2_000L, point = 3_000L)
            val j = JournalRules.capture(502L, 0L, listOf(free), emptyList(), null, t0)
            j.entries.none { it.account == Account.PG_RECEIVABLE } shouldBe true
            j.debitTotal shouldBe 5_000L
            j.creditTotal shouldBe 5_000L
        }
    }

    Given("환불 (order.claim.refunded) — 판매자 9 받침 라인 + 배송비 환불") {
        val refund = 8_000L + 2_500L - 500L - 400L
        val j = JournalRules.refund(31L, 501L, refund, listOf(coaster), listOf(ShippingAmount(9L, 2_500L)), "evt-2", t0)

        Then("차 판매자 미지급금 n+s−c · 수수료 수익 c / 대 PG 미수금 n+s−dp−p · 판촉 비용 dp+p, 차 = 대 = n+s") {
            j.lines() shouldContainExactlyInAnyOrder listOf(
                Triple(Account.SELLER_PAYABLE, EntrySide.DEBIT, 10_100L) to 9L,
                Triple(Account.COMMISSION_REVENUE, EntrySide.DEBIT, 400L) to null,
                Triple(Account.PG_RECEIVABLE, EntrySide.CREDIT, 9_600L) to null,
                Triple(Account.PROMOTION_EXPENSE, EntrySide.CREDIT, 900L) to null,
            )
            j.debitTotal shouldBe 10_500L
            j.creditTotal shouldBe 10_500L
            j.sourceKey shouldBe "refund:claim:31"
        }
        Then("매입 + 환불 뒤 판매자 9 미지급금 잔액은 0 — 매입 때 쌓인 만큼 줄었다") {
            val capture = JournalRules.capture(501L, payable, listOf(mug, coaster), shipping, "evt-1", t0)
            (capture.netOf(Account.SELLER_PAYABLE, 9L) + j.netOf(Account.SELLER_PAYABLE, 9L)) shouldBe 0L
        }
        Then("PG 환불액이 n+s−dp−p 와 다르면 기록하지 않는다") {
            shouldThrow<InvalidJournalException> { JournalRules.refund(31L, 501L, refund - 1, listOf(coaster), emptyList(), "evt-2", t0) }
        }
    }

    Given("PG 입금 (payment.reconciliation.settled) — 총액 33,500 중 수수료 1,005") {
        Then("차 현금 32,495 · PG 수수료 비용 1,005 / 대 PG 미수금 33,500") {
            val j = JournalRules.pgDeposit(501L, "ORD-501-1", LocalDate.of(2026, 9, 24), 32_495L, 1_005L, "evt-3", t0)
            j.lines() shouldContainExactlyInAnyOrder listOf(
                Triple(Account.CASH, EntrySide.DEBIT, 32_495L) to null,
                Triple(Account.PG_FEE_EXPENSE, EntrySide.DEBIT, 1_005L) to null,
                Triple(Account.PG_RECEIVABLE, EntrySide.CREDIT, 33_500L) to null,
            )
            j.debitTotal shouldBe j.creditTotal
            j.sourceKey shouldBe "pg-deposit:2026-09-24:ORD-501-1"
        }
    }

    Given("지급 (정산 배치)") {
        Then("차 판매자 미지급금 지급액 / 대 현금 지급액, 0 이하 지급은 없다") {
            val j = JournalRules.payout(77L, 7L, 23_700L, t0)
            j.lines() shouldContainExactlyInAnyOrder listOf(
                Triple(Account.SELLER_PAYABLE, EntrySide.DEBIT, 23_700L) to 7L,
                Triple(Account.CASH, EntrySide.CREDIT, 23_700L) to null,
            )
            j.sourceKey shouldBe "payout:statement:77"
            shouldThrow<InvalidJournalException> { JournalRules.payout(78L, 7L, 0L, t0) }
        }
    }

    Given("네 시점을 모두 기록한 원장") {
        Then("계정별 (차 − 대) 를 다 더하면 0") {
            val journals = listOf(
                JournalRules.capture(501L, payable, listOf(mug, coaster), shipping, "evt-1", t0),
                JournalRules.refund(31L, 501L, 9_600L, listOf(coaster), listOf(ShippingAmount(9L, 2_500L)), "evt-2", t0),
                JournalRules.pgDeposit(501L, "ORD-501-1", LocalDate.of(2026, 9, 24), 22_895L, 1_005L, "evt-3", t0),
                JournalRules.payout(77L, 7L, 23_700L, t0),
            )
            Account.entries.sumOf { a -> journals.sumOf { it.netOf(a) } } shouldBe 0L
            // PG 미수금: 33,500 − 9,600 − 23,900 = 0, 판매자 7 미지급금: 23,700 − 23,700 = 0
            journals.sumOf { it.netOf(Account.PG_RECEIVABLE) } shouldBe 0L
            journals.sumOf { it.netOf(Account.SELLER_PAYABLE, 7L) } shouldBe 0L
        }
    }
})
