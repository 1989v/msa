package com.kgd.common.quota

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.redis.core.StringRedisTemplate
import java.time.Clock
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val log = KotlinLogging.logger {}

/**
 * Redis `INCRBY` 기반 장부 (ADR-0082 §1).
 *
 * `INCRBY` 가 원자적이라 동시 호출에도 초과가 나지 않는다. 자정 TTL 이라 정리 배치가 필요 없다.
 *
 * **키 포맷은 언어 간 계약이다.** place/ingest(Python)도 같은 키를 증가시켜야 제공자 단위
 * 합산이 성립한다. 포맷이 어긋나면 합산이 **조용히** 깨지므로 [keyOf] 를 양쪽 테스트로 고정한다.
 *
 * 날짜 기준은 **KST 고정**이다. 서버 타임존에 맡기면 파드 설정 하나로 하루가 갈린다.
 */
class RedisExternalApiQuotaLedger(
    private val redis: StringRedisTemplate,
    private val clock: Clock = Clock.system(SEOUL),
) : ExternalApiQuotaLedger {

    override fun tryAcquire(provider: ExternalApiProvider, cost: Long): Boolean {
        require(cost > 0) { "cost 는 1 이상이어야 한다: $cost" }
        val limit = provider.dailyLimit

        val after = runCatching { increase(provider, cost) }.getOrElse {
            // fail-open: 쿼터 초과는 다음 날 회복되지만 수집 중단은 회복되지 않는다 (ADR-0082 결과).
            // 대신 조용히 넘기지 않는다 — 이 로그가 없으면 장부가 죽은 걸 아무도 모른다.
            log.warn(it) { "쿼터 장부 접근 실패 — 호출을 통과시킨다(fail-open). provider=${provider.key}" }
            return true
        }

        if (limit == null) return true                     // 관측만 하는 provider
        if (after <= limit) return true

        log.warn {
            "외부 API 일일 한도 초과로 호출 차단 — provider=${provider.key} " +
                "used=$after limit=$limit unit=${provider.unit}"
        }
        return false
    }

    override fun used(provider: ExternalApiProvider): Long =
        runCatching { redis.opsForValue().get(keyOf(provider, today()))?.toLongOrNull() ?: 0L }
            .getOrElse {
                log.warn(it) { "쿼터 조회 실패 — 0 으로 본다. provider=${provider.key}" }
                0L
            }

    /**
     * 넘겼어도 되돌리지 않는다. 되돌리면 경합에서 두 호출이 서로의 감소를 덮어써
     * 실제보다 적게 세게 된다 — 초과를 막으려는 장부가 초과를 허용한다.
     */
    private fun increase(provider: ExternalApiProvider, cost: Long): Long {
        val key = keyOf(provider, today())
        val after = redis.opsForValue().increment(key, cost)
            ?: error("INCRBY 가 null 을 반환했다: $key")
        // 첫 증가일 때만 만료를 건다. 매번 걸면 자정 넘어까지 밀린다.
        if (after == cost) redis.expire(key, ttlUntilMidnight())
        return after
    }

    private fun today(): LocalDate = LocalDate.now(clock)

    private fun ttlUntilMidnight(): Duration {
        val now = LocalDate.now(clock).atTime(LocalTime.now(clock))
        return Duration.between(now, now.toLocalDate().plusDays(1).atStartOfDay())
    }

    companion object {
        val SEOUL: ZoneId = ZoneId.of("Asia/Seoul")
        private val DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd")

        /** 언어 간 계약. Python 래퍼가 같은 문자열을 만들어야 한다. */
        fun keyOf(provider: ExternalApiProvider, date: LocalDate): String =
            "external-api-quota:${provider.key}:${DATE.format(date)}"
    }
}
