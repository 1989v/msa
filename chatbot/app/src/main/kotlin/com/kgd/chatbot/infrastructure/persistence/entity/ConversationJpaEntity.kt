package com.kgd.chatbot.infrastructure.persistence.entity

import com.kgd.chatbot.domain.model.*
import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "conversation")
class ConversationJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val channelType: ChannelType,

    @Column(nullable = false)
    val externalChannelId: String,

    @Column(nullable = false)
    val userId: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val userRole: UserRole,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: ConversationStatus = ConversationStatus.ACTIVE,

    @OneToMany(mappedBy = "conversation", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderBy("createdAt ASC")
    val messages: MutableList<MessageJpaEntity> = mutableListOf(),

    @Column(nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(nullable = false)
    var lastActiveAt: Instant = Instant.now()
) {
    fun toDomain(): Conversation = Conversation.restore(
        id = id!!,
        channelType = channelType,
        externalChannelId = externalChannelId,
        userId = userId,
        userRole = userRole,
        status = status,
        messages = messages.map { it.toDomain() },
        createdAt = createdAt,
        lastActiveAt = lastActiveAt
    )

    companion object {
        fun fromDomain(conversation: Conversation): ConversationJpaEntity {
            val entity = ConversationJpaEntity(
                id = conversation.id,
                channelType = conversation.channelType,
                externalChannelId = conversation.externalChannelId,
                userId = conversation.userId,
                userRole = conversation.userRole,
                status = conversation.status,
                createdAt = conversation.createdAt,
                lastActiveAt = conversation.lastActiveAt
            )
            conversation.messages.forEach { msg ->
                val msgEntity = MessageJpaEntity.fromDomain(msg, entity)
                entity.messages.add(msgEntity)
            }
            return entity
        }
    }
}
