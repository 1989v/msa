package com.kgd.place.domain.region.model

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.YearMonth

/**
 * 시도 페이지 「타지 방문자가 많은 시군구」 — 마지막 **다 받은 달**의 외지인 + 외국인 합으로 시군구를 줄 세운다.
 *
 * - 현지인은 뺀다. 생활 이동이 섞여 인구 많은 구가 늘 위에 온다.
 * - 다 받은 달은 시도 안 **모든** 시군구가 그 달의 모든 날을 세 구분 다 받은 달이다. 시군구마다 따로 고르면
 *   서로 다른 달끼리 비교하게 된다.
 * - 대상 시군구는 지금 행정구역 목록이 정한다. 통합 전 옛 코드(29·46 등)로 들어온 행은 목록에 없어서 빠진다.
 * - 시군구가 [MIN_SIGUNGU] 개 미만인 시도(세종·제주)는 순위가 의미 없어 빈 결과다.
 */
object RegionVisitorRanking {
    const val TOP = 10
    const val MIN_SIGUNGU = 3

    /** 시군구 × 달 × 구분의 합계와 행 수(= 받은 날 수). */
    data class SigunguMonthlyTotal(val code: String, val month: YearMonth, val touDivCd: String, val total: BigDecimal, val days: Int)

    /** 값은 소수 버림. [total] 은 버리기 전 합에서 버린다. */
    data class Entry(val code: String, val outsiders: Long, val foreigners: Long, val total: Long)

    data class Result(val month: YearMonth?, val entries: List<Entry>) {
        companion object {
            val EMPTY = Result(null, emptyList())
        }
    }

    /** 집계를 읽을 첫날 — 방문 추이와 같은 창(최근 날의 달에서 12달 앞). */
    fun windowStart(latest: LocalDate): LocalDate = RegionVisitorTrend.windowStart(latest)

    fun rank(sigunguCodes: Collection<String>, totals: List<SigunguMonthlyTotal>): Result {
        val codes = sigunguCodes.toSet()
        if (codes.size < MIN_SIGUNGU) return Result.EMPTY
        val byMonth = totals.filter { it.code in codes }.groupBy { it.month }
        val month = byMonth.keys.sortedDescending().firstOrNull { month ->
            val days = byMonth.getValue(month).associate { (it.code to it.touDivCd) to it.days }
            codes.all { code -> VisitorGroup.entries.all { days[code to it.code] == month.lengthOfMonth() } }
        } ?: return Result.EMPTY

        val rows = byMonth.getValue(month)
        fun sum(code: String, group: VisitorGroup): BigDecimal =
            rows.filter { it.code == code && it.touDivCd == group.code }.sumOf { it.total }
        val ranked = codes.map { code ->
            val outsiders = sum(code, VisitorGroup.OUTSIDER)
            val foreigners = sum(code, VisitorGroup.FOREIGNER)
            code to (outsiders to foreigners)
        }
            .sortedWith(compareByDescending<Pair<String, Pair<BigDecimal, BigDecimal>>> { (_, v) -> v.first + v.second }.thenBy { it.first })
            .take(TOP)
            .map { (code, v) -> Entry(code, v.first.floor(), v.second.floor(), (v.first + v.second).floor()) }
        return Result(month, ranked)
    }

    private fun BigDecimal.floor(): Long = setScale(0, RoundingMode.DOWN).toLong()
}
