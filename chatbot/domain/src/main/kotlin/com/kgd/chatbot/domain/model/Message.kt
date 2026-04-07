package com.kgd.chatbot.domain.model

import java.math.BigDecimal
import java.time.Instant

class Message private constructor(
    val id: Long? = null,
    val role: MessageRole,
    val content: String,
    val tokenCount: Int,
    val costUsd: BigDecimal?,
    val createdAt: Instant = Instant.now()
) {
    companion object {
        fun createUserMessage(content: String, tokenCount: Int): Message {
            require(content.isNotBlank()) { "메시지 내용이 비어있을 수 없습니다" }
            return Message(
                role = MessageRole.USER,
                content = content,
                tokenCount = tokenCount,
                costUsd = null
            )
        }

        fun createAssistantMessage(content: String, tokenCount: Int, costUsd: BigDecimal): Message {
            return Message(
                role = MessageRole.ASSISTANT,
                content = content,
                tokenCount = tokenCount,
                costUsd = costUsd
            )
        }

        fun restore(
            id: Long,
            role: MessageRole,
            content: String,
            tokenCount: Int,
            costUsd: BigDecimal?,
            createdAt: Instant
        ): Message = Message(id, role, content, tokenCount, costUsd, createdAt)
    }
}
