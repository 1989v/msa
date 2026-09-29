package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Clock
import java.time.DayOfWeek
import java.time.ZoneOffset
import java.time.ZonedDateTime

class ClosedTodayTest : BehaviorSpec({

    // 시계는 UTC 로 둔다 — KST 로 바꾸는 일을 대상 코드가 하는지 보려면 시계 쪽 영역이 KST 이면 안 된다
    fun clockAt(kst: String): Clock =
        Clock.fixed(ZonedDateTime.parse(kst).toInstant(), ZoneOffset.UTC)

    val mondayClosed = RegularClosure.Weekly(setOf(DayOfWeek.MONDAY))

    given("매주 월요일에 쉬는 곳을 KST 요일 경계에서 볼 때") {
        `when`("일요일 23:59 KST(UTC 로는 일요일 14:59)이면") {
            then("오늘 정기휴무가 아니다") {
                ClosedToday.isRegularlyOpen(mondayClosed, clockAt("2026-09-27T23:59+09:00[Asia/Seoul]")) shouldBe true
            }
        }
        `when`("월요일 00:00 KST(UTC 로는 아직 일요일 15:00)이면") {
            then("오늘 정기휴무다") {
                ClosedToday.isRegularlyOpen(mondayClosed, clockAt("2026-09-28T00:00+09:00[Asia/Seoul]")) shouldBe false
            }
        }
    }

    given("휴무 요일을 모르거나 없는 곳을 볼 때") {
        val monday = clockAt("2026-09-28T12:00+09:00[Asia/Seoul]")
        `when`("정기휴무가 UNKNOWN 이면") {
            then("제외한다 — 모르는 곳을 연 곳으로 보여주지 않는다") {
                ClosedToday.isRegularlyOpen(RegularClosure.Unknown, monday) shouldBe false
            }
        }
        `when`("연중무휴이거나 명절만 쉬면") {
            then("포함한다") {
                ClosedToday.isRegularlyOpen(RegularClosure.AlwaysOpen, monday) shouldBe true
                ClosedToday.isRegularlyOpen(RegularClosure.Weekly(emptySet()), monday) shouldBe true
            }
        }
    }
})
