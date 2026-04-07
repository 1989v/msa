package com.kgd.chatbot.application.chat.usecase

import com.kgd.chatbot.domain.model.Conversation

interface GetConversationUseCase {
    fun execute(command: Command): Conversation

    data class Command(val conversationId: Long)
}
