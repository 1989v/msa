package com.kgd.agentviewer.scanner

import com.kgd.agentviewer.model.EventType
import com.kgd.agentviewer.model.WebSocketEvent
import com.kgd.agentviewer.websocket.EventBroadcaster
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.util.concurrent.ConcurrentHashMap

@Service
class MultiToolScanService(
    private val claudeScanner: ClaudeScanner,
    private val codexScanner: CodexScanner,
    private val broadcaster: EventBroadcaster
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val lastScan = ConcurrentHashMap<String, ScannedSession>()

    fun scanAll(): List<ScannedSession> {
        val results = mutableListOf<ScannedSession>()
        results.addAll(claudeScanner.scan())
        results.addAll(codexScanner.scan())
        // Future: results.addAll(openCodeScanner.scan())
        // Future: results.addAll(geminiScanner.scan())
        return results.sortedByDescending { it.lastActivity }
    }

    @Scheduled(fixedDelay = 5000)
    fun periodicScan() {
        val current = scanAll()
        val currentKeys = current.associateBy { "${it.tool}:${it.projectPath}" }

        // Detect new or changed sessions
        for ((key, session) in currentKeys) {
            val prev = lastScan[key]
            if (prev == null || prev.lastActivity != session.lastActivity || prev.status != session.status) {
                broadcaster.broadcast(WebSocketEvent(
                    type = EventType.SESSION_START, // reuse for scan updates
                    data = mapOf(
                        "source" to "scan",
                        "tool" to session.tool.displayName,
                        "toolColor" to session.tool.color,
                        "projectName" to session.projectName,
                        "projectPath" to session.projectPath,
                        "status" to session.status,
                        "lastActivity" to session.lastActivity,
                        "lastUserMessage" to session.lastUserMessage,
                        "lastAssistantMessage" to session.lastAssistantMessage
                    )
                ))
            }
        }

        lastScan.clear()
        lastScan.putAll(currentKeys)
    }

    fun getLastScan(): List<ScannedSession> {
        return lastScan.values.sortedByDescending { it.lastActivity }
    }
}
