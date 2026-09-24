package com.kgd.settlement.domain.statement.model

import com.kgd.settlement.domain.statement.exception.InvalidStatementStateException
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.time.LocalDate

class SettlementStatementTest : BehaviorSpec({

    // 2026-09-21(월) ~ 09-27(일) KST
    val week = SettlementPeriod(LocalDate.of(2026, 9, 21), LocalDate.of(2026, 9, 28))
    val inWeek = Instant.parse("2026-09-24T03:00:00Z")
    val now = Instant.parse("2026-09-28T20:30:00Z")

    val mug = SettlementItem.line(orderId = 501L, orderItemId = 11L, sellerId = 7L, netSales = 23_000L, commission = 2_300L, confirmedAt = inWeek)
    val plate = SettlementItem.line(orderId = 502L, orderItemId = 21L, sellerId = 7L, netSales = 9_999L, commission = 1_000L, confirmedAt = inWeek)
    val ship501 = SettlementItem.shipping(orderId = 501L, sellerId = 7L, fee = 3_000L, confirmedAt = inWeek)

    fun draft(items: List<SettlementItem>, refunded: Set<String> = emptySet()) =
        requireNotNull(SettlementStatement.draft(7L, week, items, refunded, now)) { "담을 항목이 있는데 정산서가 없다" }

    Given("구매 확정 라인 둘과 배송비 하나") {
        Then("지급액 = Σ순매출 + Σ배송비 − Σ수수료 (원 단위)") {
            val s = draft(listOf(mug, plate, ship501))
            s.netSales shouldBe 32_999L
            s.shippingFee shouldBe 3_000L
            s.commission shouldBe 3_300L
            s.payout shouldBe 32_999L + 3_000L - 3_300L
            s.payout shouldBe listOf(mug, plate, ship501).sumOf { it.netSales + it.shippingFee - it.commission }
            s.lines.map { it.key }.toSet() shouldBe setOf("line:11", "line:21", "shipping:501:7")
        }
    }

    Given("환불된 라인이 후보에 섞여 있다 (토픽이 달라 도착 순서가 어긋난 경우)") {
        Then("환불 키의 라인은 정산서에 들어가지 않고 지급액에도 없다") {
            val s = draft(listOf(mug, plate, ship501), refunded = setOf(SettlementItem.lineKey(21L)))
            s.lines.map { it.key } shouldBe listOf("line:11", "shipping:501:7")
            s.lines.none { it.orderItemId == 21L } shouldBe true
            s.payout shouldBe 23_000L + 3_000L - 2_300L
        }
    }

    Given("배송비") {
        Then("확정 이벤트에 실린 배송비는 들어가고, 판매자 라인이 전부 취소돼 환불된 배송비는 빠진다") {
            draft(listOf(mug, ship501)).shippingFee shouldBe 3_000L
            val cancelled = draft(listOf(mug, ship501), refunded = setOf(SettlementItem.shippingKey(501L, 7L)))
            cancelled.shippingFee shouldBe 0L
            cancelled.lines.none { it.kind == SettlementItemKind.SHIPPING } shouldBe true
        }
    }

    Given("기간·판매자 경계") {
        Then("기간 끝(다음 월요일 00:00 KST) 이후 확정분과 남의 판매자 항목은 빠지고, 이전 기간 항목(이월·지각)은 들어온다") {
            val late = SettlementItem.line(503L, 31L, 7L, 5_000L, 500L, Instant.parse("2026-09-27T15:00:00Z")) // 09-28 00:00 KST
            val lastSunday = SettlementItem.line(504L, 41L, 7L, 4_000L, 400L, Instant.parse("2026-09-27T14:59:59Z")) // 09-27 23:59:59 KST
            val carried = SettlementItem.line(505L, 51L, 7L, 1_000L, 100L, Instant.parse("2026-09-10T00:00:00Z"))
            val other = SettlementItem.line(506L, 61L, 9L, 7_000L, 700L, inWeek)
            draft(listOf(late, lastSunday, carried, other)).lines.map { it.key }.toSet() shouldBe setOf("line:41", "line:51")
        }
        Then("담을 항목이 없으면 정산서를 만들지 않는다 — 환불로 전부 빠진 경우도") {
            SettlementStatement.draft(7L, week, emptyList(), emptySet(), now) shouldBe null
            SettlementStatement.draft(7L, week, listOf(mug), setOf(mug.key), now) shouldBe null
        }
    }

    Given("지급액이 0 이하 — 판매자 쿠폰이 판매가 전부를 덮은 라인만 있다") {
        Then("CONFIRMED → CARRIED_OVER, 지급은 막힌다") {
            val zero = SettlementItem.line(507L, 71L, 7L, netSales = 0L, commission = 0L, confirmedAt = inWeek)
            val s = draft(listOf(zero))
            s.confirm(now)
            s.payout shouldBe 0L
            shouldThrow<InvalidStatementStateException> { s.pay("MOCK", now) }
            s.carryOver(now)
            s.status shouldBe StatementStatus.CARRIED_OVER
            s.carriedOverAt shouldBe now
        }
        Then("지급액이 양수면 이월할 수 없다") {
            val s = draft(listOf(mug)).also { it.confirm(now) }
            shouldThrow<InvalidStatementStateException> { s.carryOver(now) }
        }
    }

    Given("정산서 전이표 (SR-2)") {
        // 목표 상태마다 그 상태로 가는 도메인 메서드
        val actions: Map<StatementStatus, (SettlementStatement) -> Unit> = mapOf(
            StatementStatus.CONFIRMED to { s -> s.confirm(now) },
            StatementStatus.PAID to { s -> s.pay("MOCK-PAYOUT-7-1", now) },
            StatementStatus.CARRIED_OVER to { s -> s.carryOver(now) },
        )
        val allowed = setOf(
            StatementStatus.DRAFT to StatementStatus.CONFIRMED,
            StatementStatus.CONFIRMED to StatementStatus.PAID,
            StatementStatus.CONFIRMED to StatementStatus.CARRIED_OVER,
        )

        fun statementIn(status: StatementStatus, payout: Long): SettlementStatement {
            val item = SettlementItem.line(900L, 91L, 7L, netSales = payout, commission = 0L, confirmedAt = inWeek)
            return SettlementStatement.restore(1L, 7L, week, status, listOf(item), now, null, null, null, null)
        }

        Then("표의 행은 허용, 나머지 전부 예외") {
            for (from in StatementStatus.entries) {
                for ((to, act) in actions) {
                    // 이월은 지급액 0, 지급은 지급액 양수에서만 성립한다 — 금액 가드가 아니라 상태 가드를 본다
                    val s = statementIn(from, payout = if (to == StatementStatus.CARRIED_OVER) 0L else 10_000L)
                    if (from to to in allowed) {
                        shouldNotThrowAny { act(s) }
                        s.status shouldBe to
                    } else {
                        shouldThrow<InvalidStatementStateException> { act(s) }
                        s.status shouldBe from
                    }
                }
            }
        }
    }

    Given("정산 기록 보존기간") {
        Then("5년 — 방침 6항과 같은 숫자 (문구 대조는 portal-fe privacyRetention.test.ts)") {
            SettlementStatement.RECORD_RETENTION.years shouldBe 5
        }
    }
})
