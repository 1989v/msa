package com.kgd.chatbot.infrastructure.persistence.entity

import com.kgd.chatbot.domain.model.Message
import com.kgd.chatbot.domain.model.MessageRole
import jakarta.persistence.*
import java.math.BigDecimal
import java.time.Instant

@Entity
@Table(name = "message")
class MessageJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    val conversation: ConversationJpaEntity,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val role: MessageRole,

    @Column(nullable = false, columnDefinition = "TEXT")
    val content: String,

    @Column(nullable = false)
    val tokenCount: Int = 0,

    @Column(precision = 10, scale = 6)
    val costUsd: BigDecimal? = null,

    @Column(nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
) {
    fun toDomain(): Message = Message.restore(
        id = id!!,
        role = role,
        content = content,
        tokenCount = tokenCount,
        costUsd = costUsd,
        createdAt = createdAt
    )

    companion object {
        fun fromDomain(message: Message, conversation: ConversationJpaEntity): MessageJpaEntity =
            MessageJpaEntity(
                id = message.id,
                conversation = conversation,
                role = message.role,
                content = message.content,
                tokenCount = message.tokenCount,
                costUsd = message.costUsd,
                createdAt = message.createdAt
            )
    }
}
