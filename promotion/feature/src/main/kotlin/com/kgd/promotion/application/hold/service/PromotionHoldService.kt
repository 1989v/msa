package com.kgd.promotion.application.hold.service

import com.kgd.promotion.application.coupon.port.CouponDefinitionRepositoryPort
import com.kgd.promotion.application.coupon.port.UserCouponRepositoryPort
import com.kgd.promotion.application.hold.port.HoldCommand
import com.kgd.promotion.application.hold.port.HoldEvent
import com.kgd.promotion.application.hold.port.HoldEventPort
import com.kgd.promotion.application.hold.port.HoldEventType
import com.kgd.promotion.application.hold.port.HoldRestorationRepositoryPort
import com.kgd.promotion.application.hold.port.PromotionHoldRepositoryPort
import com.kgd.promotion.application.hold.usecase.HoldAnswer
import com.kgd.promotion.application.hold.usecase.ProcessPromotionCommandUseCase
import com.kgd.promotion.application.point.service.PointLedgerRecorder
import com.kgd.promotion.domain.coupon.model.CouponEvaluation
import com.kgd.promotion.domain.coupon.model.UserCoupon
import com.kgd.promotion.domain.coupon.model.UserCouponStatus
import com.kgd.promotion.domain.hold.model.HoldCancelResult
import com.kgd.promotion.domain.hold.model.HoldConfirmResult
import com.kgd.promotion.domain.hold.model.HoldRestoration
import com.kgd.promotion.domain.hold.model.HoldRestoreResult
import com.kgd.promotion.domain.hold.model.PromotionFailureReason
import com.kgd.promotion.domain.hold.model.PromotionHold
import com.kgd.promotion.domain.point.model.PointLedgerType
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Duration
import java.time.Instant

/**
 * 혜택 보류(TCC). 명령마다 promotion_db 한 트랜잭션 — 쿠폰·포인트·보류 행·아웃박스 행이 함께 커밋된다.
 *
 * 효과는 orderId 로 한 번만 일어난다(보류 행 유니크 · 상태 머신 · 원장 멱등 키). 다시 온 명령에는
 * 지금 상태로 다시 답한다 — 사가가 기한 재발행한 명령도 답을 받는다.
 */
@Service
class PromotionHoldService(
    private val holds: PromotionHoldRepositoryPort,
    private val restorations: HoldRestorationRepositoryPort,
    private val userCoupons: UserCouponRepositoryPort,
    private val definitions: CouponDefinitionRepositoryPort,
    private val points: PointLedgerRecorder,
    private val events: HoldEventPort,
    @Qualifier("promotionClock") private val clock: Clock,
    @Qualifier("promotionHoldDuration") private val holdDuration: Duration,
) : ProcessPromotionCommandUseCase {
    private val log = KotlinLogging.logger {}

    @Transactional("promotionTransactionManager")
    override fun reserve(command: ProcessPromotionCommandUseCase.Reserve): HoldAnswer {
        val now = clock.instant()
        holds.findByOrderId(command.orderId)?.let { existing ->
            return if (existing.failureReason != null) {
                answer(HoldEventType.FAILED, HoldCommand.RESERVE, existing, now, existing.failureReason)
            } else {
                answer(HoldEventType.RESERVED, HoldCommand.RESERVE, existing, now)
            }
        }

        fun fail(reason: PromotionFailureReason): HoldAnswer {
            val failed = holds.create(
                PromotionHold.failed(command.orderId, command.memberId, command.userCouponId, command.pointAmount, reason, now),
            )
            log.info { "혜택 보류 실패: orderId=${command.orderId}, reason=$reason" }
            return answer(HoldEventType.FAILED, HoldCommand.RESERVE, failed, now, reason)
        }

        val coupon: UserCoupon? = command.userCouponId?.let { id ->
            val c = userCoupons.findById(id) ?: return fail(PromotionFailureReason.COUPON_NOT_FOUND)
            if (c.memberId != command.memberId) return fail(PromotionFailureReason.COUPON_NOT_OWNED)
            if (!c.isUsable) return fail(PromotionFailureReason.COUPON_NOT_AVAILABLE)
            val definition = definitions.findById(c.couponDefinitionId) ?: return fail(PromotionFailureReason.COUPON_NOT_FOUND)
            when (val e = definition.evaluate(command.lines, now)) {
                is CouponEvaluation.NotApplicable -> return fail(e.reason)
                is CouponEvaluation.Applicable ->
                    if (e.discount != command.couponDiscount) return fail(PromotionFailureReason.DISCOUNT_MISMATCH)
            }
            c
        }
        if (coupon == null && command.couponDiscount != 0L) return fail(PromotionFailureReason.DISCOUNT_MISMATCH)

        val balance = if (command.pointAmount > 0) {
            points.find(command.memberId)?.takeIf { it.balance >= command.pointAmount }
                ?: return fail(PromotionFailureReason.INSUFFICIENT_POINTS)
        } else {
            null
        }

        coupon?.let { it.reserve(command.orderId, now); userCoupons.save(it) }
        balance?.let { b -> points.record(b) { it.use(command.pointAmount, command.orderId, "hold-use:${command.orderId}", now) } }
        val hold = holds.create(
            PromotionHold.reserve(
                orderId = command.orderId, memberId = command.memberId, userCouponId = coupon?.id,
                couponDefinitionId = coupon?.couponDefinitionId, couponDiscount = command.couponDiscount,
                pointAmount = command.pointAmount, now = now, holdDuration = holdDuration,
            ),
        )
        return answer(HoldEventType.RESERVED, HoldCommand.RESERVE, hold, now, couponStatus = coupon?.status)
    }

    @Transactional("promotionTransactionManager")
    override fun confirm(orderId: Long): HoldAnswer {
        val now = clock.instant()
        val hold = holds.findByOrderId(orderId) ?: return notFound(orderId, HoldCommand.CONFIRM, now)
        return when (val result = hold.confirm(now)) {
            HoldConfirmResult.Confirmed -> {
                val coupon = hold.userCouponId?.let { id -> loadCoupon(id).also { it.confirmUse(orderId, now); userCoupons.save(it) } }
                holds.save(hold)
                answer(HoldEventType.CONFIRMED, HoldCommand.CONFIRM, hold, now, couponStatus = coupon?.status)
            }
            HoldConfirmResult.AlreadyConfirmed -> answer(HoldEventType.CONFIRMED, HoldCommand.CONFIRM, hold, now)
            // 스케줄러보다 확정 명령이 먼저 왔다 — 여기서 만료시키고 풀어 준 뒤 두 사실을 다 알린다
            HoldConfirmResult.ExpiredNow -> {
                val coupon = release(hold, PointLedgerType.USE_EXPIRE, "hold-expire", now)
                holds.save(hold)
                answer(HoldEventType.EXPIRED, HoldCommand.CONFIRM, hold, now, couponStatus = coupon?.status)
                answer(HoldEventType.FAILED, HoldCommand.CONFIRM, hold, now, PromotionFailureReason.EXPIRED, coupon?.status)
            }
            is HoldConfirmResult.Rejected -> answer(HoldEventType.FAILED, HoldCommand.CONFIRM, hold, now, result.reason)
        }
    }

    @Transactional("promotionTransactionManager")
    override fun cancel(orderId: Long): HoldAnswer {
        val now = clock.instant()
        // 보류가 없으면 붙잡은 것도 없다 — 보상 단계가 멈추지 않게 취소됐다고 답한다
        val hold = holds.findByOrderId(orderId)
            ?: return publish(HoldEvent(HoldEventType.CANCELLED, HoldCommand.CANCEL, orderId, null, null, occurredAt = now))
        return when (val result = hold.cancel(now)) {
            HoldCancelResult.Released -> {
                val coupon = release(hold, PointLedgerType.USE_CANCEL, "hold-cancel", now)
                holds.save(hold)
                answer(HoldEventType.CANCELLED, HoldCommand.CANCEL, hold, now, couponStatus = coupon?.status)
            }
            HoldCancelResult.NothingHeld -> answer(HoldEventType.CANCELLED, HoldCommand.CANCEL, hold, now)
            is HoldCancelResult.Rejected -> answer(HoldEventType.FAILED, HoldCommand.CANCEL, hold, now, result.reason)
        }
    }

    @Transactional("promotionTransactionManager")
    override fun restore(command: ProcessPromotionCommandUseCase.Restore): HoldAnswer {
        val now = clock.instant()
        val hold = holds.findByOrderId(command.orderId) ?: return notFound(command.orderId, HoldCommand.RESTORE, now)
        restorations.findByRestoreKey(command.restoreKey)?.let { done ->
            return answer(HoldEventType.RESTORED, HoldCommand.RESTORE, hold, now, restoredPoints = done.points)
        }
        return when (val result = hold.restore(command.pointAmount, command.fullCancel, now)) {
            is HoldRestoreResult.Rejected -> answer(HoldEventType.FAILED, HoldCommand.RESTORE, hold, now, result.reason)
            is HoldRestoreResult.Restored -> {
                if (result.points > 0) {
                    val balance = points.findOrOpen(hold.memberId, now)
                    points.record(balance) {
                        it.giveBack(result.points, PointLedgerType.RESTORE, hold.orderId, "restore:${command.restoreKey}", now)
                    }
                }
                val coupon = if (result.returnCoupon) {
                    val c = loadCoupon(requireNotNull(hold.userCouponId))
                    val stillValid = definitions.findById(c.couponDefinitionId)?.isValidAt(now) == true
                    c.returnAfterFullCancel(hold.orderId, stillValid, now)
                    userCoupons.save(c)
                } else {
                    null
                }
                holds.save(hold)
                restorations.save(HoldRestoration(command.restoreKey, hold.orderId, result.points, result.returnCoupon, now))
                answer(HoldEventType.RESTORED, HoldCommand.RESTORE, hold, now, couponStatus = coupon?.status, restoredPoints = result.points)
            }
        }
    }

    /** 스케줄러가 부른다 — 기한이 지난 RESERVED 하나를 만료시킨다. 이미 바뀌었으면 false */
    @Transactional("promotionTransactionManager")
    fun expire(orderId: Long): Boolean {
        val now = clock.instant()
        val hold = holds.findByOrderId(orderId) ?: return false
        if (!hold.expire(now)) return false
        val coupon = release(hold, PointLedgerType.USE_EXPIRE, "hold-expire", now)
        holds.save(hold)
        answer(HoldEventType.EXPIRED, HoldCommand.EXPIRE, hold, now, couponStatus = coupon?.status)
        return true
    }

    /** 보류가 붙잡은 쿠폰·포인트를 푼다. 푼 쿠폰(있으면)을 돌려준다 */
    private fun release(hold: PromotionHold, type: PointLedgerType, keyPrefix: String, now: Instant): UserCoupon? {
        if (hold.pointAmount > 0) {
            val balance = points.findOrOpen(hold.memberId, now)
            points.record(balance) { it.giveBack(hold.pointAmount, type, hold.orderId, "$keyPrefix:${hold.orderId}", now) }
        }
        return hold.userCouponId?.let { id -> loadCoupon(id).also { it.release(hold.orderId, now); userCoupons.save(it) } }
    }

    private fun loadCoupon(id: Long): UserCoupon =
        userCoupons.findById(id) ?: error("보류가 가리키는 사용자 쿠폰이 없다: userCouponId=$id")

    private fun notFound(orderId: Long, command: HoldCommand, now: Instant): HoldAnswer = publish(
        HoldEvent(HoldEventType.FAILED, command, orderId, null, null, PromotionFailureReason.HOLD_NOT_FOUND, occurredAt = now),
    )

    private fun answer(
        type: HoldEventType,
        command: HoldCommand,
        hold: PromotionHold,
        now: Instant,
        reason: PromotionFailureReason? = null,
        couponStatus: UserCouponStatus? = null,
        restoredPoints: Long? = null,
    ): HoldAnswer {
        val status = couponStatus ?: hold.userCouponId?.let { userCoupons.findById(it)?.status }
        return publish(HoldEvent(type, command, hold.orderId, hold, status, reason, restoredPoints, now))
    }

    private fun publish(event: HoldEvent): HoldAnswer {
        events.publish(event)
        return HoldAnswer(event.type, event.reason)
    }
}
