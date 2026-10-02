package com.kgd.place.domain.region.model

import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.time.LocalDate
import java.time.YearMonth

class RegionVisitorTrendTest : BehaviorSpec({

    fun month(ym: String, days: Int, local: String = "100.4", outsider: String = "50.5", foreigner: String = "1.2", foreignerDays: Int = days) =
        listOf(
            RegionVisitorTrend.MonthlyTotal(YearMonth.parse(ym), "1", BigDecimal(local), days),
            RegionVisitorTrend.MonthlyTotal(YearMonth.parse(ym), "2", BigDecimal(outsider), days),
            RegionVisitorTrend.MonthlyTotal(YearMonth.parse(ym), "3", BigDecimal(foreigner), foreignerDays),
        )

    given("월 합계를 고를 때") {
        `when`("가장 최근 달이 공개 지연으로 일부만 있으면") {
            then("그 달은 빼고 다 받은 달만 달 순서로 낸다 — 짧은 막대가 「줄었다」로 읽히지 않게") {
                val months = RegionVisitorTrend.completeMonths(month("2026-09", 2) + month("2026-08", 31) + month("2026-07", 31))
                months.map { it.month.toString() } shouldBe listOf("2026-07", "2026-08")
                months.last() shouldBe RegionVisitorTrend.Month(YearMonth.parse("2026-08"), 100, 51, 1)
            }
        }
        `when`("한 구분만 날이 빠졌어도") {
            then("그 달은 덜 찬 달이다") {
                RegionVisitorTrend.completeMonths(month("2026-08", 31, foreignerDays = 30)) shouldBe emptyList()
            }
        }
        `when`("다 받은 달이 열두 달보다 많으면") {
            then("최근 열두 달만") {
                val totals = (0L until 14L).flatMap { i ->
                    val ym = YearMonth.of(2025, 7).plusMonths(i)
                    month(ym.toString(), ym.lengthOfMonth())
                }
                val months = RegionVisitorTrend.completeMonths(totals)
                months.size shouldBe 12
                months.first().month shouldBe YearMonth.of(2025, 9)
            }
        }
        `when`("집계 창의 첫날은") {
            then("가장 최근 날의 달에서 열두 달 앞 1일이다") {
                RegionVisitorTrend.windowStart(LocalDate.of(2026, 9, 2)) shouldBe LocalDate.of(2025, 9, 1)
            }
        }
    }

    given("하루 한 행") {
        `when`("원천이 부동소수 표기로 주면") {
            then("원문은 그대로, 합산값만 소수 셋째 자리로 반올림한다") {
                val row = RegionVisitorDaily(AdministrativeRegionLevel.SIGUNGU, "11110", LocalDate.of(2026, 9, 1), "2", "24814.549999999996")
                row.touNum shouldBe "24814.549999999996"
                row.touNumValue shouldBe BigDecimal("24814.550")
            }
        }
        `when`("코드 길이가 수준과 맞지 않거나 수가 아니면") {
            then("거부한다") {
                shouldThrow<IllegalArgumentException> {
                    RegionVisitorDaily(AdministrativeRegionLevel.SIDO, "11110", LocalDate.of(2026, 9, 1), "1", "1.0")
                }
                shouldThrow<IllegalArgumentException> {
                    RegionVisitorDaily(AdministrativeRegionLevel.SIDO, "11", LocalDate.of(2026, 9, 1), "1", "N/A")
                }
                shouldThrow<BusinessException> { RegionVisitorDaily.requireLevel("111") }
                RegionVisitorDaily.requireLevel("12") shouldBe AdministrativeRegionLevel.SIDO
            }
        }
    }
})
