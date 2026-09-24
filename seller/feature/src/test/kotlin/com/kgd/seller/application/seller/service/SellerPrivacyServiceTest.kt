package com.kgd.seller.application.seller.service

import com.kgd.seller.application.seller.port.SellerRepositoryPort
import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

class SellerPrivacyServiceTest : BehaviorSpec({

    given("반려 신청 개인정보 파기 스케줄") {
        val now = T0.plus(Duration.ofDays(30))
        val sellers = mockk<SellerRepositoryPort>()
        val cutoff = slot<Instant>()
        val service = SellerPrivacyService(sellers, Clock.fixed(now, ZoneOffset.UTC))
        val due = sellerRow(SellerStatus.REJECTED, id = 1, rejectedAt = T0)
        every { sellers.findRejectedUnpurgedBefore(capture(cutoff), any()) } returns listOf(due)
        val saved = mutableListOf<Seller>()
        every { sellers.save(capture(saved)) } answers { firstArg() }

        `when`("반려 후 정확히 30일이 된 시각에 돌면") {
            val purged = service.execute()
            then("기준 시각은 지금 − 30일이고, 그 행의 개인정보를 지워 저장한다") {
                cutoff.captured shouldBe T0
                purged shouldBe 1
                saved.single().representativeName.shouldBeNull()
                saved.single().encryptedAccount.shouldBeNull()
                saved.single().piiPurgedAt shouldBe now
            }
        }
    }

    given("저장소가 기한 전 행을 돌려주더라도") {
        val sellers = mockk<SellerRepositoryPort>()
        val service = SellerPrivacyService(sellers, Clock.fixed(T0.plus(Duration.ofDays(29)), ZoneOffset.UTC))
        every { sellers.findRejectedUnpurgedBefore(any(), any()) } returns listOf(sellerRow(SellerStatus.REJECTED, rejectedAt = T0))
        then("도메인 가드가 막아 지우지도 저장하지도 않는다") {
            service.execute() shouldBe 0
            verify(exactly = 0) { sellers.save(any()) }
        }
    }
})
