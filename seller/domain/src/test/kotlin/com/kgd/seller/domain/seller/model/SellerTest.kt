package com.kgd.seller.domain.seller.model

import com.kgd.seller.domain.seller.exception.InvalidSellerStateException
import com.kgd.seller.domain.seller.exception.SellerAlreadyExistsException
import com.kgd.seller.domain.seller.exception.SellerNotActiveException
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant

class SellerTest : BehaviorSpec({

    val t0 = Instant.parse("2026-09-24T00:00:00Z")

    fun seller(status: SellerStatus, id: Long = 10L, memberId: String = "7"): Seller = Seller.restore(
        id = id,
        memberId = memberId,
        businessName = "상호",
        businessRegistrationNo = "1234567890",
        representativeName = "대표",
        bankName = "은행",
        encryptedAccount = EncryptedAccount("cipher", 1),
        accountMasked = "******7890",
        shippingFee = 3000L,
        settlementCycle = SettlementCycle.WEEKLY,
        commissionRateBp = if (status == SellerStatus.PENDING || status == SellerStatus.REJECTED) null else 1000,
        status = status,
        rejectReason = if (status == SellerStatus.REJECTED) "서류 미비" else null,
        rejectedAt = if (status == SellerStatus.REJECTED) t0 else null,
        piiPurgedAt = null,
        appliedAt = t0,
        updatedAt = t0,
    )

    // 스펙 SR-2 판매자 전이표: PENDING → ACTIVE | REJECTED · ACTIVE ↔ SUSPENDED. 나머지는 전부 금지.
    val actions: Map<SellerStatus, (Seller) -> Unit> = mapOf(
        SellerStatus.ACTIVE to { s ->
            if (s.status == SellerStatus.SUSPENDED) s.reactivate(t0) else s.approve(1000, t0)
        },
        SellerStatus.REJECTED to { s -> s.reject("사유", t0) },
        SellerStatus.SUSPENDED to { s -> s.suspend("사유", t0) },
    )
    val allowed = setOf(
        SellerStatus.PENDING to SellerStatus.ACTIVE,
        SellerStatus.PENDING to SellerStatus.REJECTED,
        SellerStatus.ACTIVE to SellerStatus.SUSPENDED,
        SellerStatus.SUSPENDED to SellerStatus.ACTIVE,
    )

    given("판매자 상태 전이표") {
        SellerStatus.entries.forEach { from ->
            actions.forEach { (to, act) ->
                val ok = (from to to) in allowed
                then("$from → $to 는 ${if (ok) "허용" else "금지"}") {
                    val s = seller(from)
                    if (ok) {
                        shouldNotThrowAny { act(s) }
                        s.status shouldBe to
                    } else {
                        shouldThrow<InvalidSellerStateException> { act(s) }
                        s.status shouldBe from
                    }
                }
            }
        }
        then("승인 대기에서 재활성(reactivate)은 승인이 아니다 — 금지") {
            shouldThrow<InvalidSellerStateException> { seller(SellerStatus.PENDING).reactivate(t0) }
        }
        then("정지에서 approve 로 되살릴 수 없다 — 재활성 경로만") {
            shouldThrow<InvalidSellerStateException> { seller(SellerStatus.SUSPENDED).approve(1000, t0) }
        }
    }

    given("승인") {
        then("수수료율(bp)이 정해진다") {
            val s = seller(SellerStatus.PENDING)
            s.approve(1250, t0)
            s.commissionRateBp shouldBe 1250
        }
        then("수수료율은 0..10000 bp 밖이면 거부") {
            shouldThrow<BusinessException> { seller(SellerStatus.PENDING).approve(-1, t0) }
            shouldThrow<BusinessException> { seller(SellerStatus.PENDING).approve(10001, t0) }
        }
    }

    given("반려·정지 사유") {
        then("빈 사유는 거부") {
            shouldThrow<BusinessException> { seller(SellerStatus.PENDING).reject(" ", t0) }
            shouldThrow<BusinessException> { seller(SellerStatus.ACTIVE).suspend("", t0) }
        }
    }

    given("수수료율 변경") {
        then("ACTIVE·SUSPENDED 만 가능") {
            seller(SellerStatus.ACTIVE).apply { changeCommission(500, t0) }.commissionRateBp shouldBe 500
            seller(SellerStatus.SUSPENDED).apply { changeCommission(500, t0) }.commissionRateBp shouldBe 500
            shouldThrow<InvalidSellerStateException> { seller(SellerStatus.PENDING).changeCommission(500, t0) }
            shouldThrow<InvalidSellerStateException> { seller(SellerStatus.REJECTED).changeCommission(500, t0) }
        }
    }

    given("판매자 API 접근") {
        then("ACTIVE 만 통과, 정지·대기·반려는 거부") {
            shouldNotThrowAny { seller(SellerStatus.ACTIVE).ensureActive() }
            listOf(SellerStatus.SUSPENDED, SellerStatus.PENDING, SellerStatus.REJECTED).forEach {
                shouldThrow<SellerNotActiveException> { seller(it).ensureActive() }
            }
        }
    }

    given("1인 1판매자") {
        then("같은 회원의 ACTIVE·PENDING·SUSPENDED 행이 있으면 새 신청 불가 — 정지 회피 재신청 포함") {
            listOf(SellerStatus.ACTIVE, SellerStatus.PENDING, SellerStatus.SUSPENDED).forEach {
                shouldThrow<SellerAlreadyExistsException> { Seller.ensureMemberCanApply(listOf(seller(it))) }
            }
        }
        then("반려 이력만 있으면 재신청 가능 — 새 행으로 남는다") {
            shouldNotThrowAny {
                Seller.ensureMemberCanApply(listOf(seller(SellerStatus.REJECTED), seller(SellerStatus.REJECTED, id = 11)))
            }
            shouldNotThrowAny { Seller.ensureMemberCanApply(emptyList()) }
        }
    }

    given("반려 신청의 개인정보 파기") {
        val due = t0.plus(Duration.ofDays(30))
        then("반려 후 30일이 안 됐으면 파기하지 않는다") {
            val s = seller(SellerStatus.REJECTED)
            s.purgePersonalData(due.minusSeconds(1)) shouldBe false
            s.representativeName shouldBe "대표"
            (s.businessName == Seller.PURGED_BUSINESS_NAME) shouldBe false
        }
        then("30일이 지나면 상호·사업자번호·대표자·계좌를 지우고 이력(상태·회원·반려 사유)은 남긴다") {
            val s = seller(SellerStatus.REJECTED)
            s.purgePersonalData(due) shouldBe true
            // 개인사업자 상호는 개인 이름을 담는 일이 많아 개인정보로 본다
            s.businessName shouldBe Seller.PURGED_BUSINESS_NAME
            s.businessRegistrationNo.shouldBeNull()
            s.representativeName.shouldBeNull()
            s.bankName.shouldBeNull()
            s.encryptedAccount.shouldBeNull()
            s.accountMasked.shouldBeNull()
            s.piiPurgedAt shouldBe due
            s.status shouldBe SellerStatus.REJECTED
            s.memberId shouldBe "7"
            s.rejectReason.shouldNotBeNull()
        }
        then("반려가 아닌 행은 기한과 무관하게 파기 대상이 아니다") {
            val s = seller(SellerStatus.ACTIVE)
            s.purgePersonalData(due.plus(Duration.ofDays(365))) shouldBe false
            s.representativeName shouldBe "대표"
        }
        then("이미 파기된 행은 다시 파기하지 않는다") {
            val s = seller(SellerStatus.REJECTED)
            s.purgePersonalData(due) shouldBe true
            s.purgePersonalData(due.plusSeconds(10)) shouldBe false
            s.piiPurgedAt shouldBe due
        }
    }

    given("신청") {
        fun apply(brn: String = "123-45-67890", fee: Long = 3000L) = Seller.apply(
            memberId = "7",
            businessName = "상호",
            businessRegistrationNo = brn,
            representativeName = "대표",
            bankName = "은행",
            accountNumber = AccountNumber.of("110-123-456789"),
            encryptedAccount = EncryptedAccount("cipher", 1),
            shippingFee = fee,
            settlementCycle = SettlementCycle.MONTHLY,
            now = t0,
        )
        then("PENDING 으로 시작하고 수수료율은 아직 없다, 사업자번호는 숫자만 남긴다") {
            val s = apply()
            s.status shouldBe SellerStatus.PENDING
            s.commissionRateBp.shouldBeNull()
            s.businessRegistrationNo shouldBe "1234567890"
            s.accountMasked shouldBe "********6789"
        }
        then("사업자번호가 10자리가 아니거나 배송비가 음수면 거부") {
            shouldThrow<BusinessException> { apply(brn = "12345") }
            shouldThrow<BusinessException> { apply(fee = -1) }
        }
    }
})
