package com.kgd.game.domain.catalog.model

import com.kgd.game.domain.catalog.exception.InvalidGameStatusException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class GameTest : BehaviorSpec({

    fun newGame(sdkIntegrated: Boolean = false) = Game.create(
        slug = "memory-match",
        title = "Memory Match",
        description = "개념 짝 맞추기",
        thumbnailUrl = "/thumbs/memory-match.png",
        engineType = EngineType.REACT_INTERNAL,
        loadType = LoadType.INTERNAL_ROUTE,
        entryUrl = "/games/play/memory-match",
        developerName = "kgd",
        sdkIntegrated = sdkIntegrated,
        tags = listOf("puzzle", "casual")
    )

    given("Game 생성 시") {
        `when`("유효한 데이터가 주어지면") {
            then("DRAFT 상태로 생성되어야 한다") {
                val game = newGame()
                game.slug shouldBe "memory-match"
                game.status shouldBe GameStatus.DRAFT
                game.releasedAt shouldBe null
                game.tags shouldBe listOf("puzzle", "casual")
            }
        }

        `when`("slug가 형식에 맞지 않으면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Game.create(
                        slug = "Memory Match!",
                        title = "t",
                        description = "d",
                        thumbnailUrl = "u",
                        engineType = EngineType.HTML5,
                        loadType = LoadType.IFRAME,
                        entryUrl = "/e",
                        developerName = "kgd"
                    )
                }
            }
        }
    }

    given("상태 전이 시") {
        `when`("DRAFT → REVIEW → BETA → PUBLISHED 순서로 전이하면") {
            then("각 상태가 순차 반영되고 releasedAt 은 **처음 노출된 BETA 시점**에 기록되어야 한다") {
                val game = newGame()
                game.submitForReview()
                game.status shouldBe GameStatus.REVIEW
                game.releasedAt shouldBe null

                // BETA 도 공개 목록·신작 탭에 오르는 노출이다 — 여기서 안 찍으면 신작 정렬에서 빠진다
                val betaAt = Instant.parse("2026-07-01T00:00:00Z")
                game.launchBeta(betaAt)
                game.status shouldBe GameStatus.BETA
                game.releasedAt shouldBe betaAt

                // publish 는 이미 있는 출시 시점을 덮어쓰지 않는다
                game.publish(Instant.parse("2026-07-06T00:00:00Z"))
                game.status shouldBe GameStatus.PUBLISHED
                game.releasedAt shouldBe betaAt
            }
        }

        `when`("DRAFT에서 곧바로 publish 하면") {
            then("InvalidGameStatusException이 발생해야 한다") {
                shouldThrow<InvalidGameStatusException> {
                    newGame().publish(Instant.parse("2026-07-06T00:00:00Z"))
                }
            }
        }

        `when`("PUBLISHED에서 suspend 후 resume 하면") {
            then("SUSPENDED를 거쳐 PUBLISHED로 복귀해야 한다") {
                val game = newGame()
                game.submitForReview()
                game.launchBeta(Instant.parse("2026-07-01T00:00:00Z"))
                game.publish(Instant.parse("2026-07-06T00:00:00Z"))

                game.suspend()
                game.status shouldBe GameStatus.SUSPENDED
                game.resume()
                game.status shouldBe GameStatus.PUBLISHED
            }
        }
    }

    given("수익화 판정 시") {
        `when`("PUBLISHED이지만 SDK 미통합이면") {
            then("isMonetizable은 false여야 한다") {
                val game = newGame(sdkIntegrated = false)
                game.submitForReview()
                game.launchBeta(Instant.parse("2026-07-01T00:00:00Z"))
                game.publish(Instant.parse("2026-07-06T00:00:00Z"))
                game.isMonetizable() shouldBe false
            }
        }

        `when`("PUBLISHED + SDK 통합이면") {
            then("isMonetizable은 true여야 한다") {
                val game = newGame(sdkIntegrated = true)
                game.submitForReview()
                game.launchBeta(Instant.parse("2026-07-01T00:00:00Z"))
                game.publish(Instant.parse("2026-07-06T00:00:00Z"))
                game.isMonetizable() shouldBe true
            }
        }

        `when`("BETA 상태면") {
            then("플레이는 가능하지만 수익화는 불가해야 한다") {
                val game = newGame(sdkIntegrated = true)
                game.submitForReview()
                game.launchBeta(Instant.parse("2026-07-01T00:00:00Z"))
                game.isPlayable() shouldBe true
                game.isMonetizable() shouldBe false
            }
        }
    }
})
