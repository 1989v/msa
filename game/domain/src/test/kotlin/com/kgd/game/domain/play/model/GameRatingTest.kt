package com.kgd.game.domain.play.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class GameRatingTest : BehaviorSpec({

    given("평점 생성 시") {
        `when`("1~10 범위의 점수면") {
            then("정상 생성되어야 한다") {
                val rating = GameRating.byMember(gameId = 1L, memberId = 7L, score = 9)
                rating.score shouldBe 9
            }
        }

        `when`("범위를 벗어난 점수면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> { GameRating.byMember(1L, 7L, 0) }
                shouldThrow<IllegalArgumentException> { GameRating.byMember(1L, 7L, 11) }
            }
        }
    }

    given("게스트 표 생성 시") {
        `when`("기기 식별자만 있으면") {
            then("표가 만들어지고 회원 id 는 비어 있다") {
                val rating = GameRating.byDevice(gameId = 1L, deviceId = "dev-1", score = 7)
                rating.memberId shouldBe null
                rating.deviceId shouldBe "dev-1"
                rating.score shouldBe 7
            }
        }

        `when`("회원도 기기도 없으면") {
            then("표의 주인을 알 수 없으므로 거부한다") {
                shouldThrow<IllegalArgumentException> {
                    GameRating.restore(id = null, gameId = 1L, memberId = null, deviceId = null, score = 7)
                }
                shouldThrow<IllegalArgumentException> {
                    GameRating.restore(id = null, gameId = 1L, memberId = null, deviceId = "  ", score = 7)
                }
            }
        }
    }

    given("재투표 시") {
        `when`("유효한 점수로 변경하면") {
            then("score가 갱신되어야 한다") {
                val rating = GameRating.byMember(gameId = 1L, memberId = 7L, score = 5)
                rating.changeScore(8)
                rating.score shouldBe 8
            }
        }
    }
})
