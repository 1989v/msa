package com.kgd.agentviewer.websocket

import com.kgd.agentviewer.model.EventType
import com.kgd.agentviewer.model.WebSocketEvent
import com.kgd.agentviewer.scanner.MultiToolScanService
import com.kgd.agentviewer.store.InMemoryStateStore
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler

@Component
class AgentEventWebSocketHandler(
    private val broadcaster: EventBroadcaster,
    private val stateStore: InMemoryStateStore,
    private val scanService: MultiToolScanService
) : TextWebSocketHandler() {

    override fun afterConnectionEstablished(session: WebSocketSession) {
        broadcaster.addSession(session)
        // Send hook-based state
        val snapshot = stateStore.getSnapshot()
        broadcaster.sendTo(session, WebSocketEvent(
            type = EventType.STATE_SNAPSHOT,
            data = mapOf("snapshot" to snapshot)
        ))
        // Send scanned AI tool sessions
        val scanned = scanService.getLastScan()
        for (s in scanned) {
            broadcaster.sendTo(session, WebSocketEvent(
                type = EventType.SESSION_START,
                data = mapOf(
                    "source" to "scan",
                    "tool" to s.tool.displayName,
                    "toolColor" to s.tool.color,
                    "projectName" to s.projectName,
                    "projectPath" to s.projectPath,
                    "status" to s.status,
                    "lastActivity" to s.lastActivity,
                    "lastUserMessage" to s.lastUserMessage,
                    "lastAssistantMessage" to s.lastAssistantMessage
                )
            ))
        }
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        broadcaster.removeSession(session)
    }
}
