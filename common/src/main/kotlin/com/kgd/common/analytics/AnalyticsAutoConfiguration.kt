package com.kgd.common.analytics

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.kafka.core.KafkaTemplate

@AutoConfiguration
@ConditionalOnProperty(prefix = "kgd.common.analytics", name = ["enabled"], havingValue = "true", matchIfMissing = false)
class AnalyticsAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    fun analyticsEventPublisher(kafkaTemplate: KafkaTemplate<String, AnalyticsEvent>): AnalyticsEventPublisher =
        AnalyticsEventPublisher(kafkaTemplate)
}
