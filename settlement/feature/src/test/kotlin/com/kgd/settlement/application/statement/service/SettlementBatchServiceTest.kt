package com.kgd.settlement.application.statement.service

import com.kgd.settlement.application.SettlementHarness
import com.kgd.settlement.application.ledger.usecase.RecordLedgerUseCase
import com.kgd.settlement.application.statement.usecase.RegisterSettlementItemUseCase
import com.kgd.settlement.domain.ledger.model.Account
import com.kgd.settlement.domain.ledger.model.JournalType
import com.kgd.settlement.domain.ledger.model.LineAmounts
import com.kgd.settlement.domain.ledger.model.ShippingAmount
import com.kgd.settlement.domain.seller.model.SettlementSeller
import com.kgd.settlement.domain.statement.exception.InvalidStatementStateException
import com.kgd.settlement.domain.statement.model.SettlementCycle
import com.kgd.settlement.domain.statement.model.StatementStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.time.LocalDate

/**
 * 정산 배치 — 원장 기록 → 구매 확정 항목 → 배치까지 실제 서비스 조립으로(포트만 메모리).
 * 지급액은 정산서 줄과 원장 분개 두 곳에서 따로 읽어 대조한다.
 */
class SettlementBatchServiceTest : BehaviorSpec({

    val thursday = Instant.parse("2026-09-24T03:00:00Z") // 09-24(목) 12:00 KST
    val sundayNight = Instant.parse("2026-09-27T14:00:00Z") // 09-27(일) 23:00 KST — 주간 기간이 아직 열려 있다
    val mondayBatch = Instant.parse("2026-09-27T20:30:00Z") // 09-28(월) 05:30 KST

    val mug = LineAmounts(11L, 7L, netSales = 23_000L, commission = 2_300L, platformCoupon = 1_500L, point = 600L)
    val coaster = LineAmounts(12L, 9L, netSales = 8_000L, commission = 400L, platformCoupon = 500L, point = 400L)

    /** 주문 501: 판매자 7 머그 + 판매자 9 받침, 받침·배송비 9 는 확정 전 환불, 머그는 확정(판매자 7 마지막 라인이라 배송비 7 동봉) */
    fun scenario(h: SettlementHarness) {
        h.sellerSync.sync(SettlementSeller(7L, "m7", "ACTIVE", SettlementCycle.WEEKLY, thursday))
        h.sellerSync.sync(SettlementSeller(9L, "m9", "ACTIVE", SettlementCycle.WEEKLY, thursday))
        h.ledger.recordCapture(
            RecordLedgerUseCase.Capture(
                501L, 33_500L, listOf(mug, coaster), listOf(ShippingAmount(7L, 3_000L), ShippingAmount(9L, 2_500L)), thursday, "e1",
            ),
        )
        h.ledger.recordRefund(
            RecordLedgerUseCase.Refund(31L, 501L, 9_600L, listOf(coaster), listOf(ShippingAmount(9L, 2_500L)), thursday, "e2"),
        )
        h.register.register(RegisterSettlementItemUseCase.PurchaseConfirmed(501L, mug, ShippingAmount(7L, 3_000L), thursday))
    }

    Given("주간 판매자의 기간이 닫힌 월요일 배치") {
        Then("정산서 PAID · 지급액 = Σ(순매출 + 배송비 − 수수료) = 원장의 판매자 미지급금 감소분 = 지급 거래 금액") {
            val h = SettlementHarness(mondayBatch)
            scenario(h)
            val payableBefore = h.payableOf(7L)

            val result = h.batch.run()

            result.opened shouldBe 1
            result.paid shouldBe 1
            val s = h.statements.rows.values.single { it.sellerId == 7L }
            s.status shouldBe StatementStatus.PAID
            s.period.start shouldBe LocalDate.of(2026, 9, 21)
            s.payoutReference shouldBe "MOCK-PAYOUT-7-${s.id}"
            // 정산서 줄에서 다시 더한 값
            s.payout shouldBe s.lines.sumOf { it.netSales + it.shippingFee - it.commission }
            s.payout shouldBe 23_000L + 3_000L - 2_300L
            // 원장에서 읽은 값 — 미지급금 감소분과 지급 거래
            val payoutJournal = h.journals.journals.single { it.type == JournalType.PAYOUT }
            payoutJournal.netOf(Account.SELLER_PAYABLE, 7L) shouldBe s.payout
            (payableBefore - h.payableOf(7L)) shouldBe s.payout
            h.payableOf(7L) shouldBe 0L
            h.payout.calls shouldBe listOf(Triple(7L, s.id, s.payout))
            // 원장 전체는 여전히 균형
            h.ledger.trialBalance().net shouldBe 0L
        }
    }

    Given("환불된 라인의 구매 확정 이벤트가 (토픽 순서가 어긋나) 들어왔다") {
        Then("그 라인은 정산서에 없다 — 판매자 9 는 정산서가 생기지 않고, 판매자 7 정산서에도 섞이지 않는다") {
            val h = SettlementHarness(mondayBatch)
            scenario(h)
            h.register.register(RegisterSettlementItemUseCase.PurchaseConfirmed(501L, coaster, ShippingAmount(9L, 2_500L), thursday))

            h.batch.run()

            h.statements.rows.values.none { it.sellerId == 9L } shouldBe true
            h.statements.rows.values.flatMap { it.lines }.none { it.key == "line:12" || it.key == "shipping:501:9" } shouldBe true
            h.payout.calls.none { it.first == 9L } shouldBe true
            h.payableOf(9L) shouldBe 0L
        }
    }

    Given("기간이 아직 열려 있다 (일요일 밤)") {
        Then("정산서를 만들지 않는다 — 전 주는 비었고 이번 주는 안 닫혔다") {
            val h = SettlementHarness(sundayNight)
            scenario(h)
            h.batch.run().opened shouldBe 0
            h.statements.rows.size shouldBe 0
        }
    }

    Given("같은 날 배치를 두 번 돌린다") {
        Then("정산서 하나, 송금 한 번, 지급 거래 하나") {
            val h = SettlementHarness(mondayBatch)
            scenario(h)
            h.batch.run()
            h.batch.run().opened shouldBe 0
            h.statements.rows.size shouldBe 1
            h.payout.calls.size shouldBe 1
            h.journals.journals.count { it.type == JournalType.PAYOUT } shouldBe 1
        }
    }

    Given("지급액이 0 인 기간 — 판매자 쿠폰이 판매가를 다 덮은 라인뿐") {
        Then("CARRIED_OVER 이고 송금·지급 거래가 없으며, 항목은 다음 주 정산서로 넘어간다") {
            val h = SettlementHarness(mondayBatch)
            h.sellerSync.sync(SettlementSeller(7L, "m7", "ACTIVE", SettlementCycle.WEEKLY, thursday))
            val free = LineAmounts(41L, 7L, netSales = 0L, commission = 0L, platformCoupon = 0L, point = 0L)
            h.register.register(RegisterSettlementItemUseCase.PurchaseConfirmed(601L, free, null, thursday))

            h.batch.run().carriedOver shouldBe 1
            val first = h.statements.rows.values.single()
            first.status shouldBe StatementStatus.CARRIED_OVER
            h.payout.calls.size shouldBe 0
            h.journals.journals.none { it.type == JournalType.PAYOUT } shouldBe true

            // 다음 주 확정분과 함께 다음 기간 정산서에 들어간다
            val nextWeek = Instant.parse("2026-10-01T03:00:00Z")
            val plate = LineAmounts(42L, 7L, netSales = 10_000L, commission = 1_000L, platformCoupon = 0L, point = 0L)
            h.ledger.recordCapture(RecordLedgerUseCase.Capture(602L, 10_000L, listOf(plate), emptyList(), nextWeek, "e9"))
            h.register.register(RegisterSettlementItemUseCase.PurchaseConfirmed(602L, plate, null, nextWeek))
            h.clock.now = Instant.parse("2026-10-04T20:30:00Z") // 10-05(월) 05:30 KST
            h.batch.run()

            val second = h.statements.rows.values.single { it.id != first.id }
            second.status shouldBe StatementStatus.PAID
            second.lines.map { it.key }.toSet() shouldBe setOf("line:41", "line:42")
            second.payout shouldBe 9_000L
        }
    }

    Given("송금이 한 번 실패한다") {
        Then("정산서는 CONFIRMED 로 남고, 다음 배치(또는 어드민 재시도)가 PAID 로 끝낸다 — 지급 거래는 하나") {
            val h = SettlementHarness(mondayBatch)
            scenario(h)
            h.payout.failNext = true

            h.batch.run().failed shouldBe 1
            val s = h.statements.rows.values.single()
            s.status shouldBe StatementStatus.CONFIRMED
            h.journals.journals.none { it.type == JournalType.PAYOUT } shouldBe true

            h.batch.retry(requireNotNull(s.id)).status shouldBe StatementStatus.PAID
            h.journals.journals.count { it.type == JournalType.PAYOUT } shouldBe 1
            shouldThrow<InvalidStatementStateException> { h.batch.retry(requireNotNull(s.id)) }
        }
    }

    Given("판매자 이벤트를 아직 못 받은 판매자") {
        Then("월간으로 본다 — 월요일이 아니라 다음 달 1일 배치에서 9월 정산서가 생긴다") {
            val h = SettlementHarness(mondayBatch)
            h.register.register(RegisterSettlementItemUseCase.PurchaseConfirmed(701L, mug.copy(orderItemId = 71L, sellerId = 55L), null, thursday))
            h.batch.run().opened shouldBe 0
            h.clock.now = Instant.parse("2026-09-30T20:30:00Z") // 10-01 05:30 KST
            h.batch.run().opened shouldBe 1
            h.statements.rows.values.single().period.start shouldBe LocalDate.of(2026, 9, 1)
        }
    }
})
