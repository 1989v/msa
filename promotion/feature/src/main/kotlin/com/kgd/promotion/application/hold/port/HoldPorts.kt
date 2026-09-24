package com.kgd.promotion.application.hold.port

import com.kgd.promotion.domain.coupon.model.UserCouponStatus
import com.kgd.promotion.domain.hold.model.HoldRestoration
import com.kgd.promotion.domain.hold.model.PromotionFailureReason
import com.kgd.promotion.domain.hold.model.PromotionHold
import java.time.Instant

interface PromotionHoldRepositoryPort {
    /** 새 보류. 같은 orderId 가 이미 있으면 DB 유니크가 막는다 */
    fun create(hold: PromotionHold): PromotionHold
    fun save(hold: PromotionHold): PromotionHold
    fun findByOrderId(orderId: Long): PromotionHold?

    /** RESERVED 중 기한이 [now] 이하인 보류의 orderId — 오래된 것부터 */
    fun findExpiredReservedOrderIds(now: Instant, limit: Int): List<Long>
}

interface HoldRestorationRepositoryPort {
    fun findByRestoreKey(restoreKey: String): HoldRestoration?
    fun save(restoration: HoldRestoration)
}

/**
 * `promotion.hold.*` (키 = orderId). 명령 하나에 답 하나 — 효과는 orderId 로 한 번만 일어나지만
 * 다시 온 명령에도 지금 상태로 답한다(사가가 기한 재발행한 명령이 답 없이 남지 않게).
 */
interface HoldEventPort {
    fun publish(event: HoldEvent)
}

enum class HoldEventType(val topic: String) {
    RESERVED("promotion.hold.reserved"),
    FAILED("promotion.hold.failed"),
    CONFIRMED("promotion.hold.confirmed"),
    CANCELLED("promotion.hold.cancelled"),
    EXPIRED("promotion.hold.expired"),
    RESTORED("promotion.hold.restored"),
}

/** 이 이벤트를 낳은 명령. 스케줄러 만료는 EXPIRE */
enum class HoldCommand { RESERVE, CONFIRM, CANCEL, RESTORE, EXPIRE }

data class HoldEvent(
    val type: HoldEventType,
    val command: HoldCommand,
    val orderId: Long,
    /** 보류 행이 없을 때(찾지 못함) null */
    val hold: PromotionHold?,
    /** 이 이벤트 시점의 사용자 쿠폰 상태 — order 읽기 모델이 쿠폰 상태를 따라간다 */
    val userCouponStatus: UserCouponStatus?,
    val reason: PromotionFailureReason? = null,
    /** restored 의 이번 원복 포인트 */
    val restoredPoints: Long? = null,
    val occurredAt: Instant,
)
