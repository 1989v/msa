package com.kgd.analytics.infrastructure.messaging

import com.kgd.analytics.application.event.port.EventRepositoryPort
import com.kgd.common.analytics.AnalyticsEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.annotation.PreDestroy
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * 원장 토픽 → ClickHouse (ADR-0095).
 *
 * **크기와 시간 둘 다로 흘린다.** 예전에는 100건이 모여야만 썼는데, 그 트래픽이 나오지
 * 않는 서비스에서는 이벤트가 며칠씩 메모리에 앉아 있다가 **재시작 때 통째로 사라졌다.**
 * 실제로 노출·클릭 2건을 보내고 원장을 봤더니 비어 있었다 (2026-09-14 확인).
 *
 * 묶어 쓰는 것 자체는 맞다 — ClickHouse 는 한 건씩 INSERT 하면 파트가 잘게 쪼개져 병합이
 * 밀린다. 크기 조건은 그대로 두고 시간 조건을 더한다.
 */
@Component
class EventIngestionConsumer(
    private val eventRepository: EventRepositoryPort,
) {
    private val log = KotlinLogging.logger {}
    private val buffer = mutableListOf<AnalyticsEvent>()
    private val bufferLock = Any()

    companion object {
        const val BATCH_SIZE = 100

        /** 적게 모여도 이 시간이 지나면 쓴다. */
        const val FLUSH_INTERVAL_MS = 10_000L
    }

    @KafkaListener(
        topics = ["analytics.event.collected"],
        groupId = "analytics-event-ingestion",
        containerFactory = "kafkaListenerContainerFactory",
    )
    fun consume(event: AnalyticsEvent) {
        synchronized(bufferLock) {
            buffer.add(event)
            if (buffer.size >= BATCH_SIZE) flush()
        }
    }

    @Scheduled(fixedDelay = FLUSH_INTERVAL_MS)
    fun flushPeriodically() {
        synchronized(bufferLock) { flush() }
    }

    /** 내려갈 때 남은 것을 쓴다 — 안 그러면 마지막 묶음이 사라진다. */
    @PreDestroy
    fun flushOnShutdown() {
        synchronized(bufferLock) { flush() }
    }

    /** 반드시 [bufferLock] 을 쥔 채 부른다. */
    private fun flush() {
        if (buffer.isEmpty()) return
        val batch = buffer.toList()
        try {
            eventRepository.saveEvents(batch)
            // **쓰기가 성공한 뒤에만 비운다.** 먼저 비우면 실패한 묶음이 사라진다.
            buffer.clear()
            log.debug { "[events] ${batch.size}건 적재" }
        } catch (e: Exception) {
            log.error(e) { "[events] ${batch.size}건 적재 실패 — 버퍼에 남겨 다음 회차에 다시 시도한다" }
        }
    }
}
