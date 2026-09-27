package com.kgd.game.presentation.profile.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.profile.port.GamePlayerOwner
import com.kgd.game.application.profile.port.GamePlayerProfile
import com.kgd.game.application.profile.usecase.GamePlayerProfileUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.springframework.mock.env.MockEnvironment
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import jakarta.servlet.http.Cookie

class GamePlayerProfileControllerTest : BehaviorSpec({
    val resolver = GamePlayerIdentityResolver()
    given("guest profile cookie") {
        then("first successful PUT issues a host-only secure HttpOnly cookie and passes only its hash") {
            val profiles = mockk<GamePlayerProfileUseCase>()
            val owner = slot<GamePlayerOwner>()
            every { profiles.save(capture(owner), "별명") } returns GamePlayerProfile("player-one", "별명")
            val controller = GamePlayerProfileController(profiles, resolver, MockEnvironment())
            val request = MockHttpServletRequest().apply { serverName = "game.1989v.com" }
            val response = MockHttpServletResponse()
            controller.save(null, GameNicknameRequest("별명"), request, response)
            response.getHeader("Cache-Control") shouldBe "no-store"
            val cookie = response.getHeader("Set-Cookie")!!
            cookie.contains("HttpOnly") shouldBe true
            cookie.contains("Secure") shouldBe true
            cookie.contains("SameSite=Lax") shouldBe true
            cookie.contains("Path=/api/v1/games") shouldBe true
            cookie.contains("Domain=") shouldBe false
            owner.captured.guestTokenHash!!.length shouldBe 64
            val raw = cookie.substringAfter("=").substringBefore(";")
            raw.length shouldBe 43
            resolver.owner(null, raw) shouldBe owner.captured
        }
        then("HTTP localhost works with the shared kubernetes development profile") {
            val profiles = mockk<GamePlayerProfileUseCase>()
            every { profiles.save(any(), any()) } returns GamePlayerProfile("player-one", "별명")
            val response = MockHttpServletResponse()
            GamePlayerProfileController(profiles, resolver, MockEnvironment().withProperty("spring.profiles.active", "kubernetes"))
                .save(null, GameNicknameRequest("별명"), MockHttpServletRequest(), response)
            response.getHeader("Set-Cookie")!!.contains("Secure") shouldBe false
        }
        then("ingress HTTPS keeps the cookie secure through an internal HTTP gateway hop") {
            val profiles = mockk<GamePlayerProfileUseCase>()
            every { profiles.save(any(), any()) } returns GamePlayerProfile("player-one", "별명")
            val environment = MockEnvironment().apply { setActiveProfiles("kubernetes") }
            val controller = GamePlayerProfileController(profiles, resolver, environment)
            for (forwarded in listOf("https", "https, http")) {
                val request = MockHttpServletRequest().apply {
                    serverName = "content"
                    isSecure = false
                    addHeader("X-Forwarded-Proto", forwarded)
                }
                val response = MockHttpServletResponse()
                controller.save(null, GameNicknameRequest("별명"), request, response)
                response.getHeader("Set-Cookie")!!.contains("Secure") shouldBe true
            }
        }
        then("profile GET is never cached, including an unset profile") {
            val profiles = mockk<GamePlayerProfileUseCase>()
            val controller = GamePlayerProfileController(profiles, resolver, MockEnvironment())
            for (profile in listOf(null, GamePlayerProfile("player-one", "별명"))) {
                every { profiles.get(any()) } returns profile
                val response = MockHttpServletResponse()
                controller.get("7", MockHttpServletRequest(), response).data shouldBe profile
                response.getHeader("Cache-Control") shouldBe "no-store"
            }
        }
        then("failed PUT never issues a cookie") {
            val profiles = mockk<GamePlayerProfileUseCase>()
            every { profiles.save(any(), any()) } throws BusinessException(ErrorCode.DUPLICATE_RESOURCE)
            val response = MockHttpServletResponse()
            shouldThrow<BusinessException> {
                GamePlayerProfileController(profiles, resolver, MockEnvironment()).save(null, GameNicknameRequest("별명"), MockHttpServletRequest(), response)
            }
            response.getHeader("Set-Cookie") shouldBe null
            response.getHeader("Cache-Control") shouldBe "no-store"
        }
        then("member header cannot silently become guest") {
            shouldThrow<BusinessException> { resolver.owner("invalid", resolver.issueToken()) }.errorCode shouldBe ErrorCode.UNAUTHORIZED
            shouldThrow<BusinessException> { resolver.owner("0", resolver.issueToken()) }.errorCode shouldBe ErrorCode.UNAUTHORIZED
        }
        then("valid cookie is reused and raw credential is not the storage key") {
            val raw = resolver.issueToken()
            val request = MockHttpServletRequest().apply { setCookies(Cookie(GamePlayerIdentityResolver.COOKIE_NAME, raw)) }
            resolver.token(request) shouldBe raw
            (resolver.owner(null, raw).guestTokenHash == raw) shouldBe false
        }
    }
})
