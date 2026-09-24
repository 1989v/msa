package com.kgd.promotion.application.hold.usecase

import com.kgd.promotion.application.hold.port.HoldEventType
import com.kgd.promotion.domain.coupon.model.CouponLine
import com.kgd.promotion.domain.hold.model.PromotionFailureReason

/**
 * 사가·클레임이 보내는 `promotion.command.{reserve,confirm,cancel,restore}` (키 = orderId).
 * 업무상 실패는 예외가 아니라 `promotion.hold.failed{reason}` 답이다 — 예외는 계약 위반(입력 오류)만.
 */
interface ProcessPromotionCommandUseCase {
    fun reserve(command: Reserve): HoldAnswer
    fun confirm(orderId: Long): HoldAnswer
    fun cancel(orderId: Long): HoldAnswer
    fun restore(command: Restore): HoldAnswer

    /**
     * @param lines 쿠폰 대상 금액 계산용 라인(판매자·판매가×수량). 배송비는 넣지 않는다.
     * @param couponDiscount 주문서가 견적한 쿠폰 할인. 보류 시점 계산과 다르면 DISCOUNT_MISMATCH 로 실패한다.
     */
    data class Reserve(
        val orderId: Long,
        val memberId: String,
        val userCouponId: Long?,
        val couponDiscount: Long,
        val pointAmount: Long,
        val lines: List<CouponLine>,
    ) {
        init {
            require(memberId.isNotBlank()) { "memberId 가 비었다" }
            require(couponDiscount >= 0 && pointAmount >= 0) { "할인·포인트는 음수일 수 없다" }
        }
    }

    /** @param fullCancel 전체 취소 — 이때만 쿠폰을 돌려준다(기간 안이면 RETURNED) */
    data class Restore(val orderId: Long, val restoreKey: String, val pointAmount: Long, val fullCancel: Boolean) {
        init {
            require(restoreKey.isNotBlank()) { "restoreKey 가 비었다 — 원복 멱등 키는 필수" }
            require(pointAmount >= 0) { "원복 포인트는 음수일 수 없다" }
        }
    }
}

/** 명령에 낸 답 */
data class HoldAnswer(val type: HoldEventType, val reason: PromotionFailureReason? = null)

/** 보류 기한 스케줄러 — 기한이 지난 RESERVED 를 EXPIRED 로 바꾸고 붙잡은 쿠폰·포인트를 푼다 */
interface ExpirePromotionHoldsUseCase {
    /** @return 만료시킨 보류 수 */
    fun expireDue(): Int
}
