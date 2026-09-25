package com.kgd.gateway.filter

import com.kgd.common.security.JwtProperties
import com.kgd.common.security.JwtUtil
import com.kgd.common.security.TokenKeys
import com.kgd.gateway.security.JwtTokenValidator
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.http.HttpCookie
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import reactor.test.StepVerifier

class AuthenticationGatewayFilterTest : BehaviorSpec({

    val jwtProps = JwtProperties(
        secret = "test-secret-key-must-be-at-least-32-chars-long!!",
        accessExpiry = 1800L
    )
    val jwtUtil = JwtUtil(jwtProps)
    val jwtTokenValidator = JwtTokenValidator(jwtUtil)
    val redisTemplate = mockk<ReactiveRedisTemplate<String, Any>>()
    val filter = AuthenticationGatewayFilter(jwtTokenValidator, redisTemplate, "1989v.com,localhost,127.0.0.1")
    val chain = mockk<GatewayFilterChain>()

    beforeEach {
        every { chain.filter(any()) } returns Mono.empty()
        every { redisTemplate.hasKey(any<String>()) } returns Mono.just(false)
    }

    given("인증 필터 적용 시") {
        `when`("Authorization 헤더가 없으면") {
            then("401 Unauthorized를 반환해야 한다") {
                val request = MockServerHttpRequest.get("/api/products/1").build()
                val exchange = MockServerWebExchange.from(request)

                val gatewayFilter = filter.apply(AuthenticationGatewayFilter.Config())
                StepVerifier.create(gatewayFilter.filter(exchange, chain))
                    .verifyComplete()

                exchange.response.statusCode shouldBe HttpStatus.UNAUTHORIZED
            }
        }

        `when`("유효한 JWT Bearer 토큰이 있으면") {
            then("X-User-Id 및 X-User-Roles 헤더를 추가하고 체인을 진행해야 한다") {
                val userId = "user-1"
                val roles = "USER"
                val token = jwtUtil.generateAccessToken(userId, listOf("USER"))

                val exchangeSlot = slot<ServerWebExchange>()
                every { chain.filter(capture(exchangeSlot)) } returns Mono.empty()
                every { redisTemplate.hasKey(TokenKeys.blacklist(token)) } returns Mono.just(false)

                val request = MockServerHttpRequest.get("/api/products/1")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
                    .build()
                val exchange = MockServerWebExchange.from(request)

                val gatewayFilter = filter.apply(AuthenticationGatewayFilter.Config())
                StepVerifier.create(gatewayFilter.filter(exchange, chain))
                    .verifyComplete()

                // 체인이 호출되어야 함 (401이 아닌 경우)
                exchange.response.statusCode shouldBe null // 응답이 설정되지 않음 = 성공적으로 체인 전달
                exchangeSlot.captured.request.headers["X-User-Id"] shouldBe listOf(userId)
                exchangeSlot.captured.request.headers["X-User-Roles"] shouldBe listOf(roles)
            }
        }

        `when`("잘못된 토큰이 있으면") {
            then("401 Unauthorized를 반환해야 한다") {
                val request = MockServerHttpRequest.get("/api/products/1")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token")
                    .build()
                val exchange = MockServerWebExchange.from(request)

                val gatewayFilter = filter.apply(AuthenticationGatewayFilter.Config())
                StepVerifier.create(gatewayFilter.filter(exchange, chain))
                    .verifyComplete()

                exchange.response.statusCode shouldBe HttpStatus.UNAUTHORIZED
            }
        }

        `when`("블랙리스트에 등록된 토큰이 있으면") {
            then("401 Unauthorized를 반환해야 한다") {
                val validToken = jwtUtil.generateAccessToken("user-1", listOf("USER"))

                every { redisTemplate.hasKey(TokenKeys.blacklist(validToken)) } returns Mono.just(true)

                val request = MockServerHttpRequest.get("/api/products/1")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer $validToken")
                    .build()
                val exchange = MockServerWebExchange.from(request)

                val gatewayFilter = filter.apply(AuthenticationGatewayFilter.Config())
                StepVerifier.create(gatewayFilter.filter(exchange, chain))
                    .verifyComplete()

                exchange.response.statusCode shouldBe HttpStatus.UNAUTHORIZED
            }
        }

        `when`("게스트 허용 라우트(required=false)에 클라이언트가 신원 헤더를 위조해 보내면") {
            then("X-User-Id / X-User-Roles 를 벗겨내고 익명으로 통과시켜야 한다") {
                val exchangeSlot = slot<ServerWebExchange>()
                every { chain.filter(capture(exchangeSlot)) } returns Mono.empty()

                val request = MockServerHttpRequest.get("/api/v1/games/snake/sessions")
                    .header("X-User-Id", "999")
                    .header("X-User-Roles", "ROLE_ADMIN")
                    .build()
                val exchange = MockServerWebExchange.from(request)

                val gatewayFilter = filter.apply(AuthenticationGatewayFilter.Config(required = false))
                StepVerifier.create(gatewayFilter.filter(exchange, chain))
                    .verifyComplete()

                exchange.response.statusCode shouldBe null
                exchangeSlot.captured.request.headers["X-User-Id"] shouldBe null
                exchangeSlot.captured.request.headers["X-User-Roles"] shouldBe null
            }
        }

        `when`("인증 필수 라우트에 토큰 없이 신원 헤더만 위조해 보내면") {
            then("헤더는 무시되고 401 이어야 한다") {
                val request = MockServerHttpRequest.get("/api/members/stats/count")
                    .header("X-User-Id", "999")
                    .header("X-User-Roles", "ROLE_ADMIN")
                    .build()
                val exchange = MockServerWebExchange.from(request)

                val gatewayFilter = filter.apply(
                    AuthenticationGatewayFilter.Config(requiredRoles = listOf("ROLE_ADMIN"))
                )
                StepVerifier.create(gatewayFilter.filter(exchange, chain))
                    .verifyComplete()

                exchange.response.statusCode shouldBe HttpStatus.UNAUTHORIZED
            }
        }

        `when`("Redis가 예외를 던지면 (Fail-Open)") {
            then("요청을 허용하고 체인을 진행해야 한다") {
                val token = jwtUtil.generateAccessToken("user-1", listOf("USER"))
                every { redisTemplate.hasKey(any<String>()) } returns Mono.error(RuntimeException("Redis connection failed"))
                val exchangeSlot = slot<ServerWebExchange>()
                every { chain.filter(capture(exchangeSlot)) } returns Mono.empty()

                val request = MockServerHttpRequest.get("/api/products/1")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
                    .build()
                val exchange = MockServerWebExchange.from(request)

                val gatewayFilter = filter.apply(AuthenticationGatewayFilter.Config())
                StepVerifier.create(gatewayFilter.filter(exchange, chain))
                    .verifyComplete()

                exchange.response.statusCode shouldBe null // not 401 — chain proceeded
            }
        }
    }

    given("HttpOnly 쿠키로 인증할 때 (ADR-0101)") {
        fun cookieReq(method: HttpMethod, origin: String?, referer: String? = null): MockServerHttpRequest {
            val token = jwtUtil.generateAccessToken("user-7", listOf("USER"))
            val b = MockServerHttpRequest.method(method, "/api/wishlist")
                .cookie(HttpCookie(AuthenticationGatewayFilter.ACCESS_COOKIE, token))
            if (origin != null) b.header(HttpHeaders.ORIGIN, origin)
            if (referer != null) b.header(HttpHeaders.REFERER, referer)
            return b.build()
        }
        fun run(req: MockServerHttpRequest, required: Boolean = true): Pair<MockServerWebExchange, ServerWebExchange?> {
            val captured = slot<ServerWebExchange>()
            every { chain.filter(capture(captured)) } returns Mono.empty()
            val exchange = MockServerWebExchange.from(req)
            StepVerifier.create(filter.apply(AuthenticationGatewayFilter.Config(required = required)).filter(exchange, chain)).verifyComplete()
            return exchange to (if (captured.isCaptured) captured.captured else null)
        }

        then("헤더가 없어도 쿠키의 토큰으로 인증한다") {
            val (exchange, passed) = run(cookieReq(HttpMethod.GET, null))
            exchange.response.statusCode shouldBe null
            passed!!.request.headers["X-User-Id"] shouldBe listOf("user-7")
        }
        then("우리 서브도메인에서 온 쓰기는 받는다") {
            val (exchange, passed) = run(cookieReq(HttpMethod.POST, "https://blog.1989v.com"))
            exchange.response.statusCode shouldBe null
            passed!!.request.headers["X-User-Id"] shouldBe listOf("user-7")
        }
        then("Origin 이 없으면 Referer 를 본다") {
            val (exchange, _) = run(cookieReq(HttpMethod.DELETE, null, "https://1989v.com/wishlist"))
            exchange.response.statusCode shouldBe null
        }
        then("다른 사이트에서 온 쓰기는 403 — 도메인을 꼬리에 붙인 흉내도 막는다") {
            run(cookieReq(HttpMethod.POST, "https://evil.example")).first.response.statusCode shouldBe HttpStatus.FORBIDDEN
            run(cookieReq(HttpMethod.POST, "https://evil1989v.com")).first.response.statusCode shouldBe HttpStatus.FORBIDDEN
        }
        then("출처가 없는 쓰기도 403") {
            run(cookieReq(HttpMethod.POST, null)).first.response.statusCode shouldBe HttpStatus.FORBIDDEN
        }
        then("게스트 허용 경로는 익명으로 통과시킨다 — 신원 헤더 없이") {
            val (exchange, passed) = run(cookieReq(HttpMethod.POST, "https://evil.example"), required = false)
            exchange.response.statusCode shouldBe null
            passed!!.request.headers["X-User-Id"] shouldBe null
        }
        then("헤더로 인증한 쓰기는 출처를 보지 않는다 — 헤더는 자동으로 실리지 않는다") {
            val token = jwtUtil.generateAccessToken("user-8", listOf("USER"))
            val req = MockServerHttpRequest.post("/api/wishlist").header(HttpHeaders.AUTHORIZATION, "Bearer $token")
                .header(HttpHeaders.ORIGIN, "https://evil.example").build()
            val (exchange, passed) = run(req)
            exchange.response.statusCode shouldBe null
            passed!!.request.headers["X-User-Id"] shouldBe listOf("user-8")
        }
    }
})
