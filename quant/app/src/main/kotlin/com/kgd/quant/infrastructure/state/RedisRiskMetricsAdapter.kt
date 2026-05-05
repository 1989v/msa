package com.kgd.quant.infrastructure.state

import com.kgd.quant.application.port.state.DailyMetrics
import com.kgd.quant.application.port.state.RiskMetricsPort
import com.kgd.quant.domain.common.TenantId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Duration
import java.time.LocalDate

/**
 * TG-P3-14 — Redis Hash 기반 일일 risk metric 어댑터 (ADR-0037).
 *
 * 키 형식: `quant:risk-metrics:{tenantId}:{yyyy-MM-dd}` Hash {loss, volume, count}.
 * TTL 25h — 다음날 KST 00:00 reset 보장.
 *
 * HINCRBYFLOAT (loss, volume) + HINCRBY (count) 모두 atomic.
 */
@Component
class RedisRiskMetricsAdapter(
    private val redis: StringRedisTemplate,
) : RiskMetricsPort {

    override suspend fun addLoss(tenantId: TenantId, date: LocalDate, lossKrw: BigDecimal) =
        withContext(Dispatchers.IO) {
            val k = key(tenantId, date)
            redis.opsForHash<String, String>().increment(k, FIELD_LOSS, lossKrw.toDouble())
            ensureTtl(k)
        }

    override suspend fun addVolume(tenantId: TenantId, date: LocalDate, volumeKrw: BigDecimal) =
        withContext(Dispatchers.IO) {
            val k = key(tenantId, date)
            redis.opsForHash<String, String>().increment(k, FIELD_VOLUME, volumeKrw.toDouble())
            ensureTtl(k)
        }

    override suspend fun incCount(tenantId: TenantId, date: LocalDate) = withContext(Dispatchers.IO) {
        val k = key(tenantId, date)
        redis.opsForHash<String, String>().increment(k, FIELD_COUNT, 1L)
        ensureTtl(k)
    }

    override suspend fun snapshot(tenantId: TenantId, date: LocalDate): DailyMetrics =
        withContext(Dispatchers.IO) {
            val k = key(tenantId, date)
            val ops = redis.opsForHash<String, String>()
            val loss = ops.get(k, FIELD_LOSS)?.toBigDecimalOrNull() ?: BigDecimal.ZERO
            val volume = ops.get(k, FIELD_VOLUME)?.toBigDecimalOrNull() ?: BigDecimal.ZERO
            val count = ops.get(k, FIELD_COUNT)?.toLongOrNull() ?: 0L
            DailyMetrics(loss, volume, count)
        }

    private fun ensureTtl(k: String) {
        // 매번 EXPIRE 호출은 부담이지만 day boundary 직후 첫 increment 가 누락될 위험 회피.
        redis.expire(k, Duration.ofHours(25))
    }

    private fun key(tenantId: TenantId, date: LocalDate) =
        "quant:risk-metrics:${tenantId.value}:$date"

    companion object {
        const val FIELD_LOSS = "loss"
        const val FIELD_VOLUME = "volume"
        const val FIELD_COUNT = "count"
    }
}
