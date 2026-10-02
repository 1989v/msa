package com.kgd.place.domain.weather.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDate
import java.time.LocalDateTime

class WeatherOutlookTest : BehaviorSpec({

    val base = LocalDateTime.of(2026, 10, 2, 5, 0)
    fun item(category: String, day: Int, hour: Int, value: String) =
        ShortForecastItem(category, LocalDate.of(2026, 10, 2).plusDays(day.toLong()), hour * 100, value)

    given("단기 코드를 글로 바꿀 때") {
        then("강수형태가 있으면 하늘과 합쳐 중기와 같은 표현을, 없으면 하늘만, 모르는 코드는 null") {
            WeatherOutlook.skyText(1, 0) shouldBe "맑음"
            WeatherOutlook.skyText(3, null) shouldBe "구름많음"
            WeatherOutlook.skyText(4, 1) shouldBe "흐리고 비"
            WeatherOutlook.skyText(3, 4) shouldBe "구름많고 소나기"
            WeatherOutlook.skyText(4, 3) shouldBe "흐리고 눈"
            WeatherOutlook.skyText(2, 0) shouldBe null
        }
    }

    given("단기 발표본 하나에서 날을 만들 때") {
        val forecast = ShortForecast(
            60, 127, base,
            listOf(
                // 오늘 — 05시 발표라 06시부터. 최저(TMN)는 없고 최고만 있다
                item("SKY", 0, 9, "1"), item("PTY", 0, 9, "0"), item("POP", 0, 9, "0"),
                item("SKY", 0, 15, "4"), item("PTY", 0, 15, "1"), item("POP", 0, 15, "60"),
                item("SKY", 0, 16, "4"), item("PTY", 0, 16, "0"), item("POP", 0, 16, "30"),
                item("TMX", 0, 15, "22.0"),
                // 글피(+3) 까지가 단기 범위, +4 의 자정 한 시각은 하루가 아니다
                item("SKY", 3, 0, "3"), item("PTY", 3, 0, "0"), item("POP", 3, 0, "20"), item("TMN", 3, 6, "11.0"),
                item("SKY", 4, 0, "1"), item("PTY", 4, 0, "0"), item("POP", 4, 0, "0"),
            ),
        )
        val days = WeatherOutlook.shortDays(forecast)
        then("발표일 ~ 글피만 날짜순으로, 원천에 없는 칸은 null 로 둔다") {
            days.map { it.date.toString() } shouldBe listOf("2026-10-02", "2026-10-05")
            days[0].min shouldBe null
            days[0].max shouldBe 22
            days[1].min shouldBe 11
        }
        then("반나절은 가장 잦은 하늘 · 있던 강수형태 · 최대 강수확률이다") {
            days[0].am shouldBe HalfDay("맑음", 0)
            days[0].pm shouldBe HalfDay("흐리고 비", 60)
            days[1].am shouldBe HalfDay("구름많음", 20)
            days[1].pm shouldBe null
        }
    }

    given("중기 육상·기온 발표본에서 날을 만들 때") {
        val tmFc = LocalDateTime.of(2026, 10, 2, 6, 0)
        val land = MidForecast(
            "11B00000", MidKind.LAND, tmFc,
            (4..7).flatMap { n -> listOf("wf${n}Am" to "구름많음", "wf${n}Pm" to "맑음", "rnSt${n}Am" to "20", "rnSt${n}Pm" to "10") }.toMap() +
                (8..10).flatMap { n -> listOf("wf$n" to "흐리고 비", "rnSt$n" to "60") }.toMap() + ("regId" to "11B00000"),
        )
        val ta = MidForecast("11B10101", MidKind.TA, tmFc, (4..10).flatMap { n -> listOf("taMin$n" to "${n + 6}", "taMax$n" to "${n + 18}") }.toMap())
        val days = WeatherOutlook.midDays(land, ta)
        then("발표일 4~10일 뒤 일곱 날 — 7일 뒤까지는 오전/오후, 그 뒤는 하루 하나") {
            days.map { it.date } shouldBe (4L..10L).map { LocalDate.of(2026, 10, 2).plusDays(it) }
            days.first() shouldBe DailyWeather(LocalDate.of(2026, 10, 6), WeatherSource.MID, 10, 22, HalfDay("구름많음", 20), HalfDay("맑음", 10))
            days.last() shouldBe DailyWeather(LocalDate.of(2026, 10, 12), WeatherSource.MID, 16, 28, allDay = HalfDay("흐리고 비", 60))
        }
        then("기온만 있어도 그 값으로 날을 만든다") {
            WeatherOutlook.midDays(null, ta).first().let { (it.min to it.am) } shouldBe (10 to null)
            WeatherOutlook.midDays(null, null) shouldBe emptyList()
        }
        then("같은 날짜는 단기가 이기고, 단기에 없는 날짜만 중기로 채운다") {
            val short = ShortForecast(60, 127, base, listOf(item("SKY", 3, 12, "4"), item("SKY", 4, 0, "1")))
            val merged = WeatherOutlook.days(short, land, ta)
            merged.map { it.date.dayOfMonth to it.source } shouldBe
                listOf(5 to WeatherSource.SHORT) + (6..12).map { it to WeatherSource.MID }
        }
    }

    given("신선도를 잴 때") {
        val now = LocalDateTime.of(2026, 10, 3, 5, 0)
        then("단기는 발표 24시간까지만, 중기는 30시간까지만, 지난 날짜는 늘 뺀다") {
            WeatherOutlook.visible(LocalDate.of(2026, 10, 3), WeatherSource.SHORT, base, null, now) shouldBe true
            WeatherOutlook.visible(LocalDate.of(2026, 10, 3), WeatherSource.SHORT, base, null, now.plusMinutes(1)) shouldBe false
            WeatherOutlook.visible(LocalDate.of(2026, 10, 2), WeatherSource.SHORT, base, null, now) shouldBe false
            val tmFc = LocalDateTime.of(2026, 10, 2, 6, 0)
            WeatherOutlook.visible(LocalDate.of(2026, 10, 8), WeatherSource.MID, null, tmFc, tmFc.plusHours(30)) shouldBe true
            WeatherOutlook.visible(LocalDate.of(2026, 10, 8), WeatherSource.MID, null, tmFc, tmFc.plusHours(31)) shouldBe false
            WeatherOutlook.visible(LocalDate.of(2026, 10, 8), WeatherSource.MID, null, null, now) shouldBe false
        }
        then("중기 두 발표 중 오래된 쪽으로 잰다") {
            val old = MidForecast("11B10101", MidKind.TA, LocalDateTime.of(2026, 10, 1, 6, 0), emptyMap())
            val new = MidForecast("11B00000", MidKind.LAND, LocalDateTime.of(2026, 10, 2, 6, 0), emptyMap())
            WeatherOutlook.midIssuedAt(new, old) shouldBe old.tmFc
            WeatherOutlook.midIssuedAt(null, null) shouldBe null
        }
    }
})
