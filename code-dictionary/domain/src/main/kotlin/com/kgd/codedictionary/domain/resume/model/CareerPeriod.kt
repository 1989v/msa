package com.kgd.codedictionary.domain.resume.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit

/**
 * 재직·수행 기간. 월 단위로만 다룬다 — 이력서에서 일 단위는 의미가 없다.
 *
 * [end] 가 null 이면 진행 중이다.
 */
data class CareerPeriod(
    val start: YearMonth,
    val end: YearMonth?,
) {
    init {
        val endValue = end
        if (endValue != null && endValue.isBefore(start)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "종료가 시작보다 앞설 수 없습니다")
        }
    }

    val ongoing: Boolean get() = end == null

    /**
     * 기간 길이(개월).
     *
     * 종료된 기간은 **종료월을 포함**한다(2015.09~2017.12 = 28개월). 사람이 이력서에 적는 방식이다.
     * 진행 중인 기간은 **완료된 개월까지만** 센다 — 이번 달을 다 채우지도 않고 한 달로 세면
     * 매달 초에 경력이 한 달씩 앞당겨 부풀려진다.
     */
    fun months(asOf: LocalDate): Int {
        val endBound = end?.plusMonths(1) ?: YearMonth.from(asOf)
        val span = ChronoUnit.MONTHS.between(start, endBound).toInt()
        return span.coerceAtLeast(0)
    }
}

/** 개월 수를 "N년 M개월"로 읽을 수 있게 쪼갠 값. */
data class Tenure(val totalMonths: Int) {
    val years: Int get() = totalMonths / 12
    val months: Int get() = totalMonths % 12
}

/**
 * 경력 총량 (ADR-0064).
 *
 * 이력서에 손으로 적어 둔 "11년차"·"총 경력 10년 9개월"은 시간이 지나면 조용히 틀려진다.
 * 재직 기간에서 매번 다시 계산한다.
 */
object CareerCalculator {

    /** 회사별 재직 개월의 합. 이직 공백은 포함하지 않는다. */
    fun totalMonths(periods: List<CareerPeriod>, asOf: LocalDate): Int =
        periods.sumOf { it.months(asOf) }

    fun tenure(periods: List<CareerPeriod>, asOf: LocalDate): Tenure =
        Tenure(totalMonths(periods, asOf))

    /**
     * "N년차" — 국내 관행대로 만 연차에 1을 더한다.
     * (만 10년 9개월이면 11년차)
     */
    fun yearsInField(periods: List<CareerPeriod>, asOf: LocalDate): Int =
        tenure(periods, asOf).years + 1
}
