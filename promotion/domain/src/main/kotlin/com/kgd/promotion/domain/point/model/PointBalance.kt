package com.kgd.promotion.domain.point.model

import com.kgd.promotion.domain.point.exception.InsufficientPointsException
import java.time.Instant

/**
 * 회원의 포인트 잔액. 잔액을 바꾸는 메서드는 전부 원장 한 줄([PointLedgerEntry])을 돌려준다 —
 * 잔액만 바뀌고 원장이 없는 변경을 만들 수 없다. 원장 합 = 잔액. 잔액 ≥ 0.
 * 동시 변경은 저장소의 `@Version` 이 막는다.
 */
class PointBalance private constructor(
    val id: Long?,
    val memberId: String,
    balance: Long,
    updatedAt: Instant,
) {
    var balance: Long = balance
        private set
    var updatedAt: Instant = updatedAt
        private set

    /** 어드민 지급 */
    fun earn(amount: Long, idempotencyKey: String, actorId: String, reason: String?, now: Instant): PointLedgerEntry =
        apply(amount, PointLedgerType.EARN, null, idempotencyKey, actorId, reason, now)

    /** 주문 보류 — 보류 시점에 잔액에서 뺀다 */
    fun use(amount: Long, orderId: Long, idempotencyKey: String, now: Instant): PointLedgerEntry {
        require(amount > 0) { "포인트 금액은 0 보다 커야 합니다" }
        if (amount > balance) throw InsufficientPointsException(balance, amount)
        return apply(-amount, PointLedgerType.USE, orderId, idempotencyKey, null, null, now)
    }

    /** 보류 취소(보상) · 보류 만료 · 클레임 원복 — 되돌려 넣는다 */
    fun giveBack(amount: Long, type: PointLedgerType, orderId: Long, idempotencyKey: String, now: Instant): PointLedgerEntry {
        require(type in GIVE_BACK_TYPES) { "되돌림 유형이 아닙니다: $type" }
        return apply(amount, type, orderId, idempotencyKey, null, null, now)
    }

    private fun apply(
        delta: Long,
        type: PointLedgerType,
        orderId: Long?,
        idempotencyKey: String,
        actorId: String?,
        reason: String?,
        now: Instant,
    ): PointLedgerEntry {
        require(delta != 0L && (type == PointLedgerType.USE) == (delta < 0)) { "포인트 금액은 0 보다 커야 합니다" }
        val next = Math.addExact(balance, delta)
        check(next >= 0) { "잔액은 음수가 될 수 없습니다" }
        balance = next
        updatedAt = now
        return PointLedgerEntry(
            memberId = memberId, delta = delta, type = type, balanceAfter = next, orderId = orderId,
            idempotencyKey = idempotencyKey, actorId = actorId, reason = reason, createdAt = now,
        )
    }

    companion object {
        private val GIVE_BACK_TYPES = setOf(PointLedgerType.USE_CANCEL, PointLedgerType.USE_EXPIRE, PointLedgerType.RESTORE)

        fun open(memberId: String, now: Instant): PointBalance {
            require(memberId.isNotBlank()) { "회원 id 가 비었습니다" }
            return PointBalance(null, memberId, 0L, now)
        }

        fun restore(id: Long, memberId: String, balance: Long, updatedAt: Instant) = PointBalance(id, memberId, balance, updatedAt)
    }
}

/** 포인트 원장 한 줄 — 추가만 한다. [idempotencyKey] 는 유니크(같은 변경이 두 번 들어가지 않는다) */
data class PointLedgerEntry(
    val memberId: String,
    val delta: Long,
    val type: PointLedgerType,
    val balanceAfter: Long,
    val orderId: Long?,
    val idempotencyKey: String,
    val actorId: String?,
    val reason: String?,
    val createdAt: Instant,
    val id: Long? = null,
)

/** 적립(어드민 지급) · 사용(보류) · 사용 취소(보상) · 사용 만료(보류 만료) · 원복(클레임) */
enum class PointLedgerType { EARN, USE, USE_CANCEL, USE_EXPIRE, RESTORE }
