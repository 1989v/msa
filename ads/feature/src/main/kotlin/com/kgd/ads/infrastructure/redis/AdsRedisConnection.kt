package com.kgd.ads.infrastructure.redis

import io.lettuce.core.ClientOptions
import io.lettuce.core.SocketOptions
import org.springframework.beans.factory.DisposableBean
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.connection.RedisPassword
import org.springframework.data.redis.connection.RedisStandaloneConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * ads 전용 Redis 연결 — 호스트와 같은 Redis 인스턴스, 짧은 타임아웃.
 *
 * 결정·이벤트 경로는 Redis 가 느리면 기다리지 않고 「유료 광고 없음」으로 넘어가야 하므로
 * 명령 250ms·연결 500ms 로 끊는다. 이 값을 호스트 공용 연결에 걸면 recommendation 동기화의
 * `RENAME`·대량 `delete` 가 타임아웃으로 깨진다.
 *
 * 그래서 연결 팩토리를 **스프링 빈으로 내놓지 않고** 이 컴포넌트가 직접 만들어 쥔다.
 * `RedisConnectionFactory` 빈을 하나라도 등록하면 Boot 의 Redis 자동 구성이 물러나
 * 공용 `StringRedisTemplate` 이 이 연결로 바뀐다. 첫 명령 때 연결한다(기동 시 Redis 불필요).
 */
@Component
class AdsRedisConnection(
    @Value("\${spring.data.redis.host:localhost}") host: String,
    @Value("\${spring.data.redis.port:6379}") port: Int,
    @Value("\${spring.data.redis.password:}") password: String,
) : DisposableBean {

    private val connectionFactory: LettuceConnectionFactory = LettuceConnectionFactory(
        RedisStandaloneConfiguration(host, port).apply {
            if (password.isNotBlank()) setPassword(RedisPassword.of(password))
        },
        LettuceClientConfiguration.builder()
            .commandTimeout(COMMAND_TIMEOUT)
            .clientOptions(
                ClientOptions.builder()
                    .socketOptions(SocketOptions.builder().connectTimeout(CONNECT_TIMEOUT).build())
                    .build(),
            )
            .build(),
    ).apply { afterPropertiesSet() }

    val template: StringRedisTemplate = StringRedisTemplate(connectionFactory)

    override fun destroy() {
        connectionFactory.destroy()
    }

    companion object {
        val COMMAND_TIMEOUT: Duration = Duration.ofMillis(250)
        val CONNECT_TIMEOUT: Duration = Duration.ofMillis(500)
    }
}
