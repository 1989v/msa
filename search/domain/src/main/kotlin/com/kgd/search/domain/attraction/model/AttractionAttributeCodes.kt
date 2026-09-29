package com.kgd.search.domain.attraction.model

import java.time.DayOfWeek

/** 색인에 싣는 정기휴무 상태. 「매주 쉬는 요일이 없다」(NO_WEEKLY)와 「모른다」(UNKNOWN)를 다른 값으로 둔다. */
enum class ClosureState { ALWAYS_OPEN, WEEKLY, NO_WEEKLY, UNKNOWN }

/**
 * [AttractionAttributes] ↔ 색인 문서 값. 색인하는 쪽(batch)과 읽는 쪽(app), 필터를 거는 쪽이
 * 같은 표기를 써야 해서 한 곳에 둔다 — 한쪽만 바뀌면 필터가 오류 없이 0건을 낸다.
 */
object AttractionAttributeCodes {

    fun closureState(closure: RegularClosure): ClosureState = when (closure) {
        RegularClosure.AlwaysOpen -> ClosureState.ALWAYS_OPEN
        is RegularClosure.Weekly -> if (closure.closedDays.isEmpty()) ClosureState.NO_WEEKLY else ClosureState.WEEKLY
        RegularClosure.Unknown -> ClosureState.UNKNOWN
    }

    /** WEEKLY 일 때만 요일 코드 목록(월→일 순). 나머지는 null — 빈 목록과 「해당 없음」을 섞지 않는다. */
    fun closedWeekdays(closure: RegularClosure): List<String>? =
        (closure as? RegularClosure.Weekly)?.closedDays?.takeIf { it.isNotEmpty() }?.sorted()?.map(::weekdayCode)

    /** MON · TUE · … · SUN. 「오늘 정기휴무 아님」 필터가 오늘 요일을 이 표기로 바꿔 건다. */
    fun weekdayCode(day: DayOfWeek): String = day.name.take(3)

    /** 색인 값 → 정기휴무. 모르는 표기나 요일 없는 WEEKLY 는 UNKNOWN 으로 읽는다. */
    fun regularClosure(state: String?, weekdays: List<String>?): RegularClosure =
        when (enumOrNull<ClosureState>(state)) {
            ClosureState.ALWAYS_OPEN -> RegularClosure.AlwaysOpen
            ClosureState.NO_WEEKLY -> RegularClosure.Weekly(emptySet())
            ClosureState.WEEKLY -> {
                val days = weekdays.orEmpty().mapNotNull { code -> DayOfWeek.entries.firstOrNull { weekdayCode(it) == code } }
                if (days.isEmpty()) RegularClosure.Unknown else RegularClosure.Weekly(days.toSet())
            }
            ClosureState.UNKNOWN, null -> RegularClosure.Unknown
        }

    /** 색인 값을 enum 으로. 새 배치가 쓴 값을 옛 앱이 읽는 배포 틈에도 예외 대신 null 을 낸다. */
    inline fun <reified E : Enum<E>> enumOrNull(value: String?): E? =
        value?.let { v -> enumValues<E>().firstOrNull { it.name == v } }
}
