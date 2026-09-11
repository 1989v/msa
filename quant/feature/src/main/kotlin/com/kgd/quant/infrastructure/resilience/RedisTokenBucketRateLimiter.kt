package com.kgd.quant.infrastructure.resilience

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.io.ClassPathResource
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.script.DefaultRedisScript
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets

private val log = KotlinLogging.logger {}

/**
 * TG-P2-11.3 — Redis Lua script 기반 token bucket Rate Limiter.
 *
 * ## 분산 정합성 (multi-instance 합산 한도)
 * Lua script 가 Redis 단일 thread 위에서 atomic 으로 실행되므로,
 * 여러 인스턴스가 동시에 [tryConsume] 을 호출해도 합산 한도가 깨지지 않는다 (NFR-P2-REL-04).
 *
 * ## Key 컨벤션
 * `ratelimit:{exchange}:{tenantId}:{apiKeyHash}`
 * - apiKeyHash 는 평문 API key 가 아닌 SHA-256 hash 값 (INV-P2-12 — credential 평문 미노출).
 * - 호출자가 hash 계산 후 전달하는 책임을 가진다.
 *
 * ## 버킷 / refill 기본값 (보수적)
 * - bithumb: bucket 90, refill 90/s — 빗썸 Public API 공식 한도(150/s)의 60%.
 *   Phase 3 OQ-P2-004 확정 후 상향 가능.
 * - default: bucket 100, refill 100/s.
 *
 * ## Activation
 * `quant.resilience.ratelimit.enabled=true` 일 때만 bean 생성.
 * Phase 1 / Phase 2 backtest 만 실행 시 Redis 미연결 환경에서도 부팅 가능하도록 default false.
 *
 * ## Phase 2 단순화
 * - 80% 도달 RISK 알림 enqueue 는 호출자 책임 (현재 메트릭만 노출). 후속 PR 에서 wire-up.
 * - apiKeyHash 미가용 환경 (빗썸 Public 채널 등) 은 호출자가 `"public"` 등 상수 hash 를 전달.
 */
@Component
@ConditionalOnProperty(
    name = ["quant.resilience.ratelimit.enabled"],
    havingValue = "true",
    matchIfMissing = false,
)
class RedisTokenBucketRateLimiter(
    private val redisTemplate: StringRedisTemplate,
    @Value("\${quant.resilience.ratelimit.bithumb.bucket-size:90}")
    private val bithumbBucketSize: Int,
    @Value("\${quant.resilience.ratelimit.bithumb.refill-rate:90}")
    private val bithumbRefillRate: Double,
) {

    private val script: String by lazy {
        ClassPathResource(SCRIPT_PATH).inputStream.use { it.readBytes().toString(StandardCharsets.UTF_8) }
    }

    @Suppress("UNCHECKED_CAST")
    private val redisScript: DefaultRedisScript<List<*>> by lazy {
        DefaultRedisScript<List<*>>().apply {
            setScriptText(script)
            setResultType(List::class.java as Class<List<*>>)
        }
    }

    /**
     * 토큰 소비를 시도하고 결과를 반환한다.
     *
     * @param exchange   거래소 식별자 (`bithumb` 등). 버킷/refill 파라미터 분기에 사용.
     * @param tenantId   테넌트 식별자 (INV-05).
     * @param apiKeyHash API key 의 SHA-256 hash. Public 채널은 `"public"` 등 상수 권장.
     * @param tokens     소비 수량 (default 1).
     * @return [RateLimitResult.allowed] = 토큰 소비 성공 여부, [RateLimitResult.remaining] = 남은 토큰.
     */
    fun tryConsume(
        exchange: String,
        tenantId: String,
        apiKeyHash: String,
        tokens: Int = 1,
    ): RateLimitResult {
        val key = "ratelimit:$exchange:$tenantId:$apiKeyHash"
        val (bucketSize, refillRate) = paramsFor(exchange)

        val raw = redisTemplate.execute(
            redisScript,
            listOf(key),
            System.currentTimeMillis().toString(),
            bucketSize.toString(),
            refillRate.toString(),
            tokens.toString(),
        ) ?: emptyList<Any>()

        return parseResult(raw, fallbackBucketSize = bucketSize)
    }

    private fun paramsFor(exchange: String): Pair<Int, Double> = when (exchange) {
        EXCHANGE_BITHUMB -> bithumbBucketSize to bithumbRefillRate
        else -> DEFAULT_BUCKET_SIZE to DEFAULT_REFILL_RATE
    }

    private fun parseResult(raw: List<*>, fallbackBucketSize: Int): RateLimitResult {
        if (raw.size < 2) {
            log.warn { "ratelimit lua script returned malformed result size=${raw.size}" }
            return RateLimitResult(allowed = true, remaining = fallbackBucketSize)
        }
        val resultLong = (raw[0] as? Number)?.toLong() ?: 0L
        val remainingLong = (raw[1] as? Number)?.toLong() ?: 0L
        return RateLimitResult(allowed = resultLong == 1L, remaining = remainingLong.toInt())
    }

    companion object {
        const val SCRIPT_PATH: String = "lua/token_bucket.lua"
        const val EXCHANGE_BITHUMB: String = "bithumb"
        const val DEFAULT_BUCKET_SIZE: Int = 100
        const val DEFAULT_REFILL_RATE: Double = 100.0
    }
}

/**
 * 토큰 소비 결과.
 *
 * @param allowed true = 소비 성공, false = throttled.
 * @param remaining 남은 토큰 수 (atomically 측정된 시점 기준).
 */
data class RateLimitResult(
    val allowed: Boolean,
    val remaining: Int,
)
