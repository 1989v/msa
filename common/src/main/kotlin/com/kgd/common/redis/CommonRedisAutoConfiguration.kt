package com.kgd.common.redis

import io.lettuce.core.cluster.ClusterClientOptions
import io.lettuce.core.cluster.ClusterTopologyRefreshOptions
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.data.redis.connection.RedisClusterConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer
import org.springframework.data.redis.serializer.StringRedisSerializer
import java.time.Duration

@AutoConfiguration(afterName = ["org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration"])
@ConditionalOnClass(RedisTemplate::class)
@ConditionalOnBean(RedisClusterConfiguration::class)
@ConditionalOnProperty(prefix = "kgd.common.redis", name = ["enabled"], havingValue = "true", matchIfMissing = false)
class CommonRedisAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(LettuceConnectionFactory::class)
    fun lettuceConnectionFactory(
        clusterConfiguration: RedisClusterConfiguration
    ): LettuceConnectionFactory {
        val topologyRefreshOptions = ClusterTopologyRefreshOptions.builder()
            .enablePeriodicRefresh(Duration.ofMinutes(10))
            .enableAllAdaptiveRefreshTriggers()
            .build()

        val clientOptions = ClusterClientOptions.builder()
            .topologyRefreshOptions(topologyRefreshOptions)
            .build()

        val lettuceClientConfig = LettuceClientConfiguration.builder()
            .clientOptions(clientOptions)
            .commandTimeout(Duration.ofSeconds(2))
            .build()

        return LettuceConnectionFactory(clusterConfiguration, lettuceClientConfig)
    }

    @Bean
    @ConditionalOnMissingBean
    fun redisTemplate(factory: LettuceConnectionFactory): RedisTemplate<String, Any> =
        RedisTemplate<String, Any>().apply {
            connectionFactory = factory
            keySerializer = StringRedisSerializer()
            valueSerializer = GenericJackson2JsonRedisSerializer()
            hashKeySerializer = StringRedisSerializer()
            hashValueSerializer = GenericJackson2JsonRedisSerializer()
        }
}
