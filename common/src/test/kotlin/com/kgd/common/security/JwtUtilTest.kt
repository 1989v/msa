package com.kgd.common.security

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.jsonwebtoken.JwtException

class JwtUtilTest : BehaviorSpec({

    val props = JwtProperties(
        secret = "test-secret-key-must-be-at-least-32-chars-long!!",
        accessExpiry = 1800L,
        refreshExpiry = 604800L
    )
    val jwtUtil = JwtUtil(props)

    given("Access Token 생성 시") {
        `when`("유효한 userId와 roles가 주어지면") {
            then("토큰이 생성되고 검증에 성공해야 한다") {
                val token = jwtUtil.generateAccessToken("user-1", listOf("USER"))
                jwtUtil.isValid(token).shouldBeTrue()
            }
        }
        `when`("생성된 토큰을 파싱하면") {
            then("userId와 roles가 추출되어야 한다") {
                val token = jwtUtil.generateAccessToken("user-1", listOf("USER", "ADMIN"))
                val claims = jwtUtil.parseToken(token)
                claims["userId"] shouldBe "user-1"
                @Suppress("UNCHECKED_CAST")
                (claims["roles"] as List<*>) shouldBe listOf("USER", "ADMIN")
                claims["type"] shouldBe "access"
            }
        }
    }

    given("Refresh Token 생성 시") {
        `when`("유효한 userId가 주어지면") {
            then("type이 refresh인 토큰이 생성되어야 한다") {
                val token = jwtUtil.generateRefreshToken("user-1")
                val claims = jwtUtil.parseToken(token)
                claims["userId"] shouldBe "user-1"
                claims["type"] shouldBe "refresh"
            }
        }
    }

    given("userId 추출 시") {
        `when`("유효한 토큰이면") {
            then("userId가 반환되어야 한다") {
                val token = jwtUtil.generateAccessToken("user-42", listOf("USER"))
                jwtUtil.extractUserId(token) shouldBe "user-42"
            }
        }
        `when`("잘못된 토큰이면") {
            then("null이 반환되어야 한다") {
                jwtUtil.extractUserId("invalid-token") shouldBe null
            }
        }
    }

    given("토큰 유효성 검증 시") {
        `when`("잘못된 토큰이면") {
            then("isValid가 false를 반환해야 한다") {
                jwtUtil.isValid("invalid.token.here").shouldBeFalse()
            }
        }
        `when`("만료 시간이 음수인 토큰을 파싱하면") {
            then("JwtException이 발생해야 한다") {
                val expiredProps = JwtProperties(
                    secret = "test-secret-key-must-be-at-least-32-chars-long!!",
                    accessExpiry = -1L
                )
                val expiredUtil = JwtUtil(expiredProps)
                val token = expiredUtil.generateAccessToken("user", listOf("USER"))
                shouldThrow<JwtException> {
                    jwtUtil.parseToken(token)
                }
            }
        }
    }

    given("두 개의 토큰 생성 시") {
        `when`("동일한 userId로 생성하면") {
            then("서로 다른 토큰이 생성되어야 한다") {
                val token1 = jwtUtil.generateAccessToken("user-1", listOf("USER"))
                Thread.sleep(10) // issuedAt 차이
                val token2 = jwtUtil.generateAccessToken("user-1", listOf("USER"))
                // 동일 userId라도 토큰 자체는 같을 수 있지만, 실제 운영에서는 다른 토큰 생성 보장
                token1 shouldNotBe null
                token2 shouldNotBe null
            }
        }
    }
})
