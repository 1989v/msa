package com.kgd.codedictionary.domain.resume

import com.kgd.codedictionary.domain.resume.model.CareerCalculator
import com.kgd.codedictionary.domain.resume.model.CareerPeriod
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDate
import java.time.YearMonth

class CareerCalculatorTest : BehaviorSpec({

    fun period(start: String, end: String? = null) =
        CareerPeriod(YearMonth.parse(start), end?.let { YearMonth.parse(it) })

    given("종료된 재직 기간은") {
        `when`("시작월과 종료월이 주어지면") {
            then("종료월을 포함해 센다") {
                // 2015.09 ~ 2017.12 = 2년 4개월
                period("2015-09", "2017-12").months(LocalDate.of(2026, 8, 11)) shouldBe 28
                period("2018-03", "2022-07").months(LocalDate.of(2026, 8, 11)) shouldBe 53
            }
        }

        `when`("같은 달에 시작하고 끝나면") {
            then("1개월이다") {
                period("2020-01", "2020-01").months(LocalDate.of(2026, 8, 11)) shouldBe 1
            }
        }
    }

    given("진행 중인 재직 기간은") {
        `when`("기준일이 주어지면") {
            then("완료된 개월까지만 센다 — 이번 달을 미리 채워 넣지 않는다") {
                // 2022.08 시작, 2026.08 기준 → 만 4년 = 48개월 (49 가 아니다)
                period("2022-08").months(LocalDate.of(2026, 8, 11)) shouldBe 48
            }
        }

        `when`("다음 달로 넘어가면") {
            then("한 달이 늘어난다") {
                period("2022-08").months(LocalDate.of(2026, 9, 1)) shouldBe 49
            }
        }
    }

    given("세 회사의 실제 이력에서") {
        val periods = listOf(
            period("2015-09", "2017-12"),
            period("2018-03", "2022-07"),
            period("2022-08"),
        )
        val asOf = LocalDate.of(2026, 8, 11)

        `when`("총 경력을 계산하면") {
            then("이직 공백을 뺀 합이 나온다") {
                CareerCalculator.totalMonths(periods, asOf) shouldBe 129
                CareerCalculator.tenure(periods, asOf).years shouldBe 10
                CareerCalculator.tenure(periods, asOf).months shouldBe 9
            }
        }

        `when`("연차를 계산하면") {
            then("만 연차에 1을 더한 국내 관행을 따른다") {
                CareerCalculator.yearsInField(periods, asOf) shouldBe 11
            }
        }
    }
})
