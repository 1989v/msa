package com.kgd.wishlist.infrastructure.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class MemberEventConsumer(
    private val wishlistRepositoryPort: WishlistRepositoryPort,
    private val objectMapper: ObjectMapper
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["member.withdrawn"],
        groupId = "wishlist-member-cleanup"
    )
    @Transactional
    fun onMemberWithdrawn(record: ConsumerRecord<String, String>) {
        log.info { "Received member.withdrawn event: key=${record.key()}" }

        val node = objectMapper.readTree(record.value())
        val memberId = node.get("memberId").asLong()

        wishlistRepositoryPort.deleteAllByMemberId(memberId)
        log.info { "Deleted all wishlist items for memberId=$memberId" }
    }
}
