package com.kgd.search.domain.attraction.model

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

/** 행사의 유효 기간. 시작일·종료일 모두 포함이다(날짜 비교라 당일은 진행 중). */
data class EventPeriod(val start: LocalDate, val end: LocalDate) {
    init {
        require(!start.isAfter(end)) { "유효 시작일이 종료일보다 늦다: $start > $end" }
    }
}

enum class EventStatus { UPCOMING, ONGOING, ENDED, UNKNOWN }

/** 날짜 없음의 사유. 재색인 완료 로그가 건수를 갈라 센다. */
enum class EventDateIssue { INVERTED, MISSING }

enum class EventStatusFilter {
    ONGOING, WEEKEND, UPCOMING, THIS_MONTH, NOT_ENDED;

    companion object {
        /** 모르는 값은 null — 검색 API 는 그 파라미터를 무시한다. */
        fun of(value: String?): EventStatusFilter? = entries.firstOrNull { it.name == value }
    }
}

/**
 * 필터 하나가 뜻하는 유효 기간 [s, e] 조건. 모든 경계는 포함(gte·lte)이고 null 은 그 쪽 조건이 없다는 뜻이다.
 * 검색 어댑터는 이 값을 그대로 범위 질의로 옮기고, [contains] 는 같은 조건을 메모리에서 판정한다.
 * 날짜 없는 행사(UNKNOWN)는 범위 필드가 없어 어느 범위에도 들지 않는다.
 */
data class EventDateRange(val startGte: LocalDate?, val startLte: LocalDate?, val endGte: LocalDate?) {
    fun contains(period: EventPeriod?): Boolean {
        if (period == null) return false
        if (startGte != null && period.start.isBefore(startGte)) return false
        if (startLte != null && period.start.isAfter(startLte)) return false
        if (endGte != null && period.end.isBefore(endGte)) return false
        return true
    }
}

/**
 * 행사 일정 규칙 — 유효 기간 정규화 · 상태 판정 · 필터 → 날짜 범위 · 정렬 · 색인 만료.
 * 상태는 저장하지 않고 볼 때마다 이 객체로 판정한다. 오늘(KST 날짜)은 호출자가 시계로 계산해 넘긴다.
 */
object EventSchedule {

    val KST: ZoneId = ZoneId.of("Asia/Seoul")

    /** 색인 유지 기간. 종료 + 이 일수까지는 색인 대상이고, 그 다음 날부터 noindex · 행사 sitemap 제외다. */
    const val INDEX_GRACE_DAYS = 30L

    /** 시각 → KST 날짜. 파드는 UTC 라 UTC 날짜를 쓰면 KST 00:00~08:59 에 하루 늦게 판정한다. */
    fun todayKst(now: Instant): LocalDate = now.atZone(KST).toLocalDate()

    /** S·E 정상 → (S,E) · S 만 → (S,S) · E 만 → (E,E) · S>E · 둘 다 없음 → null. */
    fun effectivePeriod(sourceStart: LocalDate?, sourceEnd: LocalDate?): EventPeriod? = when {
        sourceStart != null && sourceEnd != null -> if (sourceStart.isAfter(sourceEnd)) null else EventPeriod(sourceStart, sourceEnd)
        sourceStart != null -> EventPeriod(sourceStart, sourceStart)
        sourceEnd != null -> EventPeriod(sourceEnd, sourceEnd)
        else -> null
    }

    /** [effectivePeriod] 가 null 을 내는 사유. 날짜가 있으면 null. */
    fun dateIssue(sourceStart: LocalDate?, sourceEnd: LocalDate?): EventDateIssue? = when {
        sourceStart == null && sourceEnd == null -> EventDateIssue.MISSING
        sourceStart != null && sourceEnd != null && sourceStart.isAfter(sourceEnd) -> EventDateIssue.INVERTED
        else -> null
    }

    fun status(period: EventPeriod?, today: LocalDate): EventStatus = when {
        period == null -> EventStatus.UNKNOWN
        period.start.isAfter(today) -> EventStatus.UPCOMING
        period.end.isBefore(today) -> EventStatus.ENDED
        else -> EventStatus.ONGOING
    }

    /** 예정 행사의 시작까지 남은 날 수. 예정이 아니면 null. */
    fun daysUntilStart(period: EventPeriod?, today: LocalDate): Long? =
        if (status(period, today) == EventStatus.UPCOMING) ChronoUnit.DAYS.between(today, period!!.start) else null

    /**
     * `ONGOING` s ≤ 오늘 ≤ e · `UPCOMING` s > 오늘 · `NOT_ENDED` e ≥ 오늘 ·
     * `WEEKEND` [max(오늘, 이번 주 토), 이번 주 일]과 겹침(주는 월~일) · `THIS_MONTH` [오늘, 이번 달 말일]과 겹침.
     * 겹침 [a, b] 는 s ≤ b ∧ e ≥ a 다.
     */
    fun range(filter: EventStatusFilter, today: LocalDate): EventDateRange = when (filter) {
        EventStatusFilter.ONGOING -> EventDateRange(startGte = null, startLte = today, endGte = today)
        EventStatusFilter.UPCOMING -> EventDateRange(startGte = today.plusDays(1), startLte = null, endGte = null)
        EventStatusFilter.NOT_ENDED -> EventDateRange(startGte = null, startLte = null, endGte = today)
        EventStatusFilter.WEEKEND -> {
            val saturday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).plusDays(5)
            val sunday = saturday.plusDays(1)
            EventDateRange(startGte = null, startLte = sunday, endGte = maxOf(today, saturday))
        }
        EventStatusFilter.THIS_MONTH ->
            EventDateRange(startGte = null, startLte = today.with(TemporalAdjusters.lastDayOfMonth()), endGte = today)
    }

    /** 유효 종료일 + 31일 ≤ 오늘. 날짜 없는 행사는 만료가 아니다(robots 는 개요 규칙만 따른다). */
    fun indexExpired(period: EventPeriod?, today: LocalDate): Boolean =
        period != null && period.end.plusDays(INDEX_GRACE_DAYS).isBefore(today)

    /** 정렬 `eventStart`: 유효 시작일 오름차순, 같으면 id 오름차순. 날짜 없는 문서는 뒤로. */
    fun <T> byEventStart(start: (T) -> LocalDate?, id: (T) -> Long): Comparator<T> =
        compareBy<T, LocalDate?>(nullsLast()) { start(it) }.thenBy { id(it) }
}

/** 상태 문구. 서버 렌더와 화면이 같은 문자열을 쓴다 — 화면은 날짜 격자 골든으로 이 함수의 출력과 대조한다. */
object EventStatusText {

    /** [lang] 이 `ko` 가 아니면 영문. UNKNOWN 은 문구가 없다. */
    fun of(period: EventPeriod?, today: LocalDate, lang: String): String? {
        val ko = lang == "ko"
        return when (EventSchedule.status(period, today)) {
            EventStatus.ONGOING -> if (ko) "진행 중" else "Ongoing"
            EventStatus.ENDED -> if (ko) "종료된 행사" else "Ended"
            EventStatus.UPCOMING -> {
                val n = EventSchedule.daysUntilStart(period, today)!!
                when {
                    ko -> "D-$n 시작"
                    n == 1L -> "Starts tomorrow"
                    else -> "Starts in $n days"
                }
            }
            EventStatus.UNKNOWN -> null
        }
    }
}
