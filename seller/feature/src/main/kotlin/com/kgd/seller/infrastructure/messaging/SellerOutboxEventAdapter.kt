package com.kgd.seller.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.seller.application.seller.port.SellerEventPort
import com.kgd.seller.application.seller.port.SellerEventType
import com.kgd.seller.domain.seller.model.Seller
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.Instant

/**
 * 판매자 이벤트를 seller_db 아웃박스 행으로 남긴다. 토픽 = eventType, 키 = sellerId.
 * 읽기 모델(order·product)과 auth(ROLE_SELLER)가 받는다 — 계좌·사업자번호·대표자는 싣지 않는다.
 */
@Component
class SellerOutboxEventAdapter(
    @Qualifier("sellerOutboxPort") private val outbox: OutboxPort,
    private val objectMapper: ObjectMapper,
) : SellerEventPort {

    override fun publish(type: SellerEventType, seller: Seller) {
        val sellerId = requireNotNull(seller.id) { "저장 전 판매자는 발행할 수 없다" }
        val payload = SellerEventPayload(
            sellerId = sellerId,
            memberId = seller.memberId,
            status = seller.status.name,
            commissionRateBp = seller.commissionRateBp,
            shippingFee = seller.shippingFee,
            settlementCycle = seller.settlementCycle.name,
            occurredAt = seller.updatedAt,
        )
        outbox.save(
            aggregateType = AGGREGATE_TYPE,
            aggregateId = sellerId,
            eventType = topicOf(type),
            payload = objectMapper.writeValueAsString(payload),
            partitionKey = sellerId.toString(),
            headers = emptyMap(),
        )
    }

    companion object {
        const val AGGREGATE_TYPE = "seller"

        fun topicOf(type: SellerEventType): String = when (type) {
            SellerEventType.APPLIED -> "seller.seller.applied"
            SellerEventType.APPROVED -> "seller.seller.approved"
            SellerEventType.SUSPENDED -> "seller.seller.suspended"
            SellerEventType.REACTIVATED -> "seller.seller.reactivated"
            SellerEventType.UPDATED -> "seller.seller.updated"
        }
    }
}

/** `seller.seller.*` 페이로드 — 저장 포맷은 infrastructure 가 소유한다 */
data class SellerEventPayload(
    val sellerId: Long,
    val memberId: String,
    val status: String,
    val commissionRateBp: Int?,
    val shippingFee: Long,
    val settlementCycle: String,
    val occurredAt: Instant,
)
