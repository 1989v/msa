package com.kgd.promotion.domain.hold.model

import java.time.Duration
import java.time.Instant

/**
 * 주문 하나의 혜택 보류(TCC). 주문당 한 행(orderId 유니크) — 같은 주문의 보류 명령이 두 번 와도 보류는 하나다.
 * 보류 판정이 실패해도 FAILED 행을 남긴다(뒤늦게 온 같은 명령이 다시 보류하지 않게).
 *
 * RESERVED → CONFIRMED | CANCELLED | EXPIRED · CONFIRMED·RESTORED → RESTORED.
 * 보류 기한은 [expiresAt] — 기한 정각부터 만료다. 확정·취소·원복은 예외 대신 결과를 돌려준다:
 * 사가가 보낸 명령에 대한 답(실패 사유 포함)이지 계약 위반이 아니라서 DLT 로 가면 안 된다.
 */
class PromotionHold private constructor(
    val id: Long?,
    val orderId: Long,
    val memberId: String,
    val userCouponId: Long?,
    val couponDefinitionId: Long?,
    val couponDiscount: Long,
    val pointAmount: Long,
    status: PromotionHoldStatus,
    val failureReason: PromotionFailureReason?,
    val expiresAt: Instant,
    restoredPointAmount: Long,
    couponReturned: Boolean,
    val createdAt: Instant,
    updatedAt: Instant,
) {
    var status: PromotionHoldStatus = status
        private set
    var restoredPointAmount: Long = restoredPointAmount
        private set

    /** 전체 취소로 쿠폰을 처리했다(돌려줬거나 기간이 지나 소멸) — 두 번 하지 않는다 */
    var couponReturned: Boolean = couponReturned
        private set
    var updatedAt: Instant = updatedAt
        private set

    fun isExpiredAt(now: Instant): Boolean = status == PromotionHoldStatus.RESERVED && !now.isBefore(expiresAt)

    fun confirm(now: Instant): HoldConfirmResult = when (status) {
        PromotionHoldStatus.RESERVED ->
            if (isExpiredAt(now)) {
                moveTo(PromotionHoldStatus.EXPIRED, now)
                HoldConfirmResult.ExpiredNow
            } else {
                moveTo(PromotionHoldStatus.CONFIRMED, now)
                HoldConfirmResult.Confirmed
            }
        PromotionHoldStatus.CONFIRMED, PromotionHoldStatus.RESTORED -> HoldConfirmResult.AlreadyConfirmed
        PromotionHoldStatus.EXPIRED -> HoldConfirmResult.Rejected(PromotionFailureReason.EXPIRED)
        PromotionHoldStatus.CANCELLED -> HoldConfirmResult.Rejected(PromotionFailureReason.CANCELLED)
        PromotionHoldStatus.FAILED -> HoldConfirmResult.Rejected(PromotionFailureReason.NOT_RESERVED)
    }

    fun cancel(now: Instant): HoldCancelResult = when (status) {
        PromotionHoldStatus.RESERVED -> {
            moveTo(PromotionHoldStatus.CANCELLED, now)
            HoldCancelResult.Released
        }
        PromotionHoldStatus.CANCELLED, PromotionHoldStatus.EXPIRED, PromotionHoldStatus.FAILED -> HoldCancelResult.NothingHeld
        PromotionHoldStatus.CONFIRMED, PromotionHoldStatus.RESTORED ->
            HoldCancelResult.Rejected(PromotionFailureReason.ALREADY_CONFIRMED)
    }

    /** 기한이 지난 RESERVED 만 만료시킨다. 바뀌었으면 true */
    fun expire(now: Instant): Boolean {
        if (!isExpiredAt(now)) return false
        moveTo(PromotionHoldStatus.EXPIRED, now)
        return true
    }

    /**
     * 클레임 원복. 포인트는 부분 금액도 되고 합은 사용분까지. 쿠폰은 [fullCancel] 일 때만, 한 번만 돌려준다
     * (부분 취소는 쿠폰 할인을 유지한다 — 스펙 SR-8).
     */
    fun restore(points: Long, fullCancel: Boolean, now: Instant): HoldRestoreResult {
        require(points >= 0) { "원복 포인트는 음수일 수 없습니다" }
        if (status != PromotionHoldStatus.CONFIRMED && status != PromotionHoldStatus.RESTORED) {
            return HoldRestoreResult.Rejected(PromotionFailureReason.NOT_CONFIRMED)
        }
        if (points > pointAmount - restoredPointAmount) {
            return HoldRestoreResult.Rejected(PromotionFailureReason.RESTORE_EXCEEDS_USED)
        }
        val returnCoupon = fullCancel && userCouponId != null && !couponReturned
        restoredPointAmount += points
        if (returnCoupon) couponReturned = true
        moveTo(PromotionHoldStatus.RESTORED, now)
        return HoldRestoreResult.Restored(points, returnCoupon)
    }

    private fun moveTo(next: PromotionHoldStatus, now: Instant) {
        status = next
        updatedAt = now
    }

    companion object {
        fun reserve(
            orderId: Long,
            memberId: String,
            userCouponId: Long?,
            couponDefinitionId: Long?,
            couponDiscount: Long,
            pointAmount: Long,
            now: Instant,
            holdDuration: Duration,
        ): PromotionHold {
            require(couponDiscount >= 0 && pointAmount >= 0) { "할인·포인트는 음수일 수 없습니다" }
            require((userCouponId == null) == (couponDefinitionId == null)) { "쿠폰과 정의는 함께 온다" }
            require(!holdDuration.isNegative && !holdDuration.isZero) { "보류 기한은 0 보다 길어야 합니다" }
            return PromotionHold(
                null, orderId, memberId, userCouponId, couponDefinitionId, couponDiscount, pointAmount,
                PromotionHoldStatus.RESERVED, null, now.plus(holdDuration), 0L, false, now, now,
            )
        }

        /** 보류 판정 실패 기록 — 아무것도 붙잡지 않는다 */
        fun failed(
            orderId: Long,
            memberId: String,
            userCouponId: Long?,
            pointAmount: Long,
            reason: PromotionFailureReason,
            now: Instant,
        ) = PromotionHold(
            null, orderId, memberId, userCouponId, null, 0L, maxOf(pointAmount, 0L),
            PromotionHoldStatus.FAILED, reason, now, 0L, false, now, now,
        )

        fun restore(
            id: Long,
            orderId: Long,
            memberId: String,
            userCouponId: Long?,
            couponDefinitionId: Long?,
            couponDiscount: Long,
            pointAmount: Long,
            status: PromotionHoldStatus,
            failureReason: PromotionFailureReason?,
            expiresAt: Instant,
            restoredPointAmount: Long,
            couponReturned: Boolean,
            createdAt: Instant,
            updatedAt: Instant,
        ) = PromotionHold(
            id, orderId, memberId, userCouponId, couponDefinitionId, couponDiscount, pointAmount, status, failureReason,
            expiresAt, restoredPointAmount, couponReturned, createdAt, updatedAt,
        )
    }
}

enum class PromotionHoldStatus { RESERVED, CONFIRMED, CANCELLED, EXPIRED, RESTORED, FAILED }

sealed interface HoldConfirmResult {
    data object Confirmed : HoldConfirmResult
    data object AlreadyConfirmed : HoldConfirmResult

    /** RESERVED 였지만 기한이 지나 이 자리에서 만료시켰다 — 호출자가 붙잡은 것을 풀어야 한다 */
    data object ExpiredNow : HoldConfirmResult
    data class Rejected(val reason: PromotionFailureReason) : HoldConfirmResult
}

sealed interface HoldCancelResult {
    /** 붙잡고 있던 것을 풀어야 한다 */
    data object Released : HoldCancelResult

    /** 붙잡은 것이 없다(이미 취소·만료·실패) — 응답만 한다 */
    data object NothingHeld : HoldCancelResult
    data class Rejected(val reason: PromotionFailureReason) : HoldCancelResult
}

sealed interface HoldRestoreResult {
    data class Restored(val points: Long, val returnCoupon: Boolean) : HoldRestoreResult
    data class Rejected(val reason: PromotionFailureReason) : HoldRestoreResult
}
