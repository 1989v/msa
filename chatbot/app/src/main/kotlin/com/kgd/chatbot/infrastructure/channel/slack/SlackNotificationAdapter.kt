package com.kgd.chatbot.infrastructure.channel.slack

import com.kgd.chatbot.application.chat.port.ChannelNotificationPort
import com.kgd.chatbot.config.ChatbotProperties
import com.kgd.chatbot.domain.model.ChannelType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

@Component
@ConditionalOnProperty("chatbot.slack.bot-token")
class SlackNotificationAdapter(
    private val properties: ChatbotProperties
) : ChannelNotificationPort {

    private val log = LoggerFactory.getLogger(javaClass)

    override val supportedChannelType = ChannelType.SLACK

    private val restClient = RestClient.builder()
        .baseUrl("https://slack.com/api")
        .defaultHeader("Authorization", "Bearer ${properties.slack.botToken}")
        .defaultHeader("Content-Type", "application/json")
        .build()

    override suspend fun sendMessage(externalChannelId: String, message: String) {
        withContext(Dispatchers.IO) {
            try {
                // externalChannelId 형식: "channelId:threadTs"
                val parts = externalChannelId.split(":")
                val channel = parts[0]
                val threadTs = parts.getOrNull(1)

                val body = buildMap {
                    put("channel", channel)
                    put("text", message)
                    if (threadTs != null) put("thread_ts", threadTs)
                }

                restClient.post()
                    .uri("/chat.postMessage")
                    .body(body)
                    .retrieve()
                    .body(Map::class.java)
            } catch (e: Exception) {
                log.error("Slack 메시지 전송 실패: channel={}", externalChannelId, e)
            }
        }
    }

    override suspend fun sendTypingIndicator(externalChannelId: String) {
        // Slack은 별도 typing indicator API 없음 — no-op
    }
}
