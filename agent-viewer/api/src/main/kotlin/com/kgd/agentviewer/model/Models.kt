package com.kgd.agentviewer.model

import java.time.Instant

enum class EventType {
    SESSION_START, SESSION_END,
    SUBAGENT_START, SUBAGENT_STOP,
    TASK_CREATED, TASK_COMPLETED,
    STATE_SNAPSHOT
}

data class AgentSession(
    val sessionId: String,
    val startedAt: Instant = Instant.now(),
    var endedAt: Instant? = null,
    val subagents: MutableMap<String, SubagentInfo> = mutableMapOf(),
    val tasks: MutableMap<String, TaskInfo> = mutableMapOf()
) {
    val isActive: Boolean get() = endedAt == null
}

data class SubagentInfo(
    val agentId: String,
    val agentType: String,
    val sessionId: String,
    val startedAt: Instant = Instant.now(),
    var endedAt: Instant? = null,
    var lastMessage: String? = null
) {
    val isActive: Boolean get() = endedAt == null
}

data class TaskInfo(
    val taskId: String,
    val sessionId: String,
    val subject: String? = null,
    val description: String? = null,
    val createdAt: Instant = Instant.now(),
    var completedAt: Instant? = null
) {
    val isCompleted: Boolean get() = completedAt != null
}

data class WebSocketEvent(
    val type: EventType,
    val timestamp: Instant = Instant.now(),
    val data: Map<String, Any?>
)

data class StateSnapshot(
    val sessions: List<AgentSession>,
    val activeSubagents: List<SubagentInfo>,
    val activeTasks: List<TaskInfo>
)
