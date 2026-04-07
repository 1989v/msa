package com.kgd.chatbot.presentation.slack

import com.kgd.chatbot.application.chat.port.ChannelNotificationPort
import com.kgd.chatbot.application.chat.usecase.AskQuestionUseCase
import com.kgd.chatbot.config.ChatbotProperties
import com.kgd.chatbot.domain.model.ChannelType
import com.kgd.chatbot.domain.model.UserRole
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

@RestController
@RequestMapping("/api/v1/chat/slack")
@ConditionalOnProperty("chatbot.slack.signing-secret")
class SlackEventController(
    private val askQuestionUseCase: AskQuestionUseCase,
    private val notificationAdapters: List<ChannelNotificationPort>,
    private val properties: ChatbotProperties
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val scope = CoroutineScope(Dispatchers.Default)

    @PostMapping("/events")
    fun handleEvent(
        @RequestBody body: Map<String, Any>,
        @RequestHeader("X-Slack-Signature", required = false) signature: String?,
        @RequestHeader("X-Slack-Request-Timestamp", required = false) timestamp: String?
    ): ResponseEntity<Any> {
        // URL verification challenge
        if (body["type"] == "url_verification") {
            return ResponseEntity.ok(mapOf("challenge" to body["challenge"]))
        }

        // Signing secret 검증
        if (!verifySignature(signature, timestamp, body.toString())) {
            return ResponseEntity.status(401).build()
        }

        val event = body["event"] as? Map<*, *> ?: return ResponseEntity.ok().build()
        val eventType = event["type"] as? String ?: return ResponseEntity.ok().build()

        // 봇 메시지 무시
        if (event["bot_id"] != null) return ResponseEntity.ok().build()

        when (eventType) {
            "app_mention" -> handleMention(event)
            "message" -> handleMessage(event)
        }

        // 3초 ACK
        return ResponseEntity.ok().build()
    }

    private fun handleMention(event: Map<*, *>) {
        val text = (event["text"] as? String)
            ?.replace(Regex("<@[A-Z0-9]+>"), "")?.trim()
            ?: return
        val channel = event["channel"] as? String ?: return
        val user = event["user"] as? String ?: return
        val threadTs = (event["thread_ts"] ?: event["ts"]) as? String ?: return

        processAsync(channel, threadTs, user, text)
    }

    private fun handleMessage(event: Map<*, *>) {
        // 스레드 내 후속 메시지만 처리 (멘션 없이)
        val threadTs = event["thread_ts"] as? String ?: return
        val text = event["text"] as? String ?: return
        val channel = event["channel"] as? String ?: return
        val user = event["user"] as? String ?: return

        processAsync(channel, threadTs, user, text)
    }

    private fun processAsync(channel: String, threadTs: String, userId: String, text: String) {
        val externalChannelId = "$channel:$threadTs"

        scope.launch {
            try {
                val result = askQuestionUseCase.execute(
                    AskQuestionUseCase.Command(
                        conversationId = null,
                        channelType = ChannelType.SLACK,
                        externalChannelId = externalChannelId,
                        userId = userId,
                        userRole = UserRole.INTERNAL,
                        question = text
                    )
                )

                val slackAdapter = notificationAdapters
                    .firstOrNull { it.supportedChannelType == ChannelType.SLACK }

                slackAdapter?.sendMessage(externalChannelId, result.answer)
            } catch (e: Exception) {
                log.error("Slack 메시지 처리 실패: channel={}, user={}", channel, userId, e)
            }
        }
    }

    private fun verifySignature(signature: String?, timestamp: String?, body: String): Boolean {
        if (signature == null || timestamp == null) return false
        val signingSecret = properties.slack.signingSecret ?: return false

        return try {
            val baseString = "v0:$timestamp:$body"
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(SecretKeySpec(signingSecret.toByteArray(), "HmacSHA256"))
            val hash = mac.doFinal(baseString.toByteArray())
            val expected = "v0=${hash.joinToString("") { "%02x".format(it) }}"
            expected == signature
        } catch (e: Exception) {
            log.warn("Slack 서명 검증 실패", e)
            false
        }
    }
}
