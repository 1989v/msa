package com.kgd.place.domain.region.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.YearMonth

/**
 * 지역 방문자 하루 한 행 — 한국관광공사 빅데이터 `DataLabService` (지역, 날짜, 방문자 구분).
 *
 * 원천 필드를 전부 그대로 둔다. [touNum] 은 원천이 부동소수 표기(`24814.549999999996`)로 주는 문자열 원문이고,
 * 합산은 소수 셋째 자리로 반올림한 파생값 [touNumValue] 로 한다.
 */
data class RegionVisitorDaily(
    val level: AdministrativeRegionLevel,
    val regionCode: String,
    val baseDate: LocalDate,
    val touDivCd: String,
    val touNum: String,
    val regionName: String? = null,
    val touDivNm: String? = null,
    val daywkDivCd: String? = null,
    val daywkDivNm: String? = null,
) {
    init {
        require(levelOf(regionCode) == level) { "지역 코드 $regionCode 는 $level 이 아니다" }
        require(touDivCd.isNotBlank()) { "방문자 구분 코드가 비었다" }
        requireNotNull(touNum.toBigDecimalOrNull()) { "touNum 이 수가 아니다: $touNum" }
    }

    val touNumValue: BigDecimal get() = BigDecimal(touNum).setScale(VALUE_SCALE, RoundingMode.HALF_UP)

    companion object {
        const val VALUE_SCALE = 3

        /** 법정동 코드 길이가 수준이다 — 시도 2자리, 시군구 5자리. 그 밖은 null. */
        fun levelOf(code: String): AdministrativeRegionLevel? = when {
            !code.all(Char::isDigit) -> null
            code.length == 2 -> AdministrativeRegionLevel.SIDO
            code.length == 5 -> AdministrativeRegionLevel.SIGUNGU
            else -> null
        }

        fun requireLevel(code: String): AdministrativeRegionLevel =
            levelOf(code) ?: throw BusinessException(ErrorCode.INVALID_INPUT, "지역 코드는 시도 2자리 또는 시군구 5자리 숫자다: $code")
    }
}

/** 원천 `touDivCd` — 1 현지인(a) · 2 외지인(b) · 3 외국인(c). */
enum class VisitorGroup(val code: String) {
    LOCAL("1"),
    OUTSIDER("2"),
    FOREIGNER("3"),
}

/**
 * 지역 허브 「방문 추이」 — 다 받은 달만 월 합계로 낸다.
 *
 * 공개 지연이 30일이라 가장 최근 달은 늘 일부만 있다. 그 달을 그리면 막대가 짧아 「방문이 줄었다」로 읽힌다 —
 * 그래서 세 구분 모두 그 달의 날수만큼 행이 있는 달만 남긴다.
 */
object RegionVisitorTrend {
    const val MONTHS = 12

    data class MonthlyTotal(val month: YearMonth, val touDivCd: String, val total: BigDecimal, val days: Int)

    data class Month(val month: YearMonth, val local: Long, val outsider: Long, val foreigner: Long)

    /** 집계를 읽을 첫날 — 가장 최근 날의 달에서 [MONTHS] 달 앞(그 달이 덜 찼으면 그 앞 12달을 채우려고). */
    fun windowStart(latest: LocalDate): LocalDate = YearMonth.from(latest).minusMonths(MONTHS.toLong()).atDay(1)

    fun completeMonths(totals: List<MonthlyTotal>): List<Month> =
        totals.groupBy { it.month }
            .filter { (month, rows) ->
                val byGroup = rows.associateBy { it.touDivCd }
                VisitorGroup.entries.all { byGroup[it.code]?.days == month.lengthOfMonth() }
            }
            .map { (month, rows) ->
                val byGroup = rows.associate { it.touDivCd to it.total }
                fun sum(group: VisitorGroup) = byGroup.getValue(group.code).setScale(0, RoundingMode.HALF_UP).toLong()
                Month(month, sum(VisitorGroup.LOCAL), sum(VisitorGroup.OUTSIDER), sum(VisitorGroup.FOREIGNER))
            }
            .sortedBy { it.month }
            .takeLast(MONTHS)
}
