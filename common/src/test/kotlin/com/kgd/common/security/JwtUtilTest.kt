package com.kgd.common.security

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldNotBeEmpty
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts

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
        `when`("표준 클레임을 확인하면") {
            then("subject와 jti가 채워져 있어야 한다") {
                val token = jwtUtil.generateAccessToken("user-42", listOf("USER"))
                val claims = jwtUtil.parseToken(token)
                claims.subject shouldBe "user-42"
                claims.id.shouldNotBeEmpty()
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
                val token2 = jwtUtil.generateAccessToken("user-1", listOf("USER"))
                // jti(UUID) 가 매번 달라 토큰도 항상 다름
                token1 shouldNotBe null
                token2 shouldNotBe null
                token1 shouldNotBe token2
            }
        }
        `when`("두 토큰의 jti를 비교하면") {
            then("서로 달라야 한다") {
                val t1 = jwtUtil.generateAccessToken("user-1", listOf("USER"))
                val t2 = jwtUtil.generateAccessToken("user-1", listOf("USER"))
                jwtUtil.parseToken(t1).id shouldNotBe jwtUtil.parseToken(t2).id
            }
        }
    }

    given("kid / issuer / audience가 설정된 경우") {
        val configuredProps = JwtProperties(
            secret = "test-secret-key-must-be-at-least-32-chars-long!!",
            accessExpiry = 1800L,
            refreshExpiry = 604800L,
            issuer = "https://kgd.example/auth",
            audience = "kgd-api",
            kid = "key-2026-04"
        )
        val configuredUtil = JwtUtil(configuredProps)

        `when`("토큰을 생성하면") {
            then("iss와 aud 클레임이 포함되어야 한다") {
                val token = configuredUtil.generateAccessToken("user-1", listOf("USER"))
                val claims = configuredUtil.parseToken(token)
                claims.issuer shouldBe "https://kgd.example/auth"
                claims.audience shouldContain "kgd-api"
            }
            then("헤더에 kid가 포함되어야 한다") {
                val token = configuredUtil.generateAccessToken("user-1", listOf("USER"))
                val header = Jwts.parser()
                    .verifyWith(
                        io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                            configuredProps.secret.toByteArray(Charsets.UTF_8)
                        )
                    )
                    .build()
                    .parseSignedClaims(token)
                    .header
                header.keyId shouldBe "key-2026-04"
            }
        }

        `when`("issuer가 다른 토큰을 검증하면") {
            then("JwtException이 발생해야 한다") {
                val otherProps = configuredProps.copy(issuer = "https://other/auth")
                val otherUtil = JwtUtil(otherProps)
                val foreignToken = otherUtil.generateAccessToken("user-1", listOf("USER"))
                shouldThrow<JwtException> {
                    configuredUtil.parseToken(foreignToken)
                }
            }
        }

        `when`("audience가 다른 토큰을 검증하면") {
            then("JwtException이 발생해야 한다") {
                val otherProps = configuredProps.copy(audience = "other-api")
                val otherUtil = JwtUtil(otherProps)
                val foreignToken = otherUtil.generateAccessToken("user-1", listOf("USER"))
                shouldThrow<JwtException> {
                    configuredUtil.parseToken(foreignToken)
                }
            }
        }

        `when`("iss/aud가 없는 옛 토큰을 검증하면 (backwards-compat)") {
            then("기존 동작과 동일하게 통과해야 한다") {
                // configuredUtil 설정 전에 발급된 옛 토큰을 시뮬레이션
                val legacyToken = jwtUtil.generateAccessToken("user-1", listOf("USER"))
                val claims = configuredUtil.parseToken(legacyToken)
                claims.subject shouldBe "user-1"
            }
        }
    }
})
