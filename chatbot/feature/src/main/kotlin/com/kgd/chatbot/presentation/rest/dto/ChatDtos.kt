package com.kgd.chatbot.presentation.rest.dto

import com.kgd.chatbot.application.chat.usecase.AskQuestionUseCase
import com.kgd.chatbot.domain.model.ChannelType
import com.kgd.chatbot.domain.model.Conversation
import com.kgd.chatbot.domain.model.Message
import com.kgd.chatbot.domain.model.UserRole
import jakarta.validation.constraints.NotBlank
import java.math.BigDecimal
import java.time.Instant

data class SendMessageRequest(
    @field:NotBlank(message = "메시지 내용은 필수입니다")
    val message: String,
    val conversationId: Long? = null
) {
    fun toCommand(userId: String, userRole: UserRole, sessionId: String) = AskQuestionUseCase.Command(
        conversationId = conversationId,
        channelType = ChannelType.WEB,
        externalChannelId = sessionId,
        userId = userId,
        userRole = userRole,
        question = message
    )
}

data class ChatResponse(
    val conversationId: Long,
    val answer: String,
    val tokenCount: Int,
    val costUsd: BigDecimal
) {
    companion object {
        fun from(result: AskQuestionUseCase.Result) = ChatResponse(
            conversationId = result.conversationId,
            answer = result.answer,
            tokenCount = result.tokenCount,
            costUsd = result.costUsd
        )
    }
}

data class ConversationResponse(
    val id: Long,
    val channelType: String,
    val userId: String,
    val status: String,
    val messageCount: Int,
    val createdAt: Instant,
    val lastActiveAt: Instant
) {
    companion object {
        fun from(conversation: Conversation) = ConversationResponse(
            id = conversation.id!!,
            channelType = conversation.channelType.name,
            userId = conversation.userId,
            status = conversation.status.name,
            messageCount = conversation.messages.size,
            createdAt = conversation.createdAt,
            lastActiveAt = conversation.lastActiveAt
        )
    }
}

data class MessageResponse(
    val id: Long,
    val role: String,
    val content: String,
    val createdAt: Instant
) {
    companion object {
        fun from(message: Message) = MessageResponse(
            id = message.id!!,
            role = message.role.name,
            content = message.content,
            createdAt = message.createdAt
        )
    }
}
