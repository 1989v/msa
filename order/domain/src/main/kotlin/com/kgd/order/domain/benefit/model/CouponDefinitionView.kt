package com.kgd.order.domain.benefit.model

import com.kgd.order.domain.sheet.model.OrderSheetRejection
import java.math.BigInteger
import java.time.Instant

/** 정액(원) · 정률(bp, 최대 할인 필수) */
enum class CouponType { FIXED, RATE }

/** 할인 부담 주체. SELLER 쿠폰은 그 판매자 라인에만 적용되고 판매자 순매출을 줄인다 */
enum class CouponBearer { PLATFORM, SELLER }

/** 쿠폰 적용 대상 한 줄 — 판매자와 라인 금액(판매가 × 수량, 배송비 제외) */
data class CouponTargetLine(val sellerId: Long, val amount: Long)

/** 쿠폰을 이 주문서에 적용한 견적. [targetIndexes] 는 할인을 안분할 라인 위치 */
sealed interface CouponQuote {
    data class Applicable(val discount: Long, val targetIndexes: List<Int>) : CouponQuote
    data class NotApplicable(val reason: OrderSheetRejection) : CouponQuote
}

/**
 * order 가 보는 쿠폰 정의 — `promotion.coupon.defined` 로 채운다. 정의 조건은 만든 뒤 바뀌지 않는다.
 *
 * 견적 규칙은 promotion 의 보류 판정과 같아야 한다 — 다르면 사가의 reserve 가 DISCOUNT_MISMATCH 로 실패한다.
 * 기간 `[validFrom, validUntil)`, 대상 금액은 PLATFORM 이면 모든 라인·SELLER 면 그 판매자 라인의 합이고
 * 최소 주문 금액도 그 합으로 본다. 정률 = 내림(대상 × bp / 10000) ≤ 최대 할인, 정액 ≤ 대상 금액.
 */
data class CouponDefinitionView(
    val couponDefinitionId: Long,
    val type: CouponType,
    val amount: Long?,
    val rateBp: Int?,
    val maxDiscount: Long?,
    val minOrderAmount: Long,
    val validFrom: Instant,
    val validUntil: Instant,
    val bearer: CouponBearer,
    val sellerId: Long?,
    val status: String,
    val occurredAt: Instant,
) {
    fun isSupersededBy(incoming: CouponDefinitionView): Boolean = !incoming.occurredAt.isBefore(occurredAt)

    fun quote(lines: List<CouponTargetLine>, now: Instant): CouponQuote {
        if (status != ACTIVE) return CouponQuote.NotApplicable(OrderSheetRejection.COUPON_INACTIVE)
        if (now.isBefore(validFrom) || !now.isBefore(validUntil)) {
            return CouponQuote.NotApplicable(OrderSheetRejection.COUPON_NOT_IN_PERIOD)
        }
        val targets = lines.indices.filter { bearer == CouponBearer.PLATFORM || lines[it].sellerId == sellerId }
        if (targets.isEmpty()) return CouponQuote.NotApplicable(OrderSheetRejection.COUPON_NOT_APPLICABLE)
        val eligible = targets.fold(0L) { acc, i -> Math.addExact(acc, lines[i].amount) }
        if (eligible < minOrderAmount) return CouponQuote.NotApplicable(OrderSheetRejection.BELOW_MIN_ORDER_AMOUNT)
        return CouponQuote.Applicable(discountFor(eligible), targets)
    }

    private fun discountFor(eligible: Long): Long = when (type) {
        CouponType.FIXED -> minOf(requireNotNull(amount) { "정액 쿠폰에 금액이 없다" }, eligible)
        CouponType.RATE -> minOf(
            BigInteger.valueOf(eligible).multiply(BigInteger.valueOf(requireNotNull(rateBp).toLong()))
                .divide(BP_SCALE).toLong(),
            requireNotNull(maxDiscount) { "정률 쿠폰에 최대 할인이 없다" },
        )
    }

    companion object {
        const val ACTIVE = "ACTIVE"
        private val BP_SCALE: BigInteger = BigInteger.valueOf(10_000L)
    }
}
