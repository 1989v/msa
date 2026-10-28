package com.kgd.game.domain.catalog.model

import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class GamePlatformReleaseTest : BehaviorSpec({
    given("Roblox Place ID normalization") {
        then("preserves large identifiers as strings and strips only the game slug") {
            RobloxPlaceId.normalize(" 12345678901234567890 ") shouldBe "12345678901234567890"
            RobloxPlaceId.normalize("https://www.roblox.com/games/123/My-Game") shouldBe "123"
            RobloxPlaceId.normalize("https://roblox.com/games/123/") shouldBe "123"
            RobloxPlaceId.normalize(" ") shouldBe null
        }
        then("rejects tracking, credentials, non-game pages and misleading hosts") {
            listOf("0", "01", "-1", "1e4", "http://www.roblox.com/games/123",
                "https://www.roblox.com.evil.test/games/123", "https://evil.test@games.roblox.com/games/123",
                "https://user@www.roblox.com/games/123", "https://www.roblox.com:443/games/123",
                "https://www.roblox.com/games/123?token=secret", "https://www.roblox.com/games/123#secret",
                "https://www.roblox.com/share?code=secret", "https://create.roblox.com/dashboard/creations",
                "https://www.roblox.com/games/%31%32%33").forEach { input ->
                shouldThrow<BusinessException> { RobloxPlaceId.normalize(input) }
            }
        }
    }
    given("platform release publication") {
        then("requires both public audience and a launched state") {
            PlatformReleaseStatus.entries.forEach { status ->
                PlatformAudience.entries.forEach { audience ->
                    val release = GamePlatformRelease(1, GamePlatform.ROBLOX, "123", status, audience)
                    release.isPublic() shouldBe (audience == PlatformAudience.PUBLIC && status in
                        setOf(PlatformReleaseStatus.BETA, PlatformReleaseStatus.RELEASED))
                    release.canonicalUrl() shouldBe "https://www.roblox.com/games/123"
                }
            }
        }
        then("allows clearing a draft but refuses launched releases without an ID") {
            GamePlatformRelease(1, GamePlatform.ROBLOX, null, PlatformReleaseStatus.DRAFT, PlatformAudience.INVITE_ONLY).isPublic() shouldBe false
            listOf(PlatformReleaseStatus.BETA, PlatformReleaseStatus.RELEASED).forEach {
                shouldThrow<BusinessException> { GamePlatformRelease(1, GamePlatform.ROBLOX, null, it, PlatformAudience.PUBLIC) }
            }
        }
    }
})
