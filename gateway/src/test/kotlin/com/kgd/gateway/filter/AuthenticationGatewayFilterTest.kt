package com.kgd.gateway.filter

import com.kgd.common.security.JwtProperties
import com.kgd.common.security.JwtUtil
import com.kgd.gateway.security.JwtTokenValidator
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import reactor.core.publisher.Mono
import reactor.test.StepVerifier

class AuthenticationGatewayFilterTest : BehaviorSpec({

    val jwtProps = JwtProperties(
        secret = "test-secret-key-must-be-at-least-32-chars-long!!",
        accessExpiry = 1800L
    )
    val jwtUtil = JwtUtil(jwtProps)
    val jwtTokenValidator = JwtTokenValidator(jwtUtil)
    val redisTemplate = mockk<RedisTemplate<String, Any>>()
    val filter = AuthenticationGatewayFilter(jwtTokenValidator, redisTemplate)
    val chain = mockk<GatewayFilterChain>()

    beforeEach {
        every { chain.filter(any()) } returns Mono.empty()
        every { redisTemplate.hasKey(any<String>()) } returns false
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
            then("X-User-Id 헤더를 추가하고 체인을 진행해야 한다") {
                val token = jwtUtil.generateAccessToken("user-1", listOf("USER"))
                val request = MockServerHttpRequest.get("/api/products/1")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
                    .build()
                val exchange = MockServerWebExchange.from(request)

                val gatewayFilter = filter.apply(AuthenticationGatewayFilter.Config())
                StepVerifier.create(gatewayFilter.filter(exchange, chain))
                    .verifyComplete()

                // 체인이 호출되어야 함 (401이 아닌 경우)
                exchange.response.statusCode shouldBe null // 응답이 설정되지 않음 = 성공적으로 체인 전달
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
    }
})
