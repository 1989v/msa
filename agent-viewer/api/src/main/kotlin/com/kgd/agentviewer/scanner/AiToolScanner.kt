package com.kgd.agentviewer.scanner

import java.time.Instant

enum class AiTool(val displayName: String, val color: String) {
    CLAUDE("Claude Code", "#f97316"),
    CODEX("Codex", "#d946ef"),
    OPENCODE("OpenCode", "#06b6d4"),
    GEMINI("Gemini", "#22c55e")
}

data class ScannedSession(
    val tool: AiTool,
    val projectPath: String,
    val projectName: String,
    val lastActivity: Instant,
    val status: String, // "active", "waiting", "completed"
    val lastUserMessage: String?,
    val lastAssistantMessage: String?,
    val costCents: Int? = null,
    val totalInputTokens: Long? = null,
    val totalOutputTokens: Long? = null,
    val cacheReadTokens: Long? = null,
    val cacheWriteTokens: Long? = null,
    val model: String? = null
)
