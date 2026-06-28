package com.kgd.gateway.filter

import com.kgd.gateway.security.JwtTokenValidator
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.cloud.gateway.filter.GatewayFilter
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.http.server.reactive.ServerHttpRequest
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import java.time.Duration
import java.util.UUID

/**
 * 비로그인 공개 라우트(검색 등)용 best-effort 식별자 해소 필터 (ADR-0057).
 *
 * 인증을 강제하지 않는다 (JWT 부재여도 통과):
 *  - JWT 가 유효하고 blacklist 가 아니면 `X-User-Id` 주입 (로그인 식별)
 *  - `X-Anonymous-Id` 를 헤더 → 쿠키 순으로 해소하여 forward.
 *    둘 다 없는 웹 요청은 신규 익명 식별자를 발급하고 `anonymous_id` 쿠키로 내려준다 (sticky).
 *
 * downstream(search) 의 A/B 버킷팅 키는 `userId ?: anonymousId` 로, 비로그인 트래픽도 실험에 참여한다.
 * 인증을 강제하는 보호 라우트는 [AuthenticationGatewayFilter] 를 사용한다.
 */
@Component
class IdentityResolutionGatewayFilter(
    private val jwtTokenValidator: JwtTokenValidator,
    private val redisTemplate: ReactiveRedisTemplate<String, Any>
) : AbstractGatewayFilterFactory<IdentityResolutionGatewayFilter.Config>(Config::class.java) {

    class Config

    private val log = KotlinLogging.logger {}

    override fun apply(config: Config): GatewayFilter = GatewayFilter { exchange, chain ->
        val request = exchange.request

        // 1. anonymousId 해소: 헤더 → 쿠키 → 신규 발급(+Set-Cookie)
        val provided = request.headers.getFirst(HEADER_ANONYMOUS_ID)?.takeIf { it.isValidAnonymousId() }
            ?: request.cookies.getFirst(COOKIE_ANONYMOUS_ID)?.value?.takeIf { it.isValidAnonymousId() }
        val anonymousId = provided ?: newAnonymousId().also { minted ->
            exchange.response.cookies.add(COOKIE_ANONYMOUS_ID, anonymousCookie(minted))
        }

        // 2. userId optional 추출 (JWT 있을 때만). 부재/무효여도 401 아님.
        val token = jwtTokenValidator.extractFromHeader(request.headers.getFirst(HttpHeaders.AUTHORIZATION))
            ?: return@GatewayFilter chain.filter(forward(exchange, request, anonymousId, userId = null))

        redisTemplate.hasKey("blacklist:$token")
            .onErrorReturn(false)
            .flatMap { blacklisted ->
                val userId = if (blacklisted) {
                    null
                } else {
                    jwtTokenValidator.validateAndExtract(token)
                        ?.get("userId", String::class.java)
                        ?.takeIf { it.isNotBlank() }
                }
                chain.filter(forward(exchange, request, anonymousId, userId))
            }
    }

    /**
     * 신뢰 헤더를 gateway 해소값으로 재설정한 exchange 반환.
     * 클라이언트가 직접 보낸 X-User-Id / X-Anonymous-Id 는 덮어써 스푸핑을 막는다.
     */
    private fun forward(
        exchange: ServerWebExchange,
        request: ServerHttpRequest,
        anonymousId: String,
        userId: String?
    ): ServerWebExchange {
        val mutated = request.mutate()
            .headers { h ->
                // 클라이언트가 직접 보낸 신뢰 헤더는 제거 후 gateway 해소값으로만 설정 (스푸핑 방지).
                h.remove(HEADER_USER_ID)
                h.remove(HEADER_ANONYMOUS_ID)
                h.set(HEADER_ANONYMOUS_ID, anonymousId)
                if (userId != null) h.set(HEADER_USER_ID, userId)
            }
            .build()
        return exchange.mutate().request(mutated).build()
    }

    private fun String.isValidAnonymousId(): Boolean =
        length in 8..64 && all { it.isLetterOrDigit() || it == '-' || it == '_' }

    private fun newAnonymousId(): String = UUID.randomUUID().toString()

    private fun anonymousCookie(value: String): ResponseCookie =
        ResponseCookie.from(COOKIE_ANONYMOUS_ID, value)
            .httpOnly(true)
            .path("/")
            .maxAge(Duration.ofDays(365))
            .sameSite("Lax")
            .build()

    companion object {
        const val HEADER_USER_ID = "X-User-Id"
        const val HEADER_ANONYMOUS_ID = "X-Anonymous-Id"
        const val COOKIE_ANONYMOUS_ID = "anonymous_id"
    }
}
