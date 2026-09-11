package com.kgd.chatbot.infrastructure.persistence.repository

import com.kgd.chatbot.domain.model.ChannelType
import com.kgd.chatbot.domain.model.ConversationStatus
import com.kgd.chatbot.infrastructure.persistence.entity.ConversationJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface ConversationJpaRepository : JpaRepository<ConversationJpaEntity, Long> {

    @Query("""
        SELECT c FROM ConversationJpaEntity c
        LEFT JOIN FETCH c.messages
        WHERE c.id = :id
    """)
    fun findByIdWithMessages(id: Long): ConversationJpaEntity?

    @Query("""
        SELECT c FROM ConversationJpaEntity c
        LEFT JOIN FETCH c.messages
        WHERE c.channelType = :channelType
        AND c.externalChannelId = :externalChannelId
        AND c.status = :status
        ORDER BY c.lastActiveAt DESC
        LIMIT 1
    """)
    fun findActiveByExternalChannelId(
        channelType: ChannelType,
        externalChannelId: String,
        status: ConversationStatus = ConversationStatus.ACTIVE
    ): ConversationJpaEntity?
}
