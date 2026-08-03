package com.kgd.game.domain.catalog.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class GameCollectionTest : BehaviorSpec({

    given("컬렉션 생성 시") {
        `when`("TAG_BASED인데 tagSlug가 없으면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    GameCollection.create(slug = "physics-games", title = "Physics", type = CollectionType.TAG_BASED)
                }
            }
        }

        `when`("MANUAL이 아닌데 gameIds를 지정하면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    GameCollection.create(
                        slug = "trending",
                        title = "Trending",
                        type = CollectionType.TRENDING,
                        gameIds = listOf(1L)
                    )
                }
            }
        }

        `when`("MANUAL 컬렉션이면") {
            then("gameIds를 교체할 수 있어야 한다") {
                val collection = GameCollection.create(
                    slug = "editors-pick",
                    title = "Editor's Pick",
                    type = CollectionType.MANUAL,
                    gameIds = listOf(1L, 2L)
                )
                collection.replaceGames(listOf(3L))
                collection.gameIds shouldBe listOf(3L)
                collection.active shouldBe true
            }
        }
    }
})
