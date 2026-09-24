package com.kgd.promotion.domain.coupon.model

import com.kgd.promotion.domain.hold.model.PromotionFailureReason
import java.time.Instant

/**
 * 쿠폰 정의 — 조건과 발행 상한. 만든 뒤 조건은 바뀌지 않는다(주문서 견적과 보류 판정이 같은 조건을 본다).
 *
 * 사용 기간은 `[validFrom, validUntil)` — 시작 정각은 포함, 종료 정각은 제외.
 * 할인 대상 금액은 PLATFORM 이면 모든 라인, SELLER 면 그 판매자 라인의 합이고 최소 주문 금액도 그 합으로 본다.
 * 정률 할인 = 내림(대상 금액 × rateBp / 10000), [maxDiscount] 이하. 정액 할인은 대상 금액을 넘지 않는다.
 *
 * [issuedCount] 는 읽기용이다 — 발행 수 증가는 저장소의 조건부 UPDATE 만 한다(상한 보장).
 */
class CouponDefinition private constructor(
    val id: Long?,
    val name: String,
    val type: CouponType,
    val amount: Long?,
    val rateBp: Int?,
    val maxDiscount: Long?,
    val minOrderAmount: Long,
    val validFrom: Instant,
    val validUntil: Instant,
    val issueLimit: Int,
    val issuedCount: Int,
    val bearer: CouponBearer,
    val sellerId: Long?,
    val status: CouponDefinitionStatus,
    val createdBy: String,
    val createdAt: Instant,
) {
    fun isValidAt(now: Instant): Boolean =
        status == CouponDefinitionStatus.ACTIVE && !now.isBefore(validFrom) && now.isBefore(validUntil)

    fun evaluate(lines: List<CouponLine>, now: Instant): CouponEvaluation {
        if (status != CouponDefinitionStatus.ACTIVE) return CouponEvaluation.NotApplicable(PromotionFailureReason.COUPON_INACTIVE)
        if (!isValidAt(now)) return CouponEvaluation.NotApplicable(PromotionFailureReason.COUPON_NOT_IN_PERIOD)
        val targets = if (bearer == CouponBearer.SELLER) lines.filter { it.sellerId == sellerId } else lines
        if (targets.isEmpty()) return CouponEvaluation.NotApplicable(PromotionFailureReason.COUPON_NOT_APPLICABLE)
        val eligible = targets.fold(0L) { acc, l -> Math.addExact(acc, l.amount) }
        if (eligible < minOrderAmount) return CouponEvaluation.NotApplicable(PromotionFailureReason.BELOW_MIN_ORDER_AMOUNT)
        return CouponEvaluation.Applicable(discountFor(eligible), eligible)
    }

    private fun discountFor(eligible: Long): Long = when (type) {
        CouponType.FIXED -> minOf(requireNotNull(amount), eligible)
        CouponType.RATE -> minOf(Math.multiplyExact(eligible, requireNotNull(rateBp).toLong()) / BP_SCALE, requireNotNull(maxDiscount))
    }

    companion object {
        const val BP_SCALE = 10_000L

        fun create(
            name: String,
            type: CouponType,
            amount: Long?,
            rateBp: Int?,
            maxDiscount: Long?,
            minOrderAmount: Long,
            validFrom: Instant,
            validUntil: Instant,
            issueLimit: Int,
            bearer: CouponBearer,
            sellerId: Long?,
            createdBy: String,
            now: Instant,
        ): CouponDefinition {
            require(name.isNotBlank()) { "쿠폰 이름이 비었습니다" }
            when (type) {
                CouponType.FIXED -> {
                    require(amount != null && amount > 0) { "정액 쿠폰은 금액이 필요합니다" }
                    require(rateBp == null && maxDiscount == null) { "정액 쿠폰에는 율·최대 할인이 없습니다" }
                }
                CouponType.RATE -> {
                    require(rateBp != null && rateBp in 1..BP_SCALE.toInt()) { "정률 쿠폰의 율은 1~10000bp 입니다" }
                    require(maxDiscount != null && maxDiscount > 0) { "정률 쿠폰은 최대 할인이 필요합니다" }
                    require(amount == null) { "정률 쿠폰에는 정액 금액이 없습니다" }
                }
            }
            require(minOrderAmount >= 0) { "최소 주문 금액은 음수일 수 없습니다" }
            require(validFrom.isBefore(validUntil)) { "사용 기간 종료가 시작보다 늦어야 합니다" }
            require(issueLimit > 0) { "발행 상한은 1 이상입니다" }
            when (bearer) {
                CouponBearer.SELLER -> require(sellerId != null && sellerId > 0) { "판매자 부담 쿠폰은 판매자 id 가 필요합니다" }
                CouponBearer.PLATFORM -> require(sellerId == null) { "플랫폼 부담 쿠폰에는 판매자 id 가 없습니다" }
            }
            return CouponDefinition(
                id = null, name = name.trim(), type = type, amount = amount, rateBp = rateBp, maxDiscount = maxDiscount,
                minOrderAmount = minOrderAmount, validFrom = validFrom, validUntil = validUntil, issueLimit = issueLimit,
                issuedCount = 0, bearer = bearer, sellerId = sellerId, status = CouponDefinitionStatus.ACTIVE,
                createdBy = createdBy, createdAt = now,
            )
        }

        fun restore(
            id: Long,
            name: String,
            type: CouponType,
            amount: Long?,
            rateBp: Int?,
            maxDiscount: Long?,
            minOrderAmount: Long,
            validFrom: Instant,
            validUntil: Instant,
            issueLimit: Int,
            issuedCount: Int,
            bearer: CouponBearer,
            sellerId: Long?,
            status: CouponDefinitionStatus,
            createdBy: String,
            createdAt: Instant,
        ) = CouponDefinition(
            id, name, type, amount, rateBp, maxDiscount, minOrderAmount, validFrom, validUntil, issueLimit, issuedCount,
            bearer, sellerId, status, createdBy, createdAt,
        )
    }
}
