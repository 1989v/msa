package com.kgd.place.infrastructure.persistence.weather

import com.kgd.place.domain.weather.model.HalfDay
import com.kgd.place.domain.weather.model.MidForecast
import com.kgd.place.domain.weather.model.MidKind
import com.kgd.place.domain.weather.model.ShortForecast
import com.kgd.place.domain.weather.model.WeatherOutlook
import com.kgd.place.domain.weather.model.WeatherSource
import com.kgd.place.infrastructure.persistence.weather.adapter.WeatherRepositoryAdapter
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.json.JsonMapper
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 운영 표본(2026-10-02, 서울 종로 격자 60,127)의 원문이 저장 표의 원문 그대로 읽혀 화면 날이 되는지.
 * 픽스처는 수집기 테스트와 같은 파일이다(`place/ingest/tests/fixtures/phase2-weather.json`) — 사본을 두지 않는다.
 * 기댓값은 원문 행에서 직접 찾는다(TMN·TMX 행 값, 중기 키 값).
 */
class WeatherSampleTest : BehaviorSpec({
    val json = JsonMapper.builder().build()
    val fixture = json.readTree(File("../ingest/tests/fixtures/phase2-weather.json"))

    fun rawOf(name: String): String = json.writeValueAsString(fixture.get(name))
    fun rows(name: String): List<Map<*, *>> = json.readValue(rawOf(name), List::class.java).map { it as Map<*, *> }
    fun value(name: String, category: String, date: String): Int =
        rows(name).single { it["category"] == category && it["fcstDate"] == date }["fcstValue"].toString().toDouble().toInt()

    given("05시 발표 907행") {
        val forecast = ShortForecast(60, 127, LocalDateTime.of(2026, 10, 2, 5, 0), WeatherRepositoryAdapter.shortItems(rawOf("shortForecast0500")))
        val days = WeatherOutlook.shortDays(forecast)
        then("행 하나도 버리지 않고 읽는다") {
            forecast.items.size shouldBe 907
        }
        then("오늘 ~ 글피 넷이고, 최저·최고는 원천 TMN·TMX 행 값이다 — 오늘은 05시 발표라 최저가 없다") {
            days.map { it.date } shouldBe (0L..3L).map { LocalDate.of(2026, 10, 2).plusDays(it) }
            days[0].min shouldBe null
            days[0].max shouldBe value("shortForecast0500", "TMX", "20261002")
            days[1].min shouldBe value("shortForecast0500", "TMN", "20261003")
            days[1].max shouldBe value("shortForecast0500", "TMX", "20261003")
            days.all { it.source == WeatherSource.SHORT } shouldBe true
        }
        then("강수확률은 그 반나절 POP 행의 최댓값이다") {
            val pops = rows("shortForecast0500").filter { it["category"] == "POP" && it["fcstDate"] == "20261003" && it["fcstTime"].toString() >= "1200" }
                .map { it["fcstValue"].toString().toInt() }
            days[1].pm?.pop shouldBe pops.max()
        }
    }

    given("17시 발표 1,052행 + 06시 중기") {
        val forecast = ShortForecast(60, 127, LocalDateTime.of(2026, 10, 2, 17, 0), WeatherRepositoryAdapter.shortItems(rawOf("shortForecast1700")))
        val land = MidForecast("11B00000", MidKind.LAND, LocalDateTime.of(2026, 10, 2, 6, 0), WeatherRepositoryAdapter.midFields(json.writeValueAsString(fixture.get("midLand").get(0))))
        val ta = MidForecast("11B10101", MidKind.TA, LocalDateTime.of(2026, 10, 2, 6, 0), WeatherRepositoryAdapter.midFields(json.writeValueAsString(fixture.get("midTa").get(0))))
        val days = WeatherOutlook.days(forecast, land, ta)
        then("오늘 ~ 10일 뒤 열하루가 빈 날 없이 이어진다 — 글피까지 단기, 그다음 중기") {
            forecast.items.size shouldBe 1052
            days.map { it.date } shouldBe (0L..10L).map { LocalDate.of(2026, 10, 2).plusDays(it) }
            days.map { it.source } shouldBe List(4) { WeatherSource.SHORT } + List(7) { WeatherSource.MID }
            // 17시 발표의 오늘은 18시부터라 오전·최저·최고가 없다 — 0 으로 채우지 않는다
            days[0].am shouldBe null
            days[0].min shouldBe null
        }
        then("중기 값은 원천 키 그대로다 — 4일 뒤 오전 「구름많음」 20% · 최저 10 · 최고 22, 10일 뒤는 하루 하나") {
            days[4].am shouldBe HalfDay("구름많음", 20)
            (days[4].min to days[4].max) shouldBe (10 to 22)
            days[10].allDay shouldBe HalfDay("구름많음", 20)
            (days[10].min to days[10].max) shouldBe (15 to 24)
        }
    }
})
