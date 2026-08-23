package com.kgd.game.domain.play.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.time.LocalDate

class GameDayTest : BehaviorSpec({

    given("하루의 경계를 정할 때") {
        `when`("한국 시간으로 자정 직전이면") {
            then("아직 어제다 — UTC 로 잘랐다면 이미 오늘로 넘어가 있었을 시각이다") {
                // 2026-08-22T14:59:59Z = KST 2026-08-22 23:59:59
                GameDay.on(Instant.parse("2026-08-22T14:59:59Z")) shouldBe LocalDate.of(2026, 8, 22)
            }
        }

        `when`("한국 시간으로 자정이 지나면") {
            then("날짜가 넘어간다") {
                // 2026-08-22T15:00:00Z = KST 2026-08-23 00:00:00
                GameDay.on(Instant.parse("2026-08-22T15:00:00Z")) shouldBe LocalDate.of(2026, 8, 23)
            }
        }

        `when`("UTC 자정을 지날 때") {
            then("한국에서는 같은 날 오전 9시일 뿐이라 보드가 갈리지 않는다") {
                GameDay.on(Instant.parse("2026-08-22T23:59:59Z")) shouldBe LocalDate.of(2026, 8, 23)
                GameDay.on(Instant.parse("2026-08-23T00:00:01Z")) shouldBe LocalDate.of(2026, 8, 23)
            }
        }
    }

    given("보드 기간 파라미터를 읽을 때") {
        `when`("값이 없거나 모르는 낱말이면") {
            then("역대 보드로 읽는다 — 기존 호출자의 계약이 이것이다") {
                ScorePeriod.from(null) shouldBe ScorePeriod.ALL_TIME
                ScorePeriod.from("") shouldBe ScorePeriod.ALL_TIME
                ScorePeriod.from("WEEKLY") shouldBe ScorePeriod.ALL_TIME
            }
        }

        `when`("대소문자가 섞여 있으면") {
            then("그래도 알아본다") {
                ScorePeriod.from("daily") shouldBe ScorePeriod.DAILY
                ScorePeriod.from(" Daily ") shouldBe ScorePeriod.DAILY
            }
        }
    }
})
