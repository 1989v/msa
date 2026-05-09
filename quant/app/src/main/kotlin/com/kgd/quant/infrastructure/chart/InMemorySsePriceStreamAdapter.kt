package com.kgd.quant.infrastructure.chart

import com.kgd.quant.application.chart.PriceStreamPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.PriceTick
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * InMemorySsePriceStreamAdapter — 단일 인스턴스 in-memory SSE registry (TG-13 prototype).
 *
 * Multi-instance fan-out 은 Redis pubsub 도입 (별도 PR) 시 추가.
 *
 * - 자산 키 = "asset:market"
 * - emitter 별 onCompletion / onTimeout / onError → registry 에서 제거
 * - heartbeat (15s 마다 SSE comment 발행) — 프록시/LB idle timeout 회피
 */
@Component
class InMemorySsePriceStreamAdapter : PriceStreamPort {
    private val log = KotlinLogging.logger {}

    /** 자산 키 → 활성 emitter 리스트 */
    private val registry = ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>>()

    override fun subscribe(asset: AssetCode, market: MarketCode): SseEmitter {
        val key = key(asset, market)
        // 30분 idle timeout — heartbeat 가 갱신
        val emitter = SseEmitter(30 * 60 * 1000L)
        val list = registry.computeIfAbsent(key) { CopyOnWriteArrayList() }
        list.add(emitter)

        emitter.onCompletion { list.remove(emitter) }
        emitter.onTimeout { list.remove(emitter); emitter.complete() }
        emitter.onError { list.remove(emitter) }

        // 초기 hello event — 클라이언트 연결 확인
        runCatching {
            emitter.send(
                SseEmitter.event()
                    .name("hello")
                    .data(mapOf("asset" to asset.value, "market" to market.value)),
            )
        }.onFailure {
            list.remove(emitter)
            log.debug { "sse hello fail key=$key error=${it.message}" }
        }
        return emitter
    }

    override fun publish(tick: PriceTick) {
        val key = key(tick.asset, tick.market)
        val list = registry[key] ?: return
        if (list.isEmpty()) return
        val payload = mapOf(
            "asset" to tick.asset.value,
            "market" to tick.market.value,
            "price" to tick.price.toPlainString(),
            "volume" to tick.volume?.toPlainString(),
            "ts" to tick.ts.toString(),
        )
        val event = SseEmitter.event()
            .name("tick")
            .id(tick.ts.toEpochMilli().toString())
            .data(payload)

        val dead = mutableListOf<SseEmitter>()
        list.forEach { e ->
            try {
                e.send(event)
            } catch (ex: IOException) {
                dead.add(e)
            } catch (ex: IllegalStateException) {
                dead.add(e)
            }
        }
        if (dead.isNotEmpty()) list.removeAll(dead)
    }

    override fun subscriberCount(asset: AssetCode, market: MarketCode): Int =
        registry[key(asset, market)]?.size ?: 0

    override fun totalSubscriberCount(): Int =
        registry.values.sumOf { it.size }

    /** Heartbeat — SSE comment 로 idle 끊김 방지. 15s 마다 모든 활성 emitter 에. */
    @Scheduled(fixedDelay = 15_000L)
    fun heartbeat() {
        if (registry.isEmpty()) return
        registry.forEach { (key, list) ->
            if (list.isEmpty()) return@forEach
            val dead = mutableListOf<SseEmitter>()
            list.forEach { e ->
                try {
                    e.send(SseEmitter.event().comment("heartbeat"))
                } catch (ex: IOException) {
                    dead.add(e)
                } catch (ex: IllegalStateException) {
                    dead.add(e)
                }
            }
            if (dead.isNotEmpty()) {
                list.removeAll(dead)
                log.debug { "sse heartbeat removed ${dead.size} dead emitters key=$key" }
            }
        }
    }

    private fun key(asset: AssetCode, market: MarketCode): String =
        "${asset.value}:${market.value}"
}
