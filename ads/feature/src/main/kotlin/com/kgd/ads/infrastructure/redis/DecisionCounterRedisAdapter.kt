package com.kgd.ads.infrastructure.redis

import com.kgd.ads.application.decision.dto.CounterQuery
import com.kgd.ads.application.decision.dto.DecisionCounters
import com.kgd.ads.application.decision.dto.ServeTally
import com.kgd.ads.application.decision.port.DecisionCounterPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.redis.core.script.RedisScript
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.LocalDateTime

/**
 * 결정의 Redis 읽기 한 번(MGET)과 쓰기 한 번(스크립트 한 번). 연결은 ads 전용(명령 250ms)이라
 * Redis 가 멈춰도 결정이 그만큼만 기다린다.
 *
 * 실패는 예외 종류와 무관하게 삼킨다 — 읽기 실패는 「유료 광고 없음」, 쓰기 실패는 경고로 끝나야 하고
 * 어느 쪽도 결정 응답을 500 으로 만들면 안 된다.
 *
 * 쓰기를 파이프라인이 아니라 스크립트로 하는 것은 Lettuce 파이프라인이 공유 연결을 쓰지 않고 호출마다
 * 전용 연결을 새로 열기 때문이다(결정마다 TCP 연결 + 핸드셰이크). 스크립트는 공유 연결 위의 명령 하나다.
 */
@Component
class DecisionCounterRedisAdapter(
    private val redis: AdsRedisConnection,
) : DecisionCounterPort {

    private val log = KotlinLogging.logger {}

    override fun read(query: CounterQuery): DecisionCounters? {
        val frequencyKeys = query.campaignIds.associateWith { AdsRedisKeys.frequency(query.visitorHash, it, query.day) }
        val campaignKeys = query.campaignHours.flatMap { (id, hours) -> hours.map { Triple(id, it, AdsRedisKeys.campaignHourSpend(id, it)) } }
        val advertiserKeys = query.advertiserHours.flatMap { (id, hours) -> hours.map { Triple(id, it, AdsRedisKeys.advertiserHourSpend(id, it)) } }
        val keys = frequencyKeys.values + campaignKeys.map { it.third } + advertiserKeys.map { it.third }

        val values = try {
            redis.template.opsForValue().multiGet(keys) ?: return null
        } catch (e: RuntimeException) {
            log.warn { "ads Redis 읽기 실패: ${e.javaClass.simpleName} ${e.message}" }
            return null
        }
        val valueOf = keys.zip(values).associate { (key, value) -> key to (value?.toLongOrNull() ?: 0L) }
        return DecisionCounters(
            frequency = frequencyKeys.mapValues { (_, key) -> valueOf.getValue(key) },
            campaignSpend = byOwnerAndHour(campaignKeys, valueOf),
            advertiserSpend = byOwnerAndHour(advertiserKeys, valueOf),
        )
    }

    override fun record(tally: ServeTally): Boolean {
        val keys = mutableListOf<String>()
        val args = mutableListOf(Duration.ofHours(AdsRedisKeys.COUNTER_TTL_HOURS).seconds.toString())
        fun add(key: String, field: String, increment: Long) {
            val index = keys.indexOf(key).takeIf { it >= 0 } ?: keys.size.also { keys += key }
            args += listOf((index + 1).toString(), field, increment.toString())
        }
        (tally.requests.keys + tally.paidFilled.keys).forEach { placementKey ->
            val key = AdsRedisKeys.placementHour(placementKey, tally.hour)
            tally.requests[placementKey]?.let { add(key, AdsRedisKeys.FIELD_REQUESTS, it) }
            tally.paidFilled[placementKey]?.let { add(key, AdsRedisKeys.FIELD_PAID_FILLED, it) }
        }
        tally.unregistered.forEach { (placementKey, count) -> add(AdsRedisKeys.unregisteredHour(tally.hour), placementKey, count) }
        if (keys.isEmpty()) return true

        return try {
            redis.template.execute(INCREMENT_WITH_TTL, keys, *args.toTypedArray())
            true
        } catch (e: RuntimeException) {
            log.warn { "ads Redis 카운터 쓰기 실패: ${e.javaClass.simpleName} ${e.message}" }
            false
        }
    }

    private fun byOwnerAndHour(
        entries: List<Triple<Long, LocalDateTime, String>>,
        valueOf: Map<String, Long>,
    ): Map<Long, Map<LocalDateTime, Long>> =
        entries.groupBy({ it.first }, { it.second to valueOf.getValue(it.third) }).mapValues { (_, pairs) -> pairs.toMap() }

    private companion object {
        /**
         * 해시 필드 증가 + 키마다 TTL. ARGV[1] = TTL(초), 이어서 (KEYS 번호, 필드, 증가량) 세 개씩.
         * TTL 을 증가와 같은 스크립트에서 걸어 TTL 없는 카운터가 남지 않는다.
         */
        val INCREMENT_WITH_TTL: RedisScript<Long> = RedisScript.of(
            """
            local ttl = tonumber(ARGV[1])
            for i = 2, #ARGV, 3 do
              redis.call('HINCRBY', KEYS[tonumber(ARGV[i])], ARGV[i + 1], tonumber(ARGV[i + 2]))
            end
            for i = 1, #KEYS do
              redis.call('EXPIRE', KEYS[i], ttl)
            end
            return #KEYS
            """.trimIndent(),
            Long::class.java,
        )
    }
}
