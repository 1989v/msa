package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.shouldBe
import java.io.File
import java.time.Instant
import java.time.LocalDate

/**
 * 행사 일정 날짜 격자 골든 생성기.
 *
 * 서버 렌더와 화면은 행사 상태·상태 문구·색인 만료(robots)를 **같게** 판정해야 한다 — 하이드레이션이
 * 서버 값을 뒤집으면 렌더 전후로 문구와 robots 가 바뀐다. 그래서 이 테스트가 [EventSchedule]·[EventStatusText]
 * 의 실제 출력으로 격자를 만들어 portal-fe 픽스처에 쓰고, 화면 쪽 vitest 가 같은 입력(시각·원천 날짜)으로
 * 자기 판정을 돌려 비교한다. CI 는 이 테스트를 돌린 뒤 `git diff --exit-code` 로 픽스처가 최신인지 본다 —
 * 규칙만 고치고 픽스처를 안 올리면 거기서 막힌다.
 *
 * 격자: 월말을 걸친 2주(2026-10-26 월 ~ 11-08 일) × 하루의 KST 처음·끝 시각 × 원천 날짜 조합.
 * 원천 날짜 조합은 같은 날 · S 만 · E 만 · S>E · 없음 · 월말 걸침 · 주말 · 만료 +30/+31 경계를 격자 안에 둔다.
 */
class EventScheduleGoldenTest : BehaviorSpec({

    given("날짜 격자") {
        val cases = goldenCases()

        `when`("골든 파일을 다시 쓰면") {
            val file = repoRoot().resolve(GOLDEN_PATH)
            file.parentFile.mkdirs()
            file.writeText(render(cases))

            then("격자가 경계 사례를 모두 담는다 — 비거나 한쪽으로 쏠리면 화면 대조가 아무것도 재지 않는다") {
                cases.size shouldBe 28 * SOURCES.size
                cases.map { it.status }.toSet() shouldBe EventStatus.entries.toSet()
                cases.map { it.textEn }.toSet() shouldContainAll listOf("Starts tomorrow", "Starts in 2 days")
                // KST 자정: 같은 KST 날짜의 처음·끝 시각이 다 있고, UTC 날짜는 서로 다르다
                cases.filter { it.today == LocalDate.parse("2026-10-27") }.map { it.now }.toSet() shouldBe
                    setOf(Instant.parse("2026-10-26T15:00:00Z"), Instant.parse("2026-10-27T14:59:00Z"))
                // 만료 +30(색인) · +31(만료)이 같은 원천에서 이어 나온다
                val endsSep28 = cases.filter { it.sourceEnd == LocalDate.parse("2026-09-28") }
                endsSep28.first { it.today == LocalDate.parse("2026-10-28") }.indexExpired shouldBe false
                endsSep28.first { it.today == LocalDate.parse("2026-10-29") }.indexExpired shouldBe true
            }
        }
    }
}) {
    private data class Case(
        val now: Instant,
        val today: LocalDate,
        val sourceStart: LocalDate?,
        val sourceEnd: LocalDate?,
        val period: EventPeriod?,
        val status: EventStatus,
        val daysUntilStart: Long?,
        val textKo: String?,
        val textEn: String?,
        val indexExpired: Boolean,
        val filters: Map<EventStatusFilter, Boolean>,
    )

    private companion object {
        const val GOLDEN_PATH = "portal-fe/src/seo/__tests__/fixtures/event-schedule-golden.json"

        val SOURCES: List<Pair<String?, String?>> = listOf(
            "2026-10-30" to "2026-11-02", // 월말 걸침
            "2026-10-31" to "2026-10-31", // 같은 날(토)
            "2026-11-01" to null, // S 만(일)
            null to "2026-11-07", // E 만(토)
            "2026-11-05" to "2026-11-01", // S > E
            null to null, // 없음
            "2026-10-26" to "2026-10-30", // 첫 주 월~금
            "2026-11-07" to "2026-11-08", // 둘째 주 주말
            "2026-10-27" to "2026-10-27", // 화요일 하루 — 10-26 에 D-1
            "2026-11-09" to "2026-11-12", // 격자 뒤에 시작
            "2026-10-25" to "2026-10-26", // 격자 첫날 끝남
            "2026-11-08" to "2026-11-08", // 격자 마지막 날(일) 하루
            "2026-08-01" to "2026-12-31", // 긴 행사
            "2026-09-01" to "2026-09-28", // 만료 경계: 10-28 색인(+30) · 10-29 만료(+31)
            "2026-10-01" to "2026-10-05", // 만료 경계: 11-04 색인(+30) · 11-05 만료(+31)
        )

        fun goldenCases(): List<Case> {
            val days = (0L..13L).map { LocalDate.parse("2026-10-26").plusDays(it) }
            // 하루의 KST 00:00(전날 UTC 15:00)과 23:59(같은 날 UTC 14:59)
            val nows = days.flatMap { d ->
                listOf(d.minusDays(1).atTime(15, 0), d.atTime(14, 59)).map { it.toInstant(java.time.ZoneOffset.UTC) }
            }
            return nows.flatMap { now ->
                val today = EventSchedule.todayKst(now)
                SOURCES.map { (s, e) ->
                    val start = s?.let(LocalDate::parse)
                    val end = e?.let(LocalDate::parse)
                    val period = EventSchedule.effectivePeriod(start, end)
                    Case(
                        now = now,
                        today = today,
                        sourceStart = start,
                        sourceEnd = end,
                        period = period,
                        status = EventSchedule.status(period, today),
                        daysUntilStart = EventSchedule.daysUntilStart(period, today),
                        textKo = EventStatusText.of(period, today, "ko"),
                        textEn = EventStatusText.of(period, today, "en"),
                        indexExpired = EventSchedule.indexExpired(period, today),
                        filters = EventStatusFilter.entries.associateWith { EventSchedule.range(it, today).contains(period) },
                    )
                }
            }
        }

        /** 한 줄에 사례 하나 — 규칙이 바뀌면 diff 가 바뀐 사례만 가리킨다. */
        fun render(cases: List<Case>): String = cases.joinToString(
            separator = ",\n",
            prefix = "{\n\"generatedBy\": \"search/domain EventScheduleGoldenTest\",\n\"cases\": [\n",
            postfix = "\n]\n}\n",
        ) { c ->
            val fields = linkedMapOf(
                "now" to c.now.toString(),
                "today" to c.today.toString(),
                "sourceStart" to c.sourceStart?.toString(),
                "sourceEnd" to c.sourceEnd?.toString(),
                "effectiveStart" to c.period?.start?.toString(),
                "effectiveEnd" to c.period?.end?.toString(),
                "status" to c.status.name,
                "daysUntilStart" to c.daysUntilStart,
                "textKo" to c.textKo,
                "textEn" to c.textEn,
                "indexExpired" to c.indexExpired,
            )
            val filters = c.filters.entries.joinToString(",", "{", "}") { (f, v) -> "\"${f.name}\":$v" }
            fields.entries.joinToString(",", "{", ",\"filters\":$filters}") { (k, v) -> "\"$k\":${json(v)}" }
        }

        fun json(v: Any?): String = when (v) {
            null -> "null"
            is String -> "\"" + v.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
            else -> v.toString()
        }

        fun repoRoot(): File = generateSequence(File("").absoluteFile) { it.parentFile }
            .first { File(it, "settings.gradle.kts").isFile }
    }
}
