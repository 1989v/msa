package com.kgd.game.infrastructure.kafka

import com.kgd.game.application.play.dto.GameSessionEndedEvent
import com.kgd.game.application.play.dto.GameSessionStartedEvent
import com.kgd.game.application.play.port.GameEventPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

/**
 * 세션 이벤트 발행 (수신: analytics). fire-and-forget — 발행 실패가 플레이 플로우를
 * 막지 않도록 비동기 콜백에서 error 로깅만 한다 (원본 집계는 analytics 소유, 설계 §4.2).
 */
@Component
class GameEventPublisher(
    @Qualifier("gameKafkaTemplate") private val kafkaTemplate: KafkaTemplate<String, Any>,
    @Value("\${game.kafka.topics.session-started:game.session.started}") private val sessionStartedTopic: String,
    @Value("\${game.kafka.topics.session-ended:game.session.ended}") private val sessionEndedTopic: String,
) : GameEventPort {

    private val log = KotlinLogging.logger {}

    override fun publishSessionStarted(event: GameSessionStartedEvent) =
        send(sessionStartedTopic, event.sessionKey, event)

    override fun publishSessionEnded(event: GameSessionEndedEvent) =
        send(sessionEndedTopic, event.sessionKey, event)

    private fun send(topic: String, key: String, payload: Any) {
        kafkaTemplate.send(topic, key, payload).whenComplete { _, ex ->
            if (ex != null) {
                log.error(ex) { "게임 이벤트 발행 실패: topic=$topic, key=$key" }
            }
        }
    }
}
