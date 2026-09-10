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

    given("인기 점수는 연 횟수와 실제로 논 판을 함께 본다") {
        `when`("열어만 봤으면") {
            then("연 횟수만큼이다") {
                val stats = GameStats.init(gameId = 1L)
                repeat(5) { stats.recordPlay() }

                stats.trendingScore() shouldBe 5
            }
        }

        `when`("한 판을 끝까지 놀았으면") {
            then("열어만 본 세 번과 같아진다 — 이게 무게를 둔 이유다") {
                val played = GameStats.init(gameId = 1L)
                played.recordPlay()
                played.recordEngagement()

                val opened = GameStats.init(gameId = 2L)
                repeat(3) { opened.recordPlay() }

                played.trendingScore() shouldBe opened.trendingScore()
            }
        }

        `when`("열어만 본 것이 훨씬 많아도") {
            then("실제로 논 쪽이 앞선다") {
                val skimmed = GameStats.init(gameId = 1L)
                repeat(10) { skimmed.recordPlay() }

                val engaged = GameStats.init(gameId = 2L)
                repeat(5) {
                    engaged.recordPlay()
                    engaged.recordEngagement()
                }

                (engaged.trendingScore() > skimmed.trendingScore()) shouldBe true
            }
        }

        `when`("주간 리셋이 돌면") {
            then("두 항이 함께 0 이 된다 — 한쪽만 남으면 점수가 안 내려온다") {
                val stats = GameStats.init(gameId = 1L)
                repeat(4) { stats.recordPlay(); stats.recordEngagement() }
                stats.resetWeekly()

                stats.weeklyPlayCount shouldBe 0
                stats.weeklyEngagedCount shouldBe 0
                stats.trendingScore() shouldBe 0
            }
        }
    }
})
