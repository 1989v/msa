package com.kgd.search.bandit.adapter

import com.kgd.search.domain.bandit.model.BanditKey
import com.kgd.search.domain.bandit.model.BanditState
import com.kgd.search.domain.bandit.port.BanditStatePort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository
import java.time.Instant

/**
 * Redis hash schema (ADR-0050 Phase 3 일반화):
 *   KEY:    bandit:state:{scope}:{productId}
 *           ex: bandit:state:category:elec:p1  ·  bandit:state:brand:samsung:p1
 *   FIELDS: clicks (long), impressions (long), lastTs (epoch ms)
 *
 * Atomic update 은 analytics 측 BanditStateRedisWriter 가 HINCRBY 로 수행. 본 adapter 는 read 전용.
 */
@Repository
class BanditStateRedisAdapter(
    private val redis: StringRedisTemplate
) : BanditStatePort {

    private val log = KotlinLogging.logger {}

    override fun fetch(key: BanditKey): BanditState? {
        val ops = redis.opsForHash<String, String>()
        val entries = runCatching { ops.entries(redisKey(key)) }
            .onFailure { log.warn { "Redis fetch fail key=$key: ${it.message}" } }
            .getOrNull() ?: return null
        return parse(key, entries)
    }

    override fun fetchBatch(keys: Collection<BanditKey>): Map<BanditKey, BanditState> {
        if (keys.isEmpty()) return emptyMap()
        val result = HashMap<BanditKey, BanditState>(keys.size)
        val ops = redis.opsForHash<String, String>()
        keys.forEach { key ->
            val entries = runCatching { ops.entries(redisKey(key)) }.getOrNull() ?: return@forEach
            parse(key, entries)?.let { result[key] = it }
        }
        return result
    }

    private fun parse(key: BanditKey, entries: Map<String, String>): BanditState? {
        if (entries.isEmpty()) return null
        val clicks = entries[FIELD_CLICKS]?.toLongOrNull() ?: 0L
        val impressions = entries[FIELD_IMPRESSIONS]?.toLongOrNull() ?: 0L
        if (impressions < clicks) {
            log.warn { "Bandit state invariant violated key=$key clicks=$clicks impressions=$impressions" }
            return null
        }
        val lastTs = entries[FIELD_LAST_TS]?.toLongOrNull() ?: System.currentTimeMillis()
        return BanditState(
            key = key,
            clicks = clicks,
            impressions = impressions,
            lastUpdatedAt = Instant.ofEpochMilli(lastTs)
        )
    }

    companion object {
        private const val FIELD_CLICKS = "clicks"
        private const val FIELD_IMPRESSIONS = "impressions"
        private const val FIELD_LAST_TS = "lastTs"

        fun redisKey(key: BanditKey): String = "bandit:state:${key.scope}:${key.productId}"
    }
}
