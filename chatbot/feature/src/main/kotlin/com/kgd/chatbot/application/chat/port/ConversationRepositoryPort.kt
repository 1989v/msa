package com.kgd.chatbot.application.chat.port

import com.kgd.chatbot.domain.model.ChannelType
import com.kgd.chatbot.domain.model.Conversation

interface ConversationRepositoryPort {
    fun save(conversation: Conversation): Conversation
    fun findById(id: Long): Conversation?
    fun findByExternalChannelId(channelType: ChannelType, externalChannelId: String): Conversation?
}
