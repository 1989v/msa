package com.kgd.gateway.filter

import com.kgd.common.security.TokenKeys
import com.kgd.gateway.security.JwtTokenValidator
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.cloud.gateway.filter.GatewayFilter
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.server.reactive.ServerHttpRequest
import org.springframework.stereotype.Component
import reactor.core.publisher.Mono
import java.net.URI

@Component
class AuthenticationGatewayFilter(
    private val jwtTokenValidator: JwtTokenValidator,
    private val redisTemplate: ReactiveRedisTemplate<String, Any>,
    /**
     * 쿠키로 인증된 쓰기 요청을 받아 줄 출처 — 이 도메인이거나 그 서브도메인(ADR-0101).
     * 쿠키는 자동으로 실리므로 다른 사이트가 만든 요청을 여기서 걸러 CSRF 를 막는다.
     */
    @Value("\${kgd.gateway.auth.trusted-origins:1989v.com,localhost,127.0.0.1}") trustedOrigins: String,
) : AbstractGatewayFilterFactory<AuthenticationGatewayFilter.Config>(Config::class.java) {

    data class Config(
        val requiredRoles: List<String> = emptyList(),
        /**
         * false 면 토큰이 없거나 유효하지 않아도 401 대신 **익명으로 통과**시킨다
         * (게스트 허용 엔드포인트에서 로그인 사용자만 식별하려는 용도).
         * 이때 클라이언트가 보낸 신원 헤더는 제거되므로 위조가 불가능하다.
         */
        val required: Boolean = true
    )

    private val log = KotlinLogging.logger {}
    private val trusted = trustedOrigins.split(',').map { it.trim().lowercase() }.filter { it.isNotEmpty() }

    override fun apply(config: Config): GatewayFilter = GatewayFilter { exchange, chain ->
        val request = exchange.request
        val authHeader = request.headers.getFirst(HttpHeaders.AUTHORIZATION)
        // 헤더가 먼저다(서버 간 호출 · 도구). 브라우저는 HttpOnly 쿠키로 싣는다(ADR-0101)
        val headerToken = jwtTokenValidator.extractFromHeader(authHeader)
        val token = headerToken ?: request.cookies.getFirst(ACCESS_COOKIE)?.value?.takeIf { it.isNotBlank() }

        fun reject(reason: String, status: HttpStatus = HttpStatus.UNAUTHORIZED): Mono<Void> {
            if (!config.required) return chain.filter(exchange.mutate().request(asAnonymous(request)).build())
            log.warn { "$reason: ${request.uri}" }
            exchange.response.statusCode = status
            return exchange.response.setComplete()
        }

        if (token == null) {
            return@GatewayFilter reject("Missing or invalid Authorization header")
        }
        // 쿠키는 다른 사이트의 요청에도 실린다 — 쿠키로 인증된 쓰기는 우리 도메인에서 온 것만 받는다
        if (headerToken == null && request.method !in SAFE_METHODS && !fromTrustedOrigin(request)) {
            return@GatewayFilter reject("Cookie-authenticated write from untrusted origin", HttpStatus.FORBIDDEN)
        }

        // JWT 블랙리스트 체크 (Fail-Open 정책: Redis 장애 시 허용).
        // 키는 auth 와 같은 것을 봐야 한다 — 여기서 접두사를 직접 적었던 동안
        // auth 는 다른 키에 썼고 로그아웃이 아무것도 무효화하지 못했다.
        redisTemplate.hasKey(TokenKeys.blacklist(token))
            .onErrorReturn(false)
            .flatMap { isBlacklisted ->
                if (isBlacklisted) {
                    reject("Blacklisted token used")
                } else {
                    val claims = jwtTokenValidator.validateAndExtract(token)
                    if (claims == null) {
                        reject("Invalid JWT token")
                    } else {
                        val userId = claims.get("userId", String::class.java) ?: ""
                        @Suppress("UNCHECKED_CAST")
                        val roles = (claims.get("roles", List::class.java) as? List<*>)
                            ?.map { it.toString() } ?: emptyList()

                        // 역할 기반 접근 제어
                        if (config.requiredRoles.isNotEmpty() &&
                            !hasRequiredRole(roles, config.requiredRoles)
                        ) {
                            log.warn { "Insufficient role for ${request.uri}: has=$roles, required=${config.requiredRoles}" }
                            exchange.response.statusCode = HttpStatus.FORBIDDEN
                            return@flatMap exchange.response.setComplete()
                        }

                        val mutatedRequest = request.mutate()
                            .header("X-User-Id", userId)
                            .header("X-User-Roles", roles.joinToString(","))
                            .build()
                        chain.filter(exchange.mutate().request(mutatedRequest).build())
                    }
                }
            }
    }

    /** Origin 이 없으면 Referer 를 본다. 둘 다 없으면 브라우저가 보낸 쓰기가 아니라고 보고 거절한다 */
    private fun fromTrustedOrigin(request: ServerHttpRequest): Boolean {
        val source = request.headers.origin ?: request.headers.getFirst(HttpHeaders.REFERER) ?: return false
        val host = runCatching { URI(source).host }.getOrNull()?.lowercase() ?: return false
        return trusted.any { host == it || host.endsWith(".$it") }
    }

    /** 클라이언트가 직접 넣은 신원 헤더를 제거 — 익명 통과 시 X-User-Id 위조 방지 */
    private fun asAnonymous(request: ServerHttpRequest): ServerHttpRequest =
        request.mutate()
            .headers { it.remove("X-User-Id"); it.remove("X-User-Roles") }
            .build()

    private fun hasRequiredRole(userRoles: List<String>, requiredRoles: List<String>): Boolean {
        // ROLE_ADMIN은 모든 역할을 포함
        if (userRoles.contains("ROLE_ADMIN")) return true
        return userRoles.any { it in requiredRoles }
    }

    companion object {
        const val ACCESS_COOKIE = "portal_access_token"
        private val SAFE_METHODS = setOf(HttpMethod.GET, HttpMethod.HEAD, HttpMethod.OPTIONS)
    }
}
