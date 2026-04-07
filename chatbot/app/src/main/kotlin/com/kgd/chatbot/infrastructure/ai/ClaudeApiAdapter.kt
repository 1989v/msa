package com.kgd.chatbot.infrastructure.ai

import com.kgd.chatbot.application.chat.port.AiModelPort
import com.kgd.chatbot.application.chat.port.AiModelRequest
import com.kgd.chatbot.application.chat.port.AiModelResponse
import com.kgd.chatbot.config.ChatbotProperties
import com.kgd.chatbot.domain.exception.AiModelException
import com.kgd.chatbot.domain.model.MessageRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.math.BigDecimal
import java.math.RoundingMode
import kotlin.time.Duration.Companion.seconds

@Component
class ClaudeApiAdapter(
    private val properties: ChatbotProperties
) : AiModelPort {

    private val log = LoggerFactory.getLogger(javaClass)

    private val semaphore = Semaphore(properties.ai.maxConcurrent)

    private val restClient = RestClient.builder()
        .baseUrl("https://api.anthropic.com")
        .defaultHeader("x-api-key", properties.ai.apiKey)
        .defaultHeader("anthropic-version", "2023-06-01")
        .defaultHeader("content-type", "application/json")
        .build()

    override suspend fun generateAnswer(request: AiModelRequest): AiModelResponse {
        return withTimeout(properties.ai.timeoutSeconds.seconds + 60.seconds) {
            semaphore.withPermit {
                withTimeout(properties.ai.timeoutSeconds.seconds) {
                    callClaude(request)
                }
            }
        }
    }

    private suspend fun callClaude(request: AiModelRequest): AiModelResponse =
        withContext(Dispatchers.IO) {
            try {
                val messagesPayload = buildMessages(request)
                val body = mapOf(
                    "model" to request.model,
                    "max_tokens" to request.maxTokens,
                    "system" to request.systemPrompt,
                    "messages" to messagesPayload
                )

                val response = restClient.post()
                    .uri("/v1/messages")
                    .body(body)
                    .retrieve()
                    .body(Map::class.java)
                    ?: throw AiModelException("빈 응답")

                parseResponse(response)
            } catch (e: AiModelException) {
                throw e
            } catch (e: Exception) {
                log.error("Claude API 호출 실패", e)
                throw AiModelException(e.message ?: "알 수 없는 오류")
            }
        }

    private fun buildMessages(request: AiModelRequest): List<Map<String, String>> {
        val messages = mutableListOf<Map<String, String>>()

        request.conversationHistory.forEach { msg ->
            val role = when (msg.role) {
                MessageRole.USER -> "user"
                MessageRole.ASSISTANT -> "assistant"
                MessageRole.SYSTEM -> return@forEach
            }
            messages.add(mapOf("role" to role, "content" to msg.content))
        }

        messages.add(mapOf("role" to "user", "content" to request.userQuestion))
        return messages
    }

    @Suppress("UNCHECKED_CAST")
    private fun parseResponse(response: Map<*, *>): AiModelResponse {
        val content = response["content"] as? List<Map<String, Any>>
            ?: throw AiModelException("응답 content 파싱 실패")

        val text = content.firstOrNull { it["type"] == "text" }?.get("text") as? String
            ?: throw AiModelException("텍스트 응답 없음")

        val usage = response["usage"] as? Map<String, Any> ?: emptyMap()
        val inputTokens = (usage["input_tokens"] as? Number)?.toInt() ?: 0
        val outputTokens = (usage["output_tokens"] as? Number)?.toInt() ?: 0

        val costUsd = calculateCost(inputTokens, outputTokens)

        return AiModelResponse(
            answer = text,
            inputTokens = inputTokens,
            outputTokens = outputTokens,
            costUsd = costUsd
        )
    }

    private fun calculateCost(inputTokens: Int, outputTokens: Int): BigDecimal {
        // Claude Sonnet pricing: $3/1M input, $15/1M output
        val inputCost = BigDecimal(inputTokens)
            .multiply(BigDecimal("3.00"))
            .divide(BigDecimal("1000000"), 6, RoundingMode.HALF_UP)
        val outputCost = BigDecimal(outputTokens)
            .multiply(BigDecimal("15.00"))
            .divide(BigDecimal("1000000"), 6, RoundingMode.HALF_UP)
        return inputCost.add(outputCost)
    }
}
