package com.kgd.seller.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.seller.application.seller.port.SellerEventPort
import com.kgd.seller.application.seller.port.SellerEventType
import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerStatus
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.Instant

/**
 * 판매자 이벤트를 seller_db 아웃박스 행으로 남긴다. 토픽 = eventType, 키 = sellerId.
 * 읽기 모델(order·product)과 auth(ROLE_SELLER)가 받는다 — 계좌·사업자번호·대표자는 싣지 않는다.
 *
 * 상호([SellerEventPayload.businessName])는 승인된 판매자(ACTIVE·SUSPENDED)일 때만 싣는다 — 구매 화면에 보일 이름은 승인 뒤에만
 * 필요하고, 심사 중(PENDING) 상호를 퍼뜨리면 반려 때 seller_db 에서 파기해도 읽기 모델에 남는다(개인사업자 상호는 개인정보일 수 있다).
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
            businessName = seller.businessName.takeIf { seller.status in NAMED_STATUSES },
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

        /** 상호를 싣는 상태 — 승인을 거친 판매자 */
        private val NAMED_STATUSES = setOf(SellerStatus.ACTIVE, SellerStatus.SUSPENDED)

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
    /** 상호 — 승인된 판매자만(심사 중·반려는 null) */
    val businessName: String? = null,
)
