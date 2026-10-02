package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

class EventScheduleTest : BehaviorSpec({

    fun d(iso: String): LocalDate = LocalDate.parse(iso)
    fun period(s: String, e: String) = EventPeriod(d(s), d(e))

    given("원천 시작일 S · 종료일 E 를 유효 기간으로 정규화할 때") {
        `when`("다섯 조합을 넣으면") {
            then("S·E 정상 → (S,E) · S 만 → (S,S) · E 만 → (E,E) · S>E·없음 → 날짜 없음") {
                EventSchedule.effectivePeriod(d("2026-10-01"), d("2026-10-05")) shouldBe period("2026-10-01", "2026-10-05")
                EventSchedule.effectivePeriod(d("2026-10-03"), d("2026-10-03")) shouldBe period("2026-10-03", "2026-10-03")
                EventSchedule.effectivePeriod(d("2026-10-01"), null) shouldBe period("2026-10-01", "2026-10-01")
                EventSchedule.effectivePeriod(null, d("2026-10-05")) shouldBe period("2026-10-05", "2026-10-05")
                EventSchedule.effectivePeriod(d("2026-10-06"), d("2026-10-05")) shouldBe null
                EventSchedule.effectivePeriod(null, null) shouldBe null
            }
            then("날짜 없음은 사유(S>E · 둘 다 없음)를 갈라 건수로 셀 수 있다") {
                EventSchedule.dateIssue(d("2026-10-06"), d("2026-10-05")) shouldBe EventDateIssue.INVERTED
                EventSchedule.dateIssue(null, null) shouldBe EventDateIssue.MISSING
                EventSchedule.dateIssue(d("2026-10-01"), null) shouldBe null
                EventSchedule.dateIssue(d("2026-10-05"), d("2026-10-05")) shouldBe null
            }
        }
    }

    given("유효 기간 2026-10-03 ~ 2026-10-05 행사의 상태를 볼 때") {
        val p = period("2026-10-03", "2026-10-05")
        `when`("오늘이 시작일 전날 · 시작일 · 종료일 · 종료일 다음 날이면") {
            then("예정 · 진행 중 · 진행 중 · 종료 — 날짜 비교라 당일은 진행 중이다") {
                EventSchedule.status(p, d("2026-10-02")) shouldBe EventStatus.UPCOMING
                EventSchedule.status(p, d("2026-10-03")) shouldBe EventStatus.ONGOING
                EventSchedule.status(p, d("2026-10-05")) shouldBe EventStatus.ONGOING
                EventSchedule.status(p, d("2026-10-06")) shouldBe EventStatus.ENDED
            }
        }
        `when`("날짜가 없으면") {
            then("UNKNOWN 이고 어떤 필터 범위에도 들지 않는다") {
                EventSchedule.status(null, d("2026-10-03")) shouldBe EventStatus.UNKNOWN
                EventStatusFilter.entries.forEach { f ->
                    EventSchedule.range(f, d("2026-10-03")).contains(null) shouldBe false
                }
            }
        }
    }

    given("KST 자정 경계 — 호출자가 시각을 KST 날짜로 바꿔 넘길 때") {
        val endsOct4 = period("2026-10-01", "2026-10-04")
        `when`("UTC 14:59(KST 23:59)이면") {
            val today = EventSchedule.todayKst(Instant.parse("2026-10-04T14:59:00Z"))
            then("아직 10-04 라 진행 중이다") {
                today shouldBe d("2026-10-04")
                EventSchedule.status(endsOct4, today) shouldBe EventStatus.ONGOING
            }
        }
        `when`("UTC 15:00(KST 다음 날 00:00)이면") {
            val today = EventSchedule.todayKst(Instant.parse("2026-10-04T15:00:00Z"))
            then("10-05 라 종료다 — UTC 날짜(10-04)로 판정하면 하루 늦게 끝난다") {
                today shouldBe d("2026-10-05")
                EventSchedule.status(endsOct4, today) shouldBe EventStatus.ENDED
            }
        }
    }

    given("이번 주말 범위 — 주는 월~일, 2026-10-05(월) ~ 10-11(일) 주") {
        val week = (0L..6L).map { d("2026-10-05").plusDays(it) }
        val endsFriday = period("2026-10-05", "2026-10-09")
        val saturdayOnly = period("2026-10-10", "2026-10-10")
        val sundayOnly = period("2026-10-11", "2026-10-11")
        val nextMonday = period("2026-10-12", "2026-10-14")
        val wholeMonth = period("2026-10-01", "2026-10-31")
        `when`("월~일 각 요일을 오늘로 두면") {
            then("금요일에 끝나는 행사는 어느 요일에도 들지 않고, 다음 주 행사도 들지 않는다") {
                week.forEach { today ->
                    val r = EventSchedule.range(EventStatusFilter.WEEKEND, today)
                    r.contains(endsFriday) shouldBe false
                    r.contains(nextMonday) shouldBe false
                    r.contains(wholeMonth) shouldBe true
                    r.contains(sundayOnly) shouldBe true
                }
            }
            then("토요일 하루 행사는 월~토에는 들고 일요일에는 빠진다 — 일요일의 주말은 그날 하루") {
                week.map { EventSchedule.range(EventStatusFilter.WEEKEND, it).contains(saturdayOnly) } shouldContainExactly
                    listOf(true, true, true, true, true, true, false)
            }
        }
        `when`("오늘이 토요일이면") {
            then("오늘 시작해 오늘 끝나는 행사도 든다 — 오늘 포함") {
                EventSchedule.range(EventStatusFilter.WEEKEND, d("2026-10-10")).contains(saturdayOnly) shouldBe true
            }
        }
    }

    given("이번 달 범위 — [오늘, KST 이번 달 말일]") {
        val acrossMonthEnd = period("2026-10-31", "2026-11-02")
        val startsNextMonth = period("2026-11-01", "2026-11-03")
        val endedYesterday = period("2026-10-20", "2026-10-29")
        val longRunning = period("2026-09-25", "2026-11-05")
        `when`("오늘이 10-30 이면") {
            val r = EventSchedule.range(EventStatusFilter.THIS_MONTH, d("2026-10-30"))
            then("월말을 걸친 행사·긴 행사는 들고 다음 달 시작·어제 끝난 행사는 빠진다") {
                r.contains(acrossMonthEnd) shouldBe true
                r.contains(longRunning) shouldBe true
                r.contains(startsNextMonth) shouldBe false
                r.contains(endedYesterday) shouldBe false
            }
        }
        `when`("오늘이 11-01(월초)이면") {
            val r = EventSchedule.range(EventStatusFilter.THIS_MONTH, d("2026-11-01"))
            then("지난달에 시작해 진행 중인 행사와 이번 달 시작 행사가 든다") {
                r.contains(acrossMonthEnd) shouldBe true
                r.contains(startsNextMonth) shouldBe true
            }
        }
    }

    given("NOT_ENDED 범위") {
        val r = EventSchedule.range(EventStatusFilter.NOT_ENDED, d("2026-10-10"))
        `when`("오늘 끝나는 · 어제 끝난 · 예정 행사를 넣으면") {
            then("오늘 끝나는 것과 예정은 들고 어제 끝난 것은 빠진다") {
                r.contains(period("2026-10-01", "2026-10-10")) shouldBe true
                r.contains(period("2026-10-01", "2026-10-09")) shouldBe false
                r.contains(period("2026-12-01", "2026-12-03")) shouldBe true
            }
        }
    }

    given("필터 값 문자열") {
        `when`("다섯 값 · 모르는 값 · 없음을 넣으면") {
            then("다섯은 그대로, 나머지는 null(무시)") {
                EventStatusFilter.entries.forEach { EventStatusFilter.of(it.name) shouldBe it }
                EventStatusFilter.of("ENDED") shouldBe null
                EventStatusFilter.of("weekend") shouldBe null
                EventStatusFilter.of(null) shouldBe null
            }
        }
    }

    given("정렬 eventStart") {
        data class Row(val id: Long, val start: LocalDate?)
        val rows = listOf(
            Row(7, d("2026-10-05")), Row(3, null), Row(9, d("2026-10-01")),
            Row(2, d("2026-10-05")), Row(1, null), Row(5, d("2026-10-03")),
        )
        `when`("유효 시작일과 id 로 정렬하면") {
            then("시작일 오름차순, 같으면 id 오름차순, 날짜 없는 문서는 뒤") {
                rows.sortedWith(EventSchedule.byEventStart(Row::start, Row::id)).map { it.id } shouldContainExactly
                    listOf(9L, 5L, 2L, 7L, 1L, 3L)
            }
        }
    }

    given("색인 만료 — 유효 종료일 + 31일 ≤ 오늘") {
        val p = period("2026-09-01", "2026-09-10")
        `when`("오늘이 종료 +30일 · +31일이면") {
            then("+30 은 색인 대상, +31 부터 만료") {
                EventSchedule.indexExpired(p, d("2026-10-10")) shouldBe false
                EventSchedule.indexExpired(p, d("2026-10-11")) shouldBe true
            }
        }
        `when`("날짜가 없으면") {
            then("만료가 아니다 — robots 는 개요 규칙만 따른다") {
                EventSchedule.indexExpired(null, d("2030-01-01")) shouldBe false
            }
        }
    }

    given("상태 문구") {
        val today = d("2026-10-10")
        `when`("상태별로 국·영 문구를 만들면") {
            then("진행 중 · D-n 시작 · 종료된 행사 / Ongoing · Starts tomorrow · Starts in n days · Ended, UNKNOWN 은 없음") {
                EventStatusText.of(period("2026-10-01", "2026-10-10"), today, "ko") shouldBe "진행 중"
                EventStatusText.of(period("2026-10-01", "2026-10-10"), today, "en") shouldBe "Ongoing"
                EventStatusText.of(period("2026-10-11", "2026-10-12"), today, "ko") shouldBe "D-1 시작"
                EventStatusText.of(period("2026-10-11", "2026-10-12"), today, "en") shouldBe "Starts tomorrow"
                EventStatusText.of(period("2026-10-15", "2026-10-16"), today, "ko") shouldBe "D-5 시작"
                EventStatusText.of(period("2026-10-15", "2026-10-16"), today, "en") shouldBe "Starts in 5 days"
                EventStatusText.of(period("2026-10-01", "2026-10-09"), today, "ko") shouldBe "종료된 행사"
                EventStatusText.of(period("2026-10-01", "2026-10-09"), today, "en") shouldBe "Ended"
                EventStatusText.of(null, today, "ko") shouldBe null
                EventStatusText.of(null, today, "en") shouldBe null
            }
        }
    }

    given("날짜 격자 — 월말을 걸친 2주 × 요일 7 × S/E 조합(정상·같은 날·S 만·E 만·S>E·없음)") {
        // 오늘: 2026-10-26(월) ~ 11-08(일). 원천 날짜는 그 앞뒤로 넉넉히 둔다
        val todays = (0L..13L).map { d("2026-10-26").plusDays(it) }
        val anchors = (0L..28L).map { d("2026-10-19").plusDays(it) }
        val sources: List<Pair<LocalDate?, LocalDate?>> =
            anchors.flatMap { s -> anchors.map { e -> s to e } } + // 정상 · 같은 날 · S>E
                anchors.map { it to null } + anchors.map { null to it } + listOf(null to null)
        val periods = sources.map { (s, e) -> EventSchedule.effectivePeriod(s, e) }

        // 범위 함수와 독립된 정의: 기간의 날을 하나씩 세어 본다
        fun days(p: EventPeriod): Sequence<LocalDate> = generateSequence(p.start) { it.plusDays(1) }.takeWhile { !it.isAfter(p.end) }
        fun weekendDays(today: LocalDate): Set<LocalDate> {
            val sat = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).plusDays(5)
            return setOf(sat, sat.plusDays(1)).filter { !it.isBefore(today) }.toSet()
        }

        `when`("모든 오늘 × 모든 기간 × 모든 필터를 대조하면") {
            then("범위(f) 포함 ⇔ 상태 조건(f), WEEKEND·THIS_MONTH 결과에 ENDED·UNKNOWN 없음") {
                val hits = mutableMapOf<EventStatusFilter, Int>()
                val misses = mutableMapOf<EventStatusFilter, Int>()
                todays.forEach { today ->
                    val monthEnd = today.with(TemporalAdjusters.lastDayOfMonth())
                    val weekend = weekendDays(today)
                    periods.forEach { p ->
                        val status = EventSchedule.status(p, today)
                        EventStatusFilter.entries.forEach { f ->
                            val inRange = EventSchedule.range(f, today).contains(p)
                            val expected = when (f) {
                                EventStatusFilter.ONGOING -> status == EventStatus.ONGOING
                                EventStatusFilter.UPCOMING -> status == EventStatus.UPCOMING
                                EventStatusFilter.NOT_ENDED -> status == EventStatus.ONGOING || status == EventStatus.UPCOMING
                                EventStatusFilter.WEEKEND -> p != null && days(p).any { it in weekend }
                                EventStatusFilter.THIS_MONTH -> p != null && days(p).any { !it.isBefore(today) && !it.isAfter(monthEnd) }
                            }
                            withClue(f, today, p) { inRange shouldBe expected }
                            if (inRange && (f == EventStatusFilter.WEEKEND || f == EventStatusFilter.THIS_MONTH)) {
                                withClue(f, today, p) {
                                    status shouldNotBe EventStatus.ENDED
                                    status shouldNotBe EventStatus.UNKNOWN
                                }
                            }
                            if (inRange) hits.merge(f, 1, Int::plus) else misses.merge(f, 1, Int::plus)
                        }
                    }
                }
                // 양성·음성 대조 — 격자가 비거나 한쪽으로만 쏠리면 위 단언이 아무것도 재지 않는다
                EventStatusFilter.entries.forEach { f ->
                    withClue(f, null, null) {
                        (hits[f] ?: 0) shouldNotBe 0
                        (misses[f] ?: 0) shouldNotBe 0
                    }
                }
            }
        }
    }
})

private inline fun withClue(f: EventStatusFilter, today: LocalDate?, p: EventPeriod?, block: () -> Unit) =
    io.kotest.assertions.withClue("filter=$f today=$today period=$p") { block() }
