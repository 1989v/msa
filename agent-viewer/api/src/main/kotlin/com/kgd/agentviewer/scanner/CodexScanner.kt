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

    fun scan(): List<ScannedSession> {
        if (!codexSessionDir.exists()) return emptyList()

        val cutoff = System.currentTimeMillis() - 2 * 60 * 60 * 1000
        val jsonlFiles = codexSessionDir.walkTopDown()
            .filter { it.extension == "jsonl" && it.lastModified() > cutoff }
            .sortedByDescending { it.lastModified() }
            .toList()

        return jsonlFiles.mapNotNull { file ->
            try {
                parseSessionFile(file)
            } catch (e: Exception) {
                log.debug("Failed to parse codex file {}: {}", file.name, e.message)
                null
            }
        }
    }

    private fun parseSessionFile(file: File): ScannedSession? {
        var cwd: String? = null
        var lastUserMsg: String? = null
        var lastAssistantMsg: String? = null
        var model: String? = null

        val lines = file.readLines()
        for (line in lines) {
            if (line.isBlank()) continue
            try {
                val node = objectMapper.readTree(line)
                val type = node.get("type")?.asText() ?: continue
                val payload = node.get("payload") ?: continue

                when (type) {
                    "session_meta" -> {
                        cwd = payload.get("cwd")?.asText()
                    }
                    "turn_context" -> {
                        model = payload.get("model")?.asText()
                    }
                    "response_item" -> {
                        val role = payload.get("role")?.asText()
                        val content = payload.get("content")
                        val text = if (content != null && content.isArray) {
                            content.firstOrNull { it.get("type")?.asText() == "output_text" }
                                ?.get("text")?.asText()
                                ?: content.firstOrNull { it.get("type")?.asText() == "input_text" }
                                    ?.get("text")?.asText()
                                ?: content.firstOrNull { it.get("type")?.asText() == "message" }
                                    ?.get("text")?.asText()
                        } else content?.asText()

                        if (text != null && text.length > 3) {
                            when (role) {
                                "user" -> lastUserMsg = text.take(200)
                                "assistant" -> lastAssistantMsg = text.take(200)
                            }
                        }
                    }
                    "event_msg" -> {
                        val msg = payload.get("message")?.asText()
                        if (msg != null && msg.length > 5) {
                            lastUserMsg = msg.take(200)
                        }
                    }
                }
            } catch (_: Exception) { }
        }

        if (lastUserMsg == null && lastAssistantMsg == null) return null

        val projectName = cwd?.substringAfterLast('/') ?: file.nameWithoutExtension.take(20)

        return ScannedSession(
            tool = AiTool.CODEX,
            projectPath = cwd ?: file.absolutePath,
            projectName = projectName,
            lastActivity = Instant.ofEpochMilli(file.lastModified()),
            status = if (isCodexActive()) "active" else "completed",
            lastUserMessage = lastUserMsg,
            lastAssistantMessage = lastAssistantMsg,
            model = model
        )
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
