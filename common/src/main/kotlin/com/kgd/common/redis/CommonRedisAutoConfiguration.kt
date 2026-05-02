package com.kgd.common.redis

import io.lettuce.core.cluster.ClusterClientOptions
import io.lettuce.core.cluster.ClusterTopologyRefreshOptions
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.data.redis.connection.RedisClusterConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer
import org.springframework.data.redis.serializer.StringRedisSerializer
import java.time.Duration

@AutoConfiguration(afterName = ["org.springframework.boot.data.redis.autoconfigure.DataRedisAutoConfiguration"])
@ConditionalOnClass(RedisTemplate::class)
@ConditionalOnProperty(prefix = "kgd.common.redis", name = ["enabled"], havingValue = "true", matchIfMissing = false)
@ConditionalOnProperty(prefix = "spring.data.redis.cluster", name = ["nodes"])
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

    // Spring Boot 4.0 의 DataRedisAutoConfiguration 도 동일 이름 'redisTemplate' 빈을
    // 등록한다. 무한정 ConditionalOnMissingBean 만 사용하면 generic type (Object,Object vs
    // String,Any) 차이로 conditional 이 빗나가 BeanDefinitionOverrideException 이 발생.
    // 이름 기반 가드로 명시한다.
    @Bean
    @ConditionalOnMissingBean(name = ["redisTemplate"])
    fun redisTemplate(factory: LettuceConnectionFactory): RedisTemplate<String, Any> {
        val jsonSerializer = GenericJacksonJsonRedisSerializer.create {}
        return RedisTemplate<String, Any>().apply {
            connectionFactory = factory
            keySerializer = StringRedisSerializer()
            valueSerializer = jsonSerializer
            hashKeySerializer = StringRedisSerializer()
            hashValueSerializer = jsonSerializer
        }
    }
}
