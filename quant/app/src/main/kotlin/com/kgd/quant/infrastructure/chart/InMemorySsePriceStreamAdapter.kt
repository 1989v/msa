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
 * InMemorySsePriceStreamAdapter — 단일 인스턴스 in-memory SSE registry.
 *
 * Multi-instance fan-out: Redis pubsub 도입 시 RedisBackedSsePriceStreamAdapter 가 publish 를 Redis 로 broadcast,
 * 본 adapter 는 그대로 emitter registry 만 담당.
 *
 * Last-Event-ID replay (TG-13 보강): 자산별 ring buffer (최근 100 tick) 보관 → reconnect 시
 * 클라이언트가 보낸 Last-Event-ID 이후의 tick 을 즉시 emit.
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

    /** 자산 키 → 최근 N tick (replay 용 ring buffer). */
    private val recent = ConcurrentHashMap<String, java.util.ArrayDeque<PriceTick>>()

    private val recentCapacity = 100

    override fun subscribe(
        asset: AssetCode,
        market: MarketCode,
        lastEventId: String?,
    ): SseEmitter {
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

        // Last-Event-ID replay
        if (lastEventId != null) {
            replayAfter(emitter, key, lastEventId)
        }
        return emitter
    }

    private fun replayAfter(emitter: SseEmitter, key: String, lastEventId: String) {
        val sinceMs = lastEventId.toLongOrNull() ?: return
        val buffer = recent[key] ?: return
        // ArrayDeque iteration 은 thread-safe X — copy 해서 replay.
        val snapshot = synchronized(buffer) { buffer.toList() }
        snapshot.asSequence()
            .filter { it.ts.toEpochMilli() > sinceMs }
            .forEach { tick ->
                runCatching { emitter.send(toEvent(tick)) }
                    .onFailure { log.debug { "sse replay fail key=$key error=${it.message}" } }
            }
    }

    override fun publish(tick: PriceTick) {
        val key = key(tick.asset, tick.market)
        // ring buffer 갱신 (구독자 없어도 보관 — reconnect 직전 tick 도 살림)
        val buffer = recent.computeIfAbsent(key) { java.util.ArrayDeque() }
        synchronized(buffer) {
            buffer.add(tick)
            while (buffer.size > recentCapacity) buffer.removeFirst()
        }

        val list = registry[key] ?: return
        if (list.isEmpty()) return
        val event = toEvent(tick)

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

    private fun toEvent(tick: PriceTick): SseEmitter.SseEventBuilder {
        val payload = mapOf(
            "asset" to tick.asset.value,
            "market" to tick.market.value,
            "price" to tick.price.toPlainString(),
            "volume" to tick.volume?.toPlainString(),
            "ts" to tick.ts.toString(),
        )
        return SseEmitter.event()
            .name("tick")
            .id(tick.ts.toEpochMilli().toString())
            .data(payload)
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
