package com.kgd.agentviewer.scanner

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.io.File

data class ConversationMessage(
    val role: String, // "user" | "assistant"
    val content: String,
    val timestamp: String?,
    val model: String?,
    val inputTokens: Long?,
    val outputTokens: Long?
)

@Service
class ConversationService(private val objectMapper: ObjectMapper) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val claudeDir = File(System.getProperty("user.home"), ".claude/projects")

    fun getConversation(projectPath: String): List<ConversationMessage> {
        // Find the matching project directory
        val safePath = projectPath.trimStart('/').replace("/", "-")
        val projectDir = claudeDir.listFiles()
            ?.firstOrNull { it.name == safePath || projectPath.endsWith(it.name.substringAfterLast("-")) }
            ?: return emptyList()

        // Find most recent session file
        val sessionFile = projectDir.listFiles()
            ?.filter { it.extension == "jsonl" }
            ?.maxByOrNull { it.lastModified() }
            ?: return emptyList()

        return parseFullConversation(sessionFile)
    }

    private fun parseFullConversation(file: File): List<ConversationMessage> {
        val messages = mutableListOf<ConversationMessage>()

        for (line in file.readLines()) {
            if (line.isBlank()) continue
            try {
                val node = objectMapper.readTree(line)
                val type = node.get("type")?.asText() ?: continue
                val timestamp = node.get("timestamp")?.asText()

                when (type) {
                    "human", "user" -> {
                        val content = node.get("message")?.get("content")
                        val text = extractHumanText(content)
                        if (text != null && text.length > 2) {
                            messages.add(ConversationMessage(
                                role = "user",
                                content = text,
                                timestamp = timestamp,
                                model = null,
                                inputTokens = null,
                                outputTokens = null
                            ))
                        }
                    }
                    "assistant" -> {
                        val msg = node.get("message") ?: continue
                        val model = msg.get("model")?.asText()
                        val content = msg.get("content")
                        val text = extractAssistantText(content)
                        val usage = msg.get("usage")
                        val inputTokens = usage?.get("input_tokens")?.asLong()
                        val outputTokens = usage?.get("output_tokens")?.asLong()

                        if (text != null && text.length > 2) {
                            messages.add(ConversationMessage(
                                role = "assistant",
                                content = text,
                                timestamp = timestamp,
                                model = model,
                                inputTokens = inputTokens,
                                outputTokens = outputTokens
                            ))
                        }
                    }
                }
            } catch (_: Exception) { }
        }

        // Deduplicate: assistant messages can appear multiple times (streaming)
        // Keep only distinct content per consecutive role
        val deduped = mutableListOf<ConversationMessage>()
        for (msg in messages) {
            val last = deduped.lastOrNull()
            if (last != null && last.role == msg.role) {
                // Same role — replace with longer/later version
                if (msg.content.length >= last.content.length) {
                    deduped[deduped.lastIndex] = msg
                }
            } else {
                deduped.add(msg)
            }
        }

        return deduped
    }

    private fun extractHumanText(content: com.fasterxml.jackson.databind.JsonNode?): String? {
        if (content == null) return null
        if (content.isTextual) return content.asText()
        if (content.isArray) {
            // Look for actual user text, skip tool results
            for (item in content) {
                val itemType = item.get("type")?.asText()
                if (itemType == "text") {
                    val text = item.get("text")?.asText()
                    if (text != null && text.length > 2) return text
                }
            }
        }
        return null
    }

    private fun extractAssistantText(content: com.fasterxml.jackson.databind.JsonNode?): String? {
        if (content == null) return null
        if (content.isArray) {
            val texts = content
                .filter { it.get("type")?.asText() == "text" }
                .mapNotNull { it.get("text")?.asText() }
            return texts.joinToString("\n").takeIf { it.isNotBlank() }
        }
        return null
    }
}
