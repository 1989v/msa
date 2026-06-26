package com.kgd.inventory.infrastructure.admission

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Admission Control for inventory reservation requests.
 *
 * Redis counter로 동시 예약 요청 수를 추적하여,
 * 임계치 초과 시 429 Too Many Requests를 반환한다.
 *
 * Redis가 없으면 (redisTemplate == null) 필터를 통과시킨다 (Fail-Open).
 */
@Component
class AdmissionControlFilter(
    private val redisTemplate: StringRedisTemplate?,
    @Value("\${inventory.admission.max-concurrent-reservations:1000}")
    private val maxConcurrentReservations: Long,
) : OncePerRequestFilter() {

    private val log = KotlinLogging.logger {}

    companion object {
        private const val ACTIVE_RESERVATIONS_KEY = "inventory:active-reservations"
        private const val HTTP_TOO_MANY_REQUESTS = 429
    }

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (!isReservationRequest(request)) {
            filterChain.doFilter(request, response)
            return
        }

        if (redisTemplate == null) {
            log.debug { "Redis unavailable, bypassing admission control" }
            filterChain.doFilter(request, response)
            return
        }

        val current = try {
            redisTemplate.opsForValue().increment(ACTIVE_RESERVATIONS_KEY) ?: 0
        } catch (e: Exception) {
            log.warn { "Redis increment failed, bypassing admission control: ${e.message}" }
            filterChain.doFilter(request, response)
            return
        }

        try {
            if (current > maxConcurrentReservations) {
                decrementSafely()
                log.warn { "Admission control rejected: current=$current, max=$maxConcurrentReservations" }
                response.status = HTTP_TOO_MANY_REQUESTS
                response.contentType = "application/json"
                response.characterEncoding = "UTF-8"
                response.writer.write(
                    """{"status":"error","message":"Too many concurrent reservation requests","code":"TOO_MANY_REQUESTS"}"""
                )
                return
            }
            filterChain.doFilter(request, response)
        } finally {
            decrementSafely()
        }
    }

    private fun isReservationRequest(request: HttpServletRequest): Boolean =
        request.method == "POST" && request.requestURI.endsWith("/reserve")

    private fun decrementSafely() {
        try {
            redisTemplate?.opsForValue()?.decrement(ACTIVE_RESERVATIONS_KEY)
        } catch (e: Exception) {
            log.warn { "Redis decrement failed: ${e.message}" }
        }
    }
}
