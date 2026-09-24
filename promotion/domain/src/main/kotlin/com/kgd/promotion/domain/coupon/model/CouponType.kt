package com.kgd.promotion.domain.coupon.model

/** 정액(원) · 정률(bp, 최대 할인 필수) */
enum class CouponType { FIXED, RATE }

/** 할인 부담 주체. SELLER 쿠폰은 그 판매자 라인에만 적용되고 판매자 순매출을 줄인다 */
enum class CouponBearer { PLATFORM, SELLER }

enum class CouponDefinitionStatus { ACTIVE, INACTIVE }

/** 쿠폰 적용 대상 한 줄 — 판매자와 라인 결제 대상 금액(판매가 × 수량, 배송비 제외) */
data class CouponLine(val sellerId: Long, val amount: Long) {
    init {
        require(amount >= 0) { "라인 금액은 음수일 수 없습니다" }
    }
}
