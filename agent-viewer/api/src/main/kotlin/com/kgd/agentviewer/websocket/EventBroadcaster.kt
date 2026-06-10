package com.kgd.agentviewer.websocket

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.agentviewer.model.WebSocketEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import java.util.concurrent.CopyOnWriteArrayList

@Component
class EventBroadcaster(private val objectMapper: ObjectMapper) {

    private val log = KotlinLogging.logger {}
    private val sessions = CopyOnWriteArrayList<WebSocketSession>()

    fun addSession(session: WebSocketSession) {
        sessions.add(session)
        log.info { "WebSocket connected: ${session.id} (total: ${sessions.size})" }
    }

    fun removeSession(session: WebSocketSession) {
        sessions.remove(session)
        log.info { "WebSocket disconnected: ${session.id} (total: ${sessions.size})" }
    }

    fun broadcast(event: WebSocketEvent) {
        val json = objectMapper.writeValueAsString(event)
        val message = TextMessage(json)
        sessions.forEach { session ->
            try {
                if (session.isOpen) {
                    session.sendMessage(message)
                }
            } catch (e: Exception) {
                log.warn { "Failed to send to ${session.id}: ${e.message}" }
                sessions.remove(session)
            }
        }
    }

    fun sendTo(session: WebSocketSession, event: WebSocketEvent) {
        try {
            val json = objectMapper.writeValueAsString(event)
            session.sendMessage(TextMessage(json))
        } catch (e: Exception) {
            log.warn("Failed to send to {}: {}", session.id, e.message)
        }
    }
}
