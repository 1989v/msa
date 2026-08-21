package com.kgd.wishlist.application.wishlist.service

import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.application.wishlist.usecase.AddWishlistItemUseCase
import com.kgd.wishlist.application.wishlist.usecase.GetWishlistKeysUseCase
import com.kgd.wishlist.application.wishlist.usecase.GetWishlistUseCase
import com.kgd.wishlist.application.wishlist.usecase.RemoveWishlistItemUseCase
import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDateTime

class WishlistServiceTest : BehaviorSpec({

    fun item(id: Long = 10L, type: WishlistTargetType = WishlistTargetType.GAME, key: String = "abyssal-crown") =
        WishlistItem.restore(
            id = id,
            memberId = 1L,
            targetType = type,
            targetKey = key,
            createdAt = LocalDateTime.now(),
        )

    Given("찜 추가 (PUT 멱등)") {
        val port = mockk<WishlistRepositoryPort>()
        val service = WishlistService(port)

        When("처음 찜하면") {
            every { port.findByMemberAndTarget(1L, WishlistTargetType.GAME, "abyssal-crown") } returns null
            every { port.save(any()) } answers {
                val saved = firstArg<WishlistItem>()
                WishlistItem.restore(10L, saved.memberId, saved.targetType, saved.targetKey, saved.createdAt)
            }

            val result = service.execute(
                AddWishlistItemUseCase.Command(1L, WishlistTargetType.GAME, "abyssal-crown")
            )

            Then("저장하고 새 행을 돌려준다") {
                result.id shouldBe 10L
                result.targetType shouldBe WishlistTargetType.GAME
                result.targetKey shouldBe "abyssal-crown"
                verify(exactly = 1) { port.save(any()) }
            }
        }

        When("이미 찜한 대상이면") {
            every { port.findByMemberAndTarget(1L, WishlistTargetType.GAME, "abyssal-crown") } returns item()

            val result = service.execute(
                AddWishlistItemUseCase.Command(1L, WishlistTargetType.GAME, "abyssal-crown")
            )

            Then("저장 없이 기존 행을 돌려준다 — 더블탭이 에러가 되지 않는다") {
                result.id shouldBe 10L
                // 첫 When 의 save 1회 그대로 — 이번 호출에서는 늘지 않았다
                verify(exactly = 1) { port.save(any()) }
            }
        }
    }

    Given("찜 해제") {
        val port = mockk<WishlistRepositoryPort>(relaxed = true)
        val service = WishlistService(port)

        When("해제를 요청하면") {
            service.execute(RemoveWishlistItemUseCase.Command(1L, WishlistTargetType.BLOG_POST, "my-post"))

            Then("멱등 삭제를 위임한다") {
                verify { port.deleteByMemberAndTarget(1L, WishlistTargetType.BLOG_POST, "my-post") }
            }
        }
    }

    Given("내 찜 목록 조회") {
        val port = mockk<WishlistRepositoryPort>()
        val service = WishlistService(port)

        When("타입 지정 없이 조회하면") {
            every { port.findByMember(1L, null, 0, 20) } returns listOf(
                item(id = 11L, type = WishlistTargetType.ATTRACTION, key = "12345"),
                item(id = 10L),
            )
            every { port.countByMember(1L, null) } returns 2L

            val result = service.execute(GetWishlistUseCase.Query(memberId = 1L))

            Then("전 타입이 함께 나온다") {
                result.totalCount shouldBe 2L
                result.items.map { it.targetType } shouldBe
                    listOf(WishlistTargetType.ATTRACTION, WishlistTargetType.GAME)
            }
        }

        When("타입을 지정하면") {
            every { port.findByMember(1L, WishlistTargetType.GAME, 0, 20) } returns listOf(item())
            every { port.countByMember(1L, WishlistTargetType.GAME) } returns 1L

            val result = service.execute(
                GetWishlistUseCase.Query(memberId = 1L, targetType = WishlistTargetType.GAME)
            )

            Then("그 타입만 나온다") {
                result.totalCount shouldBe 1L
                result.items.single().targetKey shouldBe "abyssal-crown"
            }
        }
    }

    Given("찜 키 목록 조회 (하이드레이션용)") {
        val port = mockk<WishlistRepositoryPort>()
        val service = WishlistService(port)

        When("타입의 키를 요청하면") {
            every { port.findKeysByMemberAndType(1L, WishlistTargetType.BLOG_POST) } returns
                listOf("post-a", "post-b")

            val result = service.execute(
                GetWishlistKeysUseCase.Query(memberId = 1L, targetType = WishlistTargetType.BLOG_POST)
            )

            Then("키만 내려온다") {
                result.keys shouldBe listOf("post-a", "post-b")
            }
        }
    }
})
