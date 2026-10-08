package com.kgd.wishlist.infrastructure.consumer

import org.springframework.beans.factory.annotation.Qualifier
import tools.jackson.databind.ObjectMapper
import com.kgd.wishlist.application.share.port.CollectionSharePort
import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@Qualifier("wishlistTransactionManager")
class MemberEventConsumer(
    private val wishlistRepositoryPort: WishlistRepositoryPort,
    private val collectionSharePort: CollectionSharePort,
    private val objectMapper: ObjectMapper
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["member.withdrawn"],
        groupId = "wishlist-member-cleanup",
        containerFactory = "wishlistKafkaListenerContainerFactory",
    )
    @Transactional
    fun onMemberWithdrawn(record: ConsumerRecord<String, String>) {
        log.info { "Received member.withdrawn event: key=${record.key()}" }

        val node = objectMapper.readTree(record.value())
        val memberId = node.get("memberId").asLong()

        wishlistRepositoryPort.deleteAllByMemberId(memberId)
        // 이미 퍼진 공유 토큰이 탈퇴 뒤에도 묶음을 열지 않게 같은 트랜잭션에서 지운다 (ADR-0107)
        collectionSharePort.deleteAllByMemberId(memberId)
        log.info { "Deleted all wishlist items and collection shares for memberId=$memberId" }
    }
}
