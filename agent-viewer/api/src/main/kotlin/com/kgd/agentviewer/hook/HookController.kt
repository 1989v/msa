package com.kgd.agentviewer.hook

import com.kgd.agentviewer.model.EventType
import com.kgd.agentviewer.model.WebSocketEvent
import com.kgd.agentviewer.store.InMemoryStateStore
import com.kgd.agentviewer.websocket.EventBroadcaster
import org.slf4j.LoggerFactory
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/hooks")
class HookController(
    private val stateStore: InMemoryStateStore,
    private val broadcaster: EventBroadcaster
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @PostMapping("/session-start")
    fun sessionStart(@RequestBody body: Map<String, Any?>) {
        val sessionId = body["session_id"] as? String ?: return
        log.info("Session started: {}", sessionId)
        val session = stateStore.startSession(sessionId)
        broadcaster.broadcast(WebSocketEvent(
            type = EventType.SESSION_START,
            data = mapOf("sessionId" to session.sessionId, "startedAt" to session.startedAt)
        ))
    }

    @PostMapping("/session-end")
    fun sessionEnd(@RequestBody body: Map<String, Any?>) {
        val sessionId = body["session_id"] as? String ?: return
        log.info("Session ended: {}", sessionId)
        val session = stateStore.endSession(sessionId)
        broadcaster.broadcast(WebSocketEvent(
            type = EventType.SESSION_END,
            data = mapOf("sessionId" to sessionId, "endedAt" to session?.endedAt)
        ))
    }

    @PostMapping("/subagent-start")
    fun subagentStart(@RequestBody body: Map<String, Any?>) {
        val sessionId = body["session_id"] as? String ?: return
        val agentId = body["agent_id"] as? String ?: return
        val agentType = body["agent_type"] as? String ?: "unknown"
        log.info("Subagent started: {} (type: {}, session: {})", agentId, agentType, sessionId)
        val subagent = stateStore.addSubagent(sessionId, agentId, agentType)
        broadcaster.broadcast(WebSocketEvent(
            type = EventType.SUBAGENT_START,
            data = mapOf(
                "sessionId" to sessionId,
                "agentId" to subagent.agentId,
                "agentType" to subagent.agentType,
                "startedAt" to subagent.startedAt
            )
        ))
    }

    @PostMapping("/subagent-stop")
    fun subagentStop(@RequestBody body: Map<String, Any?>) {
        val agentId = body["agent_id"] as? String ?: return
        val lastMessage = body["last_assistant_message"] as? String
        log.info("Subagent stopped: {}", agentId)
        val subagent = stateStore.stopSubagent(agentId, lastMessage)
        broadcaster.broadcast(WebSocketEvent(
            type = EventType.SUBAGENT_STOP,
            data = mapOf(
                "agentId" to agentId,
                "agentType" to subagent?.agentType,
                "endedAt" to subagent?.endedAt,
                "lastMessage" to lastMessage?.take(200)
            )
        ))
    }

    @PostMapping("/task-created")
    fun taskCreated(@RequestBody body: Map<String, Any?>) {
        val sessionId = body["session_id"] as? String ?: return
        val taskId = body["task_id"] as? String ?: "task-${System.currentTimeMillis()}"
        val subject = body["subject"] as? String
        val description = body["description"] as? String
        log.info("Task created: {} (session: {})", taskId, sessionId)
        val task = stateStore.addTask(sessionId, taskId, subject, description)
        broadcaster.broadcast(WebSocketEvent(
            type = EventType.TASK_CREATED,
            data = mapOf(
                "sessionId" to sessionId,
                "taskId" to task.taskId,
                "subject" to task.subject,
                "createdAt" to task.createdAt
            )
        ))
    }

    @PostMapping("/task-completed")
    fun taskCompleted(@RequestBody body: Map<String, Any?>) {
        val taskId = body["task_id"] as? String ?: return
        log.info("Task completed: {}", taskId)
        val task = stateStore.completeTask(taskId)
        broadcaster.broadcast(WebSocketEvent(
            type = EventType.TASK_COMPLETED,
            data = mapOf(
                "taskId" to taskId,
                "completedAt" to task?.completedAt
            )
        ))
    }
}
