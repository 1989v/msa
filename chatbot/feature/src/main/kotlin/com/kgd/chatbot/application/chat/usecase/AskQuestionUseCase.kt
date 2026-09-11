package com.kgd.chatbot.application.chat.usecase

import com.kgd.chatbot.domain.model.ChannelType
import com.kgd.chatbot.domain.model.UserRole
import java.math.BigDecimal

interface AskQuestionUseCase {
    suspend fun execute(command: Command): Result

    data class Command(
        val conversationId: Long?,
        val channelType: ChannelType,
        val externalChannelId: String,
        val userId: String,
        val userRole: UserRole,
        val question: String
    )

    data class Result(
        val conversationId: Long,
        val answer: String,
        val tokenCount: Int,
        val costUsd: BigDecimal
    )
}
