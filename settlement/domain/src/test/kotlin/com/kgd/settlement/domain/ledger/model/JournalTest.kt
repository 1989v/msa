package com.kgd.settlement.domain.ledger.model

import com.kgd.settlement.domain.ledger.exception.InvalidJournalException
import com.kgd.settlement.domain.ledger.exception.UnbalancedJournalException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class JournalTest : BehaviorSpec({

    val t0 = Instant.parse("2026-09-24T00:00:00Z")

    Given("차변 합 ≠ 대변 합") {
        Then("거래가 만들어지지 않는다 — UnbalancedJournalException") {
            shouldThrow<UnbalancedJournalException> {
                Journal.record(
                    JournalType.CAPTURE, "capture:order:1", null, 1L, t0,
                    listOf(
                        JournalEntry.debit(Account.PG_RECEIVABLE, 10_000L),
                        JournalEntry.credit(Account.SELLER_PAYABLE, 9_000L, sellerId = 7L),
                        JournalEntry.credit(Account.COMMISSION_REVENUE, 999L),
                    ),
                )
            }
        }
        Then("저장소 복원도 같은 검사를 거친다 — 손으로 고친 행이 조용히 섞이지 않는다") {
            shouldThrow<UnbalancedJournalException> {
                Journal.restore(
                    5L, JournalType.PAYOUT, "payout:statement:5", null, null, null, t0,
                    listOf(JournalEntry.debit(Account.SELLER_PAYABLE, 100L, 7L), JournalEntry.credit(Account.CASH, 99L)),
                )
            }
        }
    }

    Given("분개 줄 계약") {
        Then("0원·음수 줄, 판매자 없는 미지급금, 판매자 붙은 다른 계정, 한쪽만 있는 거래는 거부") {
            shouldThrow<InvalidJournalException> { JournalEntry.debit(Account.CASH, 0L) }
            shouldThrow<InvalidJournalException> { JournalEntry.debit(Account.CASH, -1L) }
            shouldThrow<InvalidJournalException> { JournalEntry.credit(Account.SELLER_PAYABLE, 100L) }
            shouldThrow<InvalidJournalException> { JournalEntry.credit(Account.CASH, 100L, sellerId = 7L) }
            shouldThrow<InvalidJournalException> {
                Journal.record(JournalType.CAPTURE, "k", null, null, t0, listOf(JournalEntry.debit(Account.CASH, 100L)))
            }
        }
    }

    Given("저장된 매입 거래를 정정한다") {
        val original = JournalRules.capture(
            orderId = 1L, payableAmount = 20_000L,
            lines = listOf(LineAmounts(11L, 7L, netSales = 20_000L, commission = 2_000L, platformCoupon = 0L, point = 0L)),
            shipping = emptyList(), sourceEventId = "e-1", at = t0,
        ).withId(100L)

        Then("역분개는 차·대를 뒤집은 새 거래이고 원 거래를 가리키며, 둘을 합치면 모든 계정 순액이 0") {
            val reversal = original.reverse("admin-1", "금액 오기입", t0.plusSeconds(60))

            reversal.type shouldBe JournalType.REVERSAL
            reversal.reversalOf shouldBe 100L
            reversal.sourceKey shouldBe "reversal:journal:100"
            reversal.actorId shouldBe "admin-1"
            reversal.reason shouldBe "금액 오기입"
            reversal.debitTotal shouldBe reversal.creditTotal
            reversal.debitTotal shouldBe original.debitTotal
            Account.entries.forEach { a -> (original.netOf(a) + reversal.netOf(a)) shouldBe 0L }
            // 원 거래는 그대로다
            original.netOf(Account.PG_RECEIVABLE) shouldBe 20_000L
        }
        Then("저장 전 거래와 역분개 거래는 역분개하지 않는다") {
            shouldThrow<InvalidJournalException> {
                JournalRules.payout(1L, 7L, 100L, t0).reverse("admin-1", "x", t0)
            }
            shouldThrow<InvalidJournalException> {
                original.reverse("admin-1", "r1", t0).withId(101L).reverse("admin-1", "r2", t0)
            }
        }
        Then("사유 없는 역분개는 만들지 않는다") {
            shouldThrow<InvalidJournalException> { original.reverse("admin-1", "  ", t0) }
        }
    }
})
