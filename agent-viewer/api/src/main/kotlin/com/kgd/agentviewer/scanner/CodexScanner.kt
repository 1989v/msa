package com.kgd.agentviewer.scanner

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.io.File
import java.time.Instant

@Component
class CodexScanner(private val objectMapper: ObjectMapper) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val codexSessionDir = File(System.getProperty("user.home"), ".codex/sessions")
    private val codexHistoryFile = File(System.getProperty("user.home"), ".codex/history.jsonl")

    fun scan(): List<ScannedSession> {
        val sessions = mutableListOf<ScannedSession>()

        // Scan session directories
        if (codexSessionDir.exists()) {
            codexSessionDir.listFiles()
                ?.filter { it.isDirectory }
                ?.forEach { sessionDir ->
                    scanSessionDir(sessionDir)?.let { sessions.add(it) }
                }
        }

        // Fallback: history.jsonl
        if (sessions.isEmpty() && codexHistoryFile.exists()) {
            scanHistoryFile()?.let { sessions.add(it) }
        }

        return sessions.sortedByDescending { it.lastActivity }
    }

    private fun scanSessionDir(dir: File): ScannedSession? {
        val cutoff = System.currentTimeMillis() - 2 * 60 * 60 * 1000
        val jsonlFiles = dir.listFiles()
            ?.filter { it.extension == "jsonl" && it.lastModified() > cutoff }
            ?.sortedByDescending { it.lastModified() }
            ?: return null

        val file = jsonlFiles.firstOrNull() ?: return null

        var cwd: String? = null
        var lastUserMsg: String? = null
        var lastAssistantMsg: String? = null

        val lines = file.readLines().takeLast(50)
        for (line in lines) {
            if (line.isBlank()) continue
            try {
                val node = objectMapper.readTree(line)
                val type = node.get("type")?.asText()

                if (type == "session_meta") {
                    cwd = node.get("cwd")?.asText()
                }

                val role = node.get("role")?.asText()
                val content = extractContent(node)
                if (content != null) {
                    when (role) {
                        "user" -> lastUserMsg = content.take(200)
                        "assistant" -> lastAssistantMsg = content.take(200)
                    }
                }
            } catch (_: Exception) { }
        }

        val projectName = cwd?.substringAfterLast('/') ?: dir.name

        return ScannedSession(
            tool = AiTool.CODEX,
            projectPath = cwd ?: dir.absolutePath,
            projectName = projectName,
            lastActivity = Instant.ofEpochMilli(file.lastModified()),
            status = if (isCodexActive()) "active" else "completed",
            lastUserMessage = lastUserMsg,
            lastAssistantMessage = lastAssistantMsg
        )
    }

    private fun scanHistoryFile(): ScannedSession? {
        if (!codexHistoryFile.exists()) return null

        var lastUserMsg: String? = null
        var lastAssistantMsg: String? = null

        val lines = codexHistoryFile.readLines().takeLast(30)
        for (line in lines) {
            if (line.isBlank()) continue
            try {
                val node = objectMapper.readTree(line)
                val role = node.get("role")?.asText()
                val content = extractContent(node)
                if (content != null) {
                    when (role) {
                        "user" -> lastUserMsg = content.take(200)
                        "assistant" -> lastAssistantMsg = content.take(200)
                    }
                }
            } catch (_: Exception) { }
        }

        if (lastUserMsg == null && lastAssistantMsg == null) return null

        return ScannedSession(
            tool = AiTool.CODEX,
            projectPath = codexHistoryFile.absolutePath,
            projectName = "Codex",
            lastActivity = Instant.ofEpochMilli(codexHistoryFile.lastModified()),
            status = if (isCodexActive()) "active" else "completed",
            lastUserMessage = lastUserMsg,
            lastAssistantMessage = lastAssistantMsg
        )
    }

    private fun extractContent(node: com.fasterxml.jackson.databind.JsonNode): String? {
        val content = node.get("content")
        if (content == null) return null
        if (content.isTextual) return content.asText()
        if (content.isArray) {
            return content.firstOrNull { it.get("type")?.asText() == "text" }
                ?.get("text")?.asText()
        }
        return null
    }

    private fun isCodexActive(): Boolean {
        return try {
            val process = ProcessBuilder("sh", "-c", "ps -eo command | grep -i codex | grep -v grep")
                .redirectErrorStream(true).start()
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()
            output.isNotBlank()
        } catch (_: Exception) { false }
    }
}
