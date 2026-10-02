package com.kgd.place.domain.air.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDateTime

class AirQualityTest : BehaviorSpec({

    given("원천 측정 시각을 읽을 때") {
        then("`yyyy-MM-dd HH:mm` 그대로, 자정은 원천이 `24:00` 으로 주므로 다음 날 00:00 으로 읽는다") {
            AirQuality.parseDataTime("2026-10-02 21:00") shouldBe LocalDateTime.of(2026, 10, 2, 21, 0)
            AirQuality.parseDataTime("2026-10-02 24:00") shouldBe LocalDateTime.of(2026, 10, 3, 0, 0)
            AirQuality.parseDataTime("2026-12-31 24:00") shouldBe LocalDateTime.of(2027, 1, 1, 0, 0)
        }
        then("없거나 모양이 다르면 null — 측정 없음과 같다") {
            AirQuality.parseDataTime(null) shouldBe null
            AirQuality.parseDataTime("") shouldBe null
            AirQuality.parseDataTime("2026-10-02T21:00") shouldBe null
        }
    }

    given("신선도를 잴 때") {
        val measured = LocalDateTime.of(2026, 10, 2, 21, 0)
        then("측정 3시간까지만 낸다 — 넘으면 절을 숨긴다") {
            AirQuality.isFresh(measured, measured.plusHours(3)) shouldBe true
            AirQuality.isFresh(measured, measured.plusHours(3).plusMinutes(1)) shouldBe false
            AirQuality.isFresh(null, measured) shouldBe false
        }
    }

    given("원문 한 행에서 오염물질을 꺼낼 때") {
        // 세종 조치원읍 운영 응답(2026-10-02 21:00) — 일산화탄소는 통신장애로 값이 「-」, 등급이 없다
        val fields = mapOf(
            "pm10Value" to "34", "pm10Grade" to "1", "pm10Flag" to null,
            "coValue" to "-", "coGrade" to null, "coFlag" to "통신장애",
        )
        then("값·등급·Flag 를 원천 문자열 그대로 둔다(수로 바꾸거나 등급을 다시 매기지 않는다)") {
            AirQuality.pollutant(fields, "pm10") shouldBe AirPollutant("34", "1", null)
            AirQuality.pollutant(fields, "co") shouldBe AirPollutant("-", null, "통신장애")
            AirQuality.pollutant(fields, "pm25") shouldBe AirPollutant(null, null, null)
        }
    }
})
