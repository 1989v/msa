package com.kgd.game.presentation.access

import com.kgd.common.security.JwtProperties
import com.kgd.common.security.JwtUtil
import com.kgd.game.application.access.port.PrivateGameAccessRepositoryPort
import com.kgd.game.application.access.service.PrivateGameAccessService
import com.kgd.game.application.access.usecase.CheckPrivateGameAccessUseCase.Verdict
import com.kgd.game.infrastructure.security.adapter.JwtTokenIdentityAdapter
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
 * **토큰 해석기를 흉내 내지 않는다** — 실제 [JwtTokenIdentityAdapter] 를 끼우고 토큰도
 * 같은 [JwtUtil] 로 발급한다. 흉내 낸 해석기를 쓰면 서명 검증을 지워도 초록불이 나서,
 * 검사가 대상이 아니라 자기 자신을 재게 된다.
 */
class PrivateGameGateControllerTest : BehaviorSpec({

    val jwt = JwtUtil(JwtProperties(secret = "gate-test-secret-key-that-is-long-enough-for-hs256-abcdefgh"))

    fun request(vararg cookies: Cookie): HttpServletRequest = mockk {
        every { getCookies() } returns (if (cookies.isEmpty()) null else arrayOf(*cookies))
    }

    fun cookie(token: String) = Cookie(PrivateGameGateController.ACCESS_TOKEN_COOKIE, token)

    fun controller(allowed: Boolean): PrivateGameGateController {
        val repo = mockk<PrivateGameAccessRepositoryPort> {
            every { exists(any(), any()) } returns allowed
        }
        return PrivateGameGateController(
            PrivateGameAccessService(repo, JwtTokenIdentityAdapter(jwt)),
        )
    }

    Given("비밀 게임 관문") {

        When("쿠키가 아예 없으면") {
            val res = controller(allowed = true).allow("deep-night", request())
            Then("401 — 로그인부터 하라는 뜻이다") {
                res.statusCode.value() shouldBe 401
            }
        }

        When("쿠키가 있으나 우리가 발급한 토큰이 아니면") {
            val res = controller(allowed = true).allow("deep-night", request(cookie("not-a-real-token")))
            Then("401 — 서명이 안 맞으면 신원이 없는 것과 같다") {
                res.statusCode.value() shouldBe 401
            }
        }

        When("로그인은 했지만 허용 명단에 없으면") {
            val token = jwt.generateAccessToken("77", listOf("ROLE_USER"))
            val res = controller(allowed = false).allow("deep-night", request(cookie(token)))
            Then("403 — 주소를 알아도 파일을 못 받는다") {
                res.statusCode.value() shouldBe 403
            }
        }

        When("허용 명단에 있으면") {
            val token = jwt.generateAccessToken("42", listOf("ROLE_USER"))
            val res = controller(allowed = true).allow("deep-night", request(cookie(token)))
            Then("204 — nginx 가 이걸 보고 파일을 내준다") {
                res.statusCode.value() shouldBe 204
            }
        }

        When("토큰의 주체가 숫자가 아니면") {
            val token = jwt.generateAccessToken("guest", listOf("ROLE_USER"))
            val res = controller(allowed = true).allow("deep-night", request(cookie(token)))
            Then("401 — 회원 번호로 판정하므로 게스트는 통과할 수 없다") {
                res.statusCode.value() shouldBe 401
            }
        }
    }

    Given("판정 자체") {
        val service = PrivateGameAccessService(
            mockk { every { exists(any(), any()) } returns false },
            JwtTokenIdentityAdapter(jwt),
        )

        When("로그인 안 한 사람과 거절당한 사람을") {
            val none = service.execute("deep-night", null)
            val denied = service.execute("deep-night", jwt.generateAccessToken("9", listOf("ROLE_USER")))
            Then("갈라서 돌려준다 — 합치면 로그인 화면으로 보낼지 정할 수 없다") {
                none shouldBe Verdict.NO_TOKEN
                denied shouldBe Verdict.DENIED
            }
        }
    }
})
