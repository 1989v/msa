package com.kgd.agentviewer.scanner

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.io.File
import java.time.Instant

@Component
class ClaudeScanner(private val objectMapper: ObjectMapper) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val claudeDir = File(System.getProperty("user.home"), ".claude/projects")

    fun scan(): List<ScannedSession> {
        if (!claudeDir.exists()) return emptyList()

        return claudeDir.listFiles()
            ?.filter { it.isDirectory }
            ?.flatMap { projectDir -> scanProject(projectDir) }
            ?.sortedByDescending { it.lastActivity }
            ?: emptyList()
    }

    private fun scanProject(projectDir: File): List<ScannedSession> {
        val projectPath = projectDir.name.replace("-", "/")
        val projectName = projectDir.name.substringAfterLast("-")

        // Find recent JSONL session files (modified within 2 hours)
        val cutoff = System.currentTimeMillis() - 2 * 60 * 60 * 1000
        val sessionFiles = projectDir.listFiles()
            ?.filter { it.extension == "jsonl" && it.lastModified() > cutoff }
            ?.sortedByDescending { it.lastModified() }
            ?: return emptyList()

        return sessionFiles.mapNotNull { file ->
            try {
                parseSessionFile(file, projectPath, projectName)
            } catch (e: Exception) {
                log.debug("Failed to parse {}: {}", file.name, e.message)
                null
            }
        }
    }

    private fun parseSessionFile(file: File, projectPath: String, projectName: String): ScannedSession? {
        var lastUserMsg: String? = null
        var lastAssistantMsg: String? = null
        var lastRole: String? = null

        // Read last 50 lines for efficiency
        val lines = file.readLines().takeLast(50)

        for (line in lines) {
            if (line.isBlank()) continue
            try {
                val node = objectMapper.readTree(line)
                val type = node.get("type")?.asText()
                when (type) {
                    "human", "user" -> {
                        val msg = node.get("message")?.get("content")?.asText()
                            ?: node.get("content")?.asText()
                        if (msg != null) {
                            lastUserMsg = msg.take(200)
                            lastRole = "user"
                        }
                    }
                    "assistant" -> {
                        val content = node.get("message")?.get("content")
                        if (content != null && content.isArray) {
                            val text = content.firstOrNull { it.get("type")?.asText() == "text" }
                                ?.get("text")?.asText()
                            if (text != null) {
                                lastAssistantMsg = text.take(200)
                                lastRole = "assistant"
                            }
                        }
                    }
                }
            } catch (_: Exception) {
                // Skip malformed lines
            }
        }

        if (lastUserMsg == null && lastAssistantMsg == null) return null

        val status = when {
            isProcessActive(projectPath) -> "active"
            lastRole == "user" -> "waiting"
            else -> "completed"
        }

        return ScannedSession(
            tool = AiTool.CLAUDE,
            projectPath = projectPath,
            projectName = projectName,
            lastActivity = Instant.ofEpochMilli(file.lastModified()),
            status = status,
            lastUserMessage = lastUserMsg,
            lastAssistantMessage = lastAssistantMsg
        )
    }

    private fun isProcessActive(projectPath: String): Boolean {
        return try {
            val process = ProcessBuilder("sh", "-c", "ps -eo pid,command | grep -i claude | grep -v grep")
                .redirectErrorStream(true)
                .start()
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()
            output.isNotBlank()
        } catch (_: Exception) {
            false
        }
    }
}
