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

    // Claude pricing (per 1M tokens, in cents)
    private val PRICING = mapOf(
        "claude-opus-4-6" to Pair(1500, 7500),           // $15/$75
        "claude-sonnet-4-6" to Pair(300, 1500),           // $3/$15
        "claude-haiku-4-5" to Pair(80, 400),              // $0.80/$4
    )
    private val DEFAULT_PRICING = Pair(1500, 7500) // default to opus

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
        var model: String? = null

        var totalInput = 0L
        var totalOutput = 0L
        var totalCacheRead = 0L
        var totalCacheWrite = 0L

        val lines = file.readLines().takeLast(100)

        for (line in lines) {
            if (line.isBlank()) continue
            try {
                val node = objectMapper.readTree(line)
                val type = node.get("type")?.asText()

                when (type) {
                    "human", "user" -> {
                        val content = node.get("message")?.get("content")
                        if (content != null) {
                            val msg = if (content.isTextual) {
                                content.asText()
                            } else if (content.isArray) {
                                content.firstOrNull { it.get("type")?.asText() == "text" }
                                    ?.get("text")?.asText()
                                    ?: content.firstOrNull { it.get("type")?.asText() == "tool_result" }
                                        ?.get("content")?.asText()
                            } else null

                            if (msg != null && !msg.startsWith("{") && msg.length > 5) {
                                lastUserMsg = msg.take(200)
                                lastRole = "user"
                            }
                        }
                    }
                    "assistant" -> {
                        val msg = node.get("message")
                        if (msg != null) {
                            // Extract model
                            msg.get("model")?.asText()?.let { model = it }

                            // Extract usage (token counts)
                            val usage = msg.get("usage")
                            if (usage != null) {
                                totalInput += usage.get("input_tokens")?.asLong() ?: 0
                                totalOutput += usage.get("output_tokens")?.asLong() ?: 0
                                totalCacheRead += usage.get("cache_read_input_tokens")?.asLong() ?: 0
                                totalCacheWrite += usage.get("cache_creation_input_tokens")?.asLong() ?: 0
                            }

                            // Extract text
                            val content = msg.get("content")
                            if (content != null && content.isArray) {
                                val text = content.firstOrNull { it.get("type")?.asText() == "text" }
                                    ?.get("text")?.asText()
                                if (text != null && text.length > 3) {
                                    lastAssistantMsg = text.take(200)
                                    lastRole = "assistant"
                                }
                            }
                        }
                    }
                }
            } catch (_: Exception) { }
        }

        if (lastUserMsg == null && lastAssistantMsg == null) return null

        val pricing = PRICING[model] ?: DEFAULT_PRICING
        // Cost = (input * inputPrice + output * outputPrice) / 1_000_000
        // Cache read = 10% of input price, cache write = 25% of input price
        val inputCostCents = ((totalInput * pricing.first) / 1_000_000).toInt()
        val outputCostCents = ((totalOutput * pricing.second) / 1_000_000).toInt()
        val cacheReadCostCents = ((totalCacheRead * pricing.first / 10) / 1_000_000).toInt()
        val cacheWriteCostCents = ((totalCacheWrite * pricing.first / 4) / 1_000_000).toInt()
        val totalCostCents = inputCostCents + outputCostCents + cacheReadCostCents + cacheWriteCostCents

        val status = when {
            isProcessActive() -> "active"
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
            lastAssistantMessage = lastAssistantMsg,
            costCents = totalCostCents,
            totalInputTokens = totalInput + totalCacheRead + totalCacheWrite,
            totalOutputTokens = totalOutput,
            cacheReadTokens = totalCacheRead,
            cacheWriteTokens = totalCacheWrite,
            model = model
        )
    }

    private fun isProcessActive(): Boolean {
        return try {
            val process = ProcessBuilder("sh", "-c", "ps -eo pid,command | grep -i claude | grep -v grep")
                .redirectErrorStream(true).start()
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()
            output.isNotBlank()
        } catch (_: Exception) { false }
    }
}
