package com.kgd.analytics.infrastructure.config

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.AnalyticsEventPublisher
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.core.DefaultKafkaProducerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.core.ProducerFactory
import org.springframework.kafka.support.serializer.JsonSerializer

/**
 * 화면 이벤트 발행 배선 (ADR-0095).
 *
 * analytics 는 원래 **소비자**였는데 수집 진입점(`POST /api/v1/events`)이 생기면서
 * 같은 토픽의 발행자도 됐다. 기존 String/String 템플릿으로는 `AnalyticsEvent` 를 보낼 수 없어
 * (StringSerializer 가 객체를 못 받는다) 전용 템플릿을 둔다.
 *
 * 소비 쪽은 `spring.json.trusted.packages: com.kgd.common.analytics` 로 이미 맞춰져 있다.
 */
@Configuration
class EventCollectKafkaConfig(
    @Value("\${spring.kafka.bootstrap-servers}") private val bootstrapServers: String,
) {
    @Bean
    fun analyticsEventProducerFactory(): ProducerFactory<String, AnalyticsEvent> =
        DefaultKafkaProducerFactory(
            mapOf<String, Any>(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
                ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
                ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG to JsonSerializer::class.java,
            ),
        )

    @Bean
    fun analyticsEventKafkaTemplate(
        analyticsEventProducerFactory: ProducerFactory<String, AnalyticsEvent>,
    ): KafkaTemplate<String, AnalyticsEvent> = KafkaTemplate(analyticsEventProducerFactory)

    /**
     * `AnalyticsAutoConfiguration` 은 `kgd.common.analytics.enabled=true` 일 때만 만든다.
     * analytics 는 소비자이기도 해서 그 스위치를 켜지 않고 여기서 직접 등록한다
     * (`@ConditionalOnMissingBean` 이라 중복되지 않는다).
     */
    @Bean
    fun analyticsEventPublisher(
        analyticsEventKafkaTemplate: KafkaTemplate<String, AnalyticsEvent>,
    ): AnalyticsEventPublisher = AnalyticsEventPublisher(analyticsEventKafkaTemplate)
}
