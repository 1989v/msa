package com.kgd.game.domain.play.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class GameRatingTest : BehaviorSpec({

    given("평점 생성 시") {
        `when`("1~10 범위의 점수면") {
            then("정상 생성되어야 한다") {
                val rating = GameRating.create(gameId = 1L, memberId = 7L, score = 9)
                rating.score shouldBe 9
            }
        }

        `when`("범위를 벗어난 점수면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> { GameRating.create(1L, 7L, 0) }
                shouldThrow<IllegalArgumentException> { GameRating.create(1L, 7L, 11) }
            }
        }
    }

    given("재투표 시") {
        `when`("유효한 점수로 변경하면") {
            then("score가 갱신되어야 한다") {
                val rating = GameRating.create(gameId = 1L, memberId = 7L, score = 5)
                rating.changeScore(8)
                rating.score shouldBe 8
            }
        }
    }
})
