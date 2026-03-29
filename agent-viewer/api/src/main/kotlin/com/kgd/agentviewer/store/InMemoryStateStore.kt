package com.kgd.agentviewer.store

import com.kgd.agentviewer.model.*
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

@Component
class InMemoryStateStore {

    private val sessions = ConcurrentHashMap<String, AgentSession>()

    fun startSession(sessionId: String): AgentSession {
        val session = AgentSession(sessionId = sessionId)
        sessions[sessionId] = session
        return session
    }

    fun endSession(sessionId: String): AgentSession? {
        return sessions[sessionId]?.also { it.endedAt = Instant.now() }
    }

    fun addSubagent(sessionId: String, agentId: String, agentType: String): SubagentInfo {
        val session = sessions.getOrPut(sessionId) { AgentSession(sessionId = sessionId) }
        val subagent = SubagentInfo(
            agentId = agentId,
            agentType = agentType,
            sessionId = sessionId
        )
        session.subagents[agentId] = subagent
        return subagent
    }

    fun stopSubagent(agentId: String, lastMessage: String?): SubagentInfo? {
        for (session in sessions.values) {
            session.subagents[agentId]?.let { sub ->
                sub.endedAt = Instant.now()
                sub.lastMessage = lastMessage
                return sub
            }
        }
        return null
    }

    fun addTask(sessionId: String, taskId: String, subject: String?, description: String?): TaskInfo {
        val session = sessions.getOrPut(sessionId) { AgentSession(sessionId = sessionId) }
        val task = TaskInfo(
            taskId = taskId,
            sessionId = sessionId,
            subject = subject,
            description = description
        )
        session.tasks[taskId] = task
        return task
    }

    fun completeTask(taskId: String): TaskInfo? {
        for (session in sessions.values) {
            session.tasks[taskId]?.let { task ->
                task.completedAt = Instant.now()
                return task
            }
        }
        return null
    }

    fun getSnapshot(): StateSnapshot {
        val allSessions = sessions.values.toList()
        val activeSubagents = allSessions.flatMap { s ->
            s.subagents.values.filter { it.isActive }
        }
        val activeTasks = allSessions.flatMap { s ->
            s.tasks.values.filter { !it.isCompleted }
        }
        return StateSnapshot(
            sessions = allSessions.sortedByDescending { it.startedAt },
            activeSubagents = activeSubagents,
            activeTasks = activeTasks
        )
    }

    fun getSession(sessionId: String): AgentSession? = sessions[sessionId]

    fun getActiveSessions(): List<AgentSession> = sessions.values.filter { it.isActive }
}
