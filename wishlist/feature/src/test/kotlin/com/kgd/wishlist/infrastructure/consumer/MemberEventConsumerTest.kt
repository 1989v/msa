package com.kgd.wishlist.infrastructure.consumer

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.wishlist.application.share.config.WishlistShareProperties
import com.kgd.wishlist.application.share.service.CollectionShareService
import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.support.FakeCollectionSharePort
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.transaction.annotation.Transactional
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

/**
 * 탈퇴 이벤트 — 찜과 함께 그 회원이 만든 공유 링크도 지워져, 이미 퍼진 토큰이 더는 열리지 않아야 한다.
 * 판정은 컨슈머가 지운 뒤 실제 공개 조회 서비스가 내는 결과다.
 */
class MemberEventConsumerTest : BehaviorSpec({

    val clock = Clock.fixed(Instant.parse("2026-10-09T00:00:00Z"), ZoneOffset.UTC)

    Given("공유 링크를 가진 회원 7 과 회원 8") {
        val port = FakeCollectionSharePort(
            mutableListOf(
                WishlistCollection.restore(5L, 7L, "제주 여행", LocalDateTime.now()),
                WishlistCollection.restore(6L, 8L, "부산 여행", LocalDateTime.now()),
            ),
        )
        val service = CollectionShareService(
            port, WishlistShareProperties(enabled = true), ShortLinkProperties(origin = "https://short.test"), clock,
        )
        val withdrawnToken = service.create(7L, 5L, 30).token
        val otherToken = service.create(8L, 6L, 30).token
        val wishlist = mockk<WishlistRepositoryPort>()
        every { wishlist.deleteAllByMemberId(any()) } returns Unit
        val consumer = MemberEventConsumer(wishlist, port, jacksonMapperBuilder().build())

        When("회원 7 의 member.withdrawn 을 받으면") {
            consumer.onMemberWithdrawn(ConsumerRecord("member.withdrawn", 0, 0L, "7", """{"memberId":7}"""))

            Then("찜을 지우고, 그 회원의 토큰은 공개 조회에서 NOT_FOUND 다") {
                verify(exactly = 1) { wishlist.deleteAllByMemberId(7L) }
                shouldThrow<BusinessException> { service.get(withdrawnToken) }.errorCode shouldBe ErrorCode.NOT_FOUND
            }
            Then("다른 회원의 링크는 그대로 열린다") {
                service.get(otherToken).name shouldBe "부산 여행"
            }
        }
    }

    Given("탈퇴 처리 메서드") {
        Then("찜 삭제와 공유 삭제가 wishlist TM 의 한 트랜잭션이다") {
            MemberEventConsumer::class.java.getMethod("onMemberWithdrawn", ConsumerRecord::class.java)
                .getAnnotation(Transactional::class.java).shouldNotBeNull()
            MemberEventConsumer::class.java.getAnnotation(Qualifier::class.java).value shouldBe
                "wishlistTransactionManager"
        }
    }
})
