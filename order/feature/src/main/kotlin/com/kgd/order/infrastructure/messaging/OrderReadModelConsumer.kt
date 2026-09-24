package com.kgd.order.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.order.application.readmodel.usecase.SyncReadModelUseCase
import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.benefit.model.CouponDefinitionView
import com.kgd.order.domain.benefit.model.CouponType
import com.kgd.order.domain.benefit.model.PointBalanceView
import com.kgd.order.domain.benefit.model.UserCouponView
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.UUID

/**
 * 다른 도메인 이벤트 → order 읽기 모델(SR-3). 주문서가 HTTP 자기 호출 없이 가격·판매 가능·혜택을 계산하게 한다.
 *
 * 같은 이벤트 재전달은 멱등 원장(`order-read-model` 그룹)이, 순서 역전은 각 모델의 `occurredAt` 비교가 거른다.
 * 페이로드 모양은 각 발행자의 페이로드 클래스(ProductEvents · SellerEventPayload · Promotion*Payload)를 따른다.
 */
@Component
class OrderReadModelConsumer(
    private val sync: SyncReadModelUseCase,
    private val objectMapper: ObjectMapper,
    // 한정자 필수 — 폴드된 호스트에는 도메인 수만큼 핸들러가 있다(ADR-0093)
    @Qualifier("orderIdempotentEventHandler") private val idempotentEventHandler: IdempotentEventHandler,
    private val idempotentMetrics: IdempotentMetrics,
) {
    private val log = KotlinLogging.logger {}

    @KafkaListener(
        topics = ["product.item.created", "product.item.updated"],
        groupId = CONSUMER_GROUP,
        containerFactory = "orderKafkaListenerContainerFactory",
    )
    fun onProduct(record: ConsumerRecord<String, String>) = handle(record) { node ->
        sync.syncProduct(
            ProductView(
                productId = node.long("productId"),
                name = node.required("name").asString(),
                // 아웃박스 전환 전 이벤트는 가격이 DECIMAL(12000.00)로 실렸다 — 소수부 0 만 받는다
                price = node.required("price").decimalValue().longValueExact(),
                status = node.required("status").asString(),
                sellerId = node.long("sellerId"),
                occurredAt = productOccurredAt(node),
            ),
        )
    }

    @KafkaListener(
        topics = [
            "seller.seller.applied",
            "seller.seller.approved",
            "seller.seller.suspended",
            "seller.seller.reactivated",
            "seller.seller.updated",
        ],
        groupId = CONSUMER_GROUP,
        containerFactory = "orderKafkaListenerContainerFactory",
    )
    fun onSeller(record: ConsumerRecord<String, String>) = handle(record) { node ->
        sync.syncSeller(
            SellerView(
                sellerId = node.long("sellerId"),
                status = node.required("status").asString(),
                commissionRateBp = node.get("commissionRateBp")?.takeUnless { it.isNull }?.asInt(),
                shippingFee = node.long("shippingFee"),
                occurredAt = instantOf(node.required("occurredAt")),
                memberId = node.get("memberId")?.takeUnless { it.isNull }?.asString(),
            ),
        )
    }

    /** 정의는 만든 뒤 바뀌지 않아 페이로드에 시각이 없다 — 레코드 시각을 쓴다 */
    @KafkaListener(topics = ["promotion.coupon.defined"], groupId = CONSUMER_GROUP, containerFactory = "orderKafkaListenerContainerFactory")
    fun onCouponDefined(record: ConsumerRecord<String, String>) = handle(record) { node ->
        sync.syncCouponDefinition(
            CouponDefinitionView(
                couponDefinitionId = node.long("couponDefinitionId"),
                type = CouponType.valueOf(node.required("type").asString()),
                amount = node.optionalLong("amount"),
                rateBp = node.get("rateBp")?.takeUnless { it.isNull }?.asInt(),
                maxDiscount = node.optionalLong("maxDiscount"),
                minOrderAmount = node.long("minOrderAmount"),
                validFrom = instantOf(node.required("validFrom")),
                validUntil = instantOf(node.required("validUntil")),
                bearer = CouponBearer.valueOf(node.required("bearer").asString()),
                sellerId = node.optionalLong("sellerId"),
                status = node.required("status").asString(),
                occurredAt = Instant.ofEpochMilli(record.timestamp()),
            ),
        )
    }

    @KafkaListener(topics = ["promotion.coupon.issued"], groupId = CONSUMER_GROUP, containerFactory = "orderKafkaListenerContainerFactory")
    fun onCouponIssued(record: ConsumerRecord<String, String>) = handle(record) { node ->
        sync.syncUserCoupon(
            UserCouponView(
                userCouponId = node.long("userCouponId"),
                memberId = node.required("memberId").asString(),
                couponDefinitionId = node.long("couponDefinitionId"),
                status = node.required("status").asString(),
                occurredAt = instantOf(node.required("issuedAt")),
            ),
        )
    }

    /** 사용자 쿠폰 상태는 별도 토픽 없이 보류 이벤트의 userCouponStatus 로 온다. 쿠폰 없는 보류는 건너뛴다 */
    @KafkaListener(
        topics = [
            "promotion.hold.reserved",
            "promotion.hold.failed",
            "promotion.hold.confirmed",
            "promotion.hold.cancelled",
            "promotion.hold.expired",
            "promotion.hold.restored",
        ],
        groupId = CONSUMER_GROUP,
        containerFactory = "orderKafkaListenerContainerFactory",
    )
    fun onHold(record: ConsumerRecord<String, String>) = handle(record) { node ->
        val userCouponId = node.optionalLong("userCouponId")
        val status = node.get("userCouponStatus")?.takeUnless { it.isNull }?.asString()
        val memberId = node.get("memberId")?.takeUnless { it.isNull }?.asString()
        val definitionId = node.optionalLong("couponDefinitionId")
        if (userCouponId == null || status == null || memberId == null || definitionId == null) return@handle
        sync.syncUserCoupon(UserCouponView(userCouponId, memberId, definitionId, status, instantOf(node.required("occurredAt"))))
    }

    @KafkaListener(topics = ["promotion.point.changed"], groupId = CONSUMER_GROUP, containerFactory = "orderKafkaListenerContainerFactory")
    fun onPointChanged(record: ConsumerRecord<String, String>) = handle(record) { node ->
        sync.syncPointBalance(
            PointBalanceView(
                memberId = node.required("memberId").asString(),
                balance = node.long("balance"),
                occurredAt = instantOf(node.required("occurredAt")),
            ),
        )
    }

    private fun handle(record: ConsumerRecord<String, String>, apply: (JsonNode) -> Unit) {
        val node = objectMapper.readTree(record.value())
        val eventId = node.get("eventId")?.asString()?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (eventId == null) {
            // occurredAt 비교로 같은 결과에 수렴하므로 원장 없이 반영해도 안전하다 (ADR-0029 §4)
            log.warn { "missing eventId topic=${record.topic()} — graceful degrade, executing without dedup" }
            idempotentMetrics.missingId(CONSUMER_GROUP)
            apply(node)
            return
        }
        idempotentEventHandler.process(eventId, CONSUMER_GROUP) { apply(node) }
    }

    /**
     * 상품 이벤트 시각. 새 이벤트는 `occurredAt`(Instant)을 싣는다. 그 전 이벤트는 존 없는 `eventTime` 뿐이라
     * 서울 시각으로 읽는다 — 발행 파드가 UTC 였다면 실제보다 이르게 읽혀, 뒤에 온 새 이벤트를 덮지 못한다(안전한 쪽).
     */
    private fun productOccurredAt(node: JsonNode): Instant {
        node.get("occurredAt")?.takeUnless { it.isNull }?.let { return instantOf(it) }
        val eventTime = node.required("eventTime")
        val local = if (eventTime.isArray) {
            LocalDateTime.of(
                eventTime[0].asInt(), eventTime[1].asInt(), eventTime[2].asInt(),
                eventTime[3]?.asInt() ?: 0, eventTime[4]?.asInt() ?: 0, eventTime[5]?.asInt() ?: 0, eventTime[6]?.asInt() ?: 0,
            )
        } else {
            LocalDateTime.parse(eventTime.asString())
        }
        return local.atZone(LEGACY_EVENT_ZONE).toInstant()
    }

    /**
     * Instant 는 설정에 따라 ISO 문자열 또는 epoch 초(소수)로 직렬화된다 — 둘 다 받는다.
     * 숫자형은 트리로 읽을 때 double 이 되어 μs 아래 자리가 흐려진다(ms 까지는 정확). 발행자 기본은 ISO 문자열이다.
     */
    private fun instantOf(node: JsonNode): Instant =
        if (node.isNumber) {
            val seconds = node.decimalValue()
            Instant.ofEpochSecond(seconds.toLong(), seconds.remainder(BigDecimal.ONE).movePointRight(9).toLong())
        } else {
            Instant.parse(node.asString())
        }

    private fun JsonNode.required(field: String): JsonNode =
        get(field)?.takeUnless { it.isNull } ?: throw IllegalArgumentException("필드 없음: $field")

    private fun JsonNode.long(field: String): Long = required(field).asLong()

    private fun JsonNode.optionalLong(field: String): Long? = get(field)?.takeUnless { it.isNull }?.asLong()

    companion object {
        const val CONSUMER_GROUP = "order-read-model"
        private val LEGACY_EVENT_ZONE: ZoneId = ZoneId.of("Asia/Seoul")
    }
}
