package com.kgd.agentviewer.websocket

import com.kgd.agentviewer.model.EventType
import com.kgd.agentviewer.model.WebSocketEvent
import com.kgd.agentviewer.store.InMemoryStateStore
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler

@Component
class AgentEventWebSocketHandler(
    private val broadcaster: EventBroadcaster,
    private val stateStore: InMemoryStateStore
) : TextWebSocketHandler() {

    override fun afterConnectionEstablished(session: WebSocketSession) {
        broadcaster.addSession(session)
        // Send current state snapshot on connect
        val snapshot = stateStore.getSnapshot()
        broadcaster.sendTo(session, WebSocketEvent(
            type = EventType.STATE_SNAPSHOT,
            data = mapOf("snapshot" to snapshot)
        ))
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        broadcaster.removeSession(session)
    }
}
