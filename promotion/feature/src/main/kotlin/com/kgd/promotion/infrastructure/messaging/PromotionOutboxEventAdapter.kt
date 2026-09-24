package com.kgd.promotion.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.promotion.application.coupon.port.CouponEventPort
import com.kgd.promotion.application.hold.port.HoldEvent
import com.kgd.promotion.application.hold.port.HoldEventPort
import com.kgd.promotion.application.point.port.PointEventPort
import com.kgd.promotion.domain.coupon.model.CouponDefinition
import com.kgd.promotion.domain.coupon.model.UserCoupon
import com.kgd.promotion.domain.point.model.PointBalance
import com.kgd.promotion.domain.point.model.PointLedgerEntry
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.Instant

/**
 * 혜택 이벤트를 promotion_db 아웃박스 행으로 남긴다. 호출자의 트랜잭션 안에서만 부른다.
 *
 * - `promotion.hold.*` — 키 orderId (사가가 주고받는 명령·답이 한 파티션에 줄 선다)
 * - `promotion.coupon.defined` — 키 정의 id · `promotion.coupon.issued` · `promotion.point.changed` — 키 회원 id
 *   (order 읽기 모델용. 주문서 견적에 필요한 조건·상태·잔액을 전부 싣는다)
 */
@Component
class PromotionOutboxEventAdapter(
    @Qualifier("promotionOutboxPort") private val outbox: OutboxPort,
    private val objectMapper: ObjectMapper,
) : HoldEventPort, CouponEventPort, PointEventPort {

    override fun publish(event: HoldEvent) {
        val hold = event.hold
        val payload = HoldEventPayload(
            orderId = event.orderId,
            command = event.command.name,
            memberId = hold?.memberId,
            holdStatus = hold?.status?.name,
            userCouponId = hold?.userCouponId,
            couponDefinitionId = hold?.couponDefinitionId,
            userCouponStatus = event.userCouponStatus?.name,
            couponDiscount = hold?.couponDiscount ?: 0L,
            pointAmount = hold?.pointAmount ?: 0L,
            restoredPointAmount = hold?.restoredPointAmount ?: 0L,
            restoredPoints = event.restoredPoints,
            couponReturned = hold?.couponReturned ?: false,
            reason = event.reason?.name,
            expiresAt = hold?.expiresAt,
            occurredAt = event.occurredAt,
        )
        save(HOLD_AGGREGATE, event.orderId, event.type.topic, payload, event.orderId.toString())
    }

    override fun defined(definition: CouponDefinition) {
        val id = requireNotNull(definition.id)
        val payload = CouponDefinedPayload(
            couponDefinitionId = id, name = definition.name, type = definition.type.name, amount = definition.amount,
            rateBp = definition.rateBp, maxDiscount = definition.maxDiscount, minOrderAmount = definition.minOrderAmount,
            validFrom = definition.validFrom, validUntil = definition.validUntil, bearer = definition.bearer.name,
            sellerId = definition.sellerId, status = definition.status.name, issueLimit = definition.issueLimit,
        )
        save(DEFINITION_AGGREGATE, id, DEFINED_TOPIC, payload, id.toString())
    }

    override fun issued(coupon: UserCoupon) {
        val id = requireNotNull(coupon.id)
        val payload = CouponIssuedPayload(id, coupon.memberId, coupon.couponDefinitionId, coupon.status.name, coupon.issuedAt)
        save(USER_COUPON_AGGREGATE, id, ISSUED_TOPIC, payload, coupon.memberId)
    }

    override fun changed(balance: PointBalance, entry: PointLedgerEntry) {
        val payload = PointChangedPayload(
            memberId = balance.memberId, balance = balance.balance, delta = entry.delta, type = entry.type.name,
            orderId = entry.orderId, occurredAt = entry.createdAt,
        )
        save(POINT_AGGREGATE, requireNotNull(balance.id), POINT_TOPIC, payload, balance.memberId)
    }

    private fun save(aggregateType: String, aggregateId: Long, topic: String, payload: Any, key: String) {
        outbox.save(
            aggregateType = aggregateType,
            aggregateId = aggregateId,
            eventType = topic,
            payload = objectMapper.writeValueAsString(payload),
            partitionKey = key,
            headers = emptyMap(),
        )
    }

    companion object {
        const val HOLD_AGGREGATE = "promotion_hold"
        const val DEFINITION_AGGREGATE = "coupon_definition"
        const val USER_COUPON_AGGREGATE = "user_coupon"
        const val POINT_AGGREGATE = "point_balance"
        const val DEFINED_TOPIC = "promotion.coupon.defined"
        const val ISSUED_TOPIC = "promotion.coupon.issued"
        const val POINT_TOPIC = "promotion.point.changed"
    }
}

/** `promotion.hold.*` — 보류 행이 없을 때(HOLD_NOT_FOUND·보류 없는 취소)는 보류 필드가 비고 금액은 0 */
data class HoldEventPayload(
    val orderId: Long,
    val command: String,
    val memberId: String?,
    val holdStatus: String?,
    val userCouponId: Long?,
    val couponDefinitionId: Long?,
    val userCouponStatus: String?,
    val couponDiscount: Long,
    val pointAmount: Long,
    /** 누적 원복 포인트 */
    val restoredPointAmount: Long,
    /** restored 의 이번 원복 포인트 */
    val restoredPoints: Long?,
    val couponReturned: Boolean,
    val reason: String?,
    val expiresAt: Instant?,
    val occurredAt: Instant,
)

data class CouponDefinedPayload(
    val couponDefinitionId: Long,
    val name: String,
    val type: String,
    val amount: Long?,
    val rateBp: Int?,
    val maxDiscount: Long?,
    val minOrderAmount: Long,
    val validFrom: Instant,
    val validUntil: Instant,
    val bearer: String,
    val sellerId: Long?,
    val status: String,
    val issueLimit: Int,
)

data class CouponIssuedPayload(
    val userCouponId: Long,
    val memberId: String,
    val couponDefinitionId: Long,
    val status: String,
    val issuedAt: Instant,
)

data class PointChangedPayload(
    val memberId: String,
    val balance: Long,
    val delta: Long,
    val type: String,
    val orderId: Long?,
    val occurredAt: Instant,
)
