package com.kgd.wishlist.application.wishlist.service

import com.kgd.common.exception.BusinessException
import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

/**
 * 찜 묶음 (ADR-0080).
 *
 * 여기서 지키는 것은 **소유 경계**다. 묶음 id 가 URL 로 들어오므로, 검증이 없으면 남의
 * 묶음 이름을 바꾸거나 거기에 자기 찜을 밀어넣을 수 있다.
 */
class WishlistCollectionTest : BehaviorSpec({

    fun collection(id: Long = 5L, memberId: Long = 1L, name: String = "제주 여행") =
        WishlistCollection.restore(id, memberId, name, LocalDateTime.now())

    fun item(collectionId: Long? = null) = WishlistItem.restore(
        id = 10L,
        memberId = 1L,
        collectionId = collectionId,
        targetType = WishlistTargetType.ATTRACTION,
        targetKey = "12345",
        createdAt = LocalDateTime.now(),
    )

    Given("남의 묶음 id 로 접근하면") {
        val port = mockk<WishlistRepositoryPort>()
        val service = WishlistService(port)
        // 소유자가 아니라 조회가 비어 돌아온다
        every { port.findCollection(5L, 1L) } returns null

        When("이름을 바꾸려 하면") {
            Then("찾을 수 없다고 막는다") {
                shouldThrow<BusinessException> { service.rename(1L, 5L, "훔친 이름") }
            }
        }

        When("거기로 찜을 옮기려 하면") {
            Then("대상 찜을 조회하기도 전에 막는다") {
                shouldThrow<BusinessException> {
                    service.move(1L, WishlistTargetType.ATTRACTION, "12345", 5L)
                }
                verify(exactly = 0) { port.findByMemberAndTarget(any(), any(), any()) }
            }
        }
    }

    Given("내 묶음으로 찜을 옮기면") {
        val port = mockk<WishlistRepositoryPort>(relaxed = true)
        val service = WishlistService(port)
        every { port.findCollection(5L, 1L) } returns collection()
        every { port.findByMemberAndTarget(1L, WishlistTargetType.ATTRACTION, "12345") } returns item()

        When("이동을 실행하면") {
            service.move(1L, WishlistTargetType.ATTRACTION, "12345", 5L)

            Then("그 항목의 소속만 바뀐다") {
                val saved = slot<WishlistItem>()
                verify { port.save(capture(saved)) }
                saved.captured.collectionId shouldBe 5L
                // 찜 자체(대상)는 그대로 — 이동이지 재생성이 아니다
                saved.captured.targetKey shouldBe "12345"
            }
        }
    }

    Given("묶음에서 빼면") {
        val port = mockk<WishlistRepositoryPort>(relaxed = true)
        val service = WishlistService(port)
        every { port.findByMemberAndTarget(1L, WishlistTargetType.ATTRACTION, "12345") } returns item(collectionId = 5L)

        When("collectionId 를 null 로 옮기면") {
            service.move(1L, WishlistTargetType.ATTRACTION, "12345", null)

            Then("미분류가 되고 찜은 남는다") {
                val saved = slot<WishlistItem>()
                verify { port.save(capture(saved)) }
                saved.captured.collectionId shouldBe null
            }
            Then("소유 검증을 하지 않는다 — 빼기는 남의 묶음을 건드리지 않는다") {
                verify(exactly = 0) { port.findCollection(any(), any()) }
            }
        }
    }

    Given("찜하지 않은 대상을 옮기려 하면") {
        val port = mockk<WishlistRepositoryPort>(relaxed = true)
        val service = WishlistService(port)
        every { port.findByMemberAndTarget(any(), any(), any()) } returns null

        When("이동을 시도하면") {
            Then("막는다 — 없는 것을 묶을 수는 없다") {
                shouldThrow<BusinessException> {
                    service.move(1L, WishlistTargetType.ATTRACTION, "99999", null)
                }
            }
        }
    }

    Given("묶음 목록을 조회하면") {
        val port = mockk<WishlistRepositoryPort>()
        val service = WishlistService(port)
        every { port.findCollections(1L) } returns listOf(collection(5L), collection(6L, name = "부산"))
        every { port.countByCollection(1L) } returns mapOf(5L to 8L)

        When("항목 수를 함께 받으면") {
            val result = service.list(1L)

            Then("담긴 수가 붙고, 빈 묶음은 0 이다") {
                result.map { it.name to it.itemCount } shouldBe listOf("제주 여행" to 8L, "부산" to 0L)
            }
        }
    }
})
