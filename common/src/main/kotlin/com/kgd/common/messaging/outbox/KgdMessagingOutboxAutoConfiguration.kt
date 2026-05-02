package com.kgd.common.messaging.outbox

import com.fasterxml.jackson.databind.ObjectMapper
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.data.jpa.autoconfigure.DataJpaRepositoriesAutoConfiguration
import org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.scheduling.annotation.EnableScheduling

/**
 * Auto-configuration for the common Transactional Outbox module.
 *
 * 활성화 조건:
 * - JPA 가 classpath 에 있고 (`JpaRepository`)
 * - `outbox.polling.enabled` 프로퍼티가 `true` 이거나 미설정 (default true)
 *
 * 등록 빈:
 * - [OutboxJpaAdapter] : [OutboxPort] 의 default 구현 (서비스 측이 자체 [OutboxPort] 빈을 등록하면 그쪽이 우선).
 * - [OutboxPollingPublisher] : `KafkaTemplate` 빈이 등록된 환경에서만 활성화. polling 토글 가능.
 * - [OutboxMetrics] : `MeterRegistry` 빈이 있으면 실 metric, 없으면 NOOP.
 *
 * Entity / Repository scanning:
 * - [OutboxEntity] / [OutboxRepository] 가 `com.kgd.common.messaging.outbox` 패키지에 있어
 *   서비스 측 `@SpringBootApplication` 의 default scan 범위 (서비스 base package) 에는 포함되지 않는다.
 * - 본 auto-config 는 `@EntityScan` / `@EnableJpaRepositories` 를 의도적으로 선언하지 않는다 — 두 어노테이션은
 *   override 규칙이라 common 이 선언하면 서비스 자체 엔티티가 스캔에서 빠진다.
 * - 서비스는 자신의 application class 에 `@EntityScan(basePackages = ["com.kgd.{service}", "com.kgd.common.messaging.outbox"])`
 *   와 동일한 `@EnableJpaRepositories` 를 명시해야 한다 (fulfillment 의 [com.kgd.fulfillment.FulfillmentApplication] 참고).
 */
@AutoConfiguration(after = [DataJpaRepositoriesAutoConfiguration::class, HibernateJpaAutoConfiguration::class])
@ConditionalOnClass(JpaRepository::class)
@ConditionalOnProperty(
    prefix = "outbox.polling",
    name = ["enabled"],
    havingValue = "true",
    matchIfMissing = true,
)
@EnableScheduling
class KgdMessagingOutboxAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(OutboxPort::class)
    @ConditionalOnBean(OutboxRepository::class)
    fun outboxJpaAdapter(repository: OutboxRepository): OutboxPort = OutboxJpaAdapter(repository)

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(MeterRegistry::class)
    @ConditionalOnBean(MeterRegistry::class)
    fun outboxMetrics(meterRegistry: MeterRegistry): OutboxMetrics = OutboxMetrics.create(meterRegistry)

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnBean(value = [KafkaTemplate::class, OutboxRepository::class])
    fun outboxPollingPublisher(
        outboxRepository: OutboxRepository,
        kafkaTemplate: KafkaTemplate<String, Any>,
        objectMapper: ObjectMapper,
        outboxMetrics: OutboxMetrics?,
    ): OutboxPollingPublisher = OutboxPollingPublisher(
        outboxRepository = outboxRepository,
        kafkaTemplate = kafkaTemplate,
        objectMapper = objectMapper,
        metrics = outboxMetrics ?: OutboxMetrics.NOOP,
    )
}
