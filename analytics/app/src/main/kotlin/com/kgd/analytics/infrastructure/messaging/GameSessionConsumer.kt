package com.kgd.analytics.infrastructure.messaging

import tools.jackson.databind.ObjectMapper
import com.kgd.analytics.domain.port.EventRepositoryPort
import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EventType
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import java.time.Instant

/**
 * ADR-0059 — game 이 발행하는 세션 이벤트를 ClickHouse 이벤트 파이프라인에 적재.
 * 세션 시작/종료는 저볼륨이라 배치 버퍼 없이 즉시 적재한다 (고볼륨 이벤트는 EventIngestionConsumer 경로).
 */
@Component
class GameSessionConsumer(
    private val objectMapper: ObjectMapper,
    private val eventRepository: EventRepositoryPort,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["game.session.started"],
        groupId = "analytics-game-session",
        containerFactory = "stringKafkaListenerContainerFactory",
    )
    fun consumeStarted(message: String) = ingest(message, EventType.GAME_SESSION_START)

    @KafkaListener(
        topics = ["game.session.ended"],
        groupId = "analytics-game-session",
        containerFactory = "stringKafkaListenerContainerFactory",
    )
    fun consumeEnded(message: String) = ingest(message, EventType.GAME_SESSION_END)

    private fun ingest(message: String, type: EventType) {
        val payload = runCatching { objectMapper.readValue(message, GameSessionPayload::class.java) }
            .onFailure { log.warn { "Bad game session payload: ${it.message}" } }
            .getOrNull() ?: return

        eventRepository.saveEvents(
            listOf(
                AnalyticsEvent(
                    eventId = "${type.name.lowercase()}:${payload.sessionKey}",
                    eventType = type,
                    userId = payload.memberId,
                    visitorId = payload.sessionKey,
                    sessionId = payload.sessionKey,
                    timestamp = payload.eventInstant() ?: Instant.now(),
                    experimentAssignments = null,
                    payload = buildMap {
                        put("gameId", payload.gameId)
                        put("gameSlug", payload.gameSlug)
                        payload.deviceType?.let { put("deviceType", it) }
                        payload.durationSec?.let { put("durationSec", it) }
                    },
                )
            )
        )
    }

    data class GameSessionPayload(
        val sessionKey: String = "",
        val gameId: Long = 0,
        val gameSlug: String = "",
        val memberId: Long? = null,
        val deviceType: String? = null,
        val durationSec: Long? = null,
        val startedAt: String? = null,
        val endedAt: String? = null,
    ) {
        fun eventInstant(): Instant? =
            (endedAt ?: startedAt)?.let { runCatching { Instant.parse(it) }.getOrNull() }
    }
}
