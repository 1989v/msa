package com.kgd.chatbot.application.chat.port

import com.kgd.chatbot.domain.model.ChannelType

interface ChannelNotificationPort {
    val supportedChannelType: ChannelType
    suspend fun sendMessage(externalChannelId: String, message: String)
    suspend fun sendTypingIndicator(externalChannelId: String)
}
