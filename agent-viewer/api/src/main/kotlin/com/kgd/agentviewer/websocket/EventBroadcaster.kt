package com.kgd.agentviewer.websocket

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.agentviewer.model.WebSocketEvent
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import java.util.concurrent.CopyOnWriteArrayList

@Component
class EventBroadcaster(private val objectMapper: ObjectMapper) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val sessions = CopyOnWriteArrayList<WebSocketSession>()

    fun addSession(session: WebSocketSession) {
        sessions.add(session)
        log.info("WebSocket connected: {} (total: {})", session.id, sessions.size)
    }

    fun removeSession(session: WebSocketSession) {
        sessions.remove(session)
        log.info("WebSocket disconnected: {} (total: {})", session.id, sessions.size)
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
                log.warn("Failed to send to {}: {}", session.id, e.message)
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
