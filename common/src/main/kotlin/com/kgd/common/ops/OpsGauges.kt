package com.kgd.common.ops

import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Tags
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * DB 에서 주기적으로 세어 올리는 운영 게이지. 값은 원장(DB)이 정한다 — 재기동해도 0 에서 다시 쌓이지 않고,
 * 여러 인스턴스가 같은 값을 낸다(카운터를 코드 경로마다 심으면 빠진 경로가 조용히 0 을 낸다).
 */
class OpsGauges(private val registry: MeterRegistry) {
    private val holders = ConcurrentHashMap<Pair<String, Tags>, AtomicLong>()

    fun set(name: String, value: Long, vararg tags: Pair<String, String>) {
        val t = Tags.of(*tags.map { io.micrometer.core.instrument.Tag.of(it.first, it.second) }.toTypedArray())
        holders.computeIfAbsent(name to t) { key ->
            AtomicLong(0).also { holder -> Gauge.builder(key.first, holder) { it.get().toDouble() }.tags(key.second).register(registry) }
        }.set(value)
    }
}
