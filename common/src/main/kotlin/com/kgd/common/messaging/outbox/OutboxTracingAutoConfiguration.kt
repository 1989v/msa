package com.kgd.common.messaging.outbox

import io.micrometer.tracing.Tracer
import io.micrometer.tracing.propagation.Propagator
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean

/**
 * micrometer-tracing 이 클래스패스에 있으면 아웃박스 행에 `traceparent` 를 남기는 [OutboxHeaderSource] 를 등록한다.
 * 도메인 설정이 `ObjectProvider<OutboxHeaderSource>` 로 받아 [OutboxJpaAdapter] 에 넘긴다 — 추적이 없는 서비스는 NONE.
 */
@AutoConfiguration
@ConditionalOnClass(name = ["io.micrometer.tracing.Tracer"])
class OutboxTracingAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(OutboxHeaderSource::class)
    fun outboxHeaderSource(
        tracer: ObjectProvider<Tracer>,
        propagator: ObjectProvider<Propagator>,
    ): OutboxHeaderSource = TracingOutboxHeaderSource(tracer, propagator)
}
