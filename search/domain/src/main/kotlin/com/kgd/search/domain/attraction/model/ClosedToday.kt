package com.kgd.search.domain.attraction.model

import java.time.Clock
import java.time.DayOfWeek
import java.time.ZoneId

/**
 * 「오늘 정기휴무 아님」 판정. 요일은 서버 시간대가 아니라 KST 로 센다 — 파드는 UTC 라
 * 한국 월요일 00:00~08:59 가 아직 일요일로 잡힌다.
 */
object ClosedToday {

    val KST: ZoneId = ZoneId.of("Asia/Seoul")

    fun todayKst(clock: Clock): DayOfWeek = clock.instant().atZone(KST).dayOfWeek

    /** 연중무휴이거나, 휴무 요일을 알고 오늘이 거기 없을 때만 true. 모르면 false 로 뺀다. */
    fun isRegularlyOpen(closure: RegularClosure, clock: Clock): Boolean = when (closure) {
        RegularClosure.AlwaysOpen -> true
        is RegularClosure.Weekly -> todayKst(clock) !in closure.closedDays
        RegularClosure.Unknown -> false
    }
}
