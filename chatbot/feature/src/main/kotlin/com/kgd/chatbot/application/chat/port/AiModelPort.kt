package com.kgd.chatbot.application.chat.port

import com.kgd.chatbot.domain.model.Message
import java.math.BigDecimal

interface AiModelPort {
    suspend fun generateAnswer(request: AiModelRequest): AiModelResponse
}

data class AiModelRequest(
    val systemPrompt: String,
    val conversationHistory: List<Message>,
    val userQuestion: String,
    val maxTokens: Int = 4096,
    val model: String = "claude-sonnet-4-6"
)

data class AiModelResponse(
    val answer: String,
    val inputTokens: Int,
    val outputTokens: Int,
    val costUsd: BigDecimal
)
