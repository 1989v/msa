package com.kgd.settlement.domain.statement.model

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters

/** 정산 기간 [start, endExclusive) — 날짜 경계는 KST 자정이다 */
data class SettlementPeriod(val start: LocalDate, val endExclusive: LocalDate) {
    init {
        require(start < endExclusive) { "빈 정산 기간: $start ~ $endExclusive" }
    }

    val startInstant: Instant get() = start.atStartOfDay(ZONE).toInstant()
    val endInstant: Instant get() = endExclusive.atStartOfDay(ZONE).toInstant()

    /** 화면·정산서에 적는 마지막 날(포함) */
    val lastDay: LocalDate get() = endExclusive.minusDays(1)

    companion object {
        val ZONE: ZoneId = ZoneId.of("Asia/Seoul")

        fun kstDate(at: Instant): LocalDate = at.atZone(ZONE).toLocalDate()
    }
}

/** 판매자 정산 주기. 주간 = 월~일(KST), 월간 = 달력 월(KST) */
enum class SettlementCycle {
    WEEKLY,
    MONTHLY;

    /** [today](KST) 기준으로 이미 닫힌 가장 최근 기간 — 오늘이 속한 기간은 아직 열려 있다 */
    fun lastClosedPeriod(today: LocalDate): SettlementPeriod = when (this) {
        WEEKLY -> {
            val end = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
            SettlementPeriod(end.minusWeeks(1), end)
        }
        MONTHLY -> {
            val end = today.withDayOfMonth(1)
            SettlementPeriod(end.minusMonths(1), end)
        }
    }

    companion object {
        /** 판매자 이벤트를 아직 못 받은 판매자 — 플랫폼 기본 판매자와 같은 월간으로 본다 */
        val DEFAULT: SettlementCycle = MONTHLY
    }
}
