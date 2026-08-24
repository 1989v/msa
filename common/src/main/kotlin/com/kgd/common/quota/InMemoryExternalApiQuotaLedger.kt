package com.kgd.common.quota

import io.github.oshai.kotlinlogging.KotlinLogging
import java.time.Clock
import java.time.LocalDate
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

private val log = KotlinLogging.logger {}

/**
 * Redis 가 없는 환경(로컬·단위테스트·Redis 미배선 서비스)의 폴백 장부.
 *
 * **파드 단위로만 센다 — 제공자 단위 합산이 안 된다.** 그래서 이건 게이트를 *선택*으로
 * 만들지 않기 위한 장치이지 정상 운영 경로가 아니다. 게이트를 `@ConditionalOnProperty` 로
 * 감추면 서비스가 주입을 안 받고 그대로 우회하게 되므로, 없을 때도 빈은 항상 있어야 한다.
 *
 * 기동 시 경고를 남긴다 — 이 로그가 없으면 합산이 안 되는 걸 아무도 모른다.
 */
class InMemoryExternalApiQuotaLedger(
    private val clock: Clock = Clock.system(RedisExternalApiQuotaLedger.SEOUL),
) : ExternalApiQuotaLedger {

    private val counters = ConcurrentHashMap<String, AtomicLong>()

    init {
        log.warn {
            "외부 API 쿼터 장부가 in-memory 다 — 파드 단위로만 센다. " +
                "여러 서비스·파드가 같은 제공자를 쓰면 합산이 되지 않는다 (ADR-0082)."
        }
    }

    override fun tryAcquire(provider: ExternalApiProvider, cost: Long): Boolean {
        require(cost > 0) { "cost 는 1 이상이어야 한다: $cost" }
        val key = RedisExternalApiQuotaLedger.keyOf(provider, LocalDate.now(clock))
        // 날짜가 바뀌면 옛 키는 그냥 남는다 — 파드 수명이 짧고 항목이 provider 수만큼이라 무시 가능.
        val after = counters.computeIfAbsent(key) { AtomicLong() }.addAndGet(cost)
        val limit = provider.dailyLimit ?: return true
        return after <= limit
    }

    override fun used(provider: ExternalApiProvider): Long =
        counters[RedisExternalApiQuotaLedger.keyOf(provider, LocalDate.now(clock))]?.get() ?: 0L
}
