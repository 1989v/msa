package com.kgd.chatbot.domain.model

import java.time.Instant

class Conversation private constructor(
    val id: Long? = null,
    val channelType: ChannelType,
    val externalChannelId: String,
    val userId: String,
    val userRole: UserRole,
    var status: ConversationStatus,
    private val _messages: MutableList<Message> = mutableListOf(),
    val createdAt: Instant = Instant.now(),
    var lastActiveAt: Instant = Instant.now()
) {
    val messages: List<Message> get() = _messages.toList()

    companion object {
        fun create(
            channelType: ChannelType,
            externalChannelId: String,
            userId: String,
            userRole: UserRole
        ): Conversation {
            require(externalChannelId.isNotBlank()) { "채널 ID가 비어있을 수 없습니다" }
            require(userId.isNotBlank()) { "사용자 ID가 비어있을 수 없습니다" }
            return Conversation(
                channelType = channelType,
                externalChannelId = externalChannelId,
                userId = userId,
                userRole = userRole,
                status = ConversationStatus.ACTIVE
            )
        }

        fun restore(
            id: Long,
            channelType: ChannelType,
            externalChannelId: String,
            userId: String,
            userRole: UserRole,
            status: ConversationStatus,
            messages: List<Message>,
            createdAt: Instant,
            lastActiveAt: Instant
        ): Conversation = Conversation(
            id = id,
            channelType = channelType,
            externalChannelId = externalChannelId,
            userId = userId,
            userRole = userRole,
            status = status,
            _messages = messages.toMutableList(),
            createdAt = createdAt,
            lastActiveAt = lastActiveAt
        )
    }

    fun addMessage(message: Message) {
        check(status == ConversationStatus.ACTIVE) { "종료된 대화에 메시지를 추가할 수 없습니다" }
        _messages.add(message)
        lastActiveAt = Instant.now()
    }

    fun close() {
        check(status == ConversationStatus.ACTIVE) { "이미 종료된 대화입니다" }
        status = ConversationStatus.CLOSED
    }

    fun expire() {
        if (status == ConversationStatus.ACTIVE) {
            status = ConversationStatus.EXPIRED
        }
    }
}
