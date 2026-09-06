package com.kgd.search.infrastructure.redis

import com.kgd.search.domain.queryvector.port.QueryMissPort
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * 미적중 질의 카운터 (ADR-0090 §3.3). ZSET `search:qmiss:{modelRef}` 에 ZINCRBY.
 *
 * **휘발을 허용한다** — 날아가도 잃는 건 하루치 미스뿐이다. 그래서 30일 TTL 을 매번 다시 걸고,
 * 이 저장소가 죽어도 질의 경로는 계속 답한다(호출부가 예외를 삼킨다).
 */
@Component
class QueryMissRedisAdapter(
    private val redis: StringRedisTemplate,
) : QueryMissPort {

    override fun record(modelRef: String, normalized: String) {
        val key = keyOf(modelRef)
        redis.opsForZSet().incrementScore(key, normalized, 1.0)
        // 쓸 때마다 다시 건다 — 계속 미스가 나는 스탬프의 목록은 살아 있고, 안 쓰는 것은 저절로 사라진다.
        redis.expire(key, TTL)
    }

    override fun top(modelRef: String, limit: Int): List<QueryMissPort.Miss> =
        redis.opsForZSet()
            .reverseRangeWithScores(keyOf(modelRef), 0, (limit - 1).toLong())
            .orEmpty()
            .mapNotNull { tuple ->
                val value = tuple.value ?: return@mapNotNull null
                QueryMissPort.Miss(normalized = value, count = (tuple.score ?: 0.0).toLong())
            }

    override fun remove(modelRef: String, normalized: List<String>): Int {
        if (normalized.isEmpty()) return 0
        return (redis.opsForZSet().remove(keyOf(modelRef), *normalized.toTypedArray()) ?: 0L).toInt()
    }

    override fun size(modelRef: String): Long = redis.opsForZSet().zCard(keyOf(modelRef)) ?: 0L

    private fun keyOf(modelRef: String) = "$KEY_PREFIX$modelRef"

    companion object {
        const val KEY_PREFIX = "search:qmiss:"
        private val TTL = Duration.ofDays(30)
    }
}
