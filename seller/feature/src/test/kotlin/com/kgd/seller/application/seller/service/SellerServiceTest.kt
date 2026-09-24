package com.kgd.seller.application.seller.service

import com.kgd.seller.application.seller.port.AccountCipherPort
import com.kgd.seller.application.seller.port.SellerEventPort
import com.kgd.seller.application.seller.port.SellerEventType
import com.kgd.seller.application.seller.port.SellerRepositoryPort
import com.kgd.seller.application.seller.usecase.ApplySellerUseCase
import com.kgd.seller.domain.seller.exception.SellerAlreadyExistsException
import com.kgd.seller.domain.seller.exception.SellerNotActiveException
import com.kgd.seller.domain.seller.model.AccountNumber
import com.kgd.seller.domain.seller.model.EncryptedAccount
import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerStatus
import com.kgd.seller.domain.seller.model.SettlementCycle
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

class SellerServiceTest : BehaviorSpec({
    val sellers = mockk<SellerRepositoryPort>()
    val events = mockk<SellerEventPort>(relaxed = true)
    val cipher = mockk<AccountCipherPort>()
    val service = SellerService(sellers, events, cipher, Clock.fixed(T0, ZoneOffset.UTC))

    val command = ApplySellerUseCase.Command(
        memberId = "7",
        businessName = "상호",
        businessRegistrationNo = "123-45-67890",
        representativeName = "대표",
        bankName = "은행",
        accountNumber = "110-123-456789",
        shippingFee = 3000L,
        settlementCycle = SettlementCycle.MONTHLY,
    )

    beforeEach {
        clearMocks(sellers, events, cipher)
        every { cipher.encrypt(any()) } returns EncryptedAccount("sealed", 1)
    }

    given("입점 신청") {
        `when`("같은 회원에게 ACTIVE·PENDING·SUSPENDED 행이 있으면") {
            then("거부하고 저장·발행하지 않는다 — 정지된 판매자도 새로 신청할 수 없다") {
                listOf(SellerStatus.ACTIVE, SellerStatus.PENDING, SellerStatus.SUSPENDED).forEach { status ->
                    every { sellers.findAllByMemberId("7") } returns listOf(sellerRow(status))
                    shouldThrow<SellerAlreadyExistsException> { service.execute(command) }
                }
                verify(exactly = 0) { sellers.create(any()) }
                verify(exactly = 0) { events.publish(any(), any()) }
            }
        }
        `when`("반려 이력만 있으면") {
            then("새 행으로 PENDING 신청이 저장되고 계좌는 암호문·마스킹 값만 넘어간다, applied 발행") {
                every { sellers.findAllByMemberId("7") } returns listOf(sellerRow(SellerStatus.REJECTED))
                val saved = slot<Seller>()
                every { sellers.create(capture(saved)) } answers {
                    val s = saved.captured
                    Seller.restore(
                        20L, s.memberId, s.businessName, s.businessRegistrationNo, s.representativeName, s.bankName,
                        s.encryptedAccount, s.accountMasked, s.shippingFee, s.settlementCycle, s.commissionRateBp,
                        s.status, s.rejectReason, s.rejectedAt, s.piiPurgedAt, s.appliedAt, s.updatedAt,
                    )
                }

                val view = service.execute(command)

                view.id shouldBe 20L
                view.status shouldBe SellerStatus.PENDING
                view.accountMasked shouldBe "********6789"
                saved.captured.encryptedAccount shouldBe EncryptedAccount("sealed", 1)
                saved.captured.appliedAt shouldBe T0
                verify { cipher.encrypt(match<AccountNumber> { it.value == "110123456789" }) }
                verify(exactly = 1) { events.publish(SellerEventType.APPLIED, any()) }
            }
        }
    }

    given("판매자 포털 /seller/me") {
        then("ACTIVE 행이면 돌려준다") {
            every { sellers.findAllByMemberId("7") } returns
                listOf(sellerRow(SellerStatus.REJECTED, id = 1), sellerRow(SellerStatus.ACTIVE, id = 2))
            service.execute("7").id shouldBe 2L
        }
        then("정지·대기 행이거나 행이 없으면 거부") {
            listOf(SellerStatus.SUSPENDED, SellerStatus.PENDING).forEach {
                every { sellers.findAllByMemberId("7") } returns listOf(sellerRow(it))
                shouldThrow<SellerNotActiveException> { service.execute("7") }
            }
            every { sellers.findAllByMemberId("7") } returns listOf(sellerRow(SellerStatus.REJECTED))
            shouldThrow<SellerNotActiveException> { service.execute("7") }
        }
    }
})
