package com.kgd.game.presentation.access

import com.kgd.common.security.JwtProperties
import com.kgd.common.security.JwtUtil
import com.kgd.game.application.access.usecase.CheckPrivateGameAccessUseCase
import com.kgd.game.presentation.access.controller.PrivateGameGateController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest

/**
 * 관문이 **실제로 무는지**를 잰다.
 *
 * 이 검사가 없으면 「막았다」가 주장으로만 남는다 — 그리고 이 관문은 한 번 새면
 * 게임 파일 전부가 새는 자리다. 그래서 통과뿐 아니라 **막히는 쪽을 먼저** 본다.
 *
 * 토큰은 같은 <see cref="JwtUtil"/> 로 실제로 만들어 쓴다. 문자열을 손으로 지어내면
 * 서명 검증을 지워도 초록불이 난다 — 검사가 대상이 아니라 자기 자신을 재게 된다.
 */
class PrivateGameGateControllerTest : BehaviorSpec({

    val props = JwtProperties(
        secret = "gate-test-secret-key-that-is-long-enough-for-hs256-abcdefgh",
    )
    val jwt = JwtUtil(props)

    fun request(vararg cookies: Cookie): HttpServletRequest = mockk {
        every { getCookies() } returns (if (cookies.isEmpty()) null else arrayOf(*cookies))
    }

    fun controller(allowed: Boolean): PrivateGameGateController {
        val check = mockk<CheckPrivateGameAccessUseCase> {
            every { execute(any(), any()) } returns allowed
        }
        return PrivateGameGateController(check, jwt)
    }

    Given("비밀 게임 관문") {

        When("쿠키가 아예 없으면") {
            val res = controller(allowed = true).allow("deep-night", request())
            Then("401 — 로그인부터 하라는 뜻이다") {
                res.statusCode.value() shouldBe 401
            }
        }

        When("쿠키가 있으나 우리가 발급한 토큰이 아니면") {
            val fake = Cookie(PrivateGameGateController.ACCESS_TOKEN_COOKIE, "not-a-real-token")
            val res = controller(allowed = true).allow("deep-night", request(fake))
            Then("401 — 서명이 안 맞으면 신원이 없는 것과 같다") {
                res.statusCode.value() shouldBe 401
            }
        }

        When("로그인은 했지만 허용 명단에 없으면") {
            val token = jwt.generateAccessToken("77", listOf("ROLE_USER"))
            val cookie = Cookie(PrivateGameGateController.ACCESS_TOKEN_COOKIE, token)
            val res = controller(allowed = false).allow("deep-night", request(cookie))
            Then("403 — 주소를 알아도 파일을 못 받는다") {
                res.statusCode.value() shouldBe 403
            }
        }

        When("허용 명단에 있으면") {
            val token = jwt.generateAccessToken("42", listOf("ROLE_USER"))
            val cookie = Cookie(PrivateGameGateController.ACCESS_TOKEN_COOKIE, token)
            val res = controller(allowed = true).allow("deep-night", request(cookie))
            Then("204 — nginx 가 이걸 보고 파일을 내준다") {
                res.statusCode.value() shouldBe 204
            }
        }

        When("토큰의 주체가 숫자가 아니면") {
            val token = jwt.generateAccessToken("guest", listOf("ROLE_USER"))
            val cookie = Cookie(PrivateGameGateController.ACCESS_TOKEN_COOKIE, token)
            val res = controller(allowed = true).allow("deep-night", request(cookie))
            Then("401 — 회원 번호로 판정하므로 게스트는 통과할 수 없다") {
                res.statusCode.value() shouldBe 401
            }
        }
    }
})
