package com.kgd.chatbot.infrastructure.persistence.adapter

import com.kgd.chatbot.application.chat.port.ConversationRepositoryPort
import com.kgd.chatbot.domain.model.ChannelType
import com.kgd.chatbot.domain.model.Conversation
import com.kgd.chatbot.infrastructure.persistence.entity.ConversationJpaEntity
import com.kgd.chatbot.infrastructure.persistence.entity.MessageJpaEntity
import com.kgd.chatbot.infrastructure.persistence.repository.ConversationJpaRepository
import org.springframework.stereotype.Component

@Component
class ConversationRepositoryAdapter(
    private val jpaRepository: ConversationJpaRepository
) : ConversationRepositoryPort {

    override fun save(conversation: Conversation): Conversation {
        val id = conversation.id
        val entity = if (id != null) {
            val existing = jpaRepository.findByIdWithMessages(id)
                ?: throw IllegalStateException("대화(id=$id)가 DB에 존재하지 않습니다")
            existing.status = conversation.status
            existing.lastActiveAt = conversation.lastActiveAt
            syncMessages(existing, conversation)
            existing
        } else {
            ConversationJpaEntity.fromDomain(conversation)
        }
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): Conversation? =
        jpaRepository.findByIdWithMessages(id)?.toDomain()

    override fun findByExternalChannelId(channelType: ChannelType, externalChannelId: String): Conversation? =
        jpaRepository.findActiveByExternalChannelId(channelType, externalChannelId)?.toDomain()

    private fun syncMessages(entity: ConversationJpaEntity, conversation: Conversation) {
        val existingIds = entity.messages.mapNotNull { it.id }.toSet()
        val newMessages = conversation.messages.filter { it.id == null || it.id !in existingIds }
        newMessages.forEach { msg ->
            entity.messages.add(MessageJpaEntity.fromDomain(msg, entity))
        }
    }
}
