package com.kgd.settlement.domain.statement.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.time.LocalDate

/** 정산 기간 경계는 KST 자정이다 — UTC 로 자르면 월요일 00:00~08:59 KST 확정분이 전 주로 간다 */
class SettlementCycleTest : BehaviorSpec({

    fun day(s: String) = LocalDate.parse(s)

    Given("주간 (월~일, KST)") {
        Then("월요일 배치는 막 끝난 월~일, 일요일 배치는 그 전 주") {
            SettlementCycle.WEEKLY.lastClosedPeriod(day("2026-09-28")) shouldBe SettlementPeriod(day("2026-09-21"), day("2026-09-28"))
            SettlementCycle.WEEKLY.lastClosedPeriod(day("2026-09-27")) shouldBe SettlementPeriod(day("2026-09-14"), day("2026-09-21"))
            SettlementCycle.WEEKLY.lastClosedPeriod(day("2026-10-01")) shouldBe SettlementPeriod(day("2026-09-21"), day("2026-09-28"))
        }
        Then("기간 끝 시각은 월요일 00:00 KST = 일요일 15:00 UTC") {
            val p = SettlementCycle.WEEKLY.lastClosedPeriod(day("2026-09-28"))
            p.startInstant shouldBe Instant.parse("2026-09-20T15:00:00Z")
            p.endInstant shouldBe Instant.parse("2026-09-27T15:00:00Z")
            p.lastDay shouldBe day("2026-09-27")
        }
        Then("UTC 로는 일요일인 월요일 새벽(KST)의 날짜는 월요일이다") {
            SettlementPeriod.kstDate(Instant.parse("2026-09-27T15:30:00Z")) shouldBe day("2026-09-28")
        }
    }

    Given("월간 (달력 월, KST)") {
        Then("1일 배치는 막 끝난 달, 말일 배치는 그 전 달, 연말을 넘는다") {
            SettlementCycle.MONTHLY.lastClosedPeriod(day("2026-10-01")) shouldBe SettlementPeriod(day("2026-09-01"), day("2026-10-01"))
            SettlementCycle.MONTHLY.lastClosedPeriod(day("2026-09-30")) shouldBe SettlementPeriod(day("2026-08-01"), day("2026-09-01"))
            SettlementCycle.MONTHLY.lastClosedPeriod(day("2027-01-15")) shouldBe SettlementPeriod(day("2026-12-01"), day("2027-01-01"))
        }
        Then("9월 기간 끝은 10-01 00:00 KST = 09-30 15:00 UTC") {
            SettlementCycle.MONTHLY.lastClosedPeriod(day("2026-10-01")).endInstant shouldBe Instant.parse("2026-09-30T15:00:00Z")
        }
    }
})
