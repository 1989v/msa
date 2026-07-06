package com.kgd.game.domain.catalog.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class GameStatsTest : BehaviorSpec({

    given("GameStats 평점 집계 시") {
        `when`("신규 투표가 들어오면") {
            then("sum과 count가 함께 증가해야 한다") {
                val stats = GameStats.init(gameId = 1L)
                stats.applyRating(newScore = 9)
                stats.applyRating(newScore = 8)

                stats.ratingSum shouldBe 17
                stats.ratingCount shouldBe 2
                stats.averageRating() shouldBe 8.5
            }
        }

        `when`("재투표(9 → 6)가 들어오면") {
            then("count는 유지되고 sum만 차액 반영되어야 한다") {
                val stats = GameStats.init(gameId = 1L)
                stats.applyRating(newScore = 9)
                stats.applyRating(newScore = 6, oldScore = 9)

                stats.ratingSum shouldBe 6
                stats.ratingCount shouldBe 1
                stats.averageRating() shouldBe 6.0
            }
        }

        `when`("투표가 없으면") {
            then("평균은 0.0이어야 한다") {
                GameStats.init(gameId = 1L).averageRating() shouldBe 0.0
            }
        }
    }

    given("플레이 집계 시") {
        `when`("recordPlay 후 resetWeekly 하면") {
            then("누적은 유지되고 주간만 초기화되어야 한다") {
                val stats = GameStats.init(gameId = 1L)
                repeat(3) { stats.recordPlay() }
                stats.resetWeekly()

                stats.playCount shouldBe 3
                stats.weeklyPlayCount shouldBe 0
            }
        }
    }
})
