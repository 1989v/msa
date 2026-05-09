package com.kgd.quant.infrastructure.chart

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.application.chart.PriceStreamPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.PriceTick
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.annotation.PostConstruct
import jakarta.annotation.PreDestroy
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Primary
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.listener.ChannelTopic
import org.springframework.data.redis.listener.RedisMessageListenerContainer
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

/**
 * PriceStreamRedisFanout — multi-instance SSE fan-out via Redis pubsub.
 *
 * 활성 시 (`quant.charts.stream.redis.enabled=true`):
 * - publish 시 Redis channel 'quant:price:ticks' 으로 broadcast (originator=instanceId 포함)
 * - listener 가 다른 인스턴스의 publish 만 골라 InMemorySsePriceStreamAdapter.publishLocal 호출
 * - self-publish 는 listener 에서 originator 비교로 skip — in-process emit 은 publish() 가 직접 처리
 *
 * 비활성 시: bean 생성 안 됨, InMemorySsePriceStreamAdapter 만 단독 동작 (단일 인스턴스).
 */
@Component
@Primary
@ConditionalOnProperty(
    "quant.charts.stream.redis.enabled",
    havingValue = "true",
    matchIfMissing = false,
)
class PriceStreamRedisFanout(
    private val redis: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
    private val store: InMemorySsePriceStreamAdapter,
    @Value("\${quant.charts.stream.redis.channel:quant:price:ticks}")
    private val channelName: String,
) : PriceStreamPort by store {

    private val log = KotlinLogging.logger {}
    private val instanceId: String = UUID.randomUUID().toString()
    private val channel = ChannelTopic(channelName)

    private var container: RedisMessageListenerContainer? = null

    @PostConstruct
    fun init() {
        val factory = redis.connectionFactory
            ?: throw IllegalStateException("RedisConnectionFactory unavailable")
        val c = RedisMessageListenerContainer().apply {
            setConnectionFactory(factory)
            afterPropertiesSet()
            start()
        }
        c.addMessageListener(
            MessageListenerAdapter(this, "onMessage"),
            channel,
        )
        container = c
        log.info { "PriceStreamRedisFanout started instance=$instanceId channel=$channelName" }
    }

    @PreDestroy
    fun stop() {
        container?.stop()
        container = null
    }

    /** publish: in-process emit + Redis broadcast (다른 인스턴스 listener 가 처리). */
    override fun publish(tick: PriceTick) {
        store.publish(tick)
        runCatching {
            val env = mapOf(
                "originator" to instanceId,
                "asset" to tick.asset.value,
                "market" to tick.market.value,
                "price" to tick.price.toPlainString(),
                "volume" to tick.volume?.toPlainString(),
                "ts" to tick.ts.toString(),
            )
            redis.convertAndSend(channelName, objectMapper.writeValueAsString(env))
        }.onFailure {
            log.debug { "redis publish fail asset=${tick.asset.value} error=${it.message}" }
        }
    }

    /** RedisMessageListenerContainer 가 호출. JSON 환경 → tick 복원 → store 의 in-process emitter 에 fan-out. */
    fun onMessage(message: String) {
        runCatching {
            @Suppress("UNCHECKED_CAST")
            val env = objectMapper.readValue(message, Map::class.java) as Map<String, Any?>
            val originator = env["originator"] as? String
            if (originator == instanceId) return // self-publish skip
            val tick = PriceTick(
                asset = AssetCode((env["asset"] as String)),
                market = MarketCode((env["market"] as String)),
                price = BigDecimal(env["price"] as String),
                volume = (env["volume"] as? String)?.let { BigDecimal(it) },
                ts = Instant.parse(env["ts"] as String),
            )
            store.publish(tick)
        }.onFailure {
            log.debug { "redis fanout receive fail error=${it.message}" }
        }
    }
}
