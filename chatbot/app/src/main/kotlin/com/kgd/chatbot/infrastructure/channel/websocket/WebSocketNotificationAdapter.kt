package com.kgd.chatbot.infrastructure.channel.websocket

import com.kgd.chatbot.application.chat.port.ChannelNotificationPort
import com.kgd.chatbot.domain.model.ChannelType
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Component

@Component
class WebSocketNotificationAdapter(
    private val messagingTemplate: SimpMessagingTemplate
) : ChannelNotificationPort {

    override val supportedChannelType = ChannelType.WEB

    override suspend fun sendMessage(externalChannelId: String, message: String) {
        val payload: Any = mapOf("type" to "message", "content" to message)
        messagingTemplate.convertAndSend("/topic/conversation/$externalChannelId", payload)
    }

    override suspend fun sendTypingIndicator(externalChannelId: String) {
        val payload: Any = mapOf("type" to "typing", "active" to true)
        messagingTemplate.convertAndSend("/topic/conversation/$externalChannelId/typing", payload)
    }
}
