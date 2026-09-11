package com.kgd.chatbot.application.chat.usecase

interface CloseConversationUseCase {
    fun execute(command: Command)

    data class Command(val conversationId: Long)
}
