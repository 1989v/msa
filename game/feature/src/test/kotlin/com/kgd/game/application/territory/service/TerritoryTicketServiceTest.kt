package com.kgd.game.application.territory.service

import com.kgd.game.application.profile.port.*
import com.kgd.game.application.profile.usecase.GamePlayerProfileUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import java.time.*

class TerritoryTicketServiceTest : BehaviorSpec({
    given("server-derived profile tickets") {
        then("expiry and replay are enforced without trusting client nicknames") {
            val profiles = mockk<GamePlayerProfileUseCase>()
            val profile = GamePlayerProfile("profile1", "서버 이름")
            every { profiles.get(any()) } returns profile
            var now = 0L
            val clock = object : Clock() {
                override fun getZone(): ZoneId = ZoneOffset.UTC
                override fun withZone(zone: ZoneId): Clock = this
                override fun instant(): Instant = Instant.ofEpochMilli(now)
            }
            val service = TerritoryTicketService(profiles, clock)
            val first = service.issue(GamePlayerOwner(memberId = 1))
            service.redeem(first.ticket) shouldBe profile; service.redeem(first.ticket) shouldBe null
            val second = service.issue(GamePlayerOwner(memberId = 1)); now = 30_000
            service.redeem(second.ticket) shouldBe null
        }
    }
})
