package com.kgd.common.jackson

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean

/**
 * Spring Boot 4.0 ships Jackson 3 (`tools.jackson.*`) as the auto-configured
 * JSON stack, but a lot of the platform code still imports the Jackson 2
 * type `com.fasterxml.jackson.databind.ObjectMapper`. The Spring Boot auto-
 * configuration does not provide a bean of that legacy type, so every
 * class with `ObjectMapper` in its constructor (filters, Kafka listeners,
 * Redis serializers) fails to start with
 * `No qualifying bean of type 'com.fasterxml.jackson.databind.ObjectMapper'`.
 *
 * Until the code migrates to `tools.jackson.databind.ObjectMapper`, this
 * auto-configuration bridges the gap by providing the legacy bean.
 *
 * The bean is `@ConditionalOnMissingBean` so any service that wants a
 * custom ObjectMapper (with Kotlin module, JavaTime module, etc.) can
 * declare its own and shadow this one. The platform's current usage
 * is limited to basic `readTree` / simple serialization which the
 * default ObjectMapper handles fine.
 */
@AutoConfiguration
@ConditionalOnClass(ObjectMapper::class)
class CommonJacksonAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(ObjectMapper::class)
    fun legacyObjectMapper(): ObjectMapper = ObjectMapper()
}
