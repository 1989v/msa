package com.kgd.seller.application.seller.service

import com.kgd.seller.application.seller.port.SellerAdminActionRepositoryPort
import com.kgd.seller.application.seller.port.SellerEventPort
import com.kgd.seller.application.seller.port.SellerEventType
import com.kgd.seller.application.seller.port.SellerRepositoryPort
import com.kgd.seller.application.seller.usecase.ManageSellerUseCase
import com.kgd.seller.domain.seller.exception.InvalidSellerStateException
import com.kgd.seller.domain.seller.model.SellerAdminAction
import com.kgd.seller.domain.seller.model.SellerAdminActionType
import com.kgd.seller.domain.seller.model.SellerStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.Clock
import java.time.ZoneOffset

class SellerAdminServiceTest : BehaviorSpec({
    val sellers = mockk<SellerRepositoryPort>()
    val actions = mockk<SellerAdminActionRepositoryPort>(relaxed = true)
    val events = mockk<SellerEventPort>(relaxed = true)
    val service = SellerAdminService(sellers, actions, events, Clock.fixed(T0, ZoneOffset.UTC))

    beforeEach {
        clearMocks(sellers, actions, events)
        every { sellers.save(any()) } answers { firstArg() }
    }

    given("승인") {
        then("ACTIVE + 수수료율, 조치 이력(행위자·사유), seller.seller.approved 발행") {
            every { sellers.findById(10L) } returns sellerRow(SellerStatus.PENDING)
            val recorded = slot<SellerAdminAction>()
            every { actions.record(capture(recorded)) } returns Unit

            val view = service.approve(ManageSellerUseCase.Approve(10L, actorId = "1", commissionRateBp = 1200, reason = "서류 확인"))

            view.status shouldBe SellerStatus.ACTIVE
            view.commissionRateBp shouldBe 1200
            recorded.captured.action shouldBe SellerAdminActionType.APPROVE
            recorded.captured.actorId shouldBe "1"
            recorded.captured.reason shouldBe "서류 확인"
            recorded.captured.fromStatus shouldBe SellerStatus.PENDING
            recorded.captured.toStatus shouldBe SellerStatus.ACTIVE
            recorded.captured.createdAt shouldBe T0
            verify(exactly = 1) { events.publish(SellerEventType.APPROVED, match { it.id == 10L }) }
        }
        then("이미 ACTIVE 면 금지 전이 — 저장·이력·발행 없음") {
            every { sellers.findById(10L) } returns sellerRow(SellerStatus.ACTIVE)
            shouldThrow<InvalidSellerStateException> {
                service.approve(ManageSellerUseCase.Approve(10L, "1", 1200, null))
            }
            verify(exactly = 0) { sellers.save(any()) }
            verify(exactly = 0) { actions.record(any()) }
            verify(exactly = 0) { events.publish(any(), any()) }
        }
    }

    given("정지·재활성·수수료율") {
        then("정지는 suspended, 재활성은 reactivated, 수수료율 변경은 updated 를 발행하고 각각 이력을 남긴다") {
            every { sellers.findById(10L) } returns sellerRow(SellerStatus.ACTIVE)
            service.suspend(ManageSellerUseCase.Suspend(10L, "1", "약관 위반")).status shouldBe SellerStatus.SUSPENDED
            verify { events.publish(SellerEventType.SUSPENDED, any()) }

            every { sellers.findById(10L) } returns sellerRow(SellerStatus.SUSPENDED)
            service.reactivate(ManageSellerUseCase.Reactivate(10L, "1", null)).status shouldBe SellerStatus.ACTIVE
            verify { events.publish(SellerEventType.REACTIVATED, any()) }

            every { sellers.findById(10L) } returns sellerRow(SellerStatus.ACTIVE)
            service.changeCommission(ManageSellerUseCase.ChangeCommission(10L, "1", 800, "프로모션"))
                .commissionRateBp shouldBe 800
            verify { events.publish(SellerEventType.UPDATED, any()) }

            verify(exactly = 3) { actions.record(any()) }
        }
        then("반려는 이벤트 없이 이력만 남긴다") {
            every { sellers.findById(10L) } returns sellerRow(SellerStatus.PENDING)
            service.reject(ManageSellerUseCase.Reject(10L, "1", "서류 미비")).status shouldBe SellerStatus.REJECTED
            verify(exactly = 1) { actions.record(match { it.action == SellerAdminActionType.REJECT && it.reason == "서류 미비" }) }
            verify(exactly = 0) { events.publish(any(), any()) }
        }
    }
})
