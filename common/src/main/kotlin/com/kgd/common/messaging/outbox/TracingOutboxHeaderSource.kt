package com.kgd.common.messaging.outbox

import io.micrometer.tracing.Tracer
import io.micrometer.tracing.propagation.Propagator
import org.springframework.beans.factory.ObjectProvider

/**
 * 현재 span 의 문맥을 설정된 전파 형식(W3C 기본 — `traceparent`)으로 꺼낸다. span 이 없으면 빈 맵.
 * 빈을 호출 시점에 찾는다 — 추적 자동설정이 이 빈보다 늦게 떠도 된다.
 */
class TracingOutboxHeaderSource(
    private val tracer: ObjectProvider<Tracer>,
    private val propagator: ObjectProvider<Propagator>,
) : OutboxHeaderSource {
    override fun headers(): Map<String, String> {
        val context = tracer.getIfAvailable()?.currentTraceContext()?.context() ?: return emptyMap()
        val propagation = propagator.getIfAvailable() ?: return emptyMap()
        val carrier = linkedMapOf<String, String>()
        propagation.inject(context, carrier) { map, key, value -> map?.put(key, value) }
        return carrier
    }
}
