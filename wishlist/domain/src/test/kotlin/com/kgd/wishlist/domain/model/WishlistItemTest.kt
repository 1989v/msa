package com.kgd.wishlist.domain.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

class WishlistItemTest : BehaviorSpec({
    Given("위시리스트 항목 생성") {
        When("유효한 정보로 생성하면") {
            val item = WishlistItem.create(memberId = 1L, productId = 100L)
            Then("항목이 생성된다") {
                item.memberId shouldBe 1L
                item.productId shouldBe 100L
                item.id shouldBe null
                item.createdAt shouldNotBe null
            }
        }

        When("회원 ID가 0이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    WishlistItem.create(memberId = 0L, productId = 100L)
                }
            }
        }

        When("회원 ID가 음수이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    WishlistItem.create(memberId = -1L, productId = 100L)
                }
            }
        }

        When("상품 ID가 0이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    WishlistItem.create(memberId = 1L, productId = 0L)
                }
            }
        }

        When("상품 ID가 음수이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    WishlistItem.create(memberId = 1L, productId = -1L)
                }
            }
        }
    }
})
