package com.kgd.wishlist.domain.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

class WishlistItemTest : BehaviorSpec({
    Given("찜 항목 생성") {
        When("유효한 정보로 생성하면") {
            val item = WishlistItem.create(memberId = 1L, targetType = WishlistTargetType.GAME, targetKey = "abyssal-crown")
            Then("항목이 생성된다") {
                item.memberId shouldBe 1L
                item.targetType shouldBe WishlistTargetType.GAME
                item.targetKey shouldBe "abyssal-crown"
                item.id shouldBe null
                item.createdAt shouldNotBe null
            }
        }

        When("숫자 id 대상(상품·관광지)이면") {
            val item = WishlistItem.create(memberId = 1L, targetType = WishlistTargetType.PRODUCT, targetKey = "100")
            Then("문자열 키로 담긴다") {
                item.targetType shouldBe WishlistTargetType.PRODUCT
                item.targetKey shouldBe "100"
            }
        }

        When("회원 ID가 0이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    WishlistItem.create(memberId = 0L, targetType = WishlistTargetType.GAME, targetKey = "slug")
                }
            }
        }

        When("회원 ID가 음수이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    WishlistItem.create(memberId = -1L, targetType = WishlistTargetType.GAME, targetKey = "slug")
                }
            }
        }

        When("대상 키가 공백이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    WishlistItem.create(memberId = 1L, targetType = WishlistTargetType.BLOG_POST, targetKey = "  ")
                }
            }
        }

        When("대상 키가 120자를 넘으면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    WishlistItem.create(
                        memberId = 1L,
                        targetType = WishlistTargetType.BLOG_POST,
                        targetKey = "k".repeat(WishlistItem.MAX_TARGET_KEY_LENGTH + 1),
                    )
                }
            }
        }
    }
})
