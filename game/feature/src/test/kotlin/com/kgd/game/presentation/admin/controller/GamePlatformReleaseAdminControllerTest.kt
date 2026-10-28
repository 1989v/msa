package com.kgd.game.presentation.admin.controller

import com.kgd.game.application.catalog.dto.GameDetailDto
import com.kgd.game.application.catalog.usecase.GetGameDetailAdminUseCase
import com.kgd.game.application.catalog.usecase.GetGamePlatformReleasesUseCase
import com.kgd.game.application.catalog.usecase.PutGamePlatformReleaseUseCase
import com.kgd.game.domain.catalog.model.GamePlatform
import com.kgd.game.domain.catalog.model.GamePlatformRelease
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.PlatformAudience
import com.kgd.game.domain.catalog.model.PlatformReleaseStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk

class GamePlatformReleaseAdminControllerTest : BehaviorSpec({
    given("admin visibility preview") {
        then("uses the parent game visibility for GET and PUT") {
            GameStatus.entries.forEach { status ->
                val release = GamePlatformRelease(1, GamePlatform.ROBLOX, "123", PlatformReleaseStatus.BETA, PlatformAudience.PUBLIC)
                val get = mockk<GetGamePlatformReleasesUseCase>()
                val put = mockk<PutGamePlatformReleaseUseCase>()
                val detail = mockk<GetGameDetailAdminUseCase>()
                every { get.execute("alpha") } returns listOf(release)
                every { put.execute(any()) } returns release
                every { detail.execute(GetGameDetailAdminUseCase.Query("alpha")) } returns mockk<GameDetailDto> { every { this@mockk.status } returns status }
                val controller = GamePlatformReleaseAdminController(get, put, detail)
                val visible = status in setOf(GameStatus.BETA, GameStatus.PUBLISHED)
                controller.get("alpha").data!!.single().visible shouldBe visible
                controller.put("alpha", GamePlatform.ROBLOX, PutGamePlatformReleaseRequest("123", PlatformReleaseStatus.BETA, PlatformAudience.PUBLIC)).data!!.visible shouldBe visible
            }
        }
    }
})
