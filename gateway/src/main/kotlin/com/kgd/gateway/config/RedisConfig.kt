package com.kgd.gateway.config

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory
import org.springframework.data.redis.core.ReactiveRedisTemplate
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer
import org.springframework.data.redis.serializer.RedisSerializationContext
import org.springframework.data.redis.serializer.StringRedisSerializer

@Configuration
class RedisConfig(private val objectMapper: ObjectMapper) {

    @Bean
    fun reactiveRedisTemplate(
        factory: ReactiveRedisConnectionFactory
    ): ReactiveRedisTemplate<String, Any> {
        val serializer = GenericJackson2JsonRedisSerializer(objectMapper)
        val context = RedisSerializationContext
            .newSerializationContext<String, Any>(StringRedisSerializer())
            .value(serializer)
            .build()
        return ReactiveRedisTemplate(factory, context)
    }
}
